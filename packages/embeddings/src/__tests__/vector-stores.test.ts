/**
 * Unit tests for the pgvector / Weaviate / Milvus store adapters.
 *
 * The pgvector store is driven through an injected mock `pg` Pool; the Weaviate
 * and Milvus stores through injected high-level mock backends. This exercises
 * the stores' translation logic (records -> driver calls, driver rows ->
 * matches) without any live database. End-to-end coverage against real services
 * lives behind guarded integration tests.
 */

import { describe, it, expect, vi } from 'vitest';
import { PgVectorStore } from '../stores/PgVectorStore.js';
import { WeaviateStore } from '../stores/WeaviateStore.js';
import { MilvusStore } from '../stores/MilvusStore.js';
import type { WeaviateBackend } from '../stores/WeaviateStore.js';
import type { MilvusBackend } from '../stores/MilvusStore.js';

describe('PgVectorStore (injected pool)', () => {
  function mockPool(rows: Array<Record<string, unknown>> = []) {
    return {
      query: vi.fn().mockResolvedValue({ rows, rowCount: rows.length }),
      end: vi.fn().mockResolvedValue(undefined),
    };
  }

  it('creates the extension/table on init and upserts rows', async () => {
    const pool = mockPool();
    const store = new PgVectorStore({
      type: 'pgvector',
      tableName: 'docs',
      dimensions: 3,
      pool,
    });

    const res = await store.upsert([
      { id: 'a', vector: [1, 0, 0], text: 'A', metadata: { lang: 'en' } },
    ]);

    expect(res.upsertedCount).toBe(1);
    const sqls = pool.query.mock.calls.map((c) => c[0] as string);
    expect(
      sqls.some((s) => /CREATE EXTENSION IF NOT EXISTS vector/.test(s)),
    ).toBe(true);
    expect(sqls.some((s) => /CREATE TABLE IF NOT EXISTS "docs"/.test(s))).toBe(
      true,
    );
    const insert = pool.query.mock.calls.find((c) =>
      /INSERT INTO "docs"/.test(c[0] as string),
    );
    expect(insert).toBeTruthy();
    // Vector is serialized to a pgvector literal.
    expect((insert![1] as unknown[])[3]).toBe('[1,0,0]');
  });

  it('maps query rows to scored matches (cosine distance -> similarity)', async () => {
    const pool = mockPool([
      { id: 'a', content: 'A', metadata: { lang: 'en' }, distance: 0.1 },
      { id: 'b', content: 'B', metadata: {}, distance: 0.4 },
    ]);
    const store = new PgVectorStore({
      type: 'pgvector',
      tableName: 'docs',
      dimensions: 3,
      metric: 'cosine',
      pool,
    });

    const result = await store.query([1, 0, 0], { topK: 2 });
    expect(result.matches).toHaveLength(2);
    expect(result.matches[0]).toMatchObject({ id: 'a', score: 0.9 });
    expect(result.matches[1].score).toBeCloseTo(0.6);
    // The ORDER BY uses the cosine operator.
    const select = pool.query.mock.calls.find((c) =>
      /ORDER BY/.test(c[0] as string),
    );
    expect(select![0]).toContain('<=>');
  });

  it('reports exact deleted counts from rowCount', async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 2 }),
      end: vi.fn(),
    };
    const store = new PgVectorStore({
      type: 'pgvector',
      tableName: 'docs',
      dimensions: 3,
      pool,
    });
    const res = await store.delete(['a', 'b']);
    expect(res).toMatchObject({ deletedCount: 2, countExact: true });
  });

  it('does not close an injected (caller-owned) pool', async () => {
    const pool = mockPool();
    const store = new PgVectorStore({
      type: 'pgvector',
      tableName: 'docs',
      dimensions: 3,
      pool,
    });
    await store.init();
    await store.close();
    expect(pool.end).not.toHaveBeenCalled();
  });
});

describe('WeaviateStore (injected backend)', () => {
  function mockBackend(
    hits: Array<{
      id: string;
      score: number;
      properties: Record<string, unknown>;
    }> = [],
  ): WeaviateBackend {
    return {
      ensureClass: vi.fn().mockResolvedValue(undefined),
      upsert: vi.fn().mockResolvedValue(undefined),
      nearVector: vi.fn().mockResolvedValue(hits),
      deleteByIds: vi.fn().mockResolvedValue(2),
      deleteAll: vi.fn().mockResolvedValue(5),
      count: vi.fn().mockResolvedValue(7),
      ping: vi.fn().mockResolvedValue(undefined),
    };
  }

  it('ensures the class on init and upserts with text merged into properties', async () => {
    const backend = mockBackend();
    const store = new WeaviateStore({
      type: 'weaviate',
      url: 'http://localhost:8080',
      className: 'Doc',
      dimensions: 3,
      backend,
    });

    await store.upsert([
      { id: 'a', vector: [1, 0, 0], text: 'hello', metadata: { lang: 'en' } },
    ]);

    expect(backend.ensureClass).toHaveBeenCalledWith('Doc', 3);
    expect(backend.upsert).toHaveBeenCalledWith('Doc', [
      { id: 'a', vector: [1, 0, 0], properties: { lang: 'en', text: 'hello' } },
    ]);
  });

  it('maps nearVector hits to matches and reports stats', async () => {
    const backend = mockBackend([
      { id: 'a', score: 0.95, properties: { text: 'A', lang: 'en' } },
    ]);
    const store = new WeaviateStore({
      type: 'weaviate',
      url: 'http://localhost:8080',
      className: 'Doc',
      dimensions: 3,
      backend,
    });

    const res = await store.query([1, 0, 0], { topK: 5 });
    expect(res.matches[0]).toMatchObject({ id: 'a', text: 'A', score: 0.95 });

    const stats = await store.getStats();
    expect(stats.vectorCount).toBe(7);
  });
});

describe('MilvusStore (injected backend)', () => {
  function mockBackend(
    hits: Array<{
      id: string;
      score: number;
      text: string;
      metadata: Record<string, unknown>;
    }> = [],
  ): MilvusBackend {
    return {
      ensureCollection: vi.fn().mockResolvedValue(undefined),
      upsert: vi.fn().mockResolvedValue(undefined),
      search: vi.fn().mockResolvedValue(hits),
      deleteByIds: vi.fn().mockResolvedValue(1),
      deleteAll: vi.fn().mockResolvedValue(3),
      count: vi.fn().mockResolvedValue(9),
      ping: vi.fn().mockResolvedValue(undefined),
    };
  }

  it('ensures the collection with the mapped metric type', async () => {
    const backend = mockBackend();
    const store = new MilvusStore({
      type: 'milvus',
      url: 'http://localhost:19530',
      collectionName: 'docs',
      dimensions: 3,
      metric: 'cosine',
      backend,
    });

    await store.upsert([
      { id: 'a', vector: [1, 0, 0], text: 'A', metadata: {} },
    ]);
    expect(backend.ensureCollection).toHaveBeenCalledWith('docs', 3, 'COSINE');
  });

  it('builds a boolean filter expression for search', async () => {
    const backend = mockBackend([
      { id: 'a', score: 0.8, text: 'A', metadata: { lang: 'en' } },
    ]);
    const store = new MilvusStore({
      type: 'milvus',
      url: 'http://localhost:19530',
      collectionName: 'docs',
      dimensions: 3,
      backend,
    });

    const res = await store.query([1, 0, 0], {
      topK: 3,
      filter: { lang: 'en', score: 1 },
    });
    expect(res.matches[0]).toMatchObject({ id: 'a', text: 'A', score: 0.8 });
    expect(backend.search).toHaveBeenCalledWith(
      'docs',
      [1, 0, 0],
      3,
      'metadata["lang"] == "en" && metadata["score"] == 1',
    );
  });

  it('requires dimensions', () => {
    expect(
      () =>
        new MilvusStore({
          type: 'milvus',
          url: 'http://localhost:19530',
          collectionName: 'docs',
        } as never),
    ).toThrow(/dimensions/i);
  });
});
