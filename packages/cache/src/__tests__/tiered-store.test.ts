/**
 * TieredCacheStore tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TieredCacheStore } from '../stores/TieredCacheStore.js';
import { MemoryCacheStore } from '../stores/MemoryCacheStore.js';
import type { CacheEntry, TieredStoreConfig } from '../types/index.js';
import { generateId, now } from '../core/utils.js';

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

describe('TieredCacheStore', () => {
  let hotStore: MemoryCacheStore;
  let warmStore: MemoryCacheStore;
  let coldStore: MemoryCacheStore;
  let tieredStore: TieredCacheStore;

  beforeEach(() => {
    hotStore = new MemoryCacheStore({ type: 'memory', maxEntries: 10 });
    warmStore = new MemoryCacheStore({ type: 'memory', maxEntries: 100 });
    coldStore = new MemoryCacheStore({ type: 'memory', maxEntries: 1000 });

    const config: TieredStoreConfig = {
      type: 'tiered',
      tiers: [
        {
          name: 'hot',
          store: hotStore,
          priority: 1,
          maxSize: 5,
          promotionThreshold: 3,
        },
        {
          name: 'warm',
          store: warmStore,
          priority: 2,
          maxSize: 20,
          promotionThreshold: 2,
        },
        {
          name: 'cold',
          store: coldStore,
          priority: 3,
        },
      ],
    };

    tieredStore = new TieredCacheStore(config);
  });

  afterEach(async () => {
    await tieredStore.close();
  });

  describe('Initialization', () => {
    it('should create a tiered store with multiple tiers', () => {
      expect(tieredStore).toBeDefined();
    });

    it('should throw if no tiers with stores provided', () => {
      expect(
        () =>
          new TieredCacheStore({
            type: 'tiered',
            tiers: [],
          }),
      ).toThrow();
    });

    it('should sort tiers by priority', async () => {
      const stats = await tieredStore.getTierStats();
      expect(stats[0].priority).toBe(1);
      expect(stats[1].priority).toBe(2);
      expect(stats[2].priority).toBe(3);
    });
  });

  describe('Basic Operations', () => {
    it('should set entries in the primary tier', async () => {
      const entry = createTestEntry('key1', 'Test');

      await tieredStore.set('key1', entry);

      // Should be in hot tier
      expect(await hotStore.has('key1')).toBe(true);
      expect(await warmStore.has('key1')).toBe(false);
      expect(await coldStore.has('key1')).toBe(false);
    });

    it('should get entries from any tier', async () => {
      const entry = createTestEntry('key1', 'Test');

      // Add to warm tier directly
      await warmStore.set('key1', entry);

      const retrieved = await tieredStore.get('key1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.response.content).toBe('Response to: Test');
    });

    it('should search tiers in priority order', async () => {
      const hotEntry = createTestEntry('key1', 'Hot');
      const warmEntry = createTestEntry('key1', 'Warm');

      await hotStore.set('key1', hotEntry);
      await warmStore.set('key1', warmEntry);

      const retrieved = await tieredStore.get('key1');
      expect(retrieved?.response.content).toBe('Response to: Hot');
    });

    it('should delete from all tiers', async () => {
      const entry = createTestEntry('key1', 'Test');

      await hotStore.set('key1', entry);
      await warmStore.set('key1', entry);
      await coldStore.set('key1', entry);

      const deleted = await tieredStore.delete('key1');
      expect(deleted).toBe(true);

      expect(await hotStore.has('key1')).toBe(false);
      expect(await warmStore.has('key1')).toBe(false);
      expect(await coldStore.has('key1')).toBe(false);
    });

    it('should check existence across all tiers', async () => {
      const entry = createTestEntry('key1', 'Test');

      await coldStore.set('key1', entry);

      expect(await tieredStore.has('key1')).toBe(true);
      expect(await tieredStore.has('non-existent')).toBe(false);
    });
  });

  describe('Promotion', () => {
    it('should promote entries based on access count', async () => {
      const entry = createTestEntry('key1', 'Test');

      // Add to warm tier
      await warmStore.set('key1', entry);

      // Access multiple times to trigger promotion
      await tieredStore.get('key1');
      await tieredStore.get('key1');
      await tieredStore.get('key1');
      await tieredStore.get('key1'); // 4th access should promote

      // Should now be in hot tier
      expect(await hotStore.has('key1')).toBe(true);
      expect(await warmStore.has('key1')).toBe(false);
    });

    it('should manually promote entries', async () => {
      const entry = createTestEntry('key1', 'Test');

      await coldStore.set('key1', entry);

      const promoted = await tieredStore.promote('key1', 0);
      expect(promoted).toBe(true);

      expect(await hotStore.has('key1')).toBe(true);
      expect(await coldStore.has('key1')).toBe(false);
    });

    it('should not promote non-existent entries', async () => {
      const promoted = await tieredStore.promote('non-existent', 0);
      expect(promoted).toBe(false);
    });
  });

  describe('Demotion', () => {
    it('should demote entries when tier exceeds capacity', async () => {
      // Fill hot tier beyond capacity
      for (let i = 0; i < 7; i++) {
        const entry = createTestEntry(`key${i}`, `Test ${i}`);
        await tieredStore.set(`key${i}`, entry);
      }

      // Some entries should have been demoted
      const hotSize = await hotStore.size();
      expect(hotSize).toBeLessThanOrEqual(5);
    });

    it('should manually demote entries', async () => {
      const entry = createTestEntry('key1', 'Test');

      await hotStore.set('key1', entry);

      const demoted = await tieredStore.demote('key1');
      expect(demoted).toBe(true);

      expect(await hotStore.has('key1')).toBe(false);
      expect(await warmStore.has('key1')).toBe(true);
    });

    it('should demote to specific tier', async () => {
      const entry = createTestEntry('key1', 'Test');

      await hotStore.set('key1', entry);

      const demoted = await tieredStore.demote('key1', 2); // To cold tier
      expect(demoted).toBe(true);

      expect(await coldStore.has('key1')).toBe(true);
    });
  });

  describe('Bulk Operations', () => {
    it('should clear all tiers', async () => {
      await hotStore.set('key1', createTestEntry('key1', 'Test 1'));
      await warmStore.set('key2', createTestEntry('key2', 'Test 2'));
      await coldStore.set('key3', createTestEntry('key3', 'Test 3'));

      await tieredStore.clear();

      expect(await hotStore.size()).toBe(0);
      expect(await warmStore.size()).toBe(0);
      expect(await coldStore.size()).toBe(0);
    });

    it('should get unique keys across all tiers', async () => {
      await hotStore.set('key1', createTestEntry('key1', 'Test'));
      await warmStore.set('key2', createTestEntry('key2', 'Test'));
      await coldStore.set('key3', createTestEntry('key3', 'Test'));

      // Duplicate key
      await warmStore.set('key1', createTestEntry('key1', 'Test'));

      const keys = await tieredStore.keys();
      expect(keys.length).toBe(3);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });

    it('should count unique entries across tiers', async () => {
      await hotStore.set('key1', createTestEntry('key1', 'Test'));
      await warmStore.set('key2', createTestEntry('key2', 'Test'));
      await coldStore.set('key1', createTestEntry('key1', 'Test')); // Duplicate

      const size = await tieredStore.size();
      expect(size).toBe(2);
    });
  });

  describe('Vector Search', () => {
    it('should query across all tiers', async () => {
      const entry1 = createTestEntry('key1', 'Hello', [1, 0, 0]);
      const entry2 = createTestEntry('key2', 'World', [0.9, 0.1, 0]);
      const entry3 = createTestEntry('key3', 'Different', [0, 0, 1]);

      await hotStore.set('key1', entry1);
      await warmStore.set('key2', entry2);
      await coldStore.set('key3', entry3);

      const result = await tieredStore.query([1, 0, 0], {
        topK: 2,
        minSimilarity: 0.5,
      });

      expect(result.entries.length).toBeLessThanOrEqual(2);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should merge results from multiple tiers', async () => {
      const entry1 = createTestEntry('key1', 'Test', [1, 0, 0]);
      const entry2 = createTestEntry('key1', 'Test', [0.95, 0.05, 0]); // Same key, different embedding

      await hotStore.set('key1', entry1);
      await warmStore.set('key1', entry2);

      const result = await tieredStore.query([1, 0, 0], { topK: 10 });

      // Should only return one entry (highest score)
      const key1Entries = result.entries.filter((e) => e.key === 'key1');
      expect(key1Entries.length).toBe(1);
    });
  });

  describe('Health Check', () => {
    it('should check health of all tiers', async () => {
      const health = await tieredStore.checkHealth();
      expect(health.healthy).toBe(true);
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should report unhealthy if any tier is unhealthy', async () => {
      // Close one tier to make it unhealthy
      await warmStore.close();

      const health = await tieredStore.checkHealth();
      expect(health.healthy).toBe(false);
      expect(health.error).toBeDefined();
    });
  });

  describe('Tier Statistics', () => {
    it('should return statistics for each tier', async () => {
      await hotStore.set('key1', createTestEntry('key1', 'Test'));
      await warmStore.set('key2', createTestEntry('key2', 'Test'));

      const stats = await tieredStore.getTierStats();
      expect(stats.length).toBe(3);

      expect(stats[0].name).toBe('hot');
      expect(stats[0].size).toBe(1);
      expect(stats[0].maxSize).toBe(5);

      expect(stats[1].name).toBe('warm');
      expect(stats[1].size).toBe(1);
      expect(stats[1].maxSize).toBe(20);
    });
  });

  describe('Access Tracking', () => {
    it('should track access counts for promotion decisions', async () => {
      const entry = createTestEntry('key1', 'Test');
      await warmStore.set('key1', entry);

      // Access the entry multiple times
      for (let i = 0; i < 5; i++) {
        await tieredStore.get('key1');
      }

      // Entry should be promoted to hot tier
      expect(await hotStore.has('key1')).toBe(true);
    });
  });

  describe('Metrics', () => {
    it('should track metrics across all tiers', async () => {
      await tieredStore.set('key1', createTestEntry('key1', 'Test'));
      await tieredStore.get('key1');
      await tieredStore.get('non-existent');
      await tieredStore.delete('key1');

      const metrics = tieredStore.getMetrics();
      expect(metrics.sets).toBeGreaterThan(0);
      expect(metrics.gets).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty tiers gracefully', async () => {
      const result = await tieredStore.get('non-existent');
      expect(result).toBeUndefined();
    });

    it('should handle demotion from last tier (deletion)', async () => {
      // Fill tiers to trigger demotion from last tier
      for (let i = 0; i < 30; i++) {
        await tieredStore.set(`key${i}`, createTestEntry(`key${i}`, `Test`));
      }

      // All operations should complete without errors
      expect(await tieredStore.size()).toBeGreaterThan(0);
    });

    it('should preserve entry data during promotion', async () => {
      const entry = createTestEntry('key1', 'Original Content');
      entry.metadata.tags = ['tag1', 'tag2'];

      await coldStore.set('key1', entry);

      await tieredStore.promote('key1', 0);

      const retrieved = await hotStore.get('key1');
      expect(retrieved?.response.content).toBe('Response to: Original Content');
      expect(retrieved?.metadata.tags).toEqual(['tag1', 'tag2']);
    });
  });

  describe('Configuration', () => {
    it('should use default demotion target if not specified', async () => {
      // Fill hot tier beyond capacity
      for (let i = 0; i < 10; i++) {
        await tieredStore.set(`key${i}`, createTestEntry(`key${i}`, `Test`));
      }

      const hotSize = await hotStore.size();
      // Should be demoted to ~90% of maxSize (default demotionTarget)
      expect(hotSize).toBeLessThanOrEqual(5);
    });
  });

  describe('Concurrent Access', () => {
    it('should handle concurrent gets', async () => {
      const entry = createTestEntry('key1', 'Test');
      await coldStore.set('key1', entry);

      const results = await Promise.all([
        tieredStore.get('key1'),
        tieredStore.get('key1'),
        tieredStore.get('key1'),
      ]);

      expect(results.every((r) => r !== undefined)).toBe(true);
    });

    it('should handle concurrent sets', async () => {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          tieredStore.set(`key${i}`, createTestEntry(`key${i}`, `Test ${i}`)),
        );
      }

      await Promise.all(promises);

      const size = await tieredStore.size();
      expect(size).toBe(5);
    });
  });
});
