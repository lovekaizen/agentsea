/**
 * StreamCache tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StreamCache } from '../streaming/StreamCache.js';
import { MemoryCacheStore } from '../stores/MemoryCacheStore.js';
import type { CacheMessage, RecordedStream } from '../types/index.js';

function createTestMessages(content: string): CacheMessage[] {
  return [{ role: 'user', content }];
}

async function* createMockStream(
  chunks: string[],
): AsyncGenerator<{ content: string }> {
  for (const chunk of chunks) {
    yield { content: chunk };
  }
}

describe('StreamCache', () => {
  let cache: StreamCache;
  let store: MemoryCacheStore;

  beforeEach(() => {
    store = new MemoryCacheStore({ type: 'memory', maxEntries: 100 });
    // Set minLengthToCache to 0 for testing to allow short streams
    cache = new StreamCache(store, { minLengthToCache: 0 });
  });

  afterEach(() => {
    cache.destroy();
    store.close();
  });

  describe('Lookup', () => {
    it('should miss on first lookup', async () => {
      const result = await cache.lookup('gpt-4', createTestMessages('Hello'));

      expect(result.hit).toBe(false);
      expect(result.source).toBe('miss');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should hit on cached stream', async () => {
      const messages = createTestMessages('Hello');
      const stream: RecordedStream = {
        id: 'stream1',
        key: 'test-key',
        chunks: [
          { type: 'text', content: 'Hello', timestamp: Date.now(), index: 0 },
          { type: 'text', content: ' world', timestamp: Date.now(), index: 1 },
        ],
        model: 'gpt-4',
        messages,
        startTime: Date.now(),
        endTime: Date.now() + 1000,
        durationMs: 1000,
        totalChars: 11,
        complete: true,
      };

      await cache.cache(stream);

      const result = await cache.lookup('gpt-4', messages);

      expect(result.hit).toBe(true);
      expect(result.source).toBe('exact');
      expect(result.stream).toBeDefined();
      expect(result.similarity).toBe(1.0);
    });

    it('should track lookup statistics', async () => {
      await cache.lookup('gpt-4', createTestMessages('Test 1'));
      await cache.lookup('gpt-4', createTestMessages('Test 2'));

      const stats = cache.getStats();
      expect(stats.totalLookups).toBe(2);
      expect(stats.totalMisses).toBe(2);
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('Caching', () => {
    it('should cache complete streams', async () => {
      const messages = createTestMessages('Hello');
      const stream: RecordedStream = {
        id: 'stream1',
        key: 'test-key',
        chunks: [
          {
            type: 'text',
            content: 'Response',
            timestamp: Date.now(),
            index: 0,
          },
        ],
        model: 'gpt-4',
        messages,
        startTime: Date.now(),
        endTime: Date.now() + 500,
        durationMs: 500,
        totalChars: 8,
        complete: true,
      };

      await cache.cache(stream);

      const result = await cache.lookup('gpt-4', messages);
      expect(result.hit).toBe(true);
    });

    it('should not cache incomplete streams by default', async () => {
      const messages = createTestMessages('Hello');
      const stream: RecordedStream = {
        id: 'stream1',
        key: 'test-key',
        chunks: [
          { type: 'text', content: 'Partial', timestamp: Date.now(), index: 0 },
        ],
        model: 'gpt-4',
        messages,
        startTime: Date.now(),
        endTime: Date.now() + 500,
        durationMs: 500,
        totalChars: 7,
        complete: false,
      };

      await cache.cache(stream);

      const result = await cache.lookup('gpt-4', messages);
      expect(result.hit).toBe(false);
    });

    it('should cache incomplete streams when configured', async () => {
      const cacheWithIncomplete = new StreamCache(store, {
        cacheIncomplete: true,
        minLengthToCache: 0,
      });

      const messages = createTestMessages('Hello');
      const stream: RecordedStream = {
        id: 'stream1',
        key: 'test-key',
        chunks: [
          { type: 'text', content: 'Partial', timestamp: Date.now(), index: 0 },
        ],
        model: 'gpt-4',
        messages,
        startTime: Date.now(),
        endTime: Date.now() + 500,
        durationMs: 500,
        totalChars: 7,
        complete: false,
      };

      await cacheWithIncomplete.cache(stream);

      const result = await cacheWithIncomplete.lookup('gpt-4', messages);
      expect(result.hit).toBe(true);

      cacheWithIncomplete.destroy();
    });

    it('should respect minimum length threshold', async () => {
      const cacheWithMin = new StreamCache(store, {
        minLengthToCache: 100,
      });

      const messages = createTestMessages('Hello');
      const stream: RecordedStream = {
        id: 'stream1',
        key: 'test-key',
        chunks: [
          { type: 'text', content: 'Short', timestamp: Date.now(), index: 0 },
        ],
        model: 'gpt-4',
        messages,
        startTime: Date.now(),
        endTime: Date.now() + 500,
        durationMs: 500,
        totalChars: 5,
        complete: true,
      };

      await cacheWithMin.cache(stream);

      const result = await cacheWithMin.lookup('gpt-4', messages);
      expect(result.hit).toBe(false);

      cacheWithMin.destroy();
    });

    it('should update statistics on cache', async () => {
      const messages = createTestMessages('Hello');
      const stream: RecordedStream = {
        id: 'stream1',
        key: 'test-key',
        chunks: [
          {
            type: 'text',
            content: 'Response',
            timestamp: Date.now(),
            index: 0,
          },
        ],
        model: 'gpt-4',
        messages,
        startTime: Date.now(),
        endTime: Date.now() + 1000,
        durationMs: 1000,
        totalChars: 8,
        complete: true,
      };

      await cache.cache(stream);

      const stats = cache.getStats();
      expect(stats.totalStreamsCached).toBe(1);
      expect(stats.totalBytesCached).toBeGreaterThan(0);
      expect(stats.avgStreamDurationMs).toBe(1000);
    });
  });

  describe('Wrap Stream', () => {
    it('should record and cache new streams', async () => {
      const messages = createTestMessages('Hello');
      const chunks = ['Hello', ' ', 'world', '!'];
      const collected: string[] = [];

      for await (const chunk of cache.wrapStream('gpt-4', messages, () =>
        createMockStream(chunks),
      )) {
        collected.push(chunk.content ?? '');
      }

      expect(collected).toEqual(chunks);

      // Should be cached now
      const result = await cache.lookup('gpt-4', messages);
      expect(result.hit).toBe(true);
    });

    it('should replay from cache on second call', async () => {
      const messages = createTestMessages('Hello');
      const originalChunks = ['Hello', ' ', 'world'];

      // First call - record
      const collected1: string[] = [];
      for await (const chunk of cache.wrapStream('gpt-4', messages, () =>
        createMockStream(originalChunks),
      )) {
        collected1.push(chunk.content ?? '');
      }

      // Second call - replay
      const collected2: string[] = [];
      for await (const chunk of cache.wrapStream('gpt-4', messages, () =>
        createMockStream(['Should', 'not', 'see', 'this']),
      )) {
        collected2.push(chunk.content ?? '');
      }

      expect(collected2).toEqual(originalChunks);
    });

    it('should handle stream errors', async () => {
      const messages = createTestMessages('Error test');

      async function* errorStream(): AsyncGenerator<{ content: string }> {
        yield { content: 'Start' };
        throw new Error('Stream error');
      }

      await expect(async () => {
        for await (const _chunk of cache.wrapStream(
          'gpt-4',
          messages,
          errorStream,
        )) {
          // Will throw
        }
      }).rejects.toThrow('Stream error');
    });
  });

  describe('Replay', () => {
    it('should replay recorded streams', async () => {
      const stream: RecordedStream = {
        id: 'stream1',
        key: 'test-key',
        chunks: [
          { type: 'text', content: 'Hello', timestamp: Date.now(), index: 0 },
          { type: 'text', content: ' ', timestamp: Date.now(), index: 1 },
          { type: 'text', content: 'world', timestamp: Date.now(), index: 2 },
        ],
        model: 'gpt-4',
        messages: createTestMessages('Hello'),
        startTime: Date.now(),
        endTime: Date.now() + 1000,
        durationMs: 1000,
        totalChars: 10,
        complete: true,
      };

      const chunks: string[] = [];
      for await (const chunk of cache.replay(stream)) {
        if (chunk.content) {
          chunks.push(chunk.content);
        }
      }

      expect(chunks).toEqual(['Hello', ' ', 'world']);
    });
  });

  describe('Events', () => {
    it('should emit hit events', async () => {
      const hitEvents: unknown[] = [];
      cache.on('hit', (result) => hitEvents.push(result));

      const messages = createTestMessages('Hello');
      const stream: RecordedStream = {
        id: 'stream1',
        key: 'test-key',
        chunks: [
          {
            type: 'text',
            content: 'Response',
            timestamp: Date.now(),
            index: 0,
          },
        ],
        model: 'gpt-4',
        messages,
        startTime: Date.now(),
        endTime: Date.now() + 500,
        durationMs: 500,
        totalChars: 8,
        complete: true,
      };

      await cache.cache(stream);
      await cache.lookup('gpt-4', messages);

      expect(hitEvents.length).toBe(1);
    });

    it('should emit miss events', async () => {
      const missEvents: string[] = [];
      cache.on('miss', (key) => missEvents.push(key));

      await cache.lookup('gpt-4', createTestMessages('Not cached'));

      expect(missEvents.length).toBe(1);
    });

    it('should emit record events', async () => {
      const recordEvents: RecordedStream[] = [];
      cache.on('record', (stream) => recordEvents.push(stream));

      const messages = createTestMessages('Hello');
      const stream: RecordedStream = {
        id: 'stream1',
        key: 'test-key',
        chunks: [
          {
            type: 'text',
            content: 'Response',
            timestamp: Date.now(),
            index: 0,
          },
        ],
        model: 'gpt-4',
        messages,
        startTime: Date.now(),
        endTime: Date.now() + 500,
        durationMs: 500,
        totalChars: 8,
        complete: true,
      };

      await cache.cache(stream);

      expect(recordEvents.length).toBe(1);
    });

    it('should emit error events', async () => {
      // Create a store that throws errors
      const errorStore = new MemoryCacheStore({
        type: 'memory',
        maxEntries: 100,
      });
      const errorCache = new StreamCache(errorStore, { minLengthToCache: 0 });

      const errors: Error[] = [];
      errorCache.on('error', (error) => errors.push(error));

      // Mock the store.get to throw an error
      const originalGet = errorStore.get.bind(errorStore);
      errorStore.get = async () => {
        throw new Error('Store error');
      };

      await errorCache.lookup('gpt-4', createTestMessages('Test'));

      expect(errors.length).toBeGreaterThan(0);

      // Restore and cleanup
      errorStore.get = originalGet;
      errorCache.destroy();
      await errorStore.close();
    });
  });

  describe('Statistics', () => {
    it('should calculate hit rate', async () => {
      const messages1 = createTestMessages('Hello');
      const messages2 = createTestMessages('World');

      const stream: RecordedStream = {
        id: 'stream1',
        key: 'test-key',
        chunks: [
          {
            type: 'text',
            content: 'Response',
            timestamp: Date.now(),
            index: 0,
          },
        ],
        model: 'gpt-4',
        messages: messages1,
        startTime: Date.now(),
        endTime: Date.now() + 500,
        durationMs: 500,
        totalChars: 8,
        complete: true,
      };

      await cache.cache(stream);

      // 1 hit
      await cache.lookup('gpt-4', messages1);

      // 1 miss
      await cache.lookup('gpt-4', messages2);

      const stats = cache.getStats();
      expect(stats.totalLookups).toBe(2);
      expect(stats.totalHits).toBe(1);
      expect(stats.totalMisses).toBe(1);
      expect(stats.hitRate).toBe(50);
    });
  });

  describe('Clear', () => {
    it('should clear all cached streams', async () => {
      const stream: RecordedStream = {
        id: 'stream1',
        key: 'test-key',
        chunks: [
          {
            type: 'text',
            content: 'Response',
            timestamp: Date.now(),
            index: 0,
          },
        ],
        model: 'gpt-4',
        messages: createTestMessages('Hello'),
        startTime: Date.now(),
        endTime: Date.now() + 500,
        durationMs: 500,
        totalChars: 8,
        complete: true,
      };

      await cache.cache(stream);

      const beforeClear = await cache.lookup(
        'gpt-4',
        createTestMessages('Hello'),
      );
      expect(beforeClear.hit).toBe(true);

      await cache.clear();

      const afterClear = await cache.lookup(
        'gpt-4',
        createTestMessages('Hello'),
      );
      expect(afterClear.hit).toBe(false);

      const stats = cache.getStats();
      expect(stats.totalStreamsCached).toBe(0);
    });
  });

  describe('Semantic Matching', () => {
    it('should support semantic matching with similarity engine', async () => {
      const mockSimilarity = {
        embed: vi.fn().mockResolvedValue([0.5, 0.5, 0.5]),
        computeSimilarity: vi.fn().mockReturnValue(0.95),
        isInitialized: true,
        config: { metric: 'cosine' as const },
      };

      const semanticCache = new StreamCache(
        store,
        { minLengthToCache: 0 },
        mockSimilarity,
      );

      const messages = createTestMessages('Hello world');
      const stream: RecordedStream = {
        id: 'stream1',
        key: 'test-key',
        chunks: [
          {
            type: 'text',
            content: 'Response',
            timestamp: Date.now(),
            index: 0,
          },
        ],
        model: 'gpt-4',
        messages,
        startTime: Date.now(),
        endTime: Date.now() + 500,
        durationMs: 500,
        totalChars: 8,
        complete: true,
      };

      await semanticCache.cache(stream, [0.5, 0.5, 0.5]);

      // Query with similar message
      const result = await semanticCache.lookup(
        'gpt-4',
        createTestMessages('Hi world'),
      );

      expect(mockSimilarity.embed).toHaveBeenCalled();

      semanticCache.destroy();
    });
  });

  describe('Configuration', () => {
    it('should apply custom configuration', () => {
      const customCache = new StreamCache(store, {
        minLengthToCache: 50,
        cacheIncomplete: true,
        streamTtl: 7200,
      });

      expect(customCache).toBeDefined();
      customCache.destroy();
    });
  });
});
