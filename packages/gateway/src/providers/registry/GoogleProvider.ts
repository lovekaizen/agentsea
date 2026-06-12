/**
 * Google Gemini Provider implementation
 * Converts between OpenAI-compatible format and Google Gemini format
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

const DEFAULT_GEMINI_MODELS = [
  'gemini-3.1-pro-preview',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
];

export interface GoogleProviderOptions extends ProviderOptions {
  projectId?: string;
  location?: string;
}

/**
 * Google Gemini Provider for the gateway
 */
export class GoogleProvider extends Provider {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(options: GoogleProviderOptions = {}) {
    const apiKey = options.apiKey || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('Google API key is required');
    }

    const config: ProviderConfig = {
      name: 'google',
      apiKey,
      baseUrl:
        options.baseUrl || 'https://generativelanguage.googleapis.com/v1beta',
      models: options.models || DEFAULT_GEMINI_MODELS,
      timeout: options.timeout || 60000,
      maxRetries: options.maxRetries || 3,
      headers: options.headers,
    };

    super(config);

    this.apiKey = apiKey;
    this.baseUrl = config.baseUrl!;
    this.timeout = config.timeout!;
  }

  /**
   * Execute a chat completion request
   */
  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const start = Date.now();

    try {
      const geminiRequest = this.transformToGemini(request);
      const endpoint = `/models/${request.model}:generateContent`;

      const response = await this.makeRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(geminiRequest),
      });

      if (!response.ok) {
        const error = await this.parseError(response);
        throw error;
      }

      const data = (await response.json()) as Record<string, unknown>;
      const result = this.transformFromGemini(data, request.model);

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
      const geminiRequest = this.transformToGemini(request);
      const endpoint = `/models/${request.model}:streamGenerateContent`;

      const response = await this.makeRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(geminiRequest),
      });

      if (!response.ok) {
        const error = await this.parseError(response);
        throw error;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new ProviderError('No response body', 'google');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      const requestId = generateRequestId();
      let totalInputTokens = 0;
      let totalOutputTokens = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Gemini streams as JSON array with line separators
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === '[' || trimmed === ']' || trimmed === ',')
            continue;

          // Handle JSON object potentially with leading/trailing comma
          let jsonStr = trimmed;
          if (jsonStr.startsWith(',')) jsonStr = jsonStr.slice(1);
          if (jsonStr.endsWith(',')) jsonStr = jsonStr.slice(0, -1);

          if (!jsonStr.startsWith('{')) continue;

          try {
            const data = JSON.parse(jsonStr);
            const chunk = this.transformStreamChunk(
              data,
              request.model,
              requestId,
            );

            // Track usage
            if (data.usageMetadata) {
              totalInputTokens = data.usageMetadata.promptTokenCount || 0;
              totalOutputTokens = data.usageMetadata.candidatesTokenCount || 0;
            }

            if (chunk) {
              yield chunk;
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }

      // Final chunk with usage
      yield {
        id: requestId,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: request.model,
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: totalInputTokens,
          completion_tokens: totalOutputTokens,
          total_tokens: totalInputTokens + totalOutputTokens,
        },
      };

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
    return getModelInfo(model, 'google');
  }

  /**
   * Make an HTTP request to the Google API
   */
  private async makeRequest(
    path: string,
    options: RequestInit,
  ): Promise<Response> {
    const url = `${this.baseUrl}${path}?key=${this.apiKey}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.headers,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      return await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Transform OpenAI-compatible request to Gemini format
   */
  private transformToGemini(
    request: ChatCompletionRequest,
  ): Record<string, unknown> {
    const contents = this.transformMessages(request.messages);

    const transformed: Record<string, unknown> = {
      contents,
    };

    // Generation config
    const generationConfig: Record<string, unknown> = {};

    if (request.temperature !== undefined) {
      generationConfig.temperature = request.temperature;
    }
    if (request.max_tokens !== undefined) {
      generationConfig.maxOutputTokens = request.max_tokens;
    }
    if (request.top_p !== undefined) {
      generationConfig.topP = request.top_p;
    }
    if (request.stop !== undefined) {
      generationConfig.stopSequences = Array.isArray(request.stop)
        ? request.stop
        : [request.stop];
    }

    if (Object.keys(generationConfig).length > 0) {
      transformed.generationConfig = generationConfig;
    }

    // System instruction
    const systemMessages = request.messages.filter((m) => m.role === 'system');
    if (systemMessages.length > 0) {
      const systemText = systemMessages
        .map((m) =>
          typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        )
        .join('\n');
      transformed.systemInstruction = { parts: [{ text: systemText }] };
    }

    // Tools
    if (request.tools && request.tools.length > 0) {
      transformed.tools = [
        {
          functionDeclarations: request.tools.map((tool) => ({
            name: tool.function.name,
            description: tool.function.description,
            parameters: tool.function.parameters || { type: 'object' },
          })),
        },
      ];
    }

    return transformed;
  }

  /**
   * Transform messages to Gemini format
   */
  private transformMessages(
    messages: ChatMessage[],
  ): Array<Record<string, unknown>> {
    const contents: Array<Record<string, unknown>> = [];

    for (const message of messages) {
      // Skip system messages (handled separately)
      if (message.role === 'system') continue;

      const role = message.role === 'assistant' ? 'model' : 'user';
      const parts: Array<Record<string, unknown>> = [];

      // Handle text content
      if (message.content) {
        parts.push({
          text:
            typeof message.content === 'string'
              ? message.content
              : JSON.stringify(message.content),
        });
      }

      // Handle tool calls from assistant
      if (message.tool_calls) {
        for (const toolCall of message.tool_calls) {
          parts.push({
            functionCall: {
              name: toolCall.function.name,
              args: JSON.parse(toolCall.function.arguments),
            },
          });
        }
      }

      // Handle tool results
      if (message.role === 'tool' && message.tool_call_id) {
        parts.push({
          functionResponse: {
            name: message.name || 'tool_result',
            response: {
              result:
                typeof message.content === 'string'
                  ? message.content
                  : JSON.stringify(message.content),
            },
          },
        });
      }

      if (parts.length > 0) {
        contents.push({ role, parts });
      }
    }

    return contents;
  }

  /**
   * Transform Gemini response to OpenAI-compatible format
   */
  private transformFromGemini(
    data: Record<string, unknown>,
    model: string,
  ): ChatCompletionResponse {
    const candidates = data.candidates as Array<Record<string, unknown>>;
    const candidate = candidates?.[0];

    if (!candidate) {
      throw new ProviderError('No response candidates', 'google');
    }

    const content = candidate.content as Record<string, unknown>;
    const parts = (content?.parts as Array<Record<string, unknown>>) || [];

    let textContent = '';
    const toolCalls: ChatCompletionResponse['choices'][0]['message']['tool_calls'] =
      [];

    for (const part of parts) {
      if (part.text) {
        textContent += part.text as string;
      }
      if (part.functionCall) {
        const fc = part.functionCall as Record<string, unknown>;
        toolCalls.push({
          id: `call_${Math.random().toString(36).substring(2, 11)}`,
          type: 'function',
          function: {
            name: fc.name as string,
            arguments: JSON.stringify(fc.args),
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

    // Map finish reason
    const finishReason = candidate.finishReason as string;
    let mappedReason: 'stop' | 'length' | 'tool_calls' | null = null;
    if (finishReason === 'STOP') {
      mappedReason = 'stop';
    } else if (finishReason === 'MAX_TOKENS') {
      mappedReason = 'length';
    } else if (toolCalls.length > 0) {
      mappedReason = 'tool_calls';
    }

    // Get usage
    const usageMetadata = data.usageMetadata as Record<string, number>;
    const usage = {
      prompt_tokens: usageMetadata?.promptTokenCount || 0,
      completion_tokens: usageMetadata?.candidatesTokenCount || 0,
      total_tokens: usageMetadata?.totalTokenCount || 0,
    };

    return {
      id: generateRequestId(),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message,
          finish_reason: mappedReason,
        },
      ],
      usage,
    };
  }

  /**
   * Transform Gemini stream chunk to OpenAI-compatible format
   */
  private transformStreamChunk(
    data: Record<string, unknown>,
    model: string,
    requestId: string,
  ): ChatCompletionChunk | null {
    const candidates = data.candidates as Array<Record<string, unknown>>;
    const candidate = candidates?.[0];

    if (!candidate) {
      return null;
    }

    const content = candidate.content as Record<string, unknown>;
    const parts = (content?.parts as Array<Record<string, unknown>>) || [];

    let textContent = '';
    for (const part of parts) {
      if (part.text) {
        textContent += part.text as string;
      }
    }

    if (!textContent) {
      return null;
    }

    return {
      id: requestId,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          delta: {
            content: textContent,
          },
          finish_reason: null,
        },
      ],
    };
  }

  /**
   * Parse error response from Google
   */
  private async parseError(response: Response): Promise<ProviderError> {
    let message = `Google API error: ${response.status}`;
    const retryable = response.status >= 500 || response.status === 429;

    try {
      const data = (await response.json()) as { error?: { message?: string } };
      if (data.error?.message) {
        message = data.error.message;
      }
    } catch {
      // Use default message
    }

    return new ProviderError(message, 'google', undefined, retryable);
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
      return new ProviderError(error.message, 'google', error, isTimeout);
    }

    return new ProviderError('Unknown error', 'google', undefined, true);
  }
}
