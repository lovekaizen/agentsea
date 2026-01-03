/**
 * SimilarityEngine
 *
 * Wraps embedding providers from @lov3kaizen/agentsea-embeddings
 * for semantic similarity computation.
 */

/**
 * Embedding provider interface
 * Compatible with @lov3kaizen/agentsea-embeddings providers
 */
export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch?(texts: string[]): Promise<number[][]>;
  readonly dimensions?: number;
}

/**
 * Similarity metric type
 */
export type SimilarityMetric = 'cosine' | 'euclidean' | 'dot_product';

/**
 * Similarity engine configuration
 */
export interface SimilarityEngineConfig {
  /** Embedding provider */
  provider: EmbeddingProvider;
  /** Similarity metric to use */
  metric?: SimilarityMetric;
  /** Cache embeddings in memory */
  cacheEmbeddings?: boolean;
  /** Maximum cache size */
  maxCacheSize?: number;
}

/**
 * SimilarityEngine
 *
 * Manages embedding generation and similarity computation.
 * Wraps embedding providers from @lov3kaizen/agentsea-embeddings.
 *
 * @example
 * ```typescript
 * import { OpenAIProvider } from '@lov3kaizen/agentsea-embeddings';
 * import { SimilarityEngine } from '@lov3kaizen/agentsea-cache';
 *
 * const provider = new OpenAIProvider({
 *   apiKey: process.env.OPENAI_API_KEY,
 *   model: 'text-embedding-3-small'
 * });
 *
 * const engine = new SimilarityEngine({ provider });
 *
 * const embedding = await engine.embed('Hello world');
 * const similarity = engine.computeSimilarity(embedding1, embedding2);
 * ```
 */
export class SimilarityEngine {
  private provider: EmbeddingProvider;
  private metric: SimilarityMetric;
  private embeddingCache?: Map<string, number[]>;
  private maxCacheSize: number;

  constructor(config: SimilarityEngineConfig) {
    this.provider = config.provider;
    this.metric = config.metric ?? 'cosine';
    this.maxCacheSize = config.maxCacheSize ?? 10000;

    if (config.cacheEmbeddings) {
      this.embeddingCache = new Map();
    }
  }

  /**
   * Generate embedding for text
   */
  async embed(text: string): Promise<number[]> {
    // Check cache
    if (this.embeddingCache?.has(text)) {
      return this.embeddingCache.get(text)!;
    }

    const embedding = await this.provider.embed(text);

    // Cache result
    if (this.embeddingCache) {
      // Evict if at capacity
      if (this.embeddingCache.size >= this.maxCacheSize) {
        const firstKey = this.embeddingCache.keys().next().value;
        if (firstKey) {
          this.embeddingCache.delete(firstKey);
        }
      }
      this.embeddingCache.set(text, embedding);
    }

    return embedding;
  }

  /**
   * Generate embeddings for multiple texts
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (this.provider.embedBatch) {
      return this.provider.embedBatch(texts);
    }

    // Fall back to sequential embedding
    return Promise.all(texts.map((text) => this.embed(text)));
  }

  /**
   * Compute similarity between two vectors
   */
  computeSimilarity(a: number[], b: number[]): number {
    switch (this.metric) {
      case 'cosine':
        return this.cosineSimilarity(a, b);
      case 'euclidean': {
        // Convert distance to similarity (0-1)
        const dist = this.euclideanDistance(a, b);
        return 1 / (1 + dist);
      }
      case 'dot_product':
        return this.dotProduct(a, b);
      default:
        return this.cosineSimilarity(a, b);
    }
  }

  /**
   * Find most similar vectors from candidates
   */
  findMostSimilar(
    query: number[],
    candidates: Array<{ id: string; vector: number[] }>,
    minSimilarity = 0,
  ): Array<{ id: string; similarity: number }> {
    const results = candidates
      .map((c) => ({
        id: c.id,
        similarity: this.computeSimilarity(query, c.vector),
      }))
      .filter((r) => r.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity);

    return results;
  }

  /**
   * Get embedding dimensions
   */
  get dimensions(): number {
    return this.provider.dimensions ?? 0;
  }

  /**
   * Clear embedding cache
   */
  clearCache(): void {
    this.embeddingCache?.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number } | null {
    if (!this.embeddingCache) return null;
    return {
      size: this.embeddingCache.size,
      maxSize: this.maxCacheSize,
    };
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    return dotProduct / denominator;
  }

  private euclideanDistance(a: number[], b: number[]): number {
    if (a.length !== b.length) return Infinity;

    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }

    return Math.sqrt(sum);
  }

  private dotProduct(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i] * b[i];
    }

    return sum;
  }
}

/**
 * Create a SimilarityEngine instance
 */
export function createSimilarityEngine(
  config: SimilarityEngineConfig,
): SimilarityEngine {
  return new SimilarityEngine(config);
}
