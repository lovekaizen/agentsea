import { describe, it, expect, beforeEach } from 'vitest';
import { CostOptimizedStrategy } from '../routing/strategies/CostOptimized.js';
import { ProviderRegistry } from '../providers/ProviderRegistry.js';
import { Provider } from '../providers/Provider.js';
import type {
  ProviderConfig,
  ModelInfo,
  ChatCompletionRequest,
} from '../core/types.js';

// Mock Provider implementation
class MockProvider extends Provider {
  private inputPrice: number;
  private outputPrice: number;
  private isLocalProvider: boolean;

  constructor(
    name: string,
    models: string[] = ['model-1'],
    options: {
      inputPrice?: number;
      outputPrice?: number;
      isLocal?: boolean;
    } = {},
  ) {
    const config: ProviderConfig = {
      name,
      models,
      apiKey: 'test-key',
    };
    super(config);
    this.inputPrice = options.inputPrice ?? 1.0;
    this.outputPrice = options.outputPrice ?? 2.0;
    this.isLocalProvider = options.isLocal ?? false;
  }

  async chat(): Promise<any> {
    return {
      id: 'test',
      object: 'chat.completion',
      created: Date.now(),
      model: this.config.models[0],
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: 'test' },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    };
  }

  async *chatStream(): AsyncGenerator<any> {
    yield {
      id: 'test',
      object: 'chat.completion.chunk',
      created: Date.now(),
      model: this.config.models[0],
      choices: [{ index: 0, delta: { content: 'test' }, finish_reason: null }],
    };
  }

  getModelInfo(model: string): ModelInfo | null {
    if (!this.supportsModel(model)) return null;
    return {
      id: model,
      provider: this.name,
      contextWindow: 4096,
      maxOutputTokens: 1024,
      inputPricePerMillion: this.inputPrice,
      outputPricePerMillion: this.outputPrice,
      capabilities: {
        streaming: true,
        tools: true,
        vision: false,
        json_mode: true,
        system_prompts: true,
      },
    };
  }

  get isLocal(): boolean {
    return this.isLocalProvider;
  }
}

describe('CostOptimizedStrategy', () => {
  let strategy: CostOptimizedStrategy;
  let registry: ProviderRegistry;

  beforeEach(() => {
    strategy = new CostOptimizedStrategy();
    registry = new ProviderRegistry();
  });

  describe('basic routing', () => {
    it('should route to cheapest provider', () => {
      registry.register(
        new MockProvider('expensive', ['model-a'], {
          inputPrice: 10,
          outputPrice: 20,
        }),
      );
      registry.register(
        new MockProvider('cheap', ['model-b'], {
          inputPrice: 0.1,
          outputPrice: 0.2,
        }),
      );

      const request: ChatCompletionRequest = {
        model: 'best',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const decision = strategy.route(request, registry);

      expect(decision.provider).toBe('cheap');
      expect(decision.model).toBe('model-b');
      expect(decision.reason).toContain('Cheapest model');
    });

    it('should throw when no providers available', () => {
      const request: ChatCompletionRequest = {
        model: 'any',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      expect(() => strategy.route(request, registry)).toThrow(
        'No available providers',
      );
    });

    it('should provide alternatives', () => {
      registry.register(
        new MockProvider('provider-1', ['model-a'], {
          inputPrice: 1,
          outputPrice: 2,
        }),
      );
      registry.register(
        new MockProvider('provider-2', ['model-b'], {
          inputPrice: 2,
          outputPrice: 3,
        }),
      );
      registry.register(
        new MockProvider('provider-3', ['model-c'], {
          inputPrice: 3,
          outputPrice: 4,
        }),
      );

      const request: ChatCompletionRequest = {
        model: 'any',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const decision = strategy.route(request, registry);

      expect(decision.alternatives.length).toBeGreaterThan(0);
      expect(decision.alternatives[0].provider).toBeDefined();
      expect(decision.alternatives[0].score).toBeGreaterThan(0);
    });
  });

  describe('quality threshold', () => {
    it('should filter by quality threshold', () => {
      strategy = new CostOptimizedStrategy({ qualityThreshold: 0.8 });

      registry.register(
        new MockProvider('cheap-lowq', ['gpt-3.5-turbo'], {
          inputPrice: 0.1,
          outputPrice: 0.2,
        }),
      );
      registry.register(
        new MockProvider('expensive-highq', ['gpt-4o'], {
          inputPrice: 5,
          outputPrice: 15,
        }),
      );

      const request: ChatCompletionRequest = {
        model: 'any',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const decision = strategy.route(request, registry);

      // Should select the high-quality model despite higher cost
      expect(decision.provider).toBe('expensive-highq');
    });

    it('should use all candidates when none meet quality threshold', () => {
      strategy = new CostOptimizedStrategy({ qualityThreshold: 1.0 });

      registry.register(
        new MockProvider('provider-1', ['model-a'], {
          inputPrice: 1,
          outputPrice: 2,
        }),
      );

      const request: ChatCompletionRequest = {
        model: 'any',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      // Should not throw even though no models meet threshold
      expect(() => strategy.route(request, registry)).not.toThrow();
    });
  });

  describe('local preference', () => {
    it('should prefer local models when enabled', () => {
      strategy = new CostOptimizedStrategy({ preferLocal: true });

      registry.register(
        new MockProvider('ollama', ['llama3'], {
          inputPrice: 0,
          outputPrice: 0,
          isLocal: true,
        }),
      );
      registry.register(
        new MockProvider('openai', ['gpt-4o'], {
          inputPrice: 5,
          outputPrice: 15,
          isLocal: false,
        }),
      );

      const request: ChatCompletionRequest = {
        model: 'any',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const decision = strategy.route(request, registry);

      expect(decision.provider).toBe('ollama');
    });

    it('should not prefer local models when disabled', () => {
      strategy = new CostOptimizedStrategy({ preferLocal: false });

      registry.register(
        new MockProvider('ollama', ['llama3'], {
          inputPrice: 0,
          outputPrice: 0,
          isLocal: true,
        }),
      );
      registry.register(
        new MockProvider('cheap', ['model-x'], {
          inputPrice: 0,
          outputPrice: 0,
          isLocal: false,
        }),
      );

      const request: ChatCompletionRequest = {
        model: 'any',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const decision = strategy.route(request, registry);

      // Both have same cost, should pick first in sorted order
      expect(['ollama', 'cheap']).toContain(decision.provider);
    });
  });

  describe('budget constraints', () => {
    it('should filter by max cost per request', () => {
      registry.register(
        new MockProvider('expensive', ['model-a'], {
          inputPrice: 100,
          outputPrice: 200,
        }),
      );
      registry.register(
        new MockProvider('affordable', ['model-b'], {
          inputPrice: 1,
          outputPrice: 2,
        }),
      );

      const request: ChatCompletionRequest = {
        model: 'any',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const decision = strategy.route(request, registry, { maxCost: 0.01 });

      expect(decision.provider).toBe('affordable');
    });

    it('should throw error when over budget with error fallback', () => {
      strategy = new CostOptimizedStrategy({ fallbackOnBudget: 'error' });

      registry.register(
        new MockProvider('expensive', ['model-a'], {
          inputPrice: 100,
          outputPrice: 200,
        }),
      );

      const request: ChatCompletionRequest = {
        model: 'any',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      expect(() =>
        strategy.route(request, registry, { maxCost: 0.001 }),
      ).toThrow('No models within budget');
    });

    it('should use cheapest when over budget with cheapest fallback', () => {
      strategy = new CostOptimizedStrategy({ fallbackOnBudget: 'cheapest' });

      registry.register(
        new MockProvider('expensive', ['model-a'], {
          inputPrice: 100,
          outputPrice: 200,
        }),
      );

      const request: ChatCompletionRequest = {
        model: 'any',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const decision = strategy.route(request, registry, { maxCost: 0.001 });

      expect(decision.provider).toBe('expensive');
    });

    it('should respect maxCostPerRequest from config', () => {
      strategy = new CostOptimizedStrategy({ maxCostPerRequest: 0.01 });

      registry.register(
        new MockProvider('expensive', ['model-a'], {
          inputPrice: 100,
          outputPrice: 200,
        }),
      );
      registry.register(
        new MockProvider('affordable', ['model-b'], {
          inputPrice: 1,
          outputPrice: 2,
        }),
      );

      const request: ChatCompletionRequest = {
        model: 'any',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const decision = strategy.route(request, registry);

      expect(decision.provider).toBe('affordable');
    });
  });

  describe('excluded providers', () => {
    it('should exclude providers from routing', () => {
      registry.register(
        new MockProvider('excluded', ['model-a'], {
          inputPrice: 1,
          outputPrice: 2,
        }),
      );
      registry.register(
        new MockProvider('allowed', ['model-b'], {
          inputPrice: 2,
          outputPrice: 3,
        }),
      );

      const request: ChatCompletionRequest = {
        model: 'any',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const decision = strategy.route(request, registry, {
        excludeProviders: ['excluded'],
      });

      expect(decision.provider).toBe('allowed');
    });

    it('should throw when all providers excluded', () => {
      registry.register(
        new MockProvider('provider-1', ['model-a'], {
          inputPrice: 1,
          outputPrice: 2,
        }),
      );

      const request: ChatCompletionRequest = {
        model: 'any',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      expect(() =>
        strategy.route(request, registry, { excludeProviders: ['provider-1'] }),
      ).toThrow('No available providers');
    });
  });

  describe('configuration', () => {
    it('should get current configuration', () => {
      const config = {
        preferLocal: true,
        qualityThreshold: 0.7,
        maxCostPerRequest: 0.05,
        fallbackOnBudget: 'cheapest' as const,
      };

      strategy = new CostOptimizedStrategy(config);
      const retrieved = strategy.getConfig();

      expect(retrieved.preferLocal).toBe(true);
      expect(retrieved.qualityThreshold).toBe(0.7);
      expect(retrieved.maxCostPerRequest).toBe(0.05);
      expect(retrieved.fallbackOnBudget).toBe('cheapest');
    });

    it('should update configuration', () => {
      strategy.setConfig({ preferLocal: true });
      expect(strategy.getConfig().preferLocal).toBe(true);

      strategy.setConfig({ qualityThreshold: 0.9 });
      expect(strategy.getConfig().qualityThreshold).toBe(0.9);
      expect(strategy.getConfig().preferLocal).toBe(true); // Should preserve
    });

    it('should use default configuration', () => {
      const config = strategy.getConfig();

      expect(config.preferLocal).toBe(false);
      expect(config.qualityThreshold).toBe(0.6);
      expect(config.fallbackOnBudget).toBe('cheapest');
    });
  });

  describe('cost calculation', () => {
    it('should estimate cost based on message tokens', () => {
      registry.register(
        new MockProvider('provider-1', ['model-a'], {
          inputPrice: 1,
          outputPrice: 2,
        }),
      );

      const shortRequest: ChatCompletionRequest = {
        model: 'any',
        messages: [{ role: 'user', content: 'Hi' }],
      };

      const longRequest: ChatCompletionRequest = {
        model: 'any',
        messages: [
          {
            role: 'user',
            content: 'This is a much longer message that should cost more',
          },
        ],
      };

      const shortDecision = strategy.route(shortRequest, registry);
      const longDecision = strategy.route(longRequest, registry);

      // Both should work but longer one should consider more tokens
      expect(shortDecision.provider).toBeDefined();
      expect(longDecision.provider).toBeDefined();
    });

    it('should consider max_tokens in cost calculation', () => {
      registry.register(
        new MockProvider('provider-1', ['model-a'], {
          inputPrice: 1,
          outputPrice: 2,
        }),
      );

      const request: ChatCompletionRequest = {
        model: 'any',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5000,
      };

      const decision = strategy.route(request, registry);
      expect(decision.provider).toBeDefined();
    });
  });

  describe('model-specific behavior', () => {
    it('should handle known model quality scores', () => {
      registry.register(
        new MockProvider('openai', ['gpt-4o'], {
          inputPrice: 5,
          outputPrice: 15,
        }),
      );
      registry.register(
        new MockProvider('google', ['gemini-1.5-flash'], {
          inputPrice: 0.1,
          outputPrice: 0.2,
        }),
      );

      const request: ChatCompletionRequest = {
        model: 'any',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      // With default quality threshold (0.6), both should pass
      const decision = strategy.route(request, registry);
      expect(['openai', 'google']).toContain(decision.provider);
    });

    it('should handle unknown models with default quality score', () => {
      registry.register(
        new MockProvider('custom', ['unknown-model'], {
          inputPrice: 1,
          outputPrice: 2,
        }),
      );

      const request: ChatCompletionRequest = {
        model: 'any',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const decision = strategy.route(request, registry);
      expect(decision.provider).toBe('custom');
    });
  });

  describe('strategy name', () => {
    it('should have correct name', () => {
      expect(strategy.name).toBe('cost-optimized');
    });
  });
});
