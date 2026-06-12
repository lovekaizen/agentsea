/**
 * Cost-optimized routing strategy
 */

import type {
  ChatCompletionRequest,
  RoutingDecision,
} from '../../core/types.js';
import type { ProviderRegistry } from '../../providers/ProviderRegistry.js';
import type { RoutingStrategyInterface, RoutingContext } from '../Router.js';
import { estimateRequestTokens } from '../../utils/tokenizer.js';

export interface CostOptimizedConfig {
  /**
   * Maximum cost per request (in dollars)
   */
  maxCostPerRequest?: number;

  /**
   * Prefer local models (e.g., Ollama) when available
   */
  preferLocal?: boolean;

  /**
   * Minimum quality threshold (0-1)
   */
  qualityThreshold?: number;

  /**
   * Fallback behavior when over budget
   */
  fallbackOnBudget?: 'cheapest' | 'error';
}

// Quality scores for models (subjective, 0-100)
const MODEL_QUALITY_SCORES: Record<string, number> = {
  // Top tier
  o1: 96,
  'o1-preview': 94,
  'claude-opus-4-8': 98,
  'claude-sonnet-4-6': 95,
  'gpt-5.5': 95,
  'gemini-3.1-pro-preview': 93,

  // Mid tier
  'o1-mini': 84,

  // Fast/cheap tier
  'gpt-5.4-mini': 82,
  'claude-haiku-4-5': 81,
  'gemini-3.5-flash': 80,
  'gemini-3.1-flash-lite': 74,

  // Local models
  llama3: 65,
  'llama3.1': 67,
  'llama3.2': 68,
  mistral: 62,
};

/**
 * Cost-optimized routing strategy
 * Selects the cheapest provider that meets quality requirements
 */
export class CostOptimizedStrategy implements RoutingStrategyInterface {
  readonly name = 'cost-optimized' as const;
  private config: CostOptimizedConfig;

  constructor(config: CostOptimizedConfig = {}) {
    this.config = {
      preferLocal: false,
      qualityThreshold: 0.6,
      fallbackOnBudget: 'cheapest',
      ...config,
    };
  }

  route(
    request: ChatCompletionRequest,
    registry: ProviderRegistry,
    context?: RoutingContext,
  ): RoutingDecision {
    // Get all available providers
    let providers = registry.getAvailableProviders();

    // Filter out excluded providers
    if (context?.excludeProviders) {
      providers = providers.filter(
        (p) => !context.excludeProviders!.includes(p.name),
      );
    }

    if (providers.length === 0) {
      throw new Error('No available providers');
    }

    // Estimate request tokens for cost calculation
    const estimatedInputTokens = estimateRequestTokens(
      request.messages,
      request.tools,
    );
    const estimatedOutputTokens = request.max_tokens || 1000;

    // Build candidates with cost and quality info
    const candidates: Array<{
      provider: string;
      model: string;
      cost: number;
      quality: number;
      isLocal: boolean;
    }> = [];

    for (const provider of providers) {
      const isLocal =
        provider.name === 'ollama' || provider.name === 'lmstudio';

      for (const model of provider.getModels()) {
        const modelInfo = provider.getModelInfo(model);
        if (!modelInfo) continue;

        // Calculate estimated cost
        const inputCost =
          (estimatedInputTokens / 1_000_000) * modelInfo.inputPricePerMillion;
        const outputCost =
          (estimatedOutputTokens / 1_000_000) * modelInfo.outputPricePerMillion;
        const totalCost = inputCost + outputCost;

        // Get quality score
        const quality = (MODEL_QUALITY_SCORES[model] || 50) / 100;

        candidates.push({
          provider: provider.name,
          model,
          cost: totalCost,
          quality,
          isLocal,
        });
      }
    }

    // Filter by quality threshold
    const minQuality = this.config.qualityThreshold || 0;
    let filtered = candidates.filter((c) => c.quality >= minQuality);

    // If no candidates meet quality threshold, use all
    if (filtered.length === 0) {
      filtered = candidates;
    }

    // Filter by max cost if specified
    const maxCost = context?.maxCost ?? this.config.maxCostPerRequest;
    if (maxCost !== undefined) {
      const withinBudget = filtered.filter((c) => c.cost <= maxCost);
      if (withinBudget.length > 0) {
        filtered = withinBudget;
      } else if (this.config.fallbackOnBudget === 'error') {
        throw new Error(`No models within budget of $${maxCost.toFixed(4)}`);
      }
      // Otherwise fall through to use cheapest available
    }

    // Sort by cost (cheapest first), then by local preference
    filtered.sort((a, b) => {
      if (this.config.preferLocal) {
        if (a.isLocal && !b.isLocal) return -1;
        if (!a.isLocal && b.isLocal) return 1;
      }
      return a.cost - b.cost;
    });

    const selected = filtered[0];

    return {
      provider: selected.provider,
      model: selected.model,
      reason: `Cheapest model meeting quality threshold (${(selected.quality * 100).toFixed(0)}% quality, $${selected.cost.toFixed(6)}/req)`,
      alternatives: filtered.slice(1, 4).map((c) => ({
        provider: c.provider,
        model: c.model,
        score: 1 / (c.cost + 0.0001), // Higher score = cheaper
      })),
      timestamp: new Date(),
    };
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<CostOptimizedConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): CostOptimizedConfig {
    return { ...this.config };
  }
}
