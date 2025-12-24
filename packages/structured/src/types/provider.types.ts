/**
 * Provider Types
 *
 * Type definitions for provider adapters.
 */

import type { ChatMessage, ExtractionMode, TokenUsage } from './core.types.js';
import type { JsonSchema, ToolDefinition } from './schema.types.js';

/**
 * Provider capabilities
 */
export interface ProviderCapabilities {
  /** Supports native JSON mode */
  jsonMode: boolean;
  /** Supports strict JSON mode */
  strictJsonMode: boolean;
  /** Supports function/tool calling */
  toolCalling: boolean;
  /** Supports streaming */
  streaming: boolean;
  /** Supports system messages */
  systemMessages: boolean;
  /** Maximum context window */
  maxContextWindow?: number;
  /** Maximum output tokens */
  maxOutputTokens?: number;
}

/**
 * Provider adapter interface
 */
export interface ProviderAdapter {
  /** Provider name */
  readonly name: string;

  /** Get provider capabilities for a model */
  getCapabilities(model: string): ProviderCapabilities;

  /** Check if JSON mode is available */
  supportsJsonMode(model: string): boolean;

  /** Check if tool calling is available */
  supportsToolCalling(model: string): boolean;

  /** Create a completion request */
  createCompletion(request: ProviderRequest): Promise<ProviderResponse>;

  /** Create a streaming completion request */
  createStreamingCompletion(
    request: ProviderRequest,
  ): AsyncIterableIterator<ProviderStreamChunk>;

  /** Format messages for provider */
  formatMessages(messages: ChatMessage[]): unknown;

  /** Format JSON schema for provider */
  formatJsonSchema(schema: JsonSchema): unknown;

  /** Format tool definition for provider */
  formatToolDefinition(tool: ToolDefinition): unknown;
}

/**
 * Provider request
 */
export interface ProviderRequest {
  /** Model */
  model: string;
  /** Messages */
  messages: ChatMessage[];
  /** Extraction mode */
  mode: ExtractionMode;
  /** JSON schema (for json mode) */
  jsonSchema?: JsonSchema;
  /** Tool definition (for tool mode) */
  toolDefinition?: ToolDefinition;
  /** Temperature */
  temperature?: number;
  /** Max tokens */
  maxTokens?: number;
  /** Whether to stream */
  stream?: boolean;
  /** Additional options */
  options?: Record<string, unknown>;
}

/**
 * Provider response
 */
export interface ProviderResponse {
  /** Response content */
  content: string;
  /** Token usage */
  usage?: TokenUsage;
  /** Finish reason */
  finishReason?: string;
  /** Tool calls (if any) */
  toolCalls?: ProviderToolCall[];
  /** Raw provider response */
  raw?: unknown;
}

/**
 * Provider tool call
 */
export interface ProviderToolCall {
  /** Call ID */
  id: string;
  /** Tool name */
  name: string;
  /** Arguments as string */
  arguments: string;
}

/**
 * Provider stream chunk
 */
export interface ProviderStreamChunk {
  /** Content delta */
  content: string;
  /** Is final chunk */
  isFinal: boolean;
  /** Finish reason (on final) */
  finishReason?: string;
  /** Usage (on final) */
  usage?: TokenUsage;
  /** Tool call deltas */
  toolCallDeltas?: ProviderToolCallDelta[];
}

/**
 * Provider tool call delta
 */
export interface ProviderToolCallDelta {
  /** Tool index */
  index: number;
  /** Call ID */
  id?: string;
  /** Tool name */
  name?: string;
  /** Arguments delta */
  arguments?: string;
}

/**
 * OpenAI-specific types
 */
export interface OpenAIOptions {
  /** Organization ID */
  organization?: string;
  /** API base URL */
  baseURL?: string;
  /** Response format */
  responseFormat?: {
    type: 'json_object' | 'json_schema';
    json_schema?: {
      name: string;
      schema: JsonSchema;
      strict?: boolean;
    };
  };
}

/**
 * Anthropic-specific types
 */
export interface AnthropicOptions {
  /** API base URL */
  baseURL?: string;
  /** Metadata */
  metadata?: {
    user_id?: string;
  };
}

/**
 * Google-specific types
 */
export interface GoogleOptions {
  /** Generation config */
  generationConfig?: {
    responseMimeType?: 'application/json';
    responseSchema?: JsonSchema;
  };
  /** Safety settings */
  safetySettings?: unknown[];
}

/**
 * Provider factory options
 */
export type ProviderFactoryOptions =
  | { type: 'openai'; client: unknown; options?: OpenAIOptions }
  | { type: 'anthropic'; client: unknown; options?: AnthropicOptions }
  | { type: 'google'; client: unknown; options?: GoogleOptions }
  | { type: 'generic'; completionFn: GenericCompletionFn };

/**
 * Generic completion function
 */
export type GenericCompletionFn = (
  messages: ChatMessage[],
  options: GenericCompletionOptions,
) => Promise<string>;

/**
 * Generic completion options
 */
export interface GenericCompletionOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}
