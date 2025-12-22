/**
 * Analytics Types
 *
 * Type definitions for cache analytics and monitoring.
 */

/**
 * Comprehensive analytics data
 */
export interface AnalyticsData {
  /** Total cache hits */
  totalHits: number;
  /** Total cache misses */
  totalMisses: number;
  /** Exact match hits */
  exactHits: number;
  /** Semantic match hits */
  semanticHits: number;
  /** Overall hit rate (0-1) */
  hitRate: number;
  /** Average lookup latency in ms */
  avgLatencyMs: number;
  /** P50 latency */
  p50LatencyMs: number;
  /** P95 latency */
  p95LatencyMs: number;
  /** P99 latency */
  p99LatencyMs: number;
  /** Total tokens saved from cache hits */
  totalTokensSaved: number;
  /** Estimated cost savings in USD */
  estimatedCostSavingsUSD: number;
  /** Hit distribution by model */
  topModels: Array<{ model: string; hits: number }>;
  /** Hit distribution by namespace */
  topNamespaces: Array<{ namespace: string; hits: number }>;
  /** Hourly statistics */
  hourlyStats: Array<{
    hour: number;
    hits: number;
    misses: number;
    avgLatencyMs: number;
  }>;
}

/**
 * Cost savings report
 */
export interface CostSavingsReport {
  /** Time period */
  period: string;
  /** Total requests */
  totalRequests: number;
  /** Requests served from cache */
  cachedRequests: number;
  /** Cache hit rate */
  hitRate: number;
  /** Input tokens saved */
  inputTokensSaved: number;
  /** Output tokens saved */
  outputTokensSaved: number;
  /** Total tokens saved */
  totalTokensSaved: number;
  /** Estimated cost without cache */
  estimatedCostWithoutCache: number;
  /** Actual cost with cache */
  actualCostWithCache: number;
  /** Total savings */
  costSaved: number;
  /** Percentage reduction */
  reductionPercent: number;
}

/**
 * Model pricing configuration
 */
export interface ModelPricing {
  /** Cost per 1K input tokens */
  inputPer1K: number;
  /** Cost per 1K output tokens */
  outputPer1K: number;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  /** Average cache lookup time */
  avgLookupMs: number;
  /** Average embedding generation time */
  avgEmbeddingMs: number;
  /** Average store read time */
  avgStoreReadMs: number;
  /** Average store write time */
  avgStoreWriteMs: number;
  /** P50 latency */
  p50LatencyMs: number;
  /** P95 latency */
  p95LatencyMs: number;
  /** P99 latency */
  p99LatencyMs: number;
  /** Total operations */
  totalOperations: number;
  /** Failed operations */
  failedOperations: number;
  /** Error rate */
  errorRate: number;
}

/**
 * Hit event for analytics tracking
 */
export interface HitEvent {
  timestamp: number;
  type: 'exact' | 'semantic';
  model: string;
  namespace?: string;
  similarity?: number;
  latencyMs: number;
  tokensSaved: number;
}

/**
 * Miss event for analytics tracking
 */
export interface MissEvent {
  timestamp: number;
  model: string;
  namespace?: string;
  latencyMs: number;
  reason: 'not_found' | 'below_threshold' | 'expired' | 'error';
}

/**
 * Analytics query options
 */
export interface AnalyticsQueryOptions {
  /** Start time (Unix timestamp) */
  startTime?: number;
  /** End time (Unix timestamp) */
  endTime?: number;
  /** Filter by model */
  model?: string;
  /** Filter by namespace */
  namespace?: string;
  /** Group by field */
  groupBy?: 'model' | 'namespace' | 'hour' | 'day';
}

/**
 * Analytics export format
 */
export type AnalyticsExportFormat = 'json' | 'csv' | 'prometheus';

/**
 * Analytics configuration
 */
export interface AnalyticsConfig {
  /** Enable analytics tracking */
  enabled?: boolean;
  /** Sample rate (0-1, 1 = track all) */
  sampleRate?: number;
  /** Retention period in seconds */
  retentionSeconds?: number;
  /** Flush interval for batched writes */
  flushIntervalMs?: number;
  /** Model pricing for cost calculations */
  modelPricing?: Record<string, ModelPricing>;
}
