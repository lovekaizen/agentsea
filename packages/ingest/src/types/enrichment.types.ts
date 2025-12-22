/**
 * Enrichment Types
 *
 * Type definitions for document enrichment (entities, keywords, summaries).
 */

import type {
  Entity,
  SentimentResult,
  EnrichmentData,
} from './document.types.js';

/**
 * Enrichment types
 */
export type EnrichmentType =
  | 'entities'
  | 'keywords'
  | 'summary'
  | 'sentiment'
  | 'topics'
  | 'language'
  | 'classification'
  | 'embeddings'
  | 'relations'
  | 'custom';

/**
 * Enrichment configuration
 */
export interface EnrichmentConfig {
  /** Enrichments to apply */
  enrichments: EnrichmentType[];
  /** Entity extraction config */
  entities?: EntityExtractionConfig;
  /** Keyword extraction config */
  keywords?: KeywordExtractionConfig;
  /** Summarization config */
  summary?: SummarizationConfig;
  /** Sentiment analysis config */
  sentiment?: SentimentConfig;
  /** Topic modeling config */
  topics?: TopicConfig;
  /** Classification config */
  classification?: ClassificationConfig;
  /** Embedding config */
  embeddings?: EmbeddingConfig;
  /** Custom enrichment handlers */
  customHandlers?: Record<string, EnrichmentHandler>;
}

/**
 * Enrichment handler function
 */
export type EnrichmentHandler = (
  text: string,
  options?: unknown,
) => Promise<unknown>;

/**
 * Entity extraction configuration
 */
export interface EntityExtractionConfig {
  /** Entity types to extract */
  types?: EntityType[];
  /** Use LLM for extraction */
  useLLM?: boolean;
  /** LLM model to use */
  llmModel?: string;
  /** Merge overlapping entities */
  mergeOverlapping?: boolean;
  /** Minimum confidence threshold */
  minConfidence?: number;
  /** Maximum entities to return */
  maxEntities?: number;
  /** Custom entity patterns */
  customPatterns?: Record<string, RegExp>;
}

/**
 * Entity types
 */
export type EntityType =
  | 'PERSON'
  | 'ORGANIZATION'
  | 'LOCATION'
  | 'DATE'
  | 'TIME'
  | 'MONEY'
  | 'PERCENT'
  | 'EMAIL'
  | 'PHONE'
  | 'URL'
  | 'PRODUCT'
  | 'EVENT'
  | 'WORK_OF_ART'
  | 'LAW'
  | 'LANGUAGE'
  | 'QUANTITY'
  | 'ORDINAL'
  | 'CARDINAL'
  | 'CUSTOM';

/**
 * Extended entity with more details
 */
export interface ExtendedEntity extends Entity {
  /** Entity type */
  entityType: EntityType;
  /** Confidence score (0-1) */
  confidence: number;
  /** Normalized/canonical form */
  normalizedValue?: string;
  /** Wikipedia/knowledge base link */
  wikiLink?: string;
  /** Entity description */
  description?: string;
  /** Related entities */
  relatedEntities?: string[];
}

/**
 * Keyword extraction configuration
 */
export interface KeywordExtractionConfig {
  /** Extraction method */
  method?: KeywordExtractionMethod;
  /** Maximum keywords to extract */
  maxKeywords?: number;
  /** Minimum keyword score */
  minScore?: number;
  /** Include phrases (multi-word) */
  includePhrases?: boolean;
  /** Maximum phrase length (words) */
  maxPhraseLength?: number;
  /** Stopwords to exclude */
  stopwords?: string[];
  /** Language for processing */
  language?: string;
}

/**
 * Keyword extraction methods
 */
export type KeywordExtractionMethod =
  | 'tfidf'
  | 'textrank'
  | 'rake'
  | 'yake'
  | 'keybert'
  | 'llm'
  | 'frequency';

/**
 * Extracted keyword
 */
export interface ExtractedKeyword {
  /** Keyword text */
  keyword: string;
  /** Relevance score (0-1) */
  score: number;
  /** Occurrence count */
  count: number;
  /** Is phrase (multi-word) */
  isPhrase: boolean;
  /** Positions in text */
  positions?: Array<{ start: number; end: number }>;
}

/**
 * Summarization configuration
 */
export interface SummarizationConfig {
  /** Summary type */
  type?: SummaryType;
  /** Maximum summary length */
  maxLength?: number;
  /** Length unit */
  lengthUnit?: 'words' | 'sentences' | 'characters';
  /** Summarization model */
  model?: string;
  /** Focus on specific aspects */
  focusAspects?: string[];
  /** Include bullet points */
  bulletPoints?: boolean;
  /** Target audience */
  targetAudience?: string;
}

/**
 * Summary types
 */
export type SummaryType =
  | 'extractive'
  | 'abstractive'
  | 'hybrid'
  | 'key_points';

/**
 * Summary result
 */
export interface SummaryResult {
  /** Summary text */
  text: string;
  /** Summary type used */
  type: SummaryType;
  /** Compression ratio */
  compressionRatio: number;
  /** Key sentences extracted */
  keySentences?: string[];
  /** Topics covered */
  topics?: string[];
}

/**
 * Sentiment analysis configuration
 */
export interface SentimentConfig {
  /** Analysis granularity */
  granularity?: 'document' | 'paragraph' | 'sentence';
  /** Aspect-based sentiment */
  aspects?: string[];
  /** Include emotion detection */
  includeEmotions?: boolean;
  /** Model to use */
  model?: string;
}

/**
 * Extended sentiment result
 */
export interface ExtendedSentimentResult extends SentimentResult {
  /** Sentiment by aspect */
  aspects?: Record<string, SentimentResult>;
  /** Detected emotions */
  emotions?: EmotionResult[];
  /** Sentiment over segments */
  segments?: SentimentSegment[];
}

/**
 * Emotion detection result
 */
export interface EmotionResult {
  /** Emotion label */
  emotion: EmotionType;
  /** Score (0-1) */
  score: number;
}

/**
 * Emotion types
 */
export type EmotionType =
  | 'joy'
  | 'sadness'
  | 'anger'
  | 'fear'
  | 'surprise'
  | 'disgust'
  | 'trust'
  | 'anticipation'
  | 'neutral';

/**
 * Sentiment segment
 */
export interface SentimentSegment {
  /** Segment text */
  text: string;
  /** Sentiment result */
  sentiment: SentimentResult;
  /** Start position */
  start: number;
  /** End position */
  end: number;
}

/**
 * Topic modeling configuration
 */
export interface TopicConfig {
  /** Topic modeling method */
  method?: TopicMethod;
  /** Number of topics */
  numTopics?: number;
  /** Words per topic */
  wordsPerTopic?: number;
  /** Predefined topics to match */
  predefinedTopics?: string[];
  /** Model to use */
  model?: string;
}

/**
 * Topic modeling methods
 */
export type TopicMethod = 'lda' | 'nmf' | 'bertopic' | 'llm' | 'zero_shot';

/**
 * Topic result
 */
export interface TopicResult {
  /** Topic label */
  label: string;
  /** Confidence score (0-1) */
  score: number;
  /** Top words for topic */
  topWords?: string[];
  /** Is predefined topic */
  isPredefined?: boolean;
}

/**
 * Classification configuration
 */
export interface ClassificationConfig {
  /** Classification labels */
  labels: string[];
  /** Allow multiple labels */
  multiLabel?: boolean;
  /** Minimum confidence threshold */
  minConfidence?: number;
  /** Classification model */
  model?: string;
  /** Custom classification prompt */
  customPrompt?: string;
}

/**
 * Classification result
 */
export interface ClassificationResult {
  /** Assigned labels with scores */
  labels: Array<{ label: string; score: number }>;
  /** Primary label */
  primaryLabel: string;
  /** Primary label confidence */
  confidence: number;
}

/**
 * Embedding configuration
 */
export interface EmbeddingConfig {
  /** Embedding model */
  model: string;
  /** Embedding dimensions */
  dimensions?: number;
  /** Normalize embeddings */
  normalize?: boolean;
  /** Batch size */
  batchSize?: number;
}

/**
 * Embedding result
 */
export interface EmbeddingResult {
  /** Embedding vector */
  embedding: number[];
  /** Model used */
  model: string;
  /** Token count */
  tokenCount: number;
}

/**
 * Relation extraction configuration
 */
export interface RelationConfig {
  /** Relation types to extract */
  relationTypes?: string[];
  /** Use LLM for extraction */
  useLLM?: boolean;
  /** Model to use */
  model?: string;
}

/**
 * Extracted relation
 */
export interface ExtractedRelation {
  /** Subject entity */
  subject: ExtendedEntity;
  /** Relation type */
  relation: string;
  /** Object entity */
  object: ExtendedEntity;
  /** Confidence score (0-1) */
  confidence: number;
  /** Source text snippet */
  sourceText?: string;
}

/**
 * Enricher interface
 */
export interface Enricher {
  /** Enricher name */
  readonly name: string;
  /** Supported enrichment types */
  readonly supportedTypes: EnrichmentType[];

  /** Enrich document */
  enrich(text: string, config: EnrichmentConfig): Promise<EnrichmentData>;

  /** Check if enrichment type is supported */
  supports(type: EnrichmentType): boolean;
}

/**
 * Enrichment result
 */
export interface EnrichmentResult extends EnrichmentData {
  /** Extended entities */
  extendedEntities?: ExtendedEntity[];
  /** Extended keywords */
  extendedKeywords?: ExtractedKeyword[];
  /** Extended summary */
  summaryResult?: SummaryResult;
  /** Extended sentiment */
  extendedSentiment?: ExtendedSentimentResult;
  /** Topic results */
  topicResults?: TopicResult[];
  /** Classification results */
  classificationResults?: ClassificationResult;
  /** Embeddings */
  embeddingResult?: EmbeddingResult;
  /** Relations */
  relations?: ExtractedRelation[];
  /** Processing time (ms) */
  processingTime: number;
}
