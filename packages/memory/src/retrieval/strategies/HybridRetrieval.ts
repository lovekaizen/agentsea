/**
 * HybridRetrieval
 *
 * Combines semantic search with keyword matching for better recall.
 */

import type {
  MemoryEntry,
  ScoredMemory,
  HybridRetrievalConfig,
  RetrievalResult,
  MemoryStoreInterface,
} from '../../types/index.js';
import {
  SemanticRetrieval,
  type EmbeddingFunction,
} from './SemanticRetrieval.js';

/**
 * Hybrid retrieval options
 */
export interface HybridRetrievalOptions {
  query: string;
  topK?: number;
  minScore?: number;
  namespace?: string;
  filter?: Record<string, unknown>;
  semanticWeight?: number;
  keywordWeight?: number;
}

/**
 * Hybrid retrieval strategy combining semantic and keyword search
 */
export class HybridRetrieval {
  private store: MemoryStoreInterface;
  private semanticRetrieval: SemanticRetrieval;
  private config: HybridRetrievalConfig;

  constructor(
    store: MemoryStoreInterface,
    embedFn: EmbeddingFunction,
    config: HybridRetrievalConfig = {},
  ) {
    this.store = store;
    this.config = {
      semanticWeight: config.semanticWeight ?? 0.7,
      keywordWeight: config.keywordWeight ?? 0.3,
      topK: config.topK ?? 10,
      minScore: config.minScore ?? 0.5,
      fusionMethod: config.fusionMethod ?? 'rrf',
      ...config,
    };

    this.semanticRetrieval = new SemanticRetrieval(store, embedFn, {
      topK: config.topK ?? 10,
      minScore: 0, // Lower threshold for candidates
    });
  }

  /**
   * Retrieve memories using hybrid search
   */
  async retrieve(options: HybridRetrievalOptions): Promise<RetrievalResult> {
    const startTime = Date.now();

    const topK = options.topK ?? this.config.topK!;
    const semanticWeight =
      options.semanticWeight ?? this.config.semanticWeight!;
    const keywordWeight = options.keywordWeight ?? this.config.keywordWeight!;

    // Get more candidates than needed for fusion
    const candidateMultiplier = 3;

    // Perform semantic search
    const semanticResult = await this.semanticRetrieval.retrieve({
      query: options.query,
      topK: topK * candidateMultiplier,
      minScore: 0, // Get all candidates
      namespace: options.namespace,
      filter: options.filter,
    });

    // Perform keyword search
    const keywordResult = await this.keywordSearch(options.query, {
      limit: topK * candidateMultiplier,
      namespace: options.namespace,
    });

    // Fuse results
    const fusedResults = this.fuseResults(
      semanticResult.memories.map((m, i) => ({
        entry: m,
        score: semanticResult.scores?.[i] ?? 0,
      })),
      keywordResult,
      semanticWeight,
      keywordWeight,
    );

    // Filter by minimum score and take topK
    const filtered = fusedResults
      .filter((r) => r.score >= (options.minScore ?? this.config.minScore!))
      .slice(0, topK);

    return {
      memories: filtered.map((r) => r.entry),
      scores: filtered.map((r) => r.score),
      totalCandidates: semanticResult.memories.length + keywordResult.length,
      retrievalTimeMs: Date.now() - startTime,
      strategy: 'hybrid',
      metadata: {
        semanticCandidates: semanticResult.memories.length,
        keywordCandidates: keywordResult.length,
        fusionMethod: this.config.fusionMethod,
      },
    };
  }

  /**
   * Keyword-based search using text matching
   */
  private async keywordSearch(
    query: string,
    options: { limit: number; namespace?: string },
  ): Promise<ScoredMemory[]> {
    // Tokenize query
    const queryTokens = this.tokenize(query);

    // Get candidate memories
    const { entries } = await this.store.query({
      query: query,
      limit: options.limit * 2, // Get more for better recall
      namespace: options.namespace,
    });

    // Score each entry using BM25-like scoring
    const results: ScoredMemory[] = [];

    for (const entry of entries) {
      const score = this.calculateKeywordScore(queryTokens, entry.content);
      if (score > 0) {
        results.push({ entry, score });
      }
    }

    // Sort by score
    results.sort((a, b) => b.score - a.score);

    return Promise.resolve(results.slice(0, options.limit));
  }

  /**
   * Tokenize text into terms
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2);
  }

  /**
   * Calculate BM25-like keyword score
   */
  private calculateKeywordScore(
    queryTokens: string[],
    content: string,
  ): number {
    const contentTokens = this.tokenize(content);
    const contentTokenSet = new Set(contentTokens);

    // Calculate term frequency
    const termFreq = new Map<string, number>();
    for (const token of contentTokens) {
      termFreq.set(token, (termFreq.get(token) ?? 0) + 1);
    }

    // BM25 parameters
    const k1 = 1.2;
    const b = 0.75;
    const avgDocLength = 100; // Assume average document length

    let score = 0;
    const docLength = contentTokens.length;

    for (const token of queryTokens) {
      if (contentTokenSet.has(token)) {
        const tf = termFreq.get(token) ?? 0;
        // IDF approximation (assuming token is relevant)
        const idf = 1.5;
        // BM25 formula
        const tfNorm =
          (tf * (k1 + 1)) /
          (tf + k1 * (1 - b + (b * docLength) / avgDocLength));
        score += idf * tfNorm;
      }
    }

    // Normalize by query length
    return score / queryTokens.length;
  }

  /**
   * Fuse semantic and keyword results
   */
  private fuseResults(
    semanticResults: ScoredMemory[],
    keywordResults: ScoredMemory[],
    semanticWeight: number,
    keywordWeight: number,
  ): ScoredMemory[] {
    if (this.config.fusionMethod === 'rrf') {
      return this.reciprocalRankFusion(semanticResults, keywordResults);
    } else {
      return this.weightedFusion(
        semanticResults,
        keywordResults,
        semanticWeight,
        keywordWeight,
      );
    }
  }

  /**
   * Reciprocal Rank Fusion (RRF)
   */
  private reciprocalRankFusion(
    list1: ScoredMemory[],
    list2: ScoredMemory[],
  ): ScoredMemory[] {
    const k = 60; // RRF constant
    const scoreMap = new Map<string, { entry: MemoryEntry; score: number }>();

    // Process first list
    for (let i = 0; i < list1.length; i++) {
      const id = list1[i].entry.id;
      const rrfScore = 1 / (k + i + 1);
      scoreMap.set(id, {
        entry: list1[i].entry,
        score: rrfScore,
      });
    }

    // Process second list
    for (let i = 0; i < list2.length; i++) {
      const id = list2[i].entry.id;
      const rrfScore = 1 / (k + i + 1);
      const existing = scoreMap.get(id);
      if (existing) {
        existing.score += rrfScore;
      } else {
        scoreMap.set(id, {
          entry: list2[i].entry,
          score: rrfScore,
        });
      }
    }

    // Convert to array and sort
    const results = Array.from(scoreMap.values()).map((item) => ({
      entry: item.entry,
      score: item.score,
    }));

    results.sort((a, b) => b.score - a.score);

    return results;
  }

  /**
   * Weighted score fusion
   */
  private weightedFusion(
    semanticResults: ScoredMemory[],
    keywordResults: ScoredMemory[],
    semanticWeight: number,
    keywordWeight: number,
  ): ScoredMemory[] {
    const scoreMap = new Map<
      string,
      { entry: MemoryEntry; semanticScore: number; keywordScore: number }
    >();

    // Normalize semantic scores
    const maxSemantic = Math.max(...semanticResults.map((r) => r.score), 1);
    for (const result of semanticResults) {
      const normalizedScore = result.score / maxSemantic;
      scoreMap.set(result.entry.id, {
        entry: result.entry,
        semanticScore: normalizedScore,
        keywordScore: 0,
      });
    }

    // Normalize keyword scores
    const maxKeyword = Math.max(...keywordResults.map((r) => r.score), 1);
    for (const result of keywordResults) {
      const normalizedScore = result.score / maxKeyword;
      const existing = scoreMap.get(result.entry.id);
      if (existing) {
        existing.keywordScore = normalizedScore;
      } else {
        scoreMap.set(result.entry.id, {
          entry: result.entry,
          semanticScore: 0,
          keywordScore: normalizedScore,
        });
      }
    }

    // Calculate weighted scores
    const results = Array.from(scoreMap.values()).map((item) => ({
      entry: item.entry,
      score:
        item.semanticScore * semanticWeight + item.keywordScore * keywordWeight,
    }));

    results.sort((a, b) => b.score - a.score);

    return results;
  }

  /**
   * Retrieve with explanation of why each result matched
   */
  async retrieveWithExplanation(
    options: HybridRetrievalOptions,
  ): Promise<RetrievalResult & { explanations: string[] }> {
    const startTime = Date.now();
    const topK = options.topK ?? this.config.topK!;

    // Get semantic results
    const semanticResult = await this.semanticRetrieval.retrieve({
      query: options.query,
      topK: topK * 3,
      minScore: 0,
      namespace: options.namespace,
    });

    // Get keyword results
    const keywordResult = await this.keywordSearch(options.query, {
      limit: topK * 3,
      namespace: options.namespace,
    });

    // Create lookup maps
    const semanticScores = new Map<string, number>();
    semanticResult.memories.forEach((m, i) => {
      semanticScores.set(m.id, semanticResult.scores?.[i] ?? 0);
    });

    const keywordScores = new Map<string, number>();
    keywordResult.forEach((r) => {
      keywordScores.set(r.entry.id, r.score);
    });

    // Fuse and get final results
    const fusedResults = this.fuseResults(
      semanticResult.memories.map((m, i) => ({
        entry: m,
        score: semanticResult.scores?.[i] ?? 0,
      })),
      keywordResult,
      options.semanticWeight ?? this.config.semanticWeight!,
      options.keywordWeight ?? this.config.keywordWeight!,
    ).slice(0, topK);

    // Generate explanations
    const queryTokens = this.tokenize(options.query);
    const explanations = fusedResults.map((r) => {
      const semScore = semanticScores.get(r.entry.id);
      const kwScore = keywordScores.get(r.entry.id);

      const parts: string[] = [];

      if (semScore !== undefined && semScore > 0.5) {
        parts.push(`semantically similar (${(semScore * 100).toFixed(0)}%)`);
      }

      if (kwScore !== undefined && kwScore > 0) {
        const matchingTokens = queryTokens.filter((t) =>
          r.entry.content.toLowerCase().includes(t),
        );
        if (matchingTokens.length > 0) {
          parts.push(`keyword matches: "${matchingTokens.join('", "')}"`);
        }
      }

      return parts.length > 0 ? parts.join('; ') : 'matched via fuzzy matching';
    });

    return {
      memories: fusedResults.map((r) => r.entry),
      scores: fusedResults.map((r) => r.score),
      totalCandidates: semanticResult.memories.length + keywordResult.length,
      retrievalTimeMs: Date.now() - startTime,
      strategy: 'hybrid',
      explanations,
    };
  }

  /**
   * Update configuration
   */
  configure(config: Partial<HybridRetrievalConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): HybridRetrievalConfig {
    return { ...this.config };
  }
}

/**
 * Create a hybrid retrieval instance
 */
export function createHybridRetrieval(
  store: MemoryStoreInterface,
  embedFn: EmbeddingFunction,
  config?: HybridRetrievalConfig,
): HybridRetrieval {
  return new HybridRetrieval(store, embedFn, config);
}
