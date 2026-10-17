/**
 * Prices and retirement flags checked against platform.claude.com (pricing page,
 * read 2026-10-16) and the OpenAI deprecations page (read 2026-10-16).
 */

import { describe, it, expect } from 'vitest';
import { ModelPricingRegistry } from '../pricing/ModelPricingRegistry.js';

describe('5.5 model pricing', () => {
  const registry = new ModelPricingRegistry();

  it('prices Opus 5.5 at $4 in / $20 out, cache read $0.20, 5m write $5', () => {
    const p = registry.getPricingByModel('claude-opus-5-5');
    expect(p?.inputPricePerMillion).toBe(4);
    expect(p?.outputPricePerMillion).toBe(20);
    expect(p?.cacheReadPricePerMillion).toBe(0.2);
    expect(p?.cacheWritePricePerMillion).toBe(5);
  });

  it('prices Sonnet 5.5 at $2 in / $10 out, cache read $0.10, 5m write $2.50', () => {
    const p = registry.getPricingByModel('claude-sonnet-5-5');
    expect(p?.inputPricePerMillion).toBe(2);
    expect(p?.outputPricePerMillion).toBe(10);
    expect(p?.cacheReadPricePerMillion).toBe(0.1);
    expect(p?.cacheWritePricePerMillion).toBe(2.5);
  });

  it('prices Haiku 5.5 at $0.10 in / $0.50 out up to 100k prompt tokens, with the tier above', () => {
    const p = registry.getPricingByModel('claude-haiku-5-5');
    expect(p?.inputPricePerMillion).toBe(0.1);
    expect(p?.outputPricePerMillion).toBe(0.5);
    expect(p?.cacheReadPricePerMillion).toBe(0.01);
    expect(p?.cacheWritePricePerMillion).toBe(0.125);
    expect(p?.tiers).toEqual([
      { minTokens: 0, maxTokens: 100000, inputPrice: 0.1, outputPrice: 0.5 },
      { minTokens: 100001, inputPrice: 0.5, outputPrice: 2.5 },
    ]);
  });

  it('gives every 5.5 default a price, so cost tracking has a rate for it', () => {
    for (const id of ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5']) {
      expect(registry.getPricingByModel(id)).not.toBeNull();
    }
  });
});

describe('retirement flags', () => {
  const registry = new ModelPricingRegistry();

  const retiring = [
    'gpt-4-turbo',
    'gpt-4.1-nano',
    'o1',
    'o3-mini',
    'o4-mini',
    'claude-sonnet-4-5-20250929',
  ];

  for (const id of retiring) {
    it(`marks ${id} deprecated`, () => {
      expect(registry.getPricingByModel(id)?.deprecated).toBe(true);
    });
  }

  it('keeps current 5.5 models out of the deprecated set', () => {
    for (const id of ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5']) {
      expect(registry.getPricingByModel(id)?.deprecated).not.toBe(true);
    }
  });
});
