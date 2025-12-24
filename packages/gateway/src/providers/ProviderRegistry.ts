/**
 * Provider Registry - manages all LLM providers
 */

import type { ProviderHealth, ModelInfo } from '../core/types.js';
import type { Provider } from './Provider.js';

export interface ProviderWithModels {
  provider: Provider;
  models: string[];
}

/**
 * Registry for managing LLM providers
 */
export class ProviderRegistry {
  private providers: Map<string, Provider> = new Map();
  private modelToProvider: Map<string, string[]> = new Map();
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;

  constructor(providers: Provider[] = []) {
    for (const provider of providers) {
      this.register(provider);
    }
  }

  /**
   * Register a provider
   */
  register(provider: Provider): void {
    this.providers.set(provider.name, provider);

    // Map models to this provider
    for (const model of provider.getModels()) {
      const existing = this.modelToProvider.get(model) || [];
      if (!existing.includes(provider.name)) {
        existing.push(provider.name);
        this.modelToProvider.set(model, existing);
      }
    }
  }

  /**
   * Unregister a provider
   */
  unregister(name: string): boolean {
    const provider = this.providers.get(name);
    if (!provider) {
      return false;
    }

    // Remove model mappings
    for (const model of provider.getModels()) {
      const providers = this.modelToProvider.get(model);
      if (providers) {
        const filtered = providers.filter((p) => p !== name);
        if (filtered.length > 0) {
          this.modelToProvider.set(model, filtered);
        } else {
          this.modelToProvider.delete(model);
        }
      }
    }

    this.providers.delete(name);
    return true;
  }

  /**
   * Get a provider by name
   */
  get(name: string): Provider | undefined {
    return this.providers.get(name);
  }

  /**
   * Get all registered providers
   */
  getAll(): Provider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get all provider names
   */
  getNames(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get providers that support a specific model
   */
  getProvidersForModel(model: string): Provider[] {
    const names = this.modelToProvider.get(model) || [];
    return names
      .map((name) => this.providers.get(name))
      .filter((p): p is Provider => p !== undefined);
  }

  /**
   * Get the first available provider for a model
   */
  getProviderForModel(model: string): Provider | undefined {
    const providers = this.getProvidersForModel(model);
    return providers.find((p) => p.isAvailable());
  }

  /**
   * Check if any provider supports a model
   */
  hasModel(model: string): boolean {
    return this.modelToProvider.has(model);
  }

  /**
   * Get all available models across all providers
   */
  getAllModels(): string[] {
    return Array.from(this.modelToProvider.keys());
  }

  /**
   * Get model info from the appropriate provider
   */
  getModelInfo(model: string): ModelInfo | null {
    const provider = this.getProviderForModel(model);
    return provider?.getModelInfo(model) ?? null;
  }

  /**
   * Get health status for all providers
   */
  getHealthStatus(): Record<string, ProviderHealth> {
    const status: Record<string, ProviderHealth> = {};
    for (const [name, provider] of this.providers) {
      status[name] = provider.getHealth();
    }
    return status;
  }

  /**
   * Get healthy providers
   */
  getHealthyProviders(): Provider[] {
    return this.getAll().filter((p) => p.isHealthy());
  }

  /**
   * Get available providers (healthy or degraded)
   */
  getAvailableProviders(): Provider[] {
    return this.getAll().filter((p) => p.isAvailable());
  }

  /**
   * Run health checks on all providers
   */
  async checkHealth(): Promise<Record<string, ProviderHealth>> {
    const results: Record<string, ProviderHealth> = {};

    await Promise.all(
      this.getAll().map(async (provider) => {
        results[provider.name] = await provider.healthCheck();
      }),
    );

    return results;
  }

  /**
   * Start periodic health checks
   */
  startHealthChecks(intervalMs: number = 60000): void {
    if (this.healthCheckInterval) {
      return;
    }

    this.healthCheckInterval = setInterval(() => {
      this.checkHealth().catch(console.error);
    }, intervalMs);
  }

  /**
   * Stop periodic health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Get the number of registered providers
   */
  get size(): number {
    return this.providers.size;
  }
}
