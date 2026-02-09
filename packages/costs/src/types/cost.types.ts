/**
 * Cost Types
 *
 * Core type definitions for cost tracking and management.
 */

/**
 * Supported AI providers
 */
export type AIProvider =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'azure'
  | 'bedrock'
  | 'cohere'
  | 'mistral'
  | 'deepseek'
  | 'xai'
  | 'replicate'
  | 'custom';

/**
 * Token usage breakdown
 */
export interface TokenUsage {
  /** Input/prompt tokens */
  inputTokens: number;
  /** Output/completion tokens */
  outputTokens: number;
  /** Total tokens */
  totalTokens: number;
  /** Cache read tokens (if applicable) */
  cacheReadTokens?: number;
  /** Cache write tokens (if applicable) */
  cacheWriteTokens?: number;
}

/**
 * Cost breakdown by category
 */
export interface CostBreakdown {
  /** Cost for input tokens */
  inputCost: number;
  /** Cost for output tokens */
  outputCost: number;
  /** Cost for cached reads */
  cacheReadCost?: number;
  /** Cost for cache writes */
  cacheCost?: number;
  /** Total cost */
  totalCost: number;
  /** Currency code (ISO 4217) */
  currency: string;
}

/**
 * Cost record for a single API call
 */
export interface CostRecord {
  /** Unique identifier */
  id: string;
  /** Timestamp of the call */
  timestamp: Date;
  /** Provider name */
  provider: AIProvider;
  /** Model identifier */
  model: string;
  /** Token usage */
  tokens: TokenUsage;
  /** Cost breakdown */
  cost: CostBreakdown;
  /** Request latency in ms */
  latencyMs?: number;
  /** Whether the request succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Attribution metadata */
  attribution?: CostAttribution;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Cost attribution for tracking
 */
export interface CostAttribution {
  /** User ID */
  userId?: string;
  /** Agent ID */
  agentId?: string;
  /** Session ID */
  sessionId?: string;
  /** Project ID */
  projectId?: string;
  /** Team ID */
  teamId?: string;
  /** Environment */
  environment?: string;
  /** Feature or operation name */
  feature?: string;
  /** Custom labels */
  labels?: Record<string, string>;
}

/**
 * Aggregated cost summary
 */
export interface CostSummary {
  /** Time period start */
  periodStart: Date;
  /** Time period end */
  periodEnd: Date;
  /** Total cost */
  totalCost: number;
  /** Total tokens used */
  totalTokens: number;
  /** Total input tokens */
  inputTokens: number;
  /** Total output tokens */
  outputTokens: number;
  /** Number of requests */
  requestCount: number;
  /** Number of successful requests */
  successCount: number;
  /** Number of failed requests */
  errorCount: number;
  /** Average cost per request */
  avgCostPerRequest: number;
  /** Average tokens per request */
  avgTokensPerRequest: number;
  /** Average latency in ms */
  avgLatencyMs?: number;
  /** Currency */
  currency: string;
}

/**
 * Cost by dimension
 */
export interface CostByDimension {
  /** Dimension name (e.g., 'model', 'user', 'feature') */
  dimension: string;
  /** Dimension value */
  value: string;
  /** Total cost */
  totalCost: number;
  /** Total tokens */
  totalTokens: number;
  /** Request count */
  requestCount: number;
  /** Percentage of total */
  percentage: number;
}

/**
 * Cost trend data point
 */
export interface CostTrendPoint {
  /** Time bucket */
  timestamp: Date;
  /** Cost in this period */
  cost: number;
  /** Tokens in this period */
  tokens: number;
  /** Requests in this period */
  requests: number;
}

/**
 * Time granularity for aggregations
 */
export type TimeGranularity = 'minute' | 'hour' | 'day' | 'week' | 'month';

/**
 * Cost query filters
 */
export interface CostQueryFilter {
  /** Start date */
  startDate?: Date;
  /** End date */
  endDate?: Date;
  /** Provider filter */
  providers?: AIProvider[];
  /** Model filter */
  models?: string[];
  /** User IDs */
  userIds?: string[];
  /** Agent IDs */
  agentIds?: string[];
  /** Session IDs */
  sessionIds?: string[];
  /** Project IDs */
  projectIds?: string[];
  /** Team IDs */
  teamIds?: string[];
  /** Environment */
  environment?: string;
  /** Feature filter */
  features?: string[];
  /** Label filters */
  labels?: Record<string, string>;
  /** Success filter */
  success?: boolean;
}

/**
 * Cost query options
 */
export interface CostQueryOptions extends CostQueryFilter {
  /** Group by dimension */
  groupBy?: string;
  /** Time granularity for trends */
  granularity?: TimeGranularity;
  /** Limit results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Sort field */
  sortBy?: 'cost' | 'tokens' | 'requests' | 'timestamp';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Cost manager configuration
 */
export interface CostManagerConfig {
  /** Default currency */
  currency?: string;
  /** Auto-flush interval in ms (0 to disable) */
  autoFlushInterval?: number;
  /** Buffer size before auto-flush */
  bufferSize?: number;
  /** Enable real-time tracking */
  realTimeTracking?: boolean;
  /** Default attribution */
  defaultAttribution?: Partial<CostAttribution>;
}

/**
 * Cost tracking events
 */
export interface CostEvents {
  'cost:recorded': CostRecord;
  'cost:batch': { records: CostRecord[] };
  'budget:warning': { budgetId: string; usage: number; limit: number };
  'budget:exceeded': { budgetId: string; usage: number; limit: number };
  'alert:triggered': { alertId: string; type: string; message: string };
  error: { message: string; cause?: unknown };
}
