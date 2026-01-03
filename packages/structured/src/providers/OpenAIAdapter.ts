/**
 * OpenAI Provider Adapter
 *
 * Adapter for OpenAI's API for structured output extraction.
 */

import type {
  ProviderAdapter,
  ProviderCapabilities,
  ProviderRequest,
  ProviderResponse,
  ProviderStreamChunk,
  ProviderToolCall,
  OpenAIOptions,
} from '../types/provider.types.js';
import type { ChatMessage } from '../types/core.types.js';
import type { JsonSchema, ToolDefinition } from '../types/schema.types.js';

/**
 * OpenAI client interface (from openai package)
 */
interface OpenAIClient {
  chat: {
    completions: {
      create(params: unknown): Promise<OpenAIChatCompletion>;
    };
  };
}

/**
 * OpenAI chat completion response
 */
interface OpenAIChatCompletion {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenAI streaming chunk
 */
interface OpenAIStreamChunk {
  id: string;
  choices: Array<{
    delta: {
      role?: string;
      content?: string | null;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Model capabilities for OpenAI models
 */
const MODEL_CAPABILITIES: Record<string, Partial<ProviderCapabilities>> = {
  'gpt-4o': {
    jsonMode: true,
    strictJsonMode: true,
    toolCalling: true,
    streaming: true,
    systemMessages: true,
    maxContextWindow: 128000,
    maxOutputTokens: 16384,
  },
  'gpt-4o-mini': {
    jsonMode: true,
    strictJsonMode: true,
    toolCalling: true,
    streaming: true,
    systemMessages: true,
    maxContextWindow: 128000,
    maxOutputTokens: 16384,
  },
  'gpt-4-turbo': {
    jsonMode: true,
    strictJsonMode: false,
    toolCalling: true,
    streaming: true,
    systemMessages: true,
    maxContextWindow: 128000,
    maxOutputTokens: 4096,
  },
  'gpt-4': {
    jsonMode: true,
    strictJsonMode: false,
    toolCalling: true,
    streaming: true,
    systemMessages: true,
    maxContextWindow: 8192,
    maxOutputTokens: 4096,
  },
  'gpt-3.5-turbo': {
    jsonMode: true,
    strictJsonMode: false,
    toolCalling: true,
    streaming: true,
    systemMessages: true,
    maxContextWindow: 16385,
    maxOutputTokens: 4096,
  },
  'o1-preview': {
    jsonMode: false,
    strictJsonMode: false,
    toolCalling: false,
    streaming: false,
    systemMessages: false,
    maxContextWindow: 128000,
    maxOutputTokens: 32768,
  },
  'o1-mini': {
    jsonMode: false,
    strictJsonMode: false,
    toolCalling: false,
    streaming: false,
    systemMessages: false,
    maxContextWindow: 128000,
    maxOutputTokens: 65536,
  },
};

/**
 * OpenAI provider adapter
 */
export class OpenAIAdapter implements ProviderAdapter {
  readonly name = 'openai';
  private readonly client: OpenAIClient;

  constructor(client: OpenAIClient, _options: OpenAIOptions = {}) {
    this.client = client;
  }

  /**
   * Get capabilities for a model
   */
  getCapabilities(model: string): ProviderCapabilities {
    const base = MODEL_CAPABILITIES[model] ?? MODEL_CAPABILITIES['gpt-4o'];

    return {
      jsonMode: base.jsonMode ?? true,
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
  supportsJsonMode(model: string): boolean {
    return this.getCapabilities(model).jsonMode;
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
    const response = await this.client.chat.completions.create(params);

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
    params.stream_options = { include_usage: true };

    const stream = await this.client.chat.completions.create(params);

    // Handle the stream as an async iterable
    const asyncStream = stream as unknown as AsyncIterable<OpenAIStreamChunk>;

    const toolCalls: Map<
      number,
      { id?: string; name?: string; arguments: string }
    > = new Map();

    for await (const chunk of asyncStream) {
      const choice = chunk.choices[0];

      if (!choice) continue;

      const delta = choice.delta;

      // Accumulate tool calls
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const existing = toolCalls.get(tc.index) ?? { arguments: '' };
          if (tc.id) existing.id = tc.id;
          if (tc.function?.name) existing.name = tc.function.name;
          if (tc.function?.arguments)
            existing.arguments += tc.function.arguments;
          toolCalls.set(tc.index, existing);
        }
      }

      const isFinal = choice.finish_reason !== null;

      yield {
        content: delta.content ?? '',
        isFinal,
        finishReason: choice.finish_reason ?? undefined,
        usage: chunk.usage
          ? {
              promptTokens: chunk.usage.prompt_tokens,
              completionTokens: chunk.usage.completion_tokens,
              totalTokens: chunk.usage.total_tokens,
            }
          : undefined,
        toolCallDeltas: delta.tool_calls?.map((tc) => ({
          index: tc.index,
          id: tc.id,
          name: tc.function?.name,
          arguments: tc.function?.arguments,
        })),
      };
    }
  }

  /**
   * Format messages for OpenAI
   */
  formatMessages(messages: ChatMessage[]): unknown {
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      name: msg.name,
    }));
  }

  /**
   * Format JSON schema for OpenAI
   */
  formatJsonSchema(schema: JsonSchema): unknown {
    return {
      type: 'json_schema',
      json_schema: {
        name: 'response',
        schema,
        strict: true,
      },
    };
  }

  /**
   * Format tool definition for OpenAI
   */
  formatToolDefinition(tool: ToolDefinition): unknown {
    return {
      type: 'function',
      function: {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters,
        strict: tool.function.strict,
      },
    };
  }

  /**
   * Build request parameters
   */
  private buildRequestParams(
    request: ProviderRequest,
  ): Record<string, unknown> {
    const params: Record<string, unknown> = {
      model: request.model,
      messages: this.formatMessages(request.messages),
      temperature: request.temperature,
      max_tokens: request.maxTokens,
    };

    // Apply mode-specific settings
    switch (request.mode) {
      case 'json':
        if (request.jsonSchema) {
          const caps = this.getCapabilities(request.model);
          if (caps.strictJsonMode) {
            params.response_format = {
              type: 'json_schema',
              json_schema: {
                name: 'response',
                schema: request.jsonSchema,
                strict: true,
              },
            };
          } else {
            params.response_format = { type: 'json_object' };
          }
        }
        break;

      case 'tool':
        if (request.toolDefinition) {
          params.tools = [this.formatToolDefinition(request.toolDefinition)];
          params.tool_choice = {
            type: 'function',
            function: { name: request.toolDefinition.function.name },
          };
        }
        break;
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
  private parseResponse(response: OpenAIChatCompletion): ProviderResponse {
    const choice = response.choices[0];
    const message = choice?.message;

    let toolCalls: ProviderToolCall[] | undefined;

    if (message?.tool_calls && message.tool_calls.length > 0) {
      toolCalls = message.tool_calls.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      }));
    }

    return {
      content: message?.content ?? '',
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
      finishReason: choice?.finish_reason,
      toolCalls,
      raw: response,
    };
  }
}

/**
 * Create an OpenAI adapter
 */
export function createOpenAIAdapter(
  client: OpenAIClient,
  options?: OpenAIOptions,
): OpenAIAdapter {
  return new OpenAIAdapter(client, options);
}
