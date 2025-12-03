import Anthropic from '@anthropic-ai/sdk';
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
 * Anthropic Claude provider implementation
 */
export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Generate a response from Claude
   */
  async generateResponse(
    messages: Message[],
    config: ProviderConfig,
  ): Promise<LLMResponse> {
    // Convert messages to Anthropic format
    const anthropicMessages = this.convertMessages(messages);

    // Convert tools to Anthropic format
    const tools = config.tools
      ? config.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          input_schema: zodToJsonSchema(tool.parameters, tool.name),
        }))
      : undefined;

    // Make API call
    const response = await this.client.messages.create({
      model: config.model,
      max_tokens: config.maxTokens || 1024,
      temperature: config.temperature,
      system: config.systemPrompt,
      messages: anthropicMessages,
      tools: tools as any,
      top_p: config.topP,
      stop_sequences: config.stopSequences,
    });

    // Extract text content
    const textContent = response.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('\n');

    return {
      content: textContent,
      stopReason: response.stop_reason || 'end_turn',
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      rawResponse: response,
    };
  }

  /**
   * Stream a response from Claude
   */
  async *streamResponse(
    messages: Message[],
    config: ProviderConfig,
  ): AsyncIterable<LLMStreamChunk> {
    // Convert messages to Anthropic format
    const anthropicMessages = this.convertMessages(messages);

    // Convert tools to Anthropic format
    const tools = config.tools
      ? config.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          input_schema: zodToJsonSchema(tool.parameters, tool.name),
        }))
      : undefined;

    // Make streaming API call
    // eslint-disable-next-line @typescript-eslint/await-thenable
    const stream = await this.client.messages.stream({
      model: config.model,
      max_tokens: config.maxTokens || 1024,
      temperature: config.temperature,
      system: config.systemPrompt,
      messages: anthropicMessages,
      tools: tools as any,
      top_p: config.topP,
      stop_sequences: config.stopSequences,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        const delta = event.delta;
        if (delta.type === 'text_delta') {
          yield {
            type: 'content',
            content: delta.text,
          };
        } else if (delta.type === 'input_json_delta') {
          yield {
            type: 'tool_call',
            toolCall: {
              parameters: delta.partial_json,
            },
          };
        }
      } else if (event.type === 'message_stop') {
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
    const rawResponse = response.rawResponse as Anthropic.Message;
    const toolCalls: ToolCall[] = [];

    for (const block of rawResponse.content) {
      if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          tool: block.name,
          parameters: block.input,
        });
      }
    }

    return toolCalls;
  }

  /**
   * Convert generic messages to Anthropic format
   */
  private convertMessages(messages: Message[]): Anthropic.MessageParam[] {
    const converted: Anthropic.MessageParam[] = [];

    for (const message of messages) {
      // Skip system messages (handled separately)
      if (message.role === 'system') {
        continue;
      }

      // Handle tool results
      if (message.role === 'tool') {
        // Find the last assistant message and add tool result to it
        const lastMessage = converted[converted.length - 1];
        if (lastMessage && lastMessage.role === 'assistant') {
          const content = lastMessage.content;
          if (Array.isArray(content)) {
            content.push({
              type: 'tool_result',
              tool_use_id: message.toolCallId || '',
              content: message.content,
            } as any);
          }
        }
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
