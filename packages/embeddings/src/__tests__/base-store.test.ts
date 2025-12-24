import { describe, it, expect, beforeEach } from 'vitest';
import { BaseStore } from '../stores/BaseStore.js';
import type {
  VectorRecord,
  UpsertResult,
  DeleteResult,
  StoreQueryResult,
  StoreStats,
  StoreHealth,
  VectorStoreType,
  UpsertOptions,
  DeleteOptions,
  StoreQueryOptions,
  EmbeddingVector,
} from '../types/index.js';

// Concrete implementation for testing
class TestStore extends BaseStore {
  readonly storeType: VectorStoreType = 'memory';
  private records: Map<string, VectorRecord> = new Map();

  async upsert(
    records: VectorRecord[],
    options?: UpsertOptions,
  ): Promise<UpsertResult> {
    const startTime = performance.now();

    for (const record of records) {
      this.records.set(record.id, record);
    }

    return {
      upsertedCount: records.length,
      upsertedIds: records.map((r) => r.id),
      errors: [],
      durationMs: performance.now() - startTime,
    };
  }

  async query(
    vector: EmbeddingVector,
    options?: StoreQueryOptions,
  ): Promise<StoreQueryResult> {
    const startTime = performance.now();
    const allRecords = Array.from(this.records.values());

    const scoredRecords = allRecords.map((record) => ({
      ...record,
      score: this.calculateScore(vector, record.vector),
    }));

    const filtered = this.filterByMetadata(scoredRecords, options?.filter);
    const sorted = filtered.sort((a, b) => b.score - a.score);
    const topK = sorted.slice(0, options?.topK ?? 10);

    return {
      matches: this.toSearchResults(topK, options),
      durationMs: performance.now() - startTime,
    };
  }

  async delete(ids: string[], options?: DeleteOptions): Promise<DeleteResult> {
    const startTime = performance.now();
    let count = 0;

    for (const id of ids) {
      if (this.records.delete(id)) {
        count++;
      }
    }

    return {
      deletedCount: count,
      durationMs: performance.now() - startTime,
    };
  }

  async deleteAll(options?: DeleteOptions): Promise<DeleteResult> {
    const startTime = performance.now();
    const count = this.records.size;
    this.records.clear();

    return {
      deletedCount: count,
      durationMs: performance.now() - startTime,
    };
  }

  async getStats(): Promise<StoreStats> {
    return {
      type: this.storeType,
      vectorCount: this.records.size,
      namespaceCount: 1,
      lastUpdated: Date.now(),
    };
  }

  async checkHealth(): Promise<StoreHealth> {
    return {
      healthy: true,
      latencyMs: 0,
      lastCheck: Date.now(),
    };
  }

  async close(): Promise<void> {
    this.records.clear();
  }
}

describe('BaseStore', () => {
  let store: TestStore;

  beforeEach(() => {
    store = new TestStore({
      type: 'memory',
      namespace: 'test',
      dimensions: 3,
      metric: 'cosine',
    });
  });

  describe('constructor', () => {
    it('should create store with config', () => {
      expect(store.storeType).toBe('memory');
      expect(store.namespace).toBe('test');
      expect(store.dimensions).toBe(3);
      expect(store.metric).toBe('cosine');
    });

    it('should use default values', () => {
      const defaultStore = new TestStore({ type: 'memory' });
      expect(defaultStore.namespace).toBe('default');
      expect(defaultStore.metric).toBe('cosine');
    });
  });

  describe('properties', () => {
    it('should have namespace property', () => {
      expect(store.namespace).toBe('test');
    });

    it('should have dimensions property', () => {
      expect(store.dimensions).toBe(3);
    });

    it('should have metric property', () => {
      expect(store.metric).toBe('cosine');
    });
  });

  describe('calculateScore', () => {
    it('should calculate cosine similarity', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [1, 0, 0];

      const score = store['calculateScore'](vec1, vec2);
      expect(score).toBeCloseTo(1, 5);
    });

    it('should calculate cosine similarity for different vectors', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [0, 1, 0];

      const score = store['calculateScore'](vec1, vec2);
      expect(score).toBeCloseTo(0, 5);
    });

    it('should use euclidean metric when configured', () => {
      const euclideanStore = new TestStore({
        type: 'memory',
        metric: 'euclidean',
      });

      const vec1 = [0, 0, 0];
      const vec2 = [3, 4, 0];

      const score = euclideanStore['calculateScore'](vec1, vec2);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should use dot product metric when configured', () => {
      const dotStore = new TestStore({
        type: 'memory',
        metric: 'dot_product',
      });

      const vec1 = [1, 2, 3];
      const vec2 = [4, 5, 6];

      const score = dotStore['calculateScore'](vec1, vec2);
      expect(score).toBeCloseTo(32, 5); // 1*4 + 2*5 + 3*6
    });
  });

  describe('filterByMetadata', () => {
    it('should filter records by metadata', () => {
      const records: VectorRecord[] = [
        { id: '1', vector: [1, 0, 0], metadata: { category: 'A' } },
        { id: '2', vector: [0, 1, 0], metadata: { category: 'B' } },
        { id: '3', vector: [0, 0, 1], metadata: { category: 'A' } },
      ];

      const filtered = store['filterByMetadata'](records, { category: 'A' });

      expect(filtered).toHaveLength(2);
      expect(filtered.every((r) => r.metadata.category === 'A')).toBe(true);
    });

    it('should return all records when no filter', () => {
      const records: VectorRecord[] = [
        { id: '1', vector: [1, 0, 0], metadata: {} },
        { id: '2', vector: [0, 1, 0], metadata: {} },
      ];

      const filtered = store['filterByMetadata'](records);

      expect(filtered).toHaveLength(2);
    });

    it('should filter by multiple metadata fields', () => {
      const records: VectorRecord[] = [
        {
          id: '1',
          vector: [1, 0, 0],
          metadata: { category: 'A', status: 'active' },
        },
        {
          id: '2',
          vector: [0, 1, 0],
          metadata: { category: 'A', status: 'inactive' },
        },
        {
          id: '3',
          vector: [0, 0, 1],
          metadata: { category: 'B', status: 'active' },
        },
      ];

      const filtered = store['filterByMetadata'](records, {
        category: 'A',
        status: 'active',
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('1');
    });

    it('should filter out records without metadata', () => {
      const records: VectorRecord[] = [
        { id: '1', vector: [1, 0, 0], metadata: { category: 'A' } },
        { id: '2', vector: [0, 1, 0] },
      ];

      const filtered = store['filterByMetadata'](records, { category: 'A' });

      expect(filtered).toHaveLength(1);
    });

    it('should return empty array when no matches', () => {
      const records: VectorRecord[] = [
        { id: '1', vector: [1, 0, 0], metadata: { category: 'A' } },
        { id: '2', vector: [0, 1, 0], metadata: { category: 'B' } },
      ];

      const filtered = store['filterByMetadata'](records, { category: 'C' });

      expect(filtered).toHaveLength(0);
    });
  });

  describe('toSearchResults', () => {
    it('should convert records to search results', () => {
      const records = [
        {
          id: '1',
          vector: [1, 0, 0],
          text: 'test1',
          metadata: { key: 'value' },
          score: 0.9,
        },
        { id: '2', vector: [0, 1, 0], text: 'test2', metadata: {}, score: 0.8 },
      ];

      const results = store['toSearchResults'](records);

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('1');
      expect(results[0].text).toBe('test1');
      expect(results[0].score).toBe(0.9);
      expect(results[0].metadata.key).toBe('value');
    });

    it('should exclude text when specified', () => {
      const records = [
        { id: '1', vector: [1, 0, 0], text: 'test', metadata: {}, score: 0.9 },
      ];

      const results = store['toSearchResults'](records, { includeText: false });

      expect(results[0].text).toBe('');
    });

    it('should exclude metadata when specified', () => {
      const records = [
        {
          id: '1',
          vector: [1, 0, 0],
          text: 'test',
          metadata: { key: 'value' },
          score: 0.9,
        },
      ];

      const results = store['toSearchResults'](records, {
        includeMetadata: false,
      });

      expect(results[0].metadata).toEqual({});
    });

    it('should handle records without text', () => {
      const records = [
        { id: '1', vector: [1, 0, 0], metadata: {}, score: 0.9 },
      ];

      const results = store['toSearchResults'](records);

      expect(results[0].text).toBe('');
    });

    it('should include distance for non-cosine metrics', () => {
      const euclideanStore = new TestStore({
        type: 'memory',
        metric: 'euclidean',
      });

      const records = [
        { id: '1', vector: [1, 0, 0], metadata: {}, score: 0.9 },
      ];

      const results = euclideanStore['toSearchResults'](records);

      expect(results[0].distance).toBeDefined();
    });

    it('should not include distance for cosine metric', () => {
      const records = [
        { id: '1', vector: [1, 0, 0], metadata: {}, score: 0.9 },
      ];

      const results = store['toSearchResults'](records);

      expect(results[0].distance).toBeUndefined();
    });
  });

  describe('integration tests', () => {
    it('should upsert and query records', async () => {
      const records: VectorRecord[] = [
        { id: '1', vector: [1, 0, 0], text: 'test1', metadata: {} },
        { id: '2', vector: [0, 1, 0], text: 'test2', metadata: {} },
        { id: '3', vector: [0, 0, 1], text: 'test3', metadata: {} },
      ];

      await store.upsert(records);

      const result = await store.query([1, 0, 0], { topK: 2 });

      expect(result.matches).toHaveLength(2);
      expect(result.matches[0].id).toBe('1');
    });

    it('should delete records', async () => {
      const records: VectorRecord[] = [
        { id: '1', vector: [1, 0, 0], metadata: {} },
        { id: '2', vector: [0, 1, 0], metadata: {} },
      ];

      await store.upsert(records);
      await store.delete(['1']);

      const stats = await store.getStats();
      expect(stats.vectorCount).toBe(1);
    });

    it('should delete all records', async () => {
      const records: VectorRecord[] = [
        { id: '1', vector: [1, 0, 0], metadata: {} },
        { id: '2', vector: [0, 1, 0], metadata: {} },
      ];

      await store.upsert(records);
      await store.deleteAll();

      const stats = await store.getStats();
      expect(stats.vectorCount).toBe(0);
    });

    it('should filter query results by metadata', async () => {
      const records: VectorRecord[] = [
        { id: '1', vector: [1, 0, 0], metadata: { category: 'A' } },
        { id: '2', vector: [0.9, 0.1, 0], metadata: { category: 'B' } },
      ];

      await store.upsert(records);

      const result = await store.query([1, 0, 0], {
        topK: 10,
        filter: { category: 'A' },
      });

      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].id).toBe('1');
    });

    it('should respect topK parameter', async () => {
      const records: VectorRecord[] = [
        { id: '1', vector: [1, 0, 0], metadata: {} },
        { id: '2', vector: [0, 1, 0], metadata: {} },
        { id: '3', vector: [0, 0, 1], metadata: {} },
      ];

      await store.upsert(records);

      const result = await store.query([1, 0, 0], { topK: 2 });

      expect(result.matches).toHaveLength(2);
    });

    it('should return results sorted by score', async () => {
      const records: VectorRecord[] = [
        { id: '1', vector: [1, 0, 0], metadata: {} },
        { id: '2', vector: [0.8, 0.2, 0], metadata: {} },
        { id: '3', vector: [0.5, 0.5, 0], metadata: {} },
      ];

      await store.upsert(records);

      const result = await store.query([1, 0, 0], { topK: 10 });

      for (let i = 1; i < result.matches.length; i++) {
        expect(result.matches[i - 1].score).toBeGreaterThanOrEqual(
          result.matches[i].score,
        );
      }
    });

    it('should track duration for operations', async () => {
      const records: VectorRecord[] = [
        { id: '1', vector: [1, 0, 0], metadata: {} },
      ];

      const upsertResult = await store.upsert(records);
      expect(upsertResult.durationMs).toBeGreaterThanOrEqual(0);

      const queryResult = await store.query([1, 0, 0]);
      expect(queryResult.durationMs).toBeGreaterThanOrEqual(0);

      const deleteResult = await store.delete(['1']);
      expect(deleteResult.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should get store statistics', async () => {
      const records: VectorRecord[] = [
        { id: '1', vector: [1, 0, 0], metadata: {} },
        { id: '2', vector: [0, 1, 0], metadata: {} },
      ];

      await store.upsert(records);

      const stats = await store.getStats();

      expect(stats.type).toBe('memory');
      expect(stats.vectorCount).toBe(2);
      expect(stats.lastUpdated).toBeGreaterThan(0);
    });

    it('should check health', async () => {
      const health = await store.checkHealth();

      expect(health.healthy).toBe(true);
      expect(health.lastCheck).toBeGreaterThan(0);
    });

    it('should close cleanly', async () => {
      const records: VectorRecord[] = [
        { id: '1', vector: [1, 0, 0], metadata: {} },
      ];

      await store.upsert(records);
      await store.close();

      const stats = await store.getStats();
      expect(stats.vectorCount).toBe(0);
    });
  });
});
