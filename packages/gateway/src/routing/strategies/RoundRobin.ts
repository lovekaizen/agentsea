/**
 * Round-robin routing strategy
 */

import type {
  ChatCompletionRequest,
  RoutingDecision,
} from '../../core/types.js';
import type { ProviderRegistry } from '../../providers/ProviderRegistry.js';
import type { RoutingStrategyInterface, RoutingContext } from '../Router.js';

export interface RoundRobinConfig {
  weights?: Record<string, number>;
}

/**
 * Round-robin routing strategy
 * Distributes requests evenly across providers
 */
export class RoundRobinStrategy implements RoutingStrategyInterface {
  readonly name = 'round-robin' as const;
  private currentIndex = 0;
  private weights: Record<string, number>;

  constructor(config: RoundRobinConfig = {}) {
    this.weights = config.weights || {};
  }

  route(
    request: ChatCompletionRequest,
    registry: ProviderRegistry,
    context?: RoutingContext,
  ): RoutingDecision {
    // Get providers that support the requested model
    let providers = registry.getProvidersForModel(request.model);

    // If no providers support the model, get all available providers
    if (providers.length === 0) {
      providers = registry.getAvailableProviders();
    }

    // Filter out excluded providers
    if (context?.excludeProviders) {
      providers = providers.filter(
        (p) => !context.excludeProviders!.includes(p.name),
      );
    }

    // Filter to only available providers
    providers = providers.filter((p) => p.isAvailable());

    if (providers.length === 0) {
      throw new Error(`No available providers for model: ${request.model}`);
    }

    // Prefer the preferred provider if specified and available
    if (context?.preferredProvider) {
      const preferred = providers.find(
        (p) => p.name === context.preferredProvider,
      );
      if (preferred) {
        const model = preferred.supportsModel(request.model)
          ? request.model
          : preferred.getModels()[0];

        return {
          provider: preferred.name,
          model,
          reason: 'Preferred provider selected',
          alternatives: providers
            .filter((p) => p.name !== preferred.name)
            .slice(0, 3)
            .map((p) => ({
              provider: p.name,
              model: p.supportsModel(request.model)
                ? request.model
                : p.getModels()[0],
              score: 1,
            })),
          timestamp: new Date(),
        };
      }
    }

    // Build weighted list
    const weightedProviders: Array<{
      provider: (typeof providers)[0];
      weight: number;
    }> = [];
    for (const provider of providers) {
      const weight = this.weights[provider.name] || 1;
      for (let i = 0; i < weight; i++) {
        weightedProviders.push({ provider, weight });
      }
    }

    // Select next provider in rotation
    this.currentIndex = this.currentIndex % weightedProviders.length;
    const selected = weightedProviders[this.currentIndex];
    this.currentIndex++;

    const model = selected.provider.supportsModel(request.model)
      ? request.model
      : selected.provider.getModels()[0];

    return {
      provider: selected.provider.name,
      model,
      reason: `Round-robin selection (index: ${this.currentIndex - 1})`,
      alternatives: providers
        .filter((p) => p.name !== selected.provider.name)
        .slice(0, 3)
        .map((p) => ({
          provider: p.name,
          model: p.supportsModel(request.model)
            ? request.model
            : p.getModels()[0],
          score: 1,
        })),
      timestamp: new Date(),
    };
  }

  /**
   * Reset the rotation index
   */
  reset(): void {
    this.currentIndex = 0;
  }
}
