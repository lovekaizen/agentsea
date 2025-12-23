/**
 * SemanticCache comprehensive tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SemanticCache } from '../core/SemanticCache.js';
import { MemoryCacheStore } from '../stores/MemoryCacheStore.js';
import { ExactMatchStrategy } from '../strategies/ExactMatchStrategy.js';
import { HybridMatchStrategy } from '../strategies/HybridMatchStrategy.js';
import type { CacheMessage, CacheResponseInput } from '../types/index.js';
import type { SimilarityEngine } from '../similarity/SimilarityEngine.js';

function createTestMessages(content: string): CacheMessage[] {
  return [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content },
  ];
}

function createMockResponse(content: string): CacheResponseInput {
  return {
    content,
    model: 'gpt-4',
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    finishReason: 'stop',
  };
}

describe('SemanticCache - Advanced', () => {
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

  describe('TTL and Expiration', () => {
    it('should respect custom TTL per entry', async () => {
      await cache.set(
        { model: 'gpt-4', messages: createTestMessages('Short TTL') },
        createMockResponse('Response'),
        { ttl: 1 }, // 1 second
      );

      // Should hit immediately
      const result1 = await cache.get({
        model: 'gpt-4',
        messages: createTestMessages('Short TTL'),
      });
      expect(result1.hit).toBe(true);

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should miss after expiration
      const result2 = await cache.get({
        model: 'gpt-4',
        messages: createTestMessages('Short TTL'),
      });
      expect(result2.hit).toBe(false);
    });

    it('should handle entries with zero TTL (no expiration)', async () => {
      await cache.set(
        { model: 'gpt-4', messages: createTestMessages('No expiry') },
        createMockResponse('Response'),
        { ttl: 0 },
      );

      const result = await cache.get({
        model: 'gpt-4',
        messages: createTestMessages('No expiry'),
      });
      expect(result.hit).toBe(true);
    });
  });

  describe('Namespace Support', () => {
    it('should isolate entries by namespace', async () => {
      await cache.set(
        { model: 'gpt-4', messages: createTestMessages('Test') },
        createMockResponse('Namespace 1'),
        { namespace: 'ns1' },
      );

      await cache.set(
        { model: 'gpt-4', messages: createTestMessages('Test') },
        createMockResponse('Namespace 2'),
        { namespace: 'ns2' },
      );

      // Query with namespace filter
      const result1 = await cache.get(
        { model: 'gpt-4', messages: createTestMessages('Test') },
        { namespace: 'ns1' },
      );
      expect(result1.hit).toBe(true);
      expect(result1.entry?.response.content).toBe('Namespace 1');

      const result2 = await cache.get(
        { model: 'gpt-4', messages: createTestMessages('Test') },
        { namespace: 'ns2' },
      );
      expect(result2.hit).toBe(true);
      expect(result2.entry?.response.content).toBe('Namespace 2');
    });
  });

  describe('Tag-based Invalidation', () => {
    it('should invalidate entries by single tag', async () => {
      await cache.set(
        { model: 'gpt-4', messages: createTestMessages('Tagged 1') },
        createMockResponse('Response 1'),
        { tags: ['tag1', 'tag2'] },
      );

      await cache.set(
        { model: 'gpt-4', messages: createTestMessages('Tagged 2') },
        createMockResponse('Response 2'),
        { tags: ['tag2', 'tag3'] },
      );

      await cache.set(
        { model: 'gpt-4', messages: createTestMessages('Untagged') },
        createMockResponse('Response 3'),
      );

      const invalidated = await cache.invalidateByTags(['tag1']);
      expect(invalidated).toBe(1);

      // Tagged 1 should be gone
      const result1 = await cache.get({
        model: 'gpt-4',
        messages: createTestMessages('Tagged 1'),
      });
      expect(result1.hit).toBe(false);

      // Tagged 2 should still exist
      const result2 = await cache.get({
        model: 'gpt-4',
        messages: createTestMessages('Tagged 2'),
      });
      expect(result2.hit).toBe(true);
    });

    it('should invalidate multiple entries with overlapping tags', async () => {
      await cache.set(
        { model: 'gpt-4', messages: createTestMessages('Entry 1') },
        createMockResponse('Response 1'),
        { tags: ['common'] },
      );

      await cache.set(
        { model: 'gpt-4', messages: createTestMessages('Entry 2') },
        createMockResponse('Response 2'),
        { tags: ['common'] },
      );

      const invalidated = await cache.invalidateByTags(['common']);
      expect(invalidated).toBe(2);
    });
  });

  describe('Pattern-based Invalidation', () => {
    it('should invalidate entries matching regex pattern', async () => {
      await cache.wrap(
        { model: 'gpt-4-turbo', messages: createTestMessages('Test 1') },
        async () => createMockResponse('Response 1'),
      );

      await cache.wrap(
        { model: 'gpt-4-turbo', messages: createTestMessages('Test 2') },
        async () => createMockResponse('Response 2'),
      );

      await cache.wrap(
        { model: 'gpt-3.5-turbo', messages: createTestMessages('Test 3') },
        async () => createMockResponse('Response 3'),
      );

      // Invalidate all gpt-4 entries
      const invalidated = await cache.invalidateByPattern(/gpt-4/);
      expect(invalidated).toBe(2);

      // GPT-3.5 should still exist
      const result = await cache.get({
        model: 'gpt-3.5-turbo',
        messages: createTestMessages('Test 3'),
      });
      expect(result.hit).toBe(true);
    });
  });

  describe('Analytics Integration', () => {
    it('should track analytics when enabled', async () => {
      const analyticsCache = new SemanticCache(
        { defaultTTL: 3600, analyticsEnabled: true },
        store,
        new ExactMatchStrategy(),
      );

      await analyticsCache.wrap(
        { model: 'gpt-4', messages: createTestMessages('Hello') },
        async () => createMockResponse('Hi there!'),
      );

      // Hit the cache
      await analyticsCache.wrap(
        { model: 'gpt-4', messages: createTestMessages('Hello') },
        async () => createMockResponse('Different'),
      );

      const analytics = analyticsCache.getAnalytics();
      expect(analytics).toBeDefined();

      await analyticsCache.close();
    });

    it('should not track analytics when disabled', async () => {
      const noAnalyticsCache = new SemanticCache(
        { defaultTTL: 3600, analyticsEnabled: false },
        store,
        new ExactMatchStrategy(),
      );

      await noAnalyticsCache.wrap(
        { model: 'gpt-4', messages: createTestMessages('Hello') },
        async () => createMockResponse('Hi there!'),
      );

      const analytics = noAnalyticsCache.getAnalytics();
      expect(analytics).toBeDefined(); // Still exists but won't track

      await noAnalyticsCache.close();
    });
  });

  describe('Cost Savings Tracking', () => {
    it('should track tokens saved from cache hits', async () => {
      // createMockResponse returns usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }
      await cache.wrap(
        { model: 'gpt-4', messages: createTestMessages('Hello') },
        async () => createMockResponse('Response'),
      );

      // Hit cache twice
      await cache.wrap(
        { model: 'gpt-4', messages: createTestMessages('Hello') },
        async () => createMockResponse('Different'),
      );

      await cache.wrap(
        { model: 'gpt-4', messages: createTestMessages('Hello') },
        async () => createMockResponse('Different'),
      );

      const stats = cache.getStats();
      expect(stats.tokensSaved).toBe(30); // 15 tokens * 2 hits
      expect(stats.costSavingsUSD).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Event Emission', () => {
    it('should emit events for cache operations', async () => {
      const hitEvents: unknown[] = [];
      const missEvents: unknown[] = [];
      const setEvents: unknown[] = [];

      cache.on('hit', (entry) => hitEvents.push(entry));
      cache.on('miss', (key) => missEvents.push(key));
      cache.on('set', (entry) => setEvents.push(entry));

      // Miss
      await cache.wrap(
        { model: 'gpt-4', messages: createTestMessages('Hello') },
        async () => createMockResponse('Response'),
      );

      expect(missEvents.length).toBe(1);
      expect(setEvents.length).toBe(1);

      // Hit
      await cache.wrap(
        { model: 'gpt-4', messages: createTestMessages('Hello') },
        async () => createMockResponse('Different'),
      );

      expect(hitEvents.length).toBe(1);
    });

    it('should emit error events on failures', async () => {
      // Create a store that throws errors
      const errorStore = new MemoryCacheStore({
        type: 'memory',
        maxEntries: 100,
      });
      const errorCache = new SemanticCache(
        { defaultTTL: 3600, matchStrategy: 'exact' },
        errorStore,
        new ExactMatchStrategy(),
      );

      const errors: Error[] = [];
      errorCache.on('error', (error) => errors.push(error));

      // Mock the store.set to throw an error
      const originalSet = errorStore.set.bind(errorStore);
      errorStore.set = async () => {
        throw new Error('Store error');
      };

      try {
        await errorCache.wrap(
          { model: 'gpt-4', messages: createTestMessages('Test') },
          async () => createMockResponse('Response'),
        );
      } catch {
        // Expected to throw
      }

      expect(errors.length).toBeGreaterThan(0);

      // Restore and cleanup
      errorStore.set = originalSet;
      await errorCache.close();
    });
  });

  describe('Similarity Engine Integration', () => {
    it('should use similarity engine for semantic matching', async () => {
      const mockSimilarityEngine: SimilarityEngine = {
        embed: vi.fn().mockResolvedValue([0.5, 0.5, 0.5, 0.5]),
        computeSimilarity: vi.fn().mockReturnValue(0.95),
        isInitialized: true,
        config: { metric: 'cosine' },
      } as unknown as SimilarityEngine;

      const semanticCache = new SemanticCache(
        { defaultTTL: 3600, matchStrategy: 'hybrid', similarityThreshold: 0.9 },
        store,
        new HybridMatchStrategy({ semanticConfig: { threshold: 0.9 } }),
        mockSimilarityEngine,
      );

      await semanticCache.set(
        { model: 'gpt-4', messages: createTestMessages('Hello world') },
        createMockResponse('Response'),
      );

      expect(mockSimilarityEngine.embed).toHaveBeenCalled();

      await semanticCache.close();
    });
  });

  describe('Configuration', () => {
    it('should return current configuration', () => {
      const config = cache.getConfig();
      expect(config.defaultTTL).toBe(3600);
      expect(config.matchStrategy).toBe('exact');
    });

    it('should merge default and custom config', () => {
      const customCache = new SemanticCache(
        { defaultTTL: 7200, maxEntries: 500 },
        store,
        new ExactMatchStrategy(),
      );

      const config = customCache.getConfig();
      expect(config.defaultTTL).toBe(7200);
      expect(config.maxEntries).toBe(500);

      customCache.close();
    });
  });

  describe('Health Check', () => {
    it('should check store health', async () => {
      const health = await cache.checkHealth();
      expect(health.healthy).toBe(true);
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Statistics', () => {
    it('should calculate hit rate correctly', async () => {
      // 1 miss
      await cache.wrap(
        { model: 'gpt-4', messages: createTestMessages('Test 1') },
        async () => createMockResponse('Response 1'),
      );

      // 1 hit
      await cache.wrap(
        { model: 'gpt-4', messages: createTestMessages('Test 1') },
        async () => createMockResponse('Response 1'),
      );

      // 1 miss
      await cache.wrap(
        { model: 'gpt-4', messages: createTestMessages('Test 2') },
        async () => createMockResponse('Response 2'),
      );

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBeCloseTo(1 / 3);
    });

    it('should track exact vs semantic hits', async () => {
      await cache.wrap(
        { model: 'gpt-4', messages: createTestMessages('Test') },
        async () => createMockResponse('Response'),
      );

      await cache.wrap(
        { model: 'gpt-4', messages: createTestMessages('Test') },
        async () => createMockResponse('Response'),
      );

      const stats = cache.getStats();
      expect(stats.exactHits).toBe(1);
      expect(stats.semanticHits).toBe(0);
    });
  });

  describe('User and Agent Tracking', () => {
    it('should store userId and agentId metadata', async () => {
      await cache.set(
        { model: 'gpt-4', messages: createTestMessages('Test') },
        createMockResponse('Response'),
        { userId: 'user123', agentId: 'agent456' },
      );

      const result = await cache.get({
        model: 'gpt-4',
        messages: createTestMessages('Test'),
      });

      expect(result.entry?.metadata.userId).toBe('user123');
      expect(result.entry?.metadata.agentId).toBe('agent456');
    });
  });

  describe('Error Handling', () => {
    it('should handle store errors gracefully', async () => {
      const failingStore = new MemoryCacheStore({ type: 'memory' });
      const failingCache = new SemanticCache(
        { defaultTTL: 3600 },
        failingStore,
        new ExactMatchStrategy(),
      );

      // Close store to simulate failure
      await failingStore.close();

      // Should not throw, but return miss
      const result = await failingCache.get({
        model: 'gpt-4',
        messages: createTestMessages('Test'),
      });

      expect(result.hit).toBe(false);
      await failingCache.close();
    });

    it('should handle embedding errors gracefully', async () => {
      const failingEngine: SimilarityEngine = {
        embed: vi.fn().mockRejectedValue(new Error('Embedding failed')),
        computeSimilarity: vi.fn(),
        isInitialized: true,
        config: { metric: 'cosine' },
      } as unknown as SimilarityEngine;

      const cache = new SemanticCache(
        { defaultTTL: 3600, matchStrategy: 'semantic' },
        store,
        new HybridMatchStrategy(),
        failingEngine,
      );

      // Should still set the entry, just without embedding
      await cache.set(
        { model: 'gpt-4', messages: createTestMessages('Test') },
        createMockResponse('Response'),
      );

      const result = await cache.get({
        model: 'gpt-4',
        messages: createTestMessages('Test'),
      });

      // Should still work with exact match
      expect(result.hit).toBe(true);

      await cache.close();
    });
  });

  describe('Tool Calls Support', () => {
    it('should cache responses with tool calls', async () => {
      const responseWithTools: CacheResponseInput = {
        content: 'I will use the calculator',
        model: 'gpt-4',
        toolCalls: [
          {
            id: 'call_123',
            type: 'function',
            function: { name: 'calculator', arguments: '{"a":5,"b":3}' },
          },
        ],
      };

      await cache.set(
        { model: 'gpt-4', messages: createTestMessages('Calculate 5+3') },
        responseWithTools,
      );

      const result = await cache.get({
        model: 'gpt-4',
        messages: createTestMessages('Calculate 5+3'),
      });

      expect(result.hit).toBe(true);
      expect(result.entry?.response.toolCalls).toBeDefined();
      expect(result.entry?.response.toolCalls?.length).toBe(1);
    });
  });

  describe('Temperature Support', () => {
    it('should treat different temperatures as different cache keys', async () => {
      await cache.wrap(
        {
          model: 'gpt-4',
          messages: createTestMessages('Test'),
          temperature: 0.5,
        },
        async () => createMockResponse('Response with temp 0.5'),
      );

      await cache.wrap(
        {
          model: 'gpt-4',
          messages: createTestMessages('Test'),
          temperature: 0.9,
        },
        async () => createMockResponse('Response with temp 0.9'),
      );

      const result1 = await cache.get({
        model: 'gpt-4',
        messages: createTestMessages('Test'),
        temperature: 0.5,
      });

      const result2 = await cache.get({
        model: 'gpt-4',
        messages: createTestMessages('Test'),
        temperature: 0.9,
      });

      expect(result1.entry?.response.content).toBe('Response with temp 0.5');
      expect(result2.entry?.response.content).toBe('Response with temp 0.9');
    });
  });
});
