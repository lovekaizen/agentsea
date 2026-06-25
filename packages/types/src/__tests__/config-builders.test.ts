import { describe, it, expect, expectTypeOf } from 'vitest';

import {
  anthropic,
  openai,
  gemini,
  mistral,
  deepseek,
  xai,
  ollama,
  isAnthropicConfig,
  isOpenAIConfig,
  isGeminiConfig,
  isMistralConfig,
  isDeepSeekConfig,
  isXAIConfig,
  isOllamaConfig,
  type ProviderModelConfig,
} from '../config-builders';

describe('config-builders factory functions', () => {
  it('anthropic() wraps provider, model, and config', () => {
    const config = anthropic('claude-opus-4-8', {
      systemPrompt: 'You are helpful',
    });
    expect(config.provider).toBe('anthropic');
    expect(config.model).toBe('claude-opus-4-8');
    expect(config.config).toEqual({ systemPrompt: 'You are helpful' });
  });

  it('anthropic() defaults config to an empty object when omitted', () => {
    const config = anthropic('claude-opus-4-8');
    expect(config.config).toEqual({});
  });

  it('openai() wraps provider, model, and config', () => {
    const config = openai('gpt-4o', { temperature: 0.7 });
    expect(config.provider).toBe('openai');
    expect(config.model).toBe('gpt-4o');
    expect(config.config).toEqual({ temperature: 0.7 });
  });

  it('openai() defaults config to an empty object when omitted', () => {
    expect(openai('gpt-4o').config).toEqual({});
  });

  it('gemini() wraps provider, model, and config', () => {
    const config = gemini('gemini-1.5-pro', { topK: 40 });
    expect(config.provider).toBe('gemini');
    expect(config.model).toBe('gemini-1.5-pro');
    expect(config.config).toEqual({ topK: 40 });
  });

  it('mistral() wraps provider, model, and config', () => {
    const config = mistral('mistral-large-latest');
    expect(config.provider).toBe('mistral');
    expect(config.model).toBe('mistral-large-latest');
    expect(config.config).toEqual({});
  });

  it('deepseek() wraps provider, model, and config', () => {
    const config = deepseek('deepseek-chat');
    expect(config.provider).toBe('deepseek');
    expect(config.model).toBe('deepseek-chat');
  });

  it('xai() wraps provider, model, and config', () => {
    const config = xai('grok-3');
    expect(config.provider).toBe('xai');
    expect(config.model).toBe('grok-3');
  });

  it('ollama() wraps provider, model, and config', () => {
    const config = ollama('llama3.2', { systemPrompt: 'hi' });
    expect(config.provider).toBe('ollama');
    expect(config.model).toBe('llama3.2');
    expect(config.config).toEqual({ systemPrompt: 'hi' });
  });

  it('ollama() defaults config to an empty object when omitted', () => {
    expect(ollama('llama3.2').config).toEqual({});
  });
});

describe('config-builders type guards', () => {
  const configs: ProviderModelConfig[] = [
    anthropic('claude-opus-4-8'),
    openai('gpt-4o'),
    gemini('gemini-1.5-pro'),
    mistral('mistral-large-latest'),
    deepseek('deepseek-chat'),
    xai('grok-3'),
    ollama('llama3.2'),
  ];

  it('isAnthropicConfig only matches anthropic configs', () => {
    expect(configs.filter(isAnthropicConfig)).toHaveLength(1);
    expect(isAnthropicConfig(anthropic('claude-opus-4-8'))).toBe(true);
    expect(isAnthropicConfig(openai('gpt-4o'))).toBe(false);
  });

  it('isOpenAIConfig only matches openai configs', () => {
    expect(isOpenAIConfig(openai('gpt-4o'))).toBe(true);
    expect(isOpenAIConfig(anthropic('claude-opus-4-8'))).toBe(false);
  });

  it('isGeminiConfig only matches gemini configs', () => {
    expect(isGeminiConfig(gemini('gemini-1.5-pro'))).toBe(true);
    expect(isGeminiConfig(openai('gpt-4o'))).toBe(false);
  });

  it('isMistralConfig only matches mistral configs', () => {
    expect(isMistralConfig(mistral('mistral-large-latest'))).toBe(true);
    expect(isMistralConfig(openai('gpt-4o'))).toBe(false);
  });

  it('isDeepSeekConfig only matches deepseek configs', () => {
    expect(isDeepSeekConfig(deepseek('deepseek-chat'))).toBe(true);
    expect(isDeepSeekConfig(openai('gpt-4o'))).toBe(false);
  });

  it('isXAIConfig only matches xai configs', () => {
    expect(isXAIConfig(xai('grok-3'))).toBe(true);
    expect(isXAIConfig(openai('gpt-4o'))).toBe(false);
  });

  it('isOllamaConfig only matches ollama configs', () => {
    expect(isOllamaConfig(ollama('llama3.2'))).toBe(true);
    expect(isOllamaConfig(openai('gpt-4o'))).toBe(false);
  });

  it('every config in a mixed array matches exactly one guard', () => {
    const guards = [
      isAnthropicConfig,
      isOpenAIConfig,
      isGeminiConfig,
      isMistralConfig,
      isDeepSeekConfig,
      isXAIConfig,
      isOllamaConfig,
    ];
    for (const config of configs) {
      const matches = guards.filter((g) => g(config));
      expect(matches).toHaveLength(1);
    }
  });
});

describe('config-builders compile-time type safety (expectTypeOf)', () => {
  it('narrows config to allow tools/systemPrompt for capable models', () => {
    const config = anthropic('claude-opus-4-8', {
      systemPrompt: 'x',
    });
    expectTypeOf(config.config).toHaveProperty('systemPrompt');
    expectTypeOf(config.config).toHaveProperty('tools');
  });

  it('o1-mini config type does not expose tools/systemPrompt', () => {
    const config = openai('o1-mini');
    // o1-mini has tools:false, systemMessage:false in capabilities, so the
    // config type should NOT include those keys.
    expectTypeOf(config.config).not.toHaveProperty('tools');
    expectTypeOf(config.config).not.toHaveProperty('systemPrompt');
    // but it should expose reasoningEffort (extendedThinking: true)
    expectTypeOf(config.config).toHaveProperty('reasoningEffort');
  });
});
