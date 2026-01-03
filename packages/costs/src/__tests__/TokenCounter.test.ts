/**
 * TokenCounter Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TokenCounter,
  countTokens,
  countTokensApprox,
} from '../pricing/TokenCounter.js';
import { ModelPricingRegistry } from '../pricing/ModelPricingRegistry.js';

describe('TokenCounter', () => {
  let registry: ModelPricingRegistry;
  let counter: TokenCounter;

  beforeEach(() => {
    registry = new ModelPricingRegistry();
    counter = new TokenCounter(registry);
  });

  describe('initialization', () => {
    it('should create counter with registry', () => {
      expect(counter).toBeDefined();
    });

    it('should accept custom cache size', () => {
      counter = new TokenCounter(registry, { maxCacheSize: 500 });

      expect(counter.getCacheStats().maxSize).toBe(500);
    });
  });

  describe('countTokens', () => {
    it('should count tokens in text', async () => {
      const result = await counter.countTokens({
        text: 'Hello, world!',
      });

      expect(result.tokens).toBeGreaterThan(0);
      expect(result.characters).toBe(13);
      expect(result.words).toBe(2);
    });

    it('should count tokens with model', async () => {
      const result = await counter.countTokens({
        text: 'Hello, world!',
        model: 'gpt-4o',
      });

      expect(result.model).toBe('gpt-4o');
    });

    it('should estimate input cost', async () => {
      const result = await counter.countTokens({
        text: 'Hello, world!',
        model: 'gpt-4o',
      });

      expect(result.estimatedInputCost).toBeGreaterThan(0);
    });

    it('should handle empty text', async () => {
      const result = await counter.countTokens({
        text: '',
      });

      expect(result.tokens).toBe(0);
      expect(result.words).toBe(0);
    });

    it('should count longer text', async () => {
      const text =
        'This is a longer piece of text that contains multiple sentences. It should have more tokens than a short phrase.';
      const result = await counter.countTokens({
        text,
        model: 'gpt-4o',
      });

      expect(result.tokens).toBeGreaterThan(10);
    });

    it('should use cache for repeated text', async () => {
      const text = 'Hello, world!';

      const result1 = await counter.countTokens({ text });
      const result2 = await counter.countTokens({ text });

      expect(result1.tokens).toBe(result2.tokens);
    });

    it('should detect provider from model name', async () => {
      const result = await counter.countTokens({
        text: 'Hello',
        model: 'claude-3-5-sonnet-20241022',
      });

      expect(result.tokens).toBeGreaterThan(0);
    });
  });

  describe('provider detection', () => {
    it('should detect Anthropic models', async () => {
      const result = await counter.countTokens({
        text: 'Hello',
        model: 'claude-3-5-sonnet',
      });

      expect(result.tokens).toBeGreaterThan(0);
    });

    it('should detect OpenAI models', async () => {
      const result = await counter.countTokens({
        text: 'Hello',
        model: 'gpt-4o',
      });

      expect(result.tokens).toBeGreaterThan(0);
    });

    it('should detect Google models', async () => {
      const result = await counter.countTokens({
        text: 'Hello',
        model: 'gemini-1.5-pro',
      });

      expect(result.tokens).toBeGreaterThan(0);
    });

    it('should detect Mistral models', async () => {
      const result = await counter.countTokens({
        text: 'Hello',
        model: 'mistral-large',
      });

      expect(result.tokens).toBeGreaterThan(0);
    });

    it('should default to OpenAI for unknown models', async () => {
      const result = await counter.countTokens({
        text: 'Hello',
        model: 'unknown-model',
      });

      expect(result.tokens).toBeGreaterThan(0);
    });
  });

  describe('estimateCost', () => {
    it('should estimate cost from text', async () => {
      const result = await counter.estimateCost({
        input: 'Hello, world!',
        model: 'gpt-4o',
        estimatedOutputTokens: 50,
      });

      expect(result.estimatedCost).toBeGreaterThan(0);
      expect(result.inputTokens).toBeGreaterThan(0);
      expect(result.outputTokens).toBe(50);
      expect(result.currency).toBe('USD');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should estimate cost from token count', async () => {
      const result = await counter.estimateCost({
        input: 1000,
        model: 'gpt-4o',
        estimatedOutputTokens: 500,
      });

      expect(result.inputTokens).toBe(1000);
      expect(result.outputTokens).toBe(500);
    });

    it('should use default output tokens', async () => {
      const result = await counter.estimateCost({
        input: 'Hello',
        model: 'gpt-4o',
      });

      expect(result.outputTokens).toBe(500);
    });

    it('should include cache costs', async () => {
      const result = await counter.estimateCost({
        input: 'Hello',
        model: 'claude-3-5-sonnet-20241022',
        includeCache: true,
      });

      expect(result.breakdown.cacheCost).toBeGreaterThan(0);
    });

    it('should calculate breakdown', async () => {
      const result = await counter.estimateCost({
        input: 1000,
        model: 'gpt-4o',
        estimatedOutputTokens: 500,
      });

      expect(result.breakdown.inputCost).toBeGreaterThan(0);
      expect(result.breakdown.outputCost).toBeGreaterThan(0);
      expect(result.estimatedCost).toBe(
        result.breakdown.inputCost + result.breakdown.outputCost,
      );
    });

    it('should throw error for unknown model', async () => {
      await expect(
        counter.estimateCost({
          input: 'Hello',
          model: 'unknown-model-xyz',
        }),
      ).rejects.toThrow('No pricing found');
    });

    it('should have higher confidence with explicit output', async () => {
      const result = await counter.estimateCost({
        input: 'Hello',
        model: 'gpt-4o',
        estimatedOutputTokens: 100,
      });

      expect(result.confidence).toBe(0.85);
    });

    it('should have lower confidence with default output', async () => {
      const result = await counter.estimateCost({
        input: 'Hello',
        model: 'gpt-4o',
      });

      expect(result.confidence).toBe(0.7);
    });
  });

  describe('countTokensBatch', () => {
    it('should count multiple texts', async () => {
      const texts = ['Hello', 'World', 'How are you?'];
      const results = await counter.countTokensBatch(texts);

      expect(results).toHaveLength(3);
      expect(results[0].tokens).toBeGreaterThan(0);
      expect(results[1].tokens).toBeGreaterThan(0);
      expect(results[2].tokens).toBeGreaterThan(0);
    });

    it('should use same model for all', async () => {
      const texts = ['Hello', 'World'];
      const results = await counter.countTokensBatch(texts, {
        model: 'gpt-4o',
      });

      expect(results[0].model).toBe('gpt-4o');
      expect(results[1].model).toBe('gpt-4o');
    });
  });

  describe('countMessagesTokens', () => {
    it('should count tokens in messages', async () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' },
      ];

      const result = await counter.countMessagesTokens(messages);

      expect(result.totalTokens).toBeGreaterThan(0);
      expect(result.perMessage).toHaveLength(3);
      expect(result.overhead).toBeGreaterThan(0);
    });

    it('should include message overhead', async () => {
      const messages = [{ role: 'user', content: 'Hello' }];

      const result = await counter.countMessagesTokens(messages);

      // Overhead is ~4 tokens per message + 3 for priming
      expect(result.overhead).toBe(7);
    });

    it('should track per-message tokens', async () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' },
      ];

      const result = await counter.countMessagesTokens(messages);

      expect(result.perMessage[0].role).toBe('user');
      expect(result.perMessage[0].tokens).toBeGreaterThan(0);
      expect(result.perMessage[1].role).toBe('assistant');
      expect(result.perMessage[1].tokens).toBeGreaterThan(0);
    });
  });

  describe('cache management', () => {
    it('should cache token counts', async () => {
      const text = 'Test text for caching';

      await counter.countTokens({ text });
      const stats1 = counter.getCacheStats();

      await counter.countTokens({ text });
      const stats2 = counter.getCacheStats();

      expect(stats1.size).toBeLessThanOrEqual(stats2.size);
    });

    it('should clear cache', async () => {
      await counter.countTokens({ text: 'Hello' });

      counter.clearCache();
      const stats = counter.getCacheStats();

      expect(stats.size).toBe(0);
    });

    it('should limit cache size', async () => {
      counter = new TokenCounter(registry, { maxCacheSize: 2 });

      await counter.countTokens({ text: 'Text 1' });
      await counter.countTokens({ text: 'Text 2' });
      await counter.countTokens({ text: 'Text 3' });

      const stats = counter.getCacheStats();
      expect(stats.size).toBeLessThanOrEqual(2);
    });

    it('should get cache stats', () => {
      const stats = counter.getCacheStats();

      expect(stats.size).toBeGreaterThanOrEqual(0);
      expect(stats.maxSize).toBeGreaterThan(0);
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('approximate counting', () => {
    it('should handle whitespace', async () => {
      const text = 'Hello    world   !';
      const result = await counter.countTokens({ text });

      expect(result.tokens).toBeGreaterThan(0);
    });

    it('should handle punctuation', async () => {
      const text = 'Hello, world! How are you?';
      const result = await counter.countTokens({ text });

      expect(result.tokens).toBeGreaterThan(0);
    });

    it('should handle numbers', async () => {
      const text = 'The year is 2024 and the price is $99.99';
      const result = await counter.countTokens({ text });

      expect(result.tokens).toBeGreaterThan(0);
    });

    it('should handle unicode characters', async () => {
      const text = 'Hello 世界! 🌍';
      const result = await counter.countTokens({ text });

      expect(result.tokens).toBeGreaterThan(0);
    });
  });
});

describe('countTokens (standalone)', () => {
  it('should count tokens without registry', async () => {
    const count = await countTokens('Hello, world!');

    expect(count).toBeGreaterThan(0);
  });

  it('should use provider strategy', async () => {
    const count = await countTokens('Hello, world!', {
      provider: 'anthropic',
    });

    expect(count).toBeGreaterThan(0);
  });

  it('should handle model option', async () => {
    const count = await countTokens('Hello, world!', {
      model: 'gpt-4o',
    });

    expect(count).toBeGreaterThan(0);
  });
});

describe('countTokensApprox', () => {
  it('should approximate token count', () => {
    const count = countTokensApprox('Hello, world!');

    expect(count).toBeGreaterThan(0);
  });

  it('should use chars per token', () => {
    const count = countTokensApprox('Hello, world!', 2);

    expect(count).toBeGreaterThan(0);
  });

  it('should handle empty string', () => {
    const count = countTokensApprox('');

    expect(count).toBe(0);
  });

  it('should handle long text', () => {
    const text = 'a'.repeat(1000);
    const count = countTokensApprox(text, 4);

    expect(count).toBe(250);
  });
});
