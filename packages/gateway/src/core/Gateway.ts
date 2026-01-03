/**
 * Gateway - Main entry point for the LLM Gateway
 */

import { EventEmitter } from 'events';
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionChunk,
  GatewayConfig,
  GatewayMetrics,
  GatewayResponseMetadata,
  RoutingDecision,
} from './types.js';
import { GatewayError, ProviderError, ValidationError } from './types.js';
import { ProviderRegistry } from '../providers/ProviderRegistry.js';
import { Provider } from '../providers/Provider.js';
import { HealthMonitor } from '../providers/ProviderHealth.js';
import {
  Router,
  RoundRobinStrategy,
  FailoverStrategy,
  CostOptimizedStrategy,
  LatencyOptimizedStrategy,
  type RoutingContext,
} from '../routing/index.js';
import { calculateCost } from '../utils/pricing.js';
import { hashRequest, generateRequestId } from '../utils/hashing.js';
import { OpenAIProvider } from '../providers/registry/OpenAIProvider.js';
import { AnthropicProvider } from '../providers/registry/AnthropicProvider.js';
import { GoogleProvider } from '../providers/registry/GoogleProvider.js';
import { LRUCache } from 'lru-cache';
import pino from 'pino';

export interface GatewayEvents {
  'request:start': (event: {
    requestId: string;
    model: string;
    provider?: string;
  }) => void;
  'request:complete': (event: {
    requestId: string;
    provider: string;
    model: string;
    latencyMs: number;
    cost: number;
    cached: boolean;
    tokens: { input: number; output: number };
  }) => void;
  'request:error': (event: {
    requestId: string;
    provider?: string;
    error: Error;
  }) => void;
  'provider:unhealthy': (provider: string) => void;
  'provider:healthy': (provider: string) => void;
}

/**
 * Main Gateway class
 */
export class Gateway extends EventEmitter {
  private readonly _config: GatewayConfig;
  private readonly registry: ProviderRegistry;
  private readonly router: Router;
  private readonly healthMonitor: HealthMonitor;
  private readonly cache: LRUCache<string, ChatCompletionResponse> | null;
  private readonly logger: pino.Logger;
  private metrics: GatewayMetrics;

  /**
   * Chat completions API interface (OpenAI-compatible)
   */
  public readonly chat = {
    completions: {
      create: this.createCompletion.bind(this),
    },
  };

  constructor(config: GatewayConfig) {
    super();
    this._config = config;

    // Initialize logger
    this.logger = pino({
      level: config.telemetry?.logging?.level || 'info',
      transport:
        process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty' }
          : undefined,
    });

    // Initialize provider registry
    this.registry = new ProviderRegistry();

    // Register providers from config
    for (const providerConfig of config.providers) {
      const provider = this.createProvider(providerConfig);
      if (provider) {
        this.registry.register(provider);
      }
    }

    // Initialize router
    this.router = this.createRouter(config);

    // Initialize health monitor
    this.healthMonitor = new HealthMonitor({
      checkInterval: 60000,
      unhealthyThreshold: 3,
      degradedThreshold: 1,
      circuitBreaker: {
        failureThreshold: 5,
        successThreshold: 3,
        timeout: 30000,
      },
    });

    // Initialize cache
    if (config.cache?.enabled) {
      this.cache = new LRUCache({
        max: config.cache.maxEntries || 1000,
        ttl: (config.cache.ttl || 3600) * 1000,
      });
    } else {
      this.cache = null;
    }

    // Initialize metrics
    this.metrics = this.createInitialMetrics();

    // Set up health monitoring events
    this.healthMonitor.on('unhealthy', (provider: string) => {
      this.logger.warn({ provider }, 'Provider marked unhealthy');
      this.emit('provider:unhealthy', provider);
    });

    this.healthMonitor.on('circuit-open', (provider: string) => {
      this.logger.warn({ provider }, 'Circuit breaker opened');
    });
  }

  /**
   * Create a chat completion (main API)
   */
  async createCompletion(
    request: ChatCompletionRequest,
  ): Promise<ChatCompletionResponse | AsyncGenerator<ChatCompletionChunk>> {
    // Validate request
    this.validateRequest(request);

    // Handle streaming
    if (request.stream) {
      return this.createStreamingCompletion(request);
    }

    return this.createNonStreamingCompletion(request);
  }

  /**
   * Non-streaming completion
   */
  private async createNonStreamingCompletion(
    request: ChatCompletionRequest,
  ): Promise<ChatCompletionResponse> {
    const requestId = request._gateway?.requestId || generateRequestId();
    const start = Date.now();

    this.emit('request:start', {
      requestId,
      model: request.model,
    });

    try {
      // Check cache
      if (this.cache && request._gateway?.cachePolicy !== 'no-cache') {
        const cacheKey = hashRequest(request);
        const cached = this.cache.get(cacheKey);

        if (cached) {
          this.metrics.cache.hits++;
          this.updateCacheHitRate();
          this.logger.debug({ requestId, cacheKey }, 'Cache hit');

          const response = {
            ...cached,
            _gateway: {
              ...cached._gateway,
              cached: true,
              cacheKey,
              latencyMs: Date.now() - start,
            } as GatewayResponseMetadata,
          };

          this.emit('request:complete', {
            requestId,
            provider: cached._gateway?.provider || 'cache',
            model: cached.model,
            latencyMs: Date.now() - start,
            cost: 0,
            cached: true,
            tokens: { input: 0, output: 0 },
          });

          return response;
        }

        this.metrics.cache.misses++;
      }

      // Route request
      const routingContext: RoutingContext = {
        excludeProviders: request._gateway?.excludeProviders,
        preferredProvider: request._gateway?.preferredProvider,
        maxCost: request._gateway?.maxCost,
        maxLatency: request._gateway?.maxLatency,
      };

      let lastError: Error | null = null;
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        attempts++;

        const decision = this.router.route(request, this.registry, {
          ...routingContext,
          previousAttempts:
            attempts > 1
              ? [{ provider: '', model: '', error: lastError?.message }]
              : undefined,
        });

        const provider = this.registry.get(decision.provider);
        if (!provider) {
          lastError = new GatewayError(
            `Provider not found: ${decision.provider}`,
            'PROVIDER_NOT_FOUND',
            500,
          );
          continue;
        }

        // Check circuit breaker
        if (!this.healthMonitor.isRequestAllowed(decision.provider)) {
          this.logger.debug(
            { provider: decision.provider },
            'Circuit breaker open, skipping',
          );
          routingContext.excludeProviders = [
            ...(routingContext.excludeProviders || []),
            decision.provider,
          ];
          continue;
        }

        try {
          // Make the actual request
          const providerRequest = {
            ...request,
            model: decision.model,
          };

          const providerStart = Date.now();
          const response = await provider.chat(providerRequest);
          const latencyMs = Date.now() - providerStart;

          // Record success
          this.healthMonitor.recordRequest(decision.provider, true, latencyMs);

          // Calculate cost
          const cost = calculateCost(decision.model, response.usage);

          // Update metrics
          this.updateMetrics(decision, response, latencyMs, cost);

          // Add gateway metadata
          const gatewayResponse: ChatCompletionResponse = {
            ...response,
            _gateway: {
              provider: decision.provider,
              originalModel: request.model,
              latencyMs,
              cost,
              cached: false,
              retries: attempts - 1,
              routingDecision: decision,
            },
          };

          // Cache the response
          if (this.cache && request._gateway?.cachePolicy !== 'no-cache') {
            const cacheKey = hashRequest(request);
            this.cache.set(cacheKey, gatewayResponse);
          }

          this.emit('request:complete', {
            requestId,
            provider: decision.provider,
            model: decision.model,
            latencyMs: Date.now() - start,
            cost,
            cached: false,
            tokens: {
              input: response.usage.prompt_tokens,
              output: response.usage.completion_tokens,
            },
          });

          return gatewayResponse;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));

          // Record failure
          this.healthMonitor.recordRequest(
            decision.provider,
            false,
            Date.now() - start,
          );

          // Check if retryable
          if (error instanceof ProviderError && !error.retryable) {
            throw error;
          }

          this.logger.warn(
            {
              provider: decision.provider,
              error: lastError.message,
              attempt: attempts,
            },
            'Request failed, retrying',
          );

          // Add to exclude list for next attempt
          routingContext.excludeProviders = [
            ...(routingContext.excludeProviders || []),
            decision.provider,
          ];
        }
      }

      // All attempts failed
      this.metrics.requests.failed++;
      this.emit('request:error', { requestId, error: lastError! });
      throw (
        lastError ||
        new GatewayError('All attempts failed', 'ALL_ATTEMPTS_FAILED', 502)
      );
    } catch (error) {
      this.metrics.requests.failed++;
      this.emit('request:error', {
        requestId,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Streaming completion
   */
  private async *createStreamingCompletion(
    request: ChatCompletionRequest,
  ): AsyncGenerator<ChatCompletionChunk, void, unknown> {
    const requestId = request._gateway?.requestId || generateRequestId();
    const start = Date.now();

    this.emit('request:start', { requestId, model: request.model });

    // Route request
    const decision = this.router.route(request, this.registry, {
      excludeProviders: request._gateway?.excludeProviders,
      preferredProvider: request._gateway?.preferredProvider,
    });

    const provider = this.registry.get(decision.provider);
    if (!provider) {
      throw new GatewayError(
        `Provider not found: ${decision.provider}`,
        'PROVIDER_NOT_FOUND',
        500,
      );
    }

    const providerRequest = { ...request, model: decision.model };

    try {
      let totalInputTokens = 0;
      let totalOutputTokens = 0;

      for await (const chunk of provider.chatStream(providerRequest)) {
        // Track usage from final chunk
        if (chunk.usage) {
          totalInputTokens = chunk.usage.prompt_tokens;
          totalOutputTokens = chunk.usage.completion_tokens;
        }

        yield chunk;
      }

      const latencyMs = Date.now() - start;
      const cost = calculateCost(decision.model, {
        prompt_tokens: totalInputTokens,
        completion_tokens: totalOutputTokens,
        total_tokens: totalInputTokens + totalOutputTokens,
      });

      this.healthMonitor.recordRequest(decision.provider, true, latencyMs);

      this.emit('request:complete', {
        requestId,
        provider: decision.provider,
        model: decision.model,
        latencyMs,
        cost,
        cached: false,
        tokens: { input: totalInputTokens, output: totalOutputTokens },
      });
    } catch (error) {
      this.healthMonitor.recordRequest(
        decision.provider,
        false,
        Date.now() - start,
      );
      this.emit('request:error', {
        requestId,
        provider: decision.provider,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Validate a request
   */
  private validateRequest(request: ChatCompletionRequest): void {
    if (!request.model) {
      throw new ValidationError('Model is required');
    }

    if (!request.messages || request.messages.length === 0) {
      throw new ValidationError(
        'Messages array is required and cannot be empty',
      );
    }

    for (const message of request.messages) {
      if (!message.role) {
        throw new ValidationError('Message role is required');
      }
      if (!['system', 'user', 'assistant', 'tool'].includes(message.role)) {
        throw new ValidationError(`Invalid message role: ${message.role}`);
      }
    }
  }

  /**
   * Create a provider instance from config
   */
  private createProvider(
    config: GatewayConfig['providers'][0],
  ): Provider | null {
    switch (config.name) {
      case 'openai':
        return new OpenAIProvider({
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          models: config.models,
          timeout: config.timeout,
        });
      case 'anthropic':
        return new AnthropicProvider({
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          models: config.models,
          timeout: config.timeout,
        });
      case 'google':
        return new GoogleProvider({
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          models: config.models,
          timeout: config.timeout,
        });
      default:
        this.logger.warn({ provider: config.name }, 'Unknown provider type');
        return null;
    }
  }

  /**
   * Create router from config
   */
  private createRouter(config: GatewayConfig): Router {
    const strategyName = config.routing?.strategy || 'round-robin';

    let strategy;
    switch (strategyName) {
      case 'failover':
        strategy = new FailoverStrategy({
          chain: config.routing?.fallbackChain || [
            'openai',
            'anthropic',
            'google',
          ],
        });
        break;
      case 'cost-optimized':
        strategy = new CostOptimizedStrategy();
        break;
      case 'latency-optimized':
        strategy = new LatencyOptimizedStrategy();
        break;
      case 'round-robin':
      default:
        strategy = new RoundRobinStrategy({
          weights: config.routing?.weights,
        });
        break;
    }

    return new Router(strategy, {
      fallbackChain: config.routing?.fallbackChain,
    });
  }

  /**
   * Create initial metrics object
   */
  private createInitialMetrics(): GatewayMetrics {
    return {
      requests: { total: 0, successful: 0, failed: 0, cached: 0 },
      latency: { avg: 0, p50: 0, p95: 0, p99: 0 },
      tokens: { input: 0, output: 0, total: 0 },
      cost: { total: 0, byProvider: {}, byModel: {} },
      cache: { hits: 0, misses: 0, hitRate: 0 },
      providers: {},
    };
  }

  /**
   * Update metrics after a request
   */
  private updateMetrics(
    decision: RoutingDecision,
    response: ChatCompletionResponse,
    latencyMs: number,
    cost: number,
  ): void {
    this.metrics.requests.total++;
    this.metrics.requests.successful++;

    // Update latency (simple moving average)
    this.metrics.latency.avg =
      (this.metrics.latency.avg * (this.metrics.requests.successful - 1) +
        latencyMs) /
      this.metrics.requests.successful;

    // Update tokens
    this.metrics.tokens.input += response.usage.prompt_tokens;
    this.metrics.tokens.output += response.usage.completion_tokens;
    this.metrics.tokens.total += response.usage.total_tokens;

    // Update cost
    this.metrics.cost.total += cost;
    this.metrics.cost.byProvider[decision.provider] =
      (this.metrics.cost.byProvider[decision.provider] || 0) + cost;
    this.metrics.cost.byModel[decision.model] =
      (this.metrics.cost.byModel[decision.model] || 0) + cost;

    // Update cache hit rate
    this.updateCacheHitRate();

    // Update provider health
    this.metrics.providers = this.registry.getHealthStatus();
  }

  /**
   * Update cache hit rate metric
   */
  private updateCacheHitRate(): void {
    const totalCacheOps = this.metrics.cache.hits + this.metrics.cache.misses;
    this.metrics.cache.hitRate =
      totalCacheOps > 0 ? this.metrics.cache.hits / totalCacheOps : 0;
  }

  /**
   * Get current metrics
   */
  getMetrics(): GatewayMetrics {
    return { ...this.metrics };
  }

  /**
   * Get gateway configuration
   */
  getConfig(): GatewayConfig {
    return { ...this._config };
  }

  /**
   * Get provider registry
   */
  getRegistry(): ProviderRegistry {
    return this.registry;
  }

  /**
   * Get router
   */
  getRouter(): Router {
    return this.router;
  }

  /**
   * Check health of all providers
   */
  async checkHealth(): Promise<Record<string, boolean>> {
    const healthStatus = await this.registry.checkHealth();
    const result: Record<string, boolean> = {};

    for (const [name, health] of Object.entries(healthStatus)) {
      result[name] = health.status === 'healthy';
    }

    return result;
  }

  /**
   * Shut down the gateway
   */
  shutdown(): void {
    this.registry.stopHealthChecks();
    this.cache?.clear();
    this.logger.info('Gateway shut down');
  }
}
