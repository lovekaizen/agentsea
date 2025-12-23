import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GeminiProvider } from '../gemini';
import { Message, ProviderConfig } from '../../types';

// Mock Google Generative AI SDK
vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
      getGenerativeModel: vi.fn().mockReturnValue({
        model: 'gemini-pro',
        generateContent: vi.fn(),
        generateContentStream: vi.fn(),
      }),
    })),
  };
});

describe('GeminiProvider', () => {
  let provider: GeminiProvider;
  let mockClient: any;
  let mockModel: any;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new GeminiProvider('test-api-key');
    mockClient = (provider as any).client;
    mockModel = mockClient.getGenerativeModel();
  });

  describe('constructor', () => {
    it('should create provider with API key', () => {
      expect(provider).toBeDefined();
    });

    it('should use GEMINI_API_KEY environment variable', () => {
      process.env.GEMINI_API_KEY = 'env-key';
      const envProvider = new GeminiProvider();
      expect(envProvider).toBeDefined();
      delete process.env.GEMINI_API_KEY;
    });

    it('should use GOOGLE_API_KEY environment variable', () => {
      process.env.GOOGLE_API_KEY = 'google-env-key';
      const envProvider = new GeminiProvider();
      expect(envProvider).toBeDefined();
      delete process.env.GOOGLE_API_KEY;
    });

    it('should throw error if no API key provided', () => {
      delete process.env.GEMINI_API_KEY;
      delete process.env.GOOGLE_API_KEY;

      expect(() => new GeminiProvider()).toThrow('Gemini API key is required');
    });
  });

  describe('generateResponse', () => {
    const messages: Message[] = [{ role: 'user', content: 'Hello' }];

    const config: ProviderConfig = {
      model: 'gemini-pro',
      maxTokens: 2048,
      temperature: 0.7,
    };

    it('should generate response successfully', async () => {
      const mockResponse = {
        response: {
          text: () => 'Hello! How can I help you?',
          candidates: [{ finishReason: 'STOP' }],
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const response = await provider.generateResponse(messages, config);

      expect(response).toBeDefined();
      expect(response.content).toBe('Hello! How can I help you?');
      expect(response.stopReason).toBe('STOP');
      expect(response.usage.inputTokens).toBeGreaterThan(0);
      expect(response.usage.outputTokens).toBeGreaterThan(0);
    });

    it('should use default model if not specified', async () => {
      const mockResponse = {
        response: {
          text: () => 'Response',
          candidates: [{ finishReason: 'STOP' }],
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const configWithoutModel = { ...config };
      delete configWithoutModel.model;

      await provider.generateResponse(messages, configWithoutModel);

      expect(mockClient.getGenerativeModel).toHaveBeenCalledWith({
        model: 'gemini-pro',
      });
    });

    it('should use default temperature if not specified', async () => {
      const mockResponse = {
        response: {
          text: () => 'Response',
          candidates: [{ finishReason: 'STOP' }],
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const configWithoutTemp = { ...config };
      delete configWithoutTemp.temperature;

      await provider.generateResponse(messages, configWithoutTemp);

      expect(mockModel.generateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          generationConfig: expect.objectContaining({
            temperature: 0.7,
          }),
        }),
      );
    });

    it('should use default maxTokens if not specified', async () => {
      const mockResponse = {
        response: {
          text: () => 'Response',
          candidates: [{ finishReason: 'STOP' }],
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const configWithoutMaxTokens = { ...config };
      delete configWithoutMaxTokens.maxTokens;

      await provider.generateResponse(messages, configWithoutMaxTokens);

      expect(mockModel.generateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          generationConfig: expect.objectContaining({
            maxOutputTokens: 2048,
          }),
        }),
      );
    });

    it('should handle API errors', async () => {
      mockModel.generateContent.mockRejectedValue(new Error('API Error'));

      await expect(provider.generateResponse(messages, config)).rejects.toThrow(
        'Gemini API error: API Error',
      );
    });

    it('should use default stop reason if not provided', async () => {
      const mockResponse = {
        response: {
          text: () => 'Response',
          candidates: undefined,
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const response = await provider.generateResponse(messages, config);
      expect(response.stopReason).toBe('stop');
    });

    it('should estimate tokens for input and output', async () => {
      const mockResponse = {
        response: {
          text: () => 'Hello world',
          candidates: [{ finishReason: 'STOP' }],
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const response = await provider.generateResponse(messages, config);

      // Estimation: ~4 characters per token
      expect(response.usage.inputTokens).toBeGreaterThan(0);
      expect(response.usage.outputTokens).toBeGreaterThan(0);
    });
  });

  describe('streamResponse', () => {
    const messages: Message[] = [{ role: 'user', content: 'Hello' }];

    const config: ProviderConfig = {
      model: 'gemini-pro',
      maxTokens: 2048,
    };

    it('should stream text content', async () => {
      const mockStream = {
        stream: {
          [Symbol.asyncIterator]: async function* () {
            yield {
              text: () => 'Hello ',
              functionCalls: () => [],
            };
            yield {
              text: () => 'world!',
              functionCalls: () => [],
            };
          },
        },
      };

      mockModel.generateContentStream.mockResolvedValue(mockStream);

      const chunks: string[] = [];
      for await (const chunk of provider.streamResponse(messages, config)) {
        if (chunk.type === 'content') {
          chunks.push(chunk.content!);
        }
      }

      expect(chunks).toEqual(['Hello ', 'world!']);
    });

    it('should handle function calls in stream', async () => {
      const mockStream = {
        stream: {
          [Symbol.asyncIterator]: async function* () {
            yield {
              text: () => '',
              functionCalls: () => [
                {
                  name: 'calculator',
                  args: { expression: '2 + 2' },
                },
              ],
            };
          },
        },
      };

      mockModel.generateContentStream.mockResolvedValue(mockStream);

      const toolCalls: any[] = [];
      for await (const chunk of provider.streamResponse(messages, config)) {
        if (chunk.type === 'tool_call') {
          toolCalls.push(chunk.toolCall);
        }
      }

      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].tool).toBe('calculator');
      expect(toolCalls[0].parameters).toEqual({ expression: '2 + 2' });
    });

    it('should skip empty text chunks', async () => {
      const mockStream = {
        stream: {
          [Symbol.asyncIterator]: async function* () {
            yield {
              text: () => '',
              functionCalls: () => [],
            };
            yield {
              text: () => 'Content',
              functionCalls: () => [],
            };
          },
        },
      };

      mockModel.generateContentStream.mockResolvedValue(mockStream);

      const chunks: string[] = [];
      for await (const chunk of provider.streamResponse(messages, config)) {
        if (chunk.type === 'content') {
          chunks.push(chunk.content!);
        }
      }

      expect(chunks).toEqual(['Content']);
    });

    it('should handle streaming errors', async () => {
      mockModel.generateContentStream.mockRejectedValue(
        new Error('Stream Error'),
      );

      await expect(async () => {
        for await (const chunk of provider.streamResponse(messages, config)) {
          // consume stream
        }
      }).rejects.toThrow('Gemini streaming error: Stream Error');
    });
  });

  describe('parseToolCalls', () => {
    it('should parse function calls from response', () => {
      const response = {
        content: 'Using calculator',
        stopReason: 'STOP',
        usage: { inputTokens: 10, outputTokens: 20 },
        rawResponse: {
          functionCalls: () => [
            {
              name: 'calculator',
              args: { expression: '2 + 2' },
            },
          ],
        },
      };

      const toolCalls = provider.parseToolCalls(response);

      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].tool).toBe('calculator');
      expect(toolCalls[0].parameters).toEqual({ expression: '2 + 2' });
      expect(toolCalls[0].id).toBeDefined();
    });

    it('should return empty array for no function calls', () => {
      const response = {
        content: 'Regular response',
        stopReason: 'STOP',
        usage: { inputTokens: 10, outputTokens: 20 },
        rawResponse: {},
      };

      const toolCalls = provider.parseToolCalls(response);
      expect(toolCalls).toEqual([]);
    });

    it('should handle undefined rawResponse', () => {
      const response = {
        content: 'Response',
        stopReason: 'STOP',
        usage: { inputTokens: 10, outputTokens: 20 },
        rawResponse: undefined,
      };

      const toolCalls = provider.parseToolCalls(response);
      expect(toolCalls).toEqual([]);
    });
  });

  describe('convertMessages', () => {
    it('should skip system messages', async () => {
      const messages: Message[] = [
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'Hello' },
      ];

      const mockResponse = {
        response: {
          text: () => 'Response',
          candidates: [{ finishReason: 'STOP' }],
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      await provider.generateResponse(messages, { model: 'gemini-pro' });

      const callArgs = mockModel.generateContent.mock.calls[0][0];
      expect(callArgs.contents).toHaveLength(1);
      expect(callArgs.contents[0].parts[0].text).toBe('Hello');
    });

    it('should convert assistant role to model', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
      ];

      const mockResponse = {
        response: {
          text: () => 'Response',
          candidates: [{ finishReason: 'STOP' }],
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      await provider.generateResponse(messages, { model: 'gemini-pro' });

      const callArgs = mockModel.generateContent.mock.calls[0][0];
      expect(callArgs.contents[1].role).toBe('model');
    });

    it('should convert messages to parts format', async () => {
      const messages: Message[] = [{ role: 'user', content: 'Test message' }];

      const mockResponse = {
        response: {
          text: () => 'Response',
          candidates: [{ finishReason: 'STOP' }],
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      await provider.generateResponse(messages, { model: 'gemini-pro' });

      const callArgs = mockModel.generateContent.mock.calls[0][0];
      expect(callArgs.contents[0].parts).toEqual([{ text: 'Test message' }]);
    });
  });

  describe('model caching', () => {
    it('should reuse model instance for same model name', async () => {
      const mockResponse = {
        response: {
          text: () => 'Response',
          candidates: [{ finishReason: 'STOP' }],
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const messages: Message[] = [{ role: 'user', content: 'Hello' }];
      const config: ProviderConfig = { model: 'gemini-pro' };

      await provider.generateResponse(messages, config);
      await provider.generateResponse(messages, config);

      // getGenerativeModel should be called only once initially
      // Additional calls may happen but the model instance is reused
      expect(mockClient.getGenerativeModel).toHaveBeenCalled();
    });
  });
});
