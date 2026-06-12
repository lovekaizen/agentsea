import { describe, it, expect } from 'vitest';
import {
  MODEL_PRICING,
  MODEL_CONTEXT_WINDOWS,
  calculateCost,
  estimateCost,
  getModelPricing,
  getModelInfo,
  getModelCapabilities,
  findCheapestModel,
  sortModelsByCost,
} from '../utils/pricing.js';

describe('pricing utilities', () => {
  describe('MODEL_PRICING', () => {
    it('should have pricing for major OpenAI models', () => {
      expect(MODEL_PRICING['gpt-5.5']).toBeDefined();
      expect(MODEL_PRICING['gpt-5.4-mini']).toBeDefined();
      // Legacy entries kept for historical cost lookups
      expect(MODEL_PRICING['gpt-4o']).toBeDefined();
      expect(MODEL_PRICING['gpt-4o-mini']).toBeDefined();
      expect(MODEL_PRICING['gpt-3.5-turbo']).toBeDefined();
    });

    it('should have pricing for major Anthropic models', () => {
      expect(MODEL_PRICING['claude-opus-4-8']).toBeDefined();
      expect(MODEL_PRICING['claude-sonnet-4-6']).toBeDefined();
      expect(MODEL_PRICING['claude-haiku-4-5']).toBeDefined();
      // Retired entries kept for historical cost lookups
      expect(MODEL_PRICING['claude-3-5-sonnet-20241022']).toBeDefined();
      expect(MODEL_PRICING['claude-3-haiku-20240307']).toBeDefined();
    });

    it('should have pricing for major Google models', () => {
      expect(MODEL_PRICING['gemini-3.1-pro-preview']).toBeDefined();
      expect(MODEL_PRICING['gemini-3.5-flash']).toBeDefined();
      // Legacy entries kept for historical cost lookups
      expect(MODEL_PRICING['gemini-1.5-pro']).toBeDefined();
      expect(MODEL_PRICING['gemini-1.5-flash']).toBeDefined();
    });

    it('should have zero pricing for local models', () => {
      expect(MODEL_PRICING['llama3']).toEqual({ input: 0, output: 0 });
      expect(MODEL_PRICING['mistral']).toEqual({ input: 0, output: 0 });
    });
  });

  describe('MODEL_CONTEXT_WINDOWS', () => {
    it('should have context windows for major models', () => {
      expect(MODEL_CONTEXT_WINDOWS['gpt-5.5']).toBe(1050000);
      expect(MODEL_CONTEXT_WINDOWS['claude-sonnet-4-6']).toBe(1000000);
      expect(MODEL_CONTEXT_WINDOWS['gemini-3.1-pro-preview']).toBe(1048576);
      // Legacy entries kept for historical lookups
      expect(MODEL_CONTEXT_WINDOWS['gpt-4o']).toBe(128000);
      expect(MODEL_CONTEXT_WINDOWS['claude-3-5-sonnet-20241022']).toBe(200000);
      expect(MODEL_CONTEXT_WINDOWS['gemini-1.5-pro']).toBe(2000000);
    });
  });

  describe('calculateCost', () => {
    it('should calculate cost correctly for known models', () => {
      const usage = {
        prompt_tokens: 1000,
        completion_tokens: 500,
        total_tokens: 1500,
      };

      const cost = calculateCost('gpt-4o', usage);
      // gpt-4o: $2.5/M input, $10/M output
      // (1000/1M * 2.5) + (500/1M * 10) = 0.0025 + 0.005 = 0.0075
      expect(cost).toBeCloseTo(0.0075, 6);
    });

    it('should return 0 for unknown models', () => {
      const usage = {
        prompt_tokens: 1000,
        completion_tokens: 500,
        total_tokens: 1500,
      };

      const cost = calculateCost('unknown-model', usage);
      expect(cost).toBe(0);
    });

    it('should return 0 for local models', () => {
      const usage = {
        prompt_tokens: 1000,
        completion_tokens: 500,
        total_tokens: 1500,
      };

      const cost = calculateCost('llama3', usage);
      expect(cost).toBe(0);
    });
  });

  describe('estimateCost', () => {
    it('should estimate cost correctly', () => {
      const cost = estimateCost('gpt-4o-mini', 1000, 500);
      // gpt-4o-mini: $0.15/M input, $0.6/M output
      // (1000/1M * 0.15) + (500/1M * 0.6) = 0.00015 + 0.0003 = 0.00045
      expect(cost).toBeCloseTo(0.00045, 6);
    });

    it('should return 0 for unknown models', () => {
      const cost = estimateCost('unknown-model', 1000, 500);
      expect(cost).toBe(0);
    });
  });

  describe('getModelPricing', () => {
    it('should return pricing for known models', () => {
      const pricing = getModelPricing('gpt-4o');
      expect(pricing).toEqual({ input: 2.5, output: 10.0 });
    });

    it('should return null for unknown models', () => {
      const pricing = getModelPricing('unknown-model');
      expect(pricing).toBeNull();
    });
  });

  describe('getModelInfo', () => {
    it('should return model info with pricing and capabilities', () => {
      const info = getModelInfo('gpt-4o', 'openai');

      expect(info.id).toBe('gpt-4o');
      expect(info.provider).toBe('openai');
      expect(info.contextWindow).toBe(128000);
      expect(info.inputPricePerMillion).toBe(2.5);
      expect(info.outputPricePerMillion).toBe(10.0);
      expect(info.capabilities).toBeDefined();
    });

    it('should return default values for unknown models', () => {
      const info = getModelInfo('unknown-model', 'unknown');

      expect(info.id).toBe('unknown-model');
      expect(info.provider).toBe('unknown');
      expect(info.contextWindow).toBe(4096); // Default
      expect(info.inputPricePerMillion).toBe(0);
    });
  });

  describe('getModelCapabilities', () => {
    it('should return vision capability for GPT-4o', () => {
      const caps = getModelCapabilities('gpt-4o', 'openai');
      expect(caps.vision).toBe(true);
      expect(caps.streaming).toBe(true);
      expect(caps.tools).toBe(true);
    });

    it('should return vision capability for GPT-5.5', () => {
      const caps = getModelCapabilities('gpt-5.5', 'openai');
      expect(caps.vision).toBe(true);
      expect(caps.streaming).toBe(true);
      expect(caps.tools).toBe(true);
    });

    it('should return vision capability for Claude 3', () => {
      const caps = getModelCapabilities(
        'claude-3-5-sonnet-20241022',
        'anthropic',
      );
      expect(caps.vision).toBe(true);
    });

    it('should return vision capability for current Claude models', () => {
      expect(
        getModelCapabilities('claude-sonnet-4-6', 'anthropic').vision,
      ).toBe(true);
      expect(getModelCapabilities('claude-opus-4-8', 'anthropic').vision).toBe(
        true,
      );
      expect(getModelCapabilities('claude-haiku-4-5', 'anthropic').vision).toBe(
        true,
      );
    });

    it('should return limited capabilities for o1 models', () => {
      const caps = getModelCapabilities('o1', 'openai');
      expect(caps.streaming).toBe(false);
      expect(caps.tools).toBe(false);
      expect(caps.system_prompts).toBe(false);
    });

    it('should return limited capabilities for Ollama models', () => {
      const caps = getModelCapabilities('llama3', 'ollama');
      expect(caps.tools).toBe(false);
      expect(caps.streaming).toBe(true);
    });
  });

  describe('findCheapestModel', () => {
    it('should find the cheapest model from a list', () => {
      const models = ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'];
      const cheapest = findCheapestModel(models);

      expect(cheapest).toBe('gpt-4o-mini');
    });

    it('should return local model as cheapest when available', () => {
      const models = ['gpt-4o', 'llama3', 'gpt-4o-mini'];
      const cheapest = findCheapestModel(models);

      expect(cheapest).toBe('llama3');
    });

    it('should return null for empty list', () => {
      const cheapest = findCheapestModel([]);
      expect(cheapest).toBeNull();
    });

    it('should return null for all unknown models', () => {
      const cheapest = findCheapestModel(['unknown1', 'unknown2']);
      expect(cheapest).toBeNull();
    });
  });

  describe('sortModelsByCost', () => {
    it('should sort models by cost ascending', () => {
      const models = ['gpt-4o', 'gpt-4o-mini', 'llama3'];
      const sorted = sortModelsByCost(models, 'asc');

      expect(sorted[0]).toBe('llama3');
      expect(sorted[1]).toBe('gpt-4o-mini');
      expect(sorted[2]).toBe('gpt-4o');
    });

    it('should sort models by cost descending', () => {
      const models = ['gpt-4o', 'gpt-4o-mini', 'llama3'];
      const sorted = sortModelsByCost(models, 'desc');

      expect(sorted[0]).toBe('gpt-4o');
      expect(sorted[sorted.length - 1]).toBe('llama3');
    });
  });
});
