import {
  GoogleGenerativeAI,
  GenerativeModel,
  Content,
} from '@google/generative-ai';

import {
  LLMProvider,
  Message,
  LLMResponse,
  LLMStreamChunk,
  ProviderConfig,
  ToolCall,
} from '../types';

/**
 * Google Gemini provider implementation
 * Supports Gemini Pro, Gemini Pro Vision, and other Gemini models
 */
export class GeminiProvider implements LLMProvider {
  private client: GoogleGenerativeAI;
  private model: GenerativeModel | null = null;

  constructor(apiKey?: string) {
    const key =
      apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (!key) {
      throw new Error(
        'Gemini API key is required. Set GEMINI_API_KEY or GOOGLE_API_KEY environment variable',
      );
    }

    this.client = new GoogleGenerativeAI(key);
  }

  /**
   * Generate a response from the Gemini model
   */
  async generateResponse(
    messages: Message[],
    config: ProviderConfig,
  ): Promise<LLMResponse> {
    const model = this.getModel(config.model || 'gemini-pro');

    // Convert messages to Gemini format
    const contents = this.convertMessages(messages);

    const generationConfig = {
      temperature: config.temperature || 0.7,
      maxOutputTokens: config.maxTokens || 2048,
      topP: config.topP,
      // topK is Gemini-specific, not in ProviderConfig
    };

    try {
      const result = await model.generateContent({
        contents,
        generationConfig,
      });

      const response = result.response;
      const text = response.text();

      return {
        content: text,
        stopReason: response.candidates?.[0]?.finishReason || 'stop',
        usage: {
          inputTokens: this.estimateTokens(
            messages.map((m) => m.content).join(' '),
          ),
          outputTokens: this.estimateTokens(text),
        },
        rawResponse: response,
      };
    } catch (error) {
      throw new Error(`Gemini API error: ${(error as Error).message}`);
    }
  }

  /**
   * Stream responses from Gemini
   */
  async *streamResponse(
    messages: Message[],
    config: ProviderConfig,
  ): AsyncIterable<LLMStreamChunk> {
    const model = this.getModel(config.model || 'gemini-pro');

    const contents = this.convertMessages(messages);

    const generationConfig = {
      temperature: config.temperature || 0.7,
      maxOutputTokens: config.maxTokens || 2048,
      topP: config.topP,
      // topK is Gemini-specific, not in ProviderConfig
    };

    try {
      const result = await model.generateContentStream({
        contents,
        generationConfig,
      });

      for await (const chunk of result.stream) {
        const text = chunk.text();

        if (text) {
          yield {
            type: 'content',
            content: text,
          };
        }

        // Check for function calls
        const functionCalls = chunk.functionCalls();
        if (functionCalls && functionCalls.length > 0) {
          for (const call of functionCalls) {
            yield {
              type: 'tool_call',
              toolCall: {
                id: `call-${Date.now()}-${Math.random()}`,
                tool: call.name,
                parameters: call.args,
              },
            };
          }
        }
      }
    } catch (error) {
      throw new Error(`Gemini streaming error: ${(error as Error).message}`);
    }
  }

  /**
   * Parse tool calls from Gemini response
   */
  parseToolCalls(response: LLMResponse): ToolCall[] {
    const toolCalls: ToolCall[] = [];

    // Gemini tool calls would be in rawResponse
    if (response.rawResponse?.functionCalls) {
      for (const call of response.rawResponse.functionCalls()) {
        toolCalls.push({
          id: `call-${Date.now()}-${Math.random()}`,
          tool: call.name,
          parameters: call.args,
        });
      }
    }

    return toolCalls;
  }

  /**
   * Get or create Gemini model instance
   */
  private getModel(modelName: string): GenerativeModel {
    if (!this.model || this.model.model !== modelName) {
      this.model = this.client.getGenerativeModel({ model: modelName });
    }
    return this.model;
  }

  /**
   * Convert messages to Gemini format
   */
  private convertMessages(messages: Message[]): Content[] {
    const contents: Content[] = [];

    for (const message of messages) {
      // Skip system messages - Gemini handles them differently
      if (message.role === 'system') {
        continue;
      }

      contents.push({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      });
    }

    return contents;
  }

  /**
   * Estimate token count (rough approximation)
   * Gemini doesn't provide token counts, so we estimate
   */
  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}
