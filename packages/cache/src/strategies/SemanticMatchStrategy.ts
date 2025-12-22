/**
 * SemanticMatchStrategy
 *
 * Embedding-based semantic matching strategy.
 * Uses vector similarity to find semantically similar cached responses.
 */

import { BaseMatchStrategy } from './BaseMatchStrategy.js';
import type {
  CacheLookupResult,
  MatchOptions,
  MatchRequest,
  MatchStrategyType,
  SemanticMatchConfig,
} from '../types/index.js';
import type { BaseCacheStore } from '../stores/BaseCacheStore.js';
import type { SimilarityEngine } from '../similarity/SimilarityEngine.js';
import { extractUserMessage } from '../core/CacheKey.js';

/**
 * Default semantic match configuration
 */
const DEFAULT_CONFIG: SemanticMatchConfig = {
  threshold: 0.92,
  matchModel: true,
  topK: 5,
};

/**
 * SemanticMatchStrategy
 *
 * Matches requests by computing semantic similarity between embeddings.
 * Requires a SimilarityEngine to generate and compare embeddings.
 *
 * @example
 * ```typescript
 * const strategy = new SemanticMatchStrategy({
 *   threshold: 0.92,
 *   topK: 5
 * });
 *
 * const result = await strategy.match(request, store, similarityEngine);
 * if (result.hit) {
 *   console.log('Semantic match found:', result.similarity);
 * }
 * ```
 */
export class SemanticMatchStrategy extends BaseMatchStrategy {
  readonly name: MatchStrategyType = 'semantic';
  private config: SemanticMatchConfig;

  constructor(config?: Partial<SemanticMatchConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async match(
    request: MatchRequest,
    store: BaseCacheStore,
    similarity?: SimilarityEngine,
    options?: MatchOptions,
  ): Promise<CacheLookupResult> {
    const startTime = performance.now();

    // Require similarity engine for semantic matching
    if (!similarity) {
      return {
        hit: false,
        latencyMs: performance.now() - startTime,
        source: 'miss',
      };
    }

    // Extract user message for semantic comparison
    const userMessage = extractUserMessage(request.messages);

    if (!userMessage) {
      return {
        hit: false,
        latencyMs: performance.now() - startTime,
        source: 'miss',
      };
    }

    try {
      // Generate embedding for query
      const queryEmbedding = await similarity.embed(userMessage);

      // Query store for similar entries
      const threshold = options?.threshold ?? this.config.threshold ?? 0.92;
      const topK = options?.topK ?? this.config.topK ?? 5;

      const results = await store.query(queryEmbedding, {
        topK,
        minSimilarity: threshold,
        namespace: options?.namespace,
      });

      if (results.entries.length > 0) {
        // Find best match, optionally filtering by model
        let bestMatch = results.entries[0];

        if (this.config.matchModel) {
          const modelMatch = results.entries.find(
            (e) => e.request.model === request.model,
          );
          if (modelMatch) {
            bestMatch = modelMatch;
          }
        }

        if (bestMatch && bestMatch.score >= threshold) {
          return {
            hit: true,
            entry: bestMatch,
            similarity: bestMatch.score,
            latencyMs: performance.now() - startTime,
            source: 'semantic',
          };
        }
      }

      return {
        hit: false,
        latencyMs: performance.now() - startTime,
        source: 'miss',
      };
    } catch (error) {
      // On embedding error, return miss
      console.error('Semantic match error:', error);
      return {
        hit: false,
        latencyMs: performance.now() - startTime,
        source: 'miss',
      };
    }
  }
}

/**
 * Create a SemanticMatchStrategy instance
 */
export function createSemanticMatchStrategy(
  config?: Partial<SemanticMatchConfig>,
): SemanticMatchStrategy {
  return new SemanticMatchStrategy(config);
}
