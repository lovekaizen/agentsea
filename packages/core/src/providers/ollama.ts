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
 * Configuration for Ollama provider
 */
export interface OllamaConfig {
  baseUrl?: string;
  timeout?: number;
}

/**
 * Ollama provider implementation for local LLM execution
 *
 * Supports running open source models locally via Ollama
 * @see https://ollama.ai
 */
export class OllamaProvider implements LLMProvider {
  private baseUrl: string;
  private timeout: number;

  constructor(config?: OllamaConfig) {
    this.baseUrl =
      config?.baseUrl ||
      process.env.OLLAMA_BASE_URL ||
      'http://localhost:11434';
    this.timeout = config?.timeout || 60000; // 60 seconds default
  }

  /**
   * Generate a response from Ollama
   */
  async generateResponse(
    messages: Message[],
    config: ProviderConfig,
  ): Promise<LLMResponse> {
    // Convert messages to Ollama format
    const ollamaMessages = this.convertMessages(messages, config.systemPrompt);

    // Build request payload
    const payload: any = {
      model: config.model,
      messages: ollamaMessages,
      stream: false,
      options: {
        temperature: config.temperature,
        num_predict: config.maxTokens,
        top_p: config.topP,
        stop: config.stopSequences,
      },
    };

    // Add tools if provided (Ollama supports tools in newer versions)
    if (config.tools && config.tools.length > 0) {
      payload.tools = config.tools.map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: zodToJsonSchema(tool.parameters, tool.name),
        },
      }));
    }

    try {
      const response = await this.makeRequest('/api/chat', payload);

      return {
        content: response.message.content || '',
        stopReason: response.done ? 'stop' : 'length',
        usage: {
          inputTokens: response.prompt_eval_count || 0,
          outputTokens: response.eval_count || 0,
        },
        rawResponse: response,
      };
    } catch (error) {
      throw new Error(
        `Ollama request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Stream a response from Ollama
   */
  async *streamResponse(
    messages: Message[],
    config: ProviderConfig,
  ): AsyncIterable<LLMStreamChunk> {
    // Convert messages to Ollama format
    const ollamaMessages = this.convertMessages(messages, config.systemPrompt);

    // Build request payload
    const payload: any = {
      model: config.model,
      messages: ollamaMessages,
      stream: true,
      options: {
        temperature: config.temperature,
        num_predict: config.maxTokens,
        top_p: config.topP,
        stop: config.stopSequences,
      },
    };

    // Add tools if provided
    if (config.tools && config.tools.length > 0) {
      payload.tools = config.tools.map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: zodToJsonSchema(tool.parameters, tool.name),
        },
      }));
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Ollama request failed: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
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
          if (!line.trim()) continue;

          try {
            const data = JSON.parse(line);

            if (data.message?.content) {
              yield {
                type: 'content',
                content: data.message.content,
              };
            }

            // Handle tool calls if present
            if (data.message?.tool_calls) {
              for (const toolCall of data.message.tool_calls) {
                yield {
                  type: 'tool_call',
                  toolCall: {
                    id: toolCall.id || Math.random().toString(36),
                    tool: toolCall.function?.name,
                    parameters: toolCall.function?.arguments,
                  },
                };
              }
            }

            if (data.done) {
              yield {
                type: 'done',
                done: true,
              };
            }
          } catch (e) {
            // Skip invalid JSON lines
            continue;
          }
        }
      }
    } catch (error) {
      throw new Error(
        `Ollama streaming failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Parse tool calls from the LLM response
   */
  parseToolCalls(response: LLMResponse): ToolCall[] {
    const rawResponse = response.rawResponse;
    const toolCalls: ToolCall[] = [];

    // Check if the response has tool calls
    if (rawResponse.message?.tool_calls) {
      for (const toolCall of rawResponse.message.tool_calls) {
        toolCalls.push({
          id: toolCall.id || Math.random().toString(36),
          tool: toolCall.function?.name || '',
          parameters:
            typeof toolCall.function?.arguments === 'string'
              ? JSON.parse(toolCall.function.arguments)
              : toolCall.function?.arguments,
        });
      }
    }

    return toolCalls;
  }

  /**
   * Convert generic messages to Ollama format
   */
  private convertMessages(messages: Message[], systemPrompt?: string): any[] {
    const converted: any[] = [];

    // Add system message if provided
    if (systemPrompt) {
      converted.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    for (const message of messages) {
      if (message.role === 'system' && !systemPrompt) {
        converted.push({
          role: 'system',
          content: message.content,
        });
        continue;
      }

      if (message.role === 'tool') {
        converted.push({
          role: 'tool',
          content: message.content,
          tool_call_id: message.toolCallId,
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
   * Make a request to Ollama API
   */
  private async makeRequest(endpoint: string, payload: any): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * List available models from Ollama
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.statusText}`);
      }

      const data = (await response.json()) as {
        models?: Array<{ name: string }>;
      };
      return data.models?.map((m) => m.name) || [];
    } catch (error) {
      throw new Error(
        `Failed to list Ollama models: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Pull a model from Ollama
   */
  async pullModel(modelName: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: modelName }),
      });

      if (!response.ok) {
        throw new Error(`Failed to pull model: ${response.statusText}`);
      }

      // Wait for the pull to complete
      const reader = response.body?.getReader();
      if (!reader) return;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    } catch (error) {
      throw new Error(
        `Failed to pull Ollama model: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
