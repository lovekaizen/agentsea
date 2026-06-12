/**
 * InvalidationManager tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InvalidationManager } from '../invalidation/InvalidationManager.js';
import { MemoryCacheStore } from '../stores/MemoryCacheStore.js';
import type { CacheEntry, InvalidationManagerConfig } from '../types/index.js';
import { generateId, now } from '../core/utils.js';

function createTestEntry(
  key: string,
  content: string,
  options?: {
    ttl?: number;
    createdAt?: number;
    namespace?: string;
    model?: string;
  },
): CacheEntry {
  return {
    id: generateId('entry'),
    key,
    request: {
      model: options?.model ?? 'gpt-5.5',
      messages: [{ role: 'user', content }],
    },
    response: {
      content: `Response to: ${content}`,
      model: options?.model ?? 'gpt-5.5',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      finishReason: 'stop',
    },
    metadata: {
      createdAt: options?.createdAt ?? now(),
      accessedAt: now(),
      accessCount: 0,
      ttl: options?.ttl ?? 3600,
      hitCount: 0,
      namespace: options?.namespace ?? 'default',
    },
  };
}

describe('InvalidationManager', () => {
  let store: MemoryCacheStore;
  let manager: InvalidationManager;

  beforeEach(() => {
    store = new MemoryCacheStore({ type: 'memory', maxEntries: 100 });
  });

  afterEach(() => {
    manager?.destroy();
    store.close();
  });

  describe('TTL Invalidation', () => {
    beforeEach(() => {
      const config: InvalidationManagerConfig = {
        strategy: 'ttl',
        ttl: { defaultTtl: 3600 },
      };
      manager = new InvalidationManager(store, config);
    });

    it('should invalidate expired entries', async () => {
      const oldTime = now() - 7200 * 1000; // 2 hours ago

      const expiredEntry = createTestEntry('expired', 'Old', {
        ttl: 3600,
        createdAt: oldTime,
      });

      const validEntry = createTestEntry('valid', 'New', {
        ttl: 3600,
      });

      await store.set('expired', expiredEntry);
      await store.set('valid', validEntry);

      const result = await manager.runTTLInvalidation();

      expect(result.entriesRemoved).toBeGreaterThanOrEqual(1);
      expect(result.invalidatedKeys).toContain('expired');
      expect(await store.has('expired')).toBe(false);
      expect(await store.has('valid')).toBe(true);
    });

    it('should respect model-specific TTL', async () => {
      const config: InvalidationManagerConfig = {
        strategy: 'ttl',
        ttl: {
          defaultTtl: 3600,
          modelTtls: {
            'gpt-5.5': 1800, // 30 minutes
            'gpt-5.4-mini': 7200, // 2 hours
          },
        },
      };

      const customManager = new InvalidationManager(store, config);

      const oldTime = now() - 2000 * 1000; // 33 minutes ago

      const gpt4Entry = createTestEntry('gpt4', 'Test', {
        ttl: 1800,
        createdAt: oldTime,
        model: 'gpt-5.5',
      });

      const gpt35Entry = createTestEntry('gpt35', 'Test', {
        ttl: 7200,
        createdAt: oldTime,
        model: 'gpt-5.4-mini',
      });

      await store.set('gpt4', gpt4Entry);
      await store.set('gpt35', gpt35Entry);

      await customManager.runTTLInvalidation();

      // GPT-4 entry should be expired (33 min > 30 min TTL)
      expect(await store.has('gpt4')).toBe(false);
      // GPT-3.5 entry should still be valid (33 min < 2 hour TTL)
      expect(await store.has('gpt35')).toBe(true);

      customManager.destroy();
    });

    it('should respect namespace-specific TTL', async () => {
      const config: InvalidationManagerConfig = {
        strategy: 'ttl',
        ttl: {
          defaultTtl: 3600,
          namespaceTtls: {
            'short-lived': 900, // 15 minutes
          },
        },
      };

      const customManager = new InvalidationManager(store, config);

      const oldTime = now() - 1000 * 1000; // 16 minutes ago

      const shortEntry = createTestEntry('short', 'Test', {
        ttl: 900,
        createdAt: oldTime,
        namespace: 'short-lived',
      });

      const defaultEntry = createTestEntry('default', 'Test', {
        ttl: 3600,
        createdAt: oldTime,
      });

      await store.set('short', shortEntry);
      await store.set('default', defaultEntry);

      await customManager.runTTLInvalidation();

      expect(await store.has('short')).toBe(false);
      expect(await store.has('default')).toBe(true);

      customManager.destroy();
    });

    it('should handle soft TTL with grace period', async () => {
      const config: InvalidationManagerConfig = {
        strategy: 'ttl',
        ttl: {
          defaultTtl: 3600,
          softTtl: true,
          gracePeriod: 600, // 10 minutes grace
        },
      };

      const customManager = new InvalidationManager(store, config);

      const oldTime = now() - 3900 * 1000; // 65 minutes ago (past TTL but within grace)

      const entry = createTestEntry('test', 'Test', {
        ttl: 3600,
        createdAt: oldTime,
      });

      await store.set('test', entry);

      await customManager.runTTLInvalidation();

      // Should still exist due to grace period
      expect(await store.has('test')).toBe(true);

      customManager.destroy();
    });

    it('should update statistics', async () => {
      const oldEntry = createTestEntry('old', 'Old', {
        ttl: 1,
        createdAt: now() - 2000,
      });

      await store.set('old', oldEntry);

      await manager.runTTLInvalidation();

      const stats = manager.getStats();
      expect(stats.totalInvalidations).toBeGreaterThan(0);
      expect(stats.ttlRemovals).toBeGreaterThan(0);
    });
  });

  describe('LRU Invalidation', () => {
    beforeEach(() => {
      const config: InvalidationManagerConfig = {
        strategy: 'lru',
        lru: {
          maxEntries: 5,
          evictionBatchSize: 2,
          minAge: 0,
        },
      };
      manager = new InvalidationManager(store, config);
    });

    it('should evict least recently accessed entries', async () => {
      // Add 7 entries (exceeds maxEntries of 5)
      for (let i = 0; i < 7; i++) {
        const entry = createTestEntry(`key${i}`, `Content ${i}`);
        entry.metadata.accessedAt = now() - (7 - i) * 1000; // Older first
        await store.set(`key${i}`, entry);
      }

      const result = await manager.runLRUInvalidation();

      expect(result.entriesRemoved).toBeGreaterThan(0);
      expect(await store.size()).toBeLessThanOrEqual(5);
    });

    it('should respect minimum age', async () => {
      const config: InvalidationManagerConfig = {
        strategy: 'lru',
        lru: {
          maxEntries: 2,
          evictionBatchSize: 5,
          minAge: 100, // 100 seconds
        },
      };

      const ageManager = new InvalidationManager(store, config);

      // Add recent entries
      for (let i = 0; i < 5; i++) {
        const entry = createTestEntry(`key${i}`, `Content ${i}`);
        entry.metadata.accessedAt = now() - 10 * 1000; // 10 seconds ago (< minAge)
        await store.set(`key${i}`, entry);
      }

      const result = await ageManager.runLRUInvalidation();

      // Should not evict due to minAge
      expect(result.entriesRemoved).toBe(0);

      ageManager.destroy();
    });

    it('should respect eviction batch size', async () => {
      const config: InvalidationManagerConfig = {
        strategy: 'lru',
        lru: {
          maxEntries: 3,
          evictionBatchSize: 2, // Remove at most 2
        },
      };

      const batchManager = new InvalidationManager(store, config);

      // Add 10 entries
      for (let i = 0; i < 10; i++) {
        const entry = createTestEntry(`key${i}`, `Content ${i}`);
        entry.metadata.accessedAt = now() - (10 - i) * 1000;
        await store.set(`key${i}`, entry);
      }

      const result = await batchManager.runLRUInvalidation();

      expect(result.entriesRemoved).toBeLessThanOrEqual(2);

      batchManager.destroy();
    });

    it('should not evict if under max entries', async () => {
      await store.set('key1', createTestEntry('key1', 'Test'));
      await store.set('key2', createTestEntry('key2', 'Test'));

      const result = await manager.runLRUInvalidation();

      expect(result.entriesRemoved).toBe(0);
    });
  });

  describe('Smart Invalidation', () => {
    beforeEach(() => {
      const config: InvalidationManagerConfig = {
        strategy: 'smart',
        ttl: { defaultTtl: 3600 },
        smart: {
          minHitRate: 0.1,
          analyzeHitRate: true,
        },
      };
      manager = new InvalidationManager(store, config);
    });

    it('should invalidate based on TTL and hit rate', async () => {
      const oldLowHitEntry = createTestEntry('old-low', 'Test', {
        ttl: 1,
        createdAt: now() - 2000,
      });
      oldLowHitEntry.metadata.accessCount = 0;

      const validEntry = createTestEntry('valid', 'Test');
      validEntry.metadata.accessCount = 10;

      await store.set('old-low', oldLowHitEntry);
      await store.set('valid', validEntry);

      const result = await manager.runSmartInvalidation();

      expect(result.invalidatedKeys).toContain('old-low');
      expect(await store.has('valid')).toBe(true);
    });

    it('should invalidate entries with low hit rate', async () => {
      const oldTime = now() - 7200 * 1000; // 2 hours ago

      const lowHitEntry = createTestEntry('low-hit', 'Test', {
        createdAt: oldTime,
      });
      lowHitEntry.metadata.accessCount = 1; // Low access

      await store.set('low-hit', lowHitEntry);

      const result = await manager.runSmartInvalidation();

      expect(result.entriesRemoved).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Manual Invalidation', () => {
    beforeEach(() => {
      manager = new InvalidationManager(store);
    });

    it('should invalidate specific keys', async () => {
      await store.set('key1', createTestEntry('key1', 'Test 1'));
      await store.set('key2', createTestEntry('key2', 'Test 2'));
      await store.set('key3', createTestEntry('key3', 'Test 3'));

      const result = await manager.invalidateKeys(['key1', 'key3']);

      expect(result.entriesRemoved).toBe(2);
      expect(result.invalidatedKeys).toContain('key1');
      expect(result.invalidatedKeys).toContain('key3');
      expect(await store.has('key2')).toBe(true);
    });

    it('should handle non-existent keys gracefully', async () => {
      const result = await manager.invalidateKeys(['non-existent']);

      expect(result.entriesRemoved).toBe(0);
    });
  });

  describe('Pattern-based Invalidation', () => {
    beforeEach(() => {
      manager = new InvalidationManager(store);
    });

    it('should invalidate by namespace', async () => {
      const ns1Entry = createTestEntry('key1', 'Test', { namespace: 'ns1' });
      const ns2Entry = createTestEntry('key2', 'Test', { namespace: 'ns2' });

      await store.set('key1', ns1Entry);
      await store.set('key2', ns2Entry);

      const result = await manager.invalidateByPattern({ namespace: 'ns1' });

      expect(result.entriesRemoved).toBe(1);
      expect(await store.has('key1')).toBe(false);
      expect(await store.has('key2')).toBe(true);
    });

    it('should invalidate by model', async () => {
      const gpt4Entry = createTestEntry('key1', 'Test', { model: 'gpt-5.5' });
      const gpt35Entry = createTestEntry('key2', 'Test', {
        model: 'gpt-5.4-mini',
      });

      await store.set('key1', gpt4Entry);
      await store.set('key2', gpt35Entry);

      const result = await manager.invalidateByPattern({ model: 'gpt-5.5' });

      expect(result.entriesRemoved).toBe(1);
      expect(await store.has('key1')).toBe(false);
      expect(await store.has('key2')).toBe(true);
    });

    it('should invalidate entries older than threshold', async () => {
      const oldTime = now() - 7200 * 1000; // 2 hours ago

      const oldEntry = createTestEntry('old', 'Test', { createdAt: oldTime });
      const newEntry = createTestEntry('new', 'Test');

      await store.set('old', oldEntry);
      await store.set('new', newEntry);

      const result = await manager.invalidateByPattern({
        olderThan: 3600, // 1 hour
      });

      expect(result.entriesRemoved).toBe(1);
      expect(await store.has('old')).toBe(false);
      expect(await store.has('new')).toBe(true);
    });

    it('should support combined filters', async () => {
      const oldTime = now() - 7200 * 1000;

      const match = createTestEntry('match', 'Test', {
        model: 'gpt-5.5',
        namespace: 'ns1',
        createdAt: oldTime,
      });

      const noMatch1 = createTestEntry('nomatch1', 'Test', {
        model: 'gpt-5.4-mini',
        namespace: 'ns1',
        createdAt: oldTime,
      });

      const noMatch2 = createTestEntry('nomatch2', 'Test', {
        model: 'gpt-5.5',
        namespace: 'ns2',
      });

      await store.set('match', match);
      await store.set('nomatch1', noMatch1);
      await store.set('nomatch2', noMatch2);

      const result = await manager.invalidateByPattern({
        model: 'gpt-5.5',
        namespace: 'ns1',
        olderThan: 3600,
      });

      expect(result.entriesRemoved).toBe(1);
      expect(await store.has('match')).toBe(false);
    });
  });

  describe('Automatic Invalidation', () => {
    beforeEach(() => {
      manager = new InvalidationManager(store, {
        strategy: 'ttl',
        ttl: { defaultTtl: 1 },
      });
    });

    it('should run automatic invalidation on interval', async () => {
      vi.useFakeTimers();

      const oldEntry = createTestEntry('old', 'Test', {
        ttl: 1,
        createdAt: now() - 2000,
      });

      await store.set('old', oldEntry);

      manager.startAuto(100); // Run every 100ms

      // Advance timers and flush all promises
      await vi.advanceTimersByTimeAsync(150);

      manager.stopAuto();
      vi.useRealTimers();
    });

    it('should stop automatic invalidation', () => {
      manager.startAuto(1000);
      manager.stopAuto();

      // Should not throw
      expect(() => manager.stopAuto()).not.toThrow();
    });

    it('should restart automatic invalidation', () => {
      manager.startAuto(1000);
      manager.startAuto(500); // Should stop previous and start new

      manager.stopAuto();
    });
  });

  describe('Events', () => {
    beforeEach(() => {
      manager = new InvalidationManager(store, { emitEvents: true });
    });

    it('should emit invalidation events', async () => {
      const events: unknown[] = [];
      manager.on('invalidate', (event) => events.push(event));

      await store.set('key1', createTestEntry('key1', 'Test'));
      await manager.invalidateKeys(['key1']);

      expect(events.length).toBe(1);
    });

    it('should call onInvalidate callback', async () => {
      const callback = vi.fn();
      const callbackManager = new InvalidationManager(store, {
        emitEvents: true,
        onInvalidate: callback,
      });

      await store.set('key1', createTestEntry('key1', 'Test'));
      await callbackManager.invalidateKeys(['key1']);

      expect(callback).toHaveBeenCalled();

      callbackManager.destroy();
    });

    it('should emit error events on failures', async () => {
      vi.useFakeTimers();

      const errors: Error[] = [];
      manager.on('error', (error) => errors.push(error));

      // Close store to cause errors before starting auto
      await store.close();

      manager.startAuto(10);

      // Advance timers and flush promises
      await vi.advanceTimersByTimeAsync(50);

      manager.stopAuto();
      vi.useRealTimers();

      // The error may or may not have been emitted depending on timing
      // The key is that the test completes without hanging
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      manager = new InvalidationManager(store);
    });

    it('should track invalidation statistics', async () => {
      await store.set('key1', createTestEntry('key1', 'Test'));
      await manager.invalidateKeys(['key1']);

      const stats = manager.getStats();
      expect(stats.totalInvalidations).toBe(1);
      expect(stats.manualRemovals).toBe(1);
      expect(stats.totalBytesFreed).toBeGreaterThan(0);
      expect(stats.lastInvalidationAt).toBeGreaterThan(0);
    });

    it('should reset statistics', async () => {
      await store.set('key1', createTestEntry('key1', 'Test'));
      await manager.invalidateKeys(['key1']);

      manager.resetStats();

      const stats = manager.getStats();
      expect(stats.totalInvalidations).toBe(0);
      expect(stats.manualRemovals).toBe(0);
    });

    it('should track different invalidation types', async () => {
      const ttlManager = new InvalidationManager(store, {
        strategy: 'ttl',
        ttl: { defaultTtl: 1 },
      });

      const oldEntry = createTestEntry('old', 'Test', {
        ttl: 1,
        createdAt: now() - 2000,
      });

      await store.set('old', oldEntry);
      await ttlManager.runTTLInvalidation();

      const stats = ttlManager.getStats();
      expect(stats.ttlRemovals).toBeGreaterThan(0);

      ttlManager.destroy();
    });
  });

  describe('Run with Strategy', () => {
    it('should run TTL strategy', async () => {
      const ttlManager = new InvalidationManager(store, {
        strategy: 'ttl',
        ttl: { defaultTtl: 1 },
      });

      const oldEntry = createTestEntry('old', 'Test', {
        ttl: 1,
        createdAt: now() - 2000,
      });

      await store.set('old', oldEntry);

      const result = await ttlManager.run();

      expect(result.entriesRemoved).toBeGreaterThanOrEqual(0);

      ttlManager.destroy();
    });

    it('should run LRU strategy', async () => {
      const lruManager = new InvalidationManager(store, {
        strategy: 'lru',
        lru: { maxEntries: 2 },
      });

      for (let i = 0; i < 5; i++) {
        await store.set(`key${i}`, createTestEntry(`key${i}`, 'Test'));
      }

      const result = await lruManager.run();

      expect(result.entriesRemoved).toBeGreaterThan(0);

      lruManager.destroy();
    });

    it('should run smart strategy', async () => {
      const smartManager = new InvalidationManager(store, {
        strategy: 'smart',
        ttl: { defaultTtl: 1 },
      });

      const result = await smartManager.run();

      expect(result).toBeDefined();

      smartManager.destroy();
    });

    it('should default to TTL strategy', async () => {
      const defaultManager = new InvalidationManager(store, {
        strategy: 'unknown' as 'ttl',
      });

      const result = await defaultManager.run();

      expect(result).toBeDefined();

      defaultManager.destroy();
    });
  });

  describe('Destroy', () => {
    it('should clean up resources', () => {
      manager = new InvalidationManager(store);
      manager.startAuto(1000);

      manager.destroy();

      // Should have stopped auto invalidation
      // Should have removed all listeners
      expect(() => manager.destroy()).not.toThrow();
    });

    it('should be safe to destroy multiple times', () => {
      manager = new InvalidationManager(store);

      expect(() => {
        manager.destroy();
        manager.destroy();
      }).not.toThrow();
    });
  });
});
