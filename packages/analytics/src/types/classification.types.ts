/**
 * Classification Types
 *
 * Type definitions for intent, sentiment, and topic classification.
 */

import type { IntentClassification } from './core.types.js';

/**
 * Intent taxonomy definition
 */
export interface IntentTaxonomy {
  /** Taxonomy ID */
  id: string;
  /** Taxonomy name */
  name: string;
  /** Intents */
  intents: IntentDefinition[];
  /** Version */
  version: string;
  /** Description */
  description?: string;
  /** Created timestamp */
  createdAt: number;
  /** Updated timestamp */
  updatedAt: number;
}

/**
 * Intent definition
 */
export interface IntentDefinition {
  /** Unique identifier */
  id: string;
  /** Intent name */
  name: string;
  /** Description */
  description?: string;
  /** Keywords for matching */
  keywords?: string[];
  /** Example phrases */
  examples?: string[];
  /** Child intents */
  children?: IntentDefinition[];
  /** Parent intent name */
  parent?: string;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Intent classifier configuration
 */
export interface IntentClassifierConfig {
  /** Taxonomy */
  taxonomy?: IntentTaxonomy;
  /** Embedding model */
  model?: string;
  /** Confidence threshold (0-1) */
  confidenceThreshold?: number;
  /** Confidence threshold (alias) */
  threshold?: number;
  /** Allow multiple intents */
  multiLabel?: boolean;
  /** Max intents to return */
  maxIntents?: number;
  /** Cache classification results */
  cacheResults?: boolean;
  /** Use keyword matching */
  useKeywords?: boolean;
  /** Use embeddings */
  useEmbeddings?: boolean;
  /** Cache embeddings */
  cacheEmbeddings?: boolean;
}

/**
 * Classification request
 */
export interface ClassificationRequest {
  /** Text to classify */
  text: string;
  /** Context (previous messages) */
  context?: string[];
  /** Conversation ID */
  conversationId?: string;
  /** Hints */
  hints?: string[];
}

/**
 * Classification result (extended)
 */
export interface ClassificationResult extends IntentClassification {
  /** Processing time in ms */
  processingTimeMs?: number;
  /** Method used */
  method?: 'keyword' | 'embedding' | 'hybrid';
  /** Debug info */
  debug?: Record<string, unknown>;
}

/**
 * Topic classification result
 */
export interface TopicClassification {
  /** Primary topic */
  primary: Topic;
  /** Additional topics */
  additional?: Topic[];
  /** All topics (including primary) */
  topics?: Topic[];
  /** Classification timestamp */
  classifiedAt: number;
}

/**
 * Topic
 */
export interface Topic {
  /** Topic name */
  name: string;
  /** Confidence (0-1) */
  confidence: number;
  /** Keywords */
  keywords?: string[];
  /** Category */
  category?: string;
}

/**
 * Topic classifier configuration
 */
export interface TopicClassifierConfig {
  /** Predefined topics */
  topics?: TopicDefinition[];
  /** Auto-discover topics */
  autoDiscover?: boolean;
  /** Min topic confidence */
  minConfidence?: number;
  /** Confidence threshold (alias) */
  confidenceThreshold?: number;
  /** Max topics per message */
  maxTopics?: number;
  /** Cache classification results */
  cacheResults?: boolean;
  /** Embedding model */
  model?: string;
}

/**
 * Topic definition
 */
export interface TopicDefinition {
  /** Unique identifier */
  id: string;
  /** Topic name */
  name: string;
  /** Description */
  description?: string;
  /** Keywords */
  keywords?: string[];
  /** Examples */
  examples?: string[];
  /** Category */
  category?: string;
}

/**
 * Sentiment analyzer configuration
 */
export interface SentimentAnalyzerConfig {
  /** Model to use */
  model?: string;
  /** Granularity */
  granularity?: 'message' | 'conversation';
  /** Include emotions */
  includeEmotions?: boolean;
  /** Emotion categories */
  emotionCategories?: string[];
  /** Language */
  language?: string;
}

/**
 * Sentiment trend
 */
export interface SentimentTrend {
  /** Trend direction */
  direction: 'improving' | 'declining' | 'stable';
  /** Trend direction (alias) */
  trend?: 'improving' | 'declining' | 'stable';
  /** Average sentiment */
  average: number;
  /** Change percentage */
  changePercent?: number;
  /** Data points */
  points?: SentimentDataPoint[];
  /** Start value */
  startValue?: number;
  /** End value */
  endValue?: number;
  /** Turning point (if any) */
  turningPoint?: {
    timestamp: number;
    delta: number;
    fromValue: number;
    toValue: number;
  };
}

/**
 * Sentiment data point
 */
export interface SentimentDataPoint {
  /** Timestamp */
  timestamp: number;
  /** Sentiment score */
  score: number;
  /** Label */
  label: string;
  /** Message ID */
  messageId?: string;
}

/**
 * Taxonomy manager configuration
 */
export interface TaxonomyManagerConfig {
  /** Max versions to keep */
  maxVersions?: number;
  /** Auto-version on changes */
  autoVersion?: boolean;
  /** Track changes */
  trackChanges?: boolean;
  /** Auto-save changes */
  autoSave?: boolean;
  /** Storage path */
  storagePath?: string;
  /** Version tracking */
  versionTracking?: boolean;
}

/**
 * Taxonomy update
 */
export interface TaxonomyUpdate {
  /** New name for taxonomy */
  name?: string;
  /** New description */
  description?: string;
  /** Intents to add */
  addIntents?: IntentDefinition[];
  /** Intent IDs to remove */
  removeIntents?: string[];
  /** Intents to update */
  updateIntents?: IntentDefinition[];
  /** Operation type (for legacy support) */
  operation?: 'add' | 'update' | 'remove' | 'move';
  /** Intent path (for legacy support) */
  path?: string;
  /** Intent data (for legacy support) */
  intent?: IntentDefinition;
  /** New parent (for move) */
  newParent?: string;
}

/**
 * Classification feedback
 */
export interface ClassificationFeedback {
  /** Classification type */
  type: 'intent' | 'topic';
  /** Taxonomy ID */
  taxonomyId: string;
  /** What was classified */
  classified: string;
  /** Was correct */
  correct: boolean;
  /** Expected value (if incorrect) */
  expected?: string;
  /** Classification ID (for legacy) */
  classificationId?: string;
  /** Expected intent (alias) */
  expectedIntent?: string;
  /** Feedback text */
  feedback?: string;
  /** Timestamp */
  timestamp?: number;
}

/**
 * Classifier training data
 */
export interface TrainingExample {
  /** Text */
  text: string;
  /** Intent label */
  intent: string;
  /** Source */
  source?: 'manual' | 'feedback' | 'synthetic';
  /** Confidence (for synthetic) */
  confidence?: number;
}

/**
 * Classification metrics
 */
export interface ClassificationMetrics {
  /** Total classifications */
  totalClassifications: number;
  /** Correct classifications */
  correctClassifications: number;
  /** Accuracy (from feedback) */
  accuracy: number;
  /** Per-intent/topic metrics */
  intentMetrics: Map<string, { total: number; correct: number }>;
  /** Top intents (optional legacy) */
  topIntents?: Array<{
    intent: string;
    count: number;
    percentage: number;
  }>;
  /** Average confidence (optional legacy) */
  avgConfidence?: number;
  /** Low confidence rate (optional legacy) */
  lowConfidenceRate?: number;
  /** Period (optional legacy) */
  period?: {
    start: number;
    end: number;
  };
}
