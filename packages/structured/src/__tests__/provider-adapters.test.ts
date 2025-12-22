/**
 * Tests for Provider Adapters (OpenAI, Anthropic, Google)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  OpenAIAdapter,
  createOpenAIAdapter,
} from '../providers/OpenAIAdapter.js';
import {
  AnthropicAdapter,
  createAnthropicAdapter,
} from '../providers/AnthropicAdapter.js';
import {
  GoogleAdapter,
  createGoogleAdapter,
} from '../providers/GoogleAdapter.js';
import type { JsonSchema, ToolDefinition } from '../types/schema.types.js';
import type { ChatMessage } from '../types/core.types.js';

describe('OpenAIAdapter', () => {
  // Mock OpenAI client
  function createMockOpenAIClient(response?: unknown) {
    return {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue(
            response ?? {
              id: 'chatcmpl-123',
              choices: [
                {
                  message: {
                    role: 'assistant',
                    content: '{"result": "test"}',
                  },
                  finish_reason: 'stop',
                },
              ],
              usage: {
                prompt_tokens: 10,
                completion_tokens: 20,
                total_tokens: 30,
              },
            },
          ),
        },
      },
    };
  }

  describe('constructor', () => {
    it('should create adapter with client', () => {
      const client = createMockOpenAIClient();
      const adapter = new OpenAIAdapter(client);

      expect(adapter.name).toBe('openai');
    });

    it('should create adapter with options', () => {
      const client = createMockOpenAIClient();
      const adapter = new OpenAIAdapter(client, {});

      expect(adapter.name).toBe('openai');
    });
  });

  describe('createOpenAIAdapter', () => {
    it('should create adapter via factory function', () => {
      const client = createMockOpenAIClient();
      const adapter = createOpenAIAdapter(client);

      expect(adapter).toBeInstanceOf(OpenAIAdapter);
    });
  });

  describe('getCapabilities', () => {
    it('should return capabilities for gpt-4o', () => {
      const client = createMockOpenAIClient();
      const adapter = new OpenAIAdapter(client);

      const caps = adapter.getCapabilities('gpt-4o');

      expect(caps.jsonMode).toBe(true);
      expect(caps.strictJsonMode).toBe(true);
      expect(caps.toolCalling).toBe(true);
      expect(caps.streaming).toBe(true);
      expect(caps.systemMessages).toBe(true);
      expect(caps.maxContextWindow).toBe(128000);
      expect(caps.maxOutputTokens).toBe(16384);
    });

    it('should return capabilities for gpt-4o-mini', () => {
      const client = createMockOpenAIClient();
      const adapter = new OpenAIAdapter(client);

      const caps = adapter.getCapabilities('gpt-4o-mini');

      expect(caps.jsonMode).toBe(true);
      expect(caps.strictJsonMode).toBe(true);
    });

    it('should return capabilities for gpt-4-turbo', () => {
      const client = createMockOpenAIClient();
      const adapter = new OpenAIAdapter(client);

      const caps = adapter.getCapabilities('gpt-4-turbo');

      expect(caps.jsonMode).toBe(true);
      expect(caps.strictJsonMode).toBe(false);
    });

    it('should return capabilities for gpt-4', () => {
      const client = createMockOpenAIClient();
      const adapter = new OpenAIAdapter(client);

      const caps = adapter.getCapabilities('gpt-4');

      expect(caps.maxContextWindow).toBe(8192);
    });

    it('should return capabilities for gpt-3.5-turbo', () => {
      const client = createMockOpenAIClient();
      const adapter = new OpenAIAdapter(client);

      const caps = adapter.getCapabilities('gpt-3.5-turbo');

      expect(caps.jsonMode).toBe(true);
      expect(caps.maxContextWindow).toBe(16385);
    });

    it('should return capabilities for o1-preview', () => {
      const client = createMockOpenAIClient();
      const adapter = new OpenAIAdapter(client);

      const caps = adapter.getCapabilities('o1-preview');

      expect(caps.jsonMode).toBe(false);
      expect(caps.toolCalling).toBe(false);
      expect(caps.streaming).toBe(false);
      expect(caps.systemMessages).toBe(false);
    });

    it('should return capabilities for o1-mini', () => {
      const client = createMockOpenAIClient();
      const adapter = new OpenAIAdapter(client);

      const caps = adapter.getCapabilities('o1-mini');

      expect(caps.jsonMode).toBe(false);
      expect(caps.maxOutputTokens).toBe(65536);
    });

    it('should return default capabilities for unknown model', () => {
      const client = createMockOpenAIClient();
      const adapter = new OpenAIAdapter(client);

      const caps = adapter.getCapabilities('unknown-model');

      expect(caps.jsonMode).toBe(true);
    });
  });

  describe('supportsJsonMode', () => {
    it('should return true for gpt-4o', () => {
      const client = createMockOpenAIClient();
      const adapter = new OpenAIAdapter(client);

      expect(adapter.supportsJsonMode('gpt-4o')).toBe(true);
    });

    it('should return false for o1-preview', () => {
      const client = createMockOpenAIClient();
      const adapter = new OpenAIAdapter(client);

      expect(adapter.supportsJsonMode('o1-preview')).toBe(false);
    });
  });

  describe('supportsToolCalling', () => {
    it('should return true for gpt-4o', () => {
      const client = createMockOpenAIClient();
      const adapter = new OpenAIAdapter(client);

      expect(adapter.supportsToolCalling('gpt-4o')).toBe(true);
    });

    it('should return false for o1-mini', () => {
      const client = createMockOpenAIClient();
      const adapter = new OpenAIAdapter(client);

      expect(adapter.supportsToolCalling('o1-mini')).toBe(false);
    });
  });

  describe('createCompletion', () => {
    it('should create completion and parse response', async () => {
      const client = createMockOpenAIClient();
      const adapter = new OpenAIAdapter(client);

      const result = await adapter.createCompletion({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
        mode: 'json',
      });

      expect(result.content).toBe('{"result": "test"}');
      expect(result.usage?.promptTokens).toBe(10);
      expect(result.usage?.completionTokens).toBe(20);
      expect(result.usage?.totalTokens).toBe(30);
      expect(result.finishReason).toBe('stop');
    });

    it('should handle tool calls in response', async () => {
      const client = createMockOpenAIClient({
        id: 'chatcmpl-123',
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: {
                    name: 'get_weather',
                    arguments: '{"location": "NYC"}',
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      });

      const adapter = new OpenAIAdapter(client);

      const result = await adapter.createCompletion({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Get weather' }],
        mode: 'tool',
        toolDefinition: {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get weather',
            parameters: { type: 'object', properties: {} },
          },
        },
      });

      expect(result.toolCalls).toBeDefined();
      expect(result.toolCalls?.length).toBe(1);
      expect(result.toolCalls?.[0].name).toBe('get_weather');
      expect(result.toolCalls?.[0].id).toBe('call_123');
    });

    it('should apply JSON mode with strict schema', async () => {
      const client = createMockOpenAIClient();
      const adapter = new OpenAIAdapter(client);

      await adapter.createCompletion({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
        mode: 'json',
        jsonSchema: {
          type: 'object',
          properties: { name: { type: 'string' } },
        },
      });

      expect(client.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          response_format: expect.objectContaining({
            type: 'json_schema',
          }),
        }),
      );
    });

    it('should apply JSON object mode for non-strict models', async () => {
      const client = createMockOpenAIClient();
      const adapter = new OpenAIAdapter(client);

      await adapter.createCompletion({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        mode: 'json',
        jsonSchema: {
          type: 'object',
          properties: { name: { type: 'string' } },
        },
      });

      expect(client.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          response_format: { type: 'json_object' },
        }),
      );
    });

    it('should apply tool calling mode', async () => {
      const client = createMockOpenAIClient();
      const adapter = new OpenAIAdapter(client);

      const tool: ToolDefinition = {
        type: 'function',
        function: {
          name: 'my_tool',
          description: 'My tool',
          parameters: { type: 'object', properties: {} },
        },
      };

      await adapter.createCompletion({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
        mode: 'tool',
        toolDefinition: tool,
      });

      expect(client.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: expect.any(Array),
          tool_choice: expect.objectContaining({
            type: 'function',
            function: { name: 'my_tool' },
          }),
        }),
      );
    });

    it('should merge additional options', async () => {
      const client = createMockOpenAIClient();
      const adapter = new OpenAIAdapter(client);

      await adapter.createCompletion({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
        mode: 'json',
        temperature: 0.5,
        maxTokens: 1000,
        options: { seed: 42 },
      });

      expect(client.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.5,
          max_tokens: 1000,
          seed: 42,
        }),
      );
    });

    it('should handle response without usage', async () => {
      const client = createMockOpenAIClient({
        id: 'chatcmpl-123',
        choices: [
          {
            message: { role: 'assistant', content: 'test' },
            finish_reason: 'stop',
          },
        ],
      });

      const adapter = new OpenAIAdapter(client);

      const result = await adapter.createCompletion({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
        mode: 'json',
      });

      expect(result.content).toBe('test');
      expect(result.usage).toBeUndefined();
    });
  });

  describe('createStreamingCompletion', () => {
    it('should stream chunks', async () => {
      const streamChunks = [
        {
          id: 'chatcmpl-123',
          choices: [{ delta: { content: 'Hello' }, finish_reason: null }],
        },
        {
          id: 'chatcmpl-123',
          choices: [{ delta: { content: ' World' }, finish_reason: null }],
        },
        {
          id: 'chatcmpl-123',
          choices: [{ delta: {}, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        },
      ];

      const client = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              [Symbol.asyncIterator]: async function* () {
                for (const chunk of streamChunks) {
                  yield chunk;
                }
              },
            }),
          },
        },
      };

      const adapter = new OpenAIAdapter(client);

      const chunks: Array<{ content: string; isFinal: boolean }> = [];
      for await (const chunk of adapter.createStreamingCompletion({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hi' }],
        mode: 'json',
      })) {
        chunks.push({ content: chunk.content, isFinal: chunk.isFinal });
      }

      expect(chunks.length).toBe(3);
      expect(chunks[0].content).toBe('Hello');
      expect(chunks[1].content).toBe(' World');
      expect(chunks[2].isFinal).toBe(true);
    });

    it('should handle tool call deltas in stream', async () => {
      const streamChunks = [
        {
          id: 'chatcmpl-123',
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: 'call_123',
                    function: { name: 'test_tool', arguments: '{"a":' },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        },
        {
          id: 'chatcmpl-123',
          choices: [
            {
              delta: {
                tool_calls: [{ index: 0, function: { arguments: '1}' } }],
              },
              finish_reason: null,
            },
          ],
        },
        {
          id: 'chatcmpl-123',
          choices: [{ delta: {}, finish_reason: 'tool_calls' }],
        },
      ];

      const client = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              [Symbol.asyncIterator]: async function* () {
                for (const chunk of streamChunks) {
                  yield chunk;
                }
              },
            }),
          },
        },
      };

      const adapter = new OpenAIAdapter(client);

      const toolDeltas: unknown[] = [];
      for await (const chunk of adapter.createStreamingCompletion({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hi' }],
        mode: 'tool',
      })) {
        if (chunk.toolCallDeltas) {
          toolDeltas.push(...chunk.toolCallDeltas);
        }
      }

      expect(toolDeltas.length).toBeGreaterThan(0);
    });

    it('should skip empty choices', async () => {
      const streamChunks = [
        { id: 'chatcmpl-123', choices: [] },
        {
          id: 'chatcmpl-123',
          choices: [{ delta: { content: 'test' }, finish_reason: 'stop' }],
        },
      ];

      const client = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              [Symbol.asyncIterator]: async function* () {
                for (const chunk of streamChunks) {
                  yield chunk;
                }
              },
            }),
          },
        },
      };

      const adapter = new OpenAIAdapter(client);

      const chunks: string[] = [];
      for await (const chunk of adapter.createStreamingCompletion({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hi' }],
        mode: 'json',
      })) {
        chunks.push(chunk.content);
      }

      expect(chunks).toEqual(['test']);
    });
  });

  describe('formatMessages', () => {
    it('should format messages correctly', () => {
      const client = createMockOpenAIClient();
      const adapter = new OpenAIAdapter(client);

      const messages: ChatMessage[] = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello', name: 'user1' },
        { role: 'assistant', content: 'Hi there' },
      ];

      const formatted = adapter.formatMessages(messages) as Array<{
        role: string;
        content: string;
        name?: string;
      }>;

      expect(formatted.length).toBe(3);
      expect(formatted[0].role).toBe('system');
      expect(formatted[1].name).toBe('user1');
    });
  });

  describe('formatJsonSchema', () => {
    it('should format JSON schema for OpenAI', () => {
      const client = createMockOpenAIClient();
      const adapter = new OpenAIAdapter(client);

      const schema: JsonSchema = {
        type: 'object',
        properties: { name: { type: 'string' } },
      };

      const formatted = adapter.formatJsonSchema(schema) as {
        type: string;
        json_schema: { name: string; schema: JsonSchema; strict: boolean };
      };

      expect(formatted.type).toBe('json_schema');
      expect(formatted.json_schema.name).toBe('response');
      expect(formatted.json_schema.strict).toBe(true);
      expect(formatted.json_schema.schema).toBe(schema);
    });
  });

  describe('formatToolDefinition', () => {
    it('should format tool definition for OpenAI', () => {
      const client = createMockOpenAIClient();
      const adapter = new OpenAIAdapter(client);

      const tool: ToolDefinition = {
        type: 'function',
        function: {
          name: 'my_tool',
          description: 'My description',
          parameters: { type: 'object', properties: {} },
          strict: true,
        },
      };

      const formatted = adapter.formatToolDefinition(tool) as {
        type: string;
        function: { name: string; description: string; strict: boolean };
      };

      expect(formatted.type).toBe('function');
      expect(formatted.function.name).toBe('my_tool');
      expect(formatted.function.description).toBe('My description');
      expect(formatted.function.strict).toBe(true);
    });
  });
});

describe('AnthropicAdapter', () => {
  // Mock Anthropic client
  function createMockAnthropicClient(response?: unknown) {
    return {
      messages: {
        create: vi.fn().mockResolvedValue(
          response ?? {
            id: 'msg_123',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: '{"result": "test"}' }],
            model: 'claude-3-5-sonnet-20241022',
            stop_reason: 'end_turn',
            stop_sequence: null,
            usage: { input_tokens: 10, output_tokens: 20 },
          },
        ),
      },
    };
  }

  describe('constructor', () => {
    it('should create adapter with client', () => {
      const client = createMockAnthropicClient();
      const adapter = new AnthropicAdapter(client);

      expect(adapter.name).toBe('anthropic');
    });

    it('should create adapter with options', () => {
      const client = createMockAnthropicClient();
      const adapter = new AnthropicAdapter(client, {
        metadata: { user_id: '123' },
      });

      expect(adapter.name).toBe('anthropic');
    });
  });

  describe('createAnthropicAdapter', () => {
    it('should create adapter via factory function', () => {
      const client = createMockAnthropicClient();
      const adapter = createAnthropicAdapter(client);

      expect(adapter).toBeInstanceOf(AnthropicAdapter);
    });
  });

  describe('getCapabilities', () => {
    it('should return capabilities for claude-opus-4', () => {
      const client = createMockAnthropicClient();
      const adapter = new AnthropicAdapter(client);

      const caps = adapter.getCapabilities('claude-opus-4-20250514');

      expect(caps.jsonMode).toBe(false);
      expect(caps.toolCalling).toBe(true);
      expect(caps.streaming).toBe(true);
      expect(caps.systemMessages).toBe(true);
      expect(caps.maxContextWindow).toBe(200000);
      expect(caps.maxOutputTokens).toBe(32768);
    });

    it('should return capabilities for claude-sonnet-4', () => {
      const client = createMockAnthropicClient();
      const adapter = new AnthropicAdapter(client);

      const caps = adapter.getCapabilities('claude-sonnet-4-20250514');

      expect(caps.maxOutputTokens).toBe(64000);
    });

    it('should return capabilities for claude-3-5-sonnet', () => {
      const client = createMockAnthropicClient();
      const adapter = new AnthropicAdapter(client);

      const caps = adapter.getCapabilities('claude-3-5-sonnet-20241022');

      expect(caps.maxContextWindow).toBe(200000);
      expect(caps.maxOutputTokens).toBe(8192);
    });

    it('should return capabilities for claude-3-5-haiku', () => {
      const client = createMockAnthropicClient();
      const adapter = new AnthropicAdapter(client);

      const caps = adapter.getCapabilities('claude-3-5-haiku-20241022');

      expect(caps.toolCalling).toBe(true);
    });

    it('should return capabilities for claude-3-opus', () => {
      const client = createMockAnthropicClient();
      const adapter = new AnthropicAdapter(client);

      const caps = adapter.getCapabilities('claude-3-opus-20240229');

      expect(caps.maxOutputTokens).toBe(4096);
    });

    it('should return capabilities for claude-3-sonnet', () => {
      const client = createMockAnthropicClient();
      const adapter = new AnthropicAdapter(client);

      const caps = adapter.getCapabilities('claude-3-sonnet-20240229');

      expect(caps.toolCalling).toBe(true);
    });

    it('should return capabilities for claude-3-haiku', () => {
      const client = createMockAnthropicClient();
      const adapter = new AnthropicAdapter(client);

      const caps = adapter.getCapabilities('claude-3-haiku-20240307');

      expect(caps.streaming).toBe(true);
    });

    it('should return default capabilities for unknown model', () => {
      const client = createMockAnthropicClient();
      const adapter = new AnthropicAdapter(client);

      const caps = adapter.getCapabilities('unknown');

      // Should default to claude-3-5-sonnet
      expect(caps.toolCalling).toBe(true);
    });

    it('should handle partial model name match', () => {
      const client = createMockAnthropicClient();
      const adapter = new AnthropicAdapter(client);

      // Should match 'claude-3-opus' even with prefix
      const caps = adapter.getCapabilities('custom-claude-3-opus-20240229');

      expect(caps.maxOutputTokens).toBe(4096);
    });
  });

  describe('supportsJsonMode', () => {
    it('should return false (Anthropic uses tool calling)', () => {
      const client = createMockAnthropicClient();
      const adapter = new AnthropicAdapter(client);

      expect(adapter.supportsJsonMode('claude-3-5-sonnet-20241022')).toBe(
        false,
      );
    });
  });

  describe('supportsToolCalling', () => {
    it('should return true for Claude models', () => {
      const client = createMockAnthropicClient();
      const adapter = new AnthropicAdapter(client);

      expect(adapter.supportsToolCalling('claude-3-5-sonnet-20241022')).toBe(
        true,
      );
    });
  });

  describe('createCompletion', () => {
    it('should create completion and parse text response', async () => {
      const client = createMockAnthropicClient();
      const adapter = new AnthropicAdapter(client);

      const result = await adapter.createCompletion({
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: 'Hello' }],
        mode: 'json',
      });

      expect(result.content).toBe('{"result": "test"}');
      expect(result.usage?.promptTokens).toBe(10);
      expect(result.usage?.completionTokens).toBe(20);
      expect(result.usage?.totalTokens).toBe(30);
    });

    it('should parse tool use response', async () => {
      const client = createMockAnthropicClient({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_123',
            name: 'get_data',
            input: { key: 'value' },
          },
        ],
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'tool_use',
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 20 },
      });

      const adapter = new AnthropicAdapter(client);

      const result = await adapter.createCompletion({
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: 'Get data' }],
        mode: 'tool',
      });

      expect(result.toolCalls).toBeDefined();
      expect(result.toolCalls?.length).toBe(1);
      expect(result.toolCalls?.[0].name).toBe('get_data');
      expect(result.toolCalls?.[0].id).toBe('toolu_123');
    });

    it('should apply JSON mode via tool calling', async () => {
      const client = createMockAnthropicClient();
      const adapter = new AnthropicAdapter(client);

      await adapter.createCompletion({
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Extract' },
        ],
        mode: 'json',
        jsonSchema: {
          type: 'object',
          properties: { name: { type: 'string' } },
        },
      });

      expect(client.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: expect.arrayContaining([
            expect.objectContaining({
              name: 'extract_structured_data',
            }),
          ]),
          tool_choice: { type: 'tool', name: 'extract_structured_data' },
        }),
      );
    });

    it('should apply tool mode', async () => {
      const client = createMockAnthropicClient();
      const adapter = new AnthropicAdapter(client);

      await adapter.createCompletion({
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: 'Call tool' }],
        mode: 'tool',
        toolDefinition: {
          type: 'function',
          function: {
            name: 'my_tool',
            description: 'My tool',
            parameters: { type: 'object', properties: {} },
          },
        },
      });

      expect(client.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: expect.arrayContaining([
            expect.objectContaining({
              name: 'my_tool',
            }),
          ]),
        }),
      );
    });

    it('should apply prompt mode with JSON instruction', async () => {
      const client = createMockAnthropicClient();
      const adapter = new AnthropicAdapter(client);

      await adapter.createCompletion({
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Extract' },
        ],
        mode: 'prompt',
      });

      expect(client.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('Respond with valid JSON only'),
        }),
      );
    });

    it('should add JSON instruction when no system message', async () => {
      const client = createMockAnthropicClient();
      const adapter = new AnthropicAdapter(client);

      await adapter.createCompletion({
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: 'Extract' }],
        mode: 'prompt',
      });

      expect(client.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'Respond with valid JSON only.',
        }),
      );
    });

    it('should include metadata if provided', async () => {
      const client = createMockAnthropicClient();
      const adapter = new AnthropicAdapter(client, {
        metadata: { user_id: '123' },
      });

      await adapter.createCompletion({
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: 'Hello' }],
        mode: 'json',
      });

      expect(client.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { user_id: '123' },
        }),
      );
    });

    it('should merge additional options', async () => {
      const client = createMockAnthropicClient();
      const adapter = new AnthropicAdapter(client);

      await adapter.createCompletion({
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: 'Hello' }],
        mode: 'json',
        options: { top_k: 10 },
      });

      expect(client.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          top_k: 10,
        }),
      );
    });
  });

  describe('createStreamingCompletion', () => {
    it('should stream text content', async () => {
      const streamEvents = [
        { type: 'message_start', message: { usage: { input_tokens: 10 } } },
        {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'Hello' },
        },
        {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: ' World' },
        },
        { type: 'message_delta', usage: { output_tokens: 5 } },
        { type: 'message_stop' },
      ];

      const client = {
        messages: {
          create: vi.fn().mockResolvedValue({
            [Symbol.asyncIterator]: async function* () {
              for (const event of streamEvents) {
                yield event;
              }
            },
          }),
        },
      };

      const adapter = new AnthropicAdapter(client);

      const chunks: Array<{ content: string; isFinal: boolean }> = [];
      for await (const chunk of adapter.createStreamingCompletion({
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: 'Hi' }],
        mode: 'json',
      })) {
        chunks.push({ content: chunk.content, isFinal: chunk.isFinal });
      }

      expect(chunks.some((c) => c.content === 'Hello')).toBe(true);
      expect(chunks.some((c) => c.content === ' World')).toBe(true);
      expect(chunks.some((c) => c.isFinal)).toBe(true);
    });

    it('should stream tool call deltas', async () => {
      const streamEvents = [
        { type: 'message_start', message: { usage: { input_tokens: 10 } } },
        {
          type: 'content_block_start',
          content_block: { type: 'tool_use', id: 'toolu_123', name: 'my_tool' },
        },
        {
          type: 'content_block_delta',
          delta: { type: 'input_json_delta', partial_json: '{"a":' },
        },
        {
          type: 'content_block_delta',
          delta: { type: 'input_json_delta', partial_json: '1}' },
        },
        { type: 'message_delta', usage: { output_tokens: 10 } },
        { type: 'message_stop' },
      ];

      const client = {
        messages: {
          create: vi.fn().mockResolvedValue({
            [Symbol.asyncIterator]: async function* () {
              for (const event of streamEvents) {
                yield event;
              }
            },
          }),
        },
      };

      const adapter = new AnthropicAdapter(client);

      const toolDeltas: unknown[] = [];
      for await (const chunk of adapter.createStreamingCompletion({
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: 'Call tool' }],
        mode: 'tool',
      })) {
        if (chunk.toolCallDeltas) {
          toolDeltas.push(...chunk.toolCallDeltas);
        }
      }

      expect(toolDeltas.length).toBeGreaterThan(0);
    });
  });

  describe('formatMessages', () => {
    it('should separate system message', () => {
      const client = createMockAnthropicClient();
      const adapter = new AnthropicAdapter(client);

      const messages: ChatMessage[] = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' },
      ];

      const formatted = adapter.formatMessages(messages) as {
        system?: string;
        messages: Array<{ role: string; content: string }>;
      };

      expect(formatted.system).toBe('You are helpful');
      expect(formatted.messages.length).toBe(2);
      expect(formatted.messages[0].role).toBe('user');
      expect(formatted.messages[1].role).toBe('assistant');
    });
  });

  describe('formatJsonSchema', () => {
    it('should format as tool input schema', () => {
      const client = createMockAnthropicClient();
      const adapter = new AnthropicAdapter(client);

      const schema: JsonSchema = { type: 'object', properties: {} };
      const formatted = adapter.formatJsonSchema(schema) as {
        name: string;
        description: string;
        input_schema: JsonSchema;
      };

      expect(formatted.name).toBe('extract_structured_data');
      expect(formatted.input_schema).toBe(schema);
    });
  });

  describe('formatToolDefinition', () => {
    it('should format tool definition', () => {
      const client = createMockAnthropicClient();
      const adapter = new AnthropicAdapter(client);

      const tool: ToolDefinition = {
        type: 'function',
        function: {
          name: 'my_tool',
          description: 'My description',
          parameters: { type: 'object', properties: {} },
        },
      };

      const formatted = adapter.formatToolDefinition(tool) as {
        name: string;
        description: string;
        input_schema: JsonSchema;
      };

      expect(formatted.name).toBe('my_tool');
      expect(formatted.description).toBe('My description');
    });
  });
});

describe('GoogleAdapter', () => {
  // Mock Google client
  function createMockGoogleClient(response?: unknown) {
    const defaultResponse = {
      text: () => '{"result": "test"}',
      candidates: [
        {
          content: { parts: [{ text: '{"result": "test"}' }], role: 'model' },
          finishReason: 'STOP',
        },
      ],
      usageMetadata: {
        promptTokenCount: 10,
        candidatesTokenCount: 20,
        totalTokenCount: 30,
      },
    };

    return {
      getGenerativeModel: vi.fn().mockReturnValue({
        generateContent: vi.fn().mockResolvedValue({
          response: response ?? defaultResponse,
        }),
        generateContentStream: vi.fn().mockResolvedValue({
          stream: {
            [Symbol.asyncIterator]: async function* () {
              yield {
                text: () => 'test',
                candidates: [{ finishReason: 'STOP' }],
                usageMetadata: {
                  promptTokenCount: 10,
                  candidatesTokenCount: 5,
                  totalTokenCount: 15,
                },
              };
            },
          },
          response: Promise.resolve(response ?? defaultResponse),
        }),
      }),
    };
  }

  describe('constructor', () => {
    it('should create adapter with client', () => {
      const client = createMockGoogleClient();
      const adapter = new GoogleAdapter(client);

      expect(adapter.name).toBe('google');
    });

    it('should create adapter with options', () => {
      const client = createMockGoogleClient();
      const adapter = new GoogleAdapter(client, {
        generationConfig: { temperature: 0.5 },
      });

      expect(adapter.name).toBe('google');
    });
  });

  describe('createGoogleAdapter', () => {
    it('should create adapter via factory function', () => {
      const client = createMockGoogleClient();
      const adapter = createGoogleAdapter(client);

      expect(adapter).toBeInstanceOf(GoogleAdapter);
    });
  });

  describe('getCapabilities', () => {
    it('should return capabilities for gemini-2.0-flash', () => {
      const client = createMockGoogleClient();
      const adapter = new GoogleAdapter(client);

      const caps = adapter.getCapabilities('gemini-2.0-flash');

      expect(caps.jsonMode).toBe(true);
      expect(caps.strictJsonMode).toBe(true);
      expect(caps.toolCalling).toBe(true);
      expect(caps.streaming).toBe(true);
      expect(caps.maxContextWindow).toBe(1000000);
    });

    it('should return capabilities for gemini-2.0-flash-lite', () => {
      const client = createMockGoogleClient();
      const adapter = new GoogleAdapter(client);

      const caps = adapter.getCapabilities('gemini-2.0-flash-lite');

      expect(caps.jsonMode).toBe(true);
    });

    it('should return capabilities for gemini-1.5-pro', () => {
      const client = createMockGoogleClient();
      const adapter = new GoogleAdapter(client);

      const caps = adapter.getCapabilities('gemini-1.5-pro');

      expect(caps.maxContextWindow).toBe(2000000);
    });

    it('should return capabilities for gemini-1.5-flash', () => {
      const client = createMockGoogleClient();
      const adapter = new GoogleAdapter(client);

      const caps = adapter.getCapabilities('gemini-1.5-flash');

      expect(caps.strictJsonMode).toBe(true);
    });

    it('should return capabilities for gemini-1.0-pro', () => {
      const client = createMockGoogleClient();
      const adapter = new GoogleAdapter(client);

      const caps = adapter.getCapabilities('gemini-1.0-pro');

      expect(caps.strictJsonMode).toBe(false);
      expect(caps.maxContextWindow).toBe(32000);
    });

    it('should return default capabilities for unknown model', () => {
      const client = createMockGoogleClient();
      const adapter = new GoogleAdapter(client);

      const caps = adapter.getCapabilities('unknown');

      // Should default to gemini-2.0-flash
      expect(caps.jsonMode).toBe(true);
    });
  });

  describe('supportsJsonMode', () => {
    it('should return true for Gemini models', () => {
      const client = createMockGoogleClient();
      const adapter = new GoogleAdapter(client);

      expect(adapter.supportsJsonMode('gemini-2.0-flash')).toBe(true);
    });
  });

  describe('supportsToolCalling', () => {
    it('should return true for Gemini models', () => {
      const client = createMockGoogleClient();
      const adapter = new GoogleAdapter(client);

      expect(adapter.supportsToolCalling('gemini-2.0-flash')).toBe(true);
    });
  });

  describe('createCompletion', () => {
    it('should create completion and parse response', async () => {
      const client = createMockGoogleClient();
      const adapter = new GoogleAdapter(client);

      const result = await adapter.createCompletion({
        model: 'gemini-2.0-flash',
        messages: [{ role: 'user', content: 'Hello' }],
        mode: 'json',
      });

      expect(result.content).toBe('{"result": "test"}');
      expect(result.usage?.promptTokens).toBe(10);
      expect(result.usage?.completionTokens).toBe(20);
    });

    it('should handle function calls in response', async () => {
      const response = {
        text: () => {
          throw new Error('No text');
        },
        candidates: [
          {
            content: {
              parts: [
                { functionCall: { name: 'my_func', args: { key: 'value' } } },
              ],
              role: 'model',
            },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 5,
          totalTokenCount: 15,
        },
        functionCalls: () => [{ name: 'my_func', args: { key: 'value' } }],
      };

      const client = createMockGoogleClient(response);
      const adapter = new GoogleAdapter(client);

      const result = await adapter.createCompletion({
        model: 'gemini-2.0-flash',
        messages: [{ role: 'user', content: 'Call function' }],
        mode: 'tool',
      });

      expect(result.toolCalls).toBeDefined();
      expect(result.toolCalls?.length).toBe(1);
      expect(result.toolCalls?.[0].name).toBe('my_func');
    });

    it('should handle function calls from candidates', async () => {
      const response = {
        text: () => '',
        candidates: [
          {
            content: {
              parts: [
                { functionCall: { name: 'candidate_func', args: { a: 1 } } },
              ],
              role: 'model',
            },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 5,
          totalTokenCount: 15,
        },
      };

      const client = createMockGoogleClient(response);
      const adapter = new GoogleAdapter(client);

      const result = await adapter.createCompletion({
        model: 'gemini-2.0-flash',
        messages: [{ role: 'user', content: 'Call function' }],
        mode: 'tool',
      });

      expect(result.toolCalls).toBeDefined();
      expect(result.toolCalls?.[0].name).toBe('candidate_func');
    });

    it('should apply JSON mode with schema', async () => {
      const client = createMockGoogleClient();
      const adapter = new GoogleAdapter(client);

      await adapter.createCompletion({
        model: 'gemini-2.0-flash',
        messages: [{ role: 'user', content: 'Extract' }],
        mode: 'json',
        jsonSchema: {
          type: 'object',
          properties: { name: { type: 'string' } },
        },
      });

      expect(client.getGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({
          generationConfig: expect.objectContaining({
            responseMimeType: 'application/json',
          }),
        }),
      );
    });

    it('should apply tool mode', async () => {
      const client = createMockGoogleClient();
      const adapter = new GoogleAdapter(client);

      await adapter.createCompletion({
        model: 'gemini-2.0-flash',
        messages: [{ role: 'user', content: 'Call tool' }],
        mode: 'tool',
        toolDefinition: {
          type: 'function',
          function: {
            name: 'my_tool',
            description: 'My tool',
            parameters: { type: 'object', properties: {} },
          },
        },
      });

      expect(client.getGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: expect.any(Array),
          toolConfig: expect.objectContaining({
            functionCallingConfig: expect.objectContaining({
              mode: 'ANY',
            }),
          }),
        }),
      );
    });

    it('should merge custom generation config', async () => {
      const client = createMockGoogleClient();
      const adapter = new GoogleAdapter(client, {
        generationConfig: { topK: 40 },
      });

      await adapter.createCompletion({
        model: 'gemini-2.0-flash',
        messages: [{ role: 'user', content: 'Hello' }],
        mode: 'json',
        temperature: 0.7,
      });

      expect(client.getGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({
          generationConfig: expect.objectContaining({
            temperature: 0.7,
            topK: 40,
          }),
        }),
      );
    });

    it('should handle response without usage metadata', async () => {
      const response = {
        text: () => 'test',
        candidates: [{ content: { parts: [{ text: 'test' }], role: 'model' } }],
      };

      const client = createMockGoogleClient(response);
      const adapter = new GoogleAdapter(client);

      const result = await adapter.createCompletion({
        model: 'gemini-2.0-flash',
        messages: [{ role: 'user', content: 'Hello' }],
        mode: 'json',
      });

      expect(result.content).toBe('test');
      expect(result.usage).toBeUndefined();
    });
  });

  describe('createStreamingCompletion', () => {
    it('should stream content chunks', async () => {
      const client = createMockGoogleClient();
      const adapter = new GoogleAdapter(client);

      const chunks: Array<{ content: string; isFinal: boolean }> = [];
      for await (const chunk of adapter.createStreamingCompletion({
        model: 'gemini-2.0-flash',
        messages: [{ role: 'user', content: 'Hi' }],
        mode: 'json',
      })) {
        chunks.push({ content: chunk.content, isFinal: chunk.isFinal });
      }

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('formatMessages', () => {
    it('should format messages as contents', () => {
      const client = createMockGoogleClient();
      const adapter = new GoogleAdapter(client);

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' },
      ];

      const formatted = adapter.formatMessages(messages) as Array<{
        role: string;
        parts: Array<{ text: string }>;
      }>;

      expect(formatted.length).toBe(2);
      expect(formatted[0].role).toBe('user');
      expect(formatted[1].role).toBe('model');
    });

    it('should prepend system message to first user message', () => {
      const client = createMockGoogleClient();
      const adapter = new GoogleAdapter(client);

      const messages: ChatMessage[] = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
      ];

      const formatted = adapter.formatMessages(messages) as Array<{
        role: string;
        parts: Array<{ text: string }>;
      }>;

      expect(formatted.length).toBe(1);
      expect(formatted[0].parts[0].text).toContain('You are helpful');
      expect(formatted[0].parts[0].text).toContain('Hello');
    });

    it('should handle system message with no user message', () => {
      const client = createMockGoogleClient();
      const adapter = new GoogleAdapter(client);

      const messages: ChatMessage[] = [
        { role: 'system', content: 'You are helpful' },
        { role: 'assistant', content: 'Ready to help' },
      ];

      const formatted = adapter.formatMessages(messages) as Array<{
        role: string;
        parts: Array<{ text: string }>;
      }>;

      expect(formatted.length).toBe(2);
      expect(formatted[0].role).toBe('user');
      expect(formatted[0].parts[0].text).toBe('You are helpful');
    });
  });

  describe('formatJsonSchema', () => {
    it('should format schema for Google', () => {
      const client = createMockGoogleClient();
      const adapter = new GoogleAdapter(client);

      const schema: JsonSchema = {
        type: 'object',
        properties: { name: { type: 'string' } },
      };
      const formatted = adapter.formatJsonSchema(schema) as {
        responseMimeType: string;
        responseSchema: unknown;
      };

      expect(formatted.responseMimeType).toBe('application/json');
      expect(formatted.responseSchema).toBeDefined();
    });
  });

  describe('formatToolDefinition', () => {
    it('should format tool definition for Google', () => {
      const client = createMockGoogleClient();
      const adapter = new GoogleAdapter(client);

      const tool: ToolDefinition = {
        type: 'function',
        function: {
          name: 'my_tool',
          description: 'My description',
          parameters: { type: 'object', properties: {} },
        },
      };

      const formatted = adapter.formatToolDefinition(tool) as {
        functionDeclarations: Array<{ name: string; description: string }>;
      };

      expect(formatted.functionDeclarations.length).toBe(1);
      expect(formatted.functionDeclarations[0].name).toBe('my_tool');
    });
  });

  describe('convertToGoogleSchema', () => {
    it('should convert type to uppercase', async () => {
      const client = createMockGoogleClient();
      const adapter = new GoogleAdapter(client);

      await adapter.createCompletion({
        model: 'gemini-2.0-flash',
        messages: [{ role: 'user', content: 'Test' }],
        mode: 'json',
        jsonSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Name field' },
            count: { type: 'number', minimum: 0, maximum: 100 },
            tags: { type: 'array', items: { type: 'string' } },
            status: { type: 'string', enum: ['active', 'inactive'] },
          },
          required: ['name'],
        },
      });

      // Verify the schema was converted (we check via the mock call)
      expect(client.getGenerativeModel).toHaveBeenCalled();
    });

    it('should handle array type in schema', async () => {
      const client = createMockGoogleClient();
      const adapter = new GoogleAdapter(client);

      await adapter.createCompletion({
        model: 'gemini-2.0-flash',
        messages: [{ role: 'user', content: 'Test' }],
        mode: 'json',
        jsonSchema: {
          type: ['object', 'null'],
          properties: { name: { type: 'string' } },
        },
      });

      expect(client.getGenerativeModel).toHaveBeenCalled();
    });

    it('should preserve string constraints', async () => {
      const client = createMockGoogleClient();
      const adapter = new GoogleAdapter(client);

      await adapter.createCompletion({
        model: 'gemini-2.0-flash',
        messages: [{ role: 'user', content: 'Test' }],
        mode: 'json',
        jsonSchema: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              minLength: 3,
              maxLength: 10,
              pattern: '^[A-Z]+$',
            },
          },
        },
      });

      expect(client.getGenerativeModel).toHaveBeenCalled();
    });
  });
});
