import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryStore, createMemoryStore } from '../stores/MemoryStore.js';
import type { VectorRecord } from '../types/index.js';

// Helper to create a vector record
function createRecord(overrides: Partial<VectorRecord> = {}): VectorRecord {
  return {
    id: `record-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    vector: [0.1, 0.2, 0.3],
    metadata: {},
    ...overrides,
  };
}

describe('MemoryStore', () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore({ type: 'memory' });
  });

  afterEach(async () => {
    await store.close();
  });

  describe('constructor', () => {
    it('should create store with default config', () => {
      const defaultStore = new MemoryStore();
      expect(defaultStore).toBeInstanceOf(MemoryStore);
      expect(defaultStore.storeType).toBe('memory');
    });

    it('should create store with custom max vectors', () => {
      const customStore = new MemoryStore({ type: 'memory', maxVectors: 100 });
      expect(customStore).toBeInstanceOf(MemoryStore);
    });
  });

  describe('upsert', () => {
    it('should insert new records', async () => {
      const records = [
        createRecord({ id: 'rec-1' }),
        createRecord({ id: 'rec-2' }),
      ];

      const result = await store.upsert(records);

      expect(result.upsertedCount).toBe(2);
      expect(result.upsertedIds).toEqual(['rec-1', 'rec-2']);
      expect(result.errors).toHaveLength(0);
    });

    it('should update existing records', async () => {
      const record = createRecord({ id: 'rec-1', metadata: { version: 1 } });
      await store.upsert([record]);

      const updated = { ...record, metadata: { version: 2 } };
      const result = await store.upsert([updated]);

      expect(result.upsertedCount).toBe(1);

      const retrieved = store.getById('rec-1');
      expect(retrieved?.metadata.version).toBe(2);
    });

    it('should track duration', async () => {
      const result = await store.upsert([createRecord()]);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should use namespace', async () => {
      await store.upsert([createRecord({ id: 'rec-1' })], { namespace: 'ns1' });
      await store.upsert([createRecord({ id: 'rec-2' })], { namespace: 'ns2' });

      const stats = await store.getStats();
      expect(stats.namespaceCount).toBe(2);
    });

    it('should evict oldest when max vectors reached', async () => {
      const smallStore = new MemoryStore({ type: 'memory', maxVectors: 2 });

      await smallStore.upsert([createRecord({ id: 'rec-1' })]);
      await smallStore.upsert([createRecord({ id: 'rec-2' })]);
      await smallStore.upsert([createRecord({ id: 'rec-3' })]);

      const stats = await smallStore.getStats();
      expect(stats.vectorCount).toBe(2);

      // First record should be evicted
      expect(smallStore.getById('rec-1')).toBeUndefined();
      expect(smallStore.getById('rec-3')).toBeDefined();
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      await store.upsert([
        createRecord({
          id: 'rec-1',
          vector: [1, 0, 0],
          metadata: { category: 'A' },
        }),
        createRecord({
          id: 'rec-2',
          vector: [0, 1, 0],
          metadata: { category: 'B' },
        }),
        createRecord({
          id: 'rec-3',
          vector: [0, 0, 1],
          metadata: { category: 'A' },
        }),
      ]);
    });

    it('should find similar vectors', async () => {
      const result = await store.query([1, 0, 0], { topK: 10 });

      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.matches[0].id).toBe('rec-1');
      expect(result.matches[0].score).toBeCloseTo(1, 5);
    });

    it('should limit results by topK', async () => {
      const result = await store.query([1, 0, 0], { topK: 1 });
      expect(result.matches).toHaveLength(1);
    });

    it('should filter by minimum score', async () => {
      const result = await store.query([1, 0, 0], { topK: 10, minScore: 0.9 });
      expect(result.matches).toHaveLength(1);
    });

    it('should return empty for non-existent namespace', async () => {
      const result = await store.query([1, 0, 0], {
        topK: 10,
        namespace: 'non-existent',
      });
      expect(result.matches).toHaveLength(0);
    });

    it('should track duration', async () => {
      const result = await store.query([1, 0, 0], { topK: 10 });
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should sort by score descending', async () => {
      const result = await store.query([0.5, 0.5, 0], { topK: 10 });

      for (let i = 1; i < result.matches.length; i++) {
        expect(result.matches[i - 1].score).toBeGreaterThanOrEqual(
          result.matches[i].score,
        );
      }
    });
  });

  describe('delete', () => {
    beforeEach(async () => {
      await store.upsert([
        createRecord({ id: 'rec-1' }),
        createRecord({ id: 'rec-2' }),
        createRecord({ id: 'rec-3' }),
      ]);
    });

    it('should delete specified records', async () => {
      const result = await store.delete(['rec-1', 'rec-2']);

      expect(result.deletedCount).toBe(2);
      expect(store.getById('rec-1')).toBeUndefined();
      expect(store.getById('rec-2')).toBeUndefined();
      expect(store.getById('rec-3')).toBeDefined();
    });

    it('should return 0 for non-existent IDs', async () => {
      const result = await store.delete(['non-existent']);
      expect(result.deletedCount).toBe(0);
    });

    it('should track duration', async () => {
      const result = await store.delete(['rec-1']);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('deleteAll', () => {
    beforeEach(async () => {
      await store.upsert([createRecord({ id: 'rec-1' })], { namespace: 'ns1' });
      await store.upsert([createRecord({ id: 'rec-2' })], { namespace: 'ns1' });
      await store.upsert([createRecord({ id: 'rec-3' })], { namespace: 'ns2' });
    });

    it('should delete all records when deleteAll is true', async () => {
      const result = await store.deleteAll({ deleteAll: true });

      expect(result.deletedCount).toBe(3);
      expect((await store.getStats()).vectorCount).toBe(0);
    });

    it('should delete records in specific namespace', async () => {
      const result = await store.deleteAll({ namespace: 'ns1' });

      expect(result.deletedCount).toBe(2);
      expect((await store.getStats()).vectorCount).toBe(1);
    });

    it('should return 0 for non-existent namespace', async () => {
      const result = await store.deleteAll({ namespace: 'non-existent' });
      expect(result.deletedCount).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return store statistics', async () => {
      await store.upsert([
        createRecord({ id: 'rec-1' }),
        createRecord({ id: 'rec-2' }),
      ]);

      const stats = await store.getStats();

      expect(stats.type).toBe('memory');
      expect(stats.vectorCount).toBe(2);
      expect(stats.namespaceCount).toBeGreaterThanOrEqual(1);
      expect(stats.lastUpdated).toBeGreaterThan(0);
    });
  });

  describe('checkHealth', () => {
    it('should return healthy status', async () => {
      const health = await store.checkHealth();

      expect(health.healthy).toBe(true);
      expect(health.lastCheck).toBeGreaterThan(0);
    });
  });

  describe('getAll', () => {
    it('should return all vectors', async () => {
      await store.upsert([
        createRecord({ id: 'rec-1' }),
        createRecord({ id: 'rec-2' }),
      ]);

      const all = store.getAll();
      expect(all).toHaveLength(2);
    });
  });

  describe('getById', () => {
    it('should return record by ID', async () => {
      await store.upsert([
        createRecord({ id: 'rec-1', metadata: { test: true } }),
      ]);

      const record = store.getById('rec-1');
      expect(record).toBeDefined();
      expect(record?.metadata.test).toBe(true);
    });

    it('should return undefined for non-existent ID', () => {
      const record = store.getById('non-existent');
      expect(record).toBeUndefined();
    });
  });

  describe('close', () => {
    it('should close without error', async () => {
      await expect(store.close()).resolves.toBeUndefined();
    });
  });

  describe('createMemoryStore factory', () => {
    it('should create a store instance', () => {
      const factoryStore = createMemoryStore();
      expect(factoryStore).toBeInstanceOf(MemoryStore);
    });

    it('should accept config', () => {
      const factoryStore = createMemoryStore({
        type: 'memory',
        maxVectors: 50,
      });
      expect(factoryStore).toBeInstanceOf(MemoryStore);
    });
  });
});
