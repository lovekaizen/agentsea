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
  | 'claude-3-5-sonnet-20241022'
  | 'claude-3-5-sonnet-latest'
  | 'claude-3-5-haiku-20241022'
  | 'claude-3-5-haiku-latest'
  | 'claude-3-opus-20240229'
  | 'claude-3-opus-latest'
  | 'claude-3-sonnet-20240229'
  | 'claude-3-haiku-20240307'
  | 'claude-opus-4-0-20250514'
  | 'claude-sonnet-4-0-20250514'
  | 'claude-opus-4-5-20251101';

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
};

// ============================================================================
// OpenAI Models
// ============================================================================

export type OpenAIModel =
  | 'gpt-4o'
  | 'gpt-4o-2024-11-20'
  | 'gpt-4o-2024-08-06'
  | 'gpt-4o-mini'
  | 'gpt-4o-mini-2024-07-18'
  | 'gpt-4-turbo'
  | 'gpt-4-turbo-2024-04-09'
  | 'gpt-4-turbo-preview'
  | 'gpt-4'
  | 'gpt-4-0613'
  | 'gpt-3.5-turbo'
  | 'gpt-3.5-turbo-0125'
  | 'o1'
  | 'o1-2024-12-17'
  | 'o1-mini'
  | 'o1-mini-2024-09-12'
  | 'o1-preview'
  | 'o3-mini'
  | 'o3-mini-2025-01-31';

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
  /** Reasoning effort for o1/o3 models */
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
};

// ============================================================================
// Google Gemini Models
// ============================================================================

export type GeminiModel =
  | 'gemini-2.0-flash-exp'
  | 'gemini-2.0-flash-thinking-exp'
  | 'gemini-1.5-pro'
  | 'gemini-1.5-pro-latest'
  | 'gemini-1.5-flash'
  | 'gemini-1.5-flash-latest'
  | 'gemini-1.5-flash-8b'
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
export type Provider = 'anthropic' | 'openai' | 'gemini' | 'ollama';

/**
 * All supported models
 */
export type SupportedModel =
  | AnthropicModel
  | OpenAIModel
  | GeminiModel
  | OllamaModel;

/**
 * Map provider to its model type
 */
export type ProviderModelMap = {
  anthropic: AnthropicModel;
  openai: OpenAIModel;
  gemini: GeminiModel;
  ollama: OllamaModel;
};

/**
 * Map provider to its options type
 */
export type ProviderOptionsMap = {
  anthropic: AnthropicProviderOptions;
  openai: OpenAIProviderOptions;
  gemini: GeminiProviderOptions;
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
  // Anthropic Models
  'claude-3-5-sonnet-20241022': {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    displayName: 'Claude 3.5 Sonnet',
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
  'claude-3-5-haiku-20241022': {
    provider: 'anthropic',
    model: 'claude-3-5-haiku-20241022',
    displayName: 'Claude 3.5 Haiku',
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
  'claude-3-opus-20240229': {
    provider: 'anthropic',
    model: 'claude-3-opus-20240229',
    displayName: 'Claude 3 Opus',
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

  // OpenAI Models
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
    displayName: 'o1-mini',
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
  'o3-mini': {
    provider: 'openai',
    model: 'o3-mini',
    displayName: 'o3-mini',
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

  // Gemini Models
  'gemini-2.0-flash-exp': {
    provider: 'gemini',
    model: 'gemini-2.0-flash-exp',
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
