import { describe, it, expect } from 'vitest';

import { VERIFIED_MODELS, getVerifiedModel } from '../verified-models';

describe('VERIFIED_MODELS integrity', () => {
  it('has unique model IDs', () => {
    const ids = VERIFIED_MODELS.map((spec) => spec.model);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('records a source and an access date on every row', () => {
    for (const spec of VERIFIED_MODELS) {
      expect(spec.source.length).toBeGreaterThan(0);
      expect(spec.accessed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('keeps numeric limits and prices positive', () => {
    for (const spec of VERIFIED_MODELS) {
      expect(spec.contextWindow).toBeGreaterThan(0);
      expect(spec.maxOutputTokens).toBeGreaterThan(0);
      expect(spec.price.input).toBeGreaterThan(0);
      expect(spec.price.output).toBeGreaterThan(0);
      if (spec.price.cachedInput !== undefined) {
        expect(spec.price.cachedInput).toBeLessThanOrEqual(spec.price.input);
      }
    }
  });

  it('only contains the models that were re-checked on 2026-10-16', () => {
    const ids = VERIFIED_MODELS.map((spec) => spec.model).sort();
    expect(ids).toEqual([
      'claude-fable-5-1',
      'claude-haiku-5-5',
      'claude-opus-5-5',
      'claude-sonnet-5-5',
      'gpt-6-astra',
      'gpt-6-luna',
      'gpt-6.1-sol',
    ]);
  });

  it('looks up a row by model ID and returns undefined for an unverified one', () => {
    expect(getVerifiedModel('claude-opus-5-5')?.price.output).toBe(20);
    expect(getVerifiedModel('gemini-4-argon')).toBeUndefined();
  });

  it('keeps Haiku 5.5 tiered pricing above the 100k-token threshold', () => {
    const haiku = getVerifiedModel('claude-haiku-5-5');
    expect(haiku?.priceAboveTier).toEqual({
      threshold: 100_000,
      price: { input: 0.5, output: 2.5 },
    });
  });
});
