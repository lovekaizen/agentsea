/**
 * Failover routing strategy
 */

import type {
  ChatCompletionRequest,
  RoutingDecision,
} from '../../core/types.js';
import type { ProviderRegistry } from '../../providers/ProviderRegistry.js';
import type { RoutingStrategyInterface, RoutingContext } from '../Router.js';

export interface FailoverConfig {
  /**
   * Ordered list of providers to try
   */
  chain: string[];

  /**
   * Model mappings for fallback
   */
  modelMappings?: Record<string, Record<string, string>>;
}

/**
 * Failover routing strategy
 * Tries providers in order until one succeeds
 */
export class FailoverStrategy implements RoutingStrategyInterface {
  readonly name = 'failover' as const;
  private chain: string[];
  private modelMappings: Record<string, Record<string, string>>;

  constructor(config: FailoverConfig) {
    this.chain = config.chain;
    this.modelMappings = config.modelMappings || {};
  }

  route(
    request: ChatCompletionRequest,
    registry: ProviderRegistry,
    context?: RoutingContext,
  ): RoutingDecision {
    // Get previous attempts to skip
    const previousProviders = new Set(
      context?.previousAttempts?.map((a) => a.provider) || [],
    );

    // Add excluded providers
    if (context?.excludeProviders) {
      for (const p of context.excludeProviders) {
        previousProviders.add(p);
      }
    }

    // Find first available provider in chain
    const alternatives: RoutingDecision['alternatives'] = [];

    for (const providerName of this.chain) {
      const provider = registry.get(providerName);
      if (!provider) continue;
      if (!provider.isAvailable()) continue;
      if (previousProviders.has(providerName)) continue;

      // Find the model to use
      let model = request.model;
      if (!provider.supportsModel(model)) {
        // Try to find a mapped model
        const mappedModel = this.modelMappings[model]?.[providerName];
        if (mappedModel && provider.supportsModel(mappedModel)) {
          model = mappedModel;
        } else {
          // Use first available model
          model = provider.getModels()[0];
        }
      }

      // Build alternatives from remaining chain
      for (const altName of this.chain) {
        if (altName === providerName) continue;
        if (previousProviders.has(altName)) continue;

        const altProvider = registry.get(altName);
        if (!altProvider?.isAvailable()) continue;

        let altModel = request.model;
        if (!altProvider.supportsModel(altModel)) {
          altModel =
            this.modelMappings[request.model]?.[altName] ||
            altProvider.getModels()[0];
        }

        alternatives.push({
          provider: altName,
          model: altModel,
          score: 1 - alternatives.length * 0.1,
        });

        if (alternatives.length >= 3) break;
      }

      return {
        provider: providerName,
        model,
        reason:
          previousProviders.size > 0
            ? `Failover to ${providerName} after ${previousProviders.size} failures`
            : `Primary provider in failover chain`,
        alternatives,
        timestamp: new Date(),
      };
    }

    // No providers available
    throw new Error(
      `All providers in failover chain exhausted: ${this.chain.join(', ')}`,
    );
  }

  /**
   * Get the next provider in chain after the given one
   */
  getNextProvider(currentProvider: string): string | null {
    const index = this.chain.indexOf(currentProvider);
    if (index === -1 || index >= this.chain.length - 1) {
      return null;
    }
    return this.chain[index + 1];
  }

  /**
   * Get the current failover chain
   */
  getChain(): string[] {
    return [...this.chain];
  }

  /**
   * Update the failover chain
   */
  setChain(chain: string[]): void {
    this.chain = [...chain];
  }
}
