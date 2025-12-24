/**
 * CacheMiddleware
 *
 * Middleware for integrating semantic cache with AgentSea agents.
 */

import type { SemanticCache } from '../../core/SemanticCache.js';
import type { CacheMessage, WrapOptions } from '../../types/index.js';

/**
 * Middleware request
 */
export interface MiddlewareRequest {
  model: string;
  messages: CacheMessage[];
  temperature?: number;
  maxTokens?: number;
  tools?: unknown[];
  [key: string]: unknown;
}

/**
 * Middleware response
 */
export interface MiddlewareResponse {
  content: string;
  model: string;
  finishReason?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  toolCalls?: unknown[];
  [key: string]: unknown;
}

/**
 * Next function in middleware chain
 */
export type MiddlewareNext = (
  request: MiddlewareRequest,
) => Promise<MiddlewareResponse>;

/**
 * Middleware configuration
 */
export interface CacheMiddlewareConfig {
  /** Cache instance */
  cache: SemanticCache;
  /** Skip cache for specific models */
  skipModels?: string[];
  /** Skip cache for tool-using requests */
  skipToolRequests?: boolean;
  /** Default TTL for cached entries */
  defaultTTL?: number;
  /** Tag prefix for cached entries */
  tagPrefix?: string;
  /** User ID extractor */
  getUserId?: (request: MiddlewareRequest) => string | undefined;
  /** Agent ID extractor */
  getAgentId?: (request: MiddlewareRequest) => string | undefined;
  /** Custom key generator */
  keyGenerator?: (request: MiddlewareRequest) => string;
}

/**
 * CacheMiddleware
 *
 * Middleware that adds semantic caching to LLM requests.
 *
 * @example
 * ```typescript
 * const middleware = new CacheMiddleware({
 *   cache: semanticCache,
 *   skipToolRequests: true
 * });
 *
 * // Use in agent pipeline
 * const response = await middleware.handle(request, next);
 * ```
 */
export class CacheMiddleware {
  private config: CacheMiddlewareConfig;

  constructor(config: CacheMiddlewareConfig) {
    this.config = config;
  }

  /**
   * Handle a request with caching
   */
  async handle(
    request: MiddlewareRequest,
    next: MiddlewareNext,
  ): Promise<MiddlewareResponse> {
    // Check if we should skip caching
    if (this.shouldSkip(request)) {
      return next(request);
    }

    const options = this.buildOptions(request);

    // Use cache.wrap to handle caching transparently
    return this.config.cache.wrap(
      {
        model: request.model,
        messages: request.messages,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
      },
      async () => {
        const response = await next(request);
        return {
          content: response.content,
          model: response.model,
          finishReason: response.finishReason ?? 'stop',
          usage: response.usage,
        };
      },
      options,
    );
  }

  /**
   * Create express-style middleware function
   */
  middleware(): (
    request: MiddlewareRequest,
    next: MiddlewareNext,
  ) => Promise<MiddlewareResponse> {
    return (request, next) => this.handle(request, next);
  }

  /**
   * Update configuration
   */
  configure(config: Partial<CacheMiddlewareConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get the underlying cache instance
   */
  getCache(): SemanticCache {
    return this.config.cache;
  }

  private shouldSkip(request: MiddlewareRequest): boolean {
    // Skip if model is in skip list
    if (this.config.skipModels?.includes(request.model)) {
      return true;
    }

    // Skip if request has tools and skipToolRequests is enabled
    if (this.config.skipToolRequests && request.tools?.length) {
      return true;
    }

    return false;
  }

  private buildOptions(request: MiddlewareRequest): WrapOptions {
    const options: WrapOptions = {};

    if (this.config.defaultTTL !== undefined) {
      options.ttl = this.config.defaultTTL;
    }

    if (this.config.tagPrefix) {
      options.tags = [`${this.config.tagPrefix}:${request.model}`];
    }

    if (this.config.getUserId) {
      options.userId = this.config.getUserId(request);
    }

    if (this.config.getAgentId) {
      options.agentId = this.config.getAgentId(request);
    }

    return options;
  }
}

/**
 * Create a CacheMiddleware instance
 */
export function createCacheMiddleware(
  config: CacheMiddlewareConfig,
): CacheMiddleware {
  return new CacheMiddleware(config);
}
