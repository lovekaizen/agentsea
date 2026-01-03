/**
 * Token Counter
 *
 * Accurate token counting using tiktoken for OpenAI models
 * and approximations for other providers.
 */

import type {
  AIProvider,
  TokenCountRequest,
  TokenCountResult,
  CostEstimateRequest,
  CostEstimateResult,
} from '../types/index.js';
import type { ModelPricingRegistry } from './ModelPricingRegistry.js';

// Tiktoken encoding cache
let cl100kEncoder: Awaited<
  ReturnType<(typeof import('tiktoken'))['get_encoding']>
> | null = null;

/**
 * Get or create tiktoken encoder
 */
async function getEncoder(): Promise<typeof cl100kEncoder> {
  if (!cl100kEncoder) {
    try {
      const tiktoken = await import('tiktoken');
      cl100kEncoder = tiktoken.get_encoding('cl100k_base');
    } catch {
      // Tiktoken not available, will use approximation
      return null;
    }
  }
  return cl100kEncoder;
}

/**
 * Provider-specific token counting strategies
 */
const PROVIDER_STRATEGIES: Record<
  AIProvider,
  {
    encoding: 'tiktoken' | 'approximate';
    charsPerToken: number;
  }
> = {
  openai: { encoding: 'tiktoken', charsPerToken: 4 },
  anthropic: { encoding: 'approximate', charsPerToken: 3.5 },
  google: { encoding: 'approximate', charsPerToken: 4 },
  azure: { encoding: 'tiktoken', charsPerToken: 4 },
  bedrock: { encoding: 'approximate', charsPerToken: 3.5 },
  cohere: { encoding: 'approximate', charsPerToken: 4 },
  mistral: { encoding: 'approximate', charsPerToken: 4 },
  replicate: { encoding: 'approximate', charsPerToken: 4 },
  custom: { encoding: 'approximate', charsPerToken: 4 },
};

/**
 * Token Counter class
 */
export class TokenCounter {
  private pricingRegistry: ModelPricingRegistry;
  private cache: Map<string, number> = new Map();
  private maxCacheSize: number;

  constructor(
    pricingRegistry: ModelPricingRegistry,
    options?: { maxCacheSize?: number },
  ) {
    this.pricingRegistry = pricingRegistry;
    this.maxCacheSize = options?.maxCacheSize ?? 1000;
  }

  /**
   * Count tokens in text
   */
  async countTokens(request: TokenCountRequest): Promise<TokenCountResult> {
    const { text, model, provider } = request;

    // Determine provider
    const effectiveProvider = provider ?? this.detectProvider(model);

    // Check cache
    const cacheKey = `${effectiveProvider}:${text.substring(0, 100)}:${text.length}`;
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) {
      return this.buildResult(
        text,
        cached,
        model ?? 'default',
        effectiveProvider,
      );
    }

    // Count tokens
    let tokens: number;
    const strategy = PROVIDER_STRATEGIES[effectiveProvider];

    if (strategy.encoding === 'tiktoken') {
      tokens = await this.countWithTiktoken(text, strategy.charsPerToken);
    } else {
      tokens = this.countApproximate(text, strategy.charsPerToken);
    }

    // Cache result
    this.setCached(cacheKey, tokens);

    return this.buildResult(
      text,
      tokens,
      model ?? 'default',
      effectiveProvider,
    );
  }

  /**
   * Count tokens using tiktoken
   */
  private async countWithTiktoken(
    text: string,
    fallbackCharsPerToken: number,
  ): Promise<number> {
    const encoder = await getEncoder();

    if (encoder) {
      try {
        const encoded = encoder.encode(text);
        return encoded.length;
      } catch {
        // Fall back to approximation
      }
    }

    return this.countApproximate(text, fallbackCharsPerToken);
  }

  /**
   * Count tokens using approximation
   */
  private countApproximate(text: string, charsPerToken: number): number {
    // More accurate approximation considering:
    // 1. Whitespace and punctuation
    // 2. Numbers
    // 3. Special characters

    let adjustedLength = 0;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const code = char.charCodeAt(0);

      // Whitespace and common punctuation: typically own token
      if (/[\s.,!?;:'"]/.test(char)) {
        adjustedLength += 0.5;
      }
      // Numbers: often own tokens
      else if (/\d/.test(char)) {
        adjustedLength += 0.7;
      }
      // Non-ASCII characters: often multiple tokens
      else if (code > 127) {
        adjustedLength += 2;
      }
      // Regular characters
      else {
        adjustedLength += 1;
      }
    }

    return Math.ceil(adjustedLength / charsPerToken);
  }

  /**
   * Build token count result
   */
  private buildResult(
    text: string,
    tokens: number,
    model: string,
    _provider: AIProvider,
  ): TokenCountResult {
    const words = text.split(/\s+/).filter((w) => w.length > 0).length;
    const characters = text.length;

    // Get estimated cost if pricing available
    let estimatedInputCost: number | undefined;
    const pricing = this.pricingRegistry.getPricingByModel(model);
    if (pricing) {
      estimatedInputCost = (tokens / 1_000_000) * pricing.inputPricePerMillion;
    }

    return {
      tokens,
      model,
      estimatedInputCost,
      characters,
      words,
    };
  }

  /**
   * Detect provider from model name
   */
  private detectProvider(model?: string): AIProvider {
    if (!model) return 'openai';

    const modelLower = model.toLowerCase();

    if (modelLower.includes('claude')) return 'anthropic';
    if (modelLower.includes('gpt') || modelLower.includes('o1'))
      return 'openai';
    if (modelLower.includes('gemini')) return 'google';
    if (modelLower.includes('mistral') || modelLower.includes('codestral'))
      return 'mistral';
    if (modelLower.includes('command')) return 'cohere';

    return 'openai';
  }

  /**
   * Estimate cost for a request
   */
  async estimateCost(
    request: CostEstimateRequest,
  ): Promise<CostEstimateResult> {
    const { input, estimatedOutputTokens = 500, model, provider } = request;

    // Count input tokens
    let inputTokens: number;
    if (typeof input === 'number') {
      inputTokens = input;
    } else {
      const countResult = await this.countTokens({
        text: input,
        model,
        provider,
      });
      inputTokens = countResult.tokens;
    }

    // Get pricing
    const effectiveProvider = provider ?? this.detectProvider(model);
    const pricing = this.pricingRegistry.getPricing(effectiveProvider, model);

    if (!pricing) {
      throw new Error(`No pricing found for ${effectiveProvider}:${model}`);
    }

    // Calculate costs
    const inputCost = (inputTokens / 1_000_000) * pricing.inputPricePerMillion;
    const outputCost =
      (estimatedOutputTokens / 1_000_000) * pricing.outputPricePerMillion;

    const cacheCost = request.includeCache
      ? (inputTokens / 1_000_000) * (pricing.cacheWritePricePerMillion ?? 0)
      : undefined;

    const estimatedCost = inputCost + outputCost + (cacheCost ?? 0);

    // Calculate confidence based on output estimation accuracy
    // Higher confidence if output tokens were provided
    const confidence = estimatedOutputTokens === 500 ? 0.7 : 0.85;

    return {
      estimatedCost,
      inputTokens,
      outputTokens: estimatedOutputTokens,
      breakdown: {
        inputCost,
        outputCost,
        cacheCost,
      },
      model,
      provider: effectiveProvider,
      currency: pricing.currency,
      confidence,
    };
  }

  /**
   * Batch count tokens
   */
  async countTokensBatch(
    texts: string[],
    options?: { model?: string; provider?: AIProvider },
  ): Promise<TokenCountResult[]> {
    return Promise.all(
      texts.map((text) =>
        this.countTokens({
          text,
          model: options?.model,
          provider: options?.provider,
        }),
      ),
    );
  }

  /**
   * Count tokens for messages (chat format)
   */
  async countMessagesTokens(
    messages: Array<{ role: string; content: string }>,
    options?: { model?: string; provider?: AIProvider },
  ): Promise<{
    totalTokens: number;
    perMessage: Array<{ role: string; tokens: number }>;
    overhead: number;
  }> {
    const perMessage: Array<{ role: string; tokens: number }> = [];
    let totalContent = 0;

    for (const message of messages) {
      const result = await this.countTokens({
        text: message.content,
        model: options?.model,
        provider: options?.provider,
      });
      perMessage.push({ role: message.role, tokens: result.tokens });
      totalContent += result.tokens;
    }

    // Estimate overhead for message formatting
    // OpenAI adds ~4 tokens per message for formatting
    const overhead = messages.length * 4 + 3; // +3 for priming
    const totalTokens = totalContent + overhead;

    return {
      totalTokens,
      perMessage,
      overhead,
    };
  }

  /**
   * Set cached value
   */
  private setCached(key: string, value: number): void {
    if (this.cache.size >= this.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  getCacheStats(): { size: number; maxSize: number; hitRate: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      hitRate: 0, // Would need to track hits/misses for accurate rate
    };
  }
}

/**
 * Create a simple token counter without pricing registry
 */
export async function countTokens(
  text: string,
  options?: { model?: string; provider?: AIProvider },
): Promise<number> {
  const provider = options?.provider ?? 'openai';
  const strategy = PROVIDER_STRATEGIES[provider];

  if (strategy.encoding === 'tiktoken') {
    const encoder = await getEncoder();
    if (encoder) {
      try {
        return encoder.encode(text).length;
      } catch {
        // Fall through to approximation
      }
    }
  }

  // Approximation
  return Math.ceil(text.length / strategy.charsPerToken);
}

/**
 * Quick token count approximation (no async)
 */
export function countTokensApprox(text: string, charsPerToken = 4): number {
  return Math.ceil(text.length / charsPerToken);
}
