/**
 * Type-Safe Configuration Builders
 *
 * These builders provide compile-time type safety for model configurations.
 * Invalid options for a specific model will cause TypeScript errors.
 *
 * @example
 * ```ts
 * // ✅ Valid: Claude Opus 4.8 supports tools
 * const config = anthropic('claude-opus-4-8', {
 *   tools: [myTool],
 *   systemPrompt: 'You are helpful',
 * });
 *
 * // ❌ TypeScript error: o1-mini doesn't support tools
 * const config = openai('o1-mini', {
 *   tools: [myTool], // Error: 'tools' does not exist in type
 * });
 * ```
 */

import type { Tool } from './index';
import type {
  AnthropicModel,
  AnthropicProviderOptions,
  AnthropicModelCapabilities,
  OpenAIModel,
  OpenAIProviderOptions,
  OpenAIModelCapabilities,
  GeminiModel,
  GeminiProviderOptions,
  GeminiModelCapabilities,
  MistralModel,
  MistralProviderOptions,
  MistralModelCapabilities,
  DeepSeekModel,
  DeepSeekProviderOptions,
  DeepSeekModelCapabilities,
  XAIModel,
  XAIProviderOptions,
  XAIModelCapabilities,
  OllamaModel,
  OllamaProviderOptions,
} from './models';

// ============================================================================
// Conditional Type Helpers
// ============================================================================

// Note: Conditional type helpers are implemented inline in the model-specific
// config types below for maximum type inference and IDE support.

// ============================================================================
// Anthropic Type-Safe Config
// ============================================================================

/**
 * Base config for all Anthropic models
 */
interface AnthropicBaseConfig {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
  providerOptions?: AnthropicProviderOptions;
}

/**
 * Tool-enabled config (for models that support tools)
 */
interface WithTools {
  tools?: Tool[];
}

/**
 * System prompt config (for models that support system messages)
 */
interface WithSystemPrompt {
  systemPrompt?: string;
}

/**
 * Extended thinking config (for models that support it)
 */
interface WithExtendedThinking {
  thinking?: {
    type: 'enabled';
    budgetTokens: number;
  };
}

/**
 * Get the config type for a specific Anthropic model
 */
type AnthropicConfigForModel<TModel extends AnthropicModel> =
  TModel extends keyof AnthropicModelCapabilities
    ? AnthropicBaseConfig &
        (AnthropicModelCapabilities[TModel]['tools'] extends true
          ? WithTools
          : object) &
        (AnthropicModelCapabilities[TModel]['systemMessage'] extends true
          ? WithSystemPrompt
          : object) &
        (AnthropicModelCapabilities[TModel]['extendedThinking'] extends true
          ? WithExtendedThinking
          : object)
    : AnthropicBaseConfig;

/**
 * Result type for Anthropic config
 */
export interface AnthropicConfig<TModel extends AnthropicModel> {
  provider: 'anthropic';
  model: TModel;
  config: AnthropicConfigForModel<TModel>;
}

/**
 * Create a type-safe Anthropic configuration
 *
 * @example
 * ```ts
 * // Claude Opus 4.8 (recommended default) - supports tools and system prompts.
 * // Note: temperature/top_p and budget_tokens-style thinking are removed at
 * // the API level on claude-fable-5, claude-opus-4-8, and claude-opus-4-7.
 * const config = anthropic('claude-opus-4-8', {
 *   tools: [calculatorTool],
 *   systemPrompt: 'You are a helpful assistant',
 * });
 *
 * // Claude Haiku 4.5 - fast/cheap; supports tools and system prompts
 * // but NOT extended thinking
 * const config = anthropic('claude-haiku-4-5-20251001', {
 *   tools: [calculatorTool],
 *   systemPrompt: 'You are helpful',
 *   // thinking: { ... } // ❌ Would be a TypeScript error
 * });
 * ```
 */
export function anthropic<TModel extends AnthropicModel>(
  model: TModel,
  config?: AnthropicConfigForModel<TModel>,
): AnthropicConfig<TModel> {
  return {
    provider: 'anthropic',
    model,
    config: config ?? ({} as AnthropicConfigForModel<TModel>),
  };
}

// ============================================================================
// OpenAI Type-Safe Config
// ============================================================================

/**
 * Base config for all OpenAI models
 */
interface OpenAIBaseConfig {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
  providerOptions?: OpenAIProviderOptions;
}

/**
 * Reasoning effort config (for o1/o3 models)
 */
interface WithReasoningEffort {
  reasoningEffort?: 'low' | 'medium' | 'high';
}

/**
 * Get the config type for a specific OpenAI model
 */
type OpenAIConfigForModel<TModel extends OpenAIModel> =
  TModel extends keyof OpenAIModelCapabilities
    ? OpenAIBaseConfig &
        (OpenAIModelCapabilities[TModel]['tools'] extends true
          ? WithTools
          : object) &
        (OpenAIModelCapabilities[TModel]['systemMessage'] extends true
          ? WithSystemPrompt
          : object) &
        (OpenAIModelCapabilities[TModel]['extendedThinking'] extends true
          ? WithReasoningEffort
          : object)
    : OpenAIBaseConfig;

/**
 * Result type for OpenAI config
 */
export interface OpenAIConfig<TModel extends OpenAIModel> {
  provider: 'openai';
  model: TModel;
  config: OpenAIConfigForModel<TModel>;
}

/**
 * Create a type-safe OpenAI configuration
 *
 * @example
 * ```ts
 * // GPT-4o - supports tools, system prompts, structured output
 * const config = openai('gpt-4o', {
 *   tools: [myTool],
 *   systemPrompt: 'You are helpful',
 *   temperature: 0.7,
 * });
 *
 * // o1-mini - NO tools, NO system prompts, has reasoning
 * const config = openai('o1-mini', {
 *   reasoningEffort: 'high',
 *   // tools: [...] // ❌ TypeScript error
 *   // systemPrompt: '...' // ❌ TypeScript error
 * });
 *
 * // o1 - supports tools but NO system prompts
 * const config = openai('o1', {
 *   tools: [myTool],
 *   reasoningEffort: 'medium',
 *   // systemPrompt: '...' // ❌ TypeScript error
 * });
 * ```
 */
export function openai<TModel extends OpenAIModel>(
  model: TModel,
  config?: OpenAIConfigForModel<TModel>,
): OpenAIConfig<TModel> {
  return {
    provider: 'openai',
    model,
    config: config ?? ({} as OpenAIConfigForModel<TModel>),
  };
}

// ============================================================================
// Gemini Type-Safe Config
// ============================================================================

/**
 * Base config for all Gemini models
 */
interface GeminiBaseConfig {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
  providerOptions?: GeminiProviderOptions;
}

/**
 * Get the config type for a specific Gemini model
 */
type GeminiConfigForModel<TModel extends GeminiModel> =
  TModel extends keyof GeminiModelCapabilities
    ? GeminiBaseConfig &
        (GeminiModelCapabilities[TModel]['tools'] extends true
          ? WithTools
          : object) &
        (GeminiModelCapabilities[TModel]['systemMessage'] extends true
          ? WithSystemPrompt
          : object)
    : GeminiBaseConfig;

/**
 * Result type for Gemini config
 */
export interface GeminiConfig<TModel extends GeminiModel> {
  provider: 'gemini';
  model: TModel;
  config: GeminiConfigForModel<TModel>;
}

/**
 * Create a type-safe Gemini configuration
 *
 * @example
 * ```ts
 * // Gemini 1.5 Pro - supports everything
 * const config = gemini('gemini-1.5-pro', {
 *   tools: [myTool],
 *   systemPrompt: 'You are helpful',
 *   topK: 40,
 * });
 * ```
 */
export function gemini<TModel extends GeminiModel>(
  model: TModel,
  config?: GeminiConfigForModel<TModel>,
): GeminiConfig<TModel> {
  return {
    provider: 'gemini',
    model,
    config: config ?? ({} as GeminiConfigForModel<TModel>),
  };
}

// ============================================================================
// Mistral Type-Safe Config
// ============================================================================

/**
 * Base config for all Mistral models
 */
interface MistralBaseConfig {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
  providerOptions?: MistralProviderOptions;
}

/**
 * Get the config type for a specific Mistral model
 */
type MistralConfigForModel<TModel extends MistralModel> =
  TModel extends keyof MistralModelCapabilities
    ? MistralBaseConfig &
        (MistralModelCapabilities[TModel]['tools'] extends true
          ? WithTools
          : object) &
        (MistralModelCapabilities[TModel]['systemMessage'] extends true
          ? WithSystemPrompt
          : object)
    : MistralBaseConfig;

/**
 * Result type for Mistral config
 */
export interface MistralConfig<TModel extends MistralModel> {
  provider: 'mistral';
  model: TModel;
  config: MistralConfigForModel<TModel>;
}

/**
 * Create a type-safe Mistral configuration
 */
export function mistral<TModel extends MistralModel>(
  model: TModel,
  config?: MistralConfigForModel<TModel>,
): MistralConfig<TModel> {
  return {
    provider: 'mistral',
    model,
    config: config ?? ({} as MistralConfigForModel<TModel>),
  };
}

// ============================================================================
// DeepSeek Type-Safe Config
// ============================================================================

/**
 * Base config for all DeepSeek models
 */
interface DeepSeekBaseConfig {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
  providerOptions?: DeepSeekProviderOptions;
}

/**
 * Get the config type for a specific DeepSeek model
 */
type DeepSeekConfigForModel<TModel extends DeepSeekModel> =
  TModel extends keyof DeepSeekModelCapabilities
    ? DeepSeekBaseConfig &
        (DeepSeekModelCapabilities[TModel]['tools'] extends true
          ? WithTools
          : object) &
        (DeepSeekModelCapabilities[TModel]['systemMessage'] extends true
          ? WithSystemPrompt
          : object)
    : DeepSeekBaseConfig;

/**
 * Result type for DeepSeek config
 */
export interface DeepSeekConfig<TModel extends DeepSeekModel> {
  provider: 'deepseek';
  model: TModel;
  config: DeepSeekConfigForModel<TModel>;
}

/**
 * Create a type-safe DeepSeek configuration
 */
export function deepseek<TModel extends DeepSeekModel>(
  model: TModel,
  config?: DeepSeekConfigForModel<TModel>,
): DeepSeekConfig<TModel> {
  return {
    provider: 'deepseek',
    model,
    config: config ?? ({} as DeepSeekConfigForModel<TModel>),
  };
}

// ============================================================================
// xAI (Grok) Type-Safe Config
// ============================================================================

/**
 * Base config for all xAI models
 */
interface XAIBaseConfig {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
  providerOptions?: XAIProviderOptions;
}

/**
 * Get the config type for a specific xAI model
 */
type XAIConfigForModel<TModel extends XAIModel> =
  TModel extends keyof XAIModelCapabilities
    ? XAIBaseConfig &
        (XAIModelCapabilities[TModel]['tools'] extends true
          ? WithTools
          : object) &
        (XAIModelCapabilities[TModel]['systemMessage'] extends true
          ? WithSystemPrompt
          : object) &
        (XAIModelCapabilities[TModel]['extendedThinking'] extends true
          ? WithReasoningEffort
          : object)
    : XAIBaseConfig;

/**
 * Result type for xAI config
 */
export interface XAIConfig<TModel extends XAIModel> {
  provider: 'xai';
  model: TModel;
  config: XAIConfigForModel<TModel>;
}

/**
 * Create a type-safe xAI (Grok) configuration
 */
export function xai<TModel extends XAIModel>(
  model: TModel,
  config?: XAIConfigForModel<TModel>,
): XAIConfig<TModel> {
  return {
    provider: 'xai',
    model,
    config: config ?? ({} as XAIConfigForModel<TModel>),
  };
}

// ============================================================================
// Ollama Type-Safe Config
// ============================================================================

/**
 * Base config for Ollama models (dynamic, so less strict typing)
 */
interface OllamaBaseConfig {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
  tools?: Tool[];
  systemPrompt?: string;
  providerOptions?: OllamaProviderOptions;
}

/**
 * Result type for Ollama config
 */
export interface OllamaConfig {
  provider: 'ollama';
  model: OllamaModel;
  config: OllamaBaseConfig;
}

/**
 * Create an Ollama configuration
 *
 * Note: Ollama models are dynamic, so type safety is less strict.
 * Tool support depends on the specific model being used.
 *
 * @example
 * ```ts
 * const config = ollama('llama3.2', {
 *   systemPrompt: 'You are helpful',
 *   temperature: 0.7,
 * });
 * ```
 */
export function ollama(
  model: OllamaModel,
  config?: OllamaBaseConfig,
): OllamaConfig {
  return {
    provider: 'ollama',
    model,
    config: config ?? {},
  };
}

// ============================================================================
// Unified Config Type
// ============================================================================

/**
 * Union of all provider configs
 */
export type ProviderModelConfig =
  | AnthropicConfig<AnthropicModel>
  | OpenAIConfig<OpenAIModel>
  | GeminiConfig<GeminiModel>
  | MistralConfig<MistralModel>
  | DeepSeekConfig<DeepSeekModel>
  | XAIConfig<XAIModel>
  | OllamaConfig;

/**
 * Extract the provider from a config
 */
export type ConfigProvider<T extends ProviderModelConfig> = T['provider'];

/**
 * Extract the model from a config
 */
export type ConfigModel<T extends ProviderModelConfig> = T['model'];

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if config is for Anthropic
 */
export function isAnthropicConfig(
  config: ProviderModelConfig,
): config is AnthropicConfig<AnthropicModel> {
  return config.provider === 'anthropic';
}

/**
 * Check if config is for OpenAI
 */
export function isOpenAIConfig(
  config: ProviderModelConfig,
): config is OpenAIConfig<OpenAIModel> {
  return config.provider === 'openai';
}

/**
 * Check if config is for Gemini
 */
export function isGeminiConfig(
  config: ProviderModelConfig,
): config is GeminiConfig<GeminiModel> {
  return config.provider === 'gemini';
}

/**
 * Check if config is for Mistral
 */
export function isMistralConfig(
  config: ProviderModelConfig,
): config is MistralConfig<MistralModel> {
  return config.provider === 'mistral';
}

/**
 * Check if config is for DeepSeek
 */
export function isDeepSeekConfig(
  config: ProviderModelConfig,
): config is DeepSeekConfig<DeepSeekModel> {
  return config.provider === 'deepseek';
}

/**
 * Check if config is for xAI (Grok)
 */
export function isXAIConfig(
  config: ProviderModelConfig,
): config is XAIConfig<XAIModel> {
  return config.provider === 'xai';
}

/**
 * Check if config is for Ollama
 */
export function isOllamaConfig(
  config: ProviderModelConfig,
): config is OllamaConfig {
  return config.provider === 'ollama';
}
