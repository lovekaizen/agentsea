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
 * OpenAI provider implementation
 */
export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Generate a response from OpenAI
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
      throw new Error('No response from OpenAI');
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
  }

  /**
   * Stream a response from OpenAI
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
}
