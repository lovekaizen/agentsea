/**
 * Anthropic Provider implementation
 * Converts between OpenAI-compatible format and Anthropic format
 */

import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionChunk,
  ChatMessage,
  ModelInfo,
  ProviderConfig,
} from '../../core/types.js';
import { ProviderError } from '../../core/types.js';
import { Provider, type ProviderOptions } from '../Provider.js';
import { getModelInfo } from '../../utils/pricing.js';
import { generateRequestId } from '../../utils/hashing.js';

const DEFAULT_ANTHROPIC_MODELS = [
  'claude-3-5-sonnet-20241022',
  'claude-3-5-sonnet-latest',
  'claude-sonnet-4-20250514',
  'claude-3-5-haiku-20241022',
  'claude-3-opus-20240229',
  'claude-3-sonnet-20240229',
  'claude-3-haiku-20240307',
];

const ANTHROPIC_API_VERSION = '2023-06-01';

export interface AnthropicProviderOptions extends ProviderOptions {
  anthropicBeta?: string[];
}

/**
 * Anthropic Provider for the gateway
 */
export class AnthropicProvider extends Provider {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly anthropicBeta?: string[];

  constructor(options: AnthropicProviderOptions = {}) {
    const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('Anthropic API key is required');
    }

    const config: ProviderConfig = {
      name: 'anthropic',
      apiKey,
      baseUrl: options.baseUrl || 'https://api.anthropic.com',
      models: options.models || DEFAULT_ANTHROPIC_MODELS,
      timeout: options.timeout || 60000,
      maxRetries: options.maxRetries || 3,
      headers: options.headers,
    };

    super(config);

    this.apiKey = apiKey;
    this.baseUrl = config.baseUrl!;
    this.timeout = config.timeout!;
    this.anthropicBeta = options.anthropicBeta;
  }

  /**
   * Execute a chat completion request
   */
  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const start = Date.now();

    try {
      const anthropicRequest = this.transformToAnthropic(request);

      const response = await this.makeRequest('/v1/messages', {
        method: 'POST',
        body: JSON.stringify(anthropicRequest),
      });

      if (!response.ok) {
        const error = await this.parseError(response);
        throw error;
      }

      const data = (await response.json()) as Record<string, unknown>;
      const result = this.transformFromAnthropic(data, request.model);

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
      const anthropicRequest = this.transformToAnthropic(request);

      const response = await this.makeRequest('/v1/messages', {
        method: 'POST',
        body: JSON.stringify({
          ...anthropicRequest,
          stream: true,
        }),
      });

      if (!response.ok) {
        const error = await this.parseError(response);
        throw error;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new ProviderError('No response body', 'anthropic');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      const requestId = generateRequestId();
      let inputTokens = 0;
      let outputTokens = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          try {
            const event = JSON.parse(trimmed.slice(6));
            const chunk = this.transformStreamEvent(
              event,
              request.model,
              requestId,
            );

            // Track usage from message events
            if (event.type === 'message_start' && event.message?.usage) {
              inputTokens = event.message.usage.input_tokens || 0;
            }
            if (event.type === 'message_delta' && event.usage) {
              outputTokens = event.usage.output_tokens || 0;
            }

            if (chunk) {
              // Add usage to final chunk
              if (event.type === 'message_stop') {
                chunk.usage = {
                  prompt_tokens: inputTokens,
                  completion_tokens: outputTokens,
                  total_tokens: inputTokens + outputTokens,
                };
              }
              yield chunk;
            }
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
    return getModelInfo(model, 'anthropic');
  }

  /**
   * Make an HTTP request to the Anthropic API
   */
  private async makeRequest(
    path: string,
    options: RequestInit,
  ): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': ANTHROPIC_API_VERSION,
      ...this.config.headers,
    };

    if (this.anthropicBeta && this.anthropicBeta.length > 0) {
      headers['anthropic-beta'] = this.anthropicBeta.join(',');
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
   * Transform OpenAI-compatible request to Anthropic format
   */
  private transformToAnthropic(
    request: ChatCompletionRequest,
  ): Record<string, unknown> {
    const { messages, systemPrompt } = this.extractSystemPrompt(
      request.messages,
    );

    const transformed: Record<string, unknown> = {
      model: request.model,
      messages: messages.map((m) => this.transformMessage(m)),
      max_tokens: request.max_tokens || 4096,
    };

    if (systemPrompt) {
      transformed.system = systemPrompt;
    }

    if (request.temperature !== undefined) {
      transformed.temperature = request.temperature;
    }
    if (request.top_p !== undefined) {
      transformed.top_p = request.top_p;
    }
    if (request.stop !== undefined) {
      transformed.stop_sequences = Array.isArray(request.stop)
        ? request.stop
        : [request.stop];
    }

    // Transform tools
    if (request.tools && request.tools.length > 0) {
      transformed.tools = request.tools.map((tool) => ({
        name: tool.function.name,
        description: tool.function.description,
        input_schema: tool.function.parameters || { type: 'object' },
      }));

      if (request.tool_choice) {
        if (request.tool_choice === 'auto') {
          transformed.tool_choice = { type: 'auto' };
        } else if (request.tool_choice === 'required') {
          transformed.tool_choice = { type: 'any' };
        } else if (request.tool_choice === 'none') {
          // Don't send tools if none is selected
          delete transformed.tools;
        } else if (
          typeof request.tool_choice === 'object' &&
          request.tool_choice.function
        ) {
          transformed.tool_choice = {
            type: 'tool',
            name: request.tool_choice.function.name,
          };
        }
      }
    }

    return transformed;
  }

  /**
   * Extract system prompt from messages
   */
  private extractSystemPrompt(messages: ChatMessage[]): {
    messages: ChatMessage[];
    systemPrompt: string | null;
  } {
    const systemMessages = messages.filter((m) => m.role === 'system');
    const otherMessages = messages.filter((m) => m.role !== 'system');

    const systemPrompt =
      systemMessages.length > 0
        ? systemMessages
            .map((m) =>
              typeof m.content === 'string'
                ? m.content
                : JSON.stringify(m.content),
            )
            .join('\n')
        : null;

    return { messages: otherMessages, systemPrompt };
  }

  /**
   * Transform a single message to Anthropic format
   */
  private transformMessage(message: ChatMessage): Record<string, unknown> {
    // Handle tool results
    if (message.role === 'tool') {
      return {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: message.tool_call_id,
            content:
              typeof message.content === 'string'
                ? message.content
                : JSON.stringify(message.content),
          },
        ],
      };
    }

    // Handle assistant messages with tool calls
    if (message.role === 'assistant' && message.tool_calls) {
      const content: unknown[] = [];

      if (message.content) {
        content.push({
          type: 'text',
          text:
            typeof message.content === 'string'
              ? message.content
              : JSON.stringify(message.content),
        });
      }

      for (const toolCall of message.tool_calls) {
        content.push({
          type: 'tool_use',
          id: toolCall.id,
          name: toolCall.function.name,
          input: JSON.parse(toolCall.function.arguments),
        });
      }

      return { role: 'assistant', content };
    }

    // Handle regular messages
    return {
      role: message.role,
      content:
        typeof message.content === 'string'
          ? message.content
          : JSON.stringify(message.content),
    };
  }

  /**
   * Transform Anthropic response to OpenAI-compatible format
   */
  private transformFromAnthropic(
    data: Record<string, unknown>,
    model: string,
  ): ChatCompletionResponse {
    const content = data.content as Array<Record<string, unknown>>;
    let textContent = '';
    const toolCalls: ChatCompletionResponse['choices'][0]['message']['tool_calls'] =
      [];

    for (const block of content) {
      if (block.type === 'text') {
        textContent += block.text as string;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id as string,
          type: 'function',
          function: {
            name: block.name as string,
            arguments: JSON.stringify(block.input),
          },
        });
      }
    }

    const message: ChatMessage = {
      role: 'assistant',
      content: textContent || null,
    };

    if (toolCalls.length > 0) {
      message.tool_calls = toolCalls;
    }

    const stopReason = data.stop_reason as string;
    let finishReason: 'stop' | 'length' | 'tool_calls' | null = null;
    if (stopReason === 'end_turn') {
      finishReason = 'stop';
    } else if (stopReason === 'max_tokens') {
      finishReason = 'length';
    } else if (stopReason === 'tool_use') {
      finishReason = 'tool_calls';
    }

    const usage = data.usage as { input_tokens: number; output_tokens: number };

    return {
      id: (data.id as string) || generateRequestId(),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: (data.model as string) || model,
      choices: [
        {
          index: 0,
          message,
          finish_reason: finishReason,
        },
      ],
      usage: {
        prompt_tokens: usage.input_tokens,
        completion_tokens: usage.output_tokens,
        total_tokens: usage.input_tokens + usage.output_tokens,
      },
    };
  }

  /**
   * Transform Anthropic stream event to OpenAI-compatible chunk
   */
  private transformStreamEvent(
    event: Record<string, unknown>,
    model: string,
    requestId: string,
  ): ChatCompletionChunk | null {
    const eventType = event.type as string;

    if (eventType === 'content_block_delta') {
      const delta = event.delta as Record<string, unknown>;

      if (delta.type === 'text_delta') {
        return {
          id: requestId,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [
            {
              index: 0,
              delta: {
                content: delta.text as string,
              },
              finish_reason: null,
            },
          ],
        };
      }

      if (delta.type === 'input_json_delta') {
        // Tool input streaming
        return {
          id: requestId,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [
            {
              index: 0,
              delta: {},
              finish_reason: null,
            },
          ],
        };
      }
    }

    if (eventType === 'content_block_start') {
      const contentBlock = event.content_block as Record<string, unknown>;

      if (contentBlock?.type === 'tool_use') {
        return {
          id: requestId,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [
                  {
                    id: contentBlock.id as string,
                    type: 'function',
                    function: {
                      name: contentBlock.name as string,
                      arguments: '',
                    },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        };
      }
    }

    if (eventType === 'message_stop') {
      return {
        id: requestId,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: 'stop',
          },
        ],
      };
    }

    return null;
  }

  /**
   * Parse error response from Anthropic
   */
  private async parseError(response: Response): Promise<ProviderError> {
    let message = `Anthropic API error: ${response.status}`;
    const retryable = response.status >= 500 || response.status === 429;

    try {
      const data = (await response.json()) as { error?: { message?: string } };
      if (data.error?.message) {
        message = data.error.message;
      }
    } catch {
      // Use default message
    }

    return new ProviderError(message, 'anthropic', undefined, retryable);
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
      return new ProviderError(error.message, 'anthropic', error, isTimeout);
    }

    return new ProviderError('Unknown error', 'anthropic', undefined, true);
  }
}
