/**
 * Clustering Types
 *
 * Type definitions for topic clustering, pattern detection, and trend analysis.
 */

import type {
  Conversation,
  TimePeriod,
  TimeRange,
  TimeGranularity,
} from './core.types.js';

/**
 * Cluster
 */
export interface Cluster {
  /** Cluster ID */
  id: string;
  /** Cluster name/label */
  name: string;
  /** Size (number of items) */
  size: number;
  /** Keywords */
  keywords: string[];
  /** Representative text/item */
  representative?: string;
  /** Centroid (if applicable) */
  centroid?: number[];
  /** Average satisfaction */
  avgSatisfaction?: number;
  /** Success rate */
  successRate?: number;
  /** Conversation IDs */
  conversationIds?: string[];
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Clustering method
 */
export type ClusteringMethod =
  | 'kmeans'
  | 'hdbscan'
  | 'dbscan'
  | 'agglomerative'
  | 'lda'
  | 'nmf';

/**
 * Topic clusterer configuration
 */
export interface TopicClustererConfig {
  /** Clustering method */
  method?: ClusteringMethod;
  /** Embedding model */
  embeddingModel?: string;
  /** Minimum cluster size */
  minClusterSize?: number;
  /** Number of clusters (for kmeans) */
  numClusters?: number;
  /** Epsilon (for DBSCAN) */
  epsilon?: number;
  /** Min samples (for DBSCAN/HDBSCAN) */
  minSamples?: number;
  /** Fields to cluster on */
  fields?: string[];
  /** Cache embeddings */
  cacheEmbeddings?: boolean;
}

/**
 * Clustering options
 */
export interface ClusteringOptions {
  /** Conversations to cluster */
  conversations?: Conversation[];
  /** Time period */
  period?: TimePeriod | TimeRange;
  /** Fields to use */
  fields?: string[];
  /** Filter */
  filter?: Record<string, unknown>;
  /** Max clusters */
  maxClusters?: number;
}

/**
 * Clustering result
 */
export interface ClusteringResult {
  /** Clusters */
  clusters: Cluster[];
  /** Noise/unclustered items */
  noise?: string[];
  /** Silhouette score (quality metric) */
  silhouetteScore?: number;
  /** Total items clustered */
  totalItems: number;
  /** Metadata */
  metadata: {
    method: ClusteringMethod;
    params: Record<string, unknown>;
    executedAt: number;
    durationMs: number;
  };
}

/**
 * Pattern
 */
export interface Pattern {
  /** Pattern ID */
  id: string;
  /** Pattern type */
  type: PatternType;
  /** Pattern description */
  description: string;
  /** Support (frequency) */
  support: number;
  /** Confidence */
  confidence: number;
  /** Elements in pattern */
  elements: PatternElement[];
  /** First seen */
  firstSeen: number;
  /** Last seen */
  lastSeen: number;
  /** Trend */
  trend?: 'increasing' | 'decreasing' | 'stable';
}

/**
 * Pattern type
 */
export type PatternType =
  | 'sequence'
  | 'association'
  | 'temporal'
  | 'behavioral'
  | 'anomaly';

/**
 * Pattern element
 */
export interface PatternElement {
  /** Element type */
  type: string;
  /** Element value */
  value: string;
  /** Position (for sequences) */
  position?: number;
}

/**
 * Pattern detection options
 */
export interface PatternDetectionOptions {
  /** Minimum support */
  minSupport?: number;
  /** Minimum confidence */
  minConfidence?: number;
  /** Pattern types to detect */
  types?: PatternType[];
  /** Time period */
  period?: TimePeriod | TimeRange;
  /** Max pattern length */
  maxLength?: number;
}

/**
 * Pattern detection result
 */
export interface PatternDetectionResult {
  /** Patterns found */
  patterns: Pattern[];
  /** Total items analyzed */
  totalItems: number;
  /** Top patterns */
  topPatterns: Pattern[];
  /** Emerging patterns */
  emergingPatterns: Pattern[];
}

/**
 * Anomaly
 */
export interface Anomaly {
  /** Anomaly ID */
  id: string;
  /** Anomaly type */
  type: AnomalyType;
  /** Description */
  description: string;
  /** Severity */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Score */
  score: number;
  /** Detected at */
  detectedAt: number;
  /** Related item IDs */
  relatedItems?: string[];
  /** Expected value */
  expected?: number;
  /** Actual value */
  actual?: number;
  /** Deviation */
  deviation?: number;
}

/**
 * Anomaly type
 */
export type AnomalyType =
  | 'volume_spike'
  | 'volume_drop'
  | 'sentiment_shift'
  | 'success_rate_change'
  | 'latency_increase'
  | 'new_topic'
  | 'unusual_pattern'
  | 'outlier';

/**
 * Anomaly detection options
 */
export interface AnomalyDetectionOptions {
  /** Metric to monitor */
  metric?: string;
  /** Sensitivity */
  sensitivity?: 'low' | 'medium' | 'high';
  /** Time period */
  period?: TimePeriod | TimeRange;
  /** Baseline period */
  baselinePeriod?: TimePeriod | TimeRange;
  /** Anomaly types to detect */
  types?: AnomalyType[];
  /** Min score to report */
  minScore?: number;
}

/**
 * Anomaly detection result
 */
export interface AnomalyDetectionResult {
  /** Anomalies found */
  anomalies: Anomaly[];
  /** Total points analyzed */
  totalPoints: number;
  /** Baseline stats */
  baseline?: {
    mean: number;
    stdDev: number;
    min: number;
    max: number;
  };
}

/**
 * Trend
 */
export interface Trend {
  /** Trend ID */
  id: string;
  /** Topic/subject */
  topic: string;
  /** Direction */
  direction: 'up' | 'down' | 'stable';
  /** Growth percentage */
  growthPercent: number;
  /** Current volume */
  currentVolume: number;
  /** Previous volume */
  previousVolume: number;
  /** First seen */
  firstSeen?: number;
  /** Momentum */
  momentum?: number;
  /** Related topics */
  relatedTopics?: string[];
}

/**
 * Trend analysis options
 */
export interface TrendAnalysisOptions {
  /** Compare window (days) */
  compareWindow?: number;
  /** Baseline window (days) */
  baselineWindow?: number;
  /** Minimum growth/decline */
  minChange?: number;
  /** Granularity */
  granularity?: TimeGranularity;
  /** Topics to track */
  topics?: string[];
  /** Include emerging */
  includeEmerging?: boolean;
  /** Include declining */
  includeDeclining?: boolean;
}

/**
 * Trend analysis result
 */
export interface TrendAnalysisResult {
  /** All trends */
  trends: Trend[];
  /** Emerging topics */
  emerging: Trend[];
  /** Declining topics */
  declining: Trend[];
  /** Stable topics */
  stable: Trend[];
  /** Time series data */
  timeSeries?: TrendTimeSeries[];
}

/**
 * Trend time series
 */
export interface TrendTimeSeries {
  /** Topic */
  topic: string;
  /** Data points */
  points: Array<{
    timestamp: number;
    value: number;
  }>;
}

/**
 * Topic evolution
 */
export interface TopicEvolution {
  /** Topic */
  topic: string;
  /** Evolution stages */
  stages: Array<{
    timestamp: number;
    volume: number;
    keywords: string[];
    sentiment?: number;
  }>;
  /** Lifecycle stage */
  lifecycleStage: 'emerging' | 'growing' | 'mature' | 'declining' | 'dormant';
  /** Predicted trajectory */
  prediction?: {
    nextWeek: number;
    nextMonth: number;
    confidence: number;
  };
}
