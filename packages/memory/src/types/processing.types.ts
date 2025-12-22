/**
 * Processing Types
 *
 * Types for memory processing utilities.
 */

import type {
  MemoryEntry,
  Entity,
  Relation,
  LLMProviderInterface,
} from './core.types.js';

/**
 * Summarization strategy
 */
export type SummarizationStrategy =
  | 'hierarchical'
  | 'incremental'
  | 'abstractive'
  | 'extractive';

/**
 * Summarizer configuration
 */
export interface SummarizerConfig {
  provider?: LLMProviderInterface;
  model?: string;
  strategy?: SummarizationStrategy;
  maxLength?: number;
  preserveEntities?: boolean;
  focusPrompt?: string;
  maxSummaryLength?: number;
  minEntriesForSummary?: number;
  preserveKeyEntities?: boolean;
  summaryStyle?: string;
}

/**
 * Summary result
 */
export interface SummaryResult {
  summary: string;
  originalCount: number;
  preservedEntities?: Entity[];
  keyPoints?: string[];
  confidence: number;
}

/**
 * Compression strategy
 */
export type CompressionStrategy =
  | 'importance-weighted'
  | 'recency'
  | 'semantic-clustering'
  | 'hybrid';

/**
 * Compressor configuration
 */
export interface CompressorConfig {
  targetRatio?: number;
  preserveImportant?: boolean;
  strategy?: CompressionStrategy;
  minImportance?: number;
  minContentLength?: number;
  removeEmbeddings?: boolean;
  truncateMetadata?: boolean;
}

/**
 * Compression result
 */
export interface CompressionResult {
  original: MemoryEntry[];
  compressed: MemoryEntry[];
  removed: MemoryEntry[];
  originalSize: number;
  compressedSize: number;
  ratio: number;
}

/**
 * Merge strategy for consolidation
 */
export type MergeStrategy =
  | 'newest-wins'
  | 'confidence-weighted'
  | 'union'
  | 'intersection';

/**
 * Consolidator configuration
 */
export interface ConsolidatorConfig {
  similarityThreshold?: number;
  mergeStrategy?: MergeStrategy;
  extractRelations?: boolean;
  maxBatchSize?: number;
  minGroupSize?: number;
  maxGroupSize?: number;
  groupingStrategy?: 'semantic' | 'temporal' | 'type';
  preserveOriginals?: boolean;
}

/**
 * Consolidation candidate
 */
export interface ConsolidationCandidate {
  entries: MemoryEntry[];
  similarity: number;
  recommendation: 'merge' | 'keep' | 'remove';
}

/**
 * Consolidation preview
 */
export interface ConsolidationPreview {
  candidates: ConsolidationCandidate[];
  estimatedReduction: number;
  affectedCount: number;
}

/**
 * Retention policy
 */
export interface RetentionPolicy {
  critical?: number;
  high?: number;
  medium?: number;
  low?: number;
  trivial?: number;
}

/**
 * Forgetter configuration
 */
export interface ForgetterConfig {
  retentionPolicy?: RetentionPolicy;
  importanceThreshold?: number;
  maxAge?: number;
  preserveTypes?: string[];
  curve?: 'exponential' | 'power' | 'ebbinghaus';
  halfLife?: number;
  minRetention?: number;
  accessBoost?: number;
  importanceWeight?: number;
  forgetThreshold?: number;
}

/**
 * Forget result
 */
export interface ForgetResult {
  forgotten: MemoryEntry[];
  preserved: MemoryEntry[];
  totalRemoved: number;
  totalPreserved: number;
}

/**
 * Extraction type
 */
export type ExtractionType =
  | 'person'
  | 'organization'
  | 'location'
  | 'date'
  | 'preference'
  | 'fact'
  | 'intent'
  | 'sentiment'
  | 'topic'
  | 'custom';

/**
 * Extractor configuration
 */
export interface ExtractorConfig {
  provider?: LLMProviderInterface;
  model?: string;
  extractTypes?: ExtractionType[];
  customPrompt?: string;
  confidence?: number;
  extractEntities?: boolean;
  extractRelations?: boolean;
  extractKeywords?: boolean;
  extractSentiment?: boolean;
  minConfidence?: number;
  maxEntitiesPerEntry?: number;
}

/**
 * Preference extraction
 */
export interface ExtractedPreference {
  category: string;
  preference: string;
  confidence: number;
  source?: string;
}

/**
 * Fact extraction
 */
export interface ExtractedFact {
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  source?: string;
}

/**
 * Extraction result
 */
export interface ExtractionResult {
  entities: Entity[];
  relations: Relation[];
  preferences: ExtractedPreference[];
  facts: ExtractedFact[];
  topics?: string[];
  sentiment?: {
    score: number;
    label: 'positive' | 'negative' | 'neutral';
  };
}

/**
 * Processor interface
 */
export interface ProcessorInterface<TInput, TOutput> {
  readonly name: string;
  process(input: TInput, options?: Record<string, unknown>): Promise<TOutput>;
}

/**
 * Processing pipeline stage
 */
export interface ProcessingPipelineStage<TInput = unknown, TOutput = unknown> {
  name: string;
  processor: ProcessorInterface<TInput, TOutput>;
  enabled?: boolean;
  condition?: (input: TInput) => boolean;
}

/**
 * Processing pipeline configuration
 */
export interface ProcessingPipelineConfig {
  stages: ProcessingPipelineStage[];
  continueOnError?: boolean;
  timeout?: number;
}
