import { describe, it, expect } from 'vitest';

import { MODEL_REGISTRY, getModelInfo } from '../models';

/**
 * Dates from the providers' own deprecation pages, read 2026-10-16:
 * OpenAI: developers.openai.com/api/docs/deprecations
 * Anthropic: platform.claude.com/docs/en/about-claude/model-deprecations
 */
const RETIREMENTS: Record<string, string> = {
  'gpt-4.1-nano': '2026-10-23',
  'o4-mini-deep-research': '2026-07-23',
  'o1-mini': '2025-10-27',
  'claude-sonnet-4-5-20250929': '2026-11-30',
};

/**
 * OpenAI model IDs retired in 2.0.0. Removed from the registry, so lookups
 * return undefined. Callers must move to the replacement named in the
 * changelog.
 */
const REMOVED_OPENAI_IDS = [
  'o1',
  'o1-2024-12-17',
  'o1-pro',
  'o1-pro-2025-03-19',
  'o3-mini',
  'o3-mini-2025-01-31',
  'o4-mini',
  'o4-mini-2025-04-16',
  'gpt-4-turbo',
  'gpt-4-turbo-2024-04-09',
  'gpt-3.5-turbo',
  'gpt-3.5-turbo-0125',
  'gpt-image-1',
  'gpt-4o-2024-05-13',
  'gpt-5',
  'gpt-5-2025-08-07',
  'gpt-5-mini',
  'gpt-5-mini-2025-08-07',
  'gpt-5-nano',
  'gpt-5-nano-2025-08-07',
  'gpt-5-pro',
  'gpt-5-pro-2025-10-06',
  'o3',
  'o3-2025-04-16',
  'o3-pro',
  'o3-pro-2025-06-10',
  'gpt-4o-2024-08-06',
  'gpt-4o-2024-11-20',
  'gpt-4o-mini-2024-07-18',
];

describe('registry deprecations', () => {
  for (const [id, date] of Object.entries(RETIREMENTS)) {
    it(`marks ${id} deprecated, retiring ${date}`, () => {
      const info = getModelInfo(id);
      expect(info?.deprecated).toBe(true);
      expect(info?.retiresOn).toBe(date);
    });
  }

  for (const id of REMOVED_OPENAI_IDS) {
    it(`no longer registers retired OpenAI model ${id}`, () => {
      expect(MODEL_REGISTRY[id]).toBeUndefined();
      expect(getModelInfo(id)).toBeUndefined();
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
