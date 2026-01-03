/**
 * Structured Client
 *
 * Main client for extracting structured data from LLM responses.
 */

import { z } from 'zod';
import { EventEmitter } from 'eventemitter3';
import type {
  StructuredClientConfig,
  StructuredRequestOptions,
  ExtractionResult,
  ExtractionMode,
  ExtractionModeConfig,
  RetryConfig,
  ExtractionAttempt,
  ExtractionMetadata,
  TokenUsage,
  ChatMessage,
  ValidationError,
} from '../types/core.types.js';
import { StructuredError } from '../types/core.types.js';
import type {
  ProviderAdapter,
  ProviderResponse,
} from '../types/provider.types.js';
import type {
  StreamingOptions,
  StreamingResult,
} from '../types/streaming.types.js';
import type { JsonSchema, ToolDefinition } from '../types/schema.types.js';
import { zodToJsonSchema, schemaToPrompt } from '../schema/SchemaToPrompt.js';
import {
  validateSchema,
  getValidationHints,
} from '../schema/SchemaValidator.js';

/**
 * Events emitted by the StructuredClient
 */
interface StructuredClientEvents {
  'extraction:start': { requestId: string; mode: ExtractionMode };
  'extraction:attempt': {
    requestId: string;
    attempt: number;
    mode: ExtractionMode;
  };
  'extraction:success': { requestId: string; data: unknown; attempts: number };
  'extraction:error': { requestId: string; error: Error; attempt: number };
  'extraction:retry': {
    requestId: string;
    attempt: number;
    reason: string;
    hints: string[];
  };
  'validation:failed': { requestId: string; errors: ValidationError[] };
  'mode:switch': {
    requestId: string;
    from: ExtractionMode;
    to: ExtractionMode;
  };
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  backoffMultiplier: 1.5,
  initialDelay: 1000,
  maxDelay: 10000,
  retryOn: ['validation_error', 'parse_error'],
};

/**
 * Main structured output client
 */
export class StructuredClient extends EventEmitter<StructuredClientEvents> {
  private readonly provider: ProviderAdapter;
  private readonly config: StructuredClientConfig;

  constructor(
    provider: ProviderAdapter,
    config: Partial<StructuredClientConfig> = {},
  ) {
    super();
    this.provider = provider;
    this.config = {
      defaultMode: config.defaultMode ?? 'json',
      defaultRetry: { ...DEFAULT_RETRY_CONFIG, ...config.defaultRetry },
      enableFixHints: config.enableFixHints ?? true,
      validatePartials: config.validatePartials ?? false,
      ...config,
    };
  }

  /**
   * Extract structured data from an LLM response
   */
  async extract<T extends z.ZodType>(
    options: StructuredRequestOptions<T>,
  ): Promise<ExtractionResult<z.infer<T>>> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    const attempts: ExtractionAttempt[] = [];

    const mode = this.resolveMode(options.mode);
    const retryConfig: RetryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      ...this.config.defaultRetry,
      ...options.retry,
    };

    this.emit('extraction:start', { requestId, mode });

    let lastError: Error | undefined;
    let currentMode = mode;
    const totalTokens: TokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };

    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      this.emit('extraction:attempt', {
        requestId,
        attempt,
        mode: currentMode,
      });

      try {
        const result = await this.executeExtraction(
          options,
          currentMode,
          attempts,
          attempt,
        );

        // Accumulate token usage
        if (result.usage) {
          totalTokens.promptTokens += result.usage.promptTokens;
          totalTokens.completionTokens += result.usage.completionTokens;
          totalTokens.totalTokens += result.usage.totalTokens;
        }

        // Validate the result
        const validation = validateSchema(
          options.response_format,
          result.content,
        );

        if (validation.success) {
          const attemptRecord: ExtractionAttempt = {
            attempt,
            mode: currentMode,
            success: true,
            duration: Date.now() - startTime,
            rawResponse: result.rawResponse,
          };
          attempts.push(attemptRecord);

          this.emit('extraction:success', {
            requestId,
            data: validation.data,
            attempts: attempt,
          });

          return {
            success: true,
            data: validation.data,
            raw: result.rawResponse,
            metadata: this.createMetadata(
              startTime,
              attempts,
              totalTokens,
              options.model,
            ),
          };
        }

        // Validation failed
        const validationErrors = validation.errors ?? [];
        this.emit('validation:failed', { requestId, errors: validationErrors });

        const hints = this.config.enableFixHints
          ? getValidationHints(options.response_format, result.content)
          : [];

        attempts.push({
          attempt,
          mode: currentMode,
          success: false,
          duration: Date.now() - startTime,
          rawResponse: result.rawResponse,
          error: 'Validation failed',
          validationErrors,
        });

        lastError = this.createStructuredError(
          'Validation failed',
          'VALIDATION_ERROR',
          attempts,
          validationErrors,
          result.content,
        );

        // Check if we should retry
        if (
          attempt < retryConfig.maxAttempts &&
          this.shouldRetry('validation_error', retryConfig, attempt)
        ) {
          this.emit('extraction:retry', {
            requestId,
            attempt,
            reason: 'validation_error',
            hints,
          });

          // Add fix hints to messages for retry
          if (hints.length > 0 && this.config.enableFixHints) {
            options = this.addFixHintsToMessages(
              options,
              hints,
              validationErrors,
            );
          }

          // Apply backoff
          await this.delay(this.calculateBackoff(attempt, retryConfig));

          // Consider mode switching for hybrid mode
          if (this.shouldSwitchMode(currentMode, attempt, options.mode)) {
            const newMode = this.getNextMode(currentMode);
            this.emit('mode:switch', {
              requestId,
              from: currentMode,
              to: newMode,
            });
            currentMode = newMode;
          }

          continue;
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.emit('extraction:error', { requestId, error: err, attempt });

        const errorType = this.classifyError(err);
        attempts.push({
          attempt,
          mode: currentMode,
          success: false,
          duration: Date.now() - startTime,
          error: err.message,
        });

        lastError = err;

        // Check if we should retry
        if (
          attempt < retryConfig.maxAttempts &&
          this.shouldRetry(errorType, retryConfig, attempt)
        ) {
          this.emit('extraction:retry', {
            requestId,
            attempt,
            reason: errorType,
            hints: [],
          });

          await this.delay(this.calculateBackoff(attempt, retryConfig));
          continue;
        }
      }
    }

    // All attempts failed
    return {
      success: false,
      error: lastError ?? new Error('All extraction attempts failed'),
      raw: attempts[attempts.length - 1]?.rawResponse,
      metadata: this.createMetadata(
        startTime,
        attempts,
        totalTokens,
        options.model,
      ),
    };
  }

  /**
   * Extract with streaming partial results
   */
  async extractStream<T extends z.ZodType>(
    options: StructuredRequestOptions<T>,
    streamingOptions?: StreamingOptions,
  ): Promise<StreamingResult<z.infer<T>>> {
    // Import streaming implementation dynamically to avoid circular deps
    const { createStreamingResult } = await import(
      '../streaming/StreamingExtractor.js'
    );
    return createStreamingResult(
      this,
      this.provider,
      options,
      streamingOptions,
    );
  }

  /**
   * Execute a single extraction attempt
   */
  private async executeExtraction<T extends z.ZodType>(
    options: StructuredRequestOptions<T>,
    mode: ExtractionMode,
    _previousAttempts: ExtractionAttempt[],
    _attempt: number,
  ): Promise<{ content: unknown; rawResponse: string; usage?: TokenUsage }> {
    const { model, messages } = options;
    const jsonSchema = zodToJsonSchema(options.response_format);

    let response: ProviderResponse;

    switch (mode) {
      case 'json':
        response = await this.extractWithJsonMode(model, messages, jsonSchema);
        break;
      case 'tool':
        response = await this.extractWithToolMode(
          model,
          messages,
          jsonSchema,
          options.response_format,
        );
        break;
      case 'prompt':
        response = await this.extractWithPromptMode(
          model,
          messages,
          options.response_format,
        );
        break;
      case 'hybrid':
        // Start with json mode for hybrid
        response = await this.extractWithJsonMode(model, messages, jsonSchema);
        break;
      default:
        throw new Error(`Unknown extraction mode: ${mode as string}`);
    }

    // Parse the response content
    const content = this.parseResponse(response, mode);

    return {
      content,
      rawResponse: response.content,
      usage: response.usage,
    };
  }

  /**
   * Extract using JSON mode
   */
  private async extractWithJsonMode(
    model: string,
    messages: ChatMessage[],
    jsonSchema: JsonSchema,
  ): Promise<ProviderResponse> {
    return this.provider.createCompletion({
      model,
      messages,
      mode: 'json',
      jsonSchema,
    });
  }

  /**
   * Extract using tool/function calling mode
   */
  private async extractWithToolMode<T extends z.ZodType>(
    model: string,
    messages: ChatMessage[],
    jsonSchema: JsonSchema,
    _schema: T,
  ): Promise<ProviderResponse> {
    const toolDefinition: ToolDefinition = {
      type: 'function',
      function: {
        name: 'extract_data',
        description: 'Extract structured data from the response',
        parameters: jsonSchema,
        strict: true,
      },
    };

    return this.provider.createCompletion({
      model,
      messages,
      mode: 'tool',
      toolDefinition,
    });
  }

  /**
   * Extract using prompt engineering mode
   */
  private async extractWithPromptMode<T extends z.ZodType>(
    model: string,
    messages: ChatMessage[],
    schema: T,
  ): Promise<ProviderResponse> {
    // Generate schema prompt
    const prompt = schemaToPrompt(schema, {
      format: 'natural',
      includeConstraints: true,
      includeExamples: true,
    });

    // Add schema prompt to system message
    const enhancedMessages = this.addSchemaPromptToMessages(
      messages,
      prompt.text,
    );

    return this.provider.createCompletion({
      model,
      messages: enhancedMessages,
      mode: 'prompt',
    });
  }

  /**
   * Parse the response based on mode
   */
  private parseResponse(
    response: ProviderResponse,
    mode: ExtractionMode,
  ): unknown {
    if (
      mode === 'tool' &&
      response.toolCalls &&
      response.toolCalls.length > 0
    ) {
      // Parse tool call arguments
      try {
        return JSON.parse(response.toolCalls[0].arguments);
      } catch {
        throw new Error('Failed to parse tool call arguments');
      }
    }

    // Extract JSON from response content
    return this.extractJsonFromContent(response.content);
  }

  /**
   * Extract JSON from text content
   */
  private extractJsonFromContent(content: string): unknown {
    // Try direct parse first
    try {
      return JSON.parse(content);
    } catch {
      // Try to find JSON in the content
    }

    // Look for JSON in code blocks
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1].trim());
      } catch {
        // Continue to next approach
      }
    }

    // Look for JSON object/array anywhere in content
    const jsonMatch = content.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch {
        // Continue to throw
      }
    }

    throw new Error('No valid JSON found in response');
  }

  /**
   * Add schema prompt to messages
   */
  private addSchemaPromptToMessages(
    messages: ChatMessage[],
    schemaPrompt: string,
  ): ChatMessage[] {
    const systemIndex = messages.findIndex((m) => m.role === 'system');

    if (systemIndex >= 0) {
      const newMessages = [...messages];
      newMessages[systemIndex] = {
        ...newMessages[systemIndex],
        content: `${newMessages[systemIndex].content}\n\n${schemaPrompt}\n\nRespond with valid JSON only.`,
      };
      return newMessages;
    }

    // Add new system message
    return [
      {
        role: 'system',
        content: `${schemaPrompt}\n\nRespond with valid JSON only.`,
      },
      ...messages,
    ];
  }

  /**
   * Add fix hints to messages for retry
   */
  private addFixHintsToMessages<T extends z.ZodType>(
    options: StructuredRequestOptions<T>,
    hints: string[],
    errors: ValidationError[],
  ): StructuredRequestOptions<T> {
    const hintsText = hints.join('\n');
    const errorsText = errors
      .map((e) => `- ${e.path.join('.')}: ${e.message}`)
      .join('\n');

    const fixPrompt = `Your previous response had validation errors:\n${errorsText}\n\nPlease fix these issues:\n${hintsText}`;

    const newMessages: ChatMessage[] = [
      ...options.messages,
      {
        role: 'user',
        content: fixPrompt,
      },
    ];

    return {
      ...options,
      messages: newMessages,
    };
  }

  /**
   * Resolve the extraction mode
   */
  private resolveMode(modeConfig?: ExtractionModeConfig): ExtractionMode {
    if (!modeConfig) {
      return this.config.defaultMode ?? 'json';
    }

    if (typeof modeConfig === 'string') {
      return modeConfig;
    }

    return modeConfig.mode;
  }

  /**
   * Check if we should retry
   */
  private shouldRetry(
    errorType: string,
    config: RetryConfig,
    _attempt: number,
  ): boolean {
    return (config.retryOn ?? []).includes(
      errorType as RetryConfig['retryOn'][number],
    );
  }

  /**
   * Classify an error for retry logic
   */
  private classifyError(error: Error): string {
    const message = error.message.toLowerCase();

    if (message.includes('rate limit') || message.includes('429')) {
      return 'rate_limit';
    }
    if (message.includes('timeout')) {
      return 'timeout';
    }
    if (message.includes('json') || message.includes('parse')) {
      return 'parse_error';
    }
    if (message.includes('validation')) {
      return 'validation_error';
    }

    return 'unknown_error';
  }

  /**
   * Check if mode should be switched (for hybrid mode)
   */
  private shouldSwitchMode(
    _currentMode: ExtractionMode,
    attempt: number,
    modeConfig?: ExtractionModeConfig,
  ): boolean {
    if (!modeConfig || typeof modeConfig === 'string') {
      return false;
    }

    if (!('mode' in modeConfig) || modeConfig.mode !== 'hybrid') {
      return false;
    }

    // Switch modes after first failed attempt
    const hybridConfig = modeConfig as {
      mode: 'hybrid';
      fallbackOrder?: ExtractionMode[];
    };
    return (
      attempt > 0 &&
      !!hybridConfig.fallbackOrder &&
      hybridConfig.fallbackOrder.length > 0
    );
  }

  /**
   * Get next mode in fallback order
   */
  private getNextMode(currentMode: ExtractionMode): ExtractionMode {
    const fallbackOrder: ExtractionMode[] = ['json', 'tool', 'prompt'];
    const currentIndex = fallbackOrder.indexOf(currentMode);

    if (currentIndex < fallbackOrder.length - 1) {
      return fallbackOrder[currentIndex + 1];
    }

    return fallbackOrder[0];
  }

  /**
   * Calculate backoff delay
   */
  private calculateBackoff(attempt: number, config: RetryConfig): number {
    const delay =
      (config.initialDelay ?? 1000) *
      Math.pow(config.backoffMultiplier ?? 1.5, attempt - 1);
    return Math.min(delay, config.maxDelay ?? 10000);
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Generate a request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Create extraction metadata
   */
  private createMetadata(
    startTime: number,
    attempts: ExtractionAttempt[],
    usage: TokenUsage,
    model: string,
  ): ExtractionMetadata {
    return {
      totalAttempts: attempts.length,
      totalDuration: Date.now() - startTime,
      finalMode: attempts[attempts.length - 1]?.mode ?? 'json',
      tokenUsage: usage,
      attempts,
      model,
    };
  }

  /**
   * Create a structured error
   */
  private createStructuredError(
    message: string,
    code: string,
    attempts: ExtractionAttempt[],
    validationErrors?: ValidationError[],
    partial?: unknown,
  ): StructuredError {
    const error = new Error(message) as StructuredError;
    error.name = 'StructuredError';
    error.code = code;
    error.attempts = attempts;
    error.validationErrors = validationErrors;
    error.partial = partial;
    return error;
  }

  /**
   * Get provider capabilities
   */
  getProviderCapabilities(model: string) {
    return this.provider.getCapabilities(model);
  }

  /**
   * Check if a mode is supported
   */
  supportsMode(mode: ExtractionMode, model: string): boolean {
    const capabilities = this.provider.getCapabilities(model);

    switch (mode) {
      case 'json':
        return capabilities.jsonMode;
      case 'tool':
        return capabilities.toolCalling;
      case 'prompt':
        return true; // Always supported
      case 'hybrid':
        return capabilities.jsonMode || capabilities.toolCalling;
      default:
        return false;
    }
  }
}

/**
 * Create a StructuredClient instance
 */
export function createStructuredClient(
  provider: ProviderAdapter,
  config?: Partial<StructuredClientConfig>,
): StructuredClient {
  return new StructuredClient(provider, config);
}
