/**
 * Anthropic Provider Adapter
 *
 * Adapter for Anthropic's Claude API for structured output extraction.
 */

import type {
  ProviderAdapter,
  ProviderCapabilities,
  ProviderRequest,
  ProviderResponse,
  ProviderStreamChunk,
  ProviderToolCall,
  AnthropicOptions,
} from '../types/provider.types.js';
import type { ChatMessage } from '../types/core.types.js';
import type { JsonSchema, ToolDefinition } from '../types/schema.types.js';

/**
 * Anthropic client interface (from @anthropic-ai/sdk)
 */
interface AnthropicClient {
  messages: {
    create(params: unknown): Promise<AnthropicMessage>;
  };
}

/**
 * Anthropic message response
 */
interface AnthropicMessage {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: 'text' | 'tool_use';
    text?: string;
    id?: string;
    name?: string;
    input?: unknown;
  }>;
  model: string;
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Anthropic streaming event
 */
interface AnthropicStreamEvent {
  type: string;
  message?: AnthropicMessage;
  index?: number;
  content_block?: {
    type: 'text' | 'tool_use';
    text?: string;
    id?: string;
    name?: string;
  };
  delta?: {
    type: string;
    text?: string;
    partial_json?: string;
  };
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Model capabilities for Anthropic models
 */
const MODEL_CAPABILITIES: Record<string, Partial<ProviderCapabilities>> = {
  'claude-opus-4-8': {
    jsonMode: false,
    strictJsonMode: false,
    toolCalling: true,
    streaming: true,
    systemMessages: true,
    maxContextWindow: 1000000,
    maxOutputTokens: 128000,
  },
  'claude-sonnet-4-6': {
    jsonMode: false,
    strictJsonMode: false,
    toolCalling: true,
    streaming: true,
    systemMessages: true,
    maxContextWindow: 1000000,
    maxOutputTokens: 64000,
  },
  'claude-sonnet-4-5': {
    jsonMode: false,
    strictJsonMode: false,
    toolCalling: true,
    streaming: true,
    systemMessages: true,
    maxContextWindow: 200000,
    maxOutputTokens: 64000,
  },
  'claude-haiku-4-5': {
    jsonMode: false,
    strictJsonMode: false,
    toolCalling: true,
    streaming: true,
    systemMessages: true,
    maxContextWindow: 200000,
    maxOutputTokens: 64000,
  },
};

/**
 * Anthropic provider adapter
 */
export class AnthropicAdapter implements ProviderAdapter {
  readonly name = 'anthropic';
  private readonly client: AnthropicClient;
  private readonly options: AnthropicOptions;

  constructor(client: AnthropicClient, options: AnthropicOptions = {}) {
    this.client = client;
    this.options = options;
  }

  /**
   * Get capabilities for a model
   */
  getCapabilities(model: string): ProviderCapabilities {
    // Find matching model (handle model aliases)
    const modelKey = Object.keys(MODEL_CAPABILITIES).find(
      (key) => model.includes(key) || key.includes(model),
    );
    const base = modelKey
      ? MODEL_CAPABILITIES[modelKey]
      : MODEL_CAPABILITIES['claude-sonnet-4-6'];

    return {
      jsonMode: base.jsonMode ?? false,
      strictJsonMode: base.strictJsonMode ?? false,
      toolCalling: base.toolCalling ?? true,
      streaming: base.streaming ?? true,
      systemMessages: base.systemMessages ?? true,
      maxContextWindow: base.maxContextWindow,
      maxOutputTokens: base.maxOutputTokens,
    };
  }

  /**
   * Check if JSON mode is available
   */
  supportsJsonMode(_model: string): boolean {
    // Anthropic doesn't have native JSON mode, but can use tool calling
    return false;
  }

  /**
   * Check if tool calling is available
   */
  supportsToolCalling(model: string): boolean {
    return this.getCapabilities(model).toolCalling;
  }

  /**
   * Create a completion request
   */
  async createCompletion(request: ProviderRequest): Promise<ProviderResponse> {
    const params = this.buildRequestParams(request);
    const response = await this.client.messages.create(params);

    return this.parseResponse(response);
  }

  /**
   * Create a streaming completion request
   */
  async *createStreamingCompletion(
    request: ProviderRequest,
  ): AsyncIterableIterator<ProviderStreamChunk> {
    const params = this.buildRequestParams(request);
    params.stream = true;

    const stream = await this.client.messages.create(params);

    // Handle the stream as an async iterable
    const asyncStream =
      stream as unknown as AsyncIterable<AnthropicStreamEvent>;

    let toolCallBuffer: {
      id?: string;
      name?: string;
      arguments: string;
    } | null = null;
    let inputTokens = 0;
    let outputTokens = 0;

    for await (const event of asyncStream) {
      switch (event.type) {
        case 'message_start':
          if (event.message?.usage) {
            inputTokens = event.message.usage.input_tokens;
          }
          break;

        case 'content_block_start':
          if (event.content_block?.type === 'tool_use') {
            toolCallBuffer = {
              id: event.content_block.id,
              name: event.content_block.name,
              arguments: '',
            };
          }
          break;

        case 'content_block_delta':
          if (event.delta?.type === 'text_delta' && event.delta.text) {
            yield {
              content: event.delta.text,
              isFinal: false,
            };
          } else if (
            event.delta?.type === 'input_json_delta' &&
            event.delta.partial_json
          ) {
            if (toolCallBuffer) {
              toolCallBuffer.arguments += event.delta.partial_json;
            }
            yield {
              content: '',
              isFinal: false,
              toolCallDeltas: toolCallBuffer
                ? [
                    {
                      index: 0,
                      id: toolCallBuffer.id,
                      name: toolCallBuffer.name,
                      arguments: event.delta.partial_json,
                    },
                  ]
                : undefined,
            };
          }
          break;

        case 'message_delta':
          if (event.usage) {
            outputTokens = event.usage.output_tokens;
          }
          break;

        case 'message_stop':
          yield {
            content: '',
            isFinal: true,
            usage: {
              promptTokens: inputTokens,
              completionTokens: outputTokens,
              totalTokens: inputTokens + outputTokens,
            },
          };
          break;
      }
    }
  }

  /**
   * Format messages for Anthropic
   */
  formatMessages(messages: ChatMessage[]): unknown {
    // Separate system message from other messages
    const systemMessage = messages.find((m) => m.role === 'system');
    const otherMessages = messages.filter((m) => m.role !== 'system');

    return {
      system: systemMessage?.content,
      messages: otherMessages.map((msg) => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      })),
    };
  }

  /**
   * Format JSON schema for Anthropic (via tool calling)
   */
  formatJsonSchema(schema: JsonSchema): unknown {
    // Anthropic uses tool calling for structured output
    return {
      name: 'extract_structured_data',
      description: 'Extract structured data from the conversation',
      input_schema: schema,
    };
  }

  /**
   * Format tool definition for Anthropic
   */
  formatToolDefinition(tool: ToolDefinition): unknown {
    return {
      name: tool.function.name,
      description: tool.function.description,
      input_schema: tool.function.parameters,
    };
  }

  /**
   * Build request parameters
   */
  private buildRequestParams(
    request: ProviderRequest,
  ): Record<string, unknown> {
    const formatted = this.formatMessages(request.messages) as {
      system?: string;
      messages: Array<{ role: string; content: string }>;
    };

    const params: Record<string, unknown> = {
      model: request.model,
      messages: formatted.messages,
      max_tokens: request.maxTokens ?? 4096,
    };

    if (formatted.system) {
      params.system = formatted.system;
    }

    if (request.temperature !== undefined) {
      params.temperature = request.temperature;
    }

    // Apply mode-specific settings
    switch (request.mode) {
      case 'json':
        // For JSON mode, use tool calling with structured extraction
        if (request.jsonSchema) {
          params.tools = [this.formatJsonSchema(request.jsonSchema)];
          params.tool_choice = {
            type: 'tool',
            name: 'extract_structured_data',
          };
        }
        break;

      case 'tool':
        if (request.toolDefinition) {
          params.tools = [this.formatToolDefinition(request.toolDefinition)];
          params.tool_choice = {
            type: 'tool',
            name: request.toolDefinition.function.name,
          };
        }
        break;

      case 'prompt':
        // For prompt mode, add JSON instruction to system
        if (params.system) {
          params.system = `${params.system as string}\n\nRespond with valid JSON only.`;
        } else {
          params.system = 'Respond with valid JSON only.';
        }
        break;
    }

    // Add metadata if provided
    if (this.options.metadata) {
      params.metadata = this.options.metadata;
    }

    // Merge additional options
    if (request.options) {
      Object.assign(params, request.options);
    }

    return params;
  }

  /**
   * Parse response
   */
  private parseResponse(response: AnthropicMessage): ProviderResponse {
    let content = '';
    let toolCalls: ProviderToolCall[] | undefined;

    for (const block of response.content) {
      if (block.type === 'text' && block.text) {
        content += block.text;
      } else if (block.type === 'tool_use') {
        if (!toolCalls) {
          toolCalls = [];
        }
        toolCalls.push({
          id: block.id ?? '',
          name: block.name ?? '',
          arguments: JSON.stringify(block.input),
        });
      }
    }

    return {
      content,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      finishReason: response.stop_reason ?? undefined,
      toolCalls,
      raw: response,
    };
  }
}

/**
 * Create an Anthropic adapter
 */
export function createAnthropicAdapter(
  client: AnthropicClient,
  options?: AnthropicOptions,
): AnthropicAdapter {
  return new AnthropicAdapter(client, options);
}
