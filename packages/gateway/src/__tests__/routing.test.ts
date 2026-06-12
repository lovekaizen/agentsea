import { describe, it, expect, beforeEach } from 'vitest';
import { RoundRobinStrategy } from '../routing/strategies/RoundRobin.js';
import { FailoverStrategy } from '../routing/strategies/Failover.js';
import { Router, VIRTUAL_MODELS } from '../routing/Router.js';
import { ProviderRegistry } from '../providers/ProviderRegistry.js';
import { Provider } from '../providers/Provider.js';
import type {
  ProviderConfig,
  ModelInfo,
  ChatCompletionRequest,
} from '../core/types.js';

// Mock Provider implementation
class MockProvider extends Provider {
  private _isHealthy: boolean = true;

  constructor(
    name: string,
    models: string[] = ['model-1'],
    options: { inputPrice?: number; outputPrice?: number } = {},
  ) {
    const config: ProviderConfig = {
      name,
      models,
      apiKey: 'test-key',
    };
    super(config);
    this._inputPrice = options.inputPrice ?? 1.0;
    this._outputPrice = options.outputPrice ?? 2.0;
  }

  private _inputPrice: number;
  private _outputPrice: number;

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
      inputPricePerMillion: this._inputPrice,
      outputPricePerMillion: this._outputPrice,
      capabilities: {
        streaming: true,
        tools: true,
        vision: false,
        json_mode: true,
        system_prompts: true,
      },
    };
  }

  setHealthy(healthy: boolean) {
    this._isHealthy = healthy;
  }

  isHealthy(): boolean {
    return this._isHealthy;
  }

  isAvailable(): boolean {
    return this._isHealthy;
  }
}

describe('RoundRobinStrategy', () => {
  let strategy: RoundRobinStrategy;
  let registry: ProviderRegistry;

  beforeEach(() => {
    strategy = new RoundRobinStrategy();
    registry = new ProviderRegistry();
  });

  it('should distribute requests across providers', () => {
    registry.register(new MockProvider('provider-1', ['model-a']));
    registry.register(new MockProvider('provider-2', ['model-a']));

    const request: ChatCompletionRequest = {
      model: 'model-a',
      messages: [{ role: 'user', content: 'test' }],
    };

    const decision1 = strategy.route(request, registry);
    const decision2 = strategy.route(request, registry);

    // Should alternate between providers
    expect([decision1.provider, decision2.provider]).toContain('provider-1');
    expect([decision1.provider, decision2.provider]).toContain('provider-2');
  });

  it('should skip unavailable providers', () => {
    const provider1 = new MockProvider('provider-1', ['model-a']);
    const provider2 = new MockProvider('provider-2', ['model-a']);
    provider1.setHealthy(false);

    registry.register(provider1);
    registry.register(provider2);

    const request: ChatCompletionRequest = {
      model: 'model-a',
      messages: [{ role: 'user', content: 'test' }],
    };

    const decision = strategy.route(request, registry);

    expect(decision.provider).toBe('provider-2');
  });

  it('should throw when no providers available', () => {
    const request: ChatCompletionRequest = {
      model: 'model-a',
      messages: [{ role: 'user', content: 'test' }],
    };

    expect(() => strategy.route(request, registry)).toThrow(
      'No available providers',
    );
  });

  it('should respect preferred provider', () => {
    registry.register(new MockProvider('provider-1', ['model-a']));
    registry.register(new MockProvider('provider-2', ['model-a']));

    const request: ChatCompletionRequest = {
      model: 'model-a',
      messages: [{ role: 'user', content: 'test' }],
    };

    const decision = strategy.route(request, registry, {
      preferredProvider: 'provider-2',
    });

    expect(decision.provider).toBe('provider-2');
  });

  it('should respect excluded providers', () => {
    registry.register(new MockProvider('provider-1', ['model-a']));
    registry.register(new MockProvider('provider-2', ['model-a']));

    const request: ChatCompletionRequest = {
      model: 'model-a',
      messages: [{ role: 'user', content: 'test' }],
    };

    const decision = strategy.route(request, registry, {
      excludeProviders: ['provider-1'],
    });

    expect(decision.provider).toBe('provider-2');
  });

  it('should support weighted distribution', () => {
    const weightedStrategy = new RoundRobinStrategy({
      weights: { 'provider-1': 2, 'provider-2': 1 },
    });

    registry.register(new MockProvider('provider-1', ['model-a']));
    registry.register(new MockProvider('provider-2', ['model-a']));

    const request: ChatCompletionRequest = {
      model: 'model-a',
      messages: [{ role: 'user', content: 'test' }],
    };

    // With weights 2:1, provider-1 should appear twice as often
    const results: string[] = [];
    for (let i = 0; i < 6; i++) {
      results.push(weightedStrategy.route(request, registry).provider);
    }

    const provider1Count = results.filter((p) => p === 'provider-1').length;
    const provider2Count = results.filter((p) => p === 'provider-2').length;

    // Due to weighting, provider-1 should have more selections
    expect(provider1Count).toBeGreaterThan(provider2Count);
  });

  it('should reset rotation index', () => {
    registry.register(new MockProvider('provider-1', ['model-a']));
    registry.register(new MockProvider('provider-2', ['model-a']));

    const request: ChatCompletionRequest = {
      model: 'model-a',
      messages: [{ role: 'user', content: 'test' }],
    };

    const decision1 = strategy.route(request, registry);
    strategy.reset();
    const decision2 = strategy.route(request, registry);

    expect(decision1.provider).toBe(decision2.provider);
  });
});

describe('FailoverStrategy', () => {
  let strategy: FailoverStrategy;
  let registry: ProviderRegistry;

  beforeEach(() => {
    strategy = new FailoverStrategy({
      chain: ['provider-1', 'provider-2', 'provider-3'],
    });
    registry = new ProviderRegistry();
  });

  it('should route to first provider in chain', () => {
    registry.register(new MockProvider('provider-1', ['model-a']));
    registry.register(new MockProvider('provider-2', ['model-a']));

    const request: ChatCompletionRequest = {
      model: 'model-a',
      messages: [{ role: 'user', content: 'test' }],
    };

    const decision = strategy.route(request, registry);

    expect(decision.provider).toBe('provider-1');
  });

  it('should failover to next provider when first is unhealthy', () => {
    const provider1 = new MockProvider('provider-1', ['model-a']);
    const provider2 = new MockProvider('provider-2', ['model-a']);
    provider1.setHealthy(false);

    registry.register(provider1);
    registry.register(provider2);

    const request: ChatCompletionRequest = {
      model: 'model-a',
      messages: [{ role: 'user', content: 'test' }],
    };

    const decision = strategy.route(request, registry);

    expect(decision.provider).toBe('provider-2');
  });

  it('should skip previously attempted providers', () => {
    registry.register(new MockProvider('provider-1', ['model-a']));
    registry.register(new MockProvider('provider-2', ['model-a']));
    registry.register(new MockProvider('provider-3', ['model-a']));

    const request: ChatCompletionRequest = {
      model: 'model-a',
      messages: [{ role: 'user', content: 'test' }],
    };

    const decision = strategy.route(request, registry, {
      previousAttempts: [{ provider: 'provider-1', model: 'model-a' }],
    });

    expect(decision.provider).toBe('provider-2');
  });

  it('should throw when all providers exhausted', () => {
    const provider1 = new MockProvider('provider-1', ['model-a']);
    const provider2 = new MockProvider('provider-2', ['model-a']);
    provider1.setHealthy(false);
    provider2.setHealthy(false);

    registry.register(provider1);
    registry.register(provider2);

    const request: ChatCompletionRequest = {
      model: 'model-a',
      messages: [{ role: 'user', content: 'test' }],
    };

    expect(() => strategy.route(request, registry)).toThrow('exhausted');
  });

  it('should provide alternatives in decision', () => {
    registry.register(new MockProvider('provider-1', ['model-a']));
    registry.register(new MockProvider('provider-2', ['model-a']));
    registry.register(new MockProvider('provider-3', ['model-a']));

    const request: ChatCompletionRequest = {
      model: 'model-a',
      messages: [{ role: 'user', content: 'test' }],
    };

    const decision = strategy.route(request, registry);

    expect(decision.alternatives.length).toBeGreaterThan(0);
    expect(decision.alternatives.map((a) => a.provider)).toContain(
      'provider-2',
    );
  });

  it('should get next provider in chain', () => {
    expect(strategy.getNextProvider('provider-1')).toBe('provider-2');
    expect(strategy.getNextProvider('provider-2')).toBe('provider-3');
    expect(strategy.getNextProvider('provider-3')).toBeNull();
    expect(strategy.getNextProvider('unknown')).toBeNull();
  });

  it('should get and set chain', () => {
    expect(strategy.getChain()).toEqual([
      'provider-1',
      'provider-2',
      'provider-3',
    ]);

    strategy.setChain(['new-1', 'new-2']);
    expect(strategy.getChain()).toEqual(['new-1', 'new-2']);
  });
});

describe('Router', () => {
  let router: Router;
  let registry: ProviderRegistry;

  beforeEach(() => {
    const strategy = new RoundRobinStrategy();
    router = new Router(strategy);
    registry = new ProviderRegistry();
  });

  it('should route using the configured strategy', () => {
    registry.register(new MockProvider('provider-1', ['model-a']));

    const request: ChatCompletionRequest = {
      model: 'model-a',
      messages: [{ role: 'user', content: 'test' }],
    };

    const decision = router.route(request, registry);

    expect(decision.provider).toBe('provider-1');
    expect(decision.model).toBe('model-a');
  });

  it('should identify virtual models', () => {
    expect(router.isVirtualModel('best')).toBe(true);
    expect(router.isVirtualModel('cheapest')).toBe(true);
    expect(router.isVirtualModel('fastest')).toBe(true);
    expect(router.isVirtualModel('gpt-5.5')).toBe(false);
  });

  it('should route "cheapest" to lowest cost provider', () => {
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
      model: 'cheapest',
      messages: [{ role: 'user', content: 'test' }],
    };

    const decision = router.route(request, registry);

    expect(decision.provider).toBe('cheap');
  });

  it('should change strategy', () => {
    const newStrategy = new FailoverStrategy({ chain: ['provider-1'] });
    router.setStrategy(newStrategy);

    expect(router.getStrategyName()).toBe('failover');
  });

  it('should get fallback chain', () => {
    const chain = router.getFallbackChain();
    expect(Array.isArray(chain)).toBe(true);
  });

  it('should get equivalent models', () => {
    const equivalents = router.getEquivalentModels('gpt-5.5');
    expect(Array.isArray(equivalents)).toBe(true);
  });
});

describe('VIRTUAL_MODELS', () => {
  it('should contain expected virtual models', () => {
    expect(VIRTUAL_MODELS).toContain('best');
    expect(VIRTUAL_MODELS).toContain('cheapest');
    expect(VIRTUAL_MODELS).toContain('fastest');
  });
});
