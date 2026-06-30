/**
 * Model Pricing Registry
 *
 * Manages pricing information for AI models across providers.
 */

import type {
  AIProvider,
  ModelPricing,
  PricingRegistryConfig,
  ProviderPricingSummary,
  PricingComparison,
} from '../types/index.js';

/**
 * Default pricing data (as of June 2026)
 * Prices are per 1M tokens in USD
 */
const DEFAULT_PRICING: ModelPricing[] = [
  // ---- Anthropic Models ----
  // Claude Fable 5 — most capable model. Adaptive thinking + effort param;
  // no budget_tokens extended thinking, no assistant prefill;
  // temperature/top_p removed at the API level.
  {
    model: 'claude-fable-5',
    provider: 'anthropic',
    displayName: 'Claude Fable 5',
    inputPricePerMillion: 10.0,
    outputPricePerMillion: 50.0,
    cacheReadPricePerMillion: 1.0,
    cacheWritePricePerMillion: 12.5,
    contextWindow: 1000000,
    maxOutputTokens: 128000,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
      extendedThinking: true,
    },
  },
  // Claude Opus 4.8 — recommended default. Adaptive thinking + effort param;
  // no budget_tokens extended thinking, no assistant prefill;
  // temperature/top_p removed at the API level.
  {
    model: 'claude-opus-4-8',
    provider: 'anthropic',
    displayName: 'Claude Opus 4.8',
    inputPricePerMillion: 5.0,
    outputPricePerMillion: 25.0,
    cacheReadPricePerMillion: 0.5,
    cacheWritePricePerMillion: 6.25,
    contextWindow: 1000000,
    maxOutputTokens: 128000,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
      extendedThinking: true,
    },
  },
  // Claude Opus 4.7 — previous-generation Opus. Adaptive thinking + effort
  // param; no budget_tokens extended thinking, no assistant prefill;
  // temperature/top_p removed at the API level.
  {
    model: 'claude-opus-4-7',
    provider: 'anthropic',
    displayName: 'Claude Opus 4.7',
    inputPricePerMillion: 5.0,
    outputPricePerMillion: 25.0,
    cacheReadPricePerMillion: 0.5,
    cacheWritePricePerMillion: 6.25,
    contextWindow: 1000000,
    maxOutputTokens: 128000,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
      extendedThinking: true,
    },
  },
  // Claude Sonnet 4.6 — best speed/intelligence balance. Adaptive thinking +
  // effort param; no budget_tokens extended thinking, no assistant prefill.
  {
    model: 'claude-sonnet-4-6',
    provider: 'anthropic',
    displayName: 'Claude Sonnet 4.6',
    inputPricePerMillion: 3.0,
    outputPricePerMillion: 15.0,
    cacheReadPricePerMillion: 0.3,
    cacheWritePricePerMillion: 3.75,
    contextWindow: 1000000,
    maxOutputTokens: 64000,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
      extendedThinking: true,
    },
  },
  {
    model: 'claude-opus-4-6',
    provider: 'anthropic',
    displayName: 'Claude Opus 4.6',
    inputPricePerMillion: 5.0,
    outputPricePerMillion: 25.0,
    cacheReadPricePerMillion: 0.5,
    cacheWritePricePerMillion: 6.25,
    contextWindow: 1000000,
    maxOutputTokens: 128000,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
      extendedThinking: true,
    },
  },
  {
    model: 'claude-sonnet-4-5-20250929',
    provider: 'anthropic',
    displayName: 'Claude Sonnet 4.5',
    inputPricePerMillion: 3.0,
    outputPricePerMillion: 15.0,
    cacheReadPricePerMillion: 0.3,
    cacheWritePricePerMillion: 3.75,
    contextWindow: 200000,
    maxOutputTokens: 16000,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
      extendedThinking: true,
    },
  },
  {
    model: 'claude-haiku-4-5-20251001',
    provider: 'anthropic',
    displayName: 'Claude Haiku 4.5',
    inputPricePerMillion: 0.8,
    outputPricePerMillion: 4.0,
    cacheReadPricePerMillion: 0.08,
    cacheWritePricePerMillion: 1.0,
    contextWindow: 200000,
    maxOutputTokens: 8192,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
    },
  },
  {
    model: 'claude-opus-4-5-20251101',
    provider: 'anthropic',
    displayName: 'Claude Opus 4.5',
    inputPricePerMillion: 5.0,
    outputPricePerMillion: 25.0,
    cacheReadPricePerMillion: 0.5,
    cacheWritePricePerMillion: 6.25,
    contextWindow: 200000,
    maxOutputTokens: 32000,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
      extendedThinking: true,
    },
  },
  /** @deprecated Retiring 2026-06-15. Use 'claude-opus-4-8' instead. */
  {
    model: 'claude-opus-4-0-20250514',
    provider: 'anthropic',
    displayName: 'Claude Opus 4',
    deprecated: true,
    inputPricePerMillion: 15.0,
    outputPricePerMillion: 75.0,
    cacheReadPricePerMillion: 1.5,
    cacheWritePricePerMillion: 18.75,
    contextWindow: 200000,
    maxOutputTokens: 32000,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
      extendedThinking: true,
    },
  },
  /** @deprecated Retiring 2026-06-15. Use 'claude-sonnet-4-6' instead. */
  {
    model: 'claude-sonnet-4-0-20250514',
    provider: 'anthropic',
    displayName: 'Claude Sonnet 4',
    deprecated: true,
    inputPricePerMillion: 3.0,
    outputPricePerMillion: 15.0,
    cacheReadPricePerMillion: 0.3,
    cacheWritePricePerMillion: 3.75,
    contextWindow: 200000,
    maxOutputTokens: 16000,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
      extendedThinking: true,
    },
  },
  /** @deprecated Retired 2026-02-19 (API returns 404). Use 'claude-sonnet-4-6' instead. */
  {
    model: 'claude-3-7-sonnet-20250219',
    provider: 'anthropic',
    displayName: 'Claude 3.7 Sonnet',
    deprecated: true,
    inputPricePerMillion: 3.0,
    outputPricePerMillion: 15.0,
    cacheReadPricePerMillion: 0.3,
    cacheWritePricePerMillion: 3.75,
    contextWindow: 200000,
    maxOutputTokens: 128000,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
      extendedThinking: true,
      computerUse: true,
    },
  },
  /** @deprecated Retired 2025-10-28 (API returns 404). Use 'claude-sonnet-4-6' instead. */
  {
    model: 'claude-3-5-sonnet-20241022',
    provider: 'anthropic',
    displayName: 'Claude 3.5 Sonnet',
    deprecated: true,
    inputPricePerMillion: 3.0,
    outputPricePerMillion: 15.0,
    cacheReadPricePerMillion: 0.3,
    cacheWritePricePerMillion: 3.75,
    contextWindow: 200000,
    maxOutputTokens: 8192,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
      computerUse: true,
    },
  },
  /** @deprecated Retired 2026-02-19 (API returns 404). Use 'claude-haiku-4-5' instead. */
  {
    model: 'claude-3-5-haiku-20241022',
    provider: 'anthropic',
    displayName: 'Claude 3.5 Haiku',
    deprecated: true,
    inputPricePerMillion: 0.8,
    outputPricePerMillion: 4.0,
    cacheReadPricePerMillion: 0.08,
    cacheWritePricePerMillion: 1.0,
    contextWindow: 200000,
    maxOutputTokens: 8192,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
    },
  },
  /** @deprecated Retired 2026-01-05 (API returns 404). Use 'claude-opus-4-8' instead. */
  {
    model: 'claude-3-opus-20240229',
    provider: 'anthropic',
    displayName: 'Claude 3 Opus',
    deprecated: true,
    inputPricePerMillion: 15.0,
    outputPricePerMillion: 75.0,
    cacheReadPricePerMillion: 1.5,
    cacheWritePricePerMillion: 18.75,
    contextWindow: 200000,
    maxOutputTokens: 4096,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
    },
  },
  /** @deprecated Retired 2026-04-19 (API returns 404). Use 'claude-haiku-4-5' instead. */
  {
    model: 'claude-3-haiku-20240307',
    provider: 'anthropic',
    displayName: 'Claude 3 Haiku',
    deprecated: true,
    inputPricePerMillion: 0.25,
    outputPricePerMillion: 1.25,
    cacheReadPricePerMillion: 0.03,
    cacheWritePricePerMillion: 0.3,
    contextWindow: 200000,
    maxOutputTokens: 4096,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
    },
  },

  // ---- OpenAI Models ----
  {
    model: 'gpt-4.1',
    provider: 'openai',
    displayName: 'GPT-4.1',
    inputPricePerMillion: 2.0,
    outputPricePerMillion: 8.0,
    contextWindow: 1047576,
    maxOutputTokens: 32768,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
    },
  },
  {
    model: 'gpt-4.1-mini',
    provider: 'openai',
    displayName: 'GPT-4.1 Mini',
    inputPricePerMillion: 0.4,
    outputPricePerMillion: 1.6,
    contextWindow: 1047576,
    maxOutputTokens: 16384,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
    },
  },
  {
    model: 'gpt-4.1-nano',
    provider: 'openai',
    displayName: 'GPT-4.1 Nano',
    inputPricePerMillion: 0.1,
    outputPricePerMillion: 0.4,
    contextWindow: 1047576,
    maxOutputTokens: 16384,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
    },
  },
  {
    model: 'gpt-5.5',
    provider: 'openai',
    displayName: 'GPT-5.5',
    inputPricePerMillion: 5.0,
    outputPricePerMillion: 30.0,
    contextWindow: 1050000,
    maxOutputTokens: 128000,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
    },
  },
  {
    model: 'gpt-5.4-mini',
    provider: 'openai',
    displayName: 'GPT-5.4 Mini',
    inputPricePerMillion: 0.75,
    outputPricePerMillion: 4.5,
    contextWindow: 400000,
    maxOutputTokens: 128000,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
    },
  },
  {
    model: 'gpt-5.2',
    provider: 'openai',
    displayName: 'GPT-5.2',
    inputPricePerMillion: 1.75,
    outputPricePerMillion: 14.0,
    contextWindow: 400000,
    maxOutputTokens: 128000,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
    },
  },
  {
    model: 'gpt-5.2-pro',
    provider: 'openai',
    displayName: 'GPT-5.2 Pro',
    inputPricePerMillion: 21.0,
    outputPricePerMillion: 168.0,
    contextWindow: 400000,
    maxOutputTokens: 128000,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
    },
  },
  {
    model: 'gpt-5.2-codex',
    provider: 'openai',
    displayName: 'GPT-5.2 Codex',
    inputPricePerMillion: 1.75,
    outputPricePerMillion: 14.0,
    contextWindow: 400000,
    maxOutputTokens: 128000,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
    },
  },
  {
    model: 'gpt-5.1',
    provider: 'openai',
    displayName: 'GPT-5.1',
    inputPricePerMillion: 1.25,
    outputPricePerMillion: 10.0,
    contextWindow: 400000,
    maxOutputTokens: 128000,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
    },
  },
  {
    model: 'gpt-5.1-codex',
    provider: 'openai',
    displayName: 'GPT-5.1 Codex',
    inputPricePerMillion: 1.25,
    outputPricePerMillion: 10.0,
    contextWindow: 400000,
    maxOutputTokens: 128000,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
    },
  },
  {
    model: 'gpt-5.1-codex-mini',
    provider: 'openai',
    displayName: 'GPT-5.1 Codex Mini',
    inputPricePerMillion: 0.25,
    outputPricePerMillion: 2.0,
    contextWindow: 400000,
    maxOutputTokens: 128000,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
    },
  },
  {
    model: 'gpt-5.1-codex-max',
    provider: 'openai',
    displayName: 'GPT-5.1 Codex Max',
    inputPricePerMillion: 1.25,
    outputPricePerMillion: 10.0,
    contextWindow: 400000,
    maxOutputTokens: 128000,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
    },
  },
  {
    model: 'gpt-5',
    provider: 'openai',
    displayName: 'GPT-5',
    inputPricePerMillion: 1.25,
    outputPricePerMillion: 10.0,
    contextWindow: 400000,
    maxOutputTokens: 128000,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
    },
  },
  {
    model: 'gpt-5-mini',
    provider: 'openai',
    displayName: 'GPT-5 Mini',
    inputPricePerMillion: 0.25,
    outputPricePerMillion: 2.0,
    contextWindow: 400000,
    maxOutputTokens: 128000,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
    },
  },
  {
    model: 'gpt-5-nano',
    provider: 'openai',
    displayName: 'GPT-5 Nano',
    inputPricePerMillion: 0.05,
    outputPricePerMillion: 0.4,
    contextWindow: 400000,
    maxOutputTokens: 128000,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
    },
  },
  {
    model: 'gpt-5-pro',
    provider: 'openai',
    displayName: 'GPT-5 Pro',
    inputPricePerMillion: 15.0,
    outputPricePerMillion: 120.0,
    contextWindow: 400000,
    maxOutputTokens: 272000,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
    },
  },
  {
    model: 'gpt-4.5-preview',
    provider: 'openai',
    displayName: 'GPT-4.5 Preview',
    inputPricePerMillion: 75.0,
    outputPricePerMillion: 150.0,
    contextWindow: 128000,
    maxOutputTokens: 16384,
    currency: 'USD',
    deprecated: true,
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
    },
  },
  {
    model: 'o3',
    provider: 'openai',
    displayName: 'o3',
    inputPricePerMillion: 2.0,
    outputPricePerMillion: 8.0,
    contextWindow: 200000,
    maxOutputTokens: 100000,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
      extendedThinking: true,
    },
  },
  {
    model: 'o3-pro',
    provider: 'openai',
    displayName: 'o3 Pro',
    inputPricePerMillion: 20.0,
    outputPricePerMillion: 80.0,
    contextWindow: 200000,
    maxOutputTokens: 100000,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
      extendedThinking: true,
    },
  },
  {
    model: 'o4-mini',
    provider: 'openai',
    displayName: 'o4 Mini',
    inputPricePerMillion: 1.1,
    outputPricePerMillion: 4.4,
    contextWindow: 200000,
    maxOutputTokens: 100000,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
      extendedThinking: true,
    },
  },
  {
    model: 'o3-deep-research',
    provider: 'openai',
    displayName: 'o3 Deep Research',
    inputPricePerMillion: 10.0,
    outputPricePerMillion: 40.0,
    contextWindow: 200000,
    maxOutputTokens: 100000,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
      extendedThinking: true,
    },
  },
  {
    model: 'o4-mini-deep-research',
    provider: 'openai',
    displayName: 'o4 Mini Deep Research',
    inputPricePerMillion: 2.0,
    outputPricePerMillion: 8.0,
    contextWindow: 200000,
    maxOutputTokens: 100000,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
      extendedThinking: true,
    },
  },
  {
    model: 'o3-mini',
    provider: 'openai',
    displayName: 'o3 Mini',
    inputPricePerMillion: 1.1,
    outputPricePerMillion: 4.4,
    contextWindow: 200000,
    maxOutputTokens: 100000,
    currency: 'USD',
    capabilities: {
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      extendedThinking: true,
    },
  },
  {
    model: 'gpt-4o',
    provider: 'openai',
    displayName: 'GPT-4o',
    inputPricePerMillion: 2.5,
    outputPricePerMillion: 10.0,
    contextWindow: 128000,
    maxOutputTokens: 16384,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
    },
  },
  {
    model: 'gpt-4o-mini',
    provider: 'openai',
    displayName: 'GPT-4o Mini',
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.6,
    contextWindow: 128000,
    maxOutputTokens: 16384,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
    },
  },
  {
    model: 'o1',
    provider: 'openai',
    displayName: 'o1',
    inputPricePerMillion: 15.0,
    outputPricePerMillion: 60.0,
    contextWindow: 200000,
    maxOutputTokens: 100000,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      extendedThinking: true,
    },
  },
  {
    model: 'o1-mini',
    provider: 'openai',
    displayName: 'o1 Mini',
    inputPricePerMillion: 3.0,
    outputPricePerMillion: 12.0,
    contextWindow: 128000,
    maxOutputTokens: 65536,
    currency: 'USD',
    deprecated: true,
    capabilities: {
      streaming: true,
      extendedThinking: true,
    },
  },
  {
    model: 'gpt-4-turbo',
    provider: 'openai',
    displayName: 'GPT-4 Turbo',
    inputPricePerMillion: 10.0,
    outputPricePerMillion: 30.0,
    contextWindow: 128000,
    maxOutputTokens: 4096,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
    },
  },
  {
    model: 'gpt-3.5-turbo',
    provider: 'openai',
    displayName: 'GPT-3.5 Turbo',
    inputPricePerMillion: 0.5,
    outputPricePerMillion: 1.5,
    contextWindow: 16385,
    maxOutputTokens: 4096,
    currency: 'USD',
    deprecated: true,
    capabilities: {
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
    },
  },

  // ---- Google Models ----
  {
    model: 'gemini-3.1-pro-preview',
    provider: 'google',
    displayName: 'Gemini 3.1 Pro Preview',
    inputPricePerMillion: 2.0,
    outputPricePerMillion: 12.0,
    contextWindow: 1048576,
    maxOutputTokens: 65536,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
    },
  },
  {
    model: 'gemini-3.5-flash',
    provider: 'google',
    displayName: 'Gemini 3.5 Flash',
    inputPricePerMillion: 1.5,
    outputPricePerMillion: 9.0,
    contextWindow: 1048576,
    maxOutputTokens: 65536,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
    },
  },
  {
    model: 'gemini-2.5-pro',
    provider: 'google',
    displayName: 'Gemini 2.5 Pro',
    inputPricePerMillion: 1.25,
    outputPricePerMillion: 10.0,
    contextWindow: 1048576,
    maxOutputTokens: 65536,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
      extendedThinking: true,
    },
  },
  {
    model: 'gemini-2.5-flash',
    provider: 'google',
    displayName: 'Gemini 2.5 Flash',
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.6,
    contextWindow: 1048576,
    maxOutputTokens: 65536,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
      extendedThinking: true,
    },
  },
  {
    model: 'gemini-2.0-flash',
    provider: 'google',
    displayName: 'Gemini 2.0 Flash',
    inputPricePerMillion: 0.1,
    outputPricePerMillion: 0.4,
    contextWindow: 1048576,
    maxOutputTokens: 8192,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
    },
  },
  {
    model: 'gemini-2.0-flash-exp',
    provider: 'google',
    displayName: 'Gemini 2.0 Flash (Experimental)',
    inputPricePerMillion: 0.1,
    outputPricePerMillion: 0.4,
    contextWindow: 1048576,
    maxOutputTokens: 8192,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
    },
  },
  {
    model: 'gemini-1.5-pro',
    provider: 'google',
    displayName: 'Gemini 1.5 Pro',
    inputPricePerMillion: 1.25,
    outputPricePerMillion: 5.0,
    contextWindow: 2097152,
    maxOutputTokens: 8192,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
    },
  },
  {
    model: 'gemini-1.5-flash',
    provider: 'google',
    displayName: 'Gemini 1.5 Flash',
    inputPricePerMillion: 0.075,
    outputPricePerMillion: 0.3,
    contextWindow: 1048576,
    maxOutputTokens: 8192,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
    },
  },

  // ---- Mistral Models ----
  {
    model: 'mistral-large-latest',
    provider: 'mistral',
    displayName: 'Mistral Large',
    inputPricePerMillion: 2.0,
    outputPricePerMillion: 6.0,
    contextWindow: 128000,
    maxOutputTokens: 4096,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
    },
  },
  {
    model: 'mistral-small-latest',
    provider: 'mistral',
    displayName: 'Mistral Small',
    inputPricePerMillion: 0.1,
    outputPricePerMillion: 0.3,
    contextWindow: 128000,
    maxOutputTokens: 4096,
    currency: 'USD',
    capabilities: {
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
    },
  },
  {
    model: 'codestral-latest',
    provider: 'mistral',
    displayName: 'Codestral',
    inputPricePerMillion: 0.3,
    outputPricePerMillion: 0.9,
    contextWindow: 256000,
    maxOutputTokens: 4096,
    currency: 'USD',
    capabilities: {
      streaming: true,
      systemMessage: true,
    },
  },

  // ---- DeepSeek Models ----
  {
    model: 'deepseek-chat',
    provider: 'deepseek',
    displayName: 'DeepSeek V3.2',
    inputPricePerMillion: 0.28,
    outputPricePerMillion: 0.42,
    cacheReadPricePerMillion: 0.028,
    contextWindow: 128000,
    maxOutputTokens: 8192,
    currency: 'USD',
    capabilities: {
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
    },
  },
  {
    model: 'deepseek-reasoner',
    provider: 'deepseek',
    displayName: 'DeepSeek R1',
    inputPricePerMillion: 0.28,
    outputPricePerMillion: 0.42,
    cacheReadPricePerMillion: 0.028,
    contextWindow: 128000,
    maxOutputTokens: 65536,
    currency: 'USD',
    capabilities: {
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
      extendedThinking: true,
    },
  },

  // ---- xAI (Grok) Models ----
  {
    model: 'grok-3',
    provider: 'xai',
    displayName: 'Grok 3',
    inputPricePerMillion: 3.0,
    outputPricePerMillion: 15.0,
    contextWindow: 131072,
    maxOutputTokens: 16384,
    currency: 'USD',
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
    },
  },
  {
    model: 'grok-3-mini',
    provider: 'xai',
    displayName: 'Grok 3 Mini',
    inputPricePerMillion: 0.3,
    outputPricePerMillion: 0.5,
    contextWindow: 131072,
    maxOutputTokens: 16384,
    currency: 'USD',
    capabilities: {
      functionCalling: true,
      streaming: true,
      jsonMode: true,
      systemMessage: true,
      extendedThinking: true,
    },
  },

  // ---- Cohere Models ----
  {
    model: 'command-r-plus',
    provider: 'cohere',
    displayName: 'Command R+',
    inputPricePerMillion: 2.5,
    outputPricePerMillion: 10.0,
    contextWindow: 128000,
    maxOutputTokens: 4096,
    currency: 'USD',
    capabilities: {
      functionCalling: true,
      streaming: true,
      systemMessage: true,
    },
  },
  // Cohere — priced here for cost tracking only. There is no typed Cohere
  // provider/builder yet, so these are intentionally absent from the
  // @lov3kaizen/agentsea-types MODEL_REGISTRY.
  {
    model: 'command-r',
    provider: 'cohere',
    displayName: 'Command R',
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.6,
    contextWindow: 128000,
    maxOutputTokens: 4096,
    currency: 'USD',
    capabilities: {
      functionCalling: true,
      streaming: true,
      systemMessage: true,
    },
  },
];

/**
 * Model Pricing Registry
 */
export class ModelPricingRegistry {
  private pricing: Map<string, ModelPricing> = new Map();
  private config: PricingRegistryConfig;
  private updateTimer?: ReturnType<typeof setInterval>;

  constructor(config: PricingRegistryConfig = {}) {
    this.config = {
      autoUpdate: config.autoUpdate ?? false,
      updateInterval: config.updateInterval ?? 24 * 60 * 60 * 1000, // 24 hours
      defaultCurrency: config.defaultCurrency ?? 'USD',
      ...config,
    };

    // Load default pricing
    this.loadDefaultPricing();

    // Apply custom pricing overrides
    if (config.customPricing) {
      for (const pricing of config.customPricing) {
        this.registerModel(pricing);
      }
    }

    // Start auto-update if enabled
    if (this.config.autoUpdate && this.config.remotePricingUrl) {
      this.startAutoUpdate();
    }
  }

  /**
   * Load default pricing data
   */
  private loadDefaultPricing(): void {
    for (const pricing of DEFAULT_PRICING) {
      const key = this.getKey(pricing.provider, pricing.model);
      this.pricing.set(key, pricing);
    }
  }

  /**
   * Generate key for pricing lookup
   */
  private getKey(provider: AIProvider, model: string): string {
    return `${provider}:${model}`;
  }

  /**
   * Register or update model pricing
   */
  registerModel(pricing: ModelPricing): void {
    const key = this.getKey(pricing.provider, pricing.model);
    this.pricing.set(key, {
      ...pricing,
      effectiveDate: pricing.effectiveDate ?? new Date(),
    });
  }

  /**
   * Get pricing for a model
   */
  getPricing(provider: AIProvider, model: string): ModelPricing | null {
    const key = this.getKey(provider, model);
    return this.pricing.get(key) ?? null;
  }

  /**
   * Get pricing by model name (auto-detect provider)
   */
  getPricingByModel(model: string): ModelPricing | null {
    // Try exact match first
    for (const pricing of this.pricing.values()) {
      if (pricing.model === model) {
        return pricing;
      }
    }

    // Try partial match
    for (const pricing of this.pricing.values()) {
      if (pricing.model.includes(model) || model.includes(pricing.model)) {
        return pricing;
      }
    }

    return null;
  }

  /**
   * Calculate cost for token usage
   */
  calculateCost(
    provider: AIProvider,
    model: string,
    inputTokens: number,
    outputTokens: number,
    options?: {
      cacheReadTokens?: number;
      cacheWriteTokens?: number;
    },
  ): {
    inputCost: number;
    outputCost: number;
    cacheReadCost: number;
    cacheCost: number;
    totalCost: number;
    currency: string;
  } {
    const pricing = this.getPricing(provider, model);

    if (!pricing) {
      throw new Error(`No pricing found for ${provider}:${model}`);
    }

    const inputCost = (inputTokens / 1_000_000) * pricing.inputPricePerMillion;
    const outputCost =
      (outputTokens / 1_000_000) * pricing.outputPricePerMillion;

    const cacheReadCost = options?.cacheReadTokens
      ? (options.cacheReadTokens / 1_000_000) *
        (pricing.cacheReadPricePerMillion ?? 0)
      : 0;

    const cacheCost = options?.cacheWriteTokens
      ? (options.cacheWriteTokens / 1_000_000) *
        (pricing.cacheWritePricePerMillion ?? 0)
      : 0;

    return {
      inputCost,
      outputCost,
      cacheReadCost,
      cacheCost,
      totalCost: inputCost + outputCost + cacheReadCost + cacheCost,
      currency: pricing.currency,
    };
  }

  /**
   * List all models for a provider
   */
  listModels(provider?: AIProvider): ModelPricing[] {
    const models: ModelPricing[] = [];

    for (const pricing of this.pricing.values()) {
      if (!provider || pricing.provider === provider) {
        models.push(pricing);
      }
    }

    return models.sort((a, b) => a.model.localeCompare(b.model));
  }

  /**
   * List all providers
   */
  listProviders(): AIProvider[] {
    const providers = new Set<AIProvider>();

    for (const pricing of this.pricing.values()) {
      providers.add(pricing.provider);
    }

    return Array.from(providers).sort();
  }

  /**
   * Get provider pricing summary
   */
  getProviderSummary(provider: AIProvider): ProviderPricingSummary | null {
    const models = this.listModels(provider);

    if (models.length === 0) {
      return null;
    }

    const inputPrices = models.map((m) => m.inputPricePerMillion);
    const outputPrices = models.map((m) => m.outputPricePerMillion);

    return {
      provider,
      modelCount: models.length,
      minInputPrice: Math.min(...inputPrices),
      maxInputPrice: Math.max(...inputPrices),
      minOutputPrice: Math.min(...outputPrices),
      maxOutputPrice: Math.max(...outputPrices),
      models: models.map((m) => m.model),
    };
  }

  /**
   * Compare pricing between two models
   */
  comparePricing(
    modelA: string,
    modelB: string,
    sampleTokens?: { input: number; output: number },
  ): PricingComparison | null {
    const pricingA = this.getPricingByModel(modelA);
    const pricingB = this.getPricingByModel(modelB);

    if (!pricingA || !pricingB) {
      return null;
    }

    const inputDiff =
      pricingA.inputPricePerMillion - pricingB.inputPricePerMillion;
    const outputDiff =
      pricingA.outputPricePerMillion - pricingB.outputPricePerMillion;

    const avgPriceA =
      (pricingA.inputPricePerMillion + pricingA.outputPricePerMillion) / 2;
    const avgPriceB =
      (pricingB.inputPricePerMillion + pricingB.outputPricePerMillion) / 2;

    const percentageDiff = ((avgPriceA - avgPriceB) / avgPriceB) * 100;

    let estimatedSavings: number | undefined;
    if (sampleTokens) {
      const costA =
        (sampleTokens.input / 1_000_000) * pricingA.inputPricePerMillion +
        (sampleTokens.output / 1_000_000) * pricingA.outputPricePerMillion;
      const costB =
        (sampleTokens.input / 1_000_000) * pricingB.inputPricePerMillion +
        (sampleTokens.output / 1_000_000) * pricingB.outputPricePerMillion;
      estimatedSavings = Math.abs(costA - costB);
    }

    return {
      modelA,
      modelB,
      inputPriceDiff: inputDiff,
      outputPriceDiff: outputDiff,
      percentageDiff,
      cheaperModel: avgPriceA < avgPriceB ? modelA : modelB,
      estimatedSavings,
    };
  }

  /**
   * Find cheapest model with required capabilities
   */
  findCheapestModel(options?: {
    provider?: AIProvider;
    minContextWindow?: number;
    requireVision?: boolean;
    requireFunctionCalling?: boolean;
    weightInput?: number; // Weight for input price (default 0.5)
    weightOutput?: number; // Weight for output price (default 0.5)
  }): ModelPricing | null {
    const weightInput = options?.weightInput ?? 0.5;
    const weightOutput = options?.weightOutput ?? 0.5;

    let cheapest: ModelPricing | null = null;
    let cheapestScore = Infinity;

    for (const pricing of this.pricing.values()) {
      // Apply filters
      if (options?.provider && pricing.provider !== options.provider) {
        continue;
      }
      if (
        options?.minContextWindow &&
        pricing.contextWindow &&
        pricing.contextWindow < options.minContextWindow
      ) {
        continue;
      }
      if (options?.requireVision && !pricing.capabilities?.vision) {
        continue;
      }
      if (
        options?.requireFunctionCalling &&
        !pricing.capabilities?.functionCalling
      ) {
        continue;
      }
      if (pricing.deprecated) {
        continue;
      }

      // Calculate weighted score
      const score =
        pricing.inputPricePerMillion * weightInput +
        pricing.outputPricePerMillion * weightOutput;

      if (score < cheapestScore) {
        cheapestScore = score;
        cheapest = pricing;
      }
    }

    return cheapest;
  }

  /**
   * Start auto-update timer
   */
  private startAutoUpdate(): void {
    if (this.updateTimer) {
      return;
    }

    this.updateTimer = setInterval(() => {
      void (async () => {
        try {
          await this.updateFromRemote();
        } catch {
          // Silently ignore update errors
        }
      })();
    }, this.config.updateInterval);
  }

  /**
   * Stop auto-update timer
   */
  stopAutoUpdate(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = undefined;
    }
  }

  /**
   * Update pricing from remote source
   */
  async updateFromRemote(): Promise<void> {
    if (!this.config.remotePricingUrl) {
      throw new Error('No remote pricing URL configured');
    }

    const response = await fetch(this.config.remotePricingUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch pricing: ${response.statusText}`);
    }

    const data = (await response.json()) as ModelPricing[];

    for (const pricing of data) {
      this.registerModel(pricing);
    }
  }

  /**
   * Export all pricing data
   */
  exportPricing(): ModelPricing[] {
    return Array.from(this.pricing.values());
  }

  /**
   * Import pricing data
   */
  importPricing(data: ModelPricing[], replace = false): void {
    if (replace) {
      this.pricing.clear();
    }

    for (const pricing of data) {
      this.registerModel(pricing);
    }
  }

  /**
   * Clear all pricing data
   */
  clear(): void {
    this.pricing.clear();
  }

  /**
   * Reload default pricing
   */
  reset(): void {
    this.clear();
    this.loadDefaultPricing();
  }
}
