/**
 * ModelPricingRegistry Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ModelPricingRegistry } from '../pricing/ModelPricingRegistry.js';
import type { ModelPricing } from '../types/index.js';

describe('ModelPricingRegistry', () => {
  let registry: ModelPricingRegistry;

  beforeEach(() => {
    registry = new ModelPricingRegistry();
  });

  describe('initialization', () => {
    it('should load default pricing', () => {
      const models = registry.listModels();

      expect(models.length).toBeGreaterThan(0);
    });

    it('should list multiple providers', () => {
      const providers = registry.listProviders();

      expect(providers).toContain('anthropic');
      expect(providers).toContain('openai');
      expect(providers).toContain('google');
    });

    it('should accept custom pricing', () => {
      const customPricing: ModelPricing = {
        model: 'custom-model',
        provider: 'custom',
        inputPricePerMillion: 1.0,
        outputPricePerMillion: 2.0,
        currency: 'USD',
      };

      registry = new ModelPricingRegistry({
        customPricing: [customPricing],
      });

      const pricing = registry.getPricing('custom', 'custom-model');
      expect(pricing).toBeDefined();
      expect(pricing?.inputPricePerMillion).toBe(1.0);
    });
  });

  describe('registerModel', () => {
    it('should register new model', () => {
      const pricing: ModelPricing = {
        model: 'test-model',
        provider: 'openai',
        inputPricePerMillion: 1.0,
        outputPricePerMillion: 2.0,
        currency: 'USD',
      };

      registry.registerModel(pricing);

      const result = registry.getPricing('openai', 'test-model');
      expect(result).toBeDefined();
    });

    it('should update existing model', () => {
      const pricing: ModelPricing = {
        model: 'gpt-4o',
        provider: 'openai',
        inputPricePerMillion: 99.0,
        outputPricePerMillion: 99.0,
        currency: 'USD',
      };

      registry.registerModel(pricing);

      const result = registry.getPricing('openai', 'gpt-4o');
      expect(result?.inputPricePerMillion).toBe(99.0);
    });

    it('should set effective date', () => {
      const pricing: ModelPricing = {
        model: 'test-model',
        provider: 'openai',
        inputPricePerMillion: 1.0,
        outputPricePerMillion: 2.0,
        currency: 'USD',
      };

      registry.registerModel(pricing);

      const result = registry.getPricing('openai', 'test-model');
      expect(result?.effectiveDate).toBeInstanceOf(Date);
    });
  });

  describe('getPricing', () => {
    it('should get pricing for known model', () => {
      const pricing = registry.getPricing('openai', 'gpt-4o');

      expect(pricing).toBeDefined();
      expect(pricing?.model).toBe('gpt-4o');
      expect(pricing?.provider).toBe('openai');
    });

    it('should return null for unknown model', () => {
      const pricing = registry.getPricing('openai', 'unknown-model');

      expect(pricing).toBeNull();
    });

    it('should get Anthropic model pricing', () => {
      const pricing = registry.getPricing(
        'anthropic',
        'claude-3-5-sonnet-20241022',
      );

      expect(pricing).toBeDefined();
      expect(pricing?.inputPricePerMillion).toBe(3.0);
      expect(pricing?.outputPricePerMillion).toBe(15.0);
    });
  });

  describe('getPricingByModel', () => {
    it('should find by exact model name', () => {
      const pricing = registry.getPricingByModel('gpt-4o');

      expect(pricing).toBeDefined();
      expect(pricing?.model).toBe('gpt-4o');
    });

    it('should find by partial match', () => {
      const pricing = registry.getPricingByModel('claude-3-5-sonnet');

      expect(pricing).toBeDefined();
      expect(pricing?.model).toContain('claude-3-5-sonnet');
    });

    it('should return null for unknown model', () => {
      const pricing = registry.getPricingByModel('unknown-model-xyz');

      expect(pricing).toBeNull();
    });
  });

  describe('calculateCost', () => {
    it('should calculate basic cost', () => {
      const result = registry.calculateCost('openai', 'gpt-4o', 1000, 500);

      // gpt-4o: $2.5/1M input, $10/1M output
      expect(result.inputCost).toBeCloseTo(0.0025);
      expect(result.outputCost).toBeCloseTo(0.005);
      expect(result.totalCost).toBeCloseTo(0.0075);
      expect(result.currency).toBe('USD');
    });

    it('should include cache costs', () => {
      const result = registry.calculateCost(
        'anthropic',
        'claude-3-5-haiku-20241022',
        1000,
        500,
        {
          cacheReadTokens: 200,
          cacheWriteTokens: 100,
        },
      );

      expect(result.cacheReadCost).toBeGreaterThan(0);
      expect(result.cacheCost).toBeGreaterThan(0);
      expect(result.totalCost).toBeGreaterThan(
        result.inputCost + result.outputCost,
      );
    });

    it('should throw error for unknown model', () => {
      expect(() => {
        registry.calculateCost('openai', 'unknown-model', 1000, 500);
      }).toThrow('No pricing found');
    });

    it('should handle zero tokens', () => {
      const result = registry.calculateCost('openai', 'gpt-4o', 0, 0);

      expect(result.totalCost).toBe(0);
    });
  });

  describe('listModels', () => {
    it('should list all models', () => {
      const models = registry.listModels();

      expect(models.length).toBeGreaterThan(10);
    });

    it('should filter by provider', () => {
      const models = registry.listModels('anthropic');

      expect(models.every((m) => m.provider === 'anthropic')).toBe(true);
      expect(models.length).toBeGreaterThan(0);
    });

    it('should sort models by name', () => {
      const models = registry.listModels('openai');

      for (let i = 1; i < models.length; i++) {
        expect(
          models[i].model.localeCompare(models[i - 1].model),
        ).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('listProviders', () => {
    it('should list all providers', () => {
      const providers = registry.listProviders();

      expect(providers).toContain('anthropic');
      expect(providers).toContain('openai');
      expect(providers).toContain('google');
      expect(providers).toContain('mistral');
    });

    it('should sort providers', () => {
      const providers = registry.listProviders();

      for (let i = 1; i < providers.length; i++) {
        expect(
          providers[i].localeCompare(providers[i - 1]),
        ).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('getProviderSummary', () => {
    it('should get summary for provider', () => {
      const summary = registry.getProviderSummary('openai');

      expect(summary).toBeDefined();
      expect(summary?.provider).toBe('openai');
      expect(summary?.modelCount).toBeGreaterThan(0);
      expect(summary?.minInputPrice).toBeGreaterThan(0);
      expect(summary?.maxInputPrice).toBeGreaterThan(0);
    });

    it('should return null for unknown provider', () => {
      const summary = registry.getProviderSummary('unknown' as any);

      expect(summary).toBeNull();
    });

    it('should calculate price ranges', () => {
      const summary = registry.getProviderSummary('anthropic');

      expect(summary?.minInputPrice).toBeLessThan(summary?.maxInputPrice || 0);
      expect(summary?.minOutputPrice).toBeLessThan(
        summary?.maxOutputPrice || 0,
      );
    });
  });

  describe('comparePricing', () => {
    it('should compare two models', () => {
      const comparison = registry.comparePricing('gpt-4o', 'gpt-4o-mini');

      expect(comparison).toBeDefined();
      expect(comparison?.modelA).toBe('gpt-4o');
      expect(comparison?.modelB).toBe('gpt-4o-mini');
      expect(comparison?.cheaperModel).toBe('gpt-4o-mini');
    });

    it('should calculate percentage difference', () => {
      const comparison = registry.comparePricing('gpt-4o', 'gpt-4o-mini');

      expect(comparison?.percentageDiff).toBeDefined();
    });

    it('should estimate savings with sample tokens', () => {
      const comparison = registry.comparePricing('gpt-4o', 'gpt-4o-mini', {
        input: 1000000,
        output: 500000,
      });

      expect(comparison?.estimatedSavings).toBeGreaterThan(0);
    });

    it('should return null if model not found', () => {
      const comparison = registry.comparePricing('gpt-4o', 'unknown-model');

      expect(comparison).toBeNull();
    });
  });

  describe('findCheapestModel', () => {
    it('should find cheapest model overall', () => {
      const cheapest = registry.findCheapestModel();

      expect(cheapest).toBeDefined();
      expect(cheapest?.inputPricePerMillion).toBeGreaterThanOrEqual(0);
    });

    it('should filter by provider', () => {
      const cheapest = registry.findCheapestModel({ provider: 'openai' });

      expect(cheapest?.provider).toBe('openai');
    });

    it('should filter by context window', () => {
      const cheapest = registry.findCheapestModel({ minContextWindow: 128000 });

      expect(cheapest?.contextWindow).toBeGreaterThanOrEqual(128000);
    });

    it('should filter by vision capability', () => {
      const cheapest = registry.findCheapestModel({ requireVision: true });

      expect(cheapest?.capabilities?.vision).toBe(true);
    });

    it('should filter by function calling', () => {
      const cheapest = registry.findCheapestModel({
        requireFunctionCalling: true,
      });

      expect(cheapest?.capabilities?.functionCalling).toBe(true);
    });

    it('should exclude deprecated models', () => {
      registry.registerModel({
        model: 'deprecated-model',
        provider: 'openai',
        inputPricePerMillion: 0.001,
        outputPricePerMillion: 0.001,
        currency: 'USD',
        deprecated: true,
      });

      const cheapest = registry.findCheapestModel();

      expect(cheapest?.deprecated).not.toBe(true);
    });

    it('should weight input and output prices', () => {
      const cheapest = registry.findCheapestModel({
        weightInput: 0.8,
        weightOutput: 0.2,
      });

      expect(cheapest).toBeDefined();
    });
  });

  describe('export/import', () => {
    it('should export all pricing', () => {
      const exported = registry.exportPricing();

      expect(exported.length).toBeGreaterThan(0);
      expect(exported[0]).toHaveProperty('model');
      expect(exported[0]).toHaveProperty('provider');
    });

    it('should import pricing', () => {
      const customPricing: ModelPricing[] = [
        {
          model: 'imported-model',
          provider: 'custom',
          inputPricePerMillion: 5.0,
          outputPricePerMillion: 10.0,
          currency: 'USD',
        },
      ];

      registry.importPricing(customPricing);

      const pricing = registry.getPricing('custom', 'imported-model');
      expect(pricing).toBeDefined();
    });

    it('should replace existing pricing on import', () => {
      const customPricing: ModelPricing[] = [
        {
          model: 'new-model',
          provider: 'custom',
          inputPricePerMillion: 5.0,
          outputPricePerMillion: 10.0,
          currency: 'USD',
        },
      ];

      registry.importPricing(customPricing, true);

      const models = registry.listModels();
      expect(models.length).toBe(1);
    });
  });

  describe('clear and reset', () => {
    it('should clear all pricing', () => {
      registry.clear();

      const models = registry.listModels();
      expect(models.length).toBe(0);
    });

    it('should reset to defaults', () => {
      registry.clear();
      registry.reset();

      const models = registry.listModels();
      expect(models.length).toBeGreaterThan(0);
    });
  });

  describe('auto-update', () => {
    afterEach(() => {
      registry.stopAutoUpdate();
    });

    it('should not start auto-update by default', () => {
      registry = new ModelPricingRegistry();

      // No errors should occur
      expect(registry).toBeDefined();
    });

    it('should stop auto-update', () => {
      registry.stopAutoUpdate();

      // Should not throw
      expect(registry).toBeDefined();
    });
  });

  describe('remote update', () => {
    it('should throw error without URL', async () => {
      await expect(registry.updateFromRemote()).rejects.toThrow(
        'No remote pricing URL',
      );
    });

    it('should fetch from remote URL', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            model: 'remote-model',
            provider: 'custom',
            inputPricePerMillion: 1.0,
            outputPricePerMillion: 2.0,
            currency: 'USD',
          },
        ],
      });

      global.fetch = mockFetch;

      registry = new ModelPricingRegistry({
        remotePricingUrl: 'https://example.com/pricing.json',
      });

      await registry.updateFromRemote();

      expect(mockFetch).toHaveBeenCalled();

      const pricing = registry.getPricing('custom', 'remote-model');
      expect(pricing).toBeDefined();
    });

    it('should handle fetch errors', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      });

      global.fetch = mockFetch;

      registry = new ModelPricingRegistry({
        remotePricingUrl: 'https://example.com/pricing.json',
      });

      await expect(registry.updateFromRemote()).rejects.toThrow(
        'Failed to fetch pricing',
      );
    });
  });

  describe('specific models', () => {
    it('should have correct Anthropic pricing', () => {
      const sonnet = registry.getPricing(
        'anthropic',
        'claude-3-5-sonnet-20241022',
      );

      expect(sonnet?.inputPricePerMillion).toBe(3.0);
      expect(sonnet?.outputPricePerMillion).toBe(15.0);
      expect(sonnet?.cacheReadPricePerMillion).toBe(0.3);
      expect(sonnet?.cacheWritePricePerMillion).toBe(3.75);
    });

    it('should have correct OpenAI pricing', () => {
      const gpt4o = registry.getPricing('openai', 'gpt-4o');

      expect(gpt4o?.inputPricePerMillion).toBe(2.5);
      expect(gpt4o?.outputPricePerMillion).toBe(10.0);
    });

    it('should have correct Google pricing', () => {
      const gemini = registry.getPricing('google', 'gemini-1.5-flash');

      expect(gemini?.inputPricePerMillion).toBe(0.075);
      expect(gemini?.outputPricePerMillion).toBe(0.3);
    });

    it('should mark Gemini 2.0 as free', () => {
      const gemini2 = registry.getPricing('google', 'gemini-2.0-flash-exp');

      expect(gemini2?.inputPricePerMillion).toBe(0);
      expect(gemini2?.outputPricePerMillion).toBe(0);
    });
  });
});
