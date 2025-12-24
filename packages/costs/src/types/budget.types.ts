/**
 * Budget Types
 *
 * Type definitions for budget management and enforcement.
 */

import type { AIProvider, CostAttribution } from './cost.types.js';

/**
 * Budget period
 */
export type BudgetPeriod =
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'yearly'
  | 'custom';

/**
 * Budget scope
 */
export type BudgetScope =
  | 'global'
  | 'user'
  | 'agent'
  | 'project'
  | 'team'
  | 'feature'
  | 'model'
  | 'provider';

/**
 * Budget enforcement action
 */
export type BudgetAction = 'warn' | 'throttle' | 'block' | 'notify';

/**
 * Budget status
 */
export type BudgetStatus = 'active' | 'paused' | 'exceeded' | 'expired';

/**
 * Budget configuration
 */
export interface BudgetConfig {
  /** Unique identifier */
  id: string;
  /** Budget name */
  name: string;
  /** Description */
  description?: string;
  /** Budget limit amount */
  limit: number;
  /** Currency */
  currency: string;
  /** Budget period */
  period: BudgetPeriod;
  /** Budget scope */
  scope: BudgetScope;
  /** Scope identifier (userId, projectId, etc.) */
  scopeId?: string;
  /** Warning thresholds (percentages) */
  warningThresholds?: number[];
  /** Actions when thresholds are reached */
  actions?: BudgetThresholdAction[];
  /** Reset schedule (cron expression for custom periods) */
  resetSchedule?: string;
  /** Rollover unused budget */
  rollover?: boolean;
  /** Maximum rollover amount */
  maxRollover?: number;
  /** Additional filters */
  filters?: BudgetFilter;
  /** Whether budget is enabled */
  enabled: boolean;
  /** Creation date */
  createdAt: Date;
  /** Last update date */
  updatedAt: Date;
}

/**
 * Budget threshold action
 */
export interface BudgetThresholdAction {
  /** Threshold percentage (0-100) */
  threshold: number;
  /** Action to take */
  action: BudgetAction;
  /** Notification recipients */
  notifyEmails?: string[];
  /** Webhook URL */
  webhookUrl?: string;
  /** Custom message */
  message?: string;
}

/**
 * Budget filter
 */
export interface BudgetFilter {
  /** Provider filter */
  providers?: AIProvider[];
  /** Model filter */
  models?: string[];
  /** User IDs */
  userIds?: string[];
  /** Agent IDs */
  agentIds?: string[];
  /** Project IDs */
  projectIds?: string[];
  /** Feature filter */
  features?: string[];
  /** Environment */
  environment?: string;
}

/**
 * Budget usage data
 */
export interface BudgetUsage {
  /** Budget ID */
  budgetId: string;
  /** Current usage amount */
  currentUsage: number;
  /** Budget limit */
  limit: number;
  /** Usage percentage */
  usagePercentage: number;
  /** Remaining budget */
  remaining: number;
  /** Period start */
  periodStart: Date;
  /** Period end */
  periodEnd: Date;
  /** Days/hours remaining in period */
  timeRemaining: number;
  /** Projected usage by end of period */
  projectedUsage?: number;
  /** Whether budget will be exceeded */
  projectedExceed?: boolean;
  /** Current status */
  status: BudgetStatus;
  /** Triggered thresholds */
  triggeredThresholds: number[];
  /** Rollover amount from previous period */
  rolloverIn?: number;
}

/**
 * Budget check request
 */
export interface BudgetCheckRequest {
  /** Estimated cost */
  estimatedCost: number;
  /** Attribution for scope matching */
  attribution?: CostAttribution;
  /** Specific budget IDs to check */
  budgetIds?: string[];
}

/**
 * Budget check result
 */
export interface BudgetCheckResult {
  /** Whether operation is allowed */
  allowed: boolean;
  /** Reason if not allowed */
  reason?: string;
  /** Matching budgets */
  matchingBudgets: BudgetUsage[];
  /** Budgets that would be exceeded */
  exceededBudgets: string[];
  /** Warning budgets (near limit) */
  warningBudgets: string[];
  /** Recommended action */
  action: BudgetAction | 'allow';
}

/**
 * Budget history entry
 */
export interface BudgetHistoryEntry {
  /** Budget ID */
  budgetId: string;
  /** Period start */
  periodStart: Date;
  /** Period end */
  periodEnd: Date;
  /** Total usage */
  usage: number;
  /** Budget limit for that period */
  limit: number;
  /** Usage percentage */
  usagePercentage: number;
  /** Whether limit was exceeded */
  exceeded: boolean;
  /** Rollover from previous period */
  rolloverIn?: number;
  /** Rollover to next period */
  rolloverOut?: number;
}

/**
 * Budget alert
 */
export interface BudgetAlert {
  /** Alert ID */
  id: string;
  /** Budget ID */
  budgetId: string;
  /** Budget name */
  budgetName: string;
  /** Alert type */
  type: 'warning' | 'exceeded' | 'reset';
  /** Threshold that triggered alert */
  threshold?: number;
  /** Current usage */
  usage: number;
  /** Budget limit */
  limit: number;
  /** Usage percentage */
  percentage: number;
  /** Alert message */
  message: string;
  /** Timestamp */
  timestamp: Date;
  /** Whether alert was acknowledged */
  acknowledged: boolean;
  /** Acknowledged by */
  acknowledgedBy?: string;
  /** Acknowledged at */
  acknowledgedAt?: Date;
}

/**
 * Budget manager configuration
 */
export interface BudgetManagerConfig {
  /** Enable budget enforcement */
  enforceOnRequest?: boolean;
  /** Default action when no budget matches */
  defaultAction?: BudgetAction | 'allow';
  /** Check interval in ms */
  checkInterval?: number;
  /** Enable projections */
  enableProjections?: boolean;
  /** Alert webhook URL */
  alertWebhookUrl?: string;
  /** Alert email recipients */
  alertEmails?: string[];
}

/**
 * Budget creation request
 */
export interface CreateBudgetRequest {
  /** Budget name */
  name: string;
  /** Description */
  description?: string;
  /** Budget limit */
  limit: number;
  /** Currency */
  currency?: string;
  /** Period */
  period: BudgetPeriod;
  /** Scope */
  scope: BudgetScope;
  /** Scope identifier */
  scopeId?: string;
  /** Warning thresholds */
  warningThresholds?: number[];
  /** Threshold actions */
  actions?: BudgetThresholdAction[];
  /** Filters */
  filters?: BudgetFilter;
  /** Enable rollover */
  rollover?: boolean;
  /** Max rollover */
  maxRollover?: number;
}

/**
 * Budget update request
 */
export interface UpdateBudgetRequest {
  /** New name */
  name?: string;
  /** New description */
  description?: string;
  /** New limit */
  limit?: number;
  /** New warning thresholds */
  warningThresholds?: number[];
  /** New actions */
  actions?: BudgetThresholdAction[];
  /** Enable/disable */
  enabled?: boolean;
  /** Update filters */
  filters?: BudgetFilter;
}
