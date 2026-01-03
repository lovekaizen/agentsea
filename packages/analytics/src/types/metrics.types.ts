/**
 * Metrics Types
 *
 * Type definitions for metrics, KPIs, and aggregations.
 */

import type { TimePeriod, TimeRange, TimeGranularity } from './core.types.js';

/**
 * Metric definition
 */
export interface MetricDefinition {
  /** Metric name */
  name: string;
  /** Display name */
  displayName?: string;
  /** Description */
  description?: string;
  /** Calculation expression or function */
  calculation: string | MetricCalculation;
  /** Unit */
  unit?: string;
  /** Format */
  format?: MetricFormat;
  /** Aggregation method */
  aggregation?: AggregationMethod;
  /** Tags */
  tags?: string[];
}

/**
 * Metric calculation function
 */
export type MetricCalculation = (period: TimeRange) => Promise<number>;

/**
 * Metric format
 */
export type MetricFormat =
  | 'number'
  | 'percentage'
  | 'currency'
  | 'duration'
  | 'count';

/**
 * Aggregation method
 */
export type AggregationMethod =
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'count'
  | 'distinct'
  | 'median'
  | 'p95'
  | 'p99';

/**
 * Metric value
 */
export interface MetricValue {
  /** Metric name */
  name: string;
  /** Value */
  value: number;
  /** Formatted value */
  formatted?: string;
  /** Timestamp */
  timestamp: number;
  /** Comparison to previous period */
  comparison?: MetricComparison;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Metric comparison
 */
export interface MetricComparison {
  /** Previous value */
  previousValue: number;
  /** Change (absolute) */
  change: number;
  /** Change percentage */
  changePercent: number;
  /** Direction */
  direction: 'up' | 'down' | 'unchanged';
  /** Is improvement */
  isImprovement?: boolean;
}

/**
 * KPI definition
 */
export interface KPIDefinition {
  /** KPI name */
  name: string;
  /** Display name */
  displayName?: string;
  /** Description */
  description?: string;
  /** Calculation expression */
  calculation: string;
  /** Target value */
  target: number;
  /** Target type */
  targetType?: 'above' | 'below' | 'between' | 'exact';
  /** Warning threshold */
  warningThreshold?: number;
  /** Critical threshold */
  criticalThreshold?: number;
  /** Unit */
  unit?: string;
  /** Format */
  format?: MetricFormat;
}

/**
 * KPI result
 */
export interface KPIResult {
  /** KPI name */
  name: string;
  /** Display name */
  displayName?: string;
  /** Current value */
  value: number;
  /** Formatted value */
  formatted?: string;
  /** Target */
  target: number;
  /** Status */
  status: KPIStatus;
  /** Achievement percentage */
  achievement: number;
  /** Gap to target */
  gap: number;
  /** Trend */
  trend?: MetricTrend;
  /** Period */
  period: TimeRange;
}

/**
 * KPI status
 */
export type KPIStatus = 'on-track' | 'at-risk' | 'off-track' | 'exceeded';

/**
 * Metric trend
 */
export interface MetricTrend {
  /** Direction */
  direction: 'up' | 'down' | 'stable';
  /** Percentage change */
  changePercent: number;
  /** Data points */
  dataPoints: MetricDataPoint[];
}

/**
 * Metric data point
 */
export interface MetricDataPoint {
  /** Timestamp */
  timestamp: number;
  /** Value */
  value: number;
}

/**
 * Metrics query options
 */
export interface MetricsQueryOptions {
  /** Metrics to query */
  metrics: string[];
  /** Time period */
  period?: TimePeriod | TimeRange;
  /** Granularity */
  granularity?: TimeGranularity;
  /** Group by */
  groupBy?: string | string[];
  /** Filters */
  filters?: Record<string, unknown>;
  /** Include comparison */
  includeComparison?: boolean;
  /** Comparison period */
  comparisonPeriod?: TimePeriod | TimeRange;
}

/**
 * Metrics result
 */
export interface MetricsResult {
  /** Metrics */
  metrics: Map<string, MetricValue>;
  /** Time series (if granularity specified) */
  timeSeries?: Map<string, MetricDataPoint[]>;
  /** Grouped results */
  grouped?: Map<string, Map<string, MetricValue>>;
  /** Period */
  period: TimeRange;
}

/**
 * KPI report
 */
export interface KPIReport {
  /** KPIs */
  kpis: KPIResult[];
  /** Overall status */
  overallStatus: KPIStatus;
  /** Summary */
  summary: {
    onTrack: number;
    atRisk: number;
    offTrack: number;
    exceeded: number;
  };
  /** Period */
  period: TimeRange;
  /** Generated at */
  generatedAt: number;
}

/**
 * Custom metric definition
 */
export interface CustomMetricDefinition {
  /** Metric name */
  name: string;
  /** Display name */
  displayName?: string;
  /** Description */
  description?: string;
  /** Calculation function */
  calculate: (period: TimeRange) => Promise<number>;
  /** Unit */
  unit?: string;
  /** Format */
  format?: MetricFormat;
  /** Dependencies (other metrics) */
  dependencies?: string[];
}

/**
 * Dashboard metric
 */
export interface DashboardMetric {
  /** Metric name */
  name: string;
  /** Display name */
  displayName: string;
  /** Value */
  value: number;
  /** Formatted value */
  formatted: string;
  /** Trend */
  trend?: 'up' | 'down' | 'stable';
  /** Change percentage */
  changePercent?: number;
  /** Sparkline data */
  sparkline?: number[];
  /** Status */
  status?: 'good' | 'warning' | 'critical';
}

/**
 * Aggregation options
 */
export interface AggregationOptions {
  /** Field to aggregate */
  field: string;
  /** Aggregation method */
  method: AggregationMethod;
  /** Percentile (for p95, p99) */
  percentile?: number;
  /** Group by */
  groupBy?: string | string[];
  /** Having condition */
  having?: {
    field: string;
    operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
    value: number;
  };
}

/**
 * Benchmark
 */
export interface Benchmark {
  /** Benchmark name */
  name: string;
  /** Metric */
  metric: string;
  /** Benchmark value */
  value: number;
  /** Source */
  source?: 'industry' | 'historical' | 'target' | 'peer';
  /** Percentile */
  percentile?: number;
  /** Valid until */
  validUntil?: number;
}

/**
 * Metric alert
 */
export interface MetricAlert {
  /** Alert ID */
  id: string;
  /** Metric name */
  metric: string;
  /** Condition */
  condition: AlertCondition;
  /** Current value */
  value: number;
  /** Threshold */
  threshold: number;
  /** Severity */
  severity: 'info' | 'warning' | 'critical';
  /** Triggered at */
  triggeredAt: number;
  /** Status */
  status: 'active' | 'resolved' | 'acknowledged';
}

/**
 * Alert condition
 */
export interface AlertCondition {
  /** Operator */
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'ne';
  /** Threshold value */
  threshold: number;
  /** Window (time period) */
  window?: string;
  /** Consecutive occurrences */
  consecutive?: number;
}
