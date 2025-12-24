/**
 * Attribution Types
 *
 * Type definitions for cost attribution and allocation.
 */

import type { TimeGranularity } from './cost.types.js';

/**
 * Attribution dimension
 */
export type AttributionDimension =
  | 'user'
  | 'agent'
  | 'session'
  | 'project'
  | 'team'
  | 'feature'
  | 'model'
  | 'provider'
  | 'environment'
  | 'label';

/**
 * Attribution rule type
 */
export type AttributionRuleType =
  | 'direct'
  | 'proportional'
  | 'fixed'
  | 'percentage'
  | 'custom';

/**
 * Attribution rule
 */
export interface AttributionRule {
  /** Rule ID */
  id: string;
  /** Rule name */
  name: string;
  /** Description */
  description?: string;
  /** Rule type */
  type: AttributionRuleType;
  /** Priority (higher = first) */
  priority: number;
  /** Matching conditions */
  conditions: AttributionCondition[];
  /** Attribution targets */
  targets: AttributionTarget[];
  /** Whether rule is enabled */
  enabled: boolean;
  /** Creation date */
  createdAt: Date;
}

/**
 * Attribution condition
 */
export interface AttributionCondition {
  /** Dimension to match */
  dimension: AttributionDimension;
  /** Operator */
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'regex' | 'in';
  /** Value to match */
  value: string | string[];
}

/**
 * Attribution target
 */
export interface AttributionTarget {
  /** Target dimension */
  dimension: AttributionDimension;
  /** Target value (can be dynamic using placeholders) */
  value: string;
  /** Allocation percentage (for proportional) */
  percentage?: number;
  /** Fixed amount (for fixed type) */
  fixedAmount?: number;
}

/**
 * Attributed cost record
 */
export interface AttributedCost {
  /** Original cost record ID */
  costRecordId: string;
  /** Attribution dimension */
  dimension: AttributionDimension;
  /** Dimension value */
  dimensionValue: string;
  /** Attributed cost amount */
  attributedCost: number;
  /** Attribution percentage */
  attributionPercentage: number;
  /** Rule that applied */
  ruleId?: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Attribution summary by dimension
 */
export interface AttributionSummary {
  /** Dimension */
  dimension: AttributionDimension;
  /** Breakdown by dimension value */
  breakdown: AttributionBreakdown[];
  /** Total cost */
  totalCost: number;
  /** Time period */
  periodStart: Date;
  periodEnd: Date;
}

/**
 * Attribution breakdown entry
 */
export interface AttributionBreakdown {
  /** Dimension value */
  value: string;
  /** Display name */
  displayName?: string;
  /** Total cost */
  cost: number;
  /** Total tokens */
  tokens: number;
  /** Request count */
  requests: number;
  /** Percentage of total */
  percentage: number;
  /** Cost trend */
  trend?: 'up' | 'down' | 'stable';
  /** Change from previous period */
  change?: number;
  /** Change percentage */
  changePercentage?: number;
}

/**
 * Attribution query options
 */
export interface AttributionQueryOptions {
  /** Dimension to query */
  dimension: AttributionDimension;
  /** Start date */
  startDate?: Date;
  /** End date */
  endDate?: Date;
  /** Filter by specific values */
  values?: string[];
  /** Group by additional dimension */
  groupBy?: AttributionDimension;
  /** Time granularity */
  granularity?: TimeGranularity;
  /** Limit results */
  limit?: number;
  /** Include sub-dimensions */
  includeSubDimensions?: boolean;
}

/**
 * Attribution trend data
 */
export interface AttributionTrend {
  /** Dimension */
  dimension: AttributionDimension;
  /** Dimension value */
  value: string;
  /** Trend data points */
  dataPoints: AttributionTrendPoint[];
  /** Overall trend direction */
  trend: 'up' | 'down' | 'stable';
  /** Average cost per period */
  avgCost: number;
  /** Total cost */
  totalCost: number;
}

/**
 * Attribution trend point
 */
export interface AttributionTrendPoint {
  /** Timestamp */
  timestamp: Date;
  /** Cost */
  cost: number;
  /** Tokens */
  tokens: number;
  /** Requests */
  requests: number;
}

/**
 * Cost allocation policy
 */
export interface CostAllocationPolicy {
  /** Policy ID */
  id: string;
  /** Policy name */
  name: string;
  /** Description */
  description?: string;
  /** Source dimension (costs to allocate from) */
  sourceDimension: AttributionDimension;
  /** Target dimension (allocate costs to) */
  targetDimension: AttributionDimension;
  /** Allocation method */
  method: 'equal' | 'proportional' | 'usage-based' | 'custom';
  /** Custom allocation weights */
  weights?: Record<string, number>;
  /** Whether policy is active */
  active: boolean;
}

/**
 * Attribution report
 */
export interface AttributionReport {
  /** Report ID */
  id: string;
  /** Report name */
  name: string;
  /** Report period */
  period: {
    start: Date;
    end: Date;
  };
  /** Dimensions included */
  dimensions: AttributionDimension[];
  /** Summary data */
  summary: {
    totalCost: number;
    totalTokens: number;
    totalRequests: number;
    uniqueUsers?: number;
    uniqueAgents?: number;
    uniqueProjects?: number;
  };
  /** Breakdown by dimension */
  breakdowns: Record<AttributionDimension, AttributionBreakdown[]>;
  /** Top consumers */
  topConsumers: {
    dimension: AttributionDimension;
    value: string;
    cost: number;
    percentage: number;
  }[];
  /** Generated at */
  generatedAt: Date;
}

/**
 * Attribution engine configuration
 */
export interface AttributionEngineConfig {
  /** Default attribution rules */
  defaultRules?: AttributionRule[];
  /** Enable automatic attribution */
  autoAttribute?: boolean;
  /** Default allocation policy */
  defaultPolicy?: CostAllocationPolicy;
  /** Cache attribution results */
  cacheResults?: boolean;
  /** Cache TTL in seconds */
  cacheTtl?: number;
}

/**
 * Chargeback record
 */
export interface ChargebackRecord {
  /** Record ID */
  id: string;
  /** Billing period */
  billingPeriod: {
    start: Date;
    end: Date;
  };
  /** Cost center / department */
  costCenter: string;
  /** Total charge */
  totalCharge: number;
  /** Currency */
  currency: string;
  /** Line items */
  lineItems: ChargebackLineItem[];
  /** Status */
  status: 'pending' | 'approved' | 'rejected' | 'invoiced';
  /** Generated at */
  generatedAt: Date;
  /** Approved by */
  approvedBy?: string;
  /** Approved at */
  approvedAt?: Date;
}

/**
 * Chargeback line item
 */
export interface ChargebackLineItem {
  /** Description */
  description: string;
  /** Dimension */
  dimension: AttributionDimension;
  /** Dimension value */
  dimensionValue: string;
  /** Quantity (tokens, requests, etc.) */
  quantity: number;
  /** Unit */
  unit: string;
  /** Unit cost */
  unitCost: number;
  /** Total cost */
  totalCost: number;
  /** Cost record IDs */
  costRecordIds: string[];
}
