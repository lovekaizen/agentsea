import { describe, it, expect } from 'vitest';
import {
  createStore,
  MemoryStore,
  PgVectorStore,
  WeaviateStore,
  MilvusStore,
} from '../stores/index.js';

describe('createStore factory', () => {
  it('creates a MemoryStore for type "memory"', () => {
    const store = createStore('memory', { dimensions: 8 });
    expect(store).toBeInstanceOf(MemoryStore);
  });

  it('creates a PgVectorStore for type "pgvector"', () => {
    const store = createStore('pgvector', {
      dimensions: 8,
      tableName: 'embeddings',
    } as never);
    expect(store).toBeInstanceOf(PgVectorStore);
  });

  it('creates a WeaviateStore for type "weaviate"', () => {
    const store = createStore('weaviate', {
      dimensions: 8,
      url: 'http://localhost:8080',
      className: 'Doc',
    } as never);
    expect(store).toBeInstanceOf(WeaviateStore);
  });

  it('creates a MilvusStore for type "milvus"', () => {
    const store = createStore('milvus', {
      dimensions: 8,
      url: 'http://localhost:19530',
      collectionName: 'docs',
    } as never);
    expect(store).toBeInstanceOf(MilvusStore);
  });

  it('throws for an unknown store type', () => {
    expect(() =>
      // @ts-expect-error intentionally passing an invalid type
      createStore('not-a-store', { dimensions: 8 }),
    ).toThrow(/unknown vector store/i);
  });
});
