/**
 * Retrieval Types
 *
 * Types for memory retrieval strategies.
 */

import type { ScoredMemory, MemoryEntry } from './core.types.js';

/**
 * Semantic retrieval configuration
 */
export interface SemanticRetrievalConfig {
  topK?: number;
  minScore?: number;
  reranking?: boolean;
  rerankModel?: string;
  maxCandidates?: number;
  rerankFn?: (
    query: string,
    results: ScoredMemory[],
  ) => Promise<ScoredMemory[]>;
}

/**
 * Keyword retrieval configuration
 */
export interface KeywordRetrievalConfig {
  analyzer?: 'english' | 'standard' | 'simple';
  fuzziness?: number;
  boost?: Record<string, number>;
}

/**
 * Hybrid retrieval configuration
 */
export interface HybridRetrievalConfig {
  semanticWeight?: number;
  keywordWeight?: number;
  topK?: number;
  minScore?: number;
  fusionMethod?: 'rrf' | 'weighted-sum' | 'max' | 'reciprocal-rank';
  semantic?: {
    weight: number;
    config?: SemanticRetrievalConfig;
  };
  keyword?: {
    weight: number;
    config?: KeywordRetrievalConfig;
  };
  fusion?: 'reciprocal-rank' | 'weighted-sum' | 'max';
}

/**
 * Temporal decay function
 */
export type TemporalDecayFunction =
  | 'exponential'
  | 'linear'
  | 'step'
  | 'logarithmic'
  | 'custom';

/**
 * Temporal retrieval configuration
 */
export interface TemporalRetrievalConfig {
  decayFunction?: TemporalDecayFunction;
  halfLife?: number;
  customDecay?: (ageMs: number) => number;
  boost?: {
    recent?: number;
    medium?: number;
    old?: number;
  };
  recentThreshold?: number;
  mediumThreshold?: number;
  recencyWeight?: number;
  importanceWeight?: number;
  accessWeight?: number;
  decayHalfLife?: number;
  topK?: number;
}

/**
 * Reranker interface
 */
export interface RerankerInterface {
  readonly name: string;
  rerank(
    query: string,
    candidates: ScoredMemory[],
    topK: number,
  ): Promise<ScoredMemory[]>;
}

/**
 * LLM reranker configuration
 */
export interface LLMRerankerConfig {
  model: string;
  batchSize?: number;
  prompt?: string;
}

/**
 * Cross-encoder reranker configuration
 */
export interface CrossEncoderRerankerConfig {
  model: string;
  batchSize?: number;
}

/**
 * Retrieval pipeline stage
 */
export interface RetrievalPipelineStage {
  stage: string;
  retriever?: {
    retrieve(
      query: string,
      context: RetrievalPipelineContext,
    ): Promise<ScoredMemory[]>;
  };
  filter?: (memory: MemoryEntry) => boolean;
  reranker?: RerankerInterface;
  transform?: (memories: ScoredMemory[]) => ScoredMemory[];
  topK?: number;
}

/**
 * Retrieval pipeline configuration
 */
export interface RetrievalPipelineConfig {
  stages: RetrievalPipelineStage[];
  fallback?: 'previous-stage' | 'empty' | 'error';
}

/**
 * Retrieval pipeline context
 */
export interface RetrievalPipelineContext {
  query: string;
  embedding?: number[];
  filters?: Record<string, unknown>;
  limit?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Retrieval result
 */
export interface RetrievalResult {
  memories: MemoryEntry[];
  scores: number[];
  totalCandidates: number;
  retrievalTimeMs: number;
  strategy: string;
  metadata?: Record<string, unknown>;
}

/**
 * Retrieval result with debug info
 */
export interface RetrievalResultWithDebug {
  results: ScoredMemory[];
  debug?: {
    queryEmbedding?: number[];
    stages?: Array<{
      name: string;
      inputCount: number;
      outputCount: number;
      durationMs: number;
    }>;
    totalDurationMs: number;
  };
}

/**
 * Relevance scoring factors
 */
export interface RelevanceScoringFactors {
  semanticSimilarity: number;
  keywordMatch: number;
  recency: number;
  importance: number;
  accessFrequency: number;
  contextMatch: number;
}

/**
 * Relevance scorer configuration
 */
export interface RelevanceScorerConfig {
  weights: Partial<RelevanceScoringFactors>;
  normalize?: boolean;
}
