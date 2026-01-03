/**
 * Core Types
 *
 * Core type definitions for structured output.
 */

import type { z } from 'zod';

/**
 * Supported extraction modes
 */
export type ExtractionMode = 'json' | 'tool' | 'prompt' | 'hybrid';

/**
 * Supported providers
 */
export type StructuredProvider = 'openai' | 'anthropic' | 'google' | 'generic';

/**
 * Message role
 */
export type MessageRole = 'system' | 'user' | 'assistant';

/**
 * Chat message
 */
export interface ChatMessage {
  role: MessageRole;
  content: string;
  name?: string;
}

/**
 * Structured request options
 */
export interface StructuredRequestOptions<T extends z.ZodType> {
  /** Model to use */
  model: string;
  /** Messages */
  messages: ChatMessage[];
  /** Response schema */
  response_format: T;
  /** Extraction mode */
  mode?: ExtractionModeConfig;
  /** Retry configuration */
  retry?: Partial<RetryConfig>;
  /** Temperature */
  temperature?: number;
  /** Max tokens */
  maxTokens?: number;
  /** Additional provider-specific options */
  options?: Record<string, unknown>;
}

/**
 * Extraction mode configuration
 */
export type ExtractionModeConfig =
  | ExtractionMode
  | JsonModeConfig
  | ToolModeConfig
  | PromptModeConfig
  | HybridModeConfig;

/**
 * JSON mode configuration
 */
export interface JsonModeConfig {
  mode: 'json';
  /** Whether to use strict JSON mode (if available) */
  strict?: boolean;
}

/**
 * Tool mode configuration
 */
export interface ToolModeConfig {
  mode: 'tool';
  /** Tool name */
  toolName?: string;
  /** Tool description */
  toolDescription?: string;
}

/**
 * Prompt mode configuration
 */
export interface PromptModeConfig {
  mode: 'prompt';
  /** Format to embed in prompt */
  format?: 'json-schema' | 'typescript' | 'examples';
  /** Where to add schema in prompt */
  position?: 'system' | 'user' | 'suffix';
  /** Include examples */
  includeExamples?: boolean;
}

/**
 * Hybrid mode configuration
 */
export interface HybridModeConfig {
  mode: 'hybrid';
  /** Preferred order of modes to try */
  fallbackOrder?: ExtractionMode[];
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of attempts */
  maxAttempts: number;
  /** Backoff multiplier */
  backoffMultiplier: number;
  /** Initial delay in ms */
  initialDelay: number;
  /** Maximum delay in ms */
  maxDelay: number;
  /** When to retry */
  retryOn: RetryCondition[];
  /** Fix hint configuration */
  fixHints?: FixHintConfig;
  /** Recovery options */
  recovery?: RecoveryConfig;
}

/**
 * Fix hint configuration
 */
export interface FixHintConfig {
  /** Include validation errors in retry */
  includeErrors?: boolean;
  /** Include correct format examples */
  includeExamples?: boolean;
  /** Suggest specific fixes */
  suggestFixes?: boolean;
  /** Custom hint generator */
  customHints?: (errors: ValidationError[], schema: z.ZodType) => string;
}

/**
 * Retry condition
 */
export type RetryCondition =
  | 'parse_error'
  | 'validation_error'
  | 'incomplete_response'
  | 'empty_response'
  | 'rate_limit'
  | 'timeout';

/**
 * Recovery configuration
 */
export interface RecoveryConfig {
  /** Try to repair malformed JSON */
  repairJson?: boolean;
  /** Extract from markdown code blocks */
  extractFromMarkdown?: boolean;
  /** Coerce types where safe */
  coerceTypes?: boolean;
  /** Use partial response if complete fails */
  usePartial?: boolean;
}

/**
 * Validation error
 */
export interface ValidationError {
  /** JSON path to the error */
  path: (string | number)[];
  /** Error message */
  message: string;
  /** Expected type or value */
  expected?: string;
  /** Received value */
  received?: unknown;
  /** Error code */
  code?: string;
}

/**
 * Extraction result
 */
export interface ExtractionResult<T> {
  /** Whether extraction succeeded */
  success: boolean;
  /** Extracted data (if successful) */
  data?: T;
  /** Error (if failed) */
  error?: Error;
  /** Raw response from LLM */
  raw?: string;
  /** Extraction metadata */
  metadata: ExtractionMetadata;
}

/**
 * Extraction metadata
 */
export interface ExtractionMetadata {
  /** Total attempts made */
  totalAttempts: number;
  /** Total duration in ms */
  totalDuration: number;
  /** Final mode used */
  finalMode: ExtractionMode;
  /** Token usage */
  tokenUsage?: TokenUsage;
  /** All attempts */
  attempts: ExtractionAttempt[];
  /** Model used */
  model: string;
}

/**
 * Token usage
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Extraction attempt
 */
export interface ExtractionAttempt {
  /** Attempt number */
  attempt: number;
  /** Mode used */
  mode: ExtractionMode;
  /** Whether attempt succeeded */
  success: boolean;
  /** Duration in ms */
  duration: number;
  /** Raw response */
  rawResponse?: string;
  /** Error if failed */
  error?: string;
  /** Validation errors */
  validationErrors?: ValidationError[];
}

/**
 * Structured client configuration
 */
export interface StructuredClientConfig {
  /** Default model */
  defaultModel?: string;
  /** Default extraction mode */
  defaultMode?: ExtractionMode;
  /** Default retry configuration */
  defaultRetry?: Partial<RetryConfig>;
  /** Enable fix hints for retries */
  enableFixHints?: boolean;
  /** Validate partial results during streaming */
  validatePartials?: boolean;
  /** Provider-specific options */
  providerOptions?: Record<string, unknown>;
}

/**
 * Structured error
 */
export class StructuredError extends Error {
  /** Error code */
  code: string;
  /** Extraction attempts */
  attempts: ExtractionAttempt[];
  /** Last validation errors */
  validationErrors?: ValidationError[];
  /** Partial result if available */
  partial?: unknown;

  constructor(
    message: string,
    code: string,
    attempts: ExtractionAttempt[],
    validationErrors?: ValidationError[],
    partial?: unknown,
  ) {
    super(message);
    this.name = 'StructuredError';
    this.code = code;
    this.attempts = attempts;
    this.validationErrors = validationErrors;
    this.partial = partial;
  }
}
