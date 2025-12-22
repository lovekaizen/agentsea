/**
 * SemanticCache
 *
 * Main semantic caching class for LLM responses.
 * Supports exact match, semantic match, and hybrid strategies.
 */

import { EventEmitter } from 'eventemitter3';
import type {
  SemanticCacheConfig,
  CacheEntry,
  CacheLookupResult,
  CacheStats,
  WrapOptions,
  CacheMessage,
  StoreHealth,
} from '../types/index.js';
import type { BaseCacheStore } from '../stores/BaseCacheStore.js';
import type { BaseMatchStrategy } from '../strategies/BaseMatchStrategy.js';
import type { SimilarityEngine } from '../similarity/SimilarityEngine.js';
import { CacheAnalytics } from '../analytics/CacheAnalytics.js';
import { generateCacheKey, extractUserMessage } from './CacheKey.js';
import { generateId, now, isExpired } from './utils.js';

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<SemanticCacheConfig> = {
  defaultTTL: 3600,
  similarityThreshold: 0.92,
  maxEntries: 10000,
  maxSizeBytes: 1024 * 1024 * 1024, // 1GB
  keyPrefix: 'llm-cache',
  matchStrategy: 'hybrid',
  analyticsEnabled: true,
  namespace: 'default',
  cacheKeyFields: ['model', 'messages'],
  normalizeWhitespace: true,
};

/**
 * Events emitted by SemanticCache
 */
export interface SemanticCacheEvents {
  hit: (entry: CacheEntry, similarity: number) => void;
  miss: (key: string, reason: string) => void;
  set: (entry: CacheEntry) => void;
  delete: (key: string) => void;
  evict: (entry: CacheEntry, reason: string) => void;
  error: (error: Error, context: string) => void;
}

/**
 * Request type for wrap operations
 */
export interface CacheRequest {
  model: string;
  messages: CacheMessage[];
  temperature?: number;
  maxTokens?: number;
  tools?: unknown[];
}

/**
 * Response type for wrap operations
 */
export interface CacheResponseInput {
  content: string;
  model?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
  toolCalls?: unknown[];
}

/**
 * SemanticCache
 *
 * @example
 * ```typescript
 * import { SemanticCache, MemoryCacheStore, HybridMatchStrategy } from '@lov3kaizen/agentsea-cache';
 *
 * const cache = new SemanticCache(
 *   { defaultTTL: 3600, similarityThreshold: 0.92 },
 *   new MemoryCacheStore({ type: 'memory' }),
 *   new HybridMatchStrategy()
 * );
 *
 * // Wrap an LLM call
 * const response = await cache.wrap(
 *   { model: 'gpt-4', messages: [{ role: 'user', content: 'Hello' }] },
 *   async (req) => llm.chat(req)
 * );
 * ```
 */
export class SemanticCache extends EventEmitter<SemanticCacheEvents> {
  private readonly config: Required<SemanticCacheConfig>;
  private readonly store: BaseCacheStore;
  private readonly strategy: BaseMatchStrategy;
  private readonly similarity?: SimilarityEngine;
  private readonly analytics: CacheAnalytics;
  private stats: CacheStats;

  constructor(
    config: Partial<SemanticCacheConfig>,
    store: BaseCacheStore,
    strategy: BaseMatchStrategy,
    similarity?: SimilarityEngine,
  ) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.store = store;
    this.strategy = strategy;
    this.similarity = similarity;
    this.analytics = new CacheAnalytics({
      enabled: this.config.analyticsEnabled,
    });
    this.stats = this.createInitialStats();
  }

  private createInitialStats(): CacheStats {
    return {
      entries: 0,
      sizeBytes: 0,
      hits: 0,
      misses: 0,
      hitRate: 0,
      exactHits: 0,
      semanticHits: 0,
      avgSimilarity: 0,
      avgLatencyMs: 0,
      costSavingsUSD: 0,
      tokensSaved: 0,
    };
  }

  /**
   * Wrap an LLM call with caching
   *
   * @param request - The LLM request
   * @param fn - Function to call on cache miss
   * @param options - Cache options
   * @returns The response (cached or fresh)
   */
  async wrap<T extends CacheResponseInput>(
    request: CacheRequest,
    fn: (req: CacheRequest) => Promise<T>,
    options?: WrapOptions,
  ): Promise<T & { _cache?: { hit: boolean; similarity?: number } }> {
    const startTime = performance.now();

    // Skip cache if requested
    if (options?.skipCache) {
      const response = await fn(request);
      return { ...response, _cache: { hit: false } };
    }

    // Try to get from cache
    const lookupResult = await this.get(request, options);

    if (lookupResult.hit && lookupResult.entry && !options?.forceRefresh) {
      this.emit('hit', lookupResult.entry, lookupResult.similarity ?? 1);
      this.stats.hits++;
      this.updateStats('hit', lookupResult);

      // Track analytics
      if (this.config.analyticsEnabled) {
        this.analytics.recordHit(
          lookupResult.entry,
          lookupResult.source === 'exact' ? 'exact' : 'semantic',
          lookupResult.latencyMs,
        );
      }

      return {
        ...lookupResult.entry.response,
        _cache: {
          hit: true,
          similarity: lookupResult.similarity,
        },
      } as T & { _cache: { hit: boolean; similarity?: number } };
    }

    // Cache miss - execute function
    const key = generateCacheKey(request.model, request.messages, {
      normalizeWhitespace: this.config.normalizeWhitespace,
    });
    this.emit('miss', key, lookupResult.source);
    this.stats.misses++;

    // Track miss in analytics
    if (this.config.analyticsEnabled) {
      this.analytics.recordMiss(performance.now() - startTime);
    }

    try {
      const response = await fn(request);

      // Store in cache
      await this.set(request, response, options);

      return { ...response, _cache: { hit: false } };
    } catch (error) {
      this.emit('error', error as Error, 'wrap');
      throw error;
    }
  }

  /**
   * Get an entry from cache
   *
   * @param request - The request to look up
   * @param options - Lookup options
   * @returns The lookup result
   */
  async get(
    request: CacheRequest,
    options?: WrapOptions,
  ): Promise<CacheLookupResult> {
    const startTime = performance.now();

    try {
      // Use the configured match strategy
      const result = await this.strategy.match(
        {
          model: request.model,
          messages: request.messages,
          temperature: request.temperature,
        },
        this.store,
        this.similarity,
        {
          threshold: this.config.similarityThreshold,
          namespace: options?.namespace ?? this.config.namespace,
        },
      );

      // Check TTL expiration
      if (result.hit && result.entry) {
        if (
          isExpired(result.entry.metadata.createdAt, result.entry.metadata.ttl)
        ) {
          // Entry expired, delete it
          await this.store.delete(result.entry.key);
          return {
            hit: false,
            latencyMs: performance.now() - startTime,
            source: 'miss',
          };
        }
      }

      return {
        ...result,
        latencyMs: performance.now() - startTime,
      };
    } catch (error) {
      this.emit('error', error as Error, 'get');
      return {
        hit: false,
        latencyMs: performance.now() - startTime,
        source: 'miss',
      };
    }
  }

  /**
   * Set an entry in cache
   *
   * @param request - The request
   * @param response - The response to cache
   * @param options - Cache options
   */
  async set(
    request: CacheRequest,
    response: CacheResponseInput,
    options?: WrapOptions,
  ): Promise<void> {
    const key = generateCacheKey(request.model, request.messages, {
      normalizeWhitespace: this.config.normalizeWhitespace,
    });

    // Generate embedding if semantic matching is enabled and similarity engine is available
    let embedding: number[] | undefined;
    if (this.similarity && this.config.matchStrategy !== 'exact') {
      try {
        const userMessage = extractUserMessage(request.messages);
        if (userMessage) {
          embedding = await this.similarity.embed(userMessage);
        }
      } catch (error) {
        this.emit('error', error as Error, 'embedding');
        // Continue without embedding
      }
    }

    const entry: CacheEntry = {
      id: generateId('entry'),
      key,
      embedding,
      request: {
        model: request.model,
        messages: request.messages,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        tools: request.tools,
      },
      response: {
        content: response.content,
        model: response.model ?? request.model,
        usage: response.usage ?? {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
        finishReason: response.finishReason ?? 'stop',
        toolCalls: response.toolCalls,
      },
      metadata: {
        createdAt: now(),
        accessedAt: now(),
        accessCount: 0,
        ttl: options?.ttl ?? this.config.defaultTTL,
        hitCount: 0,
        tags: options?.tags,
        namespace: options?.namespace ?? this.config.namespace,
        userId: options?.userId,
        agentId: options?.agentId,
      },
    };

    try {
      await this.store.set(key, entry);
      this.emit('set', entry);
      this.stats.entries++;

      // Track analytics
      if (this.config.analyticsEnabled) {
        this.analytics.recordSet(entry);
      }
    } catch (error) {
      this.emit('error', error as Error, 'set');
      throw error;
    }
  }

  /**
   * Delete an entry from cache
   *
   * @param key - The cache key to delete
   * @returns Whether the entry was deleted
   */
  async delete(key: string): Promise<boolean> {
    const deleted = await this.store.delete(key);
    if (deleted) {
      this.emit('delete', key);
      this.stats.entries = Math.max(0, this.stats.entries - 1);
    }
    return deleted;
  }

  /**
   * Clear all entries from cache
   */
  async clear(): Promise<void> {
    await this.store.clear();
    this.stats = this.createInitialStats();
    this.analytics.reset();
  }

  /**
   * Invalidate entries by pattern
   *
   * @param pattern - Regex pattern to match keys
   * @returns Number of entries invalidated
   */
  async invalidateByPattern(pattern: RegExp): Promise<number> {
    const keys = await this.store.keys();
    let count = 0;

    for (const key of keys) {
      if (pattern.test(key)) {
        await this.store.delete(key);
        count++;
      }
    }

    this.stats.entries = Math.max(0, this.stats.entries - count);
    return count;
  }

  /**
   * Invalidate entries by tags
   *
   * @param tags - Tags to match
   * @returns Number of entries invalidated
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    const keys = await this.store.keys();
    let count = 0;

    for (const key of keys) {
      const entry = await this.store.get(key);
      if (entry?.metadata.tags?.some((t) => tags.includes(t))) {
        await this.store.delete(key);
        count++;
      }
    }

    this.stats.entries = Math.max(0, this.stats.entries - count);
    return count;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    this.updateHitRate();
    return { ...this.stats };
  }

  /**
   * Get analytics instance
   */
  getAnalytics(): CacheAnalytics {
    return this.analytics;
  }

  /**
   * Get configuration
   */
  getConfig(): Readonly<SemanticCacheConfig> {
    return { ...this.config };
  }

  /**
   * Check store health
   */
  async checkHealth(): Promise<StoreHealth> {
    return this.store.checkHealth();
  }

  /**
   * Close the cache and release resources
   */
  async close(): Promise<void> {
    await this.store.close();
    this.removeAllListeners();
  }

  private updateStats(type: 'hit' | 'miss', result?: CacheLookupResult): void {
    if (type === 'hit' && result) {
      if (result.source === 'exact') {
        this.stats.exactHits++;
      } else if (result.source === 'semantic') {
        this.stats.semanticHits++;
        if (result.similarity) {
          // Update running average
          const total = this.stats.exactHits + this.stats.semanticHits;
          this.stats.avgSimilarity =
            (this.stats.avgSimilarity * (total - 1) + result.similarity) /
            total;
        }
      }

      // Calculate cost savings
      if (result.entry?.response.usage) {
        this.stats.tokensSaved += result.entry.response.usage.totalTokens;
        // Rough cost estimate: $0.01 per 1K tokens (average across models)
        this.stats.costSavingsUSD +=
          (result.entry.response.usage.totalTokens / 1000) * 0.01;
      }
    }

    this.updateHitRate();
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}

/**
 * Create a SemanticCache instance
 */
export function createSemanticCache(
  config: Partial<SemanticCacheConfig>,
  store: BaseCacheStore,
  strategy: BaseMatchStrategy,
  similarity?: SimilarityEngine,
): SemanticCache {
  return new SemanticCache(config, store, strategy, similarity);
}
