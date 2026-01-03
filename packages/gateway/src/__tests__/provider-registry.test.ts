import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProviderRegistry } from '../providers/ProviderRegistry.js';
import { Provider } from '../providers/Provider.js';
import type { ProviderConfig, ModelInfo } from '../core/types.js';

// Mock Provider implementation for testing
class MockProvider extends Provider {
  constructor(name: string, models: string[] = ['model-1', 'model-2']) {
    const config: ProviderConfig = {
      name,
      models,
      apiKey: 'test-key',
    };
    super(config);
  }

  async chat(): Promise<any> {
    return {
      id: 'test',
      object: 'chat.completion',
      created: Date.now(),
      model: 'model-1',
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
      model: 'model-1',
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
}

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  describe('register', () => {
    it('should register a provider', () => {
      const provider = new MockProvider('test-provider');
      registry.register(provider);

      expect(registry.get('test-provider')).toBe(provider);
    });

    it('should map models to provider', () => {
      const provider = new MockProvider('test-provider', [
        'model-a',
        'model-b',
      ]);
      registry.register(provider);

      expect(registry.hasModel('model-a')).toBe(true);
      expect(registry.hasModel('model-b')).toBe(true);
    });

    it('should allow multiple providers for same model', () => {
      const provider1 = new MockProvider('provider-1', ['shared-model']);
      const provider2 = new MockProvider('provider-2', ['shared-model']);

      registry.register(provider1);
      registry.register(provider2);

      const providers = registry.getProvidersForModel('shared-model');
      expect(providers).toHaveLength(2);
    });
  });

  describe('unregister', () => {
    it('should unregister a provider', () => {
      const provider = new MockProvider('test-provider');
      registry.register(provider);

      const result = registry.unregister('test-provider');

      expect(result).toBe(true);
      expect(registry.get('test-provider')).toBeUndefined();
    });

    it('should return false for non-existent provider', () => {
      const result = registry.unregister('non-existent');
      expect(result).toBe(false);
    });

    it('should remove model mappings when provider unregistered', () => {
      const provider = new MockProvider('test-provider', ['unique-model']);
      registry.register(provider);
      registry.unregister('test-provider');

      expect(registry.hasModel('unique-model')).toBe(false);
    });

    it('should keep model mappings if other providers support the model', () => {
      const provider1 = new MockProvider('provider-1', ['shared-model']);
      const provider2 = new MockProvider('provider-2', ['shared-model']);

      registry.register(provider1);
      registry.register(provider2);
      registry.unregister('provider-1');

      expect(registry.hasModel('shared-model')).toBe(true);
    });
  });

  describe('get', () => {
    it('should return provider by name', () => {
      const provider = new MockProvider('test-provider');
      registry.register(provider);

      expect(registry.get('test-provider')).toBe(provider);
    });

    it('should return undefined for non-existent provider', () => {
      expect(registry.get('non-existent')).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('should return all registered providers', () => {
      const provider1 = new MockProvider('provider-1');
      const provider2 = new MockProvider('provider-2');

      registry.register(provider1);
      registry.register(provider2);

      const all = registry.getAll();

      expect(all).toHaveLength(2);
      expect(all).toContain(provider1);
      expect(all).toContain(provider2);
    });

    it('should return empty array when no providers registered', () => {
      expect(registry.getAll()).toEqual([]);
    });
  });

  describe('getNames', () => {
    it('should return all provider names', () => {
      registry.register(new MockProvider('provider-1'));
      registry.register(new MockProvider('provider-2'));

      const names = registry.getNames();

      expect(names).toContain('provider-1');
      expect(names).toContain('provider-2');
    });
  });

  describe('getProvidersForModel', () => {
    it('should return providers that support a model', () => {
      const provider1 = new MockProvider('provider-1', ['model-a']);
      const provider2 = new MockProvider('provider-2', ['model-a', 'model-b']);

      registry.register(provider1);
      registry.register(provider2);

      const providers = registry.getProvidersForModel('model-a');

      expect(providers).toHaveLength(2);
    });

    it('should return empty array for unsupported model', () => {
      registry.register(new MockProvider('provider-1', ['model-a']));

      const providers = registry.getProvidersForModel('unsupported-model');

      expect(providers).toEqual([]);
    });
  });

  describe('getProviderForModel', () => {
    it('should return first available provider for a model', () => {
      const provider = new MockProvider('test-provider', ['model-a']);
      registry.register(provider);

      const result = registry.getProviderForModel('model-a');

      expect(result).toBe(provider);
    });

    it('should return undefined for unsupported model', () => {
      registry.register(new MockProvider('test-provider', ['model-a']));

      const result = registry.getProviderForModel('unsupported');

      expect(result).toBeUndefined();
    });
  });

  describe('hasModel', () => {
    it('should return true for supported model', () => {
      registry.register(new MockProvider('test-provider', ['model-a']));

      expect(registry.hasModel('model-a')).toBe(true);
    });

    it('should return false for unsupported model', () => {
      registry.register(new MockProvider('test-provider', ['model-a']));

      expect(registry.hasModel('model-b')).toBe(false);
    });
  });

  describe('getAllModels', () => {
    it('should return all unique models', () => {
      registry.register(new MockProvider('provider-1', ['model-a', 'model-b']));
      registry.register(new MockProvider('provider-2', ['model-b', 'model-c']));

      const models = registry.getAllModels();

      expect(models).toContain('model-a');
      expect(models).toContain('model-b');
      expect(models).toContain('model-c');
    });
  });

  describe('getModelInfo', () => {
    it('should return model info from provider', () => {
      registry.register(new MockProvider('test-provider', ['model-a']));

      const info = registry.getModelInfo('model-a');

      expect(info).not.toBeNull();
      expect(info?.id).toBe('model-a');
      expect(info?.provider).toBe('test-provider');
    });

    it('should return null for unsupported model', () => {
      registry.register(new MockProvider('test-provider', ['model-a']));

      const info = registry.getModelInfo('unsupported');

      expect(info).toBeNull();
    });
  });

  describe('getHealthStatus', () => {
    it('should return health status for all providers', () => {
      registry.register(new MockProvider('provider-1'));
      registry.register(new MockProvider('provider-2'));

      const status = registry.getHealthStatus();

      expect(status['provider-1']).toBeDefined();
      expect(status['provider-2']).toBeDefined();
      expect(status['provider-1'].status).toBe('healthy');
    });
  });

  describe('getHealthyProviders', () => {
    it('should return only healthy providers', () => {
      const provider = new MockProvider('healthy-provider');
      registry.register(provider);

      const healthy = registry.getHealthyProviders();

      expect(healthy).toContain(provider);
    });
  });

  describe('getAvailableProviders', () => {
    it('should return available providers', () => {
      const provider = new MockProvider('available-provider');
      registry.register(provider);

      const available = registry.getAvailableProviders();

      expect(available).toContain(provider);
    });
  });

  describe('size', () => {
    it('should return number of registered providers', () => {
      expect(registry.size).toBe(0);

      registry.register(new MockProvider('provider-1'));
      expect(registry.size).toBe(1);

      registry.register(new MockProvider('provider-2'));
      expect(registry.size).toBe(2);
    });
  });

  describe('constructor with initial providers', () => {
    it('should register initial providers', () => {
      const provider1 = new MockProvider('provider-1');
      const provider2 = new MockProvider('provider-2');

      const reg = new ProviderRegistry([provider1, provider2]);

      expect(reg.size).toBe(2);
      expect(reg.get('provider-1')).toBe(provider1);
      expect(reg.get('provider-2')).toBe(provider2);
    });
  });
});
