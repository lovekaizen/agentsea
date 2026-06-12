/**
 * Per-Model Type Safety
 *
 * This module provides compile-time type safety for model-specific configurations.
 * Inspired by TanStack AI's approach: https://tanstack.com/ai/latest/docs/guides/per-model-type-safety
 *
 * Key concepts:
 * - ModelCapabilities: Define what features each model supports
 * - Per-model config types: TypeScript narrows options based on model selection
 * - Zero runtime overhead: All validation happens at compile time
 */

// ============================================================================
// Model Capability Definitions
// ============================================================================

/**
 * All possible capabilities a model can have
 */
export interface ModelCapabilities {
  /** Supports function/tool calling */
  tools: boolean;
  /** Supports streaming responses */
  streaming: boolean;
  /** Supports vision/image inputs */
  vision: boolean;
  /** Supports structured JSON output */
  structuredOutput: boolean;
  /** Supports system messages */
  systemMessage: boolean;
  /** Supports extended thinking/reasoning */
  extendedThinking: boolean;
  /** Maximum context window in tokens */
  contextWindow: number;
  /** Maximum output tokens */
  maxOutputTokens: number;
  /** Supports parallel tool calls */
  parallelToolCalls: boolean;
}

/**
 * Base model definition
 */
export interface ModelDefinition<
  TProvider extends string = string,
  TModel extends string = string,
  TCapabilities extends Partial<ModelCapabilities> = ModelCapabilities,
> {
  provider: TProvider;
  model: TModel;
  capabilities: TCapabilities;
}

// ============================================================================
// Anthropic Models
// ============================================================================

export type AnthropicModel =
  // Claude 5 family (most capable; alias-only ID — no date-suffixed variant exists)
  | 'claude-fable-5'
  // Claude 4.x family (4.6+ aliases are the complete IDs — no date-suffixed variants exist)
  | 'claude-opus-4-8'
  | 'claude-opus-4-7'
  | 'claude-sonnet-4-6'
  | 'claude-opus-4-6'
  | 'claude-sonnet-4-5-20250929'
  | 'claude-sonnet-4-5-latest'
  | 'claude-haiku-4-5-20251001'
  | 'claude-haiku-4-5-latest'
  | 'claude-opus-4-5-20251101'
  | 'claude-opus-4-0-20250514'
  | 'claude-sonnet-4-0-20250514'
  // Claude 3.7 family
  | 'claude-3-7-sonnet-20250219'
  | 'claude-3-7-sonnet-latest'
  // Claude 3.5 family
  | 'claude-3-5-sonnet-20241022'
  | 'claude-3-5-sonnet-latest'
  | 'claude-3-5-haiku-20241022'
  | 'claude-3-5-haiku-latest'
  // Claude 3 family (legacy)
  | 'claude-3-opus-20240229'
  | 'claude-3-opus-latest'
  | 'claude-3-sonnet-20240229'
  | 'claude-3-haiku-20240307';

/**
 * Lifecycle notes for Anthropic model IDs (kept in the union for compile
 * compatibility of downstream consumers — do not remove):
 *
 * Deprecated (retiring 2026-06-15):
 * - `claude-opus-4-0-20250514` → use `claude-opus-4-8`
 * - `claude-sonnet-4-0-20250514` → use `claude-sonnet-4-6`
 *
 * Retired (API returns 404):
 * - `claude-3-7-sonnet-20250219` / `claude-3-7-sonnet-latest` (retired 2026-02-19) → use `claude-sonnet-4-6`
 * - `claude-3-5-sonnet-20241022` / `claude-3-5-sonnet-latest` (retired 2025-10-28) → use `claude-sonnet-4-6`
 * - `claude-3-5-haiku-20241022` / `claude-3-5-haiku-latest` (retired 2026-02-19) → use `claude-haiku-4-5`
 * - `claude-3-opus-20240229` / `claude-3-opus-latest` (retired 2026-01-05) → use `claude-opus-4-8`
 * - `claude-3-sonnet-20240229` (retired 2025-07-21) → use `claude-sonnet-4-6`
 * - `claude-3-haiku-20240307` (retired 2026-04-19) → use `claude-haiku-4-5`
 */

/**
 * Recommended default Anthropic model.
 */
export const DEFAULT_ANTHROPIC_MODEL: AnthropicModel = 'claude-opus-4-8';

/**
 * Recommended balanced (speed/intelligence) Anthropic model.
 */
export const DEFAULT_ANTHROPIC_BALANCED_MODEL: AnthropicModel =
  'claude-sonnet-4-6';

/**
 * Recommended fast/cheap Anthropic model.
 */
export const DEFAULT_ANTHROPIC_FAST_MODEL: AnthropicModel =
  'claude-haiku-4-5-20251001';

/**
 * Anthropic-specific provider options
 */
export interface AnthropicProviderOptions {
  /** Enable extended thinking (Claude 3.5+) */
  thinking?: {
    type: 'enabled';
    budgetTokens: number;
  };
  /** Metadata for request tracking */
  metadata?: {
    userId?: string;
  };
  /** Beta features to enable */
  betas?: string[];
}

/**
 * Model capabilities for Anthropic models
 */
export type AnthropicModelCapabilities = {
  /**
   * Claude Fable 5 — most capable model. 1M context, 128K output.
   * Adaptive thinking (always on) + effort parameter; no `budget_tokens`
   * extended thinking, no assistant prefill. `temperature`/`top_p` are
   * removed at the API level (sending them returns 400).
   */
  'claude-fable-5': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: true;
    contextWindow: 1000000;
    maxOutputTokens: 128000;
    parallelToolCalls: true;
  };
  /**
   * Claude Opus 4.8 — recommended default. 1M context, 128K output.
   * Adaptive thinking + effort parameter; no `budget_tokens` extended
   * thinking, no assistant prefill. `temperature`/`top_p` are removed at
   * the API level (sending them returns 400).
   */
  'claude-opus-4-8': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: true;
    contextWindow: 1000000;
    maxOutputTokens: 128000;
    parallelToolCalls: true;
  };
  /**
   * Claude Opus 4.7 — previous-generation Opus. 1M context, 128K output.
   * Adaptive thinking + effort parameter; no `budget_tokens` extended
   * thinking, no assistant prefill. `temperature`/`top_p` are removed at
   * the API level (sending them returns 400).
   */
  'claude-opus-4-7': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: true;
    contextWindow: 1000000;
    maxOutputTokens: 128000;
    parallelToolCalls: true;
  };
  /**
   * Claude Sonnet 4.6 — best speed/intelligence balance. 1M context,
   * 64K output. Adaptive thinking + effort parameter; no `budget_tokens`
   * extended thinking, no assistant prefill. `temperature`/`top_p` remain
   * supported on this model.
   */
  'claude-sonnet-4-6': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: true;
    contextWindow: 1000000;
    maxOutputTokens: 64000;
    parallelToolCalls: true;
  };
  'claude-opus-4-6': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: true;
    contextWindow: 1000000;
    maxOutputTokens: 128000;
    parallelToolCalls: true;
  };
  'claude-sonnet-4-5-20250929': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: true;
    contextWindow: 200000;
    maxOutputTokens: 16000;
    parallelToolCalls: true;
  };
  'claude-sonnet-4-5-latest': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: true;
    contextWindow: 200000;
    maxOutputTokens: 16000;
    parallelToolCalls: true;
  };
  'claude-haiku-4-5-20251001': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 200000;
    maxOutputTokens: 8192;
    parallelToolCalls: true;
  };
  'claude-haiku-4-5-latest': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 200000;
    maxOutputTokens: 8192;
    parallelToolCalls: true;
  };
  'claude-opus-4-5-20251101': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: true;
    contextWindow: 200000;
    maxOutputTokens: 32000;
    parallelToolCalls: true;
  };
  /** @deprecated Retiring 2026-06-15. Use 'claude-opus-4-8' instead. */
  'claude-opus-4-0-20250514': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: true;
    contextWindow: 200000;
    maxOutputTokens: 32000;
    parallelToolCalls: true;
  };
  /** @deprecated Retiring 2026-06-15. Use 'claude-sonnet-4-6' instead. */
  'claude-sonnet-4-0-20250514': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: true;
    contextWindow: 200000;
    maxOutputTokens: 16000;
    parallelToolCalls: true;
  };
  /** @deprecated Retired 2026-02-19 (API returns 404). Use 'claude-sonnet-4-6' instead. */
  'claude-3-7-sonnet-20250219': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: true;
    contextWindow: 200000;
    maxOutputTokens: 128000;
    parallelToolCalls: true;
  };
  /** @deprecated Retired 2026-02-19 (API returns 404). Use 'claude-sonnet-4-6' instead. */
  'claude-3-7-sonnet-latest': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: true;
    contextWindow: 200000;
    maxOutputTokens: 128000;
    parallelToolCalls: true;
  };
  /** @deprecated Retired 2025-10-28 (API returns 404). Use 'claude-sonnet-4-6' instead. */
  'claude-3-5-sonnet-20241022': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: true;
    contextWindow: 200000;
    maxOutputTokens: 8192;
    parallelToolCalls: true;
  };
  /** @deprecated Retired 2025-10-28 (API returns 404). Use 'claude-sonnet-4-6' instead. */
  'claude-3-5-sonnet-latest': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: true;
    contextWindow: 200000;
    maxOutputTokens: 8192;
    parallelToolCalls: true;
  };
  /** @deprecated Retired 2026-02-19 (API returns 404). Use 'claude-haiku-4-5' instead. */
  'claude-3-5-haiku-20241022': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 200000;
    maxOutputTokens: 8192;
    parallelToolCalls: true;
  };
  /** @deprecated Retired 2026-02-19 (API returns 404). Use 'claude-haiku-4-5' instead. */
  'claude-3-5-haiku-latest': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 200000;
    maxOutputTokens: 8192;
    parallelToolCalls: true;
  };
  /** @deprecated Retired 2026-01-05 (API returns 404). Use 'claude-opus-4-8' instead. */
  'claude-3-opus-20240229': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 200000;
    maxOutputTokens: 4096;
    parallelToolCalls: true;
  };
  /** @deprecated Retired 2026-01-05 (API returns 404). Use 'claude-opus-4-8' instead. */
  'claude-3-opus-latest': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 200000;
    maxOutputTokens: 4096;
    parallelToolCalls: true;
  };
  /** @deprecated Retired 2025-07-21 (API returns 404). Use 'claude-sonnet-4-6' instead. */
  'claude-3-sonnet-20240229': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 200000;
    maxOutputTokens: 4096;
    parallelToolCalls: true;
  };
  /** @deprecated Retired 2026-04-19 (API returns 404). Use 'claude-haiku-4-5' instead. */
  'claude-3-haiku-20240307': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 200000;
    maxOutputTokens: 4096;
    parallelToolCalls: true;
  };
};

// ============================================================================
// OpenAI Models
// ============================================================================

export type OpenAIModel =
  // GPT-5.2 family (latest)
  | 'gpt-5.2'
  | 'gpt-5.2-pro'
  | 'gpt-5.2-codex'
  // GPT-5.1 family
  | 'gpt-5.1'
  | 'gpt-5.1-codex'
  | 'gpt-5.1-codex-mini'
  | 'gpt-5.1-codex-max'
  // GPT-5 family
  | 'gpt-5'
  | 'gpt-5-mini'
  | 'gpt-5-nano'
  | 'gpt-5-pro'
  // GPT-4.5 (deprecated)
  | 'gpt-4.5-preview'
  // GPT-4.1 family
  | 'gpt-4.1'
  | 'gpt-4.1-mini'
  | 'gpt-4.1-nano'
  // o-series reasoning models
  | 'o3'
  | 'o3-pro'
  | 'o3-deep-research'
  | 'o4-mini'
  | 'o4-mini-deep-research'
  | 'o3-mini'
  | 'o3-mini-2025-01-31'
  | 'o1'
  | 'o1-2024-12-17'
  | 'o1-mini'
  | 'o1-mini-2024-09-12'
  | 'o1-preview'
  // GPT-4o family
  | 'gpt-4o'
  | 'gpt-4o-2024-11-20'
  | 'gpt-4o-2024-08-06'
  | 'gpt-4o-mini'
  | 'gpt-4o-mini-2024-07-18'
  // GPT-4 family (legacy)
  | 'gpt-4-turbo'
  | 'gpt-4-turbo-2024-04-09'
  | 'gpt-4-turbo-preview'
  | 'gpt-4'
  | 'gpt-4-0613'
  // GPT-3.5 (legacy)
  | 'gpt-3.5-turbo'
  | 'gpt-3.5-turbo-0125';

/**
 * OpenAI-specific provider options
 */
export interface OpenAIProviderOptions {
  /** Response format (JSON mode) */
  responseFormat?: {
    type: 'text' | 'json_object' | 'json_schema';
    jsonSchema?: {
      name: string;
      strict?: boolean;
      schema: Record<string, unknown>;
    };
  };
  /** Seed for deterministic outputs */
  seed?: number;
  /** User identifier for abuse detection */
  user?: string;
  /** Enable parallel tool calls */
  parallelToolCalls?: boolean;
  /** Reasoning effort for o-series models */
  reasoningEffort?: 'low' | 'medium' | 'high';
  /** Log probabilities */
  logprobs?: boolean;
  /** Top log probabilities to return */
  topLogprobs?: number;
}

/**
 * Model capabilities for OpenAI models
 */
export type OpenAIModelCapabilities = {
  // GPT-5.2 family
  'gpt-5.2': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 400000;
    maxOutputTokens: 128000;
    parallelToolCalls: true;
  };
  'gpt-5.2-pro': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 400000;
    maxOutputTokens: 128000;
    parallelToolCalls: true;
  };
  'gpt-5.2-codex': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 400000;
    maxOutputTokens: 128000;
    parallelToolCalls: true;
  };
  // GPT-5.1 family
  'gpt-5.1': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 400000;
    maxOutputTokens: 128000;
    parallelToolCalls: true;
  };
  'gpt-5.1-codex': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 400000;
    maxOutputTokens: 128000;
    parallelToolCalls: true;
  };
  'gpt-5.1-codex-mini': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 400000;
    maxOutputTokens: 128000;
    parallelToolCalls: true;
  };
  'gpt-5.1-codex-max': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 400000;
    maxOutputTokens: 128000;
    parallelToolCalls: true;
  };
  // GPT-5 family
  'gpt-5': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 400000;
    maxOutputTokens: 128000;
    parallelToolCalls: true;
  };
  'gpt-5-mini': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 400000;
    maxOutputTokens: 128000;
    parallelToolCalls: true;
  };
  'gpt-5-nano': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 400000;
    maxOutputTokens: 128000;
    parallelToolCalls: true;
  };
  'gpt-5-pro': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 400000;
    maxOutputTokens: 272000;
    parallelToolCalls: true;
  };
  // GPT-4.5 (deprecated)
  'gpt-4.5-preview': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 128000;
    maxOutputTokens: 16384;
    parallelToolCalls: true;
  };
  // GPT-4.1 family
  'gpt-4.1': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 1047576;
    maxOutputTokens: 32768;
    parallelToolCalls: true;
  };
  'gpt-4.1-mini': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 1047576;
    maxOutputTokens: 16384;
    parallelToolCalls: true;
  };
  'gpt-4.1-nano': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 1047576;
    maxOutputTokens: 16384;
    parallelToolCalls: true;
  };
  // o-series reasoning models
  o3: ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: true;
    contextWindow: 200000;
    maxOutputTokens: 100000;
    parallelToolCalls: false;
  };
  'o3-pro': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: true;
    contextWindow: 200000;
    maxOutputTokens: 100000;
    parallelToolCalls: false;
  };
  'o4-mini': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: true;
    contextWindow: 200000;
    maxOutputTokens: 100000;
    parallelToolCalls: false;
  };
  'o3-deep-research': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: true;
    contextWindow: 200000;
    maxOutputTokens: 100000;
    parallelToolCalls: false;
  };
  'o4-mini-deep-research': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: true;
    contextWindow: 200000;
    maxOutputTokens: 100000;
    parallelToolCalls: false;
  };
  'o3-mini': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: false;
    structuredOutput: true;
    systemMessage: false;
    extendedThinking: true;
    contextWindow: 200000;
    maxOutputTokens: 100000;
    parallelToolCalls: false;
  };
  'o3-mini-2025-01-31': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: false;
    structuredOutput: true;
    systemMessage: false;
    extendedThinking: true;
    contextWindow: 200000;
    maxOutputTokens: 100000;
    parallelToolCalls: false;
  };
  o1: ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: false;
    extendedThinking: true;
    contextWindow: 200000;
    maxOutputTokens: 100000;
    parallelToolCalls: false;
  };
  'o1-2024-12-17': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: false;
    extendedThinking: true;
    contextWindow: 200000;
    maxOutputTokens: 100000;
    parallelToolCalls: false;
  };
  'o1-mini': ModelCapabilities & {
    tools: false;
    streaming: true;
    vision: false;
    structuredOutput: false;
    systemMessage: false;
    extendedThinking: true;
    contextWindow: 128000;
    maxOutputTokens: 65536;
    parallelToolCalls: false;
  };
  'o1-mini-2024-09-12': ModelCapabilities & {
    tools: false;
    streaming: true;
    vision: false;
    structuredOutput: false;
    systemMessage: false;
    extendedThinking: true;
    contextWindow: 128000;
    maxOutputTokens: 65536;
    parallelToolCalls: false;
  };
  'o1-preview': ModelCapabilities & {
    tools: false;
    streaming: true;
    vision: false;
    structuredOutput: false;
    systemMessage: false;
    extendedThinking: true;
    contextWindow: 128000;
    maxOutputTokens: 32768;
    parallelToolCalls: false;
  };
  // GPT-4o family
  'gpt-4o': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 128000;
    maxOutputTokens: 16384;
    parallelToolCalls: true;
  };
  'gpt-4o-2024-11-20': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 128000;
    maxOutputTokens: 16384;
    parallelToolCalls: true;
  };
  'gpt-4o-2024-08-06': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 128000;
    maxOutputTokens: 16384;
    parallelToolCalls: true;
  };
  'gpt-4o-mini': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 128000;
    maxOutputTokens: 16384;
    parallelToolCalls: true;
  };
  'gpt-4o-mini-2024-07-18': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 128000;
    maxOutputTokens: 16384;
    parallelToolCalls: true;
  };
  // GPT-4 legacy
  'gpt-4-turbo': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: false;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 128000;
    maxOutputTokens: 4096;
    parallelToolCalls: true;
  };
  'gpt-4-turbo-2024-04-09': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: false;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 128000;
    maxOutputTokens: 4096;
    parallelToolCalls: true;
  };
  'gpt-4-turbo-preview': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: false;
    structuredOutput: false;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 128000;
    maxOutputTokens: 4096;
    parallelToolCalls: true;
  };
  'gpt-4': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: false;
    structuredOutput: false;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 8192;
    maxOutputTokens: 8192;
    parallelToolCalls: true;
  };
  'gpt-4-0613': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: false;
    structuredOutput: false;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 8192;
    maxOutputTokens: 8192;
    parallelToolCalls: true;
  };
  'gpt-3.5-turbo': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: false;
    structuredOutput: false;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 16385;
    maxOutputTokens: 4096;
    parallelToolCalls: true;
  };
  'gpt-3.5-turbo-0125': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: false;
    structuredOutput: false;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 16385;
    maxOutputTokens: 4096;
    parallelToolCalls: true;
  };
};

// ============================================================================
// Google Gemini Models
// ============================================================================

export type GeminiModel =
  // Gemini 2.5 family (latest)
  | 'gemini-2.5-pro'
  | 'gemini-2.5-pro-latest'
  | 'gemini-2.5-flash'
  | 'gemini-2.5-flash-latest'
  // Gemini 2.0 family
  | 'gemini-2.0-flash'
  | 'gemini-2.0-flash-exp'
  | 'gemini-2.0-flash-thinking-exp'
  // Gemini 1.5 family
  | 'gemini-1.5-pro'
  | 'gemini-1.5-pro-latest'
  | 'gemini-1.5-flash'
  | 'gemini-1.5-flash-latest'
  | 'gemini-1.5-flash-8b'
  // Legacy
  | 'gemini-1.0-pro';

/**
 * Gemini-specific provider options
 */
export interface GeminiProviderOptions {
  /** Safety settings */
  safetySettings?: Array<{
    category:
      | 'HARM_CATEGORY_HARASSMENT'
      | 'HARM_CATEGORY_HATE_SPEECH'
      | 'HARM_CATEGORY_SEXUALLY_EXPLICIT'
      | 'HARM_CATEGORY_DANGEROUS_CONTENT';
    threshold:
      | 'BLOCK_NONE'
      | 'BLOCK_ONLY_HIGH'
      | 'BLOCK_MEDIUM_AND_ABOVE'
      | 'BLOCK_LOW_AND_ABOVE';
  }>;
  /** Top-K sampling */
  topK?: number;
  /** Candidate count */
  candidateCount?: number;
}

/**
 * Model capabilities for Gemini models
 */
export type GeminiModelCapabilities = {
  'gemini-2.5-pro': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: true;
    contextWindow: 1048576;
    maxOutputTokens: 65536;
    parallelToolCalls: true;
  };
  'gemini-2.5-pro-latest': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: true;
    contextWindow: 1048576;
    maxOutputTokens: 65536;
    parallelToolCalls: true;
  };
  'gemini-2.5-flash': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: true;
    contextWindow: 1048576;
    maxOutputTokens: 65536;
    parallelToolCalls: true;
  };
  'gemini-2.5-flash-latest': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: true;
    contextWindow: 1048576;
    maxOutputTokens: 65536;
    parallelToolCalls: true;
  };
  'gemini-2.0-flash': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 1048576;
    maxOutputTokens: 8192;
    parallelToolCalls: true;
  };
  'gemini-2.0-flash-exp': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 1048576;
    maxOutputTokens: 8192;
    parallelToolCalls: true;
  };
  'gemini-2.0-flash-thinking-exp': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: true;
    contextWindow: 1048576;
    maxOutputTokens: 8192;
    parallelToolCalls: true;
  };
  'gemini-1.5-pro': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 2097152;
    maxOutputTokens: 8192;
    parallelToolCalls: true;
  };
  'gemini-1.5-pro-latest': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 2097152;
    maxOutputTokens: 8192;
    parallelToolCalls: true;
  };
  'gemini-1.5-flash': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 1048576;
    maxOutputTokens: 8192;
    parallelToolCalls: true;
  };
  'gemini-1.5-flash-latest': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 1048576;
    maxOutputTokens: 8192;
    parallelToolCalls: true;
  };
  'gemini-1.5-flash-8b': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 1048576;
    maxOutputTokens: 8192;
    parallelToolCalls: true;
  };
  'gemini-1.0-pro': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: false;
    structuredOutput: false;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 32760;
    maxOutputTokens: 8192;
    parallelToolCalls: false;
  };
};

// ============================================================================
// Mistral Models
// ============================================================================

export type MistralModel =
  | 'mistral-large-latest'
  | 'mistral-large-2501'
  | 'mistral-small-latest'
  | 'mistral-small-2503'
  | 'mistral-medium-latest'
  | 'codestral-latest'
  | 'codestral-2501'
  | 'devstral-small-2505'
  | 'mistral-7b'
  | 'mixtral-8x7b'
  | 'mixtral-8x22b';

/**
 * Mistral-specific provider options
 */
export interface MistralProviderOptions {
  /** Safe prompt mode */
  safePrompt?: boolean;
  /** Random seed */
  randomSeed?: number;
  /** Response format */
  responseFormat?: {
    type: 'text' | 'json_object';
  };
}

/**
 * Model capabilities for Mistral models
 */
export type MistralModelCapabilities = {
  'mistral-large-latest': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 128000;
    maxOutputTokens: 4096;
    parallelToolCalls: true;
  };
  'mistral-large-2501': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 128000;
    maxOutputTokens: 4096;
    parallelToolCalls: true;
  };
  'mistral-small-latest': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: false;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 128000;
    maxOutputTokens: 4096;
    parallelToolCalls: true;
  };
  'mistral-small-2503': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 128000;
    maxOutputTokens: 4096;
    parallelToolCalls: true;
  };
  'mistral-medium-latest': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: false;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 128000;
    maxOutputTokens: 4096;
    parallelToolCalls: true;
  };
  'codestral-latest': ModelCapabilities & {
    tools: false;
    streaming: true;
    vision: false;
    structuredOutput: false;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 256000;
    maxOutputTokens: 4096;
    parallelToolCalls: false;
  };
  'codestral-2501': ModelCapabilities & {
    tools: false;
    streaming: true;
    vision: false;
    structuredOutput: false;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 256000;
    maxOutputTokens: 4096;
    parallelToolCalls: false;
  };
  'devstral-small-2505': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: false;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 128000;
    maxOutputTokens: 4096;
    parallelToolCalls: true;
  };
  'mistral-7b': ModelCapabilities & {
    tools: false;
    streaming: true;
    vision: false;
    structuredOutput: false;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 32000;
    maxOutputTokens: 4096;
    parallelToolCalls: false;
  };
  'mixtral-8x7b': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: false;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 32000;
    maxOutputTokens: 4096;
    parallelToolCalls: false;
  };
  'mixtral-8x22b': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: false;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 64000;
    maxOutputTokens: 4096;
    parallelToolCalls: false;
  };
};

// ============================================================================
// DeepSeek Models
// ============================================================================

export type DeepSeekModel = 'deepseek-chat' | 'deepseek-reasoner';

/**
 * DeepSeek-specific provider options
 */
export interface DeepSeekProviderOptions {
  /** Response format */
  responseFormat?: {
    type: 'text' | 'json_object';
  };
  /** Frequency penalty */
  frequencyPenalty?: number;
  /** Presence penalty */
  presencePenalty?: number;
}

/**
 * Model capabilities for DeepSeek models
 */
export type DeepSeekModelCapabilities = {
  'deepseek-chat': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: false;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 128000;
    maxOutputTokens: 8192;
    parallelToolCalls: true;
  };
  'deepseek-reasoner': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: false;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: true;
    contextWindow: 128000;
    maxOutputTokens: 65536;
    parallelToolCalls: false;
  };
};

// ============================================================================
// xAI (Grok) Models
// ============================================================================

export type XAIModel =
  | 'grok-3'
  | 'grok-3-fast'
  | 'grok-3-mini'
  | 'grok-3-mini-fast';

/**
 * xAI-specific provider options
 */
export interface XAIProviderOptions {
  /** Reasoning effort for Grok reasoning models */
  reasoningEffort?: 'low' | 'high';
  /** User identifier */
  user?: string;
}

/**
 * Model capabilities for xAI models
 */
export type XAIModelCapabilities = {
  'grok-3': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 131072;
    maxOutputTokens: 16384;
    parallelToolCalls: true;
  };
  'grok-3-fast': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: true;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: false;
    contextWindow: 131072;
    maxOutputTokens: 16384;
    parallelToolCalls: true;
  };
  'grok-3-mini': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: false;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: true;
    contextWindow: 131072;
    maxOutputTokens: 16384;
    parallelToolCalls: true;
  };
  'grok-3-mini-fast': ModelCapabilities & {
    tools: true;
    streaming: true;
    vision: false;
    structuredOutput: true;
    systemMessage: true;
    extendedThinking: true;
    contextWindow: 131072;
    maxOutputTokens: 16384;
    parallelToolCalls: true;
  };
};

// ============================================================================
// Ollama Models (dynamic, user-defined)
// ============================================================================

export type OllamaModel = string;

/**
 * Ollama-specific provider options
 */
export interface OllamaProviderOptions {
  /** Number of context tokens */
  numCtx?: number;
  /** Number of GPU layers */
  numGpu?: number;
  /** Repeat penalty */
  repeatPenalty?: number;
  /** Repeat last N tokens for penalty */
  repeatLastN?: number;
  /** Mirostat sampling (0 = disabled, 1 = mirostat, 2 = mirostat 2.0) */
  mirostat?: 0 | 1 | 2;
  /** Mirostat target entropy */
  mirostatTau?: number;
  /** Mirostat learning rate */
  mirostatEta?: number;
  /** Enable NUMA */
  numa?: boolean;
  /** Number of threads */
  numThread?: number;
}

/**
 * Default capabilities for Ollama models (unknown/dynamic)
 */
export interface OllamaDefaultCapabilities extends ModelCapabilities {
  tools: boolean;
  streaming: true;
  vision: boolean;
  structuredOutput: boolean;
  systemMessage: true;
  extendedThinking: false;
  contextWindow: number;
  maxOutputTokens: number;
  parallelToolCalls: boolean;
}

// ============================================================================
// Type-Safe Provider Configuration
// ============================================================================

/**
 * Provider types
 */
export type Provider =
  | 'anthropic'
  | 'openai'
  | 'gemini'
  | 'mistral'
  | 'deepseek'
  | 'xai'
  | 'ollama';

/**
 * All supported models
 * Note: OllamaModel is `string` so this effectively allows any string
 */
export type SupportedModel = string;

/**
 * Map provider to its model type
 */
export type ProviderModelMap = {
  anthropic: AnthropicModel;
  openai: OpenAIModel;
  gemini: GeminiModel;
  mistral: MistralModel;
  deepseek: DeepSeekModel;
  xai: XAIModel;
  ollama: OllamaModel;
};

/**
 * Map provider to its options type
 */
export type ProviderOptionsMap = {
  anthropic: AnthropicProviderOptions;
  openai: OpenAIProviderOptions;
  gemini: GeminiProviderOptions;
  mistral: MistralProviderOptions;
  deepseek: DeepSeekProviderOptions;
  xai: XAIProviderOptions;
  ollama: OllamaProviderOptions;
};

/**
 * Get capabilities for a specific model
 */
export type GetModelCapabilities<
  TProvider extends Provider,
  TModel extends string,
> = TProvider extends 'anthropic'
  ? TModel extends keyof AnthropicModelCapabilities
    ? AnthropicModelCapabilities[TModel]
    : never
  : TProvider extends 'openai'
    ? TModel extends keyof OpenAIModelCapabilities
      ? OpenAIModelCapabilities[TModel]
      : never
    : TProvider extends 'gemini'
      ? TModel extends keyof GeminiModelCapabilities
        ? GeminiModelCapabilities[TModel]
        : never
      : TProvider extends 'mistral'
        ? TModel extends keyof MistralModelCapabilities
          ? MistralModelCapabilities[TModel]
          : never
        : TProvider extends 'deepseek'
          ? TModel extends keyof DeepSeekModelCapabilities
            ? DeepSeekModelCapabilities[TModel]
            : never
          : TProvider extends 'xai'
            ? TModel extends keyof XAIModelCapabilities
              ? XAIModelCapabilities[TModel]
              : never
            : TProvider extends 'ollama'
              ? OllamaDefaultCapabilities
              : never;

/**
 * Check if a model supports a capability
 */
export type ModelSupports<
  TProvider extends Provider,
  TModel extends string,
  TCapability extends keyof ModelCapabilities,
> = GetModelCapabilities<TProvider, TModel>[TCapability] extends true
  ? true
  : false;

/**
 * Type-safe provider config based on provider and model
 */
export interface TypeSafeProviderConfig<
  TProvider extends Provider,
  TModel extends ProviderModelMap[TProvider],
> {
  provider: TProvider;
  model: TModel;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
  providerOptions?: ProviderOptionsMap[TProvider];
}

/**
 * Conditional tool config - only allowed if model supports tools
 */
export type ToolConfig<TProvider extends Provider, TModel extends string> =
  ModelSupports<TProvider, TModel, 'tools'> extends true
    ? {
        tools?: import('./index').Tool[];
      }
    : {
        tools?: never;
      };

/**
 * Conditional system prompt - only allowed if model supports system messages
 */
export type SystemPromptConfig<
  TProvider extends Provider,
  TModel extends string,
> =
  ModelSupports<TProvider, TModel, 'systemMessage'> extends true
    ? {
        systemPrompt?: string;
      }
    : {
        systemPrompt?: never;
      };

/**
 * Full type-safe config combining base config with conditional options
 */
export type FullTypeSafeConfig<
  TProvider extends Provider,
  TModel extends ProviderModelMap[TProvider],
> = TypeSafeProviderConfig<TProvider, TModel> &
  ToolConfig<TProvider, TModel> &
  SystemPromptConfig<TProvider, TModel>;

// ============================================================================
// Runtime Model Registry
// ============================================================================

/**
 * Runtime model information (for dynamic lookups)
 */
export interface ModelInfo {
  provider: Provider;
  model: string;
  displayName: string;
  capabilities: ModelCapabilities;
  deprecated?: boolean;
  releaseDate?: string;
}

/**
 * Model registry for runtime capability checks
 */
export const MODEL_REGISTRY: Record<string, ModelInfo> = {
  // ---- Anthropic Models ----
  // Claude Fable 5 — most capable model. Adaptive thinking + effort param;
  // no budget_tokens extended thinking, no assistant prefill;
  // temperature/top_p removed at the API level.
  'claude-fable-5': {
    provider: 'anthropic',
    model: 'claude-fable-5',
    displayName: 'Claude Fable 5',
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: true,
      contextWindow: 1000000,
      maxOutputTokens: 128000,
      parallelToolCalls: true,
    },
  },
  // Claude Opus 4.8 — recommended default. Adaptive thinking + effort param;
  // no budget_tokens extended thinking, no assistant prefill;
  // temperature/top_p removed at the API level.
  'claude-opus-4-8': {
    provider: 'anthropic',
    model: 'claude-opus-4-8',
    displayName: 'Claude Opus 4.8',
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: true,
      contextWindow: 1000000,
      maxOutputTokens: 128000,
      parallelToolCalls: true,
    },
  },
  // Claude Opus 4.7 — previous-generation Opus. Adaptive thinking + effort
  // param; no budget_tokens extended thinking, no assistant prefill;
  // temperature/top_p removed at the API level.
  'claude-opus-4-7': {
    provider: 'anthropic',
    model: 'claude-opus-4-7',
    displayName: 'Claude Opus 4.7',
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: true,
      contextWindow: 1000000,
      maxOutputTokens: 128000,
      parallelToolCalls: true,
    },
  },
  // Claude Sonnet 4.6 — best speed/intelligence balance. Adaptive thinking +
  // effort param; no budget_tokens extended thinking, no assistant prefill.
  'claude-sonnet-4-6': {
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    displayName: 'Claude Sonnet 4.6',
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: true,
      contextWindow: 1000000,
      maxOutputTokens: 64000,
      parallelToolCalls: true,
    },
  },
  'claude-opus-4-6': {
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    displayName: 'Claude Opus 4.6',
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: true,
      contextWindow: 1000000,
      maxOutputTokens: 128000,
      parallelToolCalls: true,
    },
  },
  'claude-sonnet-4-5-20250929': {
    provider: 'anthropic',
    model: 'claude-sonnet-4-5-20250929',
    displayName: 'Claude Sonnet 4.5',
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: true,
      contextWindow: 200000,
      maxOutputTokens: 16000,
      parallelToolCalls: true,
    },
  },
  'claude-haiku-4-5-20251001': {
    provider: 'anthropic',
    model: 'claude-haiku-4-5-20251001',
    displayName: 'Claude Haiku 4.5',
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: false,
      contextWindow: 200000,
      maxOutputTokens: 8192,
      parallelToolCalls: true,
    },
  },
  'claude-opus-4-5-20251101': {
    provider: 'anthropic',
    model: 'claude-opus-4-5-20251101',
    displayName: 'Claude Opus 4.5',
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: true,
      contextWindow: 200000,
      maxOutputTokens: 32000,
      parallelToolCalls: true,
    },
  },
  /** @deprecated Retiring 2026-06-15. Use 'claude-opus-4-8' instead. */
  'claude-opus-4-0-20250514': {
    provider: 'anthropic',
    model: 'claude-opus-4-0-20250514',
    displayName: 'Claude Opus 4',
    deprecated: true,
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: true,
      contextWindow: 200000,
      maxOutputTokens: 32000,
      parallelToolCalls: true,
    },
  },
  /** @deprecated Retiring 2026-06-15. Use 'claude-sonnet-4-6' instead. */
  'claude-sonnet-4-0-20250514': {
    provider: 'anthropic',
    model: 'claude-sonnet-4-0-20250514',
    displayName: 'Claude Sonnet 4',
    deprecated: true,
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: true,
      contextWindow: 200000,
      maxOutputTokens: 16000,
      parallelToolCalls: true,
    },
  },
  /** @deprecated Retired 2026-02-19 (API returns 404). Use 'claude-sonnet-4-6' instead. */
  'claude-3-7-sonnet-20250219': {
    provider: 'anthropic',
    model: 'claude-3-7-sonnet-20250219',
    displayName: 'Claude 3.7 Sonnet',
    deprecated: true,
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: true,
      contextWindow: 200000,
      maxOutputTokens: 128000,
      parallelToolCalls: true,
    },
  },
  /** @deprecated Retired 2025-10-28 (API returns 404). Use 'claude-sonnet-4-6' instead. */
  'claude-3-5-sonnet-20241022': {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    displayName: 'Claude 3.5 Sonnet',
    deprecated: true,
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: true,
      contextWindow: 200000,
      maxOutputTokens: 8192,
      parallelToolCalls: true,
    },
  },
  /** @deprecated Retired 2026-02-19 (API returns 404). Use 'claude-haiku-4-5' instead. */
  'claude-3-5-haiku-20241022': {
    provider: 'anthropic',
    model: 'claude-3-5-haiku-20241022',
    displayName: 'Claude 3.5 Haiku',
    deprecated: true,
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: false,
      contextWindow: 200000,
      maxOutputTokens: 8192,
      parallelToolCalls: true,
    },
  },
  /** @deprecated Retired 2026-01-05 (API returns 404). Use 'claude-opus-4-8' instead. */
  'claude-3-opus-20240229': {
    provider: 'anthropic',
    model: 'claude-3-opus-20240229',
    displayName: 'Claude 3 Opus',
    deprecated: true,
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: false,
      contextWindow: 200000,
      maxOutputTokens: 4096,
      parallelToolCalls: true,
    },
  },

  // ---- OpenAI Models ----
  'gpt-5.2': {
    provider: 'openai',
    model: 'gpt-5.2',
    displayName: 'GPT-5.2',
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: false,
      contextWindow: 400000,
      maxOutputTokens: 128000,
      parallelToolCalls: true,
    },
  },
  'gpt-5.2-pro': {
    provider: 'openai',
    model: 'gpt-5.2-pro',
    displayName: 'GPT-5.2 Pro',
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: false,
      contextWindow: 400000,
      maxOutputTokens: 128000,
      parallelToolCalls: true,
    },
  },
  'gpt-5.2-codex': {
    provider: 'openai',
    model: 'gpt-5.2-codex',
    displayName: 'GPT-5.2 Codex',
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: false,
      contextWindow: 400000,
      maxOutputTokens: 128000,
      parallelToolCalls: true,
    },
  },
  'gpt-5.1': {
    provider: 'openai',
    model: 'gpt-5.1',
    displayName: 'GPT-5.1',
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: false,
      contextWindow: 400000,
      maxOutputTokens: 128000,
      parallelToolCalls: true,
    },
  },
  'gpt-5.1-codex': {
    provider: 'openai',
    model: 'gpt-5.1-codex',
    displayName: 'GPT-5.1 Codex',
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: false,
      contextWindow: 400000,
      maxOutputTokens: 128000,
      parallelToolCalls: true,
    },
  },
  'gpt-5.1-codex-mini': {
    provider: 'openai',
    model: 'gpt-5.1-codex-mini',
    displayName: 'GPT-5.1 Codex Mini',
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: false,
      contextWindow: 400000,
      maxOutputTokens: 128000,
      parallelToolCalls: true,
    },
  },
  'gpt-5.1-codex-max': {
    provider: 'openai',
    model: 'gpt-5.1-codex-max',
    displayName: 'GPT-5.1 Codex Max',
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: false,
      contextWindow: 400000,
      maxOutputTokens: 128000,
      parallelToolCalls: true,
    },
  },
  'gpt-5': {
    provider: 'openai',
    model: 'gpt-5',
    displayName: 'GPT-5',
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: false,
      contextWindow: 400000,
      maxOutputTokens: 128000,
      parallelToolCalls: true,
    },
  },
  'gpt-5-mini': {
    provider: 'openai',
    model: 'gpt-5-mini',
    displayName: 'GPT-5 Mini',
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: false,
      contextWindow: 400000,
      maxOutputTokens: 128000,
      parallelToolCalls: true,
    },
  },
  'gpt-5-nano': {
    provider: 'openai',
    model: 'gpt-5-nano',
    displayName: 'GPT-5 Nano',
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: false,
      contextWindow: 400000,
      maxOutputTokens: 128000,
      parallelToolCalls: true,
    },
  },
  'gpt-5-pro': {
    provider: 'openai',
    model: 'gpt-5-pro',
    displayName: 'GPT-5 Pro',
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: false,
      contextWindow: 400000,
      maxOutputTokens: 272000,
      parallelToolCalls: true,
    },
  },
  'gpt-4.5-preview': {
    provider: 'openai',
    model: 'gpt-4.5-preview',
    displayName: 'GPT-4.5 Preview',
    deprecated: true,
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: false,
      contextWindow: 128000,
      maxOutputTokens: 16384,
      parallelToolCalls: true,
    },
  },
  'gpt-4.1': {
    provider: 'openai',
    model: 'gpt-4.1',
    displayName: 'GPT-4.1',
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: false,
      contextWindow: 1047576,
      maxOutputTokens: 32768,
      parallelToolCalls: true,
    },
  },
  'gpt-4.1-mini': {
    provider: 'openai',
    model: 'gpt-4.1-mini',
    displayName: 'GPT-4.1 Mini',
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: false,
      contextWindow: 1047576,
      maxOutputTokens: 16384,
      parallelToolCalls: true,
    },
  },
  'gpt-4.1-nano': {
    provider: 'openai',
    model: 'gpt-4.1-nano',
    displayName: 'GPT-4.1 Nano',
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: false,
      contextWindow: 1047576,
      maxOutputTokens: 16384,
      parallelToolCalls: true,
    },
  },
  o3: {
    provider: 'openai',
    model: 'o3',
    displayName: 'o3',
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: true,
      contextWindow: 200000,
      maxOutputTokens: 100000,
      parallelToolCalls: false,
    },
  },
  'o3-pro': {
    provider: 'openai',
    model: 'o3-pro',
    displayName: 'o3 Pro',
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: true,
      contextWindow: 200000,
      maxOutputTokens: 100000,
      parallelToolCalls: false,
    },
  },
  'o4-mini': {
    provider: 'openai',
    model: 'o4-mini',
    displayName: 'o4 Mini',
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: true,
      contextWindow: 200000,
      maxOutputTokens: 100000,
      parallelToolCalls: false,
    },
  },
  'o3-deep-research': {
    provider: 'openai',
    model: 'o3-deep-research',
    displayName: 'o3 Deep Research',
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: true,
      contextWindow: 200000,
      maxOutputTokens: 100000,
      parallelToolCalls: false,
    },
  },
  'o4-mini-deep-research': {
    provider: 'openai',
    model: 'o4-mini-deep-research',
    displayName: 'o4 Mini Deep Research',
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: true,
      contextWindow: 200000,
      maxOutputTokens: 100000,
      parallelToolCalls: false,
    },
  },
  'o3-mini': {
    provider: 'openai',
    model: 'o3-mini',
    displayName: 'o3 Mini',
    capabilities: {
      tools: true,
      streaming: true,
      vision: false,
      structuredOutput: true,
      systemMessage: false,
      extendedThinking: true,
      contextWindow: 200000,
      maxOutputTokens: 100000,
      parallelToolCalls: false,
    },
  },
  'gpt-4o': {
    provider: 'openai',
    model: 'gpt-4o',
    displayName: 'GPT-4o',
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: false,
      contextWindow: 128000,
      maxOutputTokens: 16384,
      parallelToolCalls: true,
    },
  },
  'gpt-4o-mini': {
    provider: 'openai',
    model: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: false,
      contextWindow: 128000,
      maxOutputTokens: 16384,
      parallelToolCalls: true,
    },
  },
  o1: {
    provider: 'openai',
    model: 'o1',
    displayName: 'o1',
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: false,
      extendedThinking: true,
      contextWindow: 200000,
      maxOutputTokens: 100000,
      parallelToolCalls: false,
    },
  },
  'o1-mini': {
    provider: 'openai',
    model: 'o1-mini',
    displayName: 'o1 Mini',
    deprecated: true,
    capabilities: {
      tools: false,
      streaming: true,
      vision: false,
      structuredOutput: false,
      systemMessage: false,
      extendedThinking: true,
      contextWindow: 128000,
      maxOutputTokens: 65536,
      parallelToolCalls: false,
    },
  },

  // ---- Gemini Models ----
  'gemini-2.5-pro': {
    provider: 'gemini',
    model: 'gemini-2.5-pro',
    displayName: 'Gemini 2.5 Pro',
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: true,
      contextWindow: 1048576,
      maxOutputTokens: 65536,
      parallelToolCalls: true,
    },
  },
  'gemini-2.5-flash': {
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: true,
      contextWindow: 1048576,
      maxOutputTokens: 65536,
      parallelToolCalls: true,
    },
  },
  'gemini-2.0-flash': {
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    displayName: 'Gemini 2.0 Flash',
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: false,
      contextWindow: 1048576,
      maxOutputTokens: 8192,
      parallelToolCalls: true,
    },
  },
  'gemini-2.0-flash-exp': {
    provider: 'gemini',
    model: 'gemini-2.0-flash-exp',
    displayName: 'Gemini 2.0 Flash (Exp)',
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: false,
      contextWindow: 1048576,
      maxOutputTokens: 8192,
      parallelToolCalls: true,
    },
  },
  'gemini-1.5-pro': {
    provider: 'gemini',
    model: 'gemini-1.5-pro',
    displayName: 'Gemini 1.5 Pro',
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: false,
      contextWindow: 2097152,
      maxOutputTokens: 8192,
      parallelToolCalls: true,
    },
  },
  'gemini-1.5-flash': {
    provider: 'gemini',
    model: 'gemini-1.5-flash',
    displayName: 'Gemini 1.5 Flash',
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: false,
      contextWindow: 1048576,
      maxOutputTokens: 8192,
      parallelToolCalls: true,
    },
  },

  // ---- Mistral Models ----
  'mistral-large-latest': {
    provider: 'mistral',
    model: 'mistral-large-latest',
    displayName: 'Mistral Large',
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: false,
      contextWindow: 128000,
      maxOutputTokens: 4096,
      parallelToolCalls: true,
    },
  },
  'mistral-small-latest': {
    provider: 'mistral',
    model: 'mistral-small-latest',
    displayName: 'Mistral Small',
    capabilities: {
      tools: true,
      streaming: true,
      vision: false,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: false,
      contextWindow: 128000,
      maxOutputTokens: 4096,
      parallelToolCalls: true,
    },
  },
  'codestral-latest': {
    provider: 'mistral',
    model: 'codestral-latest',
    displayName: 'Codestral',
    capabilities: {
      tools: false,
      streaming: true,
      vision: false,
      structuredOutput: false,
      systemMessage: true,
      extendedThinking: false,
      contextWindow: 256000,
      maxOutputTokens: 4096,
      parallelToolCalls: false,
    },
  },

  // ---- DeepSeek Models ----
  'deepseek-chat': {
    provider: 'deepseek',
    model: 'deepseek-chat',
    displayName: 'DeepSeek V3.2',
    capabilities: {
      tools: true,
      streaming: true,
      vision: false,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: false,
      contextWindow: 128000,
      maxOutputTokens: 8192,
      parallelToolCalls: true,
    },
  },
  'deepseek-reasoner': {
    provider: 'deepseek',
    model: 'deepseek-reasoner',
    displayName: 'DeepSeek R1',
    capabilities: {
      tools: true,
      streaming: true,
      vision: false,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: true,
      contextWindow: 128000,
      maxOutputTokens: 65536,
      parallelToolCalls: false,
    },
  },

  // ---- xAI (Grok) Models ----
  'grok-3': {
    provider: 'xai',
    model: 'grok-3',
    displayName: 'Grok 3',
    capabilities: {
      tools: true,
      streaming: true,
      vision: true,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: false,
      contextWindow: 131072,
      maxOutputTokens: 16384,
      parallelToolCalls: true,
    },
  },
  'grok-3-mini': {
    provider: 'xai',
    model: 'grok-3-mini',
    displayName: 'Grok 3 Mini',
    capabilities: {
      tools: true,
      streaming: true,
      vision: false,
      structuredOutput: true,
      systemMessage: true,
      extendedThinking: true,
      contextWindow: 131072,
      maxOutputTokens: 16384,
      parallelToolCalls: true,
    },
  },
};

/**
 * Get model info at runtime
 */
export function getModelInfo(model: string): ModelInfo | undefined {
  return MODEL_REGISTRY[model];
}

/**
 * Check if model supports capability at runtime
 */
export function modelSupportsCapability(
  model: string,
  capability: keyof ModelCapabilities,
): boolean {
  const info = getModelInfo(model);
  if (!info) return false;
  const value = info.capabilities[capability];
  return typeof value === 'boolean' ? value : value > 0;
}

/**
 * Get all models for a provider
 */
export function getModelsForProvider(provider: Provider): ModelInfo[] {
  return Object.values(MODEL_REGISTRY).filter((m) => m.provider === provider);
}

/**
 * Get all models with a specific capability
 */
export function getModelsWithCapability(
  capability: keyof ModelCapabilities,
  minValue?: number | boolean,
): ModelInfo[] {
  return Object.values(MODEL_REGISTRY).filter((m) => {
    const value = m.capabilities[capability];
    if (typeof value === 'boolean') {
      return minValue === undefined ? value : value === minValue;
    }
    return minValue === undefined ? value > 0 : value >= (minValue as number);
  });
}
