import { describe, it, expect } from 'vitest';

import { MODEL_REGISTRY, getModelInfo } from '../models';

/**
 * Dates from the providers' own deprecation pages, read 2026-10-16:
 * OpenAI: developers.openai.com/api/docs/deprecations
 * Anthropic: platform.claude.com/docs/en/about-claude/model-deprecations
 */
const RETIREMENTS: Record<string, string> = {
  'gpt-4-turbo': '2026-10-23',
  'gpt-3.5-turbo': '2026-10-23',
  'gpt-4.1-nano': '2026-10-23',
  o1: '2026-10-23',
  'o3-mini': '2026-10-23',
  'o4-mini': '2026-10-23',
  'o4-mini-deep-research': '2026-07-23',
  'o1-mini': '2025-10-27',
  'claude-sonnet-4-5-20250929': '2026-11-30',
};

describe('registry deprecations', () => {
  for (const [id, date] of Object.entries(RETIREMENTS)) {
    it(`marks ${id} deprecated, retiring ${date}`, () => {
      const info = getModelInfo(id);
      expect(info?.deprecated).toBe(true);
      expect(info?.retiresOn).toBe(date);
    });
  }

  it('leaves active defaults and current models undeprecated', () => {
    for (const id of [
      'claude-opus-5-5',
      'claude-sonnet-4-6',
      'claude-haiku-4-5-20251001',
    ]) {
      expect(MODEL_REGISTRY[id]?.deprecated).not.toBe(true);
      expect(MODEL_REGISTRY[id]?.retiresOn).toBeUndefined();
    }
  });

  it('only sets retiresOn on deprecated entries', () => {
    for (const info of Object.values(MODEL_REGISTRY)) {
      if (info.retiresOn !== undefined) {
        expect(info.deprecated).toBe(true);
        expect(info.retiresOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });
});
