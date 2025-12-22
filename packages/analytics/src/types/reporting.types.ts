/**
 * Reporting Types
 *
 * Type definitions for reports, dashboards, and alerts.
 */

import type { TimePeriod, TimeRange } from './core.types.js';

/**
 * Report type
 */
export type ReportType =
  | 'daily-summary'
  | 'weekly-summary'
  | 'monthly-summary'
  | 'intent-analysis'
  | 'sentiment-report'
  | 'drop-off-analysis'
  | 'success-metrics'
  | 'custom';

/**
 * Report format
 */
export type ReportFormat = 'json' | 'html' | 'pdf' | 'csv' | 'markdown';

/**
 * Report section
 */
export type ReportSection =
  | 'overview'
  | 'intents'
  | 'sentiment'
  | 'topics'
  | 'flows'
  | 'dropoffs'
  | 'success'
  | 'kpis'
  | 'recommendations'
  | 'anomalies'
  | 'trends';

/**
 * Report configuration
 */
export interface ReportConfig {
  /** Report type */
  type: ReportType;
  /** Time period */
  period: TimePeriod | TimeRange;
  /** Sections to include */
  sections?: ReportSection[];
  /** Output format */
  format?: ReportFormat;
  /** Title */
  title?: string;
  /** Description */
  description?: string;
  /** Filters */
  filters?: Record<string, unknown>;
  /** Include charts */
  includeCharts?: boolean;
  /** Include raw data */
  includeRawData?: boolean;
  /** Comparison period */
  comparisonPeriod?: TimePeriod | TimeRange;
}

/**
 * Report result
 */
export interface Report {
  /** Report ID */
  id: string;
  /** Report type */
  type: ReportType;
  /** Title */
  title: string;
  /** Generated at */
  generatedAt: number;
  /** Period covered */
  period: TimeRange;
  /** Sections */
  sections: ReportSectionData[];
  /** Summary */
  summary?: string;
  /** Key insights */
  insights?: ReportInsight[];
  /** Recommendations */
  recommendations?: string[];
  /** Format */
  format: ReportFormat;
  /** Raw content (for export) */
  content?: string | Buffer;
}

/**
 * Report section data
 */
export interface ReportSectionData {
  /** Section name */
  name: ReportSection;
  /** Section title */
  title: string;
  /** Data */
  data: Record<string, unknown>;
  /** Charts */
  charts?: ChartData[];
  /** Tables */
  tables?: TableData[];
  /** Text content */
  text?: string;
}

/**
 * Report insight
 */
export interface ReportInsight {
  /** Insight type */
  type: 'improvement' | 'decline' | 'opportunity' | 'risk' | 'anomaly';
  /** Title */
  title: string;
  /** Description */
  description: string;
  /** Impact */
  impact?: 'high' | 'medium' | 'low';
  /** Related data */
  data?: Record<string, unknown>;
}

/**
 * Chart data
 */
export interface ChartData {
  /** Chart type */
  type: ChartType;
  /** Title */
  title: string;
  /** Data */
  data: ChartDataset[];
  /** X-axis label */
  xLabel?: string;
  /** Y-axis label */
  yLabel?: string;
  /** Options */
  options?: Record<string, unknown>;
}

/**
 * Chart type
 */
export type ChartType =
  | 'line'
  | 'bar'
  | 'pie'
  | 'donut'
  | 'area'
  | 'scatter'
  | 'heatmap'
  | 'funnel'
  | 'gauge';

/**
 * Chart dataset
 */
export interface ChartDataset {
  /** Label */
  label: string;
  /** Data points */
  data: Array<number | { x: number | string; y: number }>;
  /** Color */
  color?: string;
}

/**
 * Table data
 */
export interface TableData {
  /** Title */
  title?: string;
  /** Headers */
  headers: string[];
  /** Rows */
  rows: Array<Array<string | number>>;
  /** Footer */
  footer?: Array<string | number>;
}

/**
 * Dashboard configuration
 */
export interface DashboardConfig {
  /** Dashboard ID */
  id?: string;
  /** Title */
  title?: string;
  /** Layout */
  layout?: DashboardLayout;
  /** Widgets */
  widgets: WidgetConfig[];
  /** Refresh interval (ms) */
  refreshInterval?: number;
  /** Default period */
  defaultPeriod?: TimePeriod;
  /** Filters */
  filters?: FilterConfig[];
  /** Theme */
  theme?: 'light' | 'dark' | 'auto';
}

/**
 * Dashboard layout
 */
export interface DashboardLayout {
  /** Columns */
  columns?: number;
  /** Gap */
  gap?: number;
  /** Responsive breakpoints */
  breakpoints?: Record<string, number>;
}

/**
 * Widget configuration
 */
export interface WidgetConfig {
  /** Widget ID */
  id: string;
  /** Widget type */
  type: WidgetType;
  /** Title */
  title: string;
  /** Metric or query */
  metric?: string;
  /** Query */
  query?: Record<string, unknown>;
  /** Position */
  position?: { row: number; col: number };
  /** Size */
  size?: { width: number; height: number };
  /** Options */
  options?: Record<string, unknown>;
}

/**
 * Widget type
 */
export type WidgetType =
  | 'metric'
  | 'timeseries'
  | 'pie'
  | 'bar'
  | 'table'
  | 'gauge'
  | 'funnel'
  | 'list'
  | 'heatmap'
  | 'map'
  | 'text';

/**
 * Filter configuration
 */
export interface FilterConfig {
  /** Filter ID */
  id: string;
  /** Label */
  label: string;
  /** Field */
  field: string;
  /** Type */
  type: 'select' | 'multiselect' | 'date' | 'daterange' | 'search';
  /** Options (for select) */
  options?: Array<{ label: string; value: string }>;
  /** Default value */
  defaultValue?: unknown;
}

/**
 * Alert rule
 */
export interface AlertRule {
  /** Rule ID */
  id: string;
  /** Name */
  name: string;
  /** Description */
  description?: string;
  /** Condition */
  condition: AlertRuleCondition;
  /** Channels */
  channels: AlertChannel[];
  /** Enabled */
  enabled: boolean;
  /** Cooldown (ms) */
  cooldown?: number;
  /** Created at */
  createdAt: number;
  /** Last triggered */
  lastTriggered?: number;
}

/**
 * Alert rule condition
 */
export interface AlertRuleCondition {
  /** Metric */
  metric: string;
  /** Operator */
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'ne' | 'change';
  /** Threshold */
  threshold: number;
  /** Window */
  window?: string;
  /** Aggregation */
  aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'count';
}

/**
 * Alert channel
 */
export type AlertChannel =
  | 'email'
  | 'slack'
  | 'webhook'
  | 'pagerduty'
  | 'teams'
  | 'console';

/**
 * Alert instance
 */
export interface AlertInstance {
  /** Alert ID */
  id: string;
  /** Rule ID */
  ruleId: string;
  /** Rule name */
  ruleName: string;
  /** Status */
  status: 'firing' | 'resolved';
  /** Triggered at */
  triggeredAt: number;
  /** Resolved at */
  resolvedAt?: number;
  /** Value that triggered */
  value: number;
  /** Threshold */
  threshold: number;
  /** Message */
  message: string;
  /** Notifications sent */
  notifications?: AlertNotification[];
}

/**
 * Alert notification
 */
export interface AlertNotification {
  /** Channel */
  channel: AlertChannel;
  /** Sent at */
  sentAt: number;
  /** Success */
  success: boolean;
  /** Error */
  error?: string;
}

/**
 * Export configuration
 */
export interface ExportConfig {
  /** Format */
  format: 'csv' | 'json' | 'parquet';
  /** Data to export */
  data: 'conversations' | 'events' | 'metrics' | 'report';
  /** Period */
  period?: TimePeriod | TimeRange;
  /** Fields to include */
  fields?: string[];
  /** Filters */
  filters?: Record<string, unknown>;
  /** Compression */
  compression?: 'gzip' | 'none';
}

/**
 * Export result
 */
export interface ExportResult {
  /** Export ID */
  id: string;
  /** File path or URL */
  path: string;
  /** Size in bytes */
  sizeBytes: number;
  /** Row count */
  rowCount: number;
  /** Created at */
  createdAt: number;
  /** Expires at */
  expiresAt?: number;
}

/**
 * Scheduled report
 */
export interface ScheduledReport {
  /** Schedule ID */
  id: string;
  /** Report config */
  config: ReportConfig;
  /** Schedule (cron expression) */
  schedule: string;
  /** Recipients */
  recipients: string[];
  /** Enabled */
  enabled: boolean;
  /** Last run */
  lastRun?: number;
  /** Next run */
  nextRun?: number;
}
