/**
 * OpenAI Provider implementation
 */

import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionChunk,
  ModelInfo,
  ProviderConfig,
} from '../../core/types.js';
import { ProviderError } from '../../core/types.js';
import { Provider, type ProviderOptions } from '../Provider.js';
import { getModelInfo } from '../../utils/pricing.js';
import { generateRequestId } from '../../utils/hashing.js';

const DEFAULT_OPENAI_MODELS = [
  'gpt-5.5',
  'gpt-5.4-mini',
  'o1',
  'o1-mini',
  'o1-preview',
];

export interface OpenAIProviderOptions extends ProviderOptions {
  organization?: string;
  project?: string;
}

/**
 * OpenAI Provider for the gateway
 */
export class OpenAIProvider extends Provider {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly organization?: string;
  private readonly project?: string;
  private readonly timeout: number;

  constructor(options: OpenAIProviderOptions = {}) {
    const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }

    const config: ProviderConfig = {
      name: 'openai',
      apiKey,
      baseUrl: options.baseUrl || 'https://api.openai.com/v1',
      models: options.models || DEFAULT_OPENAI_MODELS,
      timeout: options.timeout || 60000,
      maxRetries: options.maxRetries || 3,
      headers: options.headers,
    };

    super(config);

    this.apiKey = apiKey;
    this.baseUrl = config.baseUrl!;
    this.organization = options.organization;
    this.project = options.project;
    this.timeout = config.timeout!;
  }

  /**
   * Execute a chat completion request
   */
  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const start = Date.now();

    try {
      const response = await this.makeRequest('/chat/completions', {
        method: 'POST',
        body: JSON.stringify(this.transformRequest(request)),
      });

      if (!response.ok) {
        const error = await this.parseError(response);
        throw error;
      }

      const data = (await response.json()) as Record<string, unknown>;
      const result = this.transformResponse(data, request.model);

      this.updateHealth(true, Date.now() - start);
      return result;
    } catch (error) {
      this.updateHealth(false, Date.now() - start);
      throw this.wrapError(error);
    }
  }

  /**
   * Execute a streaming chat completion request
   */
  async *chatStream(
    request: ChatCompletionRequest,
  ): AsyncGenerator<ChatCompletionChunk, void, unknown> {
    const start = Date.now();

    try {
      const response = await this.makeRequest('/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          ...this.transformRequest(request),
          stream: true,
          stream_options: { include_usage: true },
        }),
      });

      if (!response.ok) {
        const error = await this.parseError(response);
        throw error;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new ProviderError('No response body', 'openai');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const json = JSON.parse(trimmed.slice(6));
            yield this.transformChunk(json, request.model);
          } catch {
            // Skip malformed JSON
          }
        }
      }

      this.updateHealth(true, Date.now() - start);
    } catch (error) {
      this.updateHealth(false, Date.now() - start);
      throw this.wrapError(error);
    }
  }

  /**
   * Get model information
   */
  getModelInfo(model: string): ModelInfo | null {
    if (!this.supportsModel(model)) {
      return null;
    }
    return getModelInfo(model, 'openai');
  }

  /**
   * Make an HTTP request to the OpenAI API
   */
  private async makeRequest(
    path: string,
    options: RequestInit,
  ): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
      ...this.config.headers,
    };

    if (this.organization) {
      headers['OpenAI-Organization'] = this.organization;
    }

    if (this.project) {
      headers['OpenAI-Project'] = this.project;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      return await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Transform gateway request to OpenAI format
   */
  private transformRequest(
    request: ChatCompletionRequest,
  ): Record<string, unknown> {
    const transformed: Record<string, unknown> = {
      model: request.model,
      messages: request.messages,
    };

    if (request.temperature !== undefined) {
      transformed.temperature = request.temperature;
    }
    if (request.max_tokens !== undefined) {
      transformed.max_tokens = request.max_tokens;
    }
    if (request.top_p !== undefined) {
      transformed.top_p = request.top_p;
    }
    if (request.frequency_penalty !== undefined) {
      transformed.frequency_penalty = request.frequency_penalty;
    }
    if (request.presence_penalty !== undefined) {
      transformed.presence_penalty = request.presence_penalty;
    }
    if (request.stop !== undefined) {
      transformed.stop = request.stop;
    }
    if (request.tools !== undefined) {
      transformed.tools = request.tools;
    }
    if (request.tool_choice !== undefined) {
      transformed.tool_choice = request.tool_choice;
    }
    if (request.response_format !== undefined) {
      transformed.response_format = request.response_format;
    }
    if (request.seed !== undefined) {
      transformed.seed = request.seed;
    }
    if (request.user !== undefined) {
      transformed.user = request.user;
    }

    return transformed;
  }

  /**
   * Transform OpenAI response to gateway format
   */
  private transformResponse(
    data: Record<string, unknown>,
    model: string,
  ): ChatCompletionResponse {
    return {
      id: (data.id as string) || generateRequestId(),
      object: 'chat.completion',
      created: (data.created as number) || Math.floor(Date.now() / 1000),
      model: (data.model as string) || model,
      choices: data.choices as ChatCompletionResponse['choices'],
      usage: data.usage as ChatCompletionResponse['usage'],
      system_fingerprint: data.system_fingerprint as string | undefined,
    };
  }

  /**
   * Transform OpenAI stream chunk to gateway format
   */
  private transformChunk(
    data: Record<string, unknown>,
    model: string,
  ): ChatCompletionChunk {
    return {
      id: (data.id as string) || generateRequestId(),
      object: 'chat.completion.chunk',
      created: (data.created as number) || Math.floor(Date.now() / 1000),
      model: (data.model as string) || model,
      choices: data.choices as ChatCompletionChunk['choices'],
      system_fingerprint: data.system_fingerprint as string | undefined,
      usage: data.usage as ChatCompletionChunk['usage'],
    };
  }

  /**
   * Parse error response from OpenAI
   */
  private async parseError(response: Response): Promise<ProviderError> {
    let message = `OpenAI API error: ${response.status}`;
    const retryable = response.status >= 500 || response.status === 429;

    try {
      const data = (await response.json()) as { error?: { message?: string } };
      if (data.error?.message) {
        message = data.error.message;
      }
    } catch {
      // Use default message
    }

    return new ProviderError(message, 'openai', undefined, retryable);
  }

  /**
   * Wrap unknown errors
   */
  private wrapError(error: unknown): ProviderError {
    if (error instanceof ProviderError) {
      return error;
    }

    if (error instanceof Error) {
      const isTimeout =
        error.name === 'AbortError' || error.message.includes('timeout');
      return new ProviderError(
        error.message,
        'openai',
        error,
        isTimeout, // Timeouts are retryable
      );
    }

    return new ProviderError('Unknown error', 'openai', undefined, true);
  }
}
