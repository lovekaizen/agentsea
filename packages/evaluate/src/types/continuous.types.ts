/**
 * Continuous Evaluation Types
 *
 * Types for continuous monitoring, alerts, A/B testing, and regression detection.
 */

/**
 * Continuous evaluation config
 */
export interface ContinuousEvalConfig {
  pipeline: EvaluationPipelineRef;
  sampleRate: number;
  schedule?: string; // cron expression
  storage?: 'memory' | 'sqlite' | 'postgres';
  storagePath?: string;
  retentionDays?: number;
}

/**
 * Evaluation pipeline reference
 */
export interface EvaluationPipelineRef {
  evaluate(input: EvalInput): Promise<EvalOutput>;
}

/**
 * Eval input
 */
export interface EvalInput {
  input: string;
  output: string;
  context?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Eval output
 */
export interface EvalOutput {
  scores: Record<string, number>;
  passed: boolean;
  durationMs: number;
}

/**
 * Monitoring status
 */
export type MonitoringStatus = 'stopped' | 'running' | 'paused' | 'error';

/**
 * Continuous eval stats
 */
export interface ContinuousEvalStats {
  status: MonitoringStatus;
  startedAt?: number;
  lastEvalAt?: number;
  totalEvaluations: number;
  passRate: number;
  avgScores: Record<string, number>;
  alertsTriggered: number;
}

/**
 * Alert channel type
 */
export type AlertChannelType = 'slack' | 'email' | 'webhook' | 'pagerduty';

/**
 * Alert channel config
 */
export interface AlertChannelConfig {
  type: AlertChannelType;
  webhook?: string;
  to?: string[];
  apiKey?: string;
  channel?: string;
  /** SMTP transport settings for the `email` channel (requires `nodemailer`). */
  smtp?: {
    host: string;
    port?: number;
    secure?: boolean;
    auth?: { user: string; pass: string };
  };
  /** From address for the `email` channel. Defaults to the SMTP auth user. */
  from?: string;
  /**
   * PagerDuty Events API v2 routing (integration) key for the `pagerduty`
   * channel. Falls back to `apiKey` when not set.
   */
  routingKey?: string;
}

/**
 * Alert rule
 */
export interface AlertRule {
  metric: string;
  threshold: number;
  direction: 'above' | 'below';
  window?: number;
  minSamples?: number;
  severity?: 'info' | 'warning' | 'critical';
}

/**
 * Alert manager config
 */
export interface AlertManagerConfig {
  channels: AlertChannelConfig[];
  rules?: Record<string, AlertRule>;
  cooldownMs?: number;
  groupingWindow?: number;
}

/**
 * Alert
 */
export interface Alert {
  id: string;
  rule: AlertRule;
  metric: string;
  currentValue: number;
  threshold: number;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  triggeredAt: number;
  resolvedAt?: number;
  acknowledged?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Alert notification
 */
export interface AlertNotification {
  alertId: string;
  channel: AlertChannelType;
  sentAt: number;
  success: boolean;
  error?: string;
}

/**
 * Regression detector config
 */
export interface RegressionDetectorConfig {
  baseline: BaselineMetrics;
  sensitivity: 'low' | 'medium' | 'high';
  windowSize: number;
  minSamples?: number;
  pValueThreshold?: number;
}

/**
 * Baseline metrics
 */
export interface BaselineMetrics {
  metrics: Record<string, MetricBaseline>;
  sampleCount: number;
  timestamp: number;
}

/**
 * Metric baseline
 */
export interface MetricBaseline {
  mean: number;
  std: number;
  min: number;
  max: number;
  p50: number;
  p90: number;
  p95: number;
}

/**
 * Regression result
 */
export interface RegressionResult {
  detected: boolean;
  regressions: MetricRegression[];
  improvements: MetricImprovement[];
  unchanged: string[];
}

/**
 * Metric regression
 */
export interface MetricRegression {
  metric: string;
  baselineValue: number;
  currentValue: number;
  changePercent: number;
  pValue: number;
  severity: 'minor' | 'moderate' | 'severe';
}

/**
 * Metric improvement
 */
export interface MetricImprovement {
  metric: string;
  baselineValue: number;
  currentValue: number;
  changePercent: number;
  pValue: number;
}

/**
 * A/B test config
 */
export interface ABTestConfig {
  name: string;
  description?: string;
  variants: ABTestVariants;
  trafficSplit: number;
  metrics: string[];
  minSamples: number;
  significanceLevel?: number;
  maxDuration?: number;
}

/**
 * A/B test variants
 */
export interface ABTestVariants {
  control: VariantConfig;
  treatment: VariantConfig;
}

/**
 * Variant config
 */
export interface VariantConfig {
  name?: string;
  model?: string;
  prompt?: string;
  parameters?: Record<string, unknown>;
}

/**
 * A/B test status
 */
export type ABTestStatus =
  | 'draft'
  | 'running'
  | 'paused'
  | 'completed'
  | 'cancelled';

/**
 * A/B test
 */
export interface ABTest {
  id: string;
  name: string;
  config: ABTestConfig;
  status: ABTestStatus;
  startedAt?: number;
  completedAt?: number;
  results?: ABTestResults;
}

/**
 * A/B test results
 */
export interface ABTestResults {
  controlSamples: number;
  treatmentSamples: number;
  metrics: Record<string, ABMetricResult>;
  winner: 'control' | 'treatment' | 'none';
  isSignificant: boolean;
  confidence: number;
  recommendation: string;
}

/**
 * A/B metric result
 */
export interface ABMetricResult {
  control: MetricSummary;
  treatment: MetricSummary;
  difference: number;
  differencePercent: number;
  pValue: number;
  isSignificant: boolean;
  winner: 'control' | 'treatment' | 'none';
}

/**
 * Metric summary
 */
export interface MetricSummary {
  mean: number;
  std: number;
  sampleCount: number;
  confidenceInterval: [number, number];
}

/**
 * Sample assignment
 */
export interface SampleAssignment {
  variant: 'control' | 'treatment';
  testId: string;
  assignedAt: number;
}

/**
 * Time series data point
 */
export interface TimeSeriesPoint {
  timestamp: number;
  value: number;
  metadata?: Record<string, unknown>;
}

/**
 * Time series
 */
export interface TimeSeries {
  metric: string;
  points: TimeSeriesPoint[];
  aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count';
  interval?: number;
}

/**
 * Dashboard update
 */
export interface DashboardUpdate {
  timestamp: number;
  status: MonitoringStatus;
  metrics: Record<string, number>;
  recentAlerts: Alert[];
  activeTests: ABTest[];
  regressions?: RegressionResult;
}

/**
 * Historical query options
 */
export interface HistoricalQueryOptions {
  metric: string;
  startTime: number;
  endTime: number;
  interval?: 'minute' | 'hour' | 'day' | 'week';
  aggregation?: 'avg' | 'min' | 'max' | 'sum' | 'count';
}

/**
 * Schedule config
 */
export interface ScheduleConfig {
  cron?: string;
  interval?: number;
  timezone?: string;
  immediate?: boolean;
}

/**
 * Continuous eval event types
 */
export type ContinuousEvalEventType =
  | 'eval:started'
  | 'eval:completed'
  | 'eval:error'
  | 'alert:triggered'
  | 'alert:resolved'
  | 'regression:detected'
  | 'test:started'
  | 'test:completed'
  | 'test:significant';

/**
 * Continuous eval event
 */
export interface ContinuousEvalEvent {
  type: ContinuousEvalEventType;
  data: Record<string, unknown>;
  timestamp: number;
}
