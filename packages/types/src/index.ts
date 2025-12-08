import { z } from 'zod';

// Re-export all per-model type safety types
export * from './models';
export * from './config-builders';

/**
 * Core message types for agent conversations
 */
export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
}

/**
 * Output format options for agent responses
 */
export type OutputFormat = 'text' | 'markdown' | 'html' | 'react';

/**
 * Options for content formatting
 */
export interface FormatOptions {
  includeMetadata?: boolean;
  sanitizeHtml?: boolean;
  highlightCode?: boolean;
  theme?: 'light' | 'dark' | 'auto';
}

/**
 * Configuration for an agent
 */
export interface AgentConfig {
  name: string;
  description: string;
  model: string;
  provider: string;
  systemPrompt?: string;
  tools?: Tool[];
  temperature?: number;
  maxTokens?: number;
  maxIterations?: number;
  memory?: MemoryConfig;
  providerConfig?: ProviderInstanceConfig;
  outputFormat?: OutputFormat;
  formatOptions?: FormatOptions;
}

/**
 * Configuration for provider instances
 * Used to customize provider behavior (e.g., custom endpoints, API keys)
 */
export interface ProviderInstanceConfig {
  baseUrl?: string;
  apiKey?: string;
  timeout?: number;
  defaultHeaders?: Record<string, string>;
  organization?: string;
}

/**
 * Context passed to agents during execution
 */
export interface AgentContext {
  conversationId: string;
  userId?: string;
  sessionData: Record<string, any>;
  history: Message[];
  metadata?: Record<string, any>;
}

/**
 * Formatted content with optional metadata
 */
export interface FormattedContent {
  raw: string;
  format: OutputFormat;
  rendered?: string;
  metadata?: {
    hasCodeBlocks?: boolean;
    hasTables?: boolean;
    hasLists?: boolean;
    links?: Array<{ text: string; url: string }>;
  };
}

/**
 * Response from agent execution
 */
export interface AgentResponse {
  content: string;
  formatted?: FormattedContent;
  toolCalls?: ToolCall[];
  metadata: {
    tokensUsed: number;
    latencyMs: number;
    iterations: number;
    cost?: number;
  };
  nextAgent?: string;
  finishReason?: 'stop' | 'length' | 'tool_calls' | 'error';
}

/**
 * Tool definition interface
 */
export interface Tool {
  name: string;
  description: string;
  parameters: z.ZodSchema;
  execute: (params: any, context: ToolContext) => Promise<any>;
  retryConfig?: RetryConfig;
}

/**
 * Context passed to tools during execution
 */
export interface ToolContext {
  agentName: string;
  conversationId: string;
  metadata: Record<string, any>;
}

/**
 * Tool call made by an agent
 */
export interface ToolCall {
  id: string;
  tool: string;
  parameters: any;
  result?: any;
  error?: string;
}

/**
 * Retry configuration for tool execution
 */
export interface RetryConfig {
  maxAttempts: number;
  backoff: 'linear' | 'exponential';
  initialDelayMs?: number;
  maxDelayMs?: number;
  retryableErrors?: string[];
}

/**
 * Tool execution environment
 */
export type ToolEnvironment = 'server' | 'client';

/**
 * Base tool state for tracking in UI
 */
export type ToolCallState =
  | 'awaiting-input'
  | 'input-streaming'
  | 'input-complete'
  | 'approval-requested'
  | 'approval-denied'
  | 'executing'
  | 'result-streaming'
  | 'complete'
  | 'error';

/**
 * Extended tool call with state tracking for UI
 */
export interface TrackedToolCall extends ToolCall {
  state: ToolCallState;
  needsApproval?: boolean;
  approvalMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * Memory configuration for agents
 */
export interface MemoryConfig {
  type: 'buffer' | 'summary' | 'vector' | 'hybrid';
  maxMessages?: number;
  storage?: 'memory' | 'redis' | 'database';
  ttl?: number;
  summaryModel?: string;
}

/**
 * Memory store interface
 */
export interface MemoryStore {
  save(conversationId: string, messages: Message[]): Promise<void>;
  load(conversationId: string): Promise<Message[]>;
  clear(conversationId: string): Promise<void>;
  search?(query: string, limit?: number): Promise<Message[]>;
}

/**
 * LLM Provider interface
 */
export interface LLMProvider {
  generateResponse(
    messages: Message[],
    config: ProviderConfig,
  ): Promise<LLMResponse>;
  streamResponse?(
    messages: Message[],
    config: ProviderConfig,
  ): AsyncIterable<LLMStreamChunk>;
  parseToolCalls(response: LLMResponse): ToolCall[];
}

/**
 * Configuration passed to LLM providers
 */
export interface ProviderConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
  tools?: Tool[];
  systemPrompt?: string;
  topP?: number;
  stopSequences?: string[];
}

/**
 * Response from LLM provider
 */
export interface LLMResponse {
  content: string;
  stopReason: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  rawResponse: any;
}

/**
 * Streaming chunk from LLM provider
 */
export interface LLMStreamChunk {
  type: 'content' | 'tool_call' | 'done';
  content?: string;
  toolCall?: Partial<ToolCall>;
  done?: boolean;
}

/**
 * Stream event emitted during agent execution
 */
export type StreamEvent =
  | {
      type: 'iteration';
      iteration: number;
    }
  | {
      type: 'content';
      content: string;
      delta?: boolean;
    }
  | {
      type: 'tool_calls';
      toolCalls: ToolCall[];
    }
  | {
      type: 'tool_result';
      toolCall: ToolCall;
    }
  | {
      type: 'done';
      metadata?: {
        tokensUsed?: number;
        latencyMs?: number;
        iterations?: number;
      };
    }
  | {
      type: 'error';
      error: string;
    };

/**
 * Workflow types for orchestration
 */
export type WorkflowType = 'sequential' | 'parallel' | 'supervisor' | 'custom';

/**
 * Workflow configuration
 */
export interface WorkflowConfig {
  name: string;
  type: WorkflowType;
  agents: AgentConfig[];
  routing?: RoutingLogic;
  errorHandling?: ErrorHandlingStrategy;
}

/**
 * Routing logic for workflows
 */
export interface RoutingLogic {
  strategy: 'conditional' | 'round-robin' | 'dynamic';
  rules?: RoutingRule[];
}

/**
 * Individual routing rule
 */
export interface RoutingRule {
  condition: (context: AgentContext, response: AgentResponse) => boolean;
  nextAgent: string;
}

/**
 * Error handling strategies
 */
export type ErrorHandlingStrategy =
  | 'fail-fast'
  | 'retry'
  | 'fallback'
  | 'continue';

/**
 * Observability types
 */
export interface AgentMetrics {
  agentName: string;
  latencyMs: number;
  tokensUsed: number;
  success: boolean;
  error?: string;
  timestamp: Date;
}

export interface SpanContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
}

// ============================================================================
// Tenant Types
// ============================================================================

/**
 * Tenant entity
 */
export interface Tenant {
  /** Unique tenant identifier */
  id: string;

  /** Tenant name */
  name: string;

  /** Tenant slug (URL-friendly identifier) */
  slug: string;

  /** Tenant metadata */
  metadata?: Record<string, unknown>;

  /** Tenant settings */
  settings?: TenantSettings;

  /** Tenant status */
  status: TenantStatus;

  /** Creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Tenant status
 */
export enum TenantStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  INACTIVE = 'inactive',
}

/**
 * Tenant settings
 */
export interface TenantSettings {
  /** Maximum agents allowed */
  maxAgents?: number;

  /** Maximum conversations per agent */
  maxConversations?: number;

  /** Maximum requests per minute */
  rateLimit?: number;

  /** Data retention period in days */
  dataRetentionDays?: number;

  /** Allowed providers */
  allowedProviders?: string[];

  /** Custom settings */
  custom?: Record<string, unknown>;
}

/**
 * Tenant context - injected into request lifecycle
 */
export interface TenantContext {
  /** Current tenant */
  tenant: Tenant;

  /** User ID (optional, for user-level scoping within tenant) */
  userId?: string;

  /** Request metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Tenant API key for authentication
 */
export interface TenantApiKey {
  /** API key ID */
  id: string;

  /** Tenant ID */
  tenantId: string;

  /** API key (hashed) */
  key: string;

  /** API key name/description */
  name: string;

  /** Scopes/permissions */
  scopes: string[];

  /** Expiration date (optional) */
  expiresAt?: Date;

  /** Creation timestamp */
  createdAt: Date;

  /** Last used timestamp */
  lastUsedAt?: Date;

  /** Active status */
  isActive: boolean;
}

/**
 * Tenant quota tracking
 */
export interface TenantQuota {
  /** Tenant ID */
  tenantId: string;

  /** Resource type (e.g., 'requests', 'tokens', 'storage') */
  resource: string;

  /** Used amount */
  used: number;

  /** Limit amount */
  limit: number;

  /** Period (e.g., 'daily', 'monthly') */
  period: 'hourly' | 'daily' | 'monthly';

  /** Period start timestamp */
  periodStart: Date;

  /** Period end timestamp */
  periodEnd: Date;
}

/**
 * Tenant storage interface for persistence
 */
export interface TenantStorage {
  /**
   * Create a new tenant
   */
  createTenant(
    tenant: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Tenant>;

  /**
   * Get tenant by ID
   */
  getTenant(tenantId: string): Promise<Tenant | null>;

  /**
   * Get tenant by slug
   */
  getTenantBySlug(slug: string): Promise<Tenant | null>;

  /**
   * Update tenant
   */
  updateTenant(tenantId: string, updates: Partial<Tenant>): Promise<Tenant>;

  /**
   * Delete tenant
   */
  deleteTenant(tenantId: string): Promise<void>;

  /**
   * List all tenants
   */
  listTenants(options?: {
    limit?: number;
    offset?: number;
    status?: TenantStatus;
  }): Promise<{ tenants: Tenant[]; total: number }>;

  /**
   * Create API key for tenant
   */
  createApiKey(
    apiKey: Omit<TenantApiKey, 'id' | 'createdAt'>,
  ): Promise<TenantApiKey>;

  /**
   * Get API key by key value
   */
  getApiKeyByKey(key: string): Promise<TenantApiKey | null>;

  /**
   * Revoke API key
   */
  revokeApiKey(apiKeyId: string): Promise<void>;

  /**
   * Update quota
   */
  updateQuota(quota: TenantQuota): Promise<void>;

  /**
   * Get quota
   */
  getQuota(
    tenantId: string,
    resource: string,
    period: string,
  ): Promise<TenantQuota | null>;
}

/**
 * Tenant resolver - extracts tenant from request
 */
export interface TenantResolver {
  /**
   * Resolve tenant from context (e.g., headers, subdomain, API key)
   */
  resolve(context: unknown): Promise<TenantContext | null>;
}

// ============================================================================
// Voice Types
// ============================================================================

/**
 * Audio format types
 */
export type AudioFormat = 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';

/**
 * Voice types for TTS
 */
export type VoiceType = string;

/**
 * Speech-to-Text configuration
 */
export interface STTConfig {
  model?: string;
  language?: string;
  temperature?: number;
  prompt?: string;
  responseFormat?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
}

/**
 * Text-to-Speech configuration
 */
export interface TTSConfig {
  model?: string;
  voice?: VoiceType;
  speed?: number;
  format?: AudioFormat;
}

/**
 * Speech-to-Text transcription result
 */
export interface STTResult {
  text: string;
  language?: string;
  duration?: number;
  segments?: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
  }>;
  words?: Array<{
    word: string;
    start: number;
    end: number;
  }>;
}

/**
 * Text-to-Speech synthesis result
 */
export interface TTSResult {
  audio: Buffer;
  format: AudioFormat;
  duration?: number;
  byteLength: number;
}

/**
 * Speech-to-Text provider interface
 */
export interface STTProvider {
  /**
   * Transcribe audio to text
   */
  transcribe(audio: Buffer | string, config?: STTConfig): Promise<STTResult>;

  /**
   * Transcribe audio stream
   */
  transcribeStream?(
    audioStream: ReadableStream | NodeJS.ReadableStream,
    config?: STTConfig,
  ): AsyncIterable<Partial<STTResult>>;

  /**
   * Check if the provider supports streaming
   */
  supportsStreaming(): boolean;
}

/**
 * Text-to-Speech provider interface
 */
export interface TTSProvider {
  /**
   * Synthesize text to speech
   */
  synthesize(text: string, config?: TTSConfig): Promise<TTSResult>;

  /**
   * Synthesize text to speech stream
   */
  synthesizeStream?(text: string, config?: TTSConfig): AsyncIterable<Buffer>;

  /**
   * Check if the provider supports streaming
   */
  supportsStreaming(): boolean;

  /**
   * Get available voices
   */
  getVoices?(): Promise<
    Array<{
      id: string;
      name: string;
      language?: string;
      gender?: 'male' | 'female' | 'neutral';
    }>
  >;
}

/**
 * Voice conversation message
 */
export interface VoiceMessage {
  role: 'user' | 'assistant';
  text: string;
  audio?: Buffer;
  timestamp: Date;
}

/**
 * Voice agent configuration
 */
export interface VoiceAgentConfig {
  sttProvider: STTProvider;
  ttsProvider: TTSProvider;
  sttConfig?: STTConfig;
  ttsConfig?: TTSConfig;
  autoSpeak?: boolean;
}
