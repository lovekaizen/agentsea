/**
 * GatewayCache
 *
 * Cache layer for LLM Gateway integration.
 */

import EventEmitter from 'eventemitter3';
import type { SemanticCache } from '../../core/SemanticCache.js';
import type { CacheMessage, CacheLookupResult } from '../../types/index.js';

/**
 * Gateway request format
 */
export interface GatewayRequest {
  /** Request ID */
  id: string;
  /** Target provider (e.g., 'openai', 'anthropic') */
  provider: string;
  /** Model name */
  model: string;
  /** Messages */
  messages: CacheMessage[];
  /** Temperature */
  temperature?: number;
  /** Max tokens */
  maxTokens?: number;
  /** Stream mode */
  stream?: boolean;
  /** Additional parameters */
  parameters?: Record<string, unknown>;
  /** Request metadata */
  metadata?: {
    userId?: string;
    agentId?: string;
    namespace?: string;
    [key: string]: unknown;
  };
}

/**
 * Gateway response format
 */
export interface GatewayResponse {
  /** Request ID */
  id: string;
  /** Provider used */
  provider: string;
  /** Model used */
  model: string;
  /** Response content */
  content: string;
  /** Finish reason */
  finishReason: string;
  /** Token usage */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Tool calls */
  toolCalls?: unknown[];
  /** Response metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Gateway cache events
 */
export interface GatewayCacheEvents {
  'cache:hit': (request: GatewayRequest, result: CacheLookupResult) => void;
  'cache:miss': (request: GatewayRequest) => void;
  'cache:set': (request: GatewayRequest, response: GatewayResponse) => void;
  'cache:error': (error: Error, request: GatewayRequest) => void;
}

/**
 * Gateway cache configuration
 */
export interface GatewayCacheConfig {
  /** Semantic cache instance */
  cache: SemanticCache;
  /** Enable caching */
  enabled?: boolean;
  /** Skip caching for streaming requests */
  skipStreaming?: boolean;
  /** Skip caching for specific providers */
  skipProviders?: string[];
  /** Skip caching for specific models */
  skipModels?: string[];
  /** Default TTL in seconds */
  defaultTTL?: number;
  /** Namespace for cache isolation */
  namespace?: string;
  /** Custom key generator */
  keyGenerator?: (request: GatewayRequest) => string;
}

/**
 * Gateway cache statistics
 */
export interface GatewayCacheStats {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  avgLatencyMs: number;
  byProvider: Record<string, { hits: number; misses: number }>;
  byModel: Record<string, { hits: number; misses: number }>;
}

/**
 * GatewayCache
 *
 * Cache layer for LLM Gateway requests.
 *
 * @example
 * ```typescript
 * const gatewayCache = new GatewayCache({
 *   cache: semanticCache,
 *   skipStreaming: true
 * });
 *
 * // Check cache before routing
 * const cached = await gatewayCache.get(request);
 * if (cached.hit) {
 *   return cached.response;
 * }
 *
 * // After getting response from provider
 * await gatewayCache.set(request, response);
 * ```
 */
export class GatewayCache extends EventEmitter<GatewayCacheEvents> {
  private cache: SemanticCache;
  private config: GatewayCacheConfig;
  private stats: GatewayCacheStats = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    hitRate: 0,
    avgLatencyMs: 0,
    byProvider: {},
    byModel: {},
  };
  private latencies: number[] = [];

  constructor(config: GatewayCacheConfig) {
    super();
    this.cache = config.cache;
    this.config = {
      enabled: true,
      skipStreaming: true,
      ...config,
    };
  }

  /**
   * Get cached response for a request
   */
  async get(request: GatewayRequest): Promise<{
    hit: boolean;
    response?: GatewayResponse;
    similarity?: number;
  }> {
    const startTime = performance.now();
    this.stats.totalRequests++;

    // Check if caching is disabled or should be skipped
    if (!this.shouldCache(request)) {
      this.stats.cacheMisses++;
      this.updateStats(request, false);
      return { hit: false };
    }

    try {
      const result = await this.cache.get({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
      });

      const latency = performance.now() - startTime;
      this.latencies.push(latency);

      if (result.hit && result.entry) {
        this.stats.cacheHits++;
        this.updateStats(request, true);

        const response: GatewayResponse = {
          id: request.id,
          provider: request.provider,
          model: result.entry.response.model,
          content: result.entry.response.content,
          finishReason: result.entry.response.finishReason,
          usage: result.entry.response.usage,
          metadata: {
            cached: true,
            cacheHit: result.source,
            similarity: result.similarity,
            cachedAt: result.entry.metadata.createdAt,
          },
        };

        this.emit('cache:hit', request, result);
        return { hit: true, response, similarity: result.similarity };
      }

      this.stats.cacheMisses++;
      this.updateStats(request, false);
      this.emit('cache:miss', request);
      return { hit: false };
    } catch (error) {
      this.emit('cache:error', error as Error, request);
      return { hit: false };
    }
  }

  /**
   * Cache a response
   */
  async set(request: GatewayRequest, response: GatewayResponse): Promise<void> {
    if (!this.shouldCache(request)) {
      return;
    }

    try {
      await this.cache.set(
        {
          model: request.model,
          messages: request.messages,
          temperature: request.temperature,
          maxTokens: request.maxTokens,
        },
        {
          content: response.content,
          model: response.model,
          finishReason: response.finishReason,
          usage: response.usage,
        },
        {
          ttl: this.config.defaultTTL,
          namespace: this.config.namespace ?? request.metadata?.namespace,
          userId: request.metadata?.userId,
          agentId: request.metadata?.agentId,
        },
      );

      this.emit('cache:set', request, response);
    } catch (error) {
      this.emit('cache:error', error as Error, request);
    }
  }

  /**
   * Invalidate cache entries matching criteria
   */
  async invalidate(criteria: {
    provider?: string;
    model?: string;
    namespace?: string;
    olderThan?: number;
  }): Promise<number> {
    // For now, just clear all if criteria is empty
    // A more sophisticated implementation would filter entries
    if (!criteria.provider && !criteria.model && !criteria.namespace) {
      await this.cache.clear();
      return 0;
    }

    // This would need store-level support for filtered deletion
    // For now, return 0 indicating no entries removed
    return 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): GatewayCacheStats {
    return {
      ...this.stats,
      hitRate:
        this.stats.totalRequests > 0
          ? (this.stats.cacheHits / this.stats.totalRequests) * 100
          : 0,
      avgLatencyMs:
        this.latencies.length > 0
          ? this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length
          : 0,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      hitRate: 0,
      avgLatencyMs: 0,
      byProvider: {},
      byModel: {},
    };
    this.latencies = [];
  }

  /**
   * Check if caching is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled ?? true;
  }

  /**
   * Enable or disable caching
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * Get the underlying cache
   */
  getCache(): SemanticCache {
    return this.cache;
  }

  private shouldCache(request: GatewayRequest): boolean {
    // Check if disabled
    if (!this.config.enabled) {
      return false;
    }

    // Skip streaming requests
    if (this.config.skipStreaming && request.stream) {
      return false;
    }

    // Skip specific providers
    if (this.config.skipProviders?.includes(request.provider)) {
      return false;
    }

    // Skip specific models
    if (this.config.skipModels?.includes(request.model)) {
      return false;
    }

    return true;
  }

  private updateStats(request: GatewayRequest, hit: boolean): void {
    // Update provider stats
    if (!this.stats.byProvider[request.provider]) {
      this.stats.byProvider[request.provider] = { hits: 0, misses: 0 };
    }
    if (hit) {
      this.stats.byProvider[request.provider].hits++;
    } else {
      this.stats.byProvider[request.provider].misses++;
    }

    // Update model stats
    if (!this.stats.byModel[request.model]) {
      this.stats.byModel[request.model] = { hits: 0, misses: 0 };
    }
    if (hit) {
      this.stats.byModel[request.model].hits++;
    } else {
      this.stats.byModel[request.model].misses++;
    }

    // Update hit rate
    this.stats.hitRate =
      this.stats.totalRequests > 0
        ? (this.stats.cacheHits / this.stats.totalRequests) * 100
        : 0;

    // Update average latency
    if (this.latencies.length > 0) {
      this.stats.avgLatencyMs =
        this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length;
    }
  }
}

/**
 * Create a GatewayCache instance
 */
export function createGatewayCache(config: GatewayCacheConfig): GatewayCache {
  return new GatewayCache(config);
}
