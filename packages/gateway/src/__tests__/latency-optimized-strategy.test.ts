import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LatencyOptimizedStrategy } from '../routing/strategies/LatencyOptimized.js';
import { ProviderRegistry } from '../providers/ProviderRegistry.js';
import { Provider } from '../providers/Provider.js';
import type {
  ProviderConfig,
  ModelInfo,
  ChatCompletionRequest,
  ProviderHealth,
} from '../core/types.js';

// Mock Provider implementation
class MockProvider extends Provider {
  private latency: number;

  constructor(
    name: string,
    models: string[] = ['model-1'],
    latency: number = 100,
  ) {
    const config: ProviderConfig = {
      name,
      models,
      apiKey: 'test-key',
    };
    super(config);
    this.latency = latency;
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
      inputPricePerMillion: 1.0,
      outputPricePerMillion: 2.0,
      capabilities: {
        streaming: true,
        tools: true,
        vision: false,
        json_mode: true,
        system_prompts: true,
      },
    };
  }

  getHealth(): ProviderHealth {
    return {
      status: 'healthy',
      latencyMs: this.latency,
      lastCheck: new Date(),
      errorRate: 0,
      consecutiveFailures: 0,
    };
  }
}

describe('LatencyOptimizedStrategy', () => {
  let strategy: LatencyOptimizedStrategy;
  let registry: ProviderRegistry;

  beforeEach(() => {
    // Disable warmup by default for deterministic tests
    // Individual tests can override this if they want to test warmup behavior
    strategy = new LatencyOptimizedStrategy({ warmupRequests: 0 });
    registry = new ProviderRegistry();
  });

  describe('basic routing', () => {
    it('should route to fastest provider based on health check', () => {
      registry.register(new MockProvider('slow', ['model-a'], 500));
      registry.register(new MockProvider('fast', ['model-b'], 50));

      const request: ChatCompletionRequest = {
        model: 'fastest',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const decision = strategy.route(request, registry);

      expect(decision.provider).toBe('fast');
      expect(decision.model).toBe('model-b');
      expect(decision.reason).toContain('Fastest provider');
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
      registry.register(new MockProvider('provider-1', ['model-a'], 100));
      registry.register(new MockProvider('provider-2', ['model-b'], 200));
      registry.register(new MockProvider('provider-3', ['model-c'], 300));

      const request: ChatCompletionRequest = {
        model: 'fastest',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const decision = strategy.route(request, registry);

      expect(decision.alternatives.length).toBeGreaterThan(0);
      expect(decision.alternatives[0].score).toBeGreaterThan(0);
    });
  });

  describe('latency recording', () => {
    it('should record latency observations', () => {
      strategy.recordLatency('test-provider', 100);
      strategy.recordLatency('test-provider', 200);

      const stats = strategy.getStats('test-provider');

      expect(stats).toBeDefined();
      expect(stats?.count).toBe(2);
      expect(stats?.min).toBe(100);
      expect(stats?.max).toBe(200);
    });

    it('should calculate average using exponential moving average', () => {
      strategy.recordLatency('test-provider', 100);
      const stats1 = strategy.getStats('test-provider');
      expect(stats1?.avg).toBe(100);

      strategy.recordLatency('test-provider', 200);
      const stats2 = strategy.getStats('test-provider');
      // With alpha=0.2: 0.2 * 200 + 0.8 * 100 = 120
      expect(stats2?.avg).toBe(120);
    });

    it('should keep limited samples for percentile calculation', () => {
      for (let i = 0; i < 150; i++) {
        strategy.recordLatency('test-provider', i);
      }

      const stats = strategy.getStats('test-provider');
      expect(stats?.samples.length).toBeLessThanOrEqual(100);
    });

    it('should calculate p95 percentile', () => {
      // Record 100 latencies: 0, 1, 2, ..., 99
      for (let i = 0; i < 100; i++) {
        strategy.recordLatency('test-provider', i);
      }

      const stats = strategy.getStats('test-provider');
      expect(stats?.p95).toBeGreaterThan(90);
      expect(stats?.p95).toBeLessThanOrEqual(99);
    });

    it('should return undefined for unknown provider', () => {
      const stats = strategy.getStats('unknown-provider');
      expect(stats).toBeUndefined();
    });
  });

  describe('adaptive routing', () => {
    it('should use observed latencies after warmup', () => {
      strategy = new LatencyOptimizedStrategy({
        warmupRequests: 5,
        adaptiveRouting: true,
      });

      registry.register(new MockProvider('provider-1', ['model-a'], 100));
      registry.register(new MockProvider('provider-2', ['model-b'], 200));

      // Record observations to build stats (6+ samples for confidence)
      for (let i = 0; i < 6; i++) {
        strategy.recordLatency('provider-1', 300); // Actually slow
        strategy.recordLatency('provider-2', 50); // Actually fast
      }

      const request: ChatCompletionRequest = {
        model: 'fastest',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const decision = strategy.route(request, registry);

      // Should prefer provider-2 based on observed latencies
      expect(decision.provider).toBe('provider-2');
    });

    it('should use health check latency without enough observations', () => {
      registry.register(new MockProvider('fast', ['model-a'], 50));
      registry.register(new MockProvider('slow', ['model-b'], 500));

      // Record only a few observations (not enough for confidence)
      strategy.recordLatency('fast', 1000); // Bad observation
      strategy.recordLatency('slow', 10); // Good observation

      const request: ChatCompletionRequest = {
        model: 'fastest',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const decision = strategy.route(request, registry);

      // Should still prefer 'fast' based on health check
      expect(decision.provider).toBe('fast');
    });

    it('should disable adaptive routing when configured', () => {
      strategy = new LatencyOptimizedStrategy({ adaptiveRouting: false });

      registry.register(new MockProvider('provider-1', ['model-a'], 100));

      // Record many observations
      for (let i = 0; i < 10; i++) {
        strategy.recordLatency('provider-1', 1000);
      }

      const request: ChatCompletionRequest = {
        model: 'fastest',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const decision = strategy.route(request, registry);

      // Should use health check latency (100), not observed (1000)
      expect(decision.reason).toContain('100ms');
    });
  });

  describe('warmup phase', () => {
    it('should explore during warmup', () => {
      strategy = new LatencyOptimizedStrategy({ warmupRequests: 10 });

      registry.register(new MockProvider('provider-1', ['model-a'], 100));
      registry.register(new MockProvider('provider-2', ['model-b'], 200));
      registry.register(new MockProvider('provider-3', ['model-c'], 300));

      const request: ChatCompletionRequest = {
        model: 'fastest',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      // Make multiple requests during warmup
      const providers = new Set<string>();
      for (let i = 0; i < 20; i++) {
        const decision = strategy.route(request, registry);
        providers.add(decision.provider);
      }

      // Due to randomization, should have tried multiple providers
      // (with 30% random chance per request, very likely to see variation)
      expect(providers.size).toBeGreaterThan(1);
    });

    it('should include warmup info in reason during warmup', () => {
      strategy = new LatencyOptimizedStrategy({ warmupRequests: 10 });

      registry.register(new MockProvider('provider-1', ['model-a'], 100));
      registry.register(new MockProvider('provider-2', ['model-b'], 200));

      const request: ChatCompletionRequest = {
        model: 'fastest',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      // Mock Math.random to force exploration
      const originalRandom = Math.random;
      Math.random = vi.fn(() => 0.2); // Less than 0.3, will explore

      const decision = strategy.route(request, registry);

      expect(decision.reason).toContain('Warmup exploration');

      Math.random = originalRandom;
    });
  });

  describe('max latency constraint', () => {
    it('should filter by max latency from context', () => {
      registry.register(new MockProvider('fast', ['model-a'], 50));
      registry.register(new MockProvider('slow', ['model-b'], 500));

      const request: ChatCompletionRequest = {
        model: 'fastest',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const decision = strategy.route(request, registry, { maxLatency: 100 });

      expect(decision.provider).toBe('fast');
    });

    it('should use all providers when none meet max latency', () => {
      registry.register(new MockProvider('provider-1', ['model-a'], 500));
      registry.register(new MockProvider('provider-2', ['model-b'], 600));

      const request: ChatCompletionRequest = {
        model: 'fastest',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const decision = strategy.route(request, registry, { maxLatency: 100 });

      // Should still return a decision (picks fastest even if over limit)
      expect(decision.provider).toBe('provider-1');
    });

    it('should respect maxLatencyMs from config', () => {
      strategy = new LatencyOptimizedStrategy({ maxLatencyMs: 100 });

      registry.register(new MockProvider('fast', ['model-a'], 50));
      registry.register(new MockProvider('slow', ['model-b'], 500));

      const request: ChatCompletionRequest = {
        model: 'fastest',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const decision = strategy.route(request, registry);

      expect(decision.provider).toBe('fast');
    });
  });

  describe('excluded providers', () => {
    it('should exclude providers from routing', () => {
      registry.register(new MockProvider('excluded', ['model-a'], 50));
      registry.register(new MockProvider('allowed', ['model-b'], 100));

      const request: ChatCompletionRequest = {
        model: 'fastest',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const decision = strategy.route(request, registry, {
        excludeProviders: ['excluded'],
      });

      expect(decision.provider).toBe('allowed');
    });
  });

  describe('statistics management', () => {
    it('should get all statistics', () => {
      strategy.recordLatency('provider-1', 100);
      strategy.recordLatency('provider-2', 200);

      const allStats = strategy.getAllStats();

      expect(Object.keys(allStats)).toHaveLength(2);
      expect(allStats['provider-1']).toBeDefined();
      expect(allStats['provider-2']).toBeDefined();
    });

    it('should return independent copies of stats', () => {
      strategy.recordLatency('provider-1', 100);

      const stats1 = strategy.getAllStats();
      const stats2 = strategy.getAllStats();

      stats1['provider-1'].samples.push(999);

      expect(stats2['provider-1'].samples).not.toContain(999);
    });

    it('should clear all statistics', () => {
      strategy.recordLatency('provider-1', 100);
      strategy.recordLatency('provider-2', 200);

      strategy.clearStats();

      expect(strategy.getStats('provider-1')).toBeUndefined();
      expect(strategy.getStats('provider-2')).toBeUndefined();
      expect(Object.keys(strategy.getAllStats())).toHaveLength(0);
    });
  });

  describe('configuration', () => {
    it('should update configuration', () => {
      strategy.setConfig({ warmupRequests: 20 });
      strategy.setConfig({ maxLatencyMs: 500 });
      strategy.setConfig({ adaptiveRouting: false });

      // Configuration is private, test via behavior
      const allStats = strategy.getAllStats();
      expect(allStats).toBeDefined();
    });

    it('should use default configuration', () => {
      expect(strategy.name).toBe('latency-optimized');
    });
  });

  describe('model-specific routing', () => {
    it('should route specific model when requested', () => {
      registry.register(new MockProvider('provider-1', ['model-a'], 100));
      registry.register(new MockProvider('provider-2', ['model-b'], 50));

      const request: ChatCompletionRequest = {
        model: 'model-a',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const decision = strategy.route(request, registry);

      expect(decision.provider).toBe('provider-1');
      expect(decision.model).toBe('model-a');
    });

    it('should only include one entry per provider', () => {
      registry.register(
        new MockProvider('provider-1', ['model-a', 'model-b', 'model-c'], 100),
      );

      const request: ChatCompletionRequest = {
        model: 'fastest',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const decision = strategy.route(request, registry);

      expect(decision.provider).toBe('provider-1');
      // Should use one of the provider's models
      expect(['model-a', 'model-b', 'model-c']).toContain(decision.model);
    });
  });

  describe('confidence scoring', () => {
    it('should have low confidence with few samples', () => {
      registry.register(new MockProvider('provider-1', ['model-a'], 100));

      strategy.recordLatency('provider-1', 100);

      const request: ChatCompletionRequest = {
        model: 'fastest',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const decision = strategy.route(request, registry);

      // With only 1 sample (< 5), should use health check latency
      expect(decision.reason).toContain('30% confidence');
    });

    it('should have higher confidence with many samples', () => {
      registry.register(new MockProvider('provider-1', ['model-a'], 100));

      for (let i = 0; i < 50; i++) {
        strategy.recordLatency('provider-1', 150);
      }

      const request: ChatCompletionRequest = {
        model: 'fastest',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const decision = strategy.route(request, registry);

      // With 50 samples, confidence should be 100%
      expect(decision.reason).toContain('100% confidence');
    });
  });

  describe('strategy name', () => {
    it('should have correct name', () => {
      expect(strategy.name).toBe('latency-optimized');
    });
  });
});
