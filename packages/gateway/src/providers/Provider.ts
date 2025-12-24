/**
 * Base Provider interface for LLM providers
 */

import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionChunk,
  ProviderConfig,
  ProviderHealth,
  ModelInfo,
} from '../core/types.js';

/**
 * Abstract base class for LLM providers
 */
export abstract class Provider {
  readonly name: string;
  readonly config: ProviderConfig;
  protected health: ProviderHealth;

  constructor(config: ProviderConfig) {
    this.name = config.name;
    this.config = config;
    this.health = {
      status: 'healthy',
      latencyMs: 0,
      lastCheck: new Date(),
      errorRate: 0,
      consecutiveFailures: 0,
    };
  }

  /**
   * Execute a chat completion request
   */
  abstract chat(
    request: ChatCompletionRequest,
  ): Promise<ChatCompletionResponse>;

  /**
   * Execute a streaming chat completion request
   */
  abstract chatStream(
    request: ChatCompletionRequest,
  ): AsyncGenerator<ChatCompletionChunk, void, unknown>;

  /**
   * Check if the provider supports a specific model
   */
  supportsModel(model: string): boolean {
    return this.config.models.includes(model);
  }

  /**
   * Get information about a specific model
   */
  abstract getModelInfo(model: string): ModelInfo | null;

  /**
   * Get all supported models
   */
  getModels(): string[] {
    return [...this.config.models];
  }

  /**
   * Get the current health status
   */
  getHealth(): ProviderHealth {
    return { ...this.health };
  }

  /**
   * Perform a health check
   */
  async healthCheck(): Promise<ProviderHealth> {
    const start = Date.now();

    try {
      // Simple health check - try to make a minimal request
      await this.chat({
        model: this.config.models[0],
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
      });

      const latencyMs = Date.now() - start;
      this.health = {
        status: 'healthy',
        latencyMs,
        lastCheck: new Date(),
        errorRate: Math.max(0, this.health.errorRate - 0.1),
        consecutiveFailures: 0,
      };
    } catch (error) {
      const latencyMs = Date.now() - start;
      this.health = {
        status: this.health.consecutiveFailures >= 2 ? 'unhealthy' : 'degraded',
        latencyMs,
        lastCheck: new Date(),
        errorRate: Math.min(1, this.health.errorRate + 0.2),
        consecutiveFailures: this.health.consecutiveFailures + 1,
      };
    }

    return this.health;
  }

  /**
   * Update health status after a request
   */
  protected updateHealth(success: boolean, latencyMs: number): void {
    if (success) {
      this.health = {
        status: 'healthy',
        latencyMs:
          this.health.latencyMs > 0
            ? (this.health.latencyMs + latencyMs) / 2
            : latencyMs,
        lastCheck: new Date(),
        errorRate: Math.max(0, this.health.errorRate - 0.05),
        consecutiveFailures: 0,
      };
    } else {
      this.health = {
        ...this.health,
        status: this.health.consecutiveFailures >= 2 ? 'unhealthy' : 'degraded',
        lastCheck: new Date(),
        errorRate: Math.min(1, this.health.errorRate + 0.1),
        consecutiveFailures: this.health.consecutiveFailures + 1,
      };
    }
  }

  /**
   * Check if the provider is currently healthy
   */
  isHealthy(): boolean {
    return this.health.status === 'healthy';
  }

  /**
   * Check if the provider is available (healthy or degraded)
   */
  isAvailable(): boolean {
    return this.health.status !== 'unhealthy';
  }
}

/**
 * Options for creating a provider
 */
export interface ProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  models?: string[];
  timeout?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
}
