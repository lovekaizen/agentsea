import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseProvider } from '../providers/BaseProvider.js';
import type { EmbeddingModelInfo, EmbeddingOptions } from '../types/index.js';

// Concrete implementation for testing
class TestProvider extends BaseProvider {
  readonly info: EmbeddingModelInfo = {
    name: 'test-model',
    provider: 'test',
    dimensions: 128,
    maxTokens: 512,
    maxBatchSize: 10,
    costPer1K: 0.0001,
  };

  protected async doEmbed(
    texts: string[],
    options?: EmbeddingOptions,
  ): Promise<{ vectors: number[][]; tokenCount: number }> {
    const tokenCount = texts.reduce((sum, t) => sum + this.countTokens(t), 0);

    // Update cost estimate
    this.metrics.estimatedCostUSD +=
      (tokenCount / 1000) * (this.info.costPer1K ?? 0);

    return {
      vectors: texts.map(() => new Array(this.info.dimensions).fill(0.5)),
      tokenCount,
    };
  }
}

// Error provider for testing error handling
class ErrorProvider extends BaseProvider {
  readonly info: EmbeddingModelInfo = {
    name: 'error-model',
    provider: 'error',
    dimensions: 128,
    maxTokens: 512,
    maxBatchSize: 10,
  };

  protected async doEmbed(): Promise<{
    vectors: number[][];
    tokenCount: number;
  }> {
    throw new Error('API error');
  }
}

// Retryable error provider
class RetryableErrorProvider extends BaseProvider {
  readonly info: EmbeddingModelInfo = {
    name: 'retry-model',
    provider: 'retry',
    dimensions: 128,
    maxTokens: 512,
    maxBatchSize: 10,
  };

  private callCount = 0;

  protected async doEmbed(): Promise<{
    vectors: number[][];
    tokenCount: number;
  }> {
    this.callCount++;
    if (this.callCount < 3) {
      throw new Error('Rate limit exceeded');
    }
    return {
      vectors: [[0.1, 0.2]],
      tokenCount: 1,
    };
  }
}

describe('BaseProvider', () => {
  let provider: TestProvider;

  beforeEach(() => {
    provider = new TestProvider({ type: 'test' });
  });

  describe('constructor', () => {
    it('should create provider with config', () => {
      expect(provider).toBeInstanceOf(BaseProvider);
    });

    it('should use default config values', () => {
      const config = provider['config'];
      expect(config.timeout).toBe(30000);
      expect(config.maxRetries).toBe(3);
      expect(config.retryDelay).toBe(1000);
    });

    it('should accept custom config', () => {
      const customProvider = new TestProvider({
        type: 'test',
        timeout: 60000,
        maxRetries: 5,
        retryDelay: 2000,
      });

      const config = customProvider['config'];
      expect(config.timeout).toBe(60000);
      expect(config.maxRetries).toBe(5);
      expect(config.retryDelay).toBe(2000);
    });

    it('should initialize metrics', () => {
      const metrics = provider.getMetrics();

      expect(metrics.provider).toBe('test');
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.totalTokens).toBe(0);
    });

    it('should initialize health', () => {
      const health = provider.getHealth();

      expect(health.healthy).toBe(true);
      expect(health.latencyMs).toBe(0);
      expect(health.lastCheck).toBeGreaterThan(0);
    });
  });

  describe('embed', () => {
    it('should embed single text', async () => {
      const result = await provider.embed('test text');

      expect(result.vector).toHaveLength(128);
      expect(result.text).toBe('test text');
      expect(result.tokenCount).toBeGreaterThan(0);
      expect(result.cached).toBe(false);
      expect(result.model).toBe('test-model');
      expect(result.dimensions).toBe(128);
    });

    it('should update metrics', async () => {
      await provider.embed('test');

      const metrics = provider.getMetrics();

      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(1);
      expect(metrics.totalTokens).toBeGreaterThan(0);
    });

    it('should track latency', async () => {
      await provider.embed('test');

      const metrics = provider.getMetrics();

      expect(metrics.avgLatencyMs).toBeGreaterThan(0);
      expect(metrics.p50LatencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('embedBatch', () => {
    it('should embed multiple texts', async () => {
      const texts = ['text1', 'text2', 'text3'];
      const result = await provider.embedBatch(texts);

      expect(result.results).toHaveLength(3);
      expect(result.totalTokens).toBeGreaterThan(0);
      expect(result.failures).toBe(0);
    });

    it('should batch large requests', async () => {
      const texts = Array(25).fill('test'); // More than maxBatchSize of 10
      const result = await provider.embedBatch(texts);

      expect(result.results).toHaveLength(25);
      expect(result.failures).toBe(0);
    });

    it('should respect concurrency', async () => {
      const texts = Array(20).fill('test');
      const result = await provider.embedBatch(texts, { concurrency: 2 });

      expect(result.results).toHaveLength(20);
    });

    it('should handle errors', async () => {
      const errorProvider = new ErrorProvider({ type: 'error' });

      await expect(errorProvider.embedBatch(['test'])).rejects.toThrow(
        'API error',
      );

      const metrics = errorProvider.getMetrics();
      expect(metrics.failedRequests).toBeGreaterThan(0);

      const health = errorProvider.getHealth();
      expect(health.healthy).toBe(false);
      expect(health.error).toBeDefined();
    });

    it('should continue on error when specified', async () => {
      const errorProvider = new ErrorProvider({ type: 'error' });

      const result = await errorProvider.embedBatch(['test1', 'test2'], {
        continueOnError: true,
      });

      expect(result.failures).toBeGreaterThan(0);
      expect(result.results).toHaveLength(0);
    });

    it('should update cost estimate', async () => {
      await provider.embedBatch(['test1', 'test2']);

      const metrics = provider.getMetrics();
      expect(metrics.estimatedCostUSD).toBeGreaterThan(0);
    });

    it('should track total latency', async () => {
      const result = await provider.embedBatch(['test1', 'test2']);

      expect(result.totalLatencyMs).toBeGreaterThan(0);
    });

    it('should report individual latencies', async () => {
      const result = await provider.embedBatch(['test1', 'test2']);

      result.results.forEach((res) => {
        expect(res.latencyMs).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('retry logic', () => {
    it('should retry on retryable errors', async () => {
      const retryProvider = new RetryableErrorProvider({
        type: 'retry',
        maxRetries: 3,
        retryDelay: 10,
      });

      // Should succeed after retries
      const result = await retryProvider.embed('test');

      expect(result).toBeDefined();
      expect(result.vector).toBeDefined();
    });

    it('should respect max retries', async () => {
      const errorProvider = new ErrorProvider({
        type: 'error',
        maxRetries: 2,
        retryDelay: 10,
      });

      await expect(errorProvider.embed('test')).rejects.toThrow('API error');
    });
  });

  describe('isRetryable', () => {
    it('should identify retryable errors', () => {
      expect(provider['isRetryable'](new Error('rate limit exceeded'))).toBe(
        true,
      );
      expect(provider['isRetryable'](new Error('timeout error'))).toBe(true);
      expect(provider['isRetryable'](new Error('network error'))).toBe(true);
      expect(provider['isRetryable'](new Error('502 Bad Gateway'))).toBe(true);
      expect(
        provider['isRetryable'](new Error('503 Service Unavailable')),
      ).toBe(true);
      expect(provider['isRetryable'](new Error('504 Gateway Timeout'))).toBe(
        true,
      );
    });

    it('should identify non-retryable errors', () => {
      expect(provider['isRetryable'](new Error('Invalid API key'))).toBe(false);
      expect(provider['isRetryable'](new Error('Bad request'))).toBe(false);
    });
  });

  describe('latency tracking', () => {
    it('should record latencies', async () => {
      await provider.embed('test1');
      await provider.embed('test2');
      await provider.embed('test3');

      const latencies = provider['latencies'];
      expect(latencies.length).toBe(3);
    });

    it('should limit latency samples', async () => {
      // Simulate many requests
      const maxSamples = provider['maxLatencySamples'];

      for (let i = 0; i < maxSamples + 100; i++) {
        provider['recordLatency'](10);
      }

      const latencies = provider['latencies'];
      expect(latencies.length).toBeLessThanOrEqual(maxSamples);
    });

    it('should calculate percentiles', async () => {
      provider['recordLatency'](10);
      provider['recordLatency'](20);
      provider['recordLatency'](30);
      provider['recordLatency'](40);
      provider['recordLatency'](50);

      const p50 = provider['calculatePercentile'](50);
      const p95 = provider['calculatePercentile'](95);

      expect(p50).toBeGreaterThan(0);
      expect(p95).toBeGreaterThan(0);
      expect(p95).toBeGreaterThanOrEqual(p50);
    });

    it('should handle empty latencies for percentile', () => {
      const p50 = provider['calculatePercentile'](50);
      expect(p50).toBe(0);
    });
  });

  describe('metrics tracking', () => {
    it('should track total requests', async () => {
      await provider.embedBatch(['test1', 'test2']);

      const metrics = provider.getMetrics();
      expect(metrics.totalRequests).toBeGreaterThan(0);
    });

    it('should track successful requests', async () => {
      await provider.embed('test');

      const metrics = provider.getMetrics();
      expect(metrics.successfulRequests).toBe(1);
    });

    it('should track failed requests', async () => {
      const errorProvider = new ErrorProvider({ type: 'error' });

      await expect(errorProvider.embed('test')).rejects.toThrow();

      const metrics = errorProvider.getMetrics();
      expect(metrics.failedRequests).toBe(1);
    });

    it('should calculate error rate', async () => {
      const errorProvider = new ErrorProvider({ type: 'error' });

      // Try embedding which will fail
      await errorProvider.embedBatch(['test'], { continueOnError: true });

      const metrics = errorProvider.getMetrics();
      expect(metrics.errorRate).toBe(1);
    });

    it('should track tokens', async () => {
      await provider.embedBatch(['test1', 'test2', 'test3']);

      const metrics = provider.getMetrics();
      expect(metrics.totalTokens).toBeGreaterThan(0);
    });

    it('should update latency metrics', async () => {
      await provider.embed('test1');
      await provider.embed('test2');

      const metrics = provider.getMetrics();

      expect(metrics.avgLatencyMs).toBeGreaterThan(0);
      expect(metrics.p50LatencyMs).toBeGreaterThanOrEqual(0);
      expect(metrics.p95LatencyMs).toBeGreaterThanOrEqual(0);
      expect(metrics.p99LatencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getMetrics', () => {
    it('should return metrics snapshot', async () => {
      await provider.embed('test');

      const metrics1 = provider.getMetrics();
      metrics1.totalRequests = 999;

      const metrics2 = provider.getMetrics();
      expect(metrics2.totalRequests).not.toBe(999);
    });
  });

  describe('getHealth', () => {
    it('should return health snapshot', () => {
      const health1 = provider.getHealth();
      health1.healthy = false;

      const health2 = provider.getHealth();
      expect(health2.healthy).toBe(true);
    });
  });

  describe('checkHealth', () => {
    it('should perform health check', async () => {
      const health = await provider.checkHealth();

      expect(health.healthy).toBe(true);
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
      expect(health.lastCheck).toBeGreaterThan(0);
    });

    it('should detect unhealthy state', async () => {
      const errorProvider = new ErrorProvider({ type: 'error' });

      const health = await errorProvider.checkHealth();

      expect(health.healthy).toBe(false);
      expect(health.error).toBeDefined();
      expect(health.lastCheck).toBeGreaterThan(0);
    });

    it('should update health timestamp', async () => {
      const before = provider.getHealth().lastCheck;

      await new Promise((resolve) => setTimeout(resolve, 10));
      await provider.checkHealth();

      const after = provider.getHealth().lastCheck;
      expect(after).toBeGreaterThan(before);
    });
  });

  describe('resetMetrics', () => {
    it('should reset all metrics', async () => {
      await provider.embed('test');
      provider.resetMetrics();

      const metrics = provider.getMetrics();

      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.totalTokens).toBe(0);
      expect(metrics.avgLatencyMs).toBe(0);
    });

    it('should clear latency samples', async () => {
      await provider.embed('test');
      provider.resetMetrics();

      const latencies = provider['latencies'];
      expect(latencies).toHaveLength(0);
    });
  });

  describe('countTokens', () => {
    it('should count tokens approximately', () => {
      const text = 'This is a test sentence';
      const tokens = provider.countTokens(text);

      expect(tokens).toBeGreaterThan(0);
    });

    it('should be consistent', () => {
      const text = 'test';
      const tokens1 = provider.countTokens(text);
      const tokens2 = provider.countTokens(text);

      expect(tokens1).toBe(tokens2);
    });
  });

  describe('exceedsMaxTokens', () => {
    it('should check token limits', () => {
      const shortText = 'short';
      const longText = 'a'.repeat(3000);

      expect(provider.exceedsMaxTokens(shortText)).toBe(false);
      expect(provider.exceedsMaxTokens(longText)).toBe(true);
    });
  });

  describe('truncateToMaxTokens', () => {
    it('should truncate long text', () => {
      const longText = 'a'.repeat(3000);
      const truncated = provider.truncateToMaxTokens(longText);

      expect(truncated.length).toBeLessThan(longText.length);
      expect(provider.countTokens(truncated)).toBeLessThanOrEqual(
        provider.maxTokens,
      );
    });

    it('should not truncate short text', () => {
      const shortText = 'short text';
      const truncated = provider.truncateToMaxTokens(shortText);

      expect(truncated).toBe(shortText);
    });
  });

  describe('model properties', () => {
    it('should have dimensions property', () => {
      expect(provider.dimensions).toBe(128);
    });

    it('should have maxTokens property', () => {
      expect(provider.maxTokens).toBe(512);
    });

    it('should have maxBatchSize property', () => {
      expect(provider.maxBatchSize).toBe(10);
    });

    it('should have name property', () => {
      expect(provider.name).toBe('test-model');
    });

    it('should have provider property', () => {
      expect(provider.provider).toBe('test');
    });
  });
});
