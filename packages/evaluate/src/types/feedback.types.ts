/**
 * Feedback Types
 *
 * Types for feedback collection and storage.
 */

import { z } from 'zod';

/**
 * Feedback rating types
 */
export type ThumbsRating = 'up' | 'down';
export type StarRating = 1 | 2 | 3 | 4 | 5;
export type PreferenceChoice = 'A' | 'B' | 'tie';

/**
 * Base feedback entry
 */
export interface BaseFeedbackEntry {
  id: string;
  responseId: string;
  conversationId?: string;
  input: string;
  output: string;
  userId?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * Thumbs feedback
 */
export interface ThumbsFeedback extends BaseFeedbackEntry {
  type: 'thumbs';
  rating: ThumbsRating;
  comment?: string;
}

/**
 * Star rating feedback
 */
export interface RatingFeedback extends BaseFeedbackEntry {
  type: 'rating';
  rating: StarRating;
  comment?: string;
}

/**
 * Preference feedback (A/B comparison)
 */
export interface PreferenceFeedback extends BaseFeedbackEntry {
  type: 'preference';
  responseA: {
    id: string;
    content: string;
    model?: string;
  };
  responseB: {
    id: string;
    content: string;
    model?: string;
  };
  preference: PreferenceChoice;
  reason?: string;
  confidence?: number;
}

/**
 * Correction feedback
 */
export interface CorrectionFeedback extends BaseFeedbackEntry {
  type: 'correction';
  correctedOutput: string;
  correctionType: 'factual' | 'grammar' | 'style' | 'completeness' | 'other';
  explanation?: string;
}

/**
 * Multi-criteria feedback
 */
export interface MultiCriteriaFeedback extends BaseFeedbackEntry {
  type: 'multi_criteria';
  criteria: CriterionRating[];
  overallRating?: StarRating;
  comment?: string;
}

/**
 * Criterion definition
 */
export interface CriterionDefinition {
  name: string;
  description: string;
  scale: [number, number];
  weight?: number;
}

/**
 * Criterion rating
 */
export interface CriterionRating {
  name: string;
  rating: number;
  correction?: string;
}

/**
 * Union of all feedback types
 */
export type FeedbackEntry =
  | ThumbsFeedback
  | RatingFeedback
  | PreferenceFeedback
  | CorrectionFeedback
  | MultiCriteriaFeedback;

/**
 * Feedback collector options
 */
export interface FeedbackCollectorOptions {
  store?: FeedbackStoreInterface;
  autoTimestamp?: boolean;
  generateId?: () => string;
  validateInput?: boolean;
}

/**
 * Thumbs collector options
 */
export interface ThumbsCollectorOptions extends FeedbackCollectorOptions {
  allowComment?: boolean;
  requireComment?: 'always' | 'on_down' | 'never';
}

/**
 * Rating collector options
 */
export interface RatingCollectorOptions extends FeedbackCollectorOptions {
  allowComment?: boolean;
  minRating?: StarRating;
  maxRating?: StarRating;
  requireComment?: 'always' | 'on_low' | 'never';
  lowRatingThreshold?: number;
}

/**
 * Preference collector options
 */
export interface PreferenceCollectorOptions extends FeedbackCollectorOptions {
  allowTie?: boolean;
  requireReason?: boolean;
  requireConfidence?: boolean;
  minConfidence?: number;
}

/**
 * Multi-criteria collector options
 */
export interface MultiCriteriaCollectorOptions
  extends FeedbackCollectorOptions {
  criteria: CriterionDefinition[];
  requireAllCriteria?: boolean;
  allowCorrections?: boolean;
}

/**
 * Collect thumbs input
 */
export interface CollectThumbsInput {
  responseId: string;
  conversationId?: string;
  input: string;
  output: string;
  feedback: {
    rating: ThumbsRating;
    comment?: string;
  };
  userId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Collect rating input
 */
export interface CollectRatingInput {
  responseId: string;
  conversationId?: string;
  input: string;
  output: string;
  feedback: {
    rating: StarRating;
    comment?: string;
  };
  userId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Collect preference input
 */
export interface CollectPreferenceInput {
  input: string;
  responseA: {
    id: string;
    content: string;
    model?: string;
  };
  responseB: {
    id: string;
    content: string;
    model?: string;
  };
  preference: PreferenceChoice;
  reason?: string;
  confidence?: number;
  userId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Collect correction input
 */
export interface CollectCorrectionInput {
  responseId: string;
  conversationId?: string;
  input: string;
  output: string;
  correctedOutput: string;
  correctionType: 'factual' | 'grammar' | 'style' | 'completeness' | 'other';
  explanation?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Collect multi-criteria input
 */
export interface CollectMultiCriteriaInput {
  responseId: string;
  conversationId?: string;
  input: string;
  output: string;
  ratings: Record<string, number>;
  corrections?: Record<string, string>;
  overallRating?: StarRating;
  comment?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Feedback store interface
 */
export interface FeedbackStoreInterface {
  save(entry: FeedbackEntry): Promise<string>;
  saveBatch(entries: FeedbackEntry[]): Promise<string[]>;
  get(id: string): Promise<FeedbackEntry | null>;
  query(options: FeedbackQueryOptions): Promise<FeedbackQueryResult>;
  delete(id: string): Promise<boolean>;
  clear(): Promise<void>;
  close(): Promise<void>;
}

/**
 * Feedback query options
 */
export interface FeedbackQueryOptions {
  type?: FeedbackEntry['type'] | FeedbackEntry['type'][];
  userId?: string;
  conversationId?: string;
  responseId?: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
  offset?: number;
  orderBy?: 'timestamp' | 'rating';
  orderDir?: 'asc' | 'desc';
  metadata?: Record<string, unknown>;
}

/**
 * Feedback query result
 */
export interface FeedbackQueryResult {
  entries: FeedbackEntry[];
  total: number;
  hasMore: boolean;
}

/**
 * Aggregation options
 */
export interface AggregationOptions {
  groupBy?: 'model' | 'userId' | 'hour' | 'day' | 'week' | 'month';
  metrics: AggregationMetric[];
  timeRange?: {
    start: number;
    end: number;
  };
  filters?: FeedbackQueryOptions;
}

/**
 * Aggregation metrics
 */
export type AggregationMetric =
  | 'thumbsUpRate'
  | 'avgRating'
  | 'correctionRate'
  | 'preferenceWinRate'
  | 'count'
  | 'avgCriteriaRating';

/**
 * Aggregation result
 */
export interface AggregationResult {
  groupKey: string;
  metrics: Record<AggregationMetric, number>;
  count: number;
}

/**
 * Export format
 */
export type ExportFormat = 'json' | 'csv' | 'jsonl';

/**
 * Export options
 */
export interface ExportOptions {
  format: ExportFormat;
  query?: FeedbackQueryOptions;
  fields?: string[];
  includeMetadata?: boolean;
}

/**
 * Feedback store config
 */
export interface FeedbackStoreConfig {
  type: 'memory' | 'sqlite' | 'postgres';
  path?: string;
  connectionString?: string;
  tableName?: string;
}

/**
 * Zod schemas for validation
 */
export const ThumbsRatingSchema = z.enum(['up', 'down']);
export const StarRatingSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);
export const PreferenceChoiceSchema = z.enum(['A', 'B', 'tie']);

export const CollectThumbsInputSchema = z.object({
  responseId: z.string(),
  conversationId: z.string().optional(),
  input: z.string(),
  output: z.string(),
  feedback: z.object({
    rating: ThumbsRatingSchema,
    comment: z.string().optional(),
  }),
  userId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const CollectPreferenceInputSchema = z.object({
  input: z.string(),
  responseA: z.object({
    id: z.string(),
    content: z.string(),
    model: z.string().optional(),
  }),
  responseB: z.object({
    id: z.string(),
    content: z.string(),
    model: z.string().optional(),
  }),
  preference: PreferenceChoiceSchema,
  reason: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  userId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
