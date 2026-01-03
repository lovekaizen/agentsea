import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryCacheStore } from '../stores/MemoryCacheStore.js';
import type { CacheEntry } from '../types/index.js';

function createTestEntry(
  key: string,
  content: string,
  embedding?: number[],
): CacheEntry {
  return {
    id: `entry_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    key,
    embedding,
    request: {
      model: 'gpt-4',
      messages: [{ role: 'user', content }],
    },
    response: {
      content: `Response to: ${content}`,
      model: 'gpt-4',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      finishReason: 'stop',
    },
    metadata: {
      createdAt: Date.now(),
      accessedAt: Date.now(),
      accessCount: 0,
      ttl: 3600,
      hitCount: 0,
      namespace: 'default',
    },
  };
}

describe('MemoryCacheStore', () => {
  let store: MemoryCacheStore;

  beforeEach(() => {
    store = new MemoryCacheStore({ type: 'memory', maxEntries: 100 });
  });

  afterEach(async () => {
    await store.close();
  });

  describe('get/set', () => {
    it('should store and retrieve entries', async () => {
      const entry = createTestEntry('key1', 'Hello');

      const result = await store.set('key1', entry);
      expect(result.success).toBe(true);
      expect(result.id).toBe(entry.id);

      const retrieved = await store.get('key1');
      expect(retrieved).not.toBeUndefined();
      expect(retrieved?.response.content).toBe('Response to: Hello');
    });

    it('should return undefined for non-existent keys', async () => {
      const result = await store.get('non-existent');
      expect(result).toBeUndefined();
    });

    it('should update access metadata on get', async () => {
      const entry = createTestEntry('key1', 'Hello');
      await store.set('key1', entry);

      const retrieved1 = await store.get('key1');
      expect(retrieved1?.metadata.accessCount).toBe(1);

      const retrieved2 = await store.get('key1');
      expect(retrieved2?.metadata.accessCount).toBe(2);
    });

    it('should overwrite existing entries', async () => {
      const entry1 = createTestEntry('key1', 'First');
      const entry2 = createTestEntry('key1', 'Second');

      await store.set('key1', entry1);
      await store.set('key1', entry2);

      const retrieved = await store.get('key1');
      expect(retrieved?.response.content).toBe('Response to: Second');
    });
  });

  describe('has', () => {
    it('should return true for existing keys', async () => {
      await store.set('key1', createTestEntry('key1', 'Hello'));
      expect(await store.has('key1')).toBe(true);
    });

    it('should return false for non-existent keys', async () => {
      expect(await store.has('non-existent')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete existing entries', async () => {
      await store.set('key1', createTestEntry('key1', 'Hello'));
      expect(await store.has('key1')).toBe(true);

      const deleted = await store.delete('key1');
      expect(deleted).toBe(true);
      expect(await store.has('key1')).toBe(false);
    });

    it('should return false for non-existent keys', async () => {
      const deleted = await store.delete('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all entries', async () => {
      await store.set('key1', createTestEntry('key1', 'Hello'));
      await store.set('key2', createTestEntry('key2', 'World'));

      expect(await store.size()).toBe(2);

      await store.clear();

      expect(await store.size()).toBe(0);
      expect(await store.has('key1')).toBe(false);
      expect(await store.has('key2')).toBe(false);
    });
  });

  describe('size', () => {
    it('should return correct count', async () => {
      expect(await store.size()).toBe(0);

      await store.set('key1', createTestEntry('key1', 'Hello'));
      expect(await store.size()).toBe(1);

      await store.set('key2', createTestEntry('key2', 'World'));
      expect(await store.size()).toBe(2);

      await store.delete('key1');
      expect(await store.size()).toBe(1);
    });
  });

  describe('keys', () => {
    it('should return all keys', async () => {
      await store.set('key1', createTestEntry('key1', 'Hello'));
      await store.set('key2', createTestEntry('key2', 'World'));

      const keys = await store.keys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys.length).toBe(2);
    });
  });

  describe('query (vector search)', () => {
    it('should find similar vectors', async () => {
      // Create entries with embeddings
      const entry1 = createTestEntry('key1', 'Hello', [1, 0, 0]);
      const entry2 = createTestEntry('key2', 'World', [0.9, 0.1, 0]);
      const entry3 = createTestEntry('key3', 'Different', [0, 0, 1]);

      await store.set('key1', entry1);
      await store.set('key2', entry2);
      await store.set('key3', entry3);

      // Query with vector similar to entry1 and entry2
      const result = await store.query([1, 0, 0], {
        topK: 2,
        minSimilarity: 0.5,
      });

      expect(result.entries.length).toBe(2);
      expect(result.entries[0].key).toBe('key1'); // Exact match
      expect(result.entries[0].score).toBeCloseTo(1.0, 2);
      expect(result.entries[1].key).toBe('key2'); // Similar
    });

    it('should respect minSimilarity threshold', async () => {
      const entry1 = createTestEntry('key1', 'Hello', [1, 0, 0]);
      const entry2 = createTestEntry('key2', 'World', [0, 1, 0]); // Orthogonal

      await store.set('key1', entry1);
      await store.set('key2', entry2);

      const result = await store.query([1, 0, 0], {
        topK: 10,
        minSimilarity: 0.9,
      });

      expect(result.entries.length).toBe(1);
      expect(result.entries[0].key).toBe('key1');
    });

    it('should filter by namespace', async () => {
      const entry1 = createTestEntry('key1', 'Hello', [1, 0, 0]);
      entry1.metadata.namespace = 'namespace1';

      const entry2 = createTestEntry('key2', 'World', [1, 0, 0]);
      entry2.metadata.namespace = 'namespace2';

      await store.set('key1', entry1);
      await store.set('key2', entry2);

      const result = await store.query([1, 0, 0], {
        topK: 10,
        minSimilarity: 0,
        namespace: 'namespace1',
      });

      expect(result.entries.length).toBe(1);
      expect(result.entries[0].key).toBe('key1');
    });

    it('should return empty results when no embeddings', async () => {
      const entry = createTestEntry('key1', 'Hello'); // No embedding

      await store.set('key1', entry);

      const result = await store.query([1, 0, 0], { topK: 10 });
      expect(result.entries.length).toBe(0);
    });
  });

  describe('checkHealth', () => {
    it('should return healthy status', async () => {
      const health = await store.checkHealth();
      expect(health.healthy).toBe(true);
      expect(health.latencyMs).toBe(0);
    });
  });

  describe('getMetrics', () => {
    it('should track metrics correctly', async () => {
      const entry = createTestEntry('key1', 'Hello');

      await store.set('key1', entry);
      await store.get('key1');
      await store.get('key1');
      await store.get('non-existent');
      await store.delete('key1');

      const metrics = store.getMetrics();
      expect(metrics.sets).toBe(1);
      expect(metrics.gets).toBe(3);
      expect(metrics.hits).toBe(2);
      expect(metrics.misses).toBe(1);
      expect(metrics.deletes).toBe(1);
    });

    it('should reset metrics', async () => {
      await store.set('key1', createTestEntry('key1', 'Hello'));
      await store.get('key1');

      store.resetMetrics();

      const metrics = store.getMetrics();
      expect(metrics.sets).toBe(0);
      expect(metrics.gets).toBe(0);
      expect(metrics.hits).toBe(0);
    });
  });

  describe('getMemoryInfo', () => {
    it('should return memory usage info', async () => {
      await store.set('key1', createTestEntry('key1', 'Hello', [1, 2, 3]));
      await store.set('key2', createTestEntry('key2', 'World'));

      const info = store.getMemoryInfo();
      expect(info.entries).toBe(2);
      expect(info.vectorCount).toBe(1); // Only entry with embedding
      expect(info.calculatedSize).toBeGreaterThan(0);
    });
  });
});
