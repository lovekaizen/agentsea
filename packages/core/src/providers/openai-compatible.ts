import OpenAI from 'openai';
import { zodToJsonSchema } from 'zod-to-json-schema';

import {
  LLMProvider,
  LLMResponse,
  LLMStreamChunk,
  Message,
  ProviderConfig,
  ToolCall,
} from '../types';

/**
 * Configuration for OpenAI-compatible providers
 */
export interface OpenAICompatibleConfig {
  baseUrl: string;
  apiKey?: string;
  defaultHeaders?: Record<string, string>;
  timeout?: number;
  organization?: string;
}

/**
 * OpenAI-compatible provider implementation
 *
 * Works with any service that implements the OpenAI API format:
 * - LM Studio
 * - LocalAI
 * - Text Generation WebUI (oobabooga)
 * - Ollama (with OpenAI compatibility)
 * - vLLM
 * - TGI (Text Generation Inference)
 * - Any custom OpenAI-compatible endpoint
 *
 * @example
 * ```typescript
 * // LM Studio
 * const provider = new OpenAICompatibleProvider({
 *   baseUrl: 'http://localhost:1234/v1',
 * });
 *
 * // LocalAI
 * const provider = new OpenAICompatibleProvider({
 *   baseUrl: 'http://localhost:8080/v1',
 * });
 *
 * // Text Generation WebUI
 * const provider = new OpenAICompatibleProvider({
 *   baseUrl: 'http://localhost:5000/v1',
 *   apiKey: 'any-string', // Some servers require a dummy key
 * });
 * ```
 */
export class OpenAICompatibleProvider implements LLMProvider {
  private client: OpenAI;
  private config: OpenAICompatibleConfig;

  constructor(config: OpenAICompatibleConfig) {
    this.config = config;
    this.client = new OpenAI({
      baseURL: config.baseUrl,
      apiKey: config.apiKey || 'not-needed',
      defaultHeaders: config.defaultHeaders,
      timeout: config.timeout,
      organization: config.organization,
    });
  }

  /**
   * Generate a response from the OpenAI-compatible endpoint
   */
  async generateResponse(
    messages: Message[],
    config: ProviderConfig,
  ): Promise<LLMResponse> {
    // Convert messages to OpenAI format
    const openaiMessages = this.convertMessages(messages, config.systemPrompt);

    // Convert tools to OpenAI format
    const tools = config.tools
      ? config.tools.map((tool) => ({
          type: 'function' as const,
          function: {
            name: tool.name,
            description: tool.description,
            parameters: zodToJsonSchema(tool.parameters, tool.name),
          },
        }))
      : undefined;

    try {
      // Make API call
      const response = await this.client.chat.completions.create({
        model: config.model,
        messages: openaiMessages,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        tools,
        top_p: config.topP,
        stop: config.stopSequences,
      });

      const choice = response.choices[0];
      if (!choice) {
        throw new Error('No response from provider');
      }

      return {
        content: choice.message.content || '',
        stopReason: choice.finish_reason || 'stop',
        usage: {
          inputTokens: response.usage?.prompt_tokens || 0,
          outputTokens: response.usage?.completion_tokens || 0,
        },
        rawResponse: response,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(
          `OpenAI-compatible provider request failed: ${error.message}`,
        );
      }
      throw error;
    }
  }

  /**
   * Stream a response from the OpenAI-compatible endpoint
   */
  async *streamResponse(
    messages: Message[],
    config: ProviderConfig,
  ): AsyncIterable<LLMStreamChunk> {
    // Convert messages to OpenAI format
    const openaiMessages = this.convertMessages(messages, config.systemPrompt);

    // Convert tools to OpenAI format
    const tools = config.tools
      ? config.tools.map((tool) => ({
          type: 'function' as const,
          function: {
            name: tool.name,
            description: tool.description,
            parameters: zodToJsonSchema(tool.parameters, tool.name),
          },
        }))
      : undefined;

    try {
      // Make streaming API call
      const stream = await this.client.chat.completions.create({
        model: config.model,
        messages: openaiMessages,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        tools,
        top_p: config.topP,
        stop: config.stopSequences,
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        if (delta?.content) {
          yield {
            type: 'content',
            content: delta.content,
          };
        }

        if (delta?.tool_calls) {
          for (const toolCall of delta.tool_calls) {
            yield {
              type: 'tool_call',
              toolCall: {
                id: toolCall.id,
                tool: toolCall.function?.name,
                parameters: toolCall.function?.arguments,
              },
            };
          }
        }

        if (chunk.choices[0]?.finish_reason) {
          yield {
            type: 'done',
            done: true,
          };
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(
          `OpenAI-compatible provider streaming failed: ${error.message}`,
        );
      }
      throw error;
    }
  }

  /**
   * Parse tool calls from the LLM response
   */
  parseToolCalls(response: LLMResponse): ToolCall[] {
    const rawResponse =
      response.rawResponse as OpenAI.Chat.Completions.ChatCompletion;
    const toolCalls: ToolCall[] = [];

    const choice = rawResponse.choices[0];
    if (choice?.message.tool_calls) {
      for (const toolCall of choice.message.tool_calls) {
        toolCalls.push({
          id: toolCall.id,
          tool: toolCall.function.name,
          parameters: JSON.parse(toolCall.function.arguments),
        });
      }
    }

    return toolCalls;
  }

  /**
   * Convert generic messages to OpenAI format
   */
  private convertMessages(
    messages: Message[],
    systemPrompt?: string,
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const converted: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    // Add system message if provided
    if (systemPrompt) {
      converted.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    for (const message of messages) {
      if (message.role === 'system') {
        // Skip system messages as we handle them separately
        continue;
      }

      if (message.role === 'tool') {
        converted.push({
          role: 'tool',
          content: message.content,
          tool_call_id: message.toolCallId || '',
        });
        continue;
      }

      // Handle user and assistant messages
      converted.push({
        role: message.role,
        content: message.content,
      });
    }

    return converted;
  }

  /**
   * List available models (if the endpoint supports it)
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await this.client.models.list();
      return response.data.map((model) => model.id);
    } catch (error) {
      // Some endpoints don't support model listing
      console.warn('Model listing not supported by this endpoint');
      return [];
    }
  }

  /**
   * Get the base URL of this provider
   */
  getBaseUrl(): string {
    return this.config.baseUrl;
  }
}

/**
 * Pre-configured providers for common services
 */
export class LMStudioProvider extends OpenAICompatibleProvider {
  constructor(config?: Partial<OpenAICompatibleConfig>) {
    super({
      baseUrl: config?.baseUrl || 'http://localhost:1234/v1',
      ...config,
    });
  }
}

export class LocalAIProvider extends OpenAICompatibleProvider {
  constructor(config?: Partial<OpenAICompatibleConfig>) {
    super({
      baseUrl: config?.baseUrl || 'http://localhost:8080/v1',
      ...config,
    });
  }
}

export class TextGenerationWebUIProvider extends OpenAICompatibleProvider {
  constructor(config?: Partial<OpenAICompatibleConfig>) {
    super({
      baseUrl: config?.baseUrl || 'http://localhost:5000/v1',
      apiKey: config?.apiKey || 'dummy-key',
      ...config,
    });
  }
}

export class VLLMProvider extends OpenAICompatibleProvider {
  constructor(config?: Partial<OpenAICompatibleConfig>) {
    super({
      baseUrl: config?.baseUrl || 'http://localhost:8000/v1',
      ...config,
    });
  }
}
