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
 * Models on which the API rejects sampling parameters
 * (temperature/top_p/top_k) entirely. Opus 4.7+ and the Fable/Mythos 5
 * family removed them; sending any returns a 400.
 */
const SAMPLING_REMOVED = /^claude-(opus-4-[789]|fable-5|mythos-5)/;

/**
 * Models supporting adaptive thinking and the effort parameter.
 */
const ADAPTIVE_THINKING = /^claude-(opus-4-[6789]|sonnet-4-6|fable-5|mythos-5)/;

interface AnthropicTuningParams {
  max_tokens: number;
  temperature?: number;
  top_p?: number;
  thinking?: { type: 'adaptive'; display?: 'summarized' | 'omitted' };
  output_config?: { effort: NonNullable<ProviderConfig['effort']> };
}

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
   * Build model-aware request parameters. Modern Claude models reject
   * removed sampling params, and Claude 4+ rejects temperature and
   * top_p together — temperature wins when both are configured.
   */
  private buildRequestParams(
    config: ProviderConfig,
    defaultMaxTokens: number,
  ): AnthropicTuningParams {
    const params: AnthropicTuningParams = {
      max_tokens: config.maxTokens || defaultMaxTokens,
    };

    if (!SAMPLING_REMOVED.test(config.model)) {
      if (config.temperature !== undefined) {
        params.temperature = config.temperature;
      } else if (config.topP !== undefined) {
        params.top_p = config.topP;
      }
    }

    if (config.thinking && ADAPTIVE_THINKING.test(config.model)) {
      params.thinking =
        config.thinking === true ? { type: 'adaptive' } : config.thinking;
    }

    if (config.effort && ADAPTIVE_THINKING.test(config.model)) {
      params.output_config = { effort: config.effort };
    }

    return params;
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
      system: config.systemPrompt,
      messages: anthropicMessages,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: tools as any,
      stop_sequences: config.stopSequences,
      ...this.buildRequestParams(config, 16000),
    });

    // Extract text content
    const textContent = response.content
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((block: any) => block.type === 'text')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      system: config.systemPrompt,
      messages: anthropicMessages,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: tools as any,
      stop_sequences: config.stopSequences,
      ...this.buildRequestParams(config, 64000),
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
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
