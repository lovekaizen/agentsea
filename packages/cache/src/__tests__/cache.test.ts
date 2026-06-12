import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SemanticCache } from '../core/SemanticCache.js';
import { MemoryCacheStore } from '../stores/MemoryCacheStore.js';
import { ExactMatchStrategy } from '../strategies/ExactMatchStrategy.js';
import type { CacheMessage } from '../types/index.js';

function createTestMessages(content: string): CacheMessage[] {
  return [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content },
  ];
}

function createMockResponse(content: string) {
  return {
    content,
    model: 'gpt-5.5',
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    finishReason: 'stop',
  };
}

describe('SemanticCache', () => {
  let cache: SemanticCache;
  let store: MemoryCacheStore;

  beforeEach(() => {
    store = new MemoryCacheStore({ type: 'memory', maxEntries: 100 });
    cache = new SemanticCache(
      { defaultTTL: 3600, matchStrategy: 'exact' },
      store,
      new ExactMatchStrategy(),
    );
  });

  afterEach(async () => {
    await cache.close();
  });

  describe('wrap', () => {
    it('should cache and return responses', async () => {
      let callCount = 0;

      const response = await cache.wrap(
        { model: 'gpt-5.5', messages: createTestMessages('Hello') },
        async () => {
          callCount++;
          return createMockResponse('Hi there!');
        },
      );

      expect(response.content).toBe('Hi there!');
      expect(callCount).toBe(1);
      expect(response._cache?.hit).toBe(false);

      // Second call should hit cache
      const response2 = await cache.wrap(
        { model: 'gpt-5.5', messages: createTestMessages('Hello') },
        async () => {
          callCount++;
          return createMockResponse('Different response');
        },
      );

      expect(response2.content).toBe('Hi there!');
      expect(callCount).toBe(1); // Should not increment
      expect(response2._cache?.hit).toBe(true);
    });

    it('should skip cache when skipCache is true', async () => {
      let callCount = 0;

      await cache.wrap(
        { model: 'gpt-5.5', messages: createTestMessages('Hello') },
        async () => {
          callCount++;
          return createMockResponse('Response 1');
        },
      );

      const response = await cache.wrap(
        { model: 'gpt-5.5', messages: createTestMessages('Hello') },
        async () => {
          callCount++;
          return createMockResponse('Response 2');
        },
        { skipCache: true },
      );

      expect(callCount).toBe(2);
      expect(response._cache?.hit).toBe(false);
    });

    it('should force refresh when forceRefresh is true', async () => {
      let callCount = 0;

      await cache.wrap(
        { model: 'gpt-5.5', messages: createTestMessages('Hello') },
        async () => {
          callCount++;
          return createMockResponse(`Response ${callCount}`);
        },
      );

      const response = await cache.wrap(
        { model: 'gpt-5.5', messages: createTestMessages('Hello') },
        async () => {
          callCount++;
          return createMockResponse(`Response ${callCount}`);
        },
        { forceRefresh: true },
      );

      expect(callCount).toBe(2);
      expect(response.content).toBe('Response 2');
    });

    it('should handle different models separately', async () => {
      let callCount = 0;

      await cache.wrap(
        { model: 'gpt-5.5', messages: createTestMessages('Hello') },
        async () => {
          callCount++;
          return createMockResponse('GPT-4 response');
        },
      );

      const response = await cache.wrap(
        { model: 'gpt-5.4-mini', messages: createTestMessages('Hello') },
        async () => {
          callCount++;
          return createMockResponse('GPT-3.5 response');
        },
      );

      expect(callCount).toBe(2); // Different models = different cache keys
      expect(response.content).toBe('GPT-3.5 response');
    });

    it('should handle different messages separately', async () => {
      let callCount = 0;

      await cache.wrap(
        { model: 'gpt-5.5', messages: createTestMessages('Hello') },
        async () => {
          callCount++;
          return createMockResponse('Response to Hello');
        },
      );

      const response = await cache.wrap(
        { model: 'gpt-5.5', messages: createTestMessages('Goodbye') },
        async () => {
          callCount++;
          return createMockResponse('Response to Goodbye');
        },
      );

      expect(callCount).toBe(2); // Different messages = different cache keys
      expect(response.content).toBe('Response to Goodbye');
    });
  });

  describe('get/set', () => {
    it('should get and set entries directly', async () => {
      await cache.set(
        { model: 'gpt-5.5', messages: createTestMessages('Test') },
        createMockResponse('Cached response'),
      );

      const result = await cache.get({
        model: 'gpt-5.5',
        messages: createTestMessages('Test'),
      });

      expect(result.hit).toBe(true);
      expect(result.entry?.response.content).toBe('Cached response');
      expect(result.source).toBe('exact');
    });

    it('should return miss for non-existent keys', async () => {
      const result = await cache.get({
        model: 'gpt-5.5',
        messages: createTestMessages('Non-existent'),
      });

      expect(result.hit).toBe(false);
      expect(result.source).toBe('miss');
    });
  });

  describe('delete', () => {
    it('should delete entries', async () => {
      const response = await cache.wrap(
        { model: 'gpt-5.5', messages: createTestMessages('Delete me') },
        async () => createMockResponse('To be deleted'),
      );

      // Get the key that was used
      const result = await cache.get({
        model: 'gpt-5.5',
        messages: createTestMessages('Delete me'),
      });

      expect(result.hit).toBe(true);

      // Delete it
      const deleted = await cache.delete(result.entry!.key);
      expect(deleted).toBe(true);

      // Verify it's gone
      const afterDelete = await cache.get({
        model: 'gpt-5.5',
        messages: createTestMessages('Delete me'),
      });
      expect(afterDelete.hit).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all entries', async () => {
      await cache.wrap(
        { model: 'gpt-5.5', messages: createTestMessages('Entry 1') },
        async () => createMockResponse('Response 1'),
      );

      await cache.wrap(
        { model: 'gpt-5.5', messages: createTestMessages('Entry 2') },
        async () => createMockResponse('Response 2'),
      );

      await cache.clear();

      const result1 = await cache.get({
        model: 'gpt-5.5',
        messages: createTestMessages('Entry 1'),
      });
      const result2 = await cache.get({
        model: 'gpt-5.5',
        messages: createTestMessages('Entry 2'),
      });

      expect(result1.hit).toBe(false);
      expect(result2.hit).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should track hit/miss statistics', async () => {
      // First call = miss
      await cache.wrap(
        { model: 'gpt-5.5', messages: createTestMessages('Hello') },
        async () => createMockResponse('Response'),
      );

      const stats1 = cache.getStats();
      expect(stats1.misses).toBe(1);
      expect(stats1.hits).toBe(0);

      // Second call = hit
      await cache.wrap(
        { model: 'gpt-5.5', messages: createTestMessages('Hello') },
        async () => createMockResponse('Different'),
      );

      const stats2 = cache.getStats();
      expect(stats2.misses).toBe(1);
      expect(stats2.hits).toBe(1);
      expect(stats2.hitRate).toBe(0.5);
      expect(stats2.exactHits).toBe(1);
    });

    it('should track tokens saved', async () => {
      await cache.wrap(
        { model: 'gpt-5.5', messages: createTestMessages('Hello') },
        async () => createMockResponse('Response'),
      );

      // Hit the cache
      await cache.wrap(
        { model: 'gpt-5.5', messages: createTestMessages('Hello') },
        async () => createMockResponse('Different'),
      );

      const stats = cache.getStats();
      expect(stats.tokensSaved).toBe(15); // promptTokens + completionTokens
    });
  });

  describe('invalidation', () => {
    it('should invalidate by pattern', async () => {
      await cache.wrap(
        { model: 'gpt-5.5', messages: createTestMessages('Test 1') },
        async () => createMockResponse('Response 1'),
      );
      await cache.wrap(
        { model: 'gpt-5.5', messages: createTestMessages('Test 2') },
        async () => createMockResponse('Response 2'),
      );
      await cache.wrap(
        { model: 'gpt-5.4-mini', messages: createTestMessages('Other') },
        async () => createMockResponse('Response 3'),
      );

      const invalidated = await cache.invalidateByPattern(/gpt-5.5/);
      expect(invalidated).toBe(2);

      // GPT-4 entries should be gone
      const result1 = await cache.get({
        model: 'gpt-5.5',
        messages: createTestMessages('Test 1'),
      });
      expect(result1.hit).toBe(false);

      // GPT-3.5 entry should still exist
      const result2 = await cache.get({
        model: 'gpt-5.4-mini',
        messages: createTestMessages('Other'),
      });
      expect(result2.hit).toBe(true);
    });

    it('should invalidate by tags', async () => {
      await cache.set(
        { model: 'gpt-5.5', messages: createTestMessages('Tagged') },
        createMockResponse('Response'),
        { tags: ['important', 'test'] },
      );

      await cache.set(
        { model: 'gpt-5.5', messages: createTestMessages('Untagged') },
        createMockResponse('Response'),
      );

      const invalidated = await cache.invalidateByTags(['test']);
      expect(invalidated).toBe(1);

      // Tagged entry should be gone
      const result1 = await cache.get({
        model: 'gpt-5.5',
        messages: createTestMessages('Tagged'),
      });
      expect(result1.hit).toBe(false);

      // Untagged entry should still exist
      const result2 = await cache.get({
        model: 'gpt-5.5',
        messages: createTestMessages('Untagged'),
      });
      expect(result2.hit).toBe(true);
    });
  });

  describe('events', () => {
    it('should emit hit events', async () => {
      let hitEntry: any = null;

      cache.on('hit', (entry) => {
        hitEntry = entry;
      });

      await cache.wrap(
        { model: 'gpt-5.5', messages: createTestMessages('Hello') },
        async () => createMockResponse('Response'),
      );

      await cache.wrap(
        { model: 'gpt-5.5', messages: createTestMessages('Hello') },
        async () => createMockResponse('Different'),
      );

      expect(hitEntry).not.toBeNull();
      expect(hitEntry.response.content).toBe('Response');
    });

    it('should emit miss events', async () => {
      let missKey: string | null = null;

      cache.on('miss', (key) => {
        missKey = key;
      });

      await cache.wrap(
        { model: 'gpt-5.5', messages: createTestMessages('Hello') },
        async () => createMockResponse('Response'),
      );

      expect(missKey).not.toBeNull();
      expect(missKey).toContain('cache:gpt-5.5:');
    });

    it('should emit set events', async () => {
      let setEntry: any = null;

      cache.on('set', (entry) => {
        setEntry = entry;
      });

      await cache.wrap(
        { model: 'gpt-5.5', messages: createTestMessages('Hello') },
        async () => createMockResponse('Response'),
      );

      expect(setEntry).not.toBeNull();
      expect(setEntry.response.content).toBe('Response');
    });
  });
});
