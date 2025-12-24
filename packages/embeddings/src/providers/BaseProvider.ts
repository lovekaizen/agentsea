/**
 * BaseProvider
 *
 * Abstract base class for embedding providers.
 */

import { EmbeddingModel } from '../core/EmbeddingModel.js';
import type {
  EmbeddingResult,
  BatchEmbeddingResult,
  EmbeddingOptions,
  BatchEmbeddingOptions,
  ProviderConfig,
  ProviderHealth,
  ProviderMetrics,
} from '../types/index.js';
import { retry, batch, withConcurrency, measureTime } from '../core/utils.js';

/**
 * Abstract base provider class
 */
export abstract class BaseProvider extends EmbeddingModel {
  protected config: ProviderConfig;
  protected metrics: ProviderMetrics;
  protected health: ProviderHealth;
  protected latencies: number[] = [];
  private readonly maxLatencySamples = 1000;

  constructor(config: ProviderConfig) {
    super();
    this.config = {
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      ...config,
    };

    this.metrics = this.createInitialMetrics();
    this.health = {
      healthy: true,
      latencyMs: 0,
      lastCheck: Date.now(),
    };
  }

  private createInitialMetrics(): ProviderMetrics {
    return {
      provider: this.config.type,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalTokens: 0,
      avgLatencyMs: 0,
      p50LatencyMs: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
      errorRate: 0,
      rateLimitHits: 0,
      estimatedCostUSD: 0,
    };
  }

  /**
   * Make the actual API call to get embeddings
   * Subclasses must implement this
   */
  protected abstract doEmbed(
    texts: string[],
    options?: EmbeddingOptions,
  ): Promise<{ vectors: number[][]; tokenCount: number }>;

  /**
   * Generate embedding for a single text
   */
  async embed(
    text: string,
    options?: EmbeddingOptions,
  ): Promise<EmbeddingResult> {
    const result = await this.embedBatch([text], options);
    return result.results[0];
  }

  /**
   * Generate embeddings for multiple texts
   */
  async embedBatch(
    texts: string[],
    options?: BatchEmbeddingOptions,
  ): Promise<BatchEmbeddingResult> {
    const startTime = performance.now();
    const maxBatchSize = this.info.maxBatchSize;
    const concurrency = options?.concurrency ?? 5;

    const results: EmbeddingResult[] = [];
    let totalTokens = 0;
    let failures = 0;

    // Split into batches if needed
    const batches = batch(texts, maxBatchSize);

    const processBatch = async (
      batchTexts: string[],
    ): Promise<EmbeddingResult[]> => {
      this.metrics.totalRequests++;

      try {
        const { result, durationMs } = await measureTime(() =>
          retry(() => this.doEmbed(batchTexts, options), {
            maxRetries: this.config.maxRetries,
            initialDelay: this.config.retryDelay,
            retryCondition: (error) => this.isRetryable(error),
          }),
        );

        this.recordLatency(durationMs);
        this.metrics.successfulRequests++;
        this.metrics.totalTokens += result.tokenCount;
        totalTokens += result.tokenCount;

        return batchTexts.map((text, i) => ({
          vector: result.vectors[i],
          text,
          tokenCount: Math.ceil(result.tokenCount / batchTexts.length),
          cached: false,
          model: this.info.name,
          dimensions: this.info.dimensions,
          latencyMs: durationMs / batchTexts.length,
        }));
      } catch (error) {
        this.metrics.failedRequests++;
        this.health.healthy = false;
        this.health.error = (error as Error).message;

        if (options?.continueOnError) {
          failures += batchTexts.length;
          return [];
        }
        throw error;
      }
    };

    // Process batches with concurrency
    const batchResults = await withConcurrency(
      batches,
      processBatch,
      concurrency,
    );

    for (const batchResult of batchResults) {
      results.push(...batchResult);
    }

    const totalLatencyMs = performance.now() - startTime;

    // Update metrics
    this.updateMetrics();

    return {
      results,
      totalTokens,
      totalLatencyMs,
      cacheHits: 0,
      cacheMisses: texts.length,
      failures,
    };
  }

  /**
   * Check if error is retryable
   */
  protected isRetryable(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes('rate limit') ||
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('econnreset') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504')
    );
  }

  /**
   * Record latency sample
   */
  protected recordLatency(latencyMs: number): void {
    this.latencies.push(latencyMs);
    if (this.latencies.length > this.maxLatencySamples) {
      this.latencies.shift();
    }
  }

  /**
   * Calculate percentile from latencies
   */
  protected calculatePercentile(p: number): number {
    if (this.latencies.length === 0) return 0;
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Update metrics
   */
  protected updateMetrics(): void {
    const total = this.metrics.totalRequests;
    if (total > 0) {
      this.metrics.errorRate = this.metrics.failedRequests / total;
      this.metrics.avgLatencyMs =
        this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length || 0;
      this.metrics.p50LatencyMs = this.calculatePercentile(50);
      this.metrics.p95LatencyMs = this.calculatePercentile(95);
      this.metrics.p99LatencyMs = this.calculatePercentile(99);
    }
  }

  /**
   * Get provider metrics
   */
  getMetrics(): ProviderMetrics {
    return { ...this.metrics };
  }

  /**
   * Get provider health
   */
  getHealth(): ProviderHealth {
    return { ...this.health };
  }

  /**
   * Check provider health
   */
  async checkHealth(): Promise<ProviderHealth> {
    try {
      const { durationMs } = await measureTime(() =>
        this.doEmbed(['health check']),
      );

      this.health = {
        healthy: true,
        latencyMs: durationMs,
        lastCheck: Date.now(),
      };
    } catch (error) {
      this.health = {
        healthy: false,
        latencyMs: 0,
        lastCheck: Date.now(),
        error: (error as Error).message,
      };
    }

    return this.health;
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = this.createInitialMetrics();
    this.latencies = [];
  }
}
