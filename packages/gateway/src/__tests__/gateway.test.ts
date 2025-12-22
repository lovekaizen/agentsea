import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Gateway } from '../core/Gateway.js';
import type { GatewayConfig, ChatCompletionRequest } from '../core/types.js';
import { ValidationError } from '../core/types.js';

// Use vi.hoisted to define the mock factory before vi.mock hoisting
const { createMockProviderInstance, mockChatFns, mockStreamFns } = vi.hoisted(
  () => {
    const mockChatFns = new Map<string, ReturnType<typeof vi.fn>>();
    const mockStreamFns = new Map<string, ReturnType<typeof vi.fn>>();

    return {
      mockChatFns,
      mockStreamFns,
      createMockProviderInstance: (name: string, models: string[]) => {
        const chatFn = vi.fn().mockResolvedValue({
          id: `${name}-test-${Date.now()}`,
          object: 'chat.completion',
          created: Date.now(),
          model: models[0],
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: `Hello from ${name}!` },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        });

        const streamFn = vi.fn().mockImplementation(async function* () {
          yield {
            id: `${name}-stream-${Date.now()}`,
            object: 'chat.completion.chunk',
            created: Date.now(),
            model: models[0],
            choices: [
              { index: 0, delta: { content: 'Hello' }, finish_reason: null },
            ],
          };
          yield {
            id: `${name}-stream-${Date.now()}`,
            object: 'chat.completion.chunk',
            created: Date.now(),
            model: models[0],
            choices: [
              { index: 0, delta: { content: ' World' }, finish_reason: null },
            ],
          };
          yield {
            id: `${name}-stream-${Date.now()}`,
            object: 'chat.completion.chunk',
            created: Date.now(),
            model: models[0],
            choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 5,
              total_tokens: 15,
            },
          };
        });

        mockChatFns.set(name, chatFn);
        mockStreamFns.set(name, streamFn);

        return {
          name,
          config: { name, models, apiKey: 'test-key' },
          models,
          getModels: () => models,
          supportsModel: (model: string) => models.includes(model),
          isHealthy: () => true,
          isAvailable: () => true,
          getHealth: () => ({
            status: 'healthy' as const,
            latencyMs: 10,
            lastCheck: new Date(),
            errorRate: 0,
            consecutiveFailures: 0,
          }),
          healthCheck: async () => ({
            status: 'healthy' as const,
            latencyMs: 10,
            lastCheck: new Date(),
            errorRate: 0,
            consecutiveFailures: 0,
          }),
          getModelInfo: (model: string) => ({
            id: model,
            provider: name,
            contextWindow: 128000,
            maxOutputTokens: 4096,
            inputPricePerMillion: 2.5,
            outputPricePerMillion: 10.0,
            capabilities: {
              streaming: true,
              tools: true,
              vision: true,
              json_mode: true,
              system_prompts: true,
            },
          }),
          chat: chatFn,
          chatStream: streamFn,
        };
      },
    };
  },
);

// Mock the provider modules with .js extension to match Gateway.ts imports
vi.mock('../providers/registry/OpenAIProvider.js', () => ({
  OpenAIProvider: vi
    .fn()
    .mockImplementation((config: any) =>
      createMockProviderInstance(
        'openai',
        config.models || ['gpt-4o', 'gpt-4o-mini'],
      ),
    ),
}));

vi.mock('../providers/registry/AnthropicProvider.js', () => ({
  AnthropicProvider: vi
    .fn()
    .mockImplementation((config: any) =>
      createMockProviderInstance(
        'anthropic',
        config.models || ['claude-3-5-sonnet-20241022'],
      ),
    ),
}));

vi.mock('../providers/registry/GoogleProvider.js', () => ({
  GoogleProvider: vi
    .fn()
    .mockImplementation((config: any) =>
      createMockProviderInstance('google', config.models || ['gemini-1.5-pro']),
    ),
}));

describe('Gateway', () => {
  let gateway: Gateway;
  const baseConfig: GatewayConfig = {
    providers: [
      {
        name: 'openai',
        apiKey: 'test-openai-key',
        models: ['gpt-4o', 'gpt-4o-mini'],
      },
      {
        name: 'anthropic',
        apiKey: 'test-anthropic-key',
        models: ['claude-3-5-sonnet-20241022'],
      },
    ],
    routing: {
      strategy: 'round-robin',
    },
    cache: {
      enabled: true,
      maxEntries: 100,
      ttl: 3600,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockChatFns.clear();
    mockStreamFns.clear();
    gateway = new Gateway(baseConfig);
  });

  afterEach(() => {
    gateway.shutdown();
  });

  describe('constructor', () => {
    it('should initialize with config', () => {
      expect(gateway).toBeInstanceOf(Gateway);
      expect(gateway.getConfig()).toMatchObject(baseConfig);
    });

    it('should register providers from config', () => {
      const registry = gateway.getRegistry();
      expect(registry.size).toBe(2);
      expect(registry.get('openai')).toBeDefined();
      expect(registry.get('anthropic')).toBeDefined();
    });

    it('should create router with configured strategy', () => {
      const router = gateway.getRouter();
      expect(router.getStrategyName()).toBe('round-robin');
    });

    it('should support failover strategy', () => {
      const failoverGateway = new Gateway({
        ...baseConfig,
        routing: {
          strategy: 'failover',
          fallbackChain: ['openai', 'anthropic'],
        },
      });

      expect(failoverGateway.getRouter().getStrategyName()).toBe('failover');
      failoverGateway.shutdown();
    });

    it('should support cost-optimized strategy', () => {
      const costGateway = new Gateway({
        ...baseConfig,
        routing: { strategy: 'cost-optimized' },
      });

      expect(costGateway.getRouter().getStrategyName()).toBe('cost-optimized');
      costGateway.shutdown();
    });

    it('should support latency-optimized strategy', () => {
      const latencyGateway = new Gateway({
        ...baseConfig,
        routing: { strategy: 'latency-optimized' },
      });

      expect(latencyGateway.getRouter().getStrategyName()).toBe(
        'latency-optimized',
      );
      latencyGateway.shutdown();
    });
  });

  describe('chat.completions.create', () => {
    it('should have OpenAI-compatible API structure', () => {
      expect(gateway.chat).toBeDefined();
      expect(gateway.chat.completions).toBeDefined();
      expect(gateway.chat.completions.create).toBeInstanceOf(Function);
    });

    it('should process a basic request', async () => {
      const request: ChatCompletionRequest = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const response = await gateway.chat.completions.create(request);

      expect(response).toBeDefined();
      expect(response).toHaveProperty('id');
      expect(response).toHaveProperty('choices');
      expect(response).toHaveProperty('_gateway');
    });

    it('should include gateway metadata in response', async () => {
      const request: ChatCompletionRequest = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const response = (await gateway.chat.completions.create(request)) as any;

      expect(response._gateway).toBeDefined();
      expect(response._gateway.provider).toBeDefined();
      expect(response._gateway.latencyMs).toBeGreaterThanOrEqual(0);
      expect(typeof response._gateway.cost).toBe('number');
    });
  });

  describe('request validation', () => {
    it('should reject request without model', async () => {
      const request = {
        messages: [{ role: 'user', content: 'Hello' }],
      } as ChatCompletionRequest;

      await expect(gateway.chat.completions.create(request)).rejects.toThrow(
        ValidationError,
      );
    });

    it('should reject request without messages', async () => {
      const request = {
        model: 'gpt-4o',
      } as ChatCompletionRequest;

      await expect(gateway.chat.completions.create(request)).rejects.toThrow(
        ValidationError,
      );
    });

    it('should reject request with empty messages', async () => {
      const request: ChatCompletionRequest = {
        model: 'gpt-4o',
        messages: [],
      };

      await expect(gateway.chat.completions.create(request)).rejects.toThrow(
        ValidationError,
      );
    });

    it('should reject message without role', async () => {
      const request = {
        model: 'gpt-4o',
        messages: [{ content: 'Hello' }],
      } as ChatCompletionRequest;

      await expect(gateway.chat.completions.create(request)).rejects.toThrow(
        ValidationError,
      );
    });

    it('should reject invalid message role', async () => {
      const request = {
        model: 'gpt-4o',
        messages: [{ role: 'invalid', content: 'Hello' }],
      } as ChatCompletionRequest;

      await expect(gateway.chat.completions.create(request)).rejects.toThrow(
        ValidationError,
      );
    });

    it('should accept valid message roles', () => {
      // Test that validation passes for valid roles
      // Note: We only test validation, not the actual request execution
      const roles = ['system', 'user', 'assistant', 'tool'];

      for (const role of roles) {
        const request = {
          model: 'gpt-4o',
          messages: [{ role: role as any, content: 'Hello' }],
        } as ChatCompletionRequest;

        // Validation happens before routing, so we can test the validator directly
        // The gateway validates before trying to route, so validation errors would throw
        // For valid roles, no validation error is thrown
        expect(() => {
          // Access private method via any cast for testing
          (gateway as any).validateRequest(request);
        }).not.toThrow();
      }
    });
  });

  describe('caching', () => {
    it('should cache responses when enabled', async () => {
      const request: ChatCompletionRequest = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Cache test' }],
      };

      const response1 = await gateway.chat.completions.create(request);
      const response2 = (await gateway.chat.completions.create(request)) as any;

      expect(response2._gateway?.cached).toBe(true);
    });

    it('should bypass cache with no-cache policy', async () => {
      const request: ChatCompletionRequest = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'No cache test' }],
        _gateway: { cachePolicy: 'no-cache' },
      };

      await gateway.chat.completions.create(request);
      const response2 = (await gateway.chat.completions.create(request)) as any;

      expect(response2._gateway?.cached).toBeFalsy();
    });

    it('should not cache when caching disabled', async () => {
      const noCacheGateway = new Gateway({
        ...baseConfig,
        cache: { enabled: false },
      });

      const request: ChatCompletionRequest = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Test' }],
      };

      await noCacheGateway.chat.completions.create(request);
      const response2 = (await noCacheGateway.chat.completions.create(
        request,
      )) as any;

      expect(response2._gateway?.cached).toBeFalsy();
      noCacheGateway.shutdown();
    });
  });

  describe('metrics', () => {
    it('should initialize metrics correctly', () => {
      const metrics = gateway.getMetrics();

      expect(metrics.requests).toBeDefined();
      expect(metrics.requests.total).toBe(0);
      expect(metrics.latency).toBeDefined();
      expect(metrics.tokens).toBeDefined();
      expect(metrics.cost).toBeDefined();
      expect(metrics.cache).toBeDefined();
    });

    it('should track request metrics', async () => {
      const request: ChatCompletionRequest = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Metrics test' }],
      };

      await gateway.chat.completions.create(request);
      const metrics = gateway.getMetrics();

      expect(metrics.requests.total).toBeGreaterThan(0);
      expect(metrics.requests.successful).toBeGreaterThan(0);
    });

    it('should track token usage', async () => {
      const request: ChatCompletionRequest = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Token test' }],
      };

      await gateway.chat.completions.create(request);
      const metrics = gateway.getMetrics();

      expect(metrics.tokens.input).toBeGreaterThan(0);
      expect(metrics.tokens.output).toBeGreaterThan(0);
      expect(metrics.tokens.total).toBeGreaterThan(0);
    });

    it('should track cost', async () => {
      const request: ChatCompletionRequest = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Cost test' }],
      };

      await gateway.chat.completions.create(request);
      const metrics = gateway.getMetrics();

      expect(metrics.cost.total).toBeGreaterThanOrEqual(0);
    });

    it('should track cache hit rate', async () => {
      const request: ChatCompletionRequest = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hit rate test' }],
      };

      await gateway.chat.completions.create(request);
      await gateway.chat.completions.create(request);

      const metrics = gateway.getMetrics();
      expect(metrics.cache.hits).toBe(1);
      expect(metrics.cache.misses).toBe(1);
      expect(metrics.cache.hitRate).toBe(0.5);
    });
  });

  describe('events', () => {
    it('should support event emitter interface', () => {
      expect(gateway.on).toBeInstanceOf(Function);
      expect(gateway.emit).toBeInstanceOf(Function);
      expect(gateway.off).toBeInstanceOf(Function);
    });

    it('should emit request:start event', async () => {
      const startHandler = vi.fn();
      gateway.on('request:start', startHandler);

      const request: ChatCompletionRequest = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Event test' }],
      };

      await gateway.chat.completions.create(request);

      expect(startHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: expect.any(String),
          model: 'gpt-4o',
        }),
      );
    });

    it('should emit request:complete event', async () => {
      const completeHandler = vi.fn();
      gateway.on('request:complete', completeHandler);

      const request: ChatCompletionRequest = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Complete test' }],
      };

      await gateway.chat.completions.create(request);

      expect(completeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: expect.any(String),
          provider: expect.any(String),
          model: expect.any(String),
          latencyMs: expect.any(Number),
          cached: expect.any(Boolean),
        }),
      );
    });
  });

  describe('streaming', () => {
    it('should return async generator for streaming requests', async () => {
      const request: ChatCompletionRequest = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Stream test' }],
        stream: true,
      };

      const response = await gateway.chat.completions.create(request);

      expect(response).toBeDefined();
      expect(typeof (response as any)[Symbol.asyncIterator]).toBe('function');
    });

    it('should yield chunks in streaming mode', async () => {
      const request: ChatCompletionRequest = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Stream test' }],
        stream: true,
      };

      const response = (await gateway.chat.completions.create(
        request,
      )) as AsyncGenerator;
      const chunks: any[] = [];

      for await (const chunk of response) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]).toHaveProperty('choices');
    });
  });

  describe('health check', () => {
    it('should check health of all providers', async () => {
      const health = await gateway.checkHealth();

      expect(health).toBeDefined();
      expect(typeof health).toBe('object');
    });
  });

  describe('shutdown', () => {
    it('should shut down gracefully', () => {
      expect(() => gateway.shutdown()).not.toThrow();
    });
  });

  describe('unknown provider handling', () => {
    it('should skip unknown provider types', () => {
      const gatewayWithUnknown = new Gateway({
        providers: [
          { name: 'openai', apiKey: 'test', models: ['gpt-4o'] },
          {
            name: 'unknown-provider' as any,
            apiKey: 'test',
            models: ['model-x'],
          },
        ],
        routing: { strategy: 'round-robin' },
      });

      // Should only have openai registered
      expect(gatewayWithUnknown.getRegistry().size).toBe(1);
      expect(gatewayWithUnknown.getRegistry().get('openai')).toBeDefined();
      gatewayWithUnknown.shutdown();
    });
  });
});
