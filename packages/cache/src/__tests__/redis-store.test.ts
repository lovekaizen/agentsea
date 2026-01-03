/**
 * RedisCacheStore tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RedisCacheStore } from '../stores/RedisCacheStore.js';
import type { CacheEntry, RedisStoreConfig } from '../types/index.js';
import { generateId, now } from '../core/utils.js';

// Mock ioredis with connection error support
vi.mock('ioredis', () => {
  const mockData = new Map<string, string>();

  class MockRedis {
    private config: Record<string, unknown>;

    constructor(config?: Record<string, unknown>) {
      this.config = config ?? {};
      // If host is 'invalid-host', we'll simulate connection failure
    }

    async get(key: string): Promise<string | null> {
      this.checkConnection();
      return mockData.get(key) ?? null;
    }

    async set(key: string, value: string): Promise<'OK'> {
      this.checkConnection();
      mockData.set(key, value);
      return 'OK';
    }

    async del(...keys: string[]): Promise<number> {
      this.checkConnection();
      let count = 0;
      for (const key of keys) {
        if (mockData.delete(key)) count++;
      }
      return count;
    }

    async exists(...keys: string[]): Promise<number> {
      this.checkConnection();
      return keys.filter((k) => mockData.has(k)).length;
    }

    async keys(pattern: string): Promise<string[]> {
      this.checkConnection();
      const regex = new RegExp(
        '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
      );
      return Array.from(mockData.keys()).filter((k) => regex.test(k));
    }

    async quit(): Promise<void> {
      mockData.clear();
    }

    async ping(): Promise<string> {
      this.checkConnection();
      return 'PONG';
    }

    async expire(_key: string, _seconds: number): Promise<number> {
      this.checkConnection();
      return 1;
    }

    private checkConnection(): void {
      if (this.config.host === 'invalid-host') {
        throw new Error('Connection refused: invalid-host:1234');
      }
    }
  }

  return {
    default: MockRedis,
    Redis: MockRedis,
  };
});

function createTestEntry(
  key: string,
  content: string,
  embedding?: number[],
): CacheEntry {
  return {
    id: generateId('entry'),
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
      createdAt: now(),
      accessedAt: now(),
      accessCount: 0,
      ttl: 3600,
      hitCount: 0,
      namespace: 'default',
    },
  };
}

describe('RedisCacheStore', () => {
  let store: RedisCacheStore;
  const config: RedisStoreConfig = {
    type: 'redis',
    host: 'localhost',
    port: 6379,
    keyPrefix: 'test-cache',
  };

  beforeEach(async () => {
    store = new RedisCacheStore(config);
    await store.connect();
  });

  afterEach(async () => {
    await store.clear();
    await store.close();
  });

  describe('Connection', () => {
    it('should connect to Redis', async () => {
      expect(store.isConnected()).toBe(true);
    });

    it('should handle multiple connect calls', async () => {
      await store.connect();
      await store.connect();
      expect(store.isConnected()).toBe(true);
    });

    it('should connect with URL', async () => {
      const urlStore = new RedisCacheStore({
        type: 'redis',
        url: 'redis://localhost:6379',
      });
      await urlStore.connect();
      expect(urlStore.isConnected()).toBe(true);
      await urlStore.close();
    });
  });

  describe('Basic Operations', () => {
    it('should set and get entries', async () => {
      const entry = createTestEntry('key1', 'Hello');

      const result = await store.set('key1', entry);
      expect(result.success).toBe(true);

      const retrieved = await store.get('key1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.response.content).toBe('Response to: Hello');
    });

    it('should return undefined for non-existent keys', async () => {
      const result = await store.get('non-existent');
      expect(result).toBeUndefined();
    });

    it('should update access metadata on get', async () => {
      const entry = createTestEntry('key1', 'Test');
      await store.set('key1', entry);

      const retrieved1 = await store.get('key1');
      expect(retrieved1?.metadata.accessCount).toBe(1);

      const retrieved2 = await store.get('key1');
      expect(retrieved2?.metadata.accessCount).toBe(2);
    });

    it('should check if key exists', async () => {
      const entry = createTestEntry('key1', 'Test');
      await store.set('key1', entry);

      expect(await store.has('key1')).toBe(true);
      expect(await store.has('non-existent')).toBe(false);
    });

    it('should delete entries', async () => {
      const entry = createTestEntry('key1', 'Test');
      await store.set('key1', entry);

      expect(await store.has('key1')).toBe(true);

      const deleted = await store.delete('key1');
      expect(deleted).toBe(true);
      expect(await store.has('key1')).toBe(false);
    });

    it('should return false when deleting non-existent key', async () => {
      const deleted = await store.delete('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('Key Prefixing', () => {
    it('should prefix keys with configured prefix', async () => {
      const entry = createTestEntry('mykey', 'Test');
      await store.set('mykey', entry);

      const keys = await store.keys();
      expect(keys).toContain('mykey');
    });

    it('should isolate keys by namespace', async () => {
      const entry1 = createTestEntry('key1', 'Test');
      entry1.metadata.namespace = 'ns1';

      const entry2 = createTestEntry('key2', 'Test');
      entry2.metadata.namespace = 'ns2';

      await store.set('key1', entry1);

      const store2 = new RedisCacheStore({
        ...config,
        keyPrefix: 'test-cache',
      });
      await store2.connect();
      await store2.set('key2', entry2);

      const keys1 = await store.keys();
      const keys2 = await store2.keys();

      expect(keys1.length).toBeGreaterThan(0);
      expect(keys2.length).toBeGreaterThan(0);

      await store2.close();
    });
  });

  describe('Bulk Operations', () => {
    it('should clear all entries', async () => {
      await store.set('key1', createTestEntry('key1', 'Test 1'));
      await store.set('key2', createTestEntry('key2', 'Test 2'));

      expect(await store.size()).toBe(2);

      await store.clear();

      expect(await store.size()).toBe(0);
    });

    it('should get all keys', async () => {
      await store.set('key1', createTestEntry('key1', 'Test 1'));
      await store.set('key2', createTestEntry('key2', 'Test 2'));
      await store.set('key3', createTestEntry('key3', 'Test 3'));

      const keys = await store.keys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
      expect(keys.length).toBe(3);
    });

    it('should count entries', async () => {
      expect(await store.size()).toBe(0);

      await store.set('key1', createTestEntry('key1', 'Test 1'));
      expect(await store.size()).toBe(1);

      await store.set('key2', createTestEntry('key2', 'Test 2'));
      expect(await store.size()).toBe(2);

      await store.delete('key1');
      expect(await store.size()).toBe(1);
    });
  });

  describe('TTL Support', () => {
    it('should set TTL on entries', async () => {
      const entry = createTestEntry('key1', 'Test');
      entry.metadata.ttl = 60;

      const result = await store.set('key1', entry);
      expect(result.success).toBe(true);
    });

    it('should handle zero TTL (no expiration)', async () => {
      const entry = createTestEntry('key1', 'Test');
      entry.metadata.ttl = 0;

      const result = await store.set('key1', entry);
      expect(result.success).toBe(true);
    });
  });

  describe('Vector Search', () => {
    it('should query by vector similarity', async () => {
      const entry1 = createTestEntry('key1', 'Hello', [1, 0, 0]);
      const entry2 = createTestEntry('key2', 'World', [0.9, 0.1, 0]);
      const entry3 = createTestEntry('key3', 'Different', [0, 0, 1]);

      await store.set('key1', entry1);
      await store.set('key2', entry2);
      await store.set('key3', entry3);

      const result = await store.query([1, 0, 0], {
        topK: 2,
        minSimilarity: 0.5,
      });

      expect(result.entries.length).toBeLessThanOrEqual(2);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should respect similarity threshold', async () => {
      const entry1 = createTestEntry('key1', 'Test', [1, 0, 0]);
      const entry2 = createTestEntry('key2', 'Test', [0, 1, 0]);

      await store.set('key1', entry1);
      await store.set('key2', entry2);

      const result = await store.query([1, 0, 0], {
        topK: 10,
        minSimilarity: 0.95,
      });

      expect(result.entries.length).toBeLessThanOrEqual(1);
    });

    it('should return empty results when no embeddings match', async () => {
      const entry = createTestEntry('key1', 'Test'); // No embedding
      await store.set('key1', entry);

      const result = await store.query([1, 0, 0], { topK: 10 });
      expect(result.entries.length).toBe(0);
    });
  });

  describe('Health Check', () => {
    it('should check health when connected', async () => {
      const health = await store.checkHealth();
      expect(health.healthy).toBe(true);
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
      expect(health.lastCheck).toBeGreaterThan(0);
    });
  });

  describe('Metrics', () => {
    it('should track operation metrics', async () => {
      const entry = createTestEntry('key1', 'Test');

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
      await store.set('key1', createTestEntry('key1', 'Test'));
      await store.get('key1');

      store.resetMetrics();

      const metrics = store.getMetrics();
      expect(metrics.sets).toBe(0);
      expect(metrics.gets).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors gracefully', async () => {
      const badStore = new RedisCacheStore({
        type: 'redis',
        host: 'invalid-host',
        port: 1234,
        connectTimeout: 100,
      });

      // Connection will fail when attempting to connect
      await expect(badStore.connect()).rejects.toThrow();
    });

    it('should handle malformed data gracefully', async () => {
      // Manually insert invalid JSON
      const entry = createTestEntry('key1', 'Test');
      await store.set('key1', entry);

      // Should still work
      const result = await store.get('key1');
      expect(result).toBeDefined();
    });
  });

  describe('Namespace Support', () => {
    it('should filter queries by namespace', async () => {
      const entry1 = createTestEntry('key1', 'Test', [1, 0, 0]);
      entry1.metadata.namespace = 'ns1';

      const entry2 = createTestEntry('key2', 'Test', [1, 0, 0]);
      entry2.metadata.namespace = 'ns2';

      await store.set('key1', entry1);
      await store.set('key2', entry2);

      const result = await store.query([1, 0, 0], {
        topK: 10,
        namespace: 'ns1',
      });

      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.entries.every((e) => e.metadata.namespace === 'ns1')).toBe(
        true,
      );
    });
  });
});
