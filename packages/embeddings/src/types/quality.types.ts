/**
 * Quality Types
 *
 * Types for embedding quality metrics and drift detection.
 */

import type { EmbeddingVector } from './embedding.types.js';

/**
 * Quality metric type
 */
export type QualityMetricType =
  | 'coherence'
  | 'diversity'
  | 'coverage'
  | 'stability'
  | 'retrieval_accuracy'
  | 'semantic_similarity'
  | 'cluster_quality';

/**
 * Quality score
 */
export interface QualityScore {
  /** Metric type */
  metric: QualityMetricType;
  /** Score (0-1) */
  score: number;
  /** Score interpretation */
  interpretation: 'poor' | 'fair' | 'good' | 'excellent';
  /** Threshold used */
  threshold: number;
  /** Passed threshold */
  passed: boolean;
  /** Sample size */
  sampleSize: number;
  /** Computed at */
  computedAt: number;
  /** Details */
  details?: Record<string, unknown>;
}

/**
 * Quality report
 */
export interface QualityReport {
  /** Report ID */
  id: string;
  /** Report name */
  name: string;
  /** Model evaluated */
  model: string;
  /** Version evaluated */
  version?: string;
  /** Individual scores */
  scores: QualityScore[];
  /** Overall score (0-1) */
  overallScore: number;
  /** Overall interpretation */
  overallInterpretation: 'poor' | 'fair' | 'good' | 'excellent';
  /** Recommendations */
  recommendations: string[];
  /** Created at */
  createdAt: number;
  /** Sample count */
  sampleCount: number;
  /** Report metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Drift detection result
 */
export interface DriftDetectionResult {
  /** Drift detected */
  driftDetected: boolean;
  /** Drift severity */
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  /** Drift score (0-1, higher = more drift) */
  driftScore: number;
  /** Affected dimensions percentage */
  affectedDimensionsPercent: number;
  /** Mean shift */
  meanShift: number;
  /** Variance change */
  varianceChange: number;
  /** Distribution comparison */
  distributionComparison: DistributionComparison;
  /** Detected at */
  detectedAt: number;
  /** Reference timestamp */
  referenceTimestamp: number;
  /** Current timestamp */
  currentTimestamp: number;
  /** Recommendations */
  recommendations: string[];
  /** Details */
  details?: Record<string, unknown>;
}

/**
 * Distribution comparison
 */
export interface DistributionComparison {
  /** KL divergence */
  klDivergence: number;
  /** JS divergence */
  jsDivergence: number;
  /** Wasserstein distance */
  wassersteinDistance: number;
  /** Cosine similarity of means */
  meanCosineSimilarity: number;
  /** Per-dimension stats */
  dimensionStats?: DimensionStats[];
}

/**
 * Per-dimension statistics
 */
export interface DimensionStats {
  /** Dimension index */
  dimension: number;
  /** Reference mean */
  referenceMean: number;
  /** Current mean */
  currentMean: number;
  /** Mean change */
  meanChange: number;
  /** Reference variance */
  referenceVariance: number;
  /** Current variance */
  currentVariance: number;
  /** Variance change */
  varianceChange: number;
  /** Significant change */
  significantChange: boolean;
}

/**
 * Reference distribution
 */
export interface ReferenceDistribution {
  /** Distribution ID */
  id: string;
  /** Model */
  model: string;
  /** Version */
  version?: string;
  /** Sample count */
  sampleCount: number;
  /** Mean vector */
  mean: EmbeddingVector;
  /** Variance vector */
  variance: EmbeddingVector;
  /** Covariance matrix (optional, for full analysis) */
  covariance?: number[][];
  /** Created at */
  createdAt: number;
  /** Valid until */
  validUntil?: number;
  /** Distribution metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Drift monitor configuration
 */
export interface DriftMonitorConfig {
  /** Check interval (ms) */
  checkInterval?: number;
  /** Sample size for checks */
  sampleSize?: number;
  /** Drift threshold */
  driftThreshold?: number;
  /** Alert on severity */
  alertSeverity?: 'low' | 'medium' | 'high' | 'critical';
  /** Enable automatic baseline updates */
  autoUpdateBaseline?: boolean;
  /** Baseline update interval (ms) */
  baselineUpdateInterval?: number;
  /** Alert callback */
  onAlert?: (result: DriftDetectionResult) => void;
}

/**
 * Quality evaluation options
 */
export interface QualityEvaluationOptions {
  /** Metrics to evaluate */
  metrics?: QualityMetricType[];
  /** Sample size */
  sampleSize?: number;
  /** Reference embeddings (for comparison) */
  referenceEmbeddings?: EmbeddingVector[];
  /** Reference texts (for coherence) */
  referenceTexts?: string[];
  /** Ground truth labels (for accuracy) */
  groundTruth?: GroundTruthData;
  /** Custom thresholds */
  thresholds?: Record<QualityMetricType, number>;
}

/**
 * Ground truth data for evaluation
 */
export interface GroundTruthData {
  /** Query-document pairs */
  pairs: Array<{
    query: string;
    relevantDocs: string[];
    irrelevantDocs?: string[];
  }>;
  /** Labels (for classification) */
  labels?: Array<{
    text: string;
    label: string;
  }>;
}

/**
 * Coherence score details
 */
export interface CoherenceDetails {
  /** Intra-cluster coherence */
  intraClusterCoherence: number;
  /** Topic coherence */
  topicCoherence: number;
  /** Semantic consistency */
  semanticConsistency: number;
}

/**
 * Diversity score details
 */
export interface DiversityDetails {
  /** Unique coverage */
  uniqueCoverage: number;
  /** Pairwise diversity */
  pairwiseDiversity: number;
  /** Cluster spread */
  clusterSpread: number;
}

/**
 * Retrieval accuracy details
 */
export interface RetrievalAccuracyDetails {
  /** Precision at K */
  precisionAtK: Record<number, number>;
  /** Recall at K */
  recallAtK: Record<number, number>;
  /** Mean reciprocal rank */
  mrr: number;
  /** Normalized DCG */
  ndcg: number;
}

/**
 * Cluster quality details
 */
export interface ClusterQualityDetails {
  /** Silhouette score */
  silhouetteScore: number;
  /** Calinski-Harabasz index */
  calinskiHarabaszIndex: number;
  /** Davies-Bouldin index */
  daviesBouldinIndex: number;
  /** Number of clusters */
  numClusters: number;
}

/**
 * Quality alert
 */
export interface QualityAlert {
  /** Alert ID */
  id: string;
  /** Alert type */
  type: 'quality_degradation' | 'drift_detected' | 'threshold_breach';
  /** Severity */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Message */
  message: string;
  /** Metric involved */
  metric?: QualityMetricType;
  /** Current value */
  currentValue?: number;
  /** Threshold value */
  thresholdValue?: number;
  /** Created at */
  createdAt: number;
  /** Acknowledged */
  acknowledged: boolean;
  /** Acknowledged at */
  acknowledgedAt?: number;
  /** Alert metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Quality monitoring options
 */
export interface QualityMonitoringOptions {
  /** Enable monitoring */
  enabled?: boolean;
  /** Check interval (ms) */
  checkInterval?: number;
  /** Metrics to monitor */
  metrics?: QualityMetricType[];
  /** Alert thresholds */
  thresholds?: Record<QualityMetricType, number>;
  /** Alert callback */
  onAlert?: (alert: QualityAlert) => void;
  /** Report callback */
  onReport?: (report: QualityReport) => void;
}

/**
 * Benchmark result
 */
export interface BenchmarkResult {
  /** Benchmark name */
  name: string;
  /** Model benchmarked */
  model: string;
  /** Dataset used */
  dataset: string;
  /** Metrics */
  metrics: Record<string, number>;
  /** Latency stats */
  latency: {
    p50: number;
    p95: number;
    p99: number;
    mean: number;
  };
  /** Throughput (items/sec) */
  throughput: number;
  /** Total items */
  totalItems: number;
  /** Duration (ms) */
  durationMs: number;
  /** Timestamp */
  timestamp: number;
}
