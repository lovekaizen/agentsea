/**
 * Model pricing data and cost calculation utilities
 */

import type { ModelInfo, UsageInfo } from '../core/types.js';

// Pricing per million tokens (as of December 2024)
export const MODEL_PRICING: Record<string, { input: number; output: number }> =
  {
    // OpenAI Models
    'gpt-4o': { input: 2.5, output: 10.0 },
    'gpt-4o-2024-11-20': { input: 2.5, output: 10.0 },
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
    'gpt-4o-mini-2024-07-18': { input: 0.15, output: 0.6 },
    'gpt-4-turbo': { input: 10.0, output: 30.0 },
    'gpt-4-turbo-preview': { input: 10.0, output: 30.0 },
    'gpt-4': { input: 30.0, output: 60.0 },
    'gpt-4-32k': { input: 60.0, output: 120.0 },
    'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
    'gpt-3.5-turbo-0125': { input: 0.5, output: 1.5 },
    o1: { input: 15.0, output: 60.0 },
    'o1-preview': { input: 15.0, output: 60.0 },
    'o1-mini': { input: 3.0, output: 12.0 },

    // Anthropic Models
    'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
    'claude-3-5-sonnet-latest': { input: 3.0, output: 15.0 },
    'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
    'claude-3-5-haiku-20241022': { input: 0.8, output: 4.0 },
    'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
    'claude-3-opus-20240229': { input: 15.0, output: 75.0 },
    'claude-3-sonnet-20240229': { input: 3.0, output: 15.0 },

    // Google Gemini Models
    'gemini-1.5-pro': { input: 1.25, output: 5.0 },
    'gemini-1.5-pro-latest': { input: 1.25, output: 5.0 },
    'gemini-1.5-flash': { input: 0.075, output: 0.3 },
    'gemini-1.5-flash-latest': { input: 0.075, output: 0.3 },
    'gemini-2.0-flash-exp': { input: 0.1, output: 0.4 },
    'gemini-pro': { input: 0.5, output: 1.5 },

    // Mistral Models
    'mistral-large-latest': { input: 2.0, output: 6.0 },
    'mistral-medium-latest': { input: 2.7, output: 8.1 },
    'mistral-small-latest': { input: 0.2, output: 0.6 },
    'open-mistral-7b': { input: 0.25, output: 0.25 },
    'open-mixtral-8x7b': { input: 0.7, output: 0.7 },
    'open-mixtral-8x22b': { input: 2.0, output: 6.0 },

    // Cohere Models
    'command-r-plus': { input: 2.5, output: 10.0 },
    'command-r': { input: 0.5, output: 1.5 },
    command: { input: 1.0, output: 2.0 },

    // Groq Models (significantly cheaper)
    'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },
    'llama-3.1-70b-versatile': { input: 0.59, output: 0.79 },
    'llama-3.1-8b-instant': { input: 0.05, output: 0.08 },
    'mixtral-8x7b-32768': { input: 0.24, output: 0.24 },

    // Together AI Models
    'meta-llama/Llama-3.3-70B-Instruct-Turbo': { input: 0.88, output: 0.88 },
    'meta-llama/Llama-3.1-70B-Instruct-Turbo': { input: 0.88, output: 0.88 },
    'meta-llama/Llama-3.1-8B-Instruct-Turbo': { input: 0.18, output: 0.18 },
    'mistralai/Mixtral-8x7B-Instruct-v0.1': { input: 0.6, output: 0.6 },

    // Local models (free)
    llama3: { input: 0, output: 0 },
    'llama3.1': { input: 0, output: 0 },
    'llama3.2': { input: 0, output: 0 },
    mistral: { input: 0, output: 0 },
    codellama: { input: 0, output: 0 },
    phi3: { input: 0, output: 0 },
    'qwen2.5': { input: 0, output: 0 },
  };

// Model context windows
export const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  // OpenAI
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-4-turbo': 128000,
  'gpt-4': 8192,
  'gpt-4-32k': 32768,
  'gpt-3.5-turbo': 16385,
  o1: 200000,
  'o1-preview': 128000,
  'o1-mini': 128000,

  // Anthropic
  'claude-3-5-sonnet-20241022': 200000,
  'claude-sonnet-4-20250514': 200000,
  'claude-3-5-haiku-20241022': 200000,
  'claude-3-opus-20240229': 200000,
  'claude-3-sonnet-20240229': 200000,
  'claude-3-haiku-20240307': 200000,

  // Google
  'gemini-1.5-pro': 2000000,
  'gemini-1.5-flash': 1000000,
  'gemini-2.0-flash-exp': 1000000,
  'gemini-pro': 32000,

  // Mistral
  'mistral-large-latest': 128000,
  'mistral-medium-latest': 32000,
  'mistral-small-latest': 32000,

  // Groq
  'llama-3.3-70b-versatile': 128000,
  'llama-3.1-70b-versatile': 131072,
  'llama-3.1-8b-instant': 131072,
  'mixtral-8x7b-32768': 32768,
};

// Model max output tokens
export const MODEL_MAX_OUTPUT: Record<string, number> = {
  // OpenAI
  'gpt-4o': 16384,
  'gpt-4o-mini': 16384,
  'gpt-4-turbo': 4096,
  'gpt-4': 8192,
  'gpt-3.5-turbo': 4096,
  o1: 100000,
  'o1-preview': 32768,
  'o1-mini': 65536,

  // Anthropic
  'claude-3-5-sonnet-20241022': 8192,
  'claude-sonnet-4-20250514': 16384,
  'claude-3-opus-20240229': 4096,

  // Google
  'gemini-1.5-pro': 8192,
  'gemini-1.5-flash': 8192,
};

/**
 * Calculate the cost of a request based on token usage
 */
export function calculateCost(model: string, usage: UsageInfo): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) {
    // Unknown model, return 0
    return 0;
  }

  const inputCost = (usage.prompt_tokens / 1_000_000) * pricing.input;
  const outputCost = (usage.completion_tokens / 1_000_000) * pricing.output;

  return inputCost + outputCost;
}

/**
 * Estimate the cost of a request before execution
 */
export function estimateCost(
  model: string,
  estimatedInputTokens: number,
  estimatedOutputTokens: number,
): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) {
    return 0;
  }

  const inputCost = (estimatedInputTokens / 1_000_000) * pricing.input;
  const outputCost = (estimatedOutputTokens / 1_000_000) * pricing.output;

  return inputCost + outputCost;
}

/**
 * Get pricing for a model
 */
export function getModelPricing(
  model: string,
): { input: number; output: number } | null {
  return MODEL_PRICING[model] || null;
}

/**
 * Get model info including pricing and capabilities
 */
export function getModelInfo(model: string, provider: string): ModelInfo {
  const pricing = MODEL_PRICING[model] || { input: 0, output: 0 };
  const contextWindow = MODEL_CONTEXT_WINDOWS[model] || 4096;
  const maxOutput = MODEL_MAX_OUTPUT[model] || 4096;

  return {
    id: model,
    provider,
    contextWindow,
    maxOutputTokens: maxOutput,
    inputPricePerMillion: pricing.input,
    outputPricePerMillion: pricing.output,
    capabilities: getModelCapabilities(model, provider),
  };
}

/**
 * Get model capabilities based on model ID and provider
 */
export function getModelCapabilities(
  model: string,
  provider: string,
): ModelInfo['capabilities'] {
  // Default capabilities
  const defaults = {
    streaming: true,
    tools: true,
    vision: false,
    json_mode: true,
    system_prompts: true,
  };

  // Model-specific overrides
  if (model.includes('gpt-4o') || model.includes('gpt-4-turbo')) {
    return { ...defaults, vision: true };
  }

  if (model.includes('o1')) {
    return {
      streaming: false, // o1 doesn't support streaming
      tools: false,
      vision: false,
      json_mode: false,
      system_prompts: false, // o1 uses developer messages
    };
  }

  if (model.includes('claude-3')) {
    return { ...defaults, vision: true };
  }

  if (model.includes('gemini')) {
    return { ...defaults, vision: true };
  }

  if (provider === 'ollama') {
    return {
      streaming: true,
      tools: false, // Most Ollama models don't support tools natively
      vision: model.includes('llava') || model.includes('bakllava'),
      json_mode: true,
      system_prompts: true,
    };
  }

  return defaults;
}

/**
 * Find the cheapest model for a given capability requirement
 */
export function findCheapestModel(
  models: string[],
  _requiredCapabilities?: Partial<ModelInfo['capabilities']>,
): string | null {
  let cheapest: { model: string; cost: number } | null = null;

  for (const model of models) {
    const pricing = MODEL_PRICING[model];
    if (!pricing) continue;

    // Average cost (assuming roughly equal input/output)
    const avgCost = (pricing.input + pricing.output) / 2;

    if (!cheapest || avgCost < cheapest.cost) {
      cheapest = { model, cost: avgCost };
    }
  }

  return cheapest?.model || null;
}

/**
 * Sort models by cost (cheapest first)
 */
export function sortModelsByCost(
  models: string[],
  direction: 'asc' | 'desc' = 'asc',
): string[] {
  return [...models].sort((a, b) => {
    const pricingA = MODEL_PRICING[a] || { input: 0, output: 0 };
    const pricingB = MODEL_PRICING[b] || { input: 0, output: 0 };

    const costA = (pricingA.input + pricingA.output) / 2;
    const costB = (pricingB.input + pricingB.output) / 2;

    return direction === 'asc' ? costA - costB : costB - costA;
  });
}
