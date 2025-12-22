/**
 * SemanticRetrieval
 *
 * Vector-based semantic search retrieval strategy.
 */

import type {
  MemoryEntry,
  ScoredMemory,
  SemanticRetrievalConfig,
  RetrievalResult,
  MemoryStoreInterface,
} from '../../types/index.js';

/**
 * Embedding function type
 */
export type EmbeddingFunction = (text: string) => Promise<number[]>;

/**
 * Semantic retrieval options
 */
export interface SemanticRetrievalOptions {
  query: string;
  topK?: number;
  minScore?: number;
  namespace?: string;
  filter?: Record<string, unknown>;
  includeEmbeddings?: boolean;
}

/**
 * Semantic retrieval strategy using vector embeddings
 */
export class SemanticRetrieval {
  private store: MemoryStoreInterface;
  private embedFn: EmbeddingFunction;
  private config: SemanticRetrievalConfig;

  constructor(
    store: MemoryStoreInterface,
    embedFn: EmbeddingFunction,
    config: SemanticRetrievalConfig = {},
  ) {
    this.store = store;
    this.embedFn = embedFn;
    this.config = {
      topK: config.topK ?? 10,
      minScore: config.minScore ?? 0.7,
      reranking: config.reranking ?? false,
      maxCandidates: config.maxCandidates ?? 100,
      ...config,
    };
  }

  /**
   * Retrieve memories semantically similar to the query
   */
  async retrieve(options: SemanticRetrievalOptions): Promise<RetrievalResult> {
    const startTime = Date.now();

    // Generate embedding for query
    const queryEmbedding = await this.embedFn(options.query);

    // Search for similar memories
    const results = await this.store.search(queryEmbedding, {
      topK: options.topK ?? this.config.topK!,
      minScore: options.minScore ?? this.config.minScore!,
      namespace: options.namespace,
      filter: options.filter,
    });

    // Apply reranking if enabled
    let finalResults = results;
    if (this.config.reranking && this.config.rerankFn) {
      finalResults = await this.rerank(options.query, results);
    }

    // Prepare entries
    const memories = finalResults.map((r) => {
      const entry = { ...r.entry };
      if (!options.includeEmbeddings) {
        delete entry.embedding;
      }
      return entry;
    });

    return {
      memories,
      scores: finalResults.map((r) => r.score),
      totalCandidates: results.length,
      retrievalTimeMs: Date.now() - startTime,
      strategy: 'semantic',
    };
  }

  /**
   * Retrieve with context - includes surrounding memories
   */
  async retrieveWithContext(
    options: SemanticRetrievalOptions,
    contextWindow: number = 2,
  ): Promise<RetrievalResult & { contextMemories: MemoryEntry[][] }> {
    const result = await this.retrieve(options);

    // Get surrounding memories for each result
    const contextMemories: MemoryEntry[][] = [];

    for (const memory of result.memories) {
      const surrounding = await this.getSurroundingMemories(
        memory,
        contextWindow,
      );
      contextMemories.push(surrounding);
    }

    return {
      ...result,
      contextMemories,
    };
  }

  /**
   * Get memories surrounding a given memory by timestamp
   */
  private async getSurroundingMemories(
    memory: MemoryEntry,
    windowSize: number,
  ): Promise<MemoryEntry[]> {
    const before = await this.store.query({
      endTime: memory.timestamp - 1,
      limit: windowSize,
      namespace: memory.metadata.namespace,
    });

    const after = await this.store.query({
      startTime: memory.timestamp + 1,
      limit: windowSize,
      namespace: memory.metadata.namespace,
    });

    return [...before.entries.reverse(), ...after.entries];
  }

  /**
   * Rerank results using provided rerank function
   */
  private async rerank(
    query: string,
    results: ScoredMemory[],
  ): Promise<ScoredMemory[]> {
    if (!this.config.rerankFn) {
      return results;
    }

    const reranked = await this.config.rerankFn(query, results);
    return Promise.resolve(
      reranked.sort((a: ScoredMemory, b: ScoredMemory) => b.score - a.score),
    );
  }

  /**
   * Find memories similar to a given memory
   */
  async findSimilar(
    memory: MemoryEntry,
    options?: Partial<SemanticRetrievalOptions>,
  ): Promise<ScoredMemory[]> {
    if (!memory.embedding) {
      // Generate embedding if not present
      const embedding = await this.embedFn(memory.content);
      return this.store.search(embedding, {
        topK: options?.topK ?? this.config.topK!,
        minScore: options?.minScore ?? this.config.minScore!,
        namespace: options?.namespace ?? memory.metadata.namespace,
        filter: {
          ...options?.filter,
          // Exclude the source memory
          id: { $ne: memory.id },
        },
      });
    }

    return this.store
      .search(memory.embedding, {
        topK: (options?.topK ?? this.config.topK!) + 1, // +1 to exclude self
        minScore: options?.minScore ?? this.config.minScore!,
        namespace: options?.namespace ?? memory.metadata.namespace,
        filter: options?.filter,
      })
      .then((results) => results.filter((r) => r.entry.id !== memory.id));
  }

  /**
   * Cluster memories by semantic similarity
   */
  async cluster(
    memories: MemoryEntry[],
    numClusters: number = 5,
  ): Promise<Map<number, MemoryEntry[]>> {
    const clusters = new Map<number, MemoryEntry[]>();

    // Ensure all memories have embeddings
    const memoriesWithEmbeddings = await Promise.all(
      memories.map(async (m) => {
        if (m.embedding) return m;
        return {
          ...m,
          embedding: await this.embedFn(m.content),
        };
      }),
    );

    // Simple k-means-like clustering
    // Initialize cluster centers randomly
    const centerIndices = this.randomSample(
      memoriesWithEmbeddings.length,
      numClusters,
    );
    const centers = centerIndices.map(
      (i) => memoriesWithEmbeddings[i].embedding!,
    );

    // Assign memories to clusters
    for (let iteration = 0; iteration < 10; iteration++) {
      // Clear clusters
      for (let i = 0; i < numClusters; i++) {
        clusters.set(i, []);
      }

      // Assign each memory to nearest center
      for (const memory of memoriesWithEmbeddings) {
        let bestCluster = 0;
        let bestSimilarity = -Infinity;

        for (let i = 0; i < centers.length; i++) {
          const similarity = this.cosineSimilarity(
            memory.embedding!,
            centers[i],
          );
          if (similarity > bestSimilarity) {
            bestSimilarity = similarity;
            bestCluster = i;
          }
        }

        clusters.get(bestCluster)!.push(memory);
      }

      // Update centers
      for (let i = 0; i < numClusters; i++) {
        const clusterMemories = clusters.get(i)!;
        if (clusterMemories.length > 0) {
          centers[i] = this.averageEmbedding(
            clusterMemories.map((m) => m.embedding!),
          );
        }
      }
    }

    return clusters;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
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

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Calculate average embedding
   */
  private averageEmbedding(embeddings: number[][]): number[] {
    const dim = embeddings[0].length;
    const avg = new Array(dim).fill(0);

    for (const emb of embeddings) {
      for (let i = 0; i < dim; i++) {
        avg[i] += emb[i];
      }
    }

    for (let i = 0; i < dim; i++) {
      avg[i] /= embeddings.length;
    }

    return avg;
  }

  /**
   * Random sample without replacement
   */
  private randomSample(max: number, count: number): number[] {
    const result: number[] = [];
    const used = new Set<number>();

    while (result.length < count && result.length < max) {
      const index = Math.floor(Math.random() * max);
      if (!used.has(index)) {
        used.add(index);
        result.push(index);
      }
    }

    return result;
  }

  /**
   * Update configuration
   */
  configure(config: Partial<SemanticRetrievalConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): SemanticRetrievalConfig {
    return { ...this.config };
  }
}

/**
 * Create a semantic retrieval instance
 */
export function createSemanticRetrieval(
  store: MemoryStoreInterface,
  embedFn: EmbeddingFunction,
  config?: SemanticRetrievalConfig,
): SemanticRetrieval {
  return new SemanticRetrieval(store, embedFn, config);
}
