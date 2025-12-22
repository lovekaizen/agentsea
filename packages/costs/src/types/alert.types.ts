/**
 * Alert Types
 *
 * Type definitions for cost alerts and notifications.
 */

import type { AIProvider } from './cost.types.js';
import type { AttributionDimension } from './attribution.types.js';
import type { AnalyticsMetric } from './analytics.types.js';

/**
 * Alert type
 */
export type AlertType =
  | 'budget'
  | 'threshold'
  | 'anomaly'
  | 'spike'
  | 'trend'
  | 'forecast'
  | 'error-rate'
  | 'custom';

/**
 * Alert severity
 */
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * Alert status
 */
export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'snoozed';

/**
 * Notification channel
 */
export type NotificationChannel =
  | 'email'
  | 'slack'
  | 'webhook'
  | 'pagerduty'
  | 'teams'
  | 'discord';

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
  /** Alert type */
  type: AlertType;
  /** Severity */
  severity: AlertSeverity;
  /** Condition */
  condition: AlertCondition;
  /** Notification channels */
  channels: NotificationConfig[];
  /** Cooldown period in seconds */
  cooldown?: number;
  /** Whether rule is enabled */
  enabled: boolean;
  /** Tags */
  tags?: string[];
  /** Created at */
  createdAt: Date;
  /** Updated at */
  updatedAt: Date;
  /** Created by */
  createdBy?: string;
}

/**
 * Alert condition
 */
export interface AlertCondition {
  /** Metric to monitor */
  metric: AnalyticsMetric;
  /** Comparison operator */
  operator:
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'eq'
    | 'ne'
    | 'change_gt'
    | 'change_lt';
  /** Threshold value */
  threshold: number;
  /** Time window for evaluation */
  window?: {
    duration: number;
    unit: 'minutes' | 'hours' | 'days';
  };
  /** Aggregation method */
  aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count';
  /** Filters */
  filters?: AlertFilter;
  /** For change operators, comparison period */
  comparisonPeriod?:
    | 'previous_period'
    | 'same_period_last_week'
    | 'same_period_last_month';
}

/**
 * Alert filter
 */
export interface AlertFilter {
  /** Providers */
  providers?: AIProvider[];
  /** Models */
  models?: string[];
  /** Dimension filters */
  dimensions?: Record<AttributionDimension, string[]>;
  /** Environment */
  environment?: string;
}

/**
 * Notification configuration
 */
export interface NotificationConfig {
  /** Channel type */
  channel: NotificationChannel;
  /** Channel-specific configuration */
  config: NotificationChannelConfig;
  /** Whether to include details */
  includeDetails?: boolean;
  /** Custom message template */
  messageTemplate?: string;
}

/**
 * Channel-specific configuration
 */
export type NotificationChannelConfig =
  | EmailNotificationConfig
  | SlackNotificationConfig
  | WebhookNotificationConfig
  | PagerDutyNotificationConfig
  | TeamsNotificationConfig
  | DiscordNotificationConfig;

/**
 * Email notification config
 */
export interface EmailNotificationConfig {
  type: 'email';
  /** Recipients */
  recipients: string[];
  /** CC recipients */
  cc?: string[];
  /** Subject template */
  subjectTemplate?: string;
}

/**
 * Slack notification config
 */
export interface SlackNotificationConfig {
  type: 'slack';
  /** Webhook URL */
  webhookUrl: string;
  /** Channel */
  channel?: string;
  /** Username */
  username?: string;
  /** Icon emoji */
  iconEmoji?: string;
  /** Mention users */
  mentionUsers?: string[];
}

/**
 * Webhook notification config
 */
export interface WebhookNotificationConfig {
  type: 'webhook';
  /** Webhook URL */
  url: string;
  /** HTTP method */
  method?: 'POST' | 'PUT';
  /** Custom headers */
  headers?: Record<string, string>;
  /** Include full payload */
  includePayload?: boolean;
}

/**
 * PagerDuty notification config
 */
export interface PagerDutyNotificationConfig {
  type: 'pagerduty';
  /** Integration key */
  integrationKey: string;
  /** Service ID */
  serviceId?: string;
  /** Escalation policy */
  escalationPolicy?: string;
}

/**
 * Microsoft Teams notification config
 */
export interface TeamsNotificationConfig {
  type: 'teams';
  /** Webhook URL */
  webhookUrl: string;
}

/**
 * Discord notification config
 */
export interface DiscordNotificationConfig {
  type: 'discord';
  /** Webhook URL */
  webhookUrl: string;
  /** Username */
  username?: string;
  /** Avatar URL */
  avatarUrl?: string;
}

/**
 * Alert instance
 */
export interface Alert {
  /** Alert ID */
  id: string;
  /** Rule ID that triggered this */
  ruleId: string;
  /** Rule name */
  ruleName: string;
  /** Alert type */
  type: AlertType;
  /** Severity */
  severity: AlertSeverity;
  /** Status */
  status: AlertStatus;
  /** Triggered at */
  triggeredAt: Date;
  /** Resolved at */
  resolvedAt?: Date;
  /** Acknowledged at */
  acknowledgedAt?: Date;
  /** Acknowledged by */
  acknowledgedBy?: string;
  /** Snoozed until */
  snoozedUntil?: Date;
  /** Alert message */
  message: string;
  /** Alert details */
  details: AlertDetails;
  /** Notification history */
  notifications: NotificationRecord[];
}

/**
 * Alert details
 */
export interface AlertDetails {
  /** Metric that triggered */
  metric: AnalyticsMetric;
  /** Current value */
  currentValue: number;
  /** Threshold value */
  threshold: number;
  /** Time window */
  window?: {
    start: Date;
    end: Date;
  };
  /** Related dimensions */
  dimensions?: Record<AttributionDimension, string>;
  /** Trend data */
  trend?: {
    previous: number;
    change: number;
    changePercent: number;
  };
  /** Context data */
  context?: Record<string, unknown>;
}

/**
 * Notification record
 */
export interface NotificationRecord {
  /** Channel */
  channel: NotificationChannel;
  /** Sent at */
  sentAt: Date;
  /** Success */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Response (for webhooks) */
  response?: string;
}

/**
 * Alert summary
 */
export interface AlertSummary {
  /** Total alerts */
  total: number;
  /** By status */
  byStatus: Record<AlertStatus, number>;
  /** By severity */
  bySeverity: Record<AlertSeverity, number>;
  /** By type */
  byType: Record<AlertType, number>;
  /** Active critical alerts */
  activeCritical: number;
  /** Mean time to acknowledge */
  meanTimeToAcknowledge?: number;
  /** Mean time to resolve */
  meanTimeToResolve?: number;
}

/**
 * Alert manager configuration
 */
export interface AlertManagerConfig {
  /** Enable alerting */
  enabled?: boolean;
  /** Default cooldown in seconds */
  defaultCooldown?: number;
  /** Global notification channels */
  globalChannels?: NotificationConfig[];
  /** Maximum alerts per hour */
  maxAlertsPerHour?: number;
  /** Auto-resolve after (seconds) */
  autoResolveAfter?: number;
  /** Retention period (days) */
  retentionDays?: number;
}

/**
 * Create alert rule request
 */
export interface CreateAlertRuleRequest {
  /** Name */
  name: string;
  /** Description */
  description?: string;
  /** Type */
  type: AlertType;
  /** Severity */
  severity: AlertSeverity;
  /** Condition */
  condition: AlertCondition;
  /** Channels */
  channels: NotificationConfig[];
  /** Cooldown */
  cooldown?: number;
  /** Tags */
  tags?: string[];
}

/**
 * Alert query options
 */
export interface AlertQueryOptions {
  /** Status filter */
  status?: AlertStatus[];
  /** Severity filter */
  severity?: AlertSeverity[];
  /** Type filter */
  type?: AlertType[];
  /** Rule ID filter */
  ruleIds?: string[];
  /** Start date */
  startDate?: Date;
  /** End date */
  endDate?: Date;
  /** Limit */
  limit?: number;
  /** Offset */
  offset?: number;
  /** Sort by */
  sortBy?: 'triggeredAt' | 'severity' | 'status';
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
}
