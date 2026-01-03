/**
 * BaseMatchStrategy
 *
 * Abstract base class for cache matching strategies.
 */

import type {
  CacheLookupResult,
  MatchOptions,
  MatchRequest,
  MatchStrategyType,
} from '../types/index.js';
import type { BaseCacheStore } from '../stores/BaseCacheStore.js';
import type { SimilarityEngine } from '../similarity/SimilarityEngine.js';

/**
 * Abstract match strategy
 *
 * All matching strategies must extend this class and implement
 * the match method for their specific matching algorithm.
 */
export abstract class BaseMatchStrategy {
  /** Strategy name/type */
  abstract readonly name: MatchStrategyType;

  /**
   * Match a request against the cache
   *
   * @param request - The request to match
   * @param store - The cache store to search
   * @param similarity - Optional similarity engine for semantic matching
   * @param options - Match options
   * @returns The lookup result
   */
  abstract match(
    request: MatchRequest,
    store: BaseCacheStore,
    similarity?: SimilarityEngine,
    options?: MatchOptions,
  ): Promise<CacheLookupResult>;
}
