/**
 * Tests for AgentSea StructuredProvider
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import {
  StructuredProvider,
  TypedExtractor,
  createStructuredProvider,
  Extractors,
} from '../integrations/agentsea/StructuredProvider.js';
import type { ProviderStreamChunk } from '../types/provider.types.js';

// Mock provider clients
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
                  content: '{"name":"Alice","age":30}',
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

function createMockAnthropicClient(response?: unknown) {
  return {
    messages: {
      create: vi.fn().mockResolvedValue(
        response ?? {
          id: 'msg_123',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: '{"name":"Bob","age":25}' }],
          model: 'claude-3-5-sonnet-20241022',
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 20 },
        },
      ),
    },
  };
}

function createMockGoogleClient(response?: unknown) {
  const defaultResponse = {
    text: () => '{"name":"Charlie","age":35}',
    candidates: [
      {
        content: {
          parts: [{ text: '{"name":"Charlie","age":35}' }],
          role: 'model',
        },
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
      generateContent: vi
        .fn()
        .mockResolvedValue({ response: response ?? defaultResponse }),
      generateContentStream: vi.fn().mockResolvedValue({
        stream: {
          [Symbol.asyncIterator]: async function* () {
            yield {
              text: () => '{"name":"Charlie"}',
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

function createStreamingMockOpenAIClient() {
  const streamChunks = [
    {
      id: 'chatcmpl-123',
      choices: [{ delta: { content: '{"name":"Alice"' }, finish_reason: null }],
    },
    {
      id: 'chatcmpl-123',
      choices: [{ delta: { content: ',"age":30}' }, finish_reason: null }],
    },
    {
      id: 'chatcmpl-123',
      choices: [{ delta: {}, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    },
  ];

  return {
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
}

describe('StructuredProvider', () => {
  const PersonSchema = z.object({
    name: z.string(),
    age: z.number(),
  });

  describe('constructor', () => {
    it('should create provider with default options', () => {
      const provider = new StructuredProvider();

      expect(provider).toBeInstanceOf(StructuredProvider);
    });

    it('should create provider with custom options', () => {
      const provider = new StructuredProvider({
        defaultModel: 'gpt-4o-mini',
        enableFixHints: false,
        maxRetries: 5,
      });

      expect(provider).toBeInstanceOf(StructuredProvider);
    });
  });

  describe('createStructuredProvider', () => {
    it('should create provider via factory function', () => {
      const provider = createStructuredProvider();

      expect(provider).toBeInstanceOf(StructuredProvider);
    });

    it('should pass options to constructor', () => {
      const provider = createStructuredProvider({ maxRetries: 10 });

      expect(provider).toBeInstanceOf(StructuredProvider);
    });
  });

  describe('registerProvider', () => {
    it('should register OpenAI provider', () => {
      const provider = new StructuredProvider();

      const result = provider.registerProvider('main', {
        provider: 'openai',
        client: createMockOpenAIClient(),
      });

      expect(result).toBe(provider); // Chainable
    });

    it('should register Anthropic provider', () => {
      const provider = new StructuredProvider();

      provider.registerProvider('claude', {
        provider: 'anthropic',
        client: createMockAnthropicClient(),
      });

      const client = provider.getClient('claude');
      expect(client).toBeDefined();
    });

    it('should register Google provider', () => {
      const provider = new StructuredProvider();

      provider.registerProvider('gemini', {
        provider: 'google',
        client: createMockGoogleClient(),
      });

      const client = provider.getClient('gemini');
      expect(client).toBeDefined();
    });

    it('should set first provider as default', () => {
      const provider = new StructuredProvider();

      provider.registerProvider('first', {
        provider: 'openai',
        client: createMockOpenAIClient(),
      });

      const client = provider.getClient(); // No name = default
      expect(client).toBeDefined();
    });

    it('should allow setting explicit default', () => {
      const provider = new StructuredProvider();

      provider
        .registerProvider('first', {
          provider: 'openai',
          client: createMockOpenAIClient(),
        })
        .registerProvider(
          'second',
          {
            provider: 'anthropic',
            client: createMockAnthropicClient(),
          },
          true, // Set as default
        );

      // Default should be 'second' now
      const client = provider.getClient();
      expect(client).toBeDefined();
    });

    it('should throw for unsupported provider type', () => {
      const provider = new StructuredProvider();

      expect(() =>
        provider.registerProvider('unknown', {
          provider: 'unsupported' as 'openai',
          client: {},
        }),
      ).toThrow('Unsupported provider: unsupported');
    });
  });

  describe('getClient', () => {
    it('should get client by name', () => {
      const provider = new StructuredProvider();

      provider.registerProvider('test', {
        provider: 'openai',
        client: createMockOpenAIClient(),
      });

      const client = provider.getClient('test');
      expect(client).toBeDefined();
    });

    it('should get default client', () => {
      const provider = new StructuredProvider();

      provider.registerProvider('default', {
        provider: 'openai',
        client: createMockOpenAIClient(),
      });

      const client = provider.getClient();
      expect(client).toBeDefined();
    });

    it('should throw if no provider registered', () => {
      const provider = new StructuredProvider();

      expect(() => provider.getClient()).toThrow('No provider registered');
    });

    it('should throw if provider not found', () => {
      const provider = new StructuredProvider();

      provider.registerProvider('exists', {
        provider: 'openai',
        client: createMockOpenAIClient(),
      });

      expect(() => provider.getClient('nonexistent')).toThrow(
        "Provider 'nonexistent' not found",
      );
    });
  });

  describe('extract', () => {
    it('should extract with string prompt', async () => {
      const provider = new StructuredProvider();

      provider.registerProvider('main', {
        provider: 'openai',
        client: createMockOpenAIClient(),
      });

      const result = await provider.extract(
        PersonSchema,
        'Extract person info',
      );

      expect(result.data.name).toBe('Alice');
      expect(result.data.age).toBe(30);
    });

    it('should extract with message array', async () => {
      const provider = new StructuredProvider();

      provider.registerProvider('main', {
        provider: 'openai',
        client: createMockOpenAIClient(),
      });

      const result = await provider.extract(PersonSchema, [
        { role: 'system', content: 'Extract person info' },
        { role: 'user', content: 'John is 25 years old' },
      ]);

      expect(result.data).toBeDefined();
    });

    it('should use specified model', async () => {
      const mockClient = createMockOpenAIClient();
      const provider = new StructuredProvider();

      provider.registerProvider('main', {
        provider: 'openai',
        client: mockClient,
      });

      await provider.extract(PersonSchema, 'Test', { model: 'gpt-4o-mini' });

      expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gpt-4o-mini' }),
      );
    });

    it('should use default model from options', async () => {
      const mockClient = createMockOpenAIClient();
      const provider = new StructuredProvider({ defaultModel: 'gpt-4' });

      provider.registerProvider('main', {
        provider: 'openai',
        client: mockClient,
      });

      await provider.extract(PersonSchema, 'Test');

      expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gpt-4' }),
      );
    });

    it('should extract from specific provider', async () => {
      const openaiClient = createMockOpenAIClient();
      const anthropicClient = createMockAnthropicClient();
      const provider = new StructuredProvider();

      provider
        .registerProvider('openai', {
          provider: 'openai',
          client: openaiClient,
        })
        .registerProvider('anthropic', {
          provider: 'anthropic',
          client: anthropicClient,
        });

      // Extract from anthropic specifically
      const result = await provider.extract(PersonSchema, 'Test', {
        provider: 'anthropic',
      });

      expect(anthropicClient.messages.create).toHaveBeenCalled();
      expect(openaiClient.chat.completions.create).not.toHaveBeenCalled();
    });

    it('should use fallback model when no model specified', async () => {
      const mockClient = createMockOpenAIClient();
      const provider = new StructuredProvider(); // No default model

      provider.registerProvider('main', {
        provider: 'openai',
        client: mockClient,
      });

      await provider.extract(PersonSchema, 'Test');

      // Should fallback to gpt-4o
      expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
        }),
      );
    });
  });

  describe('extractStream', () => {
    it('should return streaming result', async () => {
      const provider = new StructuredProvider();

      provider.registerProvider('main', {
        provider: 'openai',
        client: createStreamingMockOpenAIClient(),
      });

      const stream = await provider.extractStream(
        PersonSchema,
        'Extract person',
      );

      expect(stream).toBeDefined();
      expect(typeof stream.final).toBe('function');
    });

    it('should extract with streaming options', async () => {
      const provider = new StructuredProvider();

      provider.registerProvider('main', {
        provider: 'openai',
        client: createStreamingMockOpenAIClient(),
      });

      const partials: unknown[] = [];
      const stream = await provider.extractStream(
        PersonSchema,
        'Extract person',
        {
          streaming: {
            yieldPartials: true,
            onPartial: (partial) => partials.push(partial),
          },
        },
      );

      await stream.final();

      // Stream should complete
      expect(stream.isComplete).toBe(true);
    });

    it('should accept message array', async () => {
      const provider = new StructuredProvider();

      provider.registerProvider('main', {
        provider: 'openai',
        client: createStreamingMockOpenAIClient(),
      });

      const stream = await provider.extractStream(PersonSchema, [
        { role: 'user', content: 'Alice is 30' },
      ]);

      expect(stream).toBeDefined();
    });
  });

  describe('createExtractor', () => {
    it('should create typed extractor', () => {
      const provider = new StructuredProvider();

      provider.registerProvider('main', {
        provider: 'openai',
        client: createMockOpenAIClient(),
      });

      const extractor = provider.createExtractor(PersonSchema);

      expect(extractor).toBeInstanceOf(TypedExtractor);
    });

    it('should create extractor with options', () => {
      const provider = new StructuredProvider();

      provider.registerProvider('main', {
        provider: 'openai',
        client: createMockOpenAIClient(),
      });

      const extractor = provider.createExtractor(PersonSchema, {
        model: 'gpt-4',
        provider: 'main',
      });

      expect(extractor).toBeInstanceOf(TypedExtractor);
    });
  });
});

describe('TypedExtractor', () => {
  const TestSchema = z.object({
    value: z.string(),
  });

  function createProviderWithOpenAI() {
    const provider = new StructuredProvider();
    const mockClient = createMockOpenAIClient({
      id: 'chatcmpl-123',
      choices: [
        {
          message: { role: 'assistant', content: '{"value":"test"}' },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    });

    provider.registerProvider('main', {
      provider: 'openai',
      client: mockClient,
    });

    return { provider, mockClient };
  }

  describe('extract', () => {
    it('should extract with string prompt', async () => {
      const { provider } = createProviderWithOpenAI();
      const extractor = provider.createExtractor(TestSchema);

      const result = await extractor.extract('Get value');

      expect(result.data.value).toBe('test');
    });

    it('should extract with message array', async () => {
      const { provider } = createProviderWithOpenAI();
      const extractor = provider.createExtractor(TestSchema);

      const result = await extractor.extract([
        { role: 'user', content: 'Get value' },
      ]);

      expect(result.data.value).toBe('test');
    });

    it('should allow override options', async () => {
      const { provider, mockClient } = createProviderWithOpenAI();
      const extractor = provider.createExtractor(TestSchema, {
        model: 'gpt-4',
      });

      await extractor.extract('Test', { model: 'gpt-4o-mini' });

      // Override should take precedence
      expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gpt-4o-mini' }),
      );
    });
  });

  describe('extractStream', () => {
    it('should return streaming result', async () => {
      const provider = new StructuredProvider();

      provider.registerProvider('main', {
        provider: 'openai',
        client: createStreamingMockOpenAIClient(),
      });

      const extractor = provider.createExtractor(
        z.object({ name: z.string(), age: z.number() }),
      );
      const stream = await extractor.extractStream('Get person');

      expect(stream).toBeDefined();
      expect(typeof stream.final).toBe('function');
    });
  });

  describe('getSchema', () => {
    it('should return the schema', () => {
      const { provider } = createProviderWithOpenAI();
      const extractor = provider.createExtractor(TestSchema);

      const schema = extractor.getSchema();

      expect(schema).toBe(TestSchema);
    });
  });
});

describe('Extractors', () => {
  describe('list', () => {
    it('should create array schema', () => {
      const itemSchema = z.string();
      const listSchema = Extractors.list(itemSchema);

      expect(listSchema.safeParse(['a', 'b']).success).toBe(true);
    });

    it('should support minItems', () => {
      const listSchema = Extractors.list(z.string(), { minItems: 2 });

      expect(listSchema.safeParse(['a']).success).toBe(false);
      expect(listSchema.safeParse(['a', 'b']).success).toBe(true);
    });

    it('should support maxItems', () => {
      const listSchema = Extractors.list(z.string(), { maxItems: 2 });

      expect(listSchema.safeParse(['a', 'b', 'c']).success).toBe(false);
      expect(listSchema.safeParse(['a', 'b']).success).toBe(true);
    });

    it('should support both minItems and maxItems', () => {
      const listSchema = Extractors.list(z.string(), {
        minItems: 1,
        maxItems: 3,
      });

      expect(listSchema.safeParse([]).success).toBe(false);
      expect(listSchema.safeParse(['a']).success).toBe(true);
      expect(listSchema.safeParse(['a', 'b', 'c', 'd']).success).toBe(false);
    });
  });

  describe('entity', () => {
    it('should create object schema', () => {
      const entitySchema = Extractors.entity({
        name: z.string(),
        age: z.number(),
      });

      const result = entitySchema.safeParse({ name: 'Alice', age: 30 });
      expect(result.success).toBe(true);
    });
  });

  describe('classification', () => {
    it('should create classification schema', () => {
      const schema = Extractors.classification(['spam', 'not_spam'] as const);

      const result = schema.safeParse({ category: 'spam' });
      expect(result.success).toBe(true);
    });

    it('should create classification with confidence', () => {
      const schema = Extractors.classification(
        ['positive', 'negative'] as const,
        {
          confidence: true,
        },
      );

      const result = schema.safeParse({
        category: 'positive',
        confidence: 0.95,
        reasoning: 'Test reasoning',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid confidence', () => {
      const schema = Extractors.classification(['a', 'b'] as const, {
        confidence: true,
      });

      expect(schema.safeParse({ category: 'a', confidence: 1.5 }).success).toBe(
        false,
      );
      expect(
        schema.safeParse({ category: 'a', confidence: -0.1 }).success,
      ).toBe(false);
    });
  });

  describe('sentiment', () => {
    it('should create sentiment schema', () => {
      const schema = Extractors.sentiment();

      const result = schema.safeParse({
        sentiment: 'positive',
        score: 0.8,
      });
      expect(result.success).toBe(true);
    });

    it('should accept sentiment with aspects', () => {
      const schema = Extractors.sentiment();

      const result = schema.safeParse({
        sentiment: 'mixed',
        score: 0.2,
        aspects: [
          { aspect: 'price', sentiment: 'positive' },
          { aspect: 'service', sentiment: 'negative' },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid score', () => {
      const schema = Extractors.sentiment();

      expect(
        schema.safeParse({ sentiment: 'positive', score: 2 }).success,
      ).toBe(false);
      expect(
        schema.safeParse({ sentiment: 'positive', score: -2 }).success,
      ).toBe(false);
    });
  });

  describe('keyValue', () => {
    it('should create record schema', () => {
      const schema = Extractors.keyValue();

      const result = schema.safeParse({
        key1: 'value1',
        key2: 123,
        key3: { nested: true },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('summary', () => {
    it('should create summary schema', () => {
      const schema = Extractors.summary();

      const result = schema.safeParse({
        summary: 'This is a summary',
        keyPoints: ['Point 1', 'Point 2'],
      });
      expect(result.success).toBe(true);
    });

    it('should accept entities in summary', () => {
      const schema = Extractors.summary();

      const result = schema.safeParse({
        summary: 'Summary text',
        keyPoints: ['Key point'],
        entities: [
          { name: 'Alice', type: 'person' },
          { name: 'Acme Corp', type: 'organization' },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should enforce maxLength', () => {
      const schema = Extractors.summary({ maxLength: 10 });

      const result = schema.safeParse({
        summary: 'This is a very long summary that exceeds the limit',
        keyPoints: [],
      });
      expect(result.success).toBe(false);
    });

    it('should pass with maxLength respected', () => {
      const schema = Extractors.summary({ maxLength: 100 });

      const result = schema.safeParse({
        summary: 'Short summary',
        keyPoints: ['point'],
      });
      expect(result.success).toBe(true);
    });
  });
});
