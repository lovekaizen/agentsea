import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import {
  StructuredClient,
  createStructuredClient,
} from '../core/StructuredClient.js';
import type {
  ProviderAdapter,
  ProviderCapabilities,
  ProviderRequest,
  ProviderResponse,
  ProviderStreamChunk,
} from '../types/provider.types.js';
import type { ChatMessage } from '../types/core.types.js';
import type { JsonSchema, ToolDefinition } from '../types/schema.types.js';

// Mock provider factory
function createMockProvider(
  overrides: Partial<ProviderAdapter> = {},
): ProviderAdapter {
  return {
    name: 'mock',
    getCapabilities: vi.fn().mockReturnValue({
      jsonMode: true,
      strictJsonMode: true,
      toolCalling: true,
      streaming: true,
      systemMessages: true,
      maxContextWindow: 128000,
      maxOutputTokens: 4096,
    } as ProviderCapabilities),
    supportsJsonMode: vi.fn().mockReturnValue(true),
    supportsToolCalling: vi.fn().mockReturnValue(true),
    createCompletion: vi.fn().mockResolvedValue({
      content: '{"name": "John", "age": 30}',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      finishReason: 'stop',
    } as ProviderResponse),
    createStreamingCompletion: vi.fn(),
    formatMessages: vi.fn().mockImplementation((msgs) => msgs),
    formatJsonSchema: vi.fn().mockImplementation((schema) => schema),
    formatToolDefinition: vi.fn().mockImplementation((tool) => tool),
    ...overrides,
  };
}

// Test schemas
const userSchema = z.object({
  name: z.string(),
  age: z.number(),
});

const complexSchema = z.object({
  title: z.string(),
  items: z.array(
    z.object({
      id: z.number(),
      value: z.string(),
    }),
  ),
  metadata: z
    .object({
      created: z.string(),
      version: z.number(),
    })
    .optional(),
});

describe('StructuredClient', () => {
  let mockProvider: ProviderAdapter;
  let client: StructuredClient;

  beforeEach(() => {
    mockProvider = createMockProvider();
    client = new StructuredClient(mockProvider);
  });

  describe('constructor', () => {
    it('should create client with default config', () => {
      expect(client).toBeInstanceOf(StructuredClient);
    });

    it('should accept custom config', () => {
      const customClient = new StructuredClient(mockProvider, {
        defaultMode: 'tool',
        enableFixHints: false,
        validatePartials: true,
      });
      expect(customClient).toBeInstanceOf(StructuredClient);
    });

    it('should accept custom retry config', () => {
      const customClient = new StructuredClient(mockProvider, {
        defaultRetry: {
          maxAttempts: 5,
          initialDelay: 500,
        },
      });
      expect(customClient).toBeInstanceOf(StructuredClient);
    });
  });

  describe('extract', () => {
    it('should extract valid data successfully', async () => {
      const result = await client.extract({
        model: 'gpt-5.5',
        messages: [{ role: 'user', content: 'Get user data' }],
        response_format: userSchema,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'John', age: 30 });
    });

    it('should include metadata in result', async () => {
      const result = await client.extract({
        model: 'gpt-5.5',
        messages: [{ role: 'user', content: 'Get user data' }],
        response_format: userSchema,
      });

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.totalAttempts).toBe(1);
      expect(result.metadata?.model).toBe('gpt-5.5');
      expect(result.metadata?.tokenUsage).toBeDefined();
    });

    it('should include raw response', async () => {
      const result = await client.extract({
        model: 'gpt-5.5',
        messages: [{ role: 'user', content: 'Get user data' }],
        response_format: userSchema,
      });

      expect(result.raw).toBeDefined();
    });

    it('should call provider with correct parameters', async () => {
      await client.extract({
        model: 'gpt-5.5',
        messages: [{ role: 'user', content: 'Get user data' }],
        response_format: userSchema,
      });

      expect(mockProvider.createCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-5.5',
          mode: 'json',
        }),
      );
    });

    it('should use specified extraction mode', async () => {
      await client.extract({
        model: 'gpt-5.5',
        messages: [{ role: 'user', content: 'Get user data' }],
        response_format: userSchema,
        mode: 'tool',
      });

      expect(mockProvider.createCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'tool',
        }),
      );
    });

    it('should handle tool mode with tool calls response', async () => {
      const toolProvider = createMockProvider({
        createCompletion: vi.fn().mockResolvedValue({
          content: '',
          toolCalls: [
            {
              id: 'call_1',
              name: 'extract_data',
              arguments: '{"name": "Jane", "age": 25}',
            },
          ],
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        }),
      });

      const toolClient = new StructuredClient(toolProvider);
      const result = await toolClient.extract({
        model: 'gpt-5.5',
        messages: [{ role: 'user', content: 'Get user data' }],
        response_format: userSchema,
        mode: 'tool',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'Jane', age: 25 });
    });

    it('should handle prompt mode', async () => {
      await client.extract({
        model: 'gpt-5.5',
        messages: [{ role: 'user', content: 'Get user data' }],
        response_format: userSchema,
        mode: 'prompt',
      });

      expect(mockProvider.createCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'prompt',
        }),
      );
    });

    it('should handle hybrid mode', async () => {
      await client.extract({
        model: 'gpt-5.5',
        messages: [{ role: 'user', content: 'Get user data' }],
        response_format: userSchema,
        mode: 'hybrid',
      });

      expect(mockProvider.createCompletion).toHaveBeenCalled();
    });

    it('should extract JSON from code blocks', async () => {
      const codeBlockProvider = createMockProvider({
        createCompletion: vi.fn().mockResolvedValue({
          content:
            'Here is the data:\n```json\n{"name": "Alice", "age": 28}\n```',
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        }),
      });

      const codeBlockClient = new StructuredClient(codeBlockProvider);
      const result = await codeBlockClient.extract({
        model: 'gpt-5.5',
        messages: [{ role: 'user', content: 'Get user data' }],
        response_format: userSchema,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'Alice', age: 28 });
    });

    it('should extract JSON from text with surrounding content', async () => {
      const mixedProvider = createMockProvider({
        createCompletion: vi.fn().mockResolvedValue({
          content: 'The result is {"name": "Bob", "age": 35} as requested.',
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        }),
      });

      const mixedClient = new StructuredClient(mixedProvider);
      const result = await mixedClient.extract({
        model: 'gpt-5.5',
        messages: [{ role: 'user', content: 'Get user data' }],
        response_format: userSchema,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'Bob', age: 35 });
    });

    it('should handle complex schemas', async () => {
      const complexProvider = createMockProvider({
        createCompletion: vi.fn().mockResolvedValue({
          content: JSON.stringify({
            title: 'Test',
            items: [
              { id: 1, value: 'a' },
              { id: 2, value: 'b' },
            ],
            metadata: { created: '2024-01-01', version: 1 },
          }),
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        }),
      });

      const complexClient = new StructuredClient(complexProvider);
      const result = await complexClient.extract({
        model: 'gpt-5.5',
        messages: [{ role: 'user', content: 'Get complex data' }],
        response_format: complexSchema,
      });

      expect(result.success).toBe(true);
      expect(result.data?.title).toBe('Test');
      expect(result.data?.items).toHaveLength(2);
    });
  });

  describe('validation and retry', () => {
    it('should return error for invalid data', async () => {
      const invalidProvider = createMockProvider({
        createCompletion: vi.fn().mockResolvedValue({
          content: '{"name": "John", "age": "not a number"}',
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        }),
      });

      const invalidClient = new StructuredClient(invalidProvider, {
        defaultRetry: { maxAttempts: 1 },
      });

      const result = await invalidClient.extract({
        model: 'gpt-5.5',
        messages: [{ role: 'user', content: 'Get user data' }],
        response_format: userSchema,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should retry on validation error', async () => {
      const retryProvider = createMockProvider({
        createCompletion: vi
          .fn()
          .mockResolvedValueOnce({
            content: '{"name": "John", "age": "invalid"}',
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
          })
          .mockResolvedValueOnce({
            content: '{"name": "John", "age": 30}',
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
          }),
      });

      const retryClient = new StructuredClient(retryProvider, {
        defaultRetry: { maxAttempts: 3, retryOn: ['validation_error'] },
      });

      const result = await retryClient.extract({
        model: 'gpt-5.5',
        messages: [{ role: 'user', content: 'Get user data' }],
        response_format: userSchema,
      });

      expect(result.success).toBe(true);
      expect(retryProvider.createCompletion).toHaveBeenCalledTimes(2);
    });

    it('should retry on parse error', async () => {
      const parseErrorProvider = createMockProvider({
        createCompletion: vi
          .fn()
          .mockResolvedValueOnce({
            content: 'not valid json',
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
          })
          .mockResolvedValueOnce({
            content: '{"name": "John", "age": 30}',
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
          }),
      });

      const parseClient = new StructuredClient(parseErrorProvider, {
        defaultRetry: { maxAttempts: 3, retryOn: ['parse_error'] },
      });

      const result = await parseClient.extract({
        model: 'gpt-5.5',
        messages: [{ role: 'user', content: 'Get user data' }],
        response_format: userSchema,
      });

      expect(result.success).toBe(true);
      expect(parseErrorProvider.createCompletion).toHaveBeenCalledTimes(2);
    });

    it('should respect max attempts', async () => {
      const failProvider = createMockProvider({
        createCompletion: vi.fn().mockResolvedValue({
          content: '{"invalid": "data"}',
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        }),
      });

      const failClient = new StructuredClient(failProvider, {
        defaultRetry: { maxAttempts: 3, retryOn: ['validation_error'] },
      });

      const result = await failClient.extract({
        model: 'gpt-5.5',
        messages: [{ role: 'user', content: 'Get user data' }],
        response_format: userSchema,
      });

      expect(result.success).toBe(false);
      expect(failProvider.createCompletion).toHaveBeenCalledTimes(3);
      expect(result.metadata?.totalAttempts).toBe(3);
    });

    it('should add fix hints on retry when enabled', async () => {
      const hintProvider = createMockProvider({
        createCompletion: vi
          .fn()
          .mockResolvedValueOnce({
            content: '{"name": "John"}', // Missing age
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
          })
          .mockResolvedValueOnce({
            content: '{"name": "John", "age": 30}',
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
          }),
      });

      const hintClient = new StructuredClient(hintProvider, {
        enableFixHints: true,
        defaultRetry: { maxAttempts: 3, retryOn: ['validation_error'] },
      });

      await hintClient.extract({
        model: 'gpt-5.5',
        messages: [{ role: 'user', content: 'Get user data' }],
        response_format: userSchema,
      });

      // Second call should have additional message with hints
      const secondCall = (
        hintProvider.createCompletion as ReturnType<typeof vi.fn>
      ).mock.calls[1];
      expect(secondCall[0].messages.length).toBeGreaterThan(1);
    });

    it('should handle provider errors', async () => {
      const errorProvider = createMockProvider({
        createCompletion: vi.fn().mockRejectedValue(new Error('API Error')),
      });

      const errorClient = new StructuredClient(errorProvider, {
        defaultRetry: { maxAttempts: 1 },
      });

      const result = await errorClient.extract({
        model: 'gpt-5.5',
        messages: [{ role: 'user', content: 'Get user data' }],
        response_format: userSchema,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('API Error');
    });

    it('should retry on rate limit errors', async () => {
      const rateLimitProvider = createMockProvider({
        createCompletion: vi
          .fn()
          .mockRejectedValueOnce(new Error('Rate limit exceeded (429)'))
          .mockResolvedValueOnce({
            content: '{"name": "John", "age": 30}',
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
          }),
      });

      const rateLimitClient = new StructuredClient(rateLimitProvider, {
        defaultRetry: {
          maxAttempts: 3,
          retryOn: ['rate_limit'],
          initialDelay: 10,
        },
      });

      const result = await rateLimitClient.extract({
        model: 'gpt-5.5',
        messages: [{ role: 'user', content: 'Get user data' }],
        response_format: userSchema,
      });

      expect(result.success).toBe(true);
      expect(rateLimitProvider.createCompletion).toHaveBeenCalledTimes(2);
    });
  });

  describe('events', () => {
    it('should emit extraction:start event', async () => {
      const startHandler = vi.fn();
      client.on('extraction:start', startHandler);

      await client.extract({
        model: 'gpt-5.5',
        messages: [{ role: 'user', content: 'Get user data' }],
        response_format: userSchema,
      });

      expect(startHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: expect.any(String),
          mode: 'json',
        }),
      );
    });

    it('should emit extraction:attempt event', async () => {
      const attemptHandler = vi.fn();
      client.on('extraction:attempt', attemptHandler);

      await client.extract({
        model: 'gpt-5.5',
        messages: [{ role: 'user', content: 'Get user data' }],
        response_format: userSchema,
      });

      expect(attemptHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: expect.any(String),
          attempt: 1,
          mode: 'json',
        }),
      );
    });

    it('should emit extraction:success event on success', async () => {
      const successHandler = vi.fn();
      client.on('extraction:success', successHandler);

      await client.extract({
        model: 'gpt-5.5',
        messages: [{ role: 'user', content: 'Get user data' }],
        response_format: userSchema,
      });

      expect(successHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { name: 'John', age: 30 },
          attempts: 1,
        }),
      );
    });

    it('should emit validation:failed event on validation failure', async () => {
      const validationHandler = vi.fn();

      const invalidProvider = createMockProvider({
        createCompletion: vi.fn().mockResolvedValue({
          content: '{"name": 123}',
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        }),
      });

      const invalidClient = new StructuredClient(invalidProvider, {
        defaultRetry: { maxAttempts: 1 },
      });
      invalidClient.on('validation:failed', validationHandler);

      await invalidClient.extract({
        model: 'gpt-5.5',
        messages: [{ role: 'user', content: 'Get user data' }],
        response_format: userSchema,
      });

      expect(validationHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.any(Array),
        }),
      );
    });

    it('should emit extraction:error event on provider error', async () => {
      const errorHandler = vi.fn();

      const errorProvider = createMockProvider({
        createCompletion: vi
          .fn()
          .mockRejectedValue(new Error('Provider error')),
      });

      const errorClient = new StructuredClient(errorProvider, {
        defaultRetry: { maxAttempts: 1 },
      });
      errorClient.on('extraction:error', errorHandler);

      await errorClient.extract({
        model: 'gpt-5.5',
        messages: [{ role: 'user', content: 'Get user data' }],
        response_format: userSchema,
      });

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(Error),
          attempt: 1,
        }),
      );
    });

    it('should emit extraction:retry event on retry', async () => {
      const retryHandler = vi.fn();

      const retryProvider = createMockProvider({
        createCompletion: vi
          .fn()
          .mockResolvedValueOnce({
            content: '{"invalid": true}',
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
          })
          .mockResolvedValueOnce({
            content: '{"name": "John", "age": 30}',
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
          }),
      });

      const retryClient = new StructuredClient(retryProvider, {
        defaultRetry: { maxAttempts: 3, retryOn: ['validation_error'] },
      });
      retryClient.on('extraction:retry', retryHandler);

      await retryClient.extract({
        model: 'gpt-5.5',
        messages: [{ role: 'user', content: 'Get user data' }],
        response_format: userSchema,
      });

      expect(retryHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          attempt: 1,
          reason: 'validation_error',
        }),
      );
    });
  });

  describe('getProviderCapabilities', () => {
    it('should return provider capabilities', () => {
      const caps = client.getProviderCapabilities('gpt-5.5');

      expect(caps.jsonMode).toBe(true);
      expect(caps.toolCalling).toBe(true);
      expect(mockProvider.getCapabilities).toHaveBeenCalledWith('gpt-5.5');
    });
  });

  describe('supportsMode', () => {
    it('should check json mode support', () => {
      expect(client.supportsMode('json', 'gpt-5.5')).toBe(true);
    });

    it('should check tool mode support', () => {
      expect(client.supportsMode('tool', 'gpt-5.5')).toBe(true);
    });

    it('should always support prompt mode', () => {
      expect(client.supportsMode('prompt', 'gpt-5.5')).toBe(true);
    });

    it('should check hybrid mode support', () => {
      expect(client.supportsMode('hybrid', 'gpt-5.5')).toBe(true);
    });

    it('should return false for unsupported modes on limited models', () => {
      const limitedProvider = createMockProvider({
        getCapabilities: vi.fn().mockReturnValue({
          jsonMode: false,
          toolCalling: false,
          streaming: false,
          systemMessages: false,
        }),
      });

      const limitedClient = new StructuredClient(limitedProvider);
      expect(limitedClient.supportsMode('json', 'o1-preview')).toBe(false);
      expect(limitedClient.supportsMode('tool', 'o1-preview')).toBe(false);
    });
  });

  describe('createStructuredClient factory', () => {
    it('should create client instance', () => {
      const factoryClient = createStructuredClient(mockProvider);
      expect(factoryClient).toBeInstanceOf(StructuredClient);
    });

    it('should accept config', () => {
      const factoryClient = createStructuredClient(mockProvider, {
        defaultMode: 'tool',
      });
      expect(factoryClient).toBeInstanceOf(StructuredClient);
    });
  });

  describe('edge cases', () => {
    it('should handle empty response', async () => {
      const emptyProvider = createMockProvider({
        createCompletion: vi.fn().mockResolvedValue({
          content: '',
          usage: { promptTokens: 10, completionTokens: 0, totalTokens: 10 },
        }),
      });

      const emptyClient = new StructuredClient(emptyProvider, {
        defaultRetry: { maxAttempts: 1 },
      });

      const result = await emptyClient.extract({
        model: 'gpt-5.5',
        messages: [{ role: 'user', content: 'Get user data' }],
        response_format: userSchema,
      });

      expect(result.success).toBe(false);
    });

    it('should handle null content in response', async () => {
      const nullProvider = createMockProvider({
        createCompletion: vi.fn().mockResolvedValue({
          content: null,
          usage: { promptTokens: 10, completionTokens: 0, totalTokens: 10 },
        }),
      });

      const nullClient = new StructuredClient(nullProvider, {
        defaultRetry: { maxAttempts: 1 },
      });

      const result = await nullClient.extract({
        model: 'gpt-5.5',
        messages: [{ role: 'user', content: 'Get user data' }],
        response_format: userSchema,
      });

      expect(result.success).toBe(false);
    });

    it('should handle messages with system prompt', async () => {
      await client.extract({
        model: 'gpt-5.5',
        messages: [
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: 'Get user data' },
        ],
        response_format: userSchema,
        mode: 'prompt',
      });

      expect(mockProvider.createCompletion).toHaveBeenCalled();
    });

    it('should handle tool call with invalid JSON arguments', async () => {
      const badToolProvider = createMockProvider({
        createCompletion: vi.fn().mockResolvedValue({
          content: '',
          toolCalls: [
            {
              id: 'call_1',
              name: 'extract_data',
              arguments: 'not valid json',
            },
          ],
        }),
      });

      const badToolClient = new StructuredClient(badToolProvider, {
        defaultRetry: { maxAttempts: 1 },
      });

      const result = await badToolClient.extract({
        model: 'gpt-5.5',
        messages: [{ role: 'user', content: 'Get user data' }],
        response_format: userSchema,
        mode: 'tool',
      });

      expect(result.success).toBe(false);
    });

    it('should accumulate token usage across retries', async () => {
      const multiRetryProvider = createMockProvider({
        createCompletion: vi
          .fn()
          .mockResolvedValueOnce({
            content: '{"invalid": true}',
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
          })
          .mockResolvedValueOnce({
            content: '{"name": "John", "age": 30}',
            usage: { promptTokens: 15, completionTokens: 25, totalTokens: 40 },
          }),
      });

      const multiClient = new StructuredClient(multiRetryProvider, {
        defaultRetry: { maxAttempts: 3, retryOn: ['validation_error'] },
      });

      const result = await multiClient.extract({
        model: 'gpt-5.5',
        messages: [{ role: 'user', content: 'Get user data' }],
        response_format: userSchema,
      });

      expect(result.metadata?.tokenUsage?.totalTokens).toBe(70); // 30 + 40
    });
  });
});
