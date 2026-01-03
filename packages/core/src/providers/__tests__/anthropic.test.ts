import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import { AnthropicProvider } from '../anthropic';
import { Message, ProviderConfig } from '../../types';

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn(),
        stream: vi.fn(),
      },
    })),
  };
});

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new AnthropicProvider('test-api-key');
    mockClient = (provider as any).client;
  });

  describe('constructor', () => {
    it('should create provider with API key', () => {
      expect(provider).toBeDefined();
    });

    it('should use environment variable if no API key provided', () => {
      process.env.ANTHROPIC_API_KEY = 'env-key';
      const envProvider = new AnthropicProvider();
      expect(envProvider).toBeDefined();
      delete process.env.ANTHROPIC_API_KEY;
    });
  });

  describe('generateResponse', () => {
    const messages: Message[] = [{ role: 'user', content: 'Hello' }];

    const config: ProviderConfig = {
      model: 'claude-3-5-sonnet-20241022',
      maxTokens: 1024,
      temperature: 0.7,
    };

    it('should generate response successfully', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: 'Hello! How can I help?' }],
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 10,
          output_tokens: 20,
        },
      };

      mockClient.messages.create.mockResolvedValue(mockResponse);

      const response = await provider.generateResponse(messages, config);

      expect(response).toBeDefined();
      expect(response.content).toBe('Hello! How can I help?');
      expect(response.stopReason).toBe('end_turn');
      expect(response.usage.inputTokens).toBe(10);
      expect(response.usage.outputTokens).toBe(20);
      expect(mockClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: config.model,
          max_tokens: 1024,
          temperature: 0.7,
        }),
      );
    });

    it('should handle multiple text blocks', async () => {
      const mockResponse = {
        content: [
          { type: 'text', text: 'First part' },
          { type: 'text', text: 'Second part' },
        ],
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 20 },
      };

      mockClient.messages.create.mockResolvedValue(mockResponse);

      const response = await provider.generateResponse(messages, config);

      expect(response.content).toBe('First part\nSecond part');
    });

    it('should include system prompt', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: 'Response' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 20 },
      };

      mockClient.messages.create.mockResolvedValue(mockResponse);

      const configWithSystem = {
        ...config,
        systemPrompt: 'You are a helpful assistant',
      };

      await provider.generateResponse(messages, configWithSystem);

      expect(mockClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'You are a helpful assistant',
        }),
      );
    });

    it('should convert tools to Anthropic format', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: 'Response' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 20 },
      };

      mockClient.messages.create.mockResolvedValue(mockResponse);

      const configWithTools = {
        ...config,
        tools: [
          {
            name: 'calculator',
            description: 'Perform calculations',
            parameters: z.object({ expression: z.string() }),
          },
        ],
      };

      await provider.generateResponse(messages, configWithTools);

      expect(mockClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: expect.arrayContaining([
            expect.objectContaining({
              name: 'calculator',
              description: 'Perform calculations',
            }),
          ]),
        }),
      );
    });

    it('should use default maxTokens if not provided', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: 'Response' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 20 },
      };

      mockClient.messages.create.mockResolvedValue(mockResponse);

      const configWithoutMaxTokens = { ...config };
      delete configWithoutMaxTokens.maxTokens;

      await provider.generateResponse(messages, configWithoutMaxTokens);

      expect(mockClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 1024,
        }),
      );
    });

    it('should handle API errors', async () => {
      mockClient.messages.create.mockRejectedValue(new Error('API Error'));

      await expect(provider.generateResponse(messages, config)).rejects.toThrow(
        'API Error',
      );
    });
  });

  describe('streamResponse', () => {
    const messages: Message[] = [{ role: 'user', content: 'Hello' }];

    const config: ProviderConfig = {
      model: 'claude-3-5-sonnet-20241022',
      maxTokens: 1024,
    };

    it('should stream text content', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'Hello ' },
          };
          yield {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'world!' },
          };
          yield { type: 'message_stop' };
        },
      };

      mockClient.messages.stream.mockResolvedValue(mockStream);

      const chunks: string[] = [];
      for await (const chunk of provider.streamResponse(messages, config)) {
        if (chunk.type === 'content') {
          chunks.push(chunk.content!);
        }
      }

      expect(chunks).toEqual(['Hello ', 'world!']);
    });

    it('should yield done event on stream completion', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'Text' },
          };
          yield { type: 'message_stop' };
        },
      };

      mockClient.messages.stream.mockResolvedValue(mockStream);

      let doneReceived = false;
      for await (const chunk of provider.streamResponse(messages, config)) {
        if (chunk.type === 'done') {
          doneReceived = true;
        }
      }

      expect(doneReceived).toBe(true);
    });

    it('should handle tool call deltas', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: 'content_block_delta',
            delta: { type: 'input_json_delta', partial_json: '{"param":' },
          };
          yield {
            type: 'content_block_delta',
            delta: { type: 'input_json_delta', partial_json: '"value"}' },
          };
          yield { type: 'message_stop' };
        },
      };

      mockClient.messages.stream.mockResolvedValue(mockStream);

      const toolCalls: any[] = [];
      for await (const chunk of provider.streamResponse(messages, config)) {
        if (chunk.type === 'tool_call') {
          toolCalls.push(chunk.toolCall);
        }
      }

      expect(toolCalls).toHaveLength(2);
    });
  });

  describe('parseToolCalls', () => {
    it('should parse tool use blocks', () => {
      const response = {
        content: 'Text response',
        stopReason: 'tool_use',
        usage: { inputTokens: 10, outputTokens: 20 },
        rawResponse: {
          content: [
            { type: 'text', text: 'Let me calculate that' },
            {
              type: 'tool_use',
              id: 'call_123',
              name: 'calculator',
              input: { expression: '2 + 2' },
            },
          ],
        },
      };

      const toolCalls = provider.parseToolCalls(response);

      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0]).toEqual({
        id: 'call_123',
        tool: 'calculator',
        parameters: { expression: '2 + 2' },
      });
    });

    it('should return empty array for no tool calls', () => {
      const response = {
        content: 'Text response',
        stopReason: 'end_turn',
        usage: { inputTokens: 10, outputTokens: 20 },
        rawResponse: {
          content: [{ type: 'text', text: 'Regular response' }],
        },
      };

      const toolCalls = provider.parseToolCalls(response);

      expect(toolCalls).toEqual([]);
    });

    it('should handle multiple tool calls', () => {
      const response = {
        content: 'Text response',
        stopReason: 'tool_use',
        usage: { inputTokens: 10, outputTokens: 20 },
        rawResponse: {
          content: [
            {
              type: 'tool_use',
              id: 'call_1',
              name: 'tool1',
              input: { param: 'value1' },
            },
            {
              type: 'tool_use',
              id: 'call_2',
              name: 'tool2',
              input: { param: 'value2' },
            },
          ],
        },
      };

      const toolCalls = provider.parseToolCalls(response);

      expect(toolCalls).toHaveLength(2);
      expect(toolCalls[0].tool).toBe('tool1');
      expect(toolCalls[1].tool).toBe('tool2');
    });
  });

  describe('convertMessages', () => {
    it('should skip system messages', async () => {
      const messages: Message[] = [
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'Hello' },
      ];

      const mockResponse = {
        content: [{ type: 'text', text: 'Response' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 20 },
      };

      mockClient.messages.create.mockResolvedValue(mockResponse);

      await provider.generateResponse(messages, {
        model: 'claude-3-5-sonnet-20241022',
      });

      const callArgs = mockClient.messages.create.mock.calls[0][0];
      expect(callArgs.messages).toHaveLength(1);
      expect(callArgs.messages[0].content).toBe('Hello');
    });

    it('should convert user and assistant messages', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
        { role: 'user', content: 'How are you?' },
      ];

      const mockResponse = {
        content: [{ type: 'text', text: 'Response' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 20 },
      };

      mockClient.messages.create.mockResolvedValue(mockResponse);

      await provider.generateResponse(messages, {
        model: 'claude-3-5-sonnet-20241022',
      });

      const callArgs = mockClient.messages.create.mock.calls[0][0];
      expect(callArgs.messages).toHaveLength(3);
    });
  });
});
