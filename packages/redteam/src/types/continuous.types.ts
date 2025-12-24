/**
 * Continuous Testing Types for Ongoing Security Monitoring
 */

import type { Severity } from './attack.types.js';
import type { TestSuiteResult } from './test.types.js';
import type { ScanResult } from './scanning.types.js';
import type { BenchmarkResult } from './benchmark.types.js';
import type { ComplianceCheckResult } from './compliance.types.js';

/**
 * Schedule frequency
 */
export type ScheduleFrequency =
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'on_deploy'
  | 'on_change'
  | 'custom';

/**
 * Run status
 */
export type RunStatus =
  | 'scheduled'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'skipped';

/**
 * Alert severity
 */
export type AlertSeverity = 'critical' | 'warning' | 'info';

/**
 * Continuous testing configuration
 */
export interface ContinuousTestingConfig {
  /** Enable continuous testing */
  enabled: boolean;
  /** Test suites to run */
  testSuites: string[];
  /** Scans to run */
  scans?: string[];
  /** Benchmarks to run */
  benchmarks?: string[];
  /** Compliance checks to run */
  complianceChecks?: string[];
  /** Schedule */
  schedule: ScheduleConfig;
  /** Triggers */
  triggers?: TriggerConfig[];
  /** Alert configuration */
  alerts: AlertConfig;
  /** Retention policy */
  retention?: RetentionConfig;
  /** Parallelization */
  parallel?: boolean;
  /** Max parallel runs */
  maxParallel?: number;
  /** Fail threshold */
  failThreshold?: FailThreshold;
}

/**
 * Schedule configuration
 */
export interface ScheduleConfig {
  /** Frequency */
  frequency: ScheduleFrequency;
  /** Cron expression (for custom) */
  cronExpression?: string;
  /** Time of day (HH:mm) */
  timeOfDay?: string;
  /** Days of week (0-6, Sunday=0) */
  daysOfWeek?: number[];
  /** Day of month (1-31) */
  dayOfMonth?: number;
  /** Timezone */
  timezone?: string;
  /** Skip if previous run still running */
  skipIfRunning?: boolean;
  /** Max duration before timeout (ms) */
  maxDuration?: number;
}

/**
 * Trigger configuration
 */
export interface TriggerConfig {
  /** Trigger type */
  type:
    | 'webhook'
    | 'git_push'
    | 'pr_merge'
    | 'deployment'
    | 'schedule'
    | 'manual'
    | 'api';
  /** Trigger name */
  name: string;
  /** Enabled */
  enabled: boolean;
  /** Conditions */
  conditions?: TriggerCondition[];
  /** Webhook URL (for webhook triggers) */
  webhookUrl?: string;
  /** Secret for webhook validation */
  webhookSecret?: string;
  /** Git branch filter */
  branchFilter?: string[];
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Trigger condition
 */
export interface TriggerCondition {
  /** Field to check */
  field: string;
  /** Operator */
  operator:
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'matches'
    | 'greater'
    | 'less';
  /** Value */
  value: string | number | boolean;
}

/**
 * Alert configuration
 */
export interface AlertConfig {
  /** Enable alerts */
  enabled: boolean;
  /** Alert channels */
  channels: AlertChannel[];
  /** Alert rules */
  rules: AlertRule[];
  /** Quiet hours */
  quietHours?: QuietHours;
  /** Alert grouping */
  grouping?: AlertGrouping;
  /** Escalation policy */
  escalation?: EscalationPolicy;
}

/**
 * Alert channel
 */
export interface AlertChannel {
  /** Channel ID */
  id: string;
  /** Channel type */
  type:
    | 'email'
    | 'slack'
    | 'webhook'
    | 'pagerduty'
    | 'teams'
    | 'discord'
    | 'custom';
  /** Channel name */
  name: string;
  /** Enabled */
  enabled: boolean;
  /** Configuration */
  config: AlertChannelConfig;
  /** Severities to receive */
  severities: AlertSeverity[];
}

/**
 * Alert channel configuration
 */
export interface AlertChannelConfig {
  /** Email addresses */
  emails?: string[];
  /** Webhook URL */
  webhookUrl?: string;
  /** Slack channel */
  slackChannel?: string;
  /** API key */
  apiKey?: string;
  /** Custom headers */
  headers?: Record<string, string>;
  /** Template */
  template?: string;
  /** Additional settings */
  settings?: Record<string, unknown>;
}

/**
 * Alert rule
 */
export interface AlertRule {
  /** Rule ID */
  id: string;
  /** Rule name */
  name: string;
  /** Description */
  description?: string;
  /** Enabled */
  enabled: boolean;
  /** Condition */
  condition: AlertCondition;
  /** Severity when triggered */
  severity: AlertSeverity;
  /** Channels to notify */
  channelIds: string[];
  /** Throttle period (ms) */
  throttleMs?: number;
  /** Auto-resolve */
  autoResolve?: boolean;
  /** Tags */
  tags?: string[];
}

/**
 * Alert condition
 */
export interface AlertCondition {
  /** Condition type */
  type: 'threshold' | 'change' | 'pattern' | 'anomaly' | 'custom';
  /** Metric or field */
  metric: string;
  /** Operator */
  operator:
    | 'greater'
    | 'less'
    | 'equals'
    | 'not_equals'
    | 'between'
    | 'outside';
  /** Value(s) */
  value: number | number[];
  /** Time window (ms) */
  windowMs?: number;
  /** Consecutive occurrences */
  consecutiveCount?: number;
  /** Custom evaluator */
  customEvaluator?: string;
}

/**
 * Quiet hours configuration
 */
export interface QuietHours {
  /** Enabled */
  enabled: boolean;
  /** Start time (HH:mm) */
  startTime: string;
  /** End time (HH:mm) */
  endTime: string;
  /** Days of week */
  daysOfWeek: number[];
  /** Timezone */
  timezone?: string;
  /** Override for critical alerts */
  overrideForCritical?: boolean;
}

/**
 * Alert grouping
 */
export interface AlertGrouping {
  /** Enable grouping */
  enabled: boolean;
  /** Group by fields */
  groupBy: string[];
  /** Window for grouping (ms) */
  windowMs: number;
  /** Max alerts per group */
  maxAlertsPerGroup?: number;
}

/**
 * Escalation policy
 */
export interface EscalationPolicy {
  /** Enabled */
  enabled: boolean;
  /** Escalation levels */
  levels: EscalationLevel[];
}

/**
 * Escalation level
 */
export interface EscalationLevel {
  /** Level number */
  level: number;
  /** Delay before escalation (ms) */
  delayMs: number;
  /** Channel IDs */
  channelIds: string[];
  /** Repeat interval (ms) */
  repeatIntervalMs?: number;
  /** Max repeats */
  maxRepeats?: number;
}

/**
 * Retention configuration
 */
export interface RetentionConfig {
  /** Retention period in days */
  retentionDays: number;
  /** Keep summaries longer */
  summaryRetentionDays?: number;
  /** Archive before delete */
  archive?: boolean;
  /** Archive location */
  archiveLocation?: string;
}

/**
 * Fail threshold
 */
export interface FailThreshold {
  /** Max critical vulnerabilities */
  maxCritical?: number;
  /** Max high severity */
  maxHigh?: number;
  /** Minimum pass rate */
  minPassRate?: number;
  /** Minimum compliance score */
  minComplianceScore?: number;
  /** Minimum benchmark score */
  minBenchmarkScore?: number;
}

/**
 * Test run
 */
export interface TestRun {
  /** Run ID */
  id: string;
  /** Run name */
  name?: string;
  /** Status */
  status: RunStatus;
  /** Trigger type */
  trigger: TriggerConfig['type'];
  /** Triggered by */
  triggeredBy?: string;
  /** Start time */
  startTime: number;
  /** End time */
  endTime?: number;
  /** Duration (ms) */
  durationMs?: number;
  /** Test suite results */
  testResults?: TestSuiteResult[];
  /** Scan results */
  scanResults?: ScanResult[];
  /** Benchmark results */
  benchmarkResults?: BenchmarkResult[];
  /** Compliance results */
  complianceResults?: ComplianceCheckResult[];
  /** Summary */
  summary?: RunSummary;
  /** Alerts triggered */
  alerts?: Alert[];
  /** Error if failed */
  error?: string;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Run summary
 */
export interface RunSummary {
  /** Overall status */
  overallStatus: 'passed' | 'failed' | 'warning' | 'error';
  /** Tests summary */
  tests?: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  /** Vulnerabilities summary */
  vulnerabilities?: {
    total: number;
    bySeverity: Record<Severity, number>;
  };
  /** Benchmark summary */
  benchmarks?: {
    averageScore: number;
    passed: number;
    failed: number;
  };
  /** Compliance summary */
  compliance?: {
    averageScore: number;
    compliant: number;
    nonCompliant: number;
  };
  /** Comparison with previous run */
  comparison?: {
    testsDelta: number;
    vulnerabilitiesDelta: number;
    benchmarkDelta: number;
    complianceDelta: number;
    trend: 'improved' | 'degraded' | 'stable';
  };
}

/**
 * Alert instance
 */
export interface Alert {
  /** Alert ID */
  id: string;
  /** Rule that triggered */
  ruleId: string;
  /** Rule name */
  ruleName: string;
  /** Severity */
  severity: AlertSeverity;
  /** Status */
  status: 'triggered' | 'acknowledged' | 'resolved' | 'suppressed';
  /** Title */
  title: string;
  /** Message */
  message: string;
  /** Details */
  details?: Record<string, unknown>;
  /** Triggered at */
  triggeredAt: number;
  /** Acknowledged at */
  acknowledgedAt?: number;
  /** Acknowledged by */
  acknowledgedBy?: string;
  /** Resolved at */
  resolvedAt?: number;
  /** Resolved by */
  resolvedBy?: string;
  /** Resolution notes */
  resolutionNotes?: string;
  /** Related run ID */
  runId?: string;
  /** Notification history */
  notificationHistory: NotificationRecord[];
}

/**
 * Notification record
 */
export interface NotificationRecord {
  /** Channel ID */
  channelId: string;
  /** Channel type */
  channelType: AlertChannel['type'];
  /** Sent at */
  sentAt: number;
  /** Status */
  status: 'sent' | 'failed' | 'bounced';
  /** Error if failed */
  error?: string;
}

/**
 * Schedule status
 */
export interface ScheduleStatus {
  /** Next scheduled run */
  nextRun?: number;
  /** Last run */
  lastRun?: TestRun;
  /** Is running */
  isRunning: boolean;
  /** Current run ID */
  currentRunId?: string;
  /** Runs today */
  runsToday: number;
  /** Active alerts */
  activeAlerts: number;
}

/**
 * Historical metrics
 */
export interface HistoricalMetrics {
  /** Time range */
  timeRange: {
    start: number;
    end: number;
  };
  /** Data points */
  dataPoints: MetricDataPoint[];
  /** Aggregations */
  aggregations: {
    mean: number;
    median: number;
    min: number;
    max: number;
    stdDev: number;
  };
  /** Trends */
  trends: {
    direction: 'up' | 'down' | 'stable';
    changePercent: number;
    significance: 'high' | 'medium' | 'low';
  };
}

/**
 * Metric data point
 */
export interface MetricDataPoint {
  /** Timestamp */
  timestamp: number;
  /** Value */
  value: number;
  /** Run ID */
  runId?: string;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Dashboard summary
 */
export interface DashboardSummary {
  /** Current status */
  currentStatus: 'healthy' | 'warning' | 'critical' | 'unknown';
  /** Last run */
  lastRun?: TestRun;
  /** Next run */
  nextRun?: number;
  /** Active alerts */
  activeAlerts: Alert[];
  /** Recent runs */
  recentRuns: TestRun[];
  /** Metrics */
  metrics: {
    passRate: HistoricalMetrics;
    vulnerabilities: HistoricalMetrics;
    benchmarkScores: HistoricalMetrics;
    complianceScores: HistoricalMetrics;
  };
  /** Trends */
  trends: {
    overall: 'improving' | 'stable' | 'degrading';
    security: 'improving' | 'stable' | 'degrading';
    compliance: 'improving' | 'stable' | 'degrading';
  };
}
