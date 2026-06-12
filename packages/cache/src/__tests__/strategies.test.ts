/**
 * Strategy Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ExactMatchStrategy,
  SemanticMatchStrategy,
  HybridMatchStrategy,
} from '../strategies/index.js';
import { MemoryCacheStore } from '../stores/MemoryCacheStore.js';
import { generateCacheKey } from '../core/CacheKey.js';
import type { CacheEntry, MatchRequest } from '../types/index.js';
import type { SimilarityEngine } from '../similarity/SimilarityEngine.js';
import { generateId, now } from '../core/utils.js';

// Helper to create test entries
function createTestEntry(overrides: Partial<CacheEntry> = {}): CacheEntry {
  return {
    id: generateId(),
    key: 'test-key',
    request: {
      messages: [{ role: 'user', content: 'test message' }],
      model: 'gpt-5.5',
    },
    response: {
      content: 'test response',
      model: 'gpt-5.5',
      finishReason: 'stop',
    },
    metadata: {
      createdAt: now(),
      accessedAt: now(),
      accessCount: 1,
      ttl: 3600,
    },
    ...overrides,
  };
}

describe('ExactMatchStrategy', () => {
  let strategy: ExactMatchStrategy;
  let store: MemoryCacheStore;

  beforeEach(async () => {
    strategy = new ExactMatchStrategy();
    store = new MemoryCacheStore({ type: 'memory', maxSize: 100 });
  });

  it('returns hit for exact key match', async () => {
    // Create an entry and compute its key properly
    const messages = [{ role: 'user' as const, content: 'hello world' }];
    const model = 'gpt-5.5';
    const key = generateCacheKey(model, messages);

    const entry = createTestEntry({
      key,
      request: { messages, model },
    });
    await store.set(key, entry);

    const request: MatchRequest = {
      messages,
      model,
    };

    const result = await strategy.match(request, store);

    expect(result.hit).toBe(true);
    expect(result.entry).toBeDefined();
    expect(result.source).toBe('exact');
    expect(result.similarity).toBe(1.0);
  });

  it('returns miss for non-existent key', async () => {
    const request: MatchRequest = {
      messages: [{ role: 'user', content: 'test message' }],
      model: 'gpt-5.5',
    };

    const result = await strategy.match(request, store);

    expect(result.hit).toBe(false);
    expect(result.entry).toBeUndefined();
    expect(result.source).toBe('miss');
  });

  it('generates consistent keys', async () => {
    const messages = [{ role: 'user' as const, content: 'same message' }];
    const model = 'gpt-5.5';
    const key = generateCacheKey(model, messages);

    const entry = createTestEntry({
      key,
      request: { messages, model },
    });
    await store.set(key, entry);

    // Same request should hit
    const request1: MatchRequest = { messages, model };
    const result1 = await strategy.match(request1, store);
    expect(result1.hit).toBe(true);

    // Different message should miss
    const request2: MatchRequest = {
      messages: [{ role: 'user', content: 'different message' }],
      model,
    };
    const result2 = await strategy.match(request2, store);
    expect(result2.hit).toBe(false);
  });

  it('normalizes whitespace by default', async () => {
    const messages = [{ role: 'user' as const, content: 'hello world' }];
    const model = 'gpt-5.5';
    const key = generateCacheKey(model, messages, {
      normalizeWhitespace: true,
    });

    const entry = createTestEntry({
      key,
      request: { messages, model },
    });
    await store.set(key, entry);

    // Request with extra whitespace should still hit
    const request: MatchRequest = {
      messages: [{ role: 'user', content: 'hello  world' }],
      model,
    };

    const result = await strategy.match(request, store);
    expect(result.hit).toBe(true);
  });
});

describe('SemanticMatchStrategy', () => {
  let strategy: SemanticMatchStrategy;
  let store: MemoryCacheStore;
  let mockSimilarityEngine: SimilarityEngine;

  beforeEach(async () => {
    vi.clearAllMocks();
    strategy = new SemanticMatchStrategy({
      threshold: 0.8,
    });
    store = new MemoryCacheStore({ type: 'memory', maxSize: 100 });

    // Mock SimilarityEngine
    mockSimilarityEngine = {
      embed: vi.fn().mockImplementation(async (text: string) => {
        // Simple deterministic embedding based on text
        const dim = 8;
        const seed = text.length;
        return Array.from(
          { length: dim },
          (_, i) => Math.sin(seed + i) * 0.5 + 0.5,
        );
      }),
      computeSimilarity: vi
        .fn()
        .mockImplementation((a: number[], b: number[]) => {
          // Simple dot product / magnitude
          let dot = 0;
          let normA = 0;
          let normB = 0;
          for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
          }
          return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
        }),
      isInitialized: true,
      config: { metric: 'cosine' as const },
    } as unknown as SimilarityEngine;
  });

  it('returns miss when no similarity engine is provided', async () => {
    const entry = createTestEntry();
    await store.set('key-1', entry);

    const request: MatchRequest = {
      messages: [{ role: 'user', content: 'test' }],
      model: 'gpt-5.5',
    };

    const result = await strategy.match(request, store);

    expect(result.hit).toBe(false);
    expect(result.source).toBe('miss');
  });

  it('returns hit for similar embeddings', async () => {
    // Create entry with embedding
    const embedding = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
    const entry = createTestEntry({
      embedding,
      request: {
        messages: [{ role: 'user', content: 'hello' }],
        model: 'gpt-5.5',
      },
    });
    await store.set('key-1', entry);

    const request: MatchRequest = {
      messages: [{ role: 'user', content: 'hello' }],
      model: 'gpt-5.5',
    };

    // Mock embed to return similar embedding
    mockSimilarityEngine.embed = vi.fn().mockResolvedValue(embedding);

    const result = await strategy.match(request, store, mockSimilarityEngine);

    expect(result.hit).toBe(true);
    expect(result.source).toBe('semantic');
    expect(result.similarity).toBeGreaterThanOrEqual(0.8);
  });

  it('returns miss for dissimilar embeddings', async () => {
    const embedding = [1, 0, 0, 0, 0, 0, 0, 0];
    const entry = createTestEntry({
      embedding,
      request: {
        messages: [{ role: 'user', content: 'hello' }],
        model: 'gpt-5.5',
      },
    });
    await store.set('key-1', entry);

    const request: MatchRequest = {
      messages: [{ role: 'user', content: 'completely different' }],
      model: 'gpt-5.5',
    };

    // Return orthogonal embedding
    mockSimilarityEngine.embed = vi
      .fn()
      .mockResolvedValue([0, 0, 0, 0, 0, 0, 0, 1]);

    const result = await strategy.match(request, store, mockSimilarityEngine);

    expect(result.hit).toBe(false);
    expect(result.source).toBe('miss');
  });

  it('calls embedding provider', async () => {
    const embedding = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
    const entry = createTestEntry({ embedding });
    await store.set('key-1', entry);

    const request: MatchRequest = {
      messages: [{ role: 'user', content: 'test message' }],
      model: 'gpt-5.5',
    };

    mockSimilarityEngine.embed = vi.fn().mockResolvedValue(embedding);
    await strategy.match(request, store, mockSimilarityEngine);

    expect(mockSimilarityEngine.embed).toHaveBeenCalled();
  });

  it('respects similarity threshold', async () => {
    const strategyStrict = new SemanticMatchStrategy({
      threshold: 0.95, // Strict threshold
    });

    const embedding = [1, 0, 0, 0, 0, 0, 0, 0];
    const entry = createTestEntry({
      embedding,
      request: {
        messages: [{ role: 'user', content: 'hello' }],
        model: 'gpt-5.5',
      },
    });
    await store.set('key-1', entry);

    // Return somewhat different embedding (cosine similarity ~0.7)
    mockSimilarityEngine.embed = vi
      .fn()
      .mockResolvedValue([0.7, 0.7, 0, 0, 0, 0, 0, 0]);

    const request: MatchRequest = {
      messages: [{ role: 'user', content: 'hello world' }],
      model: 'gpt-5.5',
    };

    const result = await strategyStrict.match(
      request,
      store,
      mockSimilarityEngine,
    );

    // Should miss due to strict threshold (0.7 < 0.95)
    expect(result.hit).toBe(false);
  });
});

describe('HybridMatchStrategy', () => {
  let strategy: HybridMatchStrategy;
  let store: MemoryCacheStore;
  let mockSimilarityEngine: SimilarityEngine;

  beforeEach(async () => {
    vi.clearAllMocks();
    strategy = new HybridMatchStrategy({
      exactFirst: true,
      semanticConfig: { threshold: 0.8 },
    });
    store = new MemoryCacheStore({ type: 'memory', maxSize: 100 });

    mockSimilarityEngine = {
      embed: vi.fn().mockResolvedValue([0.5, 0.5, 0.5, 0.5]),
      computeSimilarity: vi.fn().mockReturnValue(0.9),
      isInitialized: true,
      config: { metric: 'cosine' as const },
    } as unknown as SimilarityEngine;
  });

  it('returns exact match if available', async () => {
    const messages = [{ role: 'user' as const, content: 'exact query' }];
    const model = 'gpt-5.5';
    const key = generateCacheKey(model, messages);

    const entry = createTestEntry({
      key,
      request: { messages, model },
    });
    await store.set(key, entry);

    const request: MatchRequest = {
      messages,
      model,
    };

    const result = await strategy.match(request, store, mockSimilarityEngine);

    expect(result.hit).toBe(true);
    expect(result.source).toBe('exact');
    expect(result.similarity).toBe(1.0);
  });

  it('falls back to semantic match if exact miss', async () => {
    const embedding = [0.5, 0.5, 0.5, 0.5];
    const entry = createTestEntry({
      key: 'other-key',
      embedding,
      request: {
        messages: [{ role: 'user', content: 'stored query' }],
        model: 'gpt-5.5',
      },
    });
    await store.set('other-key', entry);

    const request: MatchRequest = {
      messages: [{ role: 'user', content: 'similar query' }],
      model: 'gpt-5.5',
    };

    mockSimilarityEngine.embed = vi.fn().mockResolvedValue(embedding);

    const result = await strategy.match(request, store, mockSimilarityEngine);

    expect(result.hit).toBe(true);
    expect(result.source).toBe('semantic');
  });

  it('returns miss if both strategies miss', async () => {
    const request: MatchRequest = {
      messages: [{ role: 'user', content: 'test' }],
      model: 'gpt-5.5',
    };

    // Return embedding that won't match anything
    mockSimilarityEngine.embed = vi
      .fn()
      .mockResolvedValue([0.1, 0.2, 0.3, 0.4]);

    const result = await strategy.match(request, store, mockSimilarityEngine);

    expect(result.hit).toBe(false);
    expect(result.source).toBe('miss');
  });

  it('supports semantic-first mode', async () => {
    const semanticFirstStrategy = new HybridMatchStrategy({
      exactFirst: false,
      semanticConfig: { threshold: 0.8 },
    });

    const embedding = [0.5, 0.5, 0.5, 0.5];
    const entry = createTestEntry({
      key: 'key-1',
      embedding,
      request: {
        messages: [{ role: 'user', content: 'stored' }],
        model: 'gpt-5.5',
      },
    });
    await store.set('key-1', entry);

    const request: MatchRequest = {
      messages: [{ role: 'user', content: 'similar' }],
      model: 'gpt-5.5',
    };

    mockSimilarityEngine.embed = vi.fn().mockResolvedValue(embedding);

    const result = await semanticFirstStrategy.match(
      request,
      store,
      mockSimilarityEngine,
    );

    expect(result.hit).toBe(true);
    expect(result.source).toBe('semantic');
  });

  it('tracks latency', async () => {
    const request: MatchRequest = {
      messages: [{ role: 'user', content: 'test' }],
      model: 'gpt-5.5',
    };

    const result = await strategy.match(request, store);

    expect(result.latencyMs).toBeDefined();
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
