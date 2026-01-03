/**
 * Pricing Types
 *
 * Type definitions for model pricing and token counting.
 */

import type { AIProvider } from './cost.types.js';

/**
 * Pricing tier for volume discounts
 */
export interface PricingTier {
  /** Minimum tokens for this tier */
  minTokens: number;
  /** Maximum tokens for this tier (undefined = unlimited) */
  maxTokens?: number;
  /** Price per 1M input tokens */
  inputPrice: number;
  /** Price per 1M output tokens */
  outputPrice: number;
}

/**
 * Model pricing configuration
 */
export interface ModelPricing {
  /** Model identifier */
  model: string;
  /** Provider */
  provider: AIProvider;
  /** Display name */
  displayName?: string;
  /** Price per 1M input tokens */
  inputPricePerMillion: number;
  /** Price per 1M output tokens */
  outputPricePerMillion: number;
  /** Price per 1M cache read tokens */
  cacheReadPricePerMillion?: number;
  /** Price per 1M cache write tokens */
  cacheWritePricePerMillion?: number;
  /** Volume pricing tiers */
  tiers?: PricingTier[];
  /** Context window size */
  contextWindow?: number;
  /** Maximum output tokens */
  maxOutputTokens?: number;
  /** Pricing effective date */
  effectiveDate?: Date;
  /** Currency code */
  currency: string;
  /** Whether pricing is deprecated */
  deprecated?: boolean;
  /** Additional capabilities */
  capabilities?: ModelCapabilities;
}

/**
 * Model capabilities
 */
export interface ModelCapabilities {
  /** Supports vision/images */
  vision?: boolean;
  /** Supports function calling */
  functionCalling?: boolean;
  /** Supports streaming */
  streaming?: boolean;
  /** Supports JSON mode */
  jsonMode?: boolean;
  /** Supports system messages */
  systemMessage?: boolean;
  /** Extended thinking/reasoning */
  extendedThinking?: boolean;
  /** Computer use capability */
  computerUse?: boolean;
}

/**
 * Pricing registry configuration
 */
export interface PricingRegistryConfig {
  /** Auto-update pricing from remote */
  autoUpdate?: boolean;
  /** Update interval in ms */
  updateInterval?: number;
  /** Remote pricing URL */
  remotePricingUrl?: string;
  /** Custom pricing overrides */
  customPricing?: ModelPricing[];
  /** Default currency */
  defaultCurrency?: string;
}

/**
 * Token count request
 */
export interface TokenCountRequest {
  /** Text to count */
  text: string;
  /** Model to use for counting */
  model?: string;
  /** Provider for the model */
  provider?: AIProvider;
}

/**
 * Token count result
 */
export interface TokenCountResult {
  /** Token count */
  tokens: number;
  /** Model used for counting */
  model: string;
  /** Estimated cost for input */
  estimatedInputCost?: number;
  /** Character count */
  characters: number;
  /** Word count */
  words: number;
}

/**
 * Cost estimation request
 */
export interface CostEstimateRequest {
  /** Input text or token count */
  input: string | number;
  /** Expected output tokens (estimate) */
  estimatedOutputTokens?: number;
  /** Model to use */
  model: string;
  /** Provider */
  provider?: AIProvider;
  /** Include cache costs */
  includeCache?: boolean;
}

/**
 * Cost estimation result
 */
export interface CostEstimateResult {
  /** Estimated total cost */
  estimatedCost: number;
  /** Input token estimate */
  inputTokens: number;
  /** Output token estimate */
  outputTokens: number;
  /** Cost breakdown */
  breakdown: {
    inputCost: number;
    outputCost: number;
    cacheCost?: number;
  };
  /** Model used */
  model: string;
  /** Provider */
  provider: AIProvider;
  /** Currency */
  currency: string;
  /** Confidence level (0-1) */
  confidence: number;
}

/**
 * Provider pricing summary
 */
export interface ProviderPricingSummary {
  /** Provider name */
  provider: AIProvider;
  /** Number of models */
  modelCount: number;
  /** Cheapest input price per 1M tokens */
  minInputPrice: number;
  /** Most expensive input price per 1M tokens */
  maxInputPrice: number;
  /** Cheapest output price per 1M tokens */
  minOutputPrice: number;
  /** Most expensive output price per 1M tokens */
  maxOutputPrice: number;
  /** Available models */
  models: string[];
}

/**
 * Pricing comparison
 */
export interface PricingComparison {
  /** Model A */
  modelA: string;
  /** Model B */
  modelB: string;
  /** Price difference for input (A vs B) */
  inputPriceDiff: number;
  /** Price difference for output (A vs B) */
  outputPriceDiff: number;
  /** Percentage difference */
  percentageDiff: number;
  /** Cheaper model */
  cheaperModel: string;
  /** Cost savings estimate for sample workload */
  estimatedSavings?: number;
}
