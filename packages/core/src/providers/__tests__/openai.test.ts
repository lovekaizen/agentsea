import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import { OpenAIProvider } from '../openai';
import { Message, ProviderConfig } from '../../types';

// Mock OpenAI SDK
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    })),
  };
});

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new OpenAIProvider('test-api-key');
    mockClient = (provider as any).client;
  });

  describe('constructor', () => {
    it('should create provider with API key', () => {
      expect(provider).toBeDefined();
    });

    it('should use environment variable if no API key provided', () => {
      process.env.OPENAI_API_KEY = 'env-key';
      const envProvider = new OpenAIProvider();
      expect(envProvider).toBeDefined();
      delete process.env.OPENAI_API_KEY;
    });
  });

  describe('generateResponse', () => {
    const messages: Message[] = [{ role: 'user', content: 'Hello' }];

    const config: ProviderConfig = {
      model: 'gpt-4',
      maxTokens: 1024,
      temperature: 0.7,
    };

    it('should generate response successfully', async () => {
      const mockResponse = {
        choices: [
          {
            message: { content: 'Hello! How can I help you?' },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
        },
      };

      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      const response = await provider.generateResponse(messages, config);

      expect(response).toBeDefined();
      expect(response.content).toBe('Hello! How can I help you?');
      expect(response.stopReason).toBe('stop');
      expect(response.usage.inputTokens).toBe(10);
      expect(response.usage.outputTokens).toBe(20);
    });

    it('should throw error when no choices returned', async () => {
      const mockResponse = {
        choices: [],
        usage: { prompt_tokens: 10, completion_tokens: 0 },
      };

      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      await expect(provider.generateResponse(messages, config)).rejects.toThrow(
        'No response from OpenAI',
      );
    });

    it('should handle null content', async () => {
      const mockResponse = {
        choices: [
          {
            message: { content: null },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 20 },
      };

      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      const response = await provider.generateResponse(messages, config);
      expect(response.content).toBe('');
    });

    it('should include system prompt', async () => {
      const mockResponse = {
        choices: [
          {
            message: { content: 'Response' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 20 },
      };

      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      const configWithSystem = {
        ...config,
        systemPrompt: 'You are a helpful assistant',
      };

      await provider.generateResponse(messages, configWithSystem);

      const callArgs = mockClient.chat.completions.create.mock.calls[0][0];
      expect(callArgs.messages[0]).toEqual({
        role: 'system',
        content: 'You are a helpful assistant',
      });
    });

    it('should convert tools to OpenAI format', async () => {
      const mockResponse = {
        choices: [
          {
            message: { content: 'Response' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 20 },
      };

      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

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

      const callArgs = mockClient.chat.completions.create.mock.calls[0][0];
      expect(callArgs.tools).toHaveLength(1);
      expect(callArgs.tools[0].type).toBe('function');
      expect(callArgs.tools[0].function.name).toBe('calculator');
    });

    it('should handle missing usage data', async () => {
      const mockResponse = {
        choices: [
          {
            message: { content: 'Response' },
            finish_reason: 'stop',
          },
        ],
        usage: undefined,
      };

      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      const response = await provider.generateResponse(messages, config);
      expect(response.usage.inputTokens).toBe(0);
      expect(response.usage.outputTokens).toBe(0);
    });

    it('should handle API errors', async () => {
      mockClient.chat.completions.create.mockRejectedValue(
        new Error('API Error'),
      );

      await expect(provider.generateResponse(messages, config)).rejects.toThrow(
        'API Error',
      );
    });
  });

  describe('streamResponse', () => {
    const messages: Message[] = [{ role: 'user', content: 'Hello' }];

    const config: ProviderConfig = {
      model: 'gpt-4',
      maxTokens: 1024,
    };

    it('should stream text content', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            choices: [
              {
                delta: { content: 'Hello ' },
              },
            ],
          };
          yield {
            choices: [
              {
                delta: { content: 'world!' },
              },
            ],
          };
          yield {
            choices: [
              {
                delta: {},
                finish_reason: 'stop',
              },
            ],
          };
        },
      };

      mockClient.chat.completions.create.mockResolvedValue(mockStream);

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
            choices: [
              {
                delta: { content: 'Text' },
              },
            ],
          };
          yield {
            choices: [
              {
                delta: {},
                finish_reason: 'stop',
              },
            ],
          };
        },
      };

      mockClient.chat.completions.create.mockResolvedValue(mockStream);

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
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      id: 'call_123',
                      function: { name: 'calculator', arguments: '{"x": 5}' },
                    },
                  ],
                },
              },
            ],
          };
          yield {
            choices: [
              {
                delta: {},
                finish_reason: 'tool_calls',
              },
            ],
          };
        },
      };

      mockClient.chat.completions.create.mockResolvedValue(mockStream);

      const toolCalls: any[] = [];
      for await (const chunk of provider.streamResponse(messages, config)) {
        if (chunk.type === 'tool_call') {
          toolCalls.push(chunk.toolCall);
        }
      }

      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].id).toBe('call_123');
      expect(toolCalls[0].tool).toBe('calculator');
    });

    it('should set stream parameter to true', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            choices: [{ delta: {}, finish_reason: 'stop' }],
          };
        },
      };

      mockClient.chat.completions.create.mockResolvedValue(mockStream);

      const chunks: any[] = [];
      for await (const chunk of provider.streamResponse(messages, config)) {
        chunks.push(chunk);
      }

      const callArgs = mockClient.chat.completions.create.mock.calls[0][0];
      expect(callArgs.stream).toBe(true);
    });
  });

  describe('parseToolCalls', () => {
    it('should parse tool calls from response', () => {
      const response = {
        content: 'Using calculator',
        stopReason: 'tool_calls',
        usage: { inputTokens: 10, outputTokens: 20 },
        rawResponse: {
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    id: 'call_123',
                    function: {
                      name: 'calculator',
                      arguments: '{"expression": "2 + 2"}',
                    },
                  },
                ],
              },
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
        content: 'Regular response',
        stopReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20 },
        rawResponse: {
          choices: [
            {
              message: {
                content: 'Regular response',
              },
            },
          ],
        },
      };

      const toolCalls = provider.parseToolCalls(response);
      expect(toolCalls).toEqual([]);
    });

    it('should handle multiple tool calls', () => {
      const response = {
        content: 'Using tools',
        stopReason: 'tool_calls',
        usage: { inputTokens: 10, outputTokens: 20 },
        rawResponse: {
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    id: 'call_1',
                    function: {
                      name: 'tool1',
                      arguments: '{"param": "value1"}',
                    },
                  },
                  {
                    id: 'call_2',
                    function: {
                      name: 'tool2',
                      arguments: '{"param": "value2"}',
                    },
                  },
                ],
              },
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
    it('should add system prompt as first message', async () => {
      const messages: Message[] = [{ role: 'user', content: 'Hello' }];

      const mockResponse = {
        choices: [
          {
            message: { content: 'Response' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 20 },
      };

      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      await provider.generateResponse(messages, {
        model: 'gpt-4',
        systemPrompt: 'Be helpful',
      });

      const callArgs = mockClient.chat.completions.create.mock.calls[0][0];
      expect(callArgs.messages[0].role).toBe('system');
      expect(callArgs.messages[0].content).toBe('Be helpful');
    });

    it('should skip system messages in conversation', async () => {
      const messages: Message[] = [
        { role: 'system', content: 'System message' },
        { role: 'user', content: 'Hello' },
      ];

      const mockResponse = {
        choices: [
          {
            message: { content: 'Response' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 20 },
      };

      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      await provider.generateResponse(messages, {
        model: 'gpt-4',
      });

      const callArgs = mockClient.chat.completions.create.mock.calls[0][0];
      const userMessages = callArgs.messages.filter(
        (m: any) => m.role === 'user',
      );
      expect(userMessages).toHaveLength(1);
    });

    it('should convert tool messages', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Calculate 2+2' },
        {
          role: 'tool',
          content: '4',
          toolCallId: 'call_123',
        },
      ];

      const mockResponse = {
        choices: [
          {
            message: { content: 'Response' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 20 },
      };

      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      await provider.generateResponse(messages, {
        model: 'gpt-4',
      });

      const callArgs = mockClient.chat.completions.create.mock.calls[0][0];
      const toolMessage = callArgs.messages.find((m: any) => m.role === 'tool');
      expect(toolMessage).toBeDefined();
      expect(toolMessage.tool_call_id).toBe('call_123');
      expect(toolMessage.content).toBe('4');
    });
  });
});
