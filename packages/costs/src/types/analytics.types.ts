/**
 * Analytics Types
 *
 * Type definitions for cost analytics and forecasting.
 */

import type {
  AIProvider,
  TimeGranularity,
  CostByDimension,
} from './cost.types.js';
import type { AttributionDimension } from './attribution.types.js';

/**
 * Analytics time range preset
 */
export type TimeRangePreset =
  | 'today'
  | 'yesterday'
  | 'last7days'
  | 'last30days'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisQuarter'
  | 'lastQuarter'
  | 'thisYear'
  | 'lastYear'
  | 'custom';

/**
 * Analytics query
 */
export interface AnalyticsQuery {
  /** Time range preset */
  preset?: TimeRangePreset;
  /** Custom start date */
  startDate?: Date;
  /** Custom end date */
  endDate?: Date;
  /** Time granularity */
  granularity?: TimeGranularity;
  /** Group by dimensions */
  groupBy?: AttributionDimension[];
  /** Filters */
  filters?: AnalyticsFilter;
  /** Metrics to include */
  metrics?: AnalyticsMetric[];
  /** Compare with previous period */
  comparePrevious?: boolean;
}

/**
 * Analytics filter
 */
export interface AnalyticsFilter {
  /** Providers */
  providers?: AIProvider[];
  /** Models */
  models?: string[];
  /** Users */
  userIds?: string[];
  /** Agents */
  agentIds?: string[];
  /** Projects */
  projectIds?: string[];
  /** Teams */
  teamIds?: string[];
  /** Features */
  features?: string[];
  /** Environment */
  environment?: string;
  /** Labels */
  labels?: Record<string, string>;
}

/**
 * Analytics metrics
 */
export type AnalyticsMetric =
  | 'totalCost'
  | 'inputCost'
  | 'outputCost'
  | 'totalTokens'
  | 'inputTokens'
  | 'outputTokens'
  | 'requestCount'
  | 'errorRate'
  | 'avgCostPerRequest'
  | 'avgTokensPerRequest'
  | 'avgLatency'
  | 'p50Latency'
  | 'p95Latency'
  | 'p99Latency';

/**
 * Analytics result
 */
export interface AnalyticsResult {
  /** Query that produced this result */
  query: AnalyticsQuery;
  /** Time range */
  timeRange: {
    start: Date;
    end: Date;
  };
  /** Summary metrics */
  summary: AnalyticsSummary;
  /** Time series data */
  timeSeries?: AnalyticsTimeSeries[];
  /** Breakdown by dimension */
  breakdowns?: Record<AttributionDimension, CostByDimension[]>;
  /** Comparison with previous period */
  comparison?: AnalyticsComparison;
}

/**
 * Analytics summary
 */
export interface AnalyticsSummary {
  /** Total cost */
  totalCost: number;
  /** Input cost */
  inputCost: number;
  /** Output cost */
  outputCost: number;
  /** Total tokens */
  totalTokens: number;
  /** Input tokens */
  inputTokens: number;
  /** Output tokens */
  outputTokens: number;
  /** Request count */
  requestCount: number;
  /** Success count */
  successCount: number;
  /** Error count */
  errorCount: number;
  /** Error rate */
  errorRate: number;
  /** Average cost per request */
  avgCostPerRequest: number;
  /** Average tokens per request */
  avgTokensPerRequest: number;
  /** Average latency */
  avgLatency?: number;
  /** P50 latency */
  p50Latency?: number;
  /** P95 latency */
  p95Latency?: number;
  /** P99 latency */
  p99Latency?: number;
  /** Currency */
  currency: string;
}

/**
 * Analytics time series point
 */
export interface AnalyticsTimeSeries {
  /** Timestamp */
  timestamp: Date;
  /** Metrics for this point */
  metrics: Partial<AnalyticsSummary>;
}

/**
 * Analytics comparison
 */
export interface AnalyticsComparison {
  /** Previous period */
  previousPeriod: {
    start: Date;
    end: Date;
  };
  /** Previous metrics */
  previous: AnalyticsSummary;
  /** Changes */
  changes: {
    totalCost: ChangeMetric;
    totalTokens: ChangeMetric;
    requestCount: ChangeMetric;
    avgCostPerRequest: ChangeMetric;
    errorRate: ChangeMetric;
  };
}

/**
 * Change metric
 */
export interface ChangeMetric {
  /** Absolute change */
  absolute: number;
  /** Percentage change */
  percentage: number;
  /** Trend direction */
  trend: 'up' | 'down' | 'stable';
}

/**
 * Forecast configuration
 */
export interface ForecastConfig {
  /** Forecast horizon in periods */
  horizon: number;
  /** Granularity */
  granularity: TimeGranularity;
  /** Include confidence intervals */
  includeConfidenceInterval?: boolean;
  /** Confidence level (0-1) */
  confidenceLevel?: number;
  /** Method to use */
  method?: ForecastMethod;
  /** Seasonality detection */
  detectSeasonality?: boolean;
}

/**
 * Forecast method
 */
export type ForecastMethod =
  | 'linear'
  | 'exponential'
  | 'moving-average'
  | 'holt-winters'
  | 'auto';

/**
 * Forecast result
 */
export interface ForecastResult {
  /** Metric being forecasted */
  metric: AnalyticsMetric;
  /** Forecast method used */
  method: ForecastMethod;
  /** Historical data used */
  historical: ForecastDataPoint[];
  /** Forecasted values */
  forecast: ForecastDataPoint[];
  /** Seasonality detected */
  seasonality?: SeasonalityInfo;
  /** Accuracy metrics */
  accuracy?: ForecastAccuracy;
  /** Generated at */
  generatedAt: Date;
}

/**
 * Forecast data point
 */
export interface ForecastDataPoint {
  /** Timestamp */
  timestamp: Date;
  /** Value */
  value: number;
  /** Lower confidence bound */
  lowerBound?: number;
  /** Upper confidence bound */
  upperBound?: number;
  /** Is forecasted (vs historical) */
  isForecast: boolean;
}

/**
 * Seasonality information
 */
export interface SeasonalityInfo {
  /** Detected period */
  period: number;
  /** Period unit */
  unit: TimeGranularity;
  /** Strength (0-1) */
  strength: number;
  /** Pattern description */
  pattern?: string;
}

/**
 * Forecast accuracy
 */
export interface ForecastAccuracy {
  /** Mean Absolute Error */
  mae: number;
  /** Mean Absolute Percentage Error */
  mape: number;
  /** Root Mean Square Error */
  rmse: number;
  /** R-squared */
  r2: number;
}

/**
 * Anomaly detection configuration
 */
export interface AnomalyDetectionConfig {
  /** Sensitivity (0-1, higher = more sensitive) */
  sensitivity?: number;
  /** Minimum data points required */
  minDataPoints?: number;
  /** Method */
  method?: 'zscore' | 'iqr' | 'isolation-forest' | 'auto';
  /** Metrics to monitor */
  metrics?: AnalyticsMetric[];
}

/**
 * Detected anomaly
 */
export interface Anomaly {
  /** Anomaly ID */
  id: string;
  /** Metric */
  metric: AnalyticsMetric;
  /** Timestamp */
  timestamp: Date;
  /** Actual value */
  actualValue: number;
  /** Expected value */
  expectedValue: number;
  /** Deviation */
  deviation: number;
  /** Standard deviations from mean */
  zScore: number;
  /** Severity */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Description */
  description: string;
  /** Related dimensions */
  dimensions?: Record<AttributionDimension, string>;
  /** Detected at */
  detectedAt: Date;
  /** Acknowledged */
  acknowledged: boolean;
}

/**
 * Dashboard widget configuration
 */
export interface DashboardWidget {
  /** Widget ID */
  id: string;
  /** Widget type */
  type: 'metric' | 'chart' | 'table' | 'trend' | 'breakdown' | 'forecast';
  /** Title */
  title: string;
  /** Widget configuration */
  config: Record<string, unknown>;
  /** Position */
  position: { x: number; y: number; w: number; h: number };
}

/**
 * Dashboard configuration
 */
export interface DashboardConfig {
  /** Dashboard ID */
  id: string;
  /** Dashboard name */
  name: string;
  /** Description */
  description?: string;
  /** Widgets */
  widgets: DashboardWidget[];
  /** Default time range */
  defaultTimeRange: TimeRangePreset;
  /** Auto refresh interval (seconds, 0 = disabled) */
  refreshInterval?: number;
  /** Owner */
  owner?: string;
  /** Shared with */
  sharedWith?: string[];
}
