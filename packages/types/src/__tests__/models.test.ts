import { describe, it, expect } from 'vitest';

import {
  MODEL_REGISTRY,
  getModelInfo,
  modelSupportsCapability,
  getModelsForProvider,
  getModelsWithCapability,
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_ANTHROPIC_BALANCED_MODEL,
  DEFAULT_ANTHROPIC_FAST_MODEL,
} from '../models';

describe('default model constants', () => {
  it('exposes recommended defaults that exist in the registry', () => {
    expect(DEFAULT_ANTHROPIC_MODEL).toBe('claude-opus-4-8');
    expect(DEFAULT_ANTHROPIC_BALANCED_MODEL).toBe('claude-sonnet-4-6');
    expect(DEFAULT_ANTHROPIC_FAST_MODEL).toBe('claude-haiku-4-5-20251001');

    expect(MODEL_REGISTRY[DEFAULT_ANTHROPIC_MODEL]).toBeDefined();
    expect(MODEL_REGISTRY[DEFAULT_ANTHROPIC_BALANCED_MODEL]).toBeDefined();
    expect(MODEL_REGISTRY[DEFAULT_ANTHROPIC_FAST_MODEL]).toBeDefined();
  });
});

describe('MODEL_REGISTRY integrity', () => {
  it('keys match the model field of each entry', () => {
    for (const [key, info] of Object.entries(MODEL_REGISTRY)) {
      expect(info.model).toBe(key);
    }
  });

  it('every entry has a full capabilities object', () => {
    const requiredCaps = [
      'tools',
      'streaming',
      'vision',
      'structuredOutput',
      'systemMessage',
      'extendedThinking',
      'contextWindow',
      'maxOutputTokens',
      'parallelToolCalls',
    ] as const;
    for (const info of Object.values(MODEL_REGISTRY)) {
      for (const cap of requiredCaps) {
        expect(info.capabilities[cap]).toBeDefined();
      }
      expect(info.capabilities.contextWindow).toBeGreaterThan(0);
      expect(info.capabilities.maxOutputTokens).toBeGreaterThan(0);
    }
  });
});

describe('getModelInfo', () => {
  it('returns model info for a registered model', () => {
    const info = getModelInfo('claude-opus-4-8');
    expect(info).toBeDefined();
    expect(info?.provider).toBe('anthropic');
    expect(info?.displayName).toBe('Claude Opus 4.8');
  });

  it('returns undefined for an unknown model', () => {
    expect(getModelInfo('does-not-exist')).toBeUndefined();
  });
});

describe('modelSupportsCapability', () => {
  it('returns true for a boolean capability that is enabled', () => {
    expect(modelSupportsCapability('claude-opus-4-8', 'tools')).toBe(true);
    expect(modelSupportsCapability('claude-opus-4-8', 'vision')).toBe(true);
  });

  it('returns false for a boolean capability that is disabled', () => {
    // o1-mini has tools: false
    expect(modelSupportsCapability('o1-mini', 'tools')).toBe(false);
    expect(modelSupportsCapability('o1-mini', 'vision')).toBe(false);
  });

  it('treats positive numeric capabilities as supported', () => {
    // contextWindow > 0 => "supported"
    expect(modelSupportsCapability('claude-opus-4-8', 'contextWindow')).toBe(
      true,
    );
  });

  it('returns false for an unknown model', () => {
    expect(modelSupportsCapability('nope', 'tools')).toBe(false);
  });
});

describe('getModelsForProvider', () => {
  it('returns only models for the given provider', () => {
    const anthropicModels = getModelsForProvider('anthropic');
    expect(anthropicModels.length).toBeGreaterThan(0);
    expect(anthropicModels.every((m) => m.provider === 'anthropic')).toBe(true);
  });

  it('returns an empty array for a provider with no registered models', () => {
    // Ollama models are dynamic and not in the static registry
    expect(getModelsForProvider('ollama')).toEqual([]);
  });

  it('partitions the registry across providers without overlap', () => {
    const providers = [
      'anthropic',
      'openai',
      'gemini',
      'mistral',
      'deepseek',
      'xai',
    ] as const;
    const total = providers.reduce(
      (sum, p) => sum + getModelsForProvider(p).length,
      0,
    );
    expect(total).toBe(Object.keys(MODEL_REGISTRY).length);
  });
});

describe('getModelsWithCapability', () => {
  it('returns all models with a boolean capability when no minValue given', () => {
    const withTools = getModelsWithCapability('tools');
    expect(withTools.length).toBeGreaterThan(0);
    expect(withTools.every((m) => m.capabilities.tools === true)).toBe(true);
  });

  it('filters by exact boolean minValue', () => {
    const withoutTools = getModelsWithCapability('tools', false);
    expect(withoutTools.every((m) => m.capabilities.tools === false)).toBe(
      true,
    );
    // o1-mini is one such model
    expect(withoutTools.some((m) => m.model === 'o1-mini')).toBe(true);
  });

  it('filters numeric capabilities by minimum threshold', () => {
    const bigContext = getModelsWithCapability('contextWindow', 1_000_000);
    expect(bigContext.length).toBeGreaterThan(0);
    expect(
      bigContext.every((m) => m.capabilities.contextWindow >= 1_000_000),
    ).toBe(true);
  });
});
