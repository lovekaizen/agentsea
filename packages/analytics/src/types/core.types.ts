/**
 * Core Analytics Types
 *
 * Type definitions for core analytics entities.
 */

/**
 * Analytics configuration
 */
export interface AnalyticsConfig {
  /** Enable analytics */
  enabled?: boolean;
  /** Storage adapter */
  storage?: AnalyticsStorageAdapter;
  /** Sampling rate (0-1) or sampling config */
  sampling?: number | SamplingConfig;
  /** Anonymization settings */
  anonymization?: AnonymizationConfig;
  /** Batch settings */
  batching?: BatchConfig;
  /** Batch configuration (alias) */
  batchConfig?: BatchConfig;
  /** Auto-classification */
  autoClassify?: boolean;
  /** Real-time processing */
  realtime?: boolean;
}

/**
 * Sampling configuration
 */
export interface SamplingConfig {
  /** Enable sampling */
  enabled: boolean;
  /** Sampling rate (0-1) */
  rate: number;
}

/**
 * Anonymization configuration
 */
export interface AnonymizationConfig {
  /** Enable anonymization */
  enabled: boolean;
  /** Hash user IDs */
  hashUserIds?: boolean;
  /** Remove IPs */
  removeIPs?: boolean;
  /** PII fields to anonymize */
  piiFields?: string[];
  /** Fields to anonymize */
  fieldsToAnonymize?: string[];
  /** Hash function */
  hashFunction?: 'sha256' | 'md5';
  /** Salt for hashing */
  salt?: string;
}

/**
 * Batch configuration
 */
export interface BatchConfig {
  /** Enable batching */
  enabled: boolean;
  /** Batch size */
  size?: number;
  /** Max batch size (alias) */
  maxSize?: number;
  /** Flush interval in ms */
  flushInterval?: number;
  /** Max queue size */
  maxQueueSize?: number;
  /** Max age before flush (ms) */
  maxAge?: number;
  /** Flush on shutdown */
  flushOnShutdown?: boolean;
}

/**
 * Conversation entity
 */
export interface Conversation {
  /** Conversation ID */
  id: string;
  /** User ID */
  userId?: string;
  /** Session ID */
  sessionId?: string;
  /** Start timestamp */
  startedAt: number;
  /** End timestamp */
  endedAt?: number;
  /** Duration in ms */
  durationMs?: number;
  /** Messages */
  messages: Message[];
  /** Conversation status */
  status: ConversationStatus;
  /** Outcome */
  outcome?: ConversationOutcome;
  /** Intent classification */
  intent?: IntentClassification;
  /** Sentiment analysis */
  sentiment?: SentimentResult;
  /** Topics */
  topics?: string[];
  /** Metadata */
  metadata?: Record<string, unknown>;
  /** Tags */
  tags?: string[];
}

/**
 * Conversation status
 */
export type ConversationStatus =
  | 'active'
  | 'completed'
  | 'abandoned'
  | 'escalated';

/**
 * Message entity
 */
export interface Message {
  /** Message ID */
  id: string;
  /** Conversation ID */
  conversationId: string;
  /** Role */
  role: 'user' | 'assistant' | 'system' | 'tool';
  /** Content */
  content: string;
  /** Timestamp */
  timestamp: number;
  /** Token usage */
  tokens?: TokenUsage;
  /** Token usage (alias) */
  tokenUsage?: TokenUsage;
  /** Latency in ms */
  latencyMs?: number;
  /** Model used */
  model?: string;
  /** Tool calls */
  toolCalls?: ToolCallInfo[];
  /** Sentiment */
  sentiment?: SentimentResult;
  /** Intent */
  intent?: IntentClassification;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Token usage
 */
export interface TokenUsage {
  /** Input tokens */
  input: number;
  /** Output tokens */
  output: number;
  /** Total tokens */
  total: number;
  /** Cached tokens */
  cached?: number;
}

/**
 * Tool call information
 */
export interface ToolCallInfo {
  /** Tool name */
  name: string;
  /** Arguments */
  arguments?: Record<string, unknown>;
  /** Result */
  result?: unknown;
  /** Duration in ms */
  durationMs?: number;
  /** Success */
  success?: boolean;
}

/**
 * Conversation outcome
 */
export interface ConversationOutcome {
  /** Success status */
  success: boolean;
  /** Resolution type */
  resolution?: ResolutionType;
  /** User satisfaction (1-5) */
  satisfaction?: number;
  /** User satisfaction (alias, 1-5) */
  userSatisfaction?: number;
  /** Was escalated */
  escalated?: boolean;
  /** Escalation reason */
  escalationReason?: string;
  /** Feedback */
  feedback?: string;
  /** Custom outcome data */
  custom?: Record<string, unknown>;
}

/**
 * Resolution type
 */
export type ResolutionType =
  | 'self-service'
  | 'agent-assisted'
  | 'escalated'
  | 'abandoned'
  | 'timeout'
  | 'error';

/**
 * Intent classification result
 */
export interface IntentClassification {
  /** Primary intent name */
  primary: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Secondary intents */
  secondary?: Intent[];
  /** Raw scores */
  scores?: Record<string, number>;
  /** Classification timestamp */
  classifiedAt?: number;
}

/**
 * Intent (with confidence)
 */
export interface Intent {
  /** Intent name */
  intent: string;
  /** Confidence (0-1) */
  confidence: number;
}

/**
 * Sentiment analysis result
 */
export interface SentimentResult {
  /** Score (-1 to 1) */
  score: number;
  /** Label */
  label: SentimentLabel;
  /** Confidence (0-1) */
  confidence: number;
  /** Emotions */
  emotions?: EmotionScores;
  /** Analysis timestamp */
  analyzedAt: number;
}

/**
 * Sentiment label
 */
export type SentimentLabel = 'positive' | 'negative' | 'neutral' | 'mixed';

/**
 * Emotion scores
 */
export interface EmotionScores {
  joy?: number;
  sadness?: number;
  anger?: number;
  fear?: number;
  surprise?: number;
  disgust?: number;
  frustration?: number;
  satisfaction?: number;
  trust?: number;
  anticipation?: number;
}

/**
 * Analytics event
 */
export interface AnalyticsEvent {
  /** Event ID */
  id: string;
  /** Event type */
  type: EventType;
  /** Event name (for custom events) */
  name?: string;
  /** Timestamp */
  timestamp: number;
  /** Conversation ID */
  conversationId?: string;
  /** User ID */
  userId?: string;
  /** Session ID */
  sessionId?: string;
  /** Event data */
  data: Record<string, unknown>;
  /** Event properties (alias for data) */
  properties?: Record<string, unknown>;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Event type
 */
export type EventType =
  | 'conversation_started'
  | 'conversation_ended'
  | 'conversation_message'
  | 'conversation_escalated'
  | 'conversation_abandoned'
  | 'message_sent'
  | 'message_received'
  | 'intent_classified'
  | 'sentiment_analyzed'
  | 'outcome_recorded'
  | 'escalation'
  | 'feedback_received'
  | 'feedback'
  | 'tool_usage'
  | 'token_usage'
  | 'error'
  | 'user_action'
  | 'session_start'
  | 'session_end'
  | 'custom';

/**
 * Session entity
 */
export interface Session {
  /** Session ID */
  id: string;
  /** User ID */
  userId?: string;
  /** Start timestamp */
  startedAt: number;
  /** End timestamp */
  endedAt?: number;
  /** Last activity timestamp */
  lastActivityAt?: number;
  /** Conversation IDs */
  conversationIds: string[];
  /** Platform */
  platform?: string;
  /** Device */
  device?: DeviceInfo;
  /** Location */
  location?: LocationInfo;
  /** Page views */
  pageViews?: number;
  /** Events count */
  events?: number;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Device information
 */
export interface DeviceInfo {
  /** Device type */
  type?: 'desktop' | 'mobile' | 'tablet' | 'other';
  /** Operating system */
  os?: string;
  /** Browser */
  browser?: string;
  /** User agent */
  userAgent?: string;
}

/**
 * Location information
 */
export interface LocationInfo {
  /** Country */
  country?: string;
  /** Region */
  region?: string;
  /** City */
  city?: string;
  /** Timezone */
  timezone?: string;
  /** IP address (may be anonymized) */
  ip?: string;
}

/**
 * Storage adapter interface
 */
export interface AnalyticsStorageAdapter {
  /** Save conversation */
  saveConversation(conversation: Conversation): Promise<void>;
  /** Get conversation */
  getConversation(id: string): Promise<Conversation | null>;
  /** Update conversation */
  updateConversation(id: string, updates: Partial<Conversation>): Promise<void>;
  /** Query conversations */
  queryConversations(
    query: ConversationQuery,
  ): Promise<ConversationQueryResult>;
  /** Save event */
  saveEvent(event: AnalyticsEvent): Promise<void>;
  /** Query events */
  queryEvents(query: EventQuery): Promise<AnalyticsEvent[]>;
  /** Save session */
  saveSession(session: Session): Promise<void>;
  /** Get session */
  getSession(id: string): Promise<Session | null>;
  /** Aggregate metrics */
  aggregate(query: AggregationQuery): Promise<AggregationResult>;
  /** Initialize storage */
  initialize?(): Promise<void>;
  /** Close storage */
  close?(): Promise<void>;
}

/**
 * Conversation query
 */
export interface ConversationQuery {
  /** Filter by user ID */
  userId?: string;
  /** Filter by session ID */
  sessionId?: string;
  /** Filter by status */
  status?: ConversationStatus | ConversationStatus[];
  /** Filter by intent */
  intent?: string;
  /** Filter by topic */
  topic?: string;
  /** Filter by tags */
  tags?: string[];
  /** Time range (preferred) */
  timeRange?: TimeRange;
  /** Time range start (deprecated, use timeRange) */
  startTime?: number;
  /** Time range end (deprecated, use timeRange) */
  endTime?: number;
  /** Filter by outcome success */
  outcome?: boolean;
  /** Filter by outcome success (alias) */
  success?: boolean;
  /** Filter by escalated */
  escalated?: boolean;
  /** Min satisfaction */
  minSatisfaction?: number;
  /** Max satisfaction */
  maxSatisfaction?: number;
  /** Custom filters */
  filters?: Record<string, unknown>;
  /** Filter by metadata fields */
  metadata?: Record<string, unknown>;
  /** Sort field */
  sortBy?: string;
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
  /** Limit */
  limit?: number;
  /** Offset */
  offset?: number;
}

/**
 * Conversation query result
 */
export interface ConversationQueryResult {
  /** Conversations */
  conversations: Conversation[];
  /** Total count */
  total: number;
  /** Has more */
  hasMore: boolean;
  /** Offset used */
  offset?: number;
  /** Limit used */
  limit?: number;
}

/**
 * Event query
 */
export interface EventQuery {
  /** Event type */
  type?: EventType | EventType[];
  /** Conversation ID */
  conversationId?: string;
  /** User ID */
  userId?: string;
  /** Session ID */
  sessionId?: string;
  /** Time range (preferred) */
  timeRange?: TimeRange;
  /** Time range start (deprecated, use timeRange) */
  startTime?: number;
  /** Time range end (deprecated, use timeRange) */
  endTime?: number;
  /** Limit */
  limit?: number;
  /** Offset */
  offset?: number;
}

/**
 * Aggregation query
 */
export interface AggregationQuery {
  /** Metric to aggregate */
  metric: string;
  /** Aggregation function */
  function: AggregationFunction;
  /** Group by field */
  groupBy?: string | string[];
  /** Time granularity */
  granularity?: TimeGranularity;
  /** Time period (preferred) */
  period?: TimeRange;
  /** Time range start (deprecated, use period) */
  startTime?: number;
  /** Time range end (deprecated, use period) */
  endTime?: number;
  /** Filters */
  filter?: Record<string, unknown>;
  /** Filters (alias) */
  filters?: Record<string, unknown>;
}

/**
 * Aggregation function
 */
export type AggregationFunction =
  | 'count'
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'median'
  | 'percentile'
  | 'distinct';

/**
 * Time granularity
 */
export type TimeGranularity =
  | 'minute'
  | 'hour'
  | 'day'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year';

/**
 * Aggregation result
 */
export interface AggregationResult {
  /** Result value */
  value: number;
  /** Time period covered */
  period?: TimeRange;
  /** Grouped buckets (when using groupBy or granularity) */
  buckets?: AggregationBucket[];
  /** Query metadata */
  metadata?: {
    query: AggregationQuery;
    executedAt: number;
    durationMs: number;
  };
}

/**
 * Aggregation bucket
 */
export interface AggregationBucket {
  /** Bucket key */
  key: string | number;
  /** Bucket value */
  value: number;
  /** Count of items in bucket */
  count?: number;
  /** Sub-buckets */
  buckets?: AggregationBucket[];
}

/**
 * Time period
 */
export type TimePeriod =
  | 'hour'
  | 'day'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year'
  | 'last-hour'
  | 'last-24-hours'
  | 'last-7-days'
  | 'last-30-days'
  | 'last-90-days'
  | 'last-year'
  | 'today'
  | 'this-week'
  | 'this-month'
  | 'this-quarter'
  | 'this-year'
  | 'all-time';

/**
 * Time range
 */
export interface TimeRange {
  /** Start timestamp */
  start: number;
  /** End timestamp */
  end: number;
}
