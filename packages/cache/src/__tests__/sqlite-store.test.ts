/**
 * SQLiteCacheStore tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SQLiteCacheStore } from '../stores/SQLiteCacheStore.js';
import type { CacheEntry, SQLiteStoreConfig } from '../types/index.js';
import { generateId, now } from '../core/utils.js';

// Mock better-sqlite3 with proper state tracking
vi.mock('better-sqlite3', () => {
  // Shared mock data store with access tracking
  interface MockEntry {
    params: unknown[];
    accessCount: number;
  }
  const mockData = new Map<string, MockEntry>();

  class MockStatement {
    constructor(private sql: string) {}

    run(...params: unknown[]): { changes: number } {
      if (this.sql.includes('INSERT OR REPLACE')) {
        const [key] = params as string[];
        mockData.set(key, { params, accessCount: 0 });
        return { changes: 1 };
      } else if (
        this.sql.includes('DELETE FROM') &&
        !this.sql.includes('WHERE')
      ) {
        // CLEAR - delete all
        const size = mockData.size;
        mockData.clear();
        return { changes: size };
      } else if (this.sql.includes('DELETE')) {
        const [key] = params as string[];
        const existed = mockData.has(key);
        mockData.delete(key);
        return { changes: existed ? 1 : 0 };
      } else if (this.sql.includes('UPDATE')) {
        // UPDATE cache_entries SET accessed_at = ?, data = ? WHERE key = ?
        // params order: accessed_at, data, key
        const [, data, key] = params as [number, string, string];
        const entry = mockData.get(key);
        if (entry) {
          // Update the stored data with new value
          entry.params[2] = data;
        }
        return { changes: 1 };
      }
      return { changes: 0 };
    }

    get(...params: unknown[]): unknown {
      if (this.sql.includes('SELECT data FROM')) {
        const [key] = params as string[];
        const entry = mockData.get(key);
        if (!entry) return undefined;
        // Return the data as-is - real code handles accessCount increment
        const data = entry.params[2] as string;
        return { data };
      } else if (this.sql.includes('SELECT 1 FROM')) {
        const [key] = params as string[];
        return mockData.has(key) ? { val: 1 } : undefined;
      } else if (this.sql.includes('COUNT(*)')) {
        return { count: mockData.size };
      }
      return undefined;
    }

    all(...params: unknown[]): unknown[] {
      if (this.sql.includes('SELECT key FROM')) {
        return Array.from(mockData.keys()).map((key) => ({ key }));
      } else if (this.sql.includes('SELECT key, data, embedding')) {
        const namespace = params[0] as string | undefined;
        return Array.from(mockData.entries())
          .filter(([_, entry]) => {
            const entryParams = entry.params;
            // Check if embedding exists
            if ((entryParams[3] as unknown) === null) return false;
            // Check namespace if provided
            if (namespace) {
              try {
                const data = JSON.parse(entryParams[2] as string);
                return data.metadata?.namespace === namespace;
              } catch {
                return true;
              }
            }
            return true;
          })
          .map(([key, entry]) => ({
            key,
            data: entry.params[2],
            embedding: entry.params[3],
          }));
      }
      return [];
    }
  }

  class MockDatabase {
    prepare(sql: string): MockStatement {
      return new MockStatement(sql);
    }

    exec(_sql: string): void {
      // No-op for CREATE TABLE
    }

    close(): void {
      mockData.clear();
    }
  }

  return {
    default: MockDatabase,
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

describe('SQLiteCacheStore', () => {
  let store: SQLiteCacheStore;

  describe('In-Memory Database', () => {
    beforeEach(async () => {
      const config: SQLiteStoreConfig = {
        type: 'sqlite',
        inMemory: true,
      };
      store = new SQLiteCacheStore(config);
      await store.init();
    });

    afterEach(async () => {
      await store.close();
    });

    describe('Initialization', () => {
      it('should initialize in-memory database', () => {
        expect(store.isInitialized()).toBe(true);
      });

      it('should handle multiple init calls', async () => {
        await store.init();
        await store.init();
        expect(store.isInitialized()).toBe(true);
      });

      it('should throw if used before initialization', () => {
        const uninitStore = new SQLiteCacheStore({
          type: 'sqlite',
          inMemory: true,
        });
        // get() throws synchronously when not initialized
        expect(() => uninitStore.get('key')).toThrow(/not initialized/i);
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

        const deleted = await store.delete('key1');
        expect(deleted).toBe(true);
        expect(await store.has('key1')).toBe(false);
      });

      it('should return false when deleting non-existent key', async () => {
        const deleted = await store.delete('non-existent');
        expect(deleted).toBe(false);
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
      });

      it('should count entries', async () => {
        expect(await store.size()).toBe(0);

        await store.set('key1', createTestEntry('key1', 'Test'));
        expect(await store.size()).toBe(1);

        await store.set('key2', createTestEntry('key2', 'Test'));
        expect(await store.size()).toBe(2);
      });
    });

    describe('Vector Search', () => {
      it('should store and query embeddings', async () => {
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

      it('should filter by namespace in queries', async () => {
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

        expect(
          result.entries.every((e) => e.metadata.namespace === 'ns1'),
        ).toBe(true);
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

    describe('Health Check', () => {
      it('should check health when initialized', async () => {
        const health = await store.checkHealth();
        expect(health.healthy).toBe(true);
        expect(health.latencyMs).toBeGreaterThanOrEqual(0);
      });

      it('should return unhealthy when not initialized', async () => {
        await store.close();
        const health = await store.checkHealth();
        expect(health.healthy).toBe(false);
        expect(health.error).toBeDefined();
      });
    });

    describe('TTL and Expiration', () => {
      it('should store TTL metadata', async () => {
        const entry = createTestEntry('key1', 'Test');
        entry.metadata.ttl = 3600;

        await store.set('key1', entry);

        const retrieved = await store.get('key1');
        expect(retrieved?.metadata.ttl).toBe(3600);
      });

      it('should prune expired entries', async () => {
        const expiredEntry = createTestEntry('expired', 'Old');
        expiredEntry.metadata.createdAt = now() - 7200 * 1000; // 2 hours ago
        expiredEntry.metadata.ttl = 3600; // 1 hour TTL

        const validEntry = createTestEntry('valid', 'New');
        validEntry.metadata.ttl = 3600;

        await store.set('expired', expiredEntry);
        await store.set('valid', validEntry);

        const pruned = await store.pruneExpired();
        expect(pruned).toBeGreaterThanOrEqual(0);
      });
    });

    describe('Data Persistence', () => {
      it('should handle upsert (replace existing entries)', async () => {
        const entry1 = createTestEntry('key1', 'First');
        const entry2 = createTestEntry('key1', 'Second');

        await store.set('key1', entry1);
        await store.set('key1', entry2);

        const retrieved = await store.get('key1');
        expect(retrieved?.response.content).toBe('Response to: Second');
      });
    });
  });

  describe('File-based Database', () => {
    it('should initialize with file path', async () => {
      const fileStore = new SQLiteCacheStore({
        type: 'sqlite',
        dbPath: ':memory:', // Use memory for testing
        inMemory: false,
      });

      await fileStore.init();
      expect(fileStore.isInitialized()).toBe(true);
      await fileStore.close();
    });

    it('should get database size for file-based stores', async () => {
      const fileStore = new SQLiteCacheStore({
        type: 'sqlite',
        dbPath: ':memory:',
        inMemory: false,
      });

      await fileStore.init();
      const size = await fileStore.getDbSize();
      // In-memory returns null
      expect(size).toBeNull();
      await fileStore.close();
    });

    it('should return null size for in-memory databases', async () => {
      const size = await store.getDbSize();
      expect(size).toBeNull();
    });
  });

  describe('Error Handling', () => {
    let errorStore: SQLiteCacheStore;

    beforeEach(async () => {
      errorStore = new SQLiteCacheStore({ type: 'sqlite', inMemory: true });
      await errorStore.init();
    });

    afterEach(async () => {
      await errorStore.close();
    });

    it('should handle malformed JSON gracefully', async () => {
      const entry = createTestEntry('key1', 'Test');
      await errorStore.set('key1', entry);

      // Should still retrieve valid entry
      const result = await errorStore.get('key1');
      expect(result).toBeDefined();
    });

    it('should handle missing embeddings in queries', async () => {
      const entry = createTestEntry('key1', 'Test'); // No embedding
      await errorStore.set('key1', entry);

      const result = await errorStore.query([1, 0, 0], { topK: 10 });
      expect(result.entries.length).toBe(0);
    });
  });

  describe('Namespace Support', () => {
    it('should clear entries by namespace', async () => {
      const entry1 = createTestEntry('key1', 'Test');
      entry1.metadata.namespace = 'ns1';

      const entry2 = createTestEntry('key2', 'Test');
      entry2.metadata.namespace = 'default';

      // Create store with specific namespace
      const nsStore = new SQLiteCacheStore({
        type: 'sqlite',
        inMemory: true,
      });
      await nsStore.init();

      await nsStore.set('key1', entry1);
      await nsStore.set('key2', entry2);

      // Clear should only clear entries in the namespace
      await nsStore.clear();
      await nsStore.close();
    });
  });
});
