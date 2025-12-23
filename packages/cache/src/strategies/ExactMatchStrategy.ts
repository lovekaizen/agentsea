/**
 * ExactMatchStrategy
 *
 * Hash-based exact matching strategy.
 * Uses murmurhash to generate cache keys for exact lookups.
 */

import { BaseMatchStrategy } from './BaseMatchStrategy.js';
import type {
  CacheLookupResult,
  MatchOptions,
  MatchRequest,
  MatchStrategyType,
  ExactMatchConfig,
} from '../types/index.js';
import type { BaseCacheStore } from '../stores/BaseCacheStore.js';
import type { SimilarityEngine } from '../similarity/SimilarityEngine.js';
import { generateCacheKey } from '../core/CacheKey.js';

/**
 * Default exact match configuration
 */
const DEFAULT_CONFIG: ExactMatchConfig = {
  normalizeWhitespace: true,
  hashFields: ['model', 'messages'],
};

/**
 * ExactMatchStrategy
 *
 * Matches requests by computing a hash of the request parameters.
 * This is the fastest matching strategy but only finds identical requests.
 *
 * @example
 * ```typescript
 * const strategy = new ExactMatchStrategy({
 *   normalizeWhitespace: true,
 *   hashFields: ['model', 'messages']
 * });
 *
 * const result = await strategy.match(request, store);
 * if (result.hit) {
 *   console.log('Exact match found:', result.entry);
 * }
 * ```
 */
export class ExactMatchStrategy extends BaseMatchStrategy {
  readonly name: MatchStrategyType = 'exact';
  private config: ExactMatchConfig;

  constructor(config?: Partial<ExactMatchConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async match(
    request: MatchRequest,
    store: BaseCacheStore,
    _similarity?: SimilarityEngine,
    options?: MatchOptions,
  ): Promise<CacheLookupResult> {
    const startTime = performance.now();

    // Generate cache key with namespace if provided for exact matching
    const namespace = options?.namespace;
    const baseKey = generateCacheKey(request.model, request.messages, {
      normalizeWhitespace: this.config.normalizeWhitespace,
      includeTemperature: this.config.hashFields?.includes('temperature'),
    });

    // Include temperature in key if specified (different temps = different cache entries)
    const tempSuffix =
      request.temperature !== undefined ? `:t:${request.temperature}` : '';
    // Include namespace in key for namespace isolation (matching SemanticCache.set behavior)
    const key =
      namespace && namespace !== 'default'
        ? `${baseKey}${tempSuffix}:ns:${namespace}`
        : `${baseKey}${tempSuffix}`;

    // Look up in store
    const entry = await store.get(key);

    if (entry) {
      // Verify namespace match if specified
      if (
        namespace &&
        entry.metadata.namespace &&
        entry.metadata.namespace !== namespace
      ) {
        return {
          hit: false,
          latencyMs: performance.now() - startTime,
          source: 'miss',
        };
      }

      return {
        hit: true,
        entry,
        similarity: 1.0, // Exact match = 100% similarity
        latencyMs: performance.now() - startTime,
        source: 'exact',
      };
    }

    return {
      hit: false,
      latencyMs: performance.now() - startTime,
      source: 'miss',
    };
  }
}

/**
 * Create an ExactMatchStrategy instance
 */
export function createExactMatchStrategy(
  config?: Partial<ExactMatchConfig>,
): ExactMatchStrategy {
  return new ExactMatchStrategy(config);
}
