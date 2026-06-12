/**
 * Router - orchestrates routing decisions
 */

import type {
  ChatCompletionRequest,
  RoutingDecision,
  RouterConfig,
  RoutingStrategy,
} from '../core/types.js';
import type { ProviderRegistry } from '../providers/ProviderRegistry.js';
import type { Provider } from '../providers/Provider.js';

/**
 * Base interface for routing strategies
 */
export interface RoutingStrategyInterface {
  /**
   * Name of the strategy
   */
  readonly name: RoutingStrategy;

  /**
   * Select a provider and model for a request
   */
  route(
    request: ChatCompletionRequest,
    registry: ProviderRegistry,
    context?: RoutingContext,
  ): RoutingDecision;
}

/**
 * Context passed to routing strategies
 */
export interface RoutingContext {
  excludeProviders?: string[];
  preferredProvider?: string;
  maxCost?: number;
  maxLatency?: number;
  previousAttempts?: Array<{ provider: string; model: string; error?: string }>;
}

/**
 * Model mapping for cross-provider routing
 */
export interface ModelMapping {
  [model: string]: Array<{ provider: string; model: string }>;
}

// Default model mappings (equivalents across providers)
export const DEFAULT_MODEL_MAPPINGS: ModelMapping = {
  // Flagship class
  'gpt-5.5': [
    { provider: 'anthropic', model: 'claude-sonnet-4-6' },
    { provider: 'google', model: 'gemini-3.1-pro-preview' },
  ],
  'claude-sonnet-4-6': [
    { provider: 'openai', model: 'gpt-5.5' },
    { provider: 'google', model: 'gemini-3.1-pro-preview' },
  ],
  'gemini-3.1-pro-preview': [
    { provider: 'openai', model: 'gpt-5.5' },
    { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  ],
  // Mini / fast class
  'gpt-5.4-mini': [
    { provider: 'anthropic', model: 'claude-haiku-4-5' },
    { provider: 'google', model: 'gemini-3.5-flash' },
  ],
  'claude-haiku-4-5': [
    { provider: 'openai', model: 'gpt-5.4-mini' },
    { provider: 'google', model: 'gemini-3.5-flash' },
  ],
  'gemini-3.5-flash': [
    { provider: 'openai', model: 'gpt-5.4-mini' },
    { provider: 'anthropic', model: 'claude-haiku-4-5' },
  ],
};

/**
 * Virtual model names that get routed
 */
export const VIRTUAL_MODELS = ['best', 'cheapest', 'fastest'] as const;
export type VirtualModel = (typeof VIRTUAL_MODELS)[number];

/**
 * Router class that manages routing strategies
 */
export class Router {
  private strategy: RoutingStrategyInterface;
  private modelMappings: ModelMapping;
  private fallbackChain: string[];

  constructor(
    strategy: RoutingStrategyInterface,
    config?: {
      modelMappings?: ModelMapping;
      fallbackChain?: string[];
    },
  ) {
    this.strategy = strategy;
    this.modelMappings = {
      ...DEFAULT_MODEL_MAPPINGS,
      ...config?.modelMappings,
    };
    this.fallbackChain = config?.fallbackChain || [
      'openai',
      'anthropic',
      'google',
    ];
  }

  /**
   * Route a request to a provider
   */
  route(
    request: ChatCompletionRequest,
    registry: ProviderRegistry,
    context?: RoutingContext,
  ): RoutingDecision {
    // Handle virtual models
    if (this.isVirtualModel(request.model)) {
      return this.routeVirtualModel(request.model, request, registry, context);
    }

    // Use strategy for routing
    return this.strategy.route(request, registry, context);
  }

  /**
   * Check if a model is a virtual model
   */
  isVirtualModel(model: string): model is VirtualModel {
    return VIRTUAL_MODELS.includes(model as VirtualModel);
  }

  /**
   * Route virtual model to actual provider/model
   */
  private routeVirtualModel(
    virtualModel: VirtualModel,
    _request: ChatCompletionRequest,
    registry: ProviderRegistry,
    context?: RoutingContext,
  ): RoutingDecision {
    const availableProviders = registry
      .getAvailableProviders()
      .filter((p) => !context?.excludeProviders?.includes(p.name));

    if (availableProviders.length === 0) {
      throw new Error('No available providers');
    }

    switch (virtualModel) {
      case 'best':
        return this.routeBest(availableProviders, context);
      case 'cheapest':
        return this.routeCheapest(availableProviders, context);
      case 'fastest':
        return this.routeFastest(availableProviders, context);
      default:
        throw new Error(`Unknown virtual model: ${String(virtualModel)}`);
    }
  }

  /**
   * Route to best quality model
   */
  private routeBest(
    providers: Provider[],
    context?: RoutingContext,
  ): RoutingDecision {
    // Quality ranking (subjective based on typical usage)
    const qualityRanking: Record<string, number> = {
      'claude-opus-4-8': 97,
      'claude-sonnet-4-6': 95,
      'claude-haiku-4-5': 88,
      'gpt-5.5': 94,
      'gpt-5.4-mini': 87,
      'gemini-3.1-pro-preview': 92,
      'gemini-3.5-flash': 86,
      o1: 96,
      'o1-preview': 95,
    };

    const candidates: Array<{
      provider: string;
      model: string;
      score: number;
    }> = [];

    for (const provider of providers) {
      for (const model of provider.getModels()) {
        const score = qualityRanking[model] || 50;
        candidates.push({
          provider: provider.name,
          model,
          score,
        });
      }
    }

    // Sort by quality score (highest first)
    candidates.sort((a, b) => b.score - a.score);

    // Apply preferences
    if (context?.preferredProvider) {
      const preferred = candidates.find(
        (c) => c.provider === context.preferredProvider,
      );
      if (preferred) {
        return {
          provider: preferred.provider,
          model: preferred.model,
          reason: `Best quality model from preferred provider`,
          alternatives: candidates.slice(0, 3),
          timestamp: new Date(),
        };
      }
    }

    const best = candidates[0];
    return {
      provider: best.provider,
      model: best.model,
      reason: `Highest quality model available`,
      alternatives: candidates.slice(1, 4),
      timestamp: new Date(),
    };
  }

  /**
   * Route to cheapest model
   */
  private routeCheapest(
    providers: Provider[],
    context?: RoutingContext,
  ): RoutingDecision {
    const candidates: Array<{
      provider: string;
      model: string;
      score: number;
    }> = [];

    for (const provider of providers) {
      for (const model of provider.getModels()) {
        const modelInfo = provider.getModelInfo(model);
        const avgCost = modelInfo
          ? (modelInfo.inputPricePerMillion + modelInfo.outputPricePerMillion) /
            2
          : Infinity;

        candidates.push({
          provider: provider.name,
          model,
          score: avgCost === 0 ? 0 : 1 / avgCost, // Higher score = cheaper
        });
      }
    }

    // Sort by score (highest = cheapest)
    candidates.sort((a, b) => b.score - a.score);

    // Check max cost constraint
    if (context?.maxCost !== undefined) {
      const filtered = candidates.filter((c) => {
        const provider = providers.find((p) => p.name === c.provider);
        const modelInfo = provider?.getModelInfo(c.model);
        if (!modelInfo) return true;
        // Rough cost estimate for 1000 input + 500 output tokens
        const estimatedCost =
          (1000 / 1_000_000) * modelInfo.inputPricePerMillion +
          (500 / 1_000_000) * modelInfo.outputPricePerMillion;
        return estimatedCost <= context.maxCost!;
      });

      if (filtered.length > 0) {
        const cheapest = filtered[0];
        return {
          provider: cheapest.provider,
          model: cheapest.model,
          reason: `Cheapest model within budget`,
          alternatives: filtered.slice(1, 4),
          timestamp: new Date(),
        };
      }
    }

    const cheapest = candidates[0];
    return {
      provider: cheapest.provider,
      model: cheapest.model,
      reason: `Cheapest available model`,
      alternatives: candidates.slice(1, 4),
      timestamp: new Date(),
    };
  }

  /**
   * Route to fastest model (based on latency)
   */
  private routeFastest(
    providers: Provider[],
    context?: RoutingContext,
  ): RoutingDecision {
    const candidates: Array<{
      provider: string;
      model: string;
      score: number;
    }> = [];

    for (const provider of providers) {
      const health = provider.getHealth();
      const latency = health.latencyMs || 1000; // Default 1s if unknown

      for (const model of provider.getModels()) {
        candidates.push({
          provider: provider.name,
          model,
          score: 1 / latency, // Higher score = lower latency
        });
      }
    }

    // Sort by score (highest = fastest)
    candidates.sort((a, b) => b.score - a.score);

    // Check max latency constraint
    if (context?.maxLatency !== undefined) {
      const filtered = candidates.filter((c) => {
        const provider = providers.find((p) => p.name === c.provider);
        const health = provider?.getHealth();
        return (health?.latencyMs || 1000) <= context.maxLatency!;
      });

      if (filtered.length > 0) {
        const fastest = filtered[0];
        return {
          provider: fastest.provider,
          model: fastest.model,
          reason: `Fastest model within latency limit`,
          alternatives: filtered.slice(1, 4),
          timestamp: new Date(),
        };
      }
    }

    const fastest = candidates[0];
    return {
      provider: fastest.provider,
      model: fastest.model,
      reason: `Fastest available provider`,
      alternatives: candidates.slice(1, 4),
      timestamp: new Date(),
    };
  }

  /**
   * Get equivalent models across providers
   */
  getEquivalentModels(
    model: string,
  ): Array<{ provider: string; model: string }> {
    return this.modelMappings[model] || [];
  }

  /**
   * Set the routing strategy
   */
  setStrategy(strategy: RoutingStrategyInterface): void {
    this.strategy = strategy;
  }

  /**
   * Get the current strategy name
   */
  getStrategyName(): RoutingStrategy {
    return this.strategy.name;
  }

  /**
   * Get the fallback chain
   */
  getFallbackChain(): string[] {
    return [...this.fallbackChain];
  }
}

/**
 * Create router configuration from options
 */
export function createRouterConfig(
  options: Partial<RouterConfig>,
): RouterConfig {
  return {
    strategy: options.strategy || 'round-robin',
    fallbackChain: options.fallbackChain,
    weights: options.weights,
    rules: options.rules,
  };
}
