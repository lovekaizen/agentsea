/**
 * Core types for the AgentSea Gateway
 */

// ============================================================================
// Message Types (OpenAI-compatible)
// ============================================================================

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[] | null;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'auto' | 'low' | 'high';
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface Tool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

// ============================================================================
// Request Types
// ============================================================================

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  stream?: boolean;
  tools?: Tool[];
  tool_choice?:
    | 'none'
    | 'auto'
    | 'required'
    | { type: 'function'; function: { name: string } };
  response_format?: { type: 'text' | 'json_object' };
  seed?: number;
  user?: string;
  // Gateway-specific metadata
  _gateway?: GatewayRequestMetadata;
}

export interface GatewayRequestMetadata {
  tenantId?: string;
  requestId?: string;
  routingHint?: string; // Common values: 'cheapest', 'fastest', 'best'
  preferredProvider?: string;
  excludeProviders?: string[];
  maxCost?: number;
  maxLatency?: number;
  cachePolicy?: 'default' | 'no-cache' | 'force-cache';
  tags?: Record<string, string>;
}

// ============================================================================
// Response Types
// ============================================================================

export interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage: UsageInfo;
  system_fingerprint?: string;
  // Gateway-specific metadata
  _gateway?: GatewayResponseMetadata;
}

export interface ChatCompletionChoice {
  index: number;
  message: ChatMessage;
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
  logprobs?: unknown;
}

export interface UsageInfo {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface GatewayResponseMetadata {
  provider: string;
  originalModel: string;
  latencyMs: number;
  cost: number;
  cached: boolean;
  cacheKey?: string;
  retries: number;
  routingDecision?: RoutingDecision;
}

// ============================================================================
// Streaming Types
// ============================================================================

export interface ChatCompletionChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: ChatCompletionChunkChoice[];
  system_fingerprint?: string;
  usage?: UsageInfo;
}

export interface ChatCompletionChunkChoice {
  index: number;
  delta: Partial<ChatMessage>;
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
  logprobs?: unknown;
}

// ============================================================================
// Provider Types
// ============================================================================

export interface ProviderConfig {
  name: string;
  apiKey?: string;
  baseUrl?: string;
  models: string[];
  timeout?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface ProviderHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs: number;
  lastCheck: Date;
  errorRate: number;
  consecutiveFailures: number;
}

export interface ModelInfo {
  id: string;
  provider: string;
  contextWindow: number;
  maxOutputTokens: number;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  capabilities: ModelCapabilities;
}

export interface ModelCapabilities {
  streaming: boolean;
  tools: boolean;
  vision: boolean;
  json_mode: boolean;
  system_prompts: boolean;
}

// ============================================================================
// Routing Types
// ============================================================================

export type RoutingStrategy =
  | 'round-robin'
  | 'failover'
  | 'cost-optimized'
  | 'latency-optimized'
  | 'load-balanced'
  | 'conditional';

export interface RoutingDecision {
  provider: string;
  model: string;
  reason: string;
  alternatives: Array<{ provider: string; model: string; score: number }>;
  timestamp: Date;
}

export interface RouterConfig {
  strategy: RoutingStrategy;
  fallbackChain?: string[];
  weights?: Record<string, number>;
  rules?: RoutingRule[];
}

export interface RoutingRule {
  condition: (request: ChatCompletionRequest) => boolean;
  route: string;
  reason: string;
}

// ============================================================================
// Cache Types
// ============================================================================

export interface CacheConfig {
  enabled: boolean;
  ttl: number;
  maxEntries: number;
  type: 'exact' | 'semantic';
  similarityThreshold?: number;
}

export interface CacheEntry {
  key: string;
  response: ChatCompletionResponse;
  createdAt: Date;
  expiresAt: Date;
  hits: number;
  metadata: Record<string, unknown>;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  evictions: number;
}

// ============================================================================
// Rate Limit Types
// ============================================================================

export interface RateLimitConfig {
  requestsPerMinute?: number;
  requestsPerHour?: number;
  requestsPerDay?: number;
  tokensPerMinute?: number;
  tokensPerDay?: number;
  maxConcurrent?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: Date;
  limit: number;
  retryAfter?: number;
}

// ============================================================================
// Telemetry Types
// ============================================================================

export interface TelemetryConfig {
  metrics?: boolean;
  tracing?: boolean;
  logging?: {
    level: 'debug' | 'info' | 'warn' | 'error';
    redact?: string[];
  };
}

export interface GatewayMetrics {
  requests: {
    total: number;
    successful: number;
    failed: number;
    cached: number;
  };
  latency: {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  };
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  cost: {
    total: number;
    byProvider: Record<string, number>;
    byModel: Record<string, number>;
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
  };
  providers: Record<string, ProviderHealth>;
}

// ============================================================================
// Gateway Configuration
// ============================================================================

export interface GatewayConfig {
  providers: ProviderConfig[];
  routing?: RouterConfig;
  cache?: CacheConfig;
  rateLimit?:
    | RateLimitConfig
    | { default: RateLimitConfig; perTenant?: boolean };
  telemetry?: TelemetryConfig;
  auth?: AuthConfig;
  server?: ServerConfig;
}

export interface AuthConfig {
  type: 'api-key' | 'jwt' | 'none';
  keys?: string[];
  jwtSecret?: string;
  validateTenant?: (tenantId: string) => Promise<boolean>;
}

export interface ServerConfig {
  port?: number;
  host?: string;
  cors?: {
    origin?: string | string[];
    methods?: string[];
    headers?: string[];
  };
  basePath?: string;
}

// ============================================================================
// Error Types
// ============================================================================

export class GatewayError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public provider?: string,
    public retryable: boolean = false,
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}

export class ProviderError extends GatewayError {
  constructor(
    message: string,
    provider: string,
    public originalError?: Error,
    retryable: boolean = true,
  ) {
    super(message, 'PROVIDER_ERROR', 502, provider, retryable);
    this.name = 'ProviderError';
  }
}

export class RateLimitError extends GatewayError {
  constructor(
    message: string,
    public retryAfter: number,
    provider?: string,
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, provider, true);
    this.name = 'RateLimitError';
  }
}

export class AuthenticationError extends GatewayError {
  constructor(message: string) {
    super(message, 'AUTHENTICATION_FAILED', 401, undefined, false);
    this.name = 'AuthenticationError';
  }
}

export class ValidationError extends GatewayError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400, undefined, false);
    this.name = 'ValidationError';
  }
}
