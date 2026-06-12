/**
 * Google Provider Adapter
 *
 * Adapter for Google's Gemini API for structured output extraction.
 */

import type {
  ProviderAdapter,
  ProviderCapabilities,
  ProviderRequest,
  ProviderResponse,
  ProviderStreamChunk,
  ProviderToolCall,
  GoogleOptions,
} from '../types/provider.types.js';
import type { ChatMessage } from '../types/core.types.js';
import type { JsonSchema, ToolDefinition } from '../types/schema.types.js';

/**
 * Google Generative AI client interface
 */
interface GoogleClient {
  getGenerativeModel(params: {
    model: string;
    generationConfig?: unknown;
    tools?: unknown[];
    toolConfig?: unknown;
  }): GoogleGenerativeModel;
}

/**
 * Google Generative Model interface
 */
interface GoogleGenerativeModel {
  generateContent(request: unknown): Promise<GoogleGenerateContentResult>;
  generateContentStream(
    request: unknown,
  ): Promise<GoogleGenerateContentStreamResult>;
}

/**
 * Google generate content result
 */
interface GoogleGenerateContentResult {
  response: GoogleGenerateContentResponse;
}

/**
 * Google generate content response
 */
interface GoogleGenerateContentResponse {
  text(): string;
  candidates?: Array<{
    content: {
      parts: Array<{
        text?: string;
        functionCall?: {
          name: string;
          args: Record<string, unknown>;
        };
      }>;
      role: string;
    };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
  functionCalls?(): Array<{
    name: string;
    args: Record<string, unknown>;
  }>;
}

/**
 * Google streaming result
 */
interface GoogleGenerateContentStreamResult {
  stream: AsyncIterable<{
    text(): string;
    candidates?: Array<{
      content: {
        parts: Array<{
          text?: string;
          functionCall?: {
            name: string;
            args: Record<string, unknown>;
          };
        }>;
      };
      finishReason?: string;
    }>;
    usageMetadata?: {
      promptTokenCount: number;
      candidatesTokenCount: number;
      totalTokenCount: number;
    };
  }>;
  response: Promise<GoogleGenerateContentResponse>;
}

/**
 * Model capabilities for Google models
 */
const MODEL_CAPABILITIES: Record<string, Partial<ProviderCapabilities>> = {
  'gemini-3.1-pro-preview': {
    jsonMode: true,
    strictJsonMode: true,
    toolCalling: true,
    streaming: true,
    systemMessages: true,
    maxContextWindow: 1048576,
    maxOutputTokens: 65536,
  },
  'gemini-3.5-flash': {
    jsonMode: true,
    strictJsonMode: true,
    toolCalling: true,
    streaming: true,
    systemMessages: true,
    maxContextWindow: 1048576,
    maxOutputTokens: 65536,
  },
  'gemini-3.1-flash-lite': {
    jsonMode: true,
    strictJsonMode: true,
    toolCalling: true,
    streaming: true,
    systemMessages: true,
    maxContextWindow: 1048576,
    maxOutputTokens: 65536,
  },
};

/**
 * Google provider adapter
 */
export class GoogleAdapter implements ProviderAdapter {
  readonly name = 'google';
  private readonly client: GoogleClient;
  private readonly options: GoogleOptions;

  constructor(client: GoogleClient, options: GoogleOptions = {}) {
    this.client = client;
    this.options = options;
  }

  /**
   * Get capabilities for a model
   */
  getCapabilities(model: string): ProviderCapabilities {
    // Find matching model
    const modelKey = Object.keys(MODEL_CAPABILITIES).find(
      (key) => model.includes(key) || key.includes(model),
    );
    const base = modelKey
      ? MODEL_CAPABILITIES[modelKey]
      : MODEL_CAPABILITIES['gemini-3.5-flash'];

    return {
      jsonMode: base.jsonMode ?? true,
      strictJsonMode: base.strictJsonMode ?? true,
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
    const model = this.getModel(request);
    const contents = this.formatContents(request.messages);

    const result = await model.generateContent({ contents });

    return this.parseResponse(result.response);
  }

  /**
   * Create a streaming completion request
   */
  async *createStreamingCompletion(
    request: ProviderRequest,
  ): AsyncIterableIterator<ProviderStreamChunk> {
    const model = this.getModel(request);
    const contents = this.formatContents(request.messages);

    const streamResult = await model.generateContentStream({ contents });

    for await (const chunk of streamResult.stream) {
      const text = chunk.text();
      const candidate = chunk.candidates?.[0];
      const isFinal = candidate?.finishReason !== undefined;

      yield {
        content: text,
        isFinal,
        finishReason: candidate?.finishReason,
        usage: chunk.usageMetadata
          ? {
              promptTokens: chunk.usageMetadata.promptTokenCount,
              completionTokens: chunk.usageMetadata.candidatesTokenCount,
              totalTokens: chunk.usageMetadata.totalTokenCount,
            }
          : undefined,
      };
    }
  }

  /**
   * Format messages for Google
   */
  formatMessages(messages: ChatMessage[]): unknown {
    return this.formatContents(messages);
  }

  /**
   * Format JSON schema for Google
   */
  formatJsonSchema(schema: JsonSchema): unknown {
    return {
      responseMimeType: 'application/json',
      responseSchema: this.convertToGoogleSchema(schema),
    };
  }

  /**
   * Format tool definition for Google
   */
  formatToolDefinition(tool: ToolDefinition): unknown {
    return {
      functionDeclarations: [
        {
          name: tool.function.name,
          description: tool.function.description,
          parameters: this.convertToGoogleSchema(tool.function.parameters),
        },
      ],
    };
  }

  /**
   * Get the generative model with configuration
   */
  private getModel(request: ProviderRequest): GoogleGenerativeModel {
    const generationConfig: Record<string, unknown> = {};

    if (request.temperature !== undefined) {
      generationConfig.temperature = request.temperature;
    }

    if (request.maxTokens !== undefined) {
      generationConfig.maxOutputTokens = request.maxTokens;
    }

    // Apply mode-specific settings
    let tools: unknown[] | undefined;
    let toolConfig: unknown;

    switch (request.mode) {
      case 'json':
        if (request.jsonSchema) {
          generationConfig.responseMimeType = 'application/json';
          generationConfig.responseSchema = this.convertToGoogleSchema(
            request.jsonSchema,
          );
        }
        break;

      case 'tool':
        if (request.toolDefinition) {
          tools = [
            {
              functionDeclarations: [
                {
                  name: request.toolDefinition.function.name,
                  description: request.toolDefinition.function.description,
                  parameters: this.convertToGoogleSchema(
                    request.toolDefinition.function.parameters,
                  ),
                },
              ],
            },
          ];
          toolConfig = {
            functionCallingConfig: {
              mode: 'ANY',
              allowedFunctionNames: [request.toolDefinition.function.name],
            },
          };
        }
        break;
    }

    // Merge with custom generation config
    if (this.options.generationConfig) {
      Object.assign(generationConfig, this.options.generationConfig);
    }

    return this.client.getGenerativeModel({
      model: request.model,
      generationConfig,
      tools,
      toolConfig,
    });
  }

  /**
   * Format contents for Google API
   */
  private formatContents(messages: ChatMessage[]): unknown[] {
    const contents: Array<{
      role: string;
      parts: Array<{ text: string }>;
    }> = [];

    // Handle system message specially (prepend to first user message or use systemInstruction)
    const systemMessage = messages.find((m) => m.role === 'system');
    const otherMessages = messages.filter((m) => m.role !== 'system');

    if (systemMessage) {
      // Prepend system content to first message if user, otherwise add as separate
      if (otherMessages.length > 0 && otherMessages[0].role === 'user') {
        otherMessages[0] = {
          ...otherMessages[0],
          content: `${systemMessage.content}\n\n${otherMessages[0].content}`,
        };
      } else {
        // Add system as user message
        contents.push({
          role: 'user',
          parts: [{ text: systemMessage.content }],
        });
      }
    }

    for (const msg of otherMessages) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }

    return contents;
  }

  /**
   * Convert JSON Schema to Google's schema format
   */
  private convertToGoogleSchema(schema: JsonSchema): unknown {
    // Google uses a similar but slightly different schema format
    const converted: Record<string, unknown> = {};

    if (schema.type) {
      converted.type = Array.isArray(schema.type)
        ? schema.type[0].toUpperCase()
        : schema.type.toUpperCase();
    }

    if (schema.description) {
      converted.description = schema.description;
    }

    if (schema.enum) {
      converted.enum = schema.enum;
    }

    if (schema.properties) {
      converted.properties = Object.fromEntries(
        Object.entries(schema.properties).map(([key, prop]) => [
          key,
          this.convertToGoogleSchema(prop),
        ]),
      );
    }

    if (schema.required) {
      converted.required = schema.required;
    }

    if (schema.items) {
      converted.items = this.convertToGoogleSchema(schema.items as JsonSchema);
    }

    if (schema.minimum !== undefined) {
      converted.minimum = schema.minimum;
    }

    if (schema.maximum !== undefined) {
      converted.maximum = schema.maximum;
    }

    if (schema.minLength !== undefined) {
      converted.minLength = schema.minLength;
    }

    if (schema.maxLength !== undefined) {
      converted.maxLength = schema.maxLength;
    }

    if (schema.pattern !== undefined) {
      converted.pattern = schema.pattern;
    }

    return converted;
  }

  /**
   * Parse response
   */
  private parseResponse(
    response: GoogleGenerateContentResponse,
  ): ProviderResponse {
    let content = '';
    let toolCalls: ProviderToolCall[] | undefined;

    try {
      content = response.text();
    } catch {
      // May throw if response only contains function calls
    }

    // Check for function calls
    const functionCalls = response.functionCalls?.();
    if (functionCalls && functionCalls.length > 0) {
      toolCalls = functionCalls.map((fc, index) => ({
        id: `call_${index}`,
        name: fc.name,
        arguments: JSON.stringify(fc.args),
      }));
    }

    // Also check candidates for function calls
    if (!toolCalls && response.candidates) {
      for (const candidate of response.candidates) {
        for (const part of candidate.content.parts) {
          if (part.functionCall) {
            if (!toolCalls) {
              toolCalls = [];
            }
            toolCalls.push({
              id: `call_${toolCalls.length}`,
              name: part.functionCall.name,
              arguments: JSON.stringify(part.functionCall.args),
            });
          }
        }
      }
    }

    return {
      content,
      usage: response.usageMetadata
        ? {
            promptTokens: response.usageMetadata.promptTokenCount,
            completionTokens: response.usageMetadata.candidatesTokenCount,
            totalTokens: response.usageMetadata.totalTokenCount,
          }
        : undefined,
      finishReason: response.candidates?.[0]?.finishReason,
      toolCalls,
      raw: response,
    };
  }
}

/**
 * Create a Google adapter
 */
export function createGoogleAdapter(
  client: GoogleClient,
  options?: GoogleOptions,
): GoogleAdapter {
  return new GoogleAdapter(client, options);
}
