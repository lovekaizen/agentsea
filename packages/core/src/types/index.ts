import { z } from 'zod';

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
