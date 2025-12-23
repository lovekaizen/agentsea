import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import { OllamaProvider } from '../ollama';
import { Message, ProviderConfig } from '../../types';

// Mock fetch
global.fetch = vi.fn();

describe('OllamaProvider', () => {
  let provider: OllamaProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new OllamaProvider();
  });

  describe('constructor', () => {
    it('should create provider with default config', () => {
      expect(provider).toBeDefined();
    });

    it('should use custom baseUrl', () => {
      const customProvider = new OllamaProvider({
        baseUrl: 'http://custom:11434',
      });
      expect(customProvider).toBeDefined();
    });

    it('should use environment variable for baseUrl', () => {
      process.env.OLLAMA_BASE_URL = 'http://env:11434';
      const envProvider = new OllamaProvider();
      expect(envProvider).toBeDefined();
      delete process.env.OLLAMA_BASE_URL;
    });

    it('should set custom timeout', () => {
      const timeoutProvider = new OllamaProvider({ timeout: 30000 });
      expect(timeoutProvider).toBeDefined();
    });
  });

  describe('generateResponse', () => {
    const messages: Message[] = [{ role: 'user', content: 'Hello' }];

    const config: ProviderConfig = {
      model: 'llama2',
      maxTokens: 1024,
      temperature: 0.7,
    };

    it('should generate response successfully', async () => {
      const mockResponse = {
        message: { content: 'Hello! How can I help?' },
        done: true,
        prompt_eval_count: 10,
        eval_count: 20,
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const response = await provider.generateResponse(messages, config);

      expect(response).toBeDefined();
      expect(response.content).toBe('Hello! How can I help?');
      expect(response.stopReason).toBe('stop');
      expect(response.usage.inputTokens).toBe(10);
      expect(response.usage.outputTokens).toBe(20);
    });

    it('should handle empty content', async () => {
      const mockResponse = {
        message: { content: null },
        done: true,
        prompt_eval_count: 10,
        eval_count: 0,
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const response = await provider.generateResponse(messages, config);
      expect(response.content).toBe('');
    });

    it('should handle incomplete response', async () => {
      const mockResponse = {
        message: { content: 'Partial response' },
        done: false,
        prompt_eval_count: 10,
        eval_count: 20,
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const response = await provider.generateResponse(messages, config);
      expect(response.stopReason).toBe('length');
    });

    it('should include tools in request', async () => {
      const mockResponse = {
        message: { content: 'Response' },
        done: true,
        prompt_eval_count: 10,
        eval_count: 20,
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

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

      const fetchCall = (global.fetch as any).mock.calls[0];
      const payload = JSON.parse(fetchCall[1].body);
      expect(payload.tools).toBeDefined();
      expect(payload.tools[0].function.name).toBe('calculator');
    });

    it('should handle HTTP errors', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        text: async () => 'Error details',
      });

      await expect(provider.generateResponse(messages, config)).rejects.toThrow(
        'Ollama request failed',
      );
    });

    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      await expect(provider.generateResponse(messages, config)).rejects.toThrow(
        'Ollama request failed: Network error',
      );
    });

    it('should set stream to false', async () => {
      const mockResponse = {
        message: { content: 'Response' },
        done: true,
        prompt_eval_count: 10,
        eval_count: 20,
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      await provider.generateResponse(messages, config);

      const fetchCall = (global.fetch as any).mock.calls[0];
      const payload = JSON.parse(fetchCall[1].body);
      expect(payload.stream).toBe(false);
    });

    it('should handle missing token counts', async () => {
      const mockResponse = {
        message: { content: 'Response' },
        done: true,
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const response = await provider.generateResponse(messages, config);
      expect(response.usage.inputTokens).toBe(0);
      expect(response.usage.outputTokens).toBe(0);
    });
  });

  describe('streamResponse', () => {
    const messages: Message[] = [{ role: 'user', content: 'Hello' }];

    const config: ProviderConfig = {
      model: 'llama2',
      maxTokens: 1024,
    };

    it('should stream text content', async () => {
      const mockStream = [
        '{"message":{"content":"Hello "}}\n',
        '{"message":{"content":"world!"}}\n',
        '{"done":true}\n',
      ];

      let streamIndex = 0;
      const mockReader = {
        read: vi.fn().mockImplementation(async () => {
          if (streamIndex >= mockStream.length) {
            return { done: true, value: undefined };
          }
          const value = new TextEncoder().encode(mockStream[streamIndex++]);
          return { done: false, value };
        }),
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      });

      const chunks: string[] = [];
      for await (const chunk of provider.streamResponse(messages, config)) {
        if (chunk.type === 'content') {
          chunks.push(chunk.content!);
        }
      }

      expect(chunks).toEqual(['Hello ', 'world!']);
    });

    it('should yield done event on completion', async () => {
      const mockStream = [
        '{"message":{"content":"Text"}}\n',
        '{"done":true}\n',
      ];

      let streamIndex = 0;
      const mockReader = {
        read: vi.fn().mockImplementation(async () => {
          if (streamIndex >= mockStream.length) {
            return { done: true, value: undefined };
          }
          const value = new TextEncoder().encode(mockStream[streamIndex++]);
          return { done: false, value };
        }),
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      });

      let doneReceived = false;
      for await (const chunk of provider.streamResponse(messages, config)) {
        if (chunk.type === 'done') {
          doneReceived = true;
        }
      }

      expect(doneReceived).toBe(true);
    });

    it('should handle tool calls in stream', async () => {
      const mockStream = [
        '{"message":{"tool_calls":[{"id":"call_123","function":{"name":"calculator","arguments":"{\\"x\\": 5}"}}]}}\n',
        '{"done":true}\n',
      ];

      let streamIndex = 0;
      const mockReader = {
        read: vi.fn().mockImplementation(async () => {
          if (streamIndex >= mockStream.length) {
            return { done: true, value: undefined };
          }
          const value = new TextEncoder().encode(mockStream[streamIndex++]);
          return { done: false, value };
        }),
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      });

      const toolCalls: any[] = [];
      for await (const chunk of provider.streamResponse(messages, config)) {
        if (chunk.type === 'tool_call') {
          toolCalls.push(chunk.toolCall);
        }
      }

      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].tool).toBe('calculator');
    });

    it('should skip invalid JSON lines', async () => {
      const mockStream = [
        'invalid json\n',
        '{"message":{"content":"Valid"}}\n',
        '{"done":true}\n',
      ];

      let streamIndex = 0;
      const mockReader = {
        read: vi.fn().mockImplementation(async () => {
          if (streamIndex >= mockStream.length) {
            return { done: true, value: undefined };
          }
          const value = new TextEncoder().encode(mockStream[streamIndex++]);
          return { done: false, value };
        }),
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      });

      const chunks: string[] = [];
      for await (const chunk of provider.streamResponse(messages, config)) {
        if (chunk.type === 'content') {
          chunks.push(chunk.content!);
        }
      }

      expect(chunks).toEqual(['Valid']);
    });

    it('should handle HTTP errors', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
      });

      await expect(async () => {
        for await (const chunk of provider.streamResponse(messages, config)) {
          // consume stream
        }
      }).rejects.toThrow('Ollama streaming failed');
    });

    it('should handle missing response body', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        body: null,
      });

      await expect(async () => {
        for await (const chunk of provider.streamResponse(messages, config)) {
          // consume stream
        }
      }).rejects.toThrow('No response body');
    });
  });

  describe('parseToolCalls', () => {
    it('should parse tool calls from response', () => {
      const response = {
        content: 'Using calculator',
        stopReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20 },
        rawResponse: {
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
      };

      const toolCalls = provider.parseToolCalls(response);

      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0]).toEqual({
        id: 'call_123',
        tool: 'calculator',
        parameters: { expression: '2 + 2' },
      });
    });

    it('should handle object arguments', () => {
      const response = {
        content: 'Using tool',
        stopReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20 },
        rawResponse: {
          message: {
            tool_calls: [
              {
                id: 'call_123',
                function: {
                  name: 'tool',
                  arguments: { param: 'value' },
                },
              },
            ],
          },
        },
      };

      const toolCalls = provider.parseToolCalls(response);
      expect(toolCalls[0].parameters).toEqual({ param: 'value' });
    });

    it('should generate ID if missing', () => {
      const response = {
        content: 'Using tool',
        stopReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20 },
        rawResponse: {
          message: {
            tool_calls: [
              {
                function: {
                  name: 'tool',
                  arguments: '{}',
                },
              },
            ],
          },
        },
      };

      const toolCalls = provider.parseToolCalls(response);
      expect(toolCalls[0].id).toBeDefined();
    });

    it('should return empty array for no tool calls', () => {
      const response = {
        content: 'Regular response',
        stopReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20 },
        rawResponse: {
          message: {},
        },
      };

      const toolCalls = provider.parseToolCalls(response);
      expect(toolCalls).toEqual([]);
    });
  });

  describe('convertMessages', () => {
    it('should add system prompt as first message', async () => {
      const messages: Message[] = [{ role: 'user', content: 'Hello' }];

      const mockResponse = {
        message: { content: 'Response' },
        done: true,
        prompt_eval_count: 10,
        eval_count: 20,
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      await provider.generateResponse(messages, {
        model: 'llama2',
        systemPrompt: 'Be helpful',
      });

      const fetchCall = (global.fetch as any).mock.calls[0];
      const payload = JSON.parse(fetchCall[1].body);
      expect(payload.messages[0].role).toBe('system');
      expect(payload.messages[0].content).toBe('Be helpful');
    });

    it('should preserve system messages from conversation', async () => {
      const messages: Message[] = [
        { role: 'system', content: 'System message' },
        { role: 'user', content: 'Hello' },
      ];

      const mockResponse = {
        message: { content: 'Response' },
        done: true,
        prompt_eval_count: 10,
        eval_count: 20,
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      await provider.generateResponse(messages, { model: 'llama2' });

      const fetchCall = (global.fetch as any).mock.calls[0];
      const payload = JSON.parse(fetchCall[1].body);
      expect(payload.messages[0].role).toBe('system');
    });

    it('should convert tool messages', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Calculate 2+2' },
        { role: 'tool', content: '4', toolCallId: 'call_123' },
      ];

      const mockResponse = {
        message: { content: 'Response' },
        done: true,
        prompt_eval_count: 10,
        eval_count: 20,
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      await provider.generateResponse(messages, { model: 'llama2' });

      const fetchCall = (global.fetch as any).mock.calls[0];
      const payload = JSON.parse(fetchCall[1].body);
      const toolMessage = payload.messages.find((m: any) => m.role === 'tool');
      expect(toolMessage).toBeDefined();
      expect(toolMessage.tool_call_id).toBe('call_123');
    });
  });

  describe('listModels', () => {
    it('should list available models', async () => {
      const mockResponse = {
        models: [{ name: 'llama2' }, { name: 'codellama' }],
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const models = await provider.listModels();

      expect(models).toEqual(['llama2', 'codellama']);
    });

    it('should handle empty model list', async () => {
      const mockResponse = { models: [] };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const models = await provider.listModels();
      expect(models).toEqual([]);
    });

    it('should handle errors', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        statusText: 'Server Error',
      });

      await expect(provider.listModels()).rejects.toThrow(
        'Failed to list models',
      );
    });
  });

  describe('pullModel', () => {
    it('should pull model successfully', async () => {
      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({ done: false, value: new Uint8Array() })
          .mockResolvedValueOnce({ done: true, value: undefined }),
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      });

      await provider.pullModel('llama2');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/pull'),
        expect.any(Object),
      );
    });

    it('should handle pull errors', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      });

      await expect(provider.pullModel('invalid-model')).rejects.toThrow(
        'Failed to pull model',
      );
    });
  });
});
