/**
 * Analysis Types
 *
 * Type definitions for conversation flow analysis, drop-off detection, and success analysis.
 */

import type { Conversation, TimePeriod, TimeRange } from './core.types.js';

/**
 * Flow pattern
 */
export interface FlowPattern {
  /** Pattern ID */
  id: string;
  /** Steps in the pattern */
  steps: FlowStep[];
  /** Frequency (percentage of conversations) */
  frequency: number;
  /** Count of occurrences */
  count: number;
  /** Success rate for this pattern */
  successRate: number;
  /** Average duration */
  avgDurationMs: number;
  /** Average satisfaction */
  avgSatisfaction?: number;
}

/**
 * Flow step
 */
export interface FlowStep {
  /** Step type */
  type: FlowStepType;
  /** Step name/label */
  name: string;
  /** Intent (if applicable) */
  intent?: string;
  /** Topic (if applicable) */
  topic?: string;
  /** Average time at step */
  avgTimeMs?: number;
}

/**
 * Flow step type
 */
export type FlowStepType =
  | 'start'
  | 'user_message'
  | 'assistant_message'
  | 'tool_call'
  | 'intent_change'
  | 'escalation'
  | 'feedback'
  | 'end';

/**
 * Flow analysis options
 */
export interface FlowAnalysisOptions {
  /** Minimum support (percentage) */
  minSupport?: number;
  /** Maximum pattern length */
  maxLength?: number;
  /** Include intent changes */
  includeIntents?: boolean;
  /** Include topics */
  includeTopics?: boolean;
  /** Time period */
  period?: TimePeriod | TimeRange;
  /** Filter by intent */
  intent?: string;
  /** Filter by outcome */
  outcome?: 'success' | 'failure';
}

/**
 * Flow analysis result
 */
export interface FlowAnalysisResult {
  /** Patterns found */
  patterns: FlowPattern[];
  /** Total conversations analyzed */
  totalConversations: number;
  /** Most common flow */
  mostCommonFlow?: FlowPattern;
  /** Most successful flow */
  mostSuccessfulFlow?: FlowPattern;
  /** Fastest flow */
  fastestFlow?: FlowPattern;
  /** Analysis metadata */
  metadata: {
    options: FlowAnalysisOptions;
    executedAt: number;
    durationMs: number;
  };
}

/**
 * Drop-off point
 */
export interface DropOffPoint {
  /** Point ID */
  id: string;
  /** Description */
  description: string;
  /** Step/stage where drop-off occurs */
  stage: string;
  /** Drop-off rate (percentage) */
  dropOffRate: number;
  /** Count of drop-offs */
  count: number;
  /** Preceding patterns */
  precedingPatterns: string[];
  /** Likely cause */
  likelyCause?: string;
  /** Severity */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Recommendations */
  recommendations?: string[];
}

/**
 * Drop-off detection options
 */
export interface DropOffDetectionOptions {
  /** Threshold for significant drop-off */
  threshold?: number;
  /** Time period */
  period?: TimePeriod | TimeRange;
  /** Min conversations to consider */
  minConversations?: number;
  /** Include analysis */
  includeAnalysis?: boolean;
}

/**
 * Drop-off detection result
 */
export interface DropOffDetectionResult {
  /** Drop-off points */
  dropOffPoints: DropOffPoint[];
  /** Overall completion rate */
  completionRate: number;
  /** Total conversations analyzed */
  totalConversations: number;
  /** Top drop-off reasons */
  topReasons?: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;
}

/**
 * Funnel step definition
 */
export interface FunnelStep {
  /** Step name */
  name: string;
  /** Condition to pass this step */
  condition: (conversation: Conversation) => boolean;
  /** Description */
  description?: string;
}

/**
 * Funnel step result
 */
export interface FunnelStepResult {
  /** Step name */
  name: string;
  /** Count at this step */
  count: number;
  /** Conversion rate from previous step */
  conversionRate: number;
  /** Overall conversion rate from start */
  overallConversionRate: number;
  /** Drop-off count */
  dropOff: number;
  /** Drop-off rate */
  dropOffRate: number;
}

/**
 * Funnel analysis options
 */
export interface FunnelAnalysisOptions {
  /** Time period */
  period?: TimePeriod | TimeRange;
  /** Segment by */
  segmentBy?: string;
  /** Filter */
  filter?: Record<string, unknown>;
}

/**
 * Funnel analysis result
 */
export interface FunnelAnalysisResult {
  /** Steps */
  steps: FunnelStepResult[];
  /** Overall conversion rate */
  overallConversion: number;
  /** Total started */
  totalStarted: number;
  /** Total converted */
  totalConverted: number;
  /** Biggest drop-off step */
  biggestDropOff?: {
    step: string;
    rate: number;
  };
  /** Segments (if segmented) */
  segments?: Map<string, FunnelStepResult[]>;
}

/**
 * Success criteria definition
 */
export interface SuccessCriteria {
  /** Criteria name */
  name: string;
  /** Condition */
  condition: (conversation: Conversation) => boolean;
  /** Weight (for composite scoring) */
  weight?: number;
}

/**
 * Success analysis options
 */
export interface SuccessAnalysisOptions {
  /** Time period */
  period?: TimePeriod | TimeRange;
  /** Group by field */
  groupBy?: string | string[];
  /** Include trend */
  includeTrend?: boolean;
  /** Trend granularity */
  trendGranularity?: 'day' | 'week' | 'month';
}

/**
 * Success analysis result
 */
export interface SuccessAnalysisResult {
  /** Overall success rate */
  overall: SuccessMetric;
  /** By criteria */
  byCriteria: Map<string, SuccessMetric>;
  /** By group */
  byGroup?: Map<string, SuccessMetric>;
  /** Trend data */
  trend?: SuccessTrendPoint[];
  /** Insights */
  insights?: SuccessInsight[];
}

/**
 * Success metric
 */
export interface SuccessMetric {
  /** Success rate (0-1) */
  rate: number;
  /** Success count */
  successCount: number;
  /** Total count */
  totalCount: number;
  /** Change from previous period */
  change?: number;
}

/**
 * Success trend point
 */
export interface SuccessTrendPoint {
  /** Timestamp */
  timestamp: number;
  /** Success rate */
  rate: number;
  /** Count */
  count: number;
}

/**
 * Success insight
 */
export interface SuccessInsight {
  /** Insight type */
  type: 'improvement' | 'decline' | 'anomaly' | 'correlation';
  /** Description */
  description: string;
  /** Significance */
  significance: 'low' | 'medium' | 'high';
  /** Related data */
  data?: Record<string, unknown>;
}

/**
 * Cohort definition
 */
export interface CohortDefinition {
  /** Cohort name */
  name: string;
  /** Cohort type */
  type: 'time' | 'behavior' | 'attribute';
  /** Definition */
  definition: CohortCondition;
}

/**
 * Cohort condition
 */
export interface CohortCondition {
  /** Field to check */
  field?: string;
  /** Operator */
  operator?: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains';
  /** Value */
  value?: unknown;
  /** Time range (for time cohorts) */
  timeRange?: TimeRange;
  /** Custom function */
  custom?: (conversation: Conversation) => boolean;
}

/**
 * Cohort analysis options
 */
export interface CohortAnalysisOptions {
  /** Cohorts to analyze */
  cohorts: CohortDefinition[];
  /** Metrics to compare */
  metrics: string[];
  /** Time period */
  period?: TimePeriod | TimeRange;
  /** Compare to baseline */
  baseline?: CohortDefinition;
}

/**
 * Cohort analysis result
 */
export interface CohortAnalysisResult {
  /** Cohort results */
  cohorts: Map<string, CohortMetrics>;
  /** Comparisons */
  comparisons?: CohortComparison[];
  /** Statistical significance */
  significance?: Map<string, boolean>;
}

/**
 * Cohort metrics
 */
export interface CohortMetrics {
  /** Cohort name */
  name: string;
  /** Size */
  size: number;
  /** Metrics */
  metrics: Map<string, number>;
}

/**
 * Cohort comparison
 */
export interface CohortComparison {
  /** First cohort */
  cohortA: string;
  /** Second cohort */
  cohortB: string;
  /** Metric */
  metric: string;
  /** Difference */
  difference: number;
  /** Percentage difference */
  percentageDiff: number;
  /** Statistically significant */
  significant: boolean;
}
