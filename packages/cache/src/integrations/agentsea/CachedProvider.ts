/**
 * CachedProvider
 *
 * Wrapper for LLM providers that adds semantic caching.
 */

import type { SemanticCache } from '../../core/SemanticCache.js';
import type { CacheMessage, WrapOptions } from '../../types/index.js';

/**
 * LLM Provider interface (compatible with AgentSea providers)
 */
export interface LLMProvider {
  /**
   * Generate a completion
   */
  complete(request: CompletionRequest): Promise<CompletionResponse>;

  /**
   * Generate a streaming completion
   */
  stream?(request: CompletionRequest): AsyncGenerator<StreamChunk>;
}

/**
 * Completion request
 */
export interface CompletionRequest {
  model: string;
  messages: CacheMessage[];
  temperature?: number;
  maxTokens?: number;
  tools?: unknown[];
  stream?: boolean;
  [key: string]: unknown;
}

/**
 * Completion response
 */
export interface CompletionResponse {
  content: string;
  model: string;
  finishReason: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  toolCalls?: unknown[];
}

/**
 * Stream chunk
 */
export interface StreamChunk {
  content?: string;
  finishReason?: string;
  toolCall?: unknown;
}

/**
 * Cached provider configuration
 */
export interface CachedProviderConfig {
  /** Underlying LLM provider */
  provider: LLMProvider;
  /** Semantic cache instance */
  cache: SemanticCache;
  /** Skip caching for certain models */
  skipModels?: string[];
  /** Default cache options */
  defaultOptions?: WrapOptions;
  /** Enable streaming cache */
  enableStreamingCache?: boolean;
}

/**
 * CachedProvider
 *
 * Wraps an LLM provider with semantic caching.
 *
 * @example
 * ```typescript
 * const cachedProvider = new CachedProvider({
 *   provider: anthropicProvider,
 *   cache: semanticCache
 * });
 *
 * // Uses cache transparently
 * const response = await cachedProvider.complete({
 *   model: 'claude-3-sonnet',
 *   messages: [{ role: 'user', content: 'Hello' }]
 * });
 * ```
 */
export class CachedProvider implements LLMProvider {
  private provider: LLMProvider;
  private cache: SemanticCache;
  private config: CachedProviderConfig;

  constructor(config: CachedProviderConfig) {
    this.provider = config.provider;
    this.cache = config.cache;
    this.config = config;
  }

  /**
   * Generate a completion with caching
   */
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    // Skip cache if model is in skip list
    if (this.config.skipModels?.includes(request.model)) {
      return this.provider.complete(request);
    }

    // Build cache options
    const options: WrapOptions = {
      ...this.config.defaultOptions,
    };

    // Use cache.wrap to handle caching
    return this.cache.wrap(
      {
        model: request.model,
        messages: request.messages,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
      },
      async () => {
        const response = await this.provider.complete(request);
        return {
          content: response.content,
          model: response.model,
          finishReason: response.finishReason,
          usage: response.usage,
        };
      },
      options,
    );
  }

  /**
   * Generate a streaming completion
   *
   * Note: Streaming responses are passed through without caching by default.
   * Set enableStreamingCache to true for experimental streaming cache support.
   */
  async *stream(request: CompletionRequest): AsyncGenerator<StreamChunk> {
    // Check if provider supports streaming
    if (!this.provider.stream) {
      throw new Error('Provider does not support streaming');
    }

    // For now, pass through streaming without caching
    // Streaming cache support would require StreamCache integration
    if (!this.config.enableStreamingCache) {
      yield* this.provider.stream(request);
      return;
    }

    // Experimental: Collect stream for caching
    const chunks: string[] = [];
    let finishReason = '';

    for await (const chunk of this.provider.stream(request)) {
      if (chunk.content) {
        chunks.push(chunk.content);
      }
      if (chunk.finishReason) {
        finishReason = chunk.finishReason;
      }
      yield chunk;
    }

    // Cache the complete response after stream ends
    try {
      await this.cache.set(
        {
          model: request.model,
          messages: request.messages,
          temperature: request.temperature,
          maxTokens: request.maxTokens,
        },
        {
          content: chunks.join(''),
          model: request.model,
          finishReason,
        },
      );
    } catch {
      // Silently ignore cache errors during streaming
    }
  }

  /**
   * Get the underlying provider
   */
  getProvider(): LLMProvider {
    return this.provider;
  }

  /**
   * Get the cache instance
   */
  getCache(): SemanticCache {
    return this.cache;
  }

  /**
   * Clear cache entries for this provider
   */
  async clearCache(): Promise<void> {
    await this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }
}

/**
 * Create a CachedProvider instance
 */
export function createCachedProvider(
  config: CachedProviderConfig,
): CachedProvider {
  return new CachedProvider(config);
}

/**
 * Helper to wrap any LLM provider with caching
 */
export function withCache(
  provider: LLMProvider,
  cache: SemanticCache,
  options?: Partial<CachedProviderConfig>,
): CachedProvider {
  return new CachedProvider({
    provider,
    cache,
    ...options,
  });
}
