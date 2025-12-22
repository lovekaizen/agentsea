/**
 * HybridMatchStrategy
 *
 * Combined exact + semantic matching strategy.
 * Tries exact match first, then falls back to semantic.
 */

import { BaseMatchStrategy } from './BaseMatchStrategy.js';
import { ExactMatchStrategy } from './ExactMatchStrategy.js';
import { SemanticMatchStrategy } from './SemanticMatchStrategy.js';
import type {
  CacheLookupResult,
  MatchOptions,
  MatchRequest,
  MatchStrategyType,
  HybridMatchConfig,
} from '../types/index.js';
import type { BaseCacheStore } from '../stores/BaseCacheStore.js';
import type { SimilarityEngine } from '../similarity/SimilarityEngine.js';

/**
 * Default hybrid match configuration
 */
const DEFAULT_CONFIG: HybridMatchConfig = {
  exact: {
    normalizeWhitespace: true,
    hashFields: ['model', 'messages'],
  },
  semantic: {
    threshold: 0.92,
    matchModel: true,
    topK: 5,
  },
};

/**
 * HybridMatchStrategy
 *
 * Combines exact and semantic matching for optimal performance.
 * - First tries exact hash match (fast, free)
 * - Falls back to semantic match if no exact match found
 * - Can be configured to use semantic only for certain patterns
 *
 * @example
 * ```typescript
 * const strategy = new HybridMatchStrategy({
 *   semantic: { threshold: 0.92 },
 *   semanticPatterns: [/what|how|why/i]
 * });
 *
 * const result = await strategy.match(request, store, similarity);
 * console.log('Match source:', result.source); // 'exact' or 'semantic'
 * ```
 */
export class HybridMatchStrategy extends BaseMatchStrategy {
  readonly name: MatchStrategyType = 'hybrid';

  private exact: ExactMatchStrategy;
  private semantic: SemanticMatchStrategy;
  private config: HybridMatchConfig;

  constructor(config?: Partial<HybridMatchConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.exact = new ExactMatchStrategy(this.config.exact);
    this.semantic = new SemanticMatchStrategy(this.config.semantic);
  }

  async match(
    request: MatchRequest,
    store: BaseCacheStore,
    similarity?: SimilarityEngine,
    options?: MatchOptions,
  ): Promise<CacheLookupResult> {
    const startTime = performance.now();

    // Check if this request should use exact-only matching
    if (this.shouldUseExactOnly(request)) {
      const result = await this.exact.match(
        request,
        store,
        similarity,
        options,
      );
      return {
        ...result,
        latencyMs: performance.now() - startTime,
      };
    }

    // Try exact match first (fast)
    const exactResult = await this.exact.match(
      request,
      store,
      similarity,
      options,
    );

    if (exactResult.hit) {
      return {
        ...exactResult,
        latencyMs: performance.now() - startTime,
      };
    }

    // Check if semantic matching should be used for this request
    if (!this.shouldUseSemantic(request)) {
      return {
        hit: false,
        latencyMs: performance.now() - startTime,
        source: 'miss',
      };
    }

    // Fall back to semantic match
    if (similarity) {
      const semanticResult = await this.semantic.match(
        request,
        store,
        similarity,
        options,
      );

      return {
        ...semanticResult,
        latencyMs: performance.now() - startTime,
      };
    }

    return {
      hit: false,
      latencyMs: performance.now() - startTime,
      source: 'miss',
    };
  }

  /**
   * Check if request should use exact-only matching
   */
  private shouldUseExactOnly(request: MatchRequest): boolean {
    if (!this.config.exactOnlyPatterns) return false;

    const userMessage = this.extractUserMessage(request);
    return this.config.exactOnlyPatterns.some((pattern) =>
      pattern.test(userMessage),
    );
  }

  /**
   * Check if semantic matching should be used
   */
  private shouldUseSemantic(request: MatchRequest): boolean {
    // If no semantic patterns defined, always use semantic
    if (!this.config.semanticPatterns) return true;

    const userMessage = this.extractUserMessage(request);
    return this.config.semanticPatterns.some((pattern) =>
      pattern.test(userMessage),
    );
  }

  /**
   * Extract user message from request
   */
  private extractUserMessage(request: MatchRequest): string {
    for (let i = request.messages.length - 1; i >= 0; i--) {
      if (request.messages[i].role === 'user') {
        return request.messages[i].content;
      }
    }
    return '';
  }
}

/**
 * Create a HybridMatchStrategy instance
 */
export function createHybridMatchStrategy(
  config?: Partial<HybridMatchConfig>,
): HybridMatchStrategy {
  return new HybridMatchStrategy(config);
}
