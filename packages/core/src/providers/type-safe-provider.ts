/**
 * Type-Safe Provider Factory
 *
 * This module provides compile-time type safety for model-specific configurations.
 * Inspired by TanStack AI: https://tanstack.com/ai/latest/docs/guides/per-model-type-safety
 *
 * @example
 * ```ts
 * import { createProvider } from '@lov3kaizen/agentsea-core';
 *
 * // ✅ Valid: Claude 3.5 Sonnet supports tools and extended thinking
 * const anthropicProvider = createProvider(
 *   anthropic('claude-3-5-sonnet-20241022', {
 *     tools: [myTool],
 *     thinking: { type: 'enabled', budgetTokens: 10000 },
 *   })
 * );
 *
 * // ❌ TypeScript error: o1-mini doesn't support tools
 * const openaiProvider = createProvider(
 *   openai('o1-mini', {
 *     tools: [myTool], // Error!
 *   })
 * );
 * ```
 */

import type {
  AnthropicModel,
  OpenAIModel,
  GeminiModel,
  AnthropicConfig,
  OpenAIConfig,
  GeminiConfig,
  OllamaConfig,
  ProviderModelConfig,
  ModelInfo,
  ModelCapabilities,
} from '../types';
import { getModelInfo, modelSupportsCapability } from '../types';

import { AnthropicProvider } from './anthropic';
import { OpenAIProvider } from './openai';
import { GeminiProvider } from './gemini';
import { OllamaProvider } from './ollama';

// ============================================================================
// Type-Safe Provider Wrapper
// ============================================================================

/**
 * A type-safe wrapper around LLM providers that preserves model information
 */
export interface TypeSafeProvider<TConfig extends ProviderModelConfig> {
  /** The provider configuration */
  readonly config: TConfig;

  /** The underlying LLM provider instance */
  readonly provider:
    | AnthropicProvider
    | OpenAIProvider
    | GeminiProvider
    | OllamaProvider;

  /** Get model information at runtime */
  getModelInfo(): ModelInfo | undefined;

  /** Check if the model supports a specific capability */
  supportsCapability(capability: keyof ModelCapabilities): boolean;
}

/**
 * Create a type-safe provider from configuration
 *
 * @example
 * ```ts
 * import { createProvider, anthropic, openai } from '@lov3kaizen/agentsea-core';
 *
 * // Type-safe Anthropic provider
 * const claude = createProvider(
 *   anthropic('claude-3-5-sonnet-20241022', {
 *     tools: [calculatorTool],
 *     systemPrompt: 'You are helpful',
 *     temperature: 0.7,
 *   })
 * );
 *
 * // Type-safe OpenAI provider
 * const gpt4o = createProvider(
 *   openai('gpt-4o', {
 *     tools: [calculatorTool],
 *     systemPrompt: 'You are helpful',
 *   })
 * );
 *
 * // o1 model - can use tools but NOT system prompts
 * const o1 = createProvider(
 *   openai('o1', {
 *     tools: [myTool],
 *     reasoningEffort: 'high',
 *     // systemPrompt: '...' // ❌ TypeScript error!
 *   })
 * );
 * ```
 */
export function createProvider<TConfig extends ProviderModelConfig>(
  config: TConfig,
): TypeSafeProvider<TConfig> {
  let provider:
    | AnthropicProvider
    | OpenAIProvider
    | GeminiProvider
    | OllamaProvider;

  switch (config.provider) {
    case 'anthropic':
      provider = new AnthropicProvider();
      break;
    case 'openai':
      provider = new OpenAIProvider();
      break;
    case 'gemini':
      provider = new GeminiProvider();
      break;
    case 'ollama':
      provider = new OllamaProvider();
      break;
    default: {
      const exhaustiveCheck: never = config;
      throw new Error(`Unknown provider: ${(exhaustiveCheck as any).provider}`);
    }
  }

  return {
    config,
    provider,
    getModelInfo() {
      return getModelInfo(config.model);
    },
    supportsCapability(capability: keyof ModelCapabilities) {
      return modelSupportsCapability(config.model, capability);
    },
  };
}

// ============================================================================
// Provider-Specific Factories
// ============================================================================

/**
 * Create a type-safe Anthropic provider
 */
export function createAnthropicProvider<TModel extends AnthropicModel>(
  config: AnthropicConfig<TModel>,
  options?: { apiKey?: string },
): TypeSafeProvider<AnthropicConfig<TModel>> & {
  provider: AnthropicProvider;
} {
  const provider = new AnthropicProvider(options?.apiKey);

  return {
    config,
    provider,
    getModelInfo() {
      return getModelInfo(config.model);
    },
    supportsCapability(capability: keyof ModelCapabilities) {
      return modelSupportsCapability(config.model, capability);
    },
  };
}

/**
 * Create a type-safe OpenAI provider
 */
export function createOpenAIProvider<TModel extends OpenAIModel>(
  config: OpenAIConfig<TModel>,
  options?: { apiKey?: string },
): TypeSafeProvider<OpenAIConfig<TModel>> & { provider: OpenAIProvider } {
  const provider = new OpenAIProvider(options?.apiKey);

  return {
    config,
    provider,
    getModelInfo() {
      return getModelInfo(config.model);
    },
    supportsCapability(capability: keyof ModelCapabilities) {
      return modelSupportsCapability(config.model, capability);
    },
  };
}

/**
 * Create a type-safe Gemini provider
 */
export function createGeminiProvider<TModel extends GeminiModel>(
  config: GeminiConfig<TModel>,
  options?: { apiKey?: string },
): TypeSafeProvider<GeminiConfig<TModel>> & { provider: GeminiProvider } {
  const provider = new GeminiProvider(options?.apiKey);

  return {
    config,
    provider,
    getModelInfo() {
      return getModelInfo(config.model);
    },
    supportsCapability(capability: keyof ModelCapabilities) {
      return modelSupportsCapability(config.model, capability);
    },
  };
}

/**
 * Create a type-safe Ollama provider
 */
export function createOllamaProvider(
  config: OllamaConfig,
  options?: { baseUrl?: string; timeout?: number },
): TypeSafeProvider<OllamaConfig> & { provider: OllamaProvider } {
  const provider = new OllamaProvider(options);

  return {
    config,
    provider,
    getModelInfo() {
      return getModelInfo(config.model);
    },
    supportsCapability(capability: keyof ModelCapabilities) {
      return modelSupportsCapability(config.model, capability);
    },
  };
}

// ============================================================================
// Utility Types for Advanced Usage
// ============================================================================

/**
 * Extract the model type from a provider configuration
 */
export type ExtractModel<T extends ProviderModelConfig> = T['model'];

/**
 * Extract the provider name from a configuration
 */
export type ExtractProviderName<T extends ProviderModelConfig> = T['provider'];

/**
 * Check if a model configuration supports a specific capability
 * This is useful for conditional typing
 */
export type ConfigSupports<
  T extends ProviderModelConfig,
  TCapability extends keyof ModelCapabilities,
> =
  T extends AnthropicConfig<infer M>
    ? M extends keyof import('../types').AnthropicModelCapabilities
      ? import('../types').AnthropicModelCapabilities[M][TCapability] extends true
        ? true
        : false
      : false
    : T extends OpenAIConfig<infer M>
      ? M extends keyof import('../types').OpenAIModelCapabilities
        ? import('../types').OpenAIModelCapabilities[M][TCapability] extends true
          ? true
          : false
        : false
      : T extends GeminiConfig<infer M>
        ? M extends keyof import('../types').GeminiModelCapabilities
          ? import('../types').GeminiModelCapabilities[M][TCapability] extends true
            ? true
            : false
          : false
        : false;

/**
 * Require a capability for a function parameter
 *
 * @example
 * ```ts
 * function withTools<T extends ProviderModelConfig>(
 *   provider: RequireCapability<T, 'tools'>
 * ) {
 *   // TypeScript ensures this provider supports tools
 * }
 * ```
 */
export type RequireCapability<
  T extends ProviderModelConfig,
  TCapability extends keyof ModelCapabilities,
> = ConfigSupports<T, TCapability> extends true ? T : never;
