import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsCollector } from '../telemetry/Metrics.js';

describe('MetricsCollector', () => {
  let metrics: MetricsCollector;

  beforeEach(() => {
    metrics = new MetricsCollector();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      expect(metrics).toBeInstanceOf(MetricsCollector);
    });

    it('should accept custom prefix', () => {
      const custom = new MetricsCollector({ prefix: 'custom_prefix' });
      const prometheus = custom.toPrometheusFormat();
      expect(prometheus).toContain('custom_prefix_');
    });

    it('should accept custom histogram buckets', () => {
      const custom = new MetricsCollector({
        histogramBuckets: {
          latency: [10, 50, 100],
          tokens: [100, 500],
        },
      });

      custom.recordHistogram('test_latency', 75);
      const histogram = custom.getHistogram('test_latency');

      expect(histogram?.buckets.has(10)).toBe(true);
      expect(histogram?.buckets.has(50)).toBe(true);
      expect(histogram?.buckets.has(100)).toBe(true);
    });

    it('should expose token buckets', () => {
      const buckets = metrics.getTokenBuckets();
      expect(Array.isArray(buckets)).toBe(true);
      expect(buckets.length).toBeGreaterThan(0);
    });
  });

  describe('counters', () => {
    it('should increment counter', () => {
      metrics.incrementCounter('test_counter');
      expect(metrics.getCounter('test_counter')).toBe(1);
    });

    it('should increment by custom value', () => {
      metrics.incrementCounter('test_counter', 5);
      expect(metrics.getCounter('test_counter')).toBe(5);
    });

    it('should accumulate increments', () => {
      metrics.incrementCounter('test_counter', 2);
      metrics.incrementCounter('test_counter', 3);
      expect(metrics.getCounter('test_counter')).toBe(5);
    });

    it('should handle labels', () => {
      metrics.incrementCounter('requests', 1, { provider: 'openai' });
      metrics.incrementCounter('requests', 1, { provider: 'anthropic' });

      expect(metrics.getCounter('requests', { provider: 'openai' })).toBe(1);
      expect(metrics.getCounter('requests', { provider: 'anthropic' })).toBe(1);
    });

    it('should return 0 for non-existent counter', () => {
      expect(metrics.getCounter('non_existent')).toBe(0);
    });
  });

  describe('gauges', () => {
    it('should set gauge value', () => {
      metrics.setGauge('temperature', 42);
      expect(metrics.getGauge('temperature')).toBe(42);
    });

    it('should overwrite previous value', () => {
      metrics.setGauge('temperature', 42);
      metrics.setGauge('temperature', 100);
      expect(metrics.getGauge('temperature')).toBe(100);
    });

    it('should handle labels', () => {
      metrics.setGauge('queue_size', 10, { queue: 'high_priority' });
      metrics.setGauge('queue_size', 5, { queue: 'low_priority' });

      expect(metrics.getGauge('queue_size', { queue: 'high_priority' })).toBe(
        10,
      );
      expect(metrics.getGauge('queue_size', { queue: 'low_priority' })).toBe(5);
    });

    it('should return 0 for non-existent gauge', () => {
      expect(metrics.getGauge('non_existent')).toBe(0);
    });
  });

  describe('histograms', () => {
    it('should record histogram observation', () => {
      metrics.recordHistogram('latency', 150);
      const histogram = metrics.getHistogram('latency');

      expect(histogram).toBeDefined();
      expect(histogram?.count).toBe(1);
      expect(histogram?.sum).toBe(150);
    });

    it('should update bucket counts correctly', () => {
      metrics.recordHistogram('latency', 75);
      const histogram = metrics.getHistogram('latency');

      // Should increment all buckets >= 75
      const bucket100 = histogram?.buckets.get(100);
      const bucket50 = histogram?.buckets.get(50);

      expect(bucket100).toBe(1);
      expect(bucket50).toBe(0); // 75 > 50
    });

    it('should track multiple observations', () => {
      metrics.recordHistogram('latency', 50);
      metrics.recordHistogram('latency', 150);
      metrics.recordHistogram('latency', 300);

      const histogram = metrics.getHistogram('latency');

      expect(histogram?.count).toBe(3);
      expect(histogram?.sum).toBe(500);
    });

    it('should handle custom buckets', () => {
      metrics.recordHistogram('custom', 75, undefined, [10, 50, 100, 500]);
      const histogram = metrics.getHistogram('custom');

      expect(histogram?.buckets.has(10)).toBe(true);
      expect(histogram?.buckets.has(50)).toBe(true);
      expect(histogram?.buckets.has(100)).toBe(true);
      expect(histogram?.buckets.has(500)).toBe(true);
    });

    it('should handle labels', () => {
      metrics.recordHistogram('latency', 100, { provider: 'openai' });
      metrics.recordHistogram('latency', 200, { provider: 'anthropic' });

      const openaiHist = metrics.getHistogram('latency', {
        provider: 'openai',
      });
      const anthropicHist = metrics.getHistogram('latency', {
        provider: 'anthropic',
      });

      expect(openaiHist?.sum).toBe(100);
      expect(anthropicHist?.sum).toBe(200);
    });

    it('should return undefined for non-existent histogram', () => {
      expect(metrics.getHistogram('non_existent')).toBeUndefined();
    });

    it('should include infinity bucket', () => {
      metrics.recordHistogram('latency', 99999);
      const histogram = metrics.getHistogram('latency');

      expect(histogram?.buckets.has(Infinity)).toBe(true);
      expect(histogram?.buckets.get(Infinity)).toBe(1);
    });
  });

  describe('recordRequest', () => {
    it('should record comprehensive request metrics', () => {
      metrics.recordRequest({
        provider: 'openai',
        model: 'gpt-4o',
        status: 'success',
        latencyMs: 150,
        inputTokens: 100,
        outputTokens: 50,
        cost: 0.001,
        cached: false,
      });

      // Check request counter
      expect(
        metrics.getCounter('requests_total', {
          provider: 'openai',
          model: 'gpt-4o',
          status: 'success',
          cached: 'false',
        }),
      ).toBe(1);

      // Check latency histogram
      const latencyHist = metrics.getHistogram('request_latency_ms', {
        provider: 'openai',
        model: 'gpt-4o',
      });
      expect(latencyHist?.sum).toBe(150);

      // Check token counters
      expect(
        metrics.getCounter('tokens_input_total', {
          provider: 'openai',
          model: 'gpt-4o',
        }),
      ).toBe(100);
      expect(
        metrics.getCounter('tokens_output_total', {
          provider: 'openai',
          model: 'gpt-4o',
        }),
      ).toBe(50);

      // Check cost counter (in microdollars)
      expect(
        metrics.getCounter('cost_microdollars_total', {
          provider: 'openai',
          model: 'gpt-4o',
        }),
      ).toBe(1000);
    });

    it('should track cache hits', () => {
      metrics.recordRequest({
        provider: 'openai',
        model: 'gpt-4o',
        status: 'success',
        latencyMs: 10,
        inputTokens: 100,
        outputTokens: 50,
        cost: 0.001,
        cached: true,
      });

      expect(metrics.getCounter('cache_hits_total')).toBe(1);
    });

    it('should not increment cache hits for uncached requests', () => {
      metrics.recordRequest({
        provider: 'openai',
        model: 'gpt-4o',
        status: 'success',
        latencyMs: 150,
        inputTokens: 100,
        outputTokens: 50,
        cost: 0.001,
        cached: false,
      });

      expect(metrics.getCounter('cache_hits_total')).toBe(0);
    });

    it('should track errors', () => {
      metrics.recordRequest({
        provider: 'openai',
        model: 'gpt-4o',
        status: 'error',
        latencyMs: 5000,
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        cached: false,
      });

      expect(
        metrics.getCounter('requests_total', {
          provider: 'openai',
          model: 'gpt-4o',
          status: 'error',
          cached: 'false',
        }),
      ).toBe(1);
    });
  });

  describe('getSummary', () => {
    it('should return empty summary initially', () => {
      const summary = metrics.getSummary();

      expect(summary.requests.total).toBe(0);
      expect(summary.requests.successful).toBe(0);
      expect(summary.requests.failed).toBe(0);
      expect(summary.tokens.total).toBe(0);
      expect(summary.cost.total).toBe(0);
    });

    it('should calculate request summary', () => {
      metrics.recordRequest({
        provider: 'openai',
        model: 'gpt-4o',
        status: 'success',
        latencyMs: 150,
        inputTokens: 100,
        outputTokens: 50,
        cost: 0.001,
        cached: false,
      });

      metrics.recordRequest({
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        status: 'error',
        latencyMs: 5000,
        inputTokens: 50,
        outputTokens: 0,
        cost: 0,
        cached: false,
      });

      const summary = metrics.getSummary();

      expect(summary.requests.total).toBe(2);
      expect(summary.requests.successful).toBe(1);
      expect(summary.requests.failed).toBe(1);
    });

    it('should calculate token summary', () => {
      metrics.recordRequest({
        provider: 'openai',
        model: 'gpt-4o',
        status: 'success',
        latencyMs: 150,
        inputTokens: 100,
        outputTokens: 50,
        cost: 0.001,
        cached: false,
      });

      const summary = metrics.getSummary();

      expect(summary.tokens.input).toBe(100);
      expect(summary.tokens.output).toBe(50);
      expect(summary.tokens.total).toBe(150);
    });

    it('should calculate cost summary', () => {
      metrics.recordRequest({
        provider: 'openai',
        model: 'gpt-4o',
        status: 'success',
        latencyMs: 150,
        inputTokens: 100,
        outputTokens: 50,
        cost: 0.001,
        cached: false,
      });

      const summary = metrics.getSummary();

      expect(summary.cost.total).toBe(0.001);
    });

    it('should calculate cost by provider', () => {
      metrics.recordRequest({
        provider: 'openai',
        model: 'gpt-4o',
        status: 'success',
        latencyMs: 150,
        inputTokens: 100,
        outputTokens: 50,
        cost: 0.001,
        cached: false,
      });

      metrics.recordRequest({
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        status: 'success',
        latencyMs: 200,
        inputTokens: 100,
        outputTokens: 50,
        cost: 0.002,
        cached: false,
      });

      const summary = metrics.getSummary();

      expect(summary.cost.byProvider['openai']).toBe(0.001);
      expect(summary.cost.byProvider['anthropic']).toBe(0.002);
    });

    it('should calculate cost by model', () => {
      metrics.recordRequest({
        provider: 'openai',
        model: 'gpt-4o',
        status: 'success',
        latencyMs: 150,
        inputTokens: 100,
        outputTokens: 50,
        cost: 0.001,
        cached: false,
      });

      const summary = metrics.getSummary();

      expect(summary.cost.byModel['gpt-4o']).toBe(0.001);
    });

    it('should calculate cache metrics', () => {
      metrics.recordRequest({
        provider: 'openai',
        model: 'gpt-4o',
        status: 'success',
        latencyMs: 10,
        inputTokens: 100,
        outputTokens: 50,
        cost: 0,
        cached: true,
      });

      metrics.recordRequest({
        provider: 'openai',
        model: 'gpt-4o',
        status: 'success',
        latencyMs: 150,
        inputTokens: 100,
        outputTokens: 50,
        cost: 0.001,
        cached: false,
      });

      const summary = metrics.getSummary();

      expect(summary.cache.hits).toBe(1);
      expect(summary.cache.misses).toBe(1);
      expect(summary.cache.hitRate).toBe(0.5);
    });

    it('should calculate latency percentiles', () => {
      for (let i = 0; i < 100; i++) {
        metrics.recordRequest({
          provider: 'openai',
          model: 'gpt-4o',
          status: 'success',
          latencyMs: i,
          inputTokens: 10,
          outputTokens: 5,
          cost: 0.0001,
          cached: false,
        });
      }

      const summary = metrics.getSummary();

      expect(summary.latency.avg).toBeGreaterThan(0);
      expect(summary.latency.p50).toBeGreaterThan(0);
      expect(summary.latency.p95).toBeGreaterThan(0);
      expect(summary.latency.p99).toBeGreaterThan(0);

      // Percentiles should be ordered
      expect(summary.latency.p99).toBeGreaterThanOrEqual(summary.latency.p95);
      expect(summary.latency.p95).toBeGreaterThanOrEqual(summary.latency.p50);
    });
  });

  describe('toPrometheusFormat', () => {
    it('should export counters in Prometheus format', () => {
      metrics.incrementCounter('test_counter', 42);
      const output = metrics.toPrometheusFormat();

      expect(output).toContain('agentsea_gateway_test_counter 42');
    });

    it('should export gauges in Prometheus format', () => {
      metrics.setGauge('test_gauge', 100);
      const output = metrics.toPrometheusFormat();

      expect(output).toContain('agentsea_gateway_test_gauge 100');
    });

    it('should export histograms in Prometheus format', () => {
      metrics.recordHistogram('test_histogram', 75);
      const output = metrics.toPrometheusFormat();

      expect(output).toContain('test_histogram_bucket');
      expect(output).toContain('test_histogram_sum');
      expect(output).toContain('test_histogram_count');
      expect(output).toContain('le="+Inf"');
    });

    it('should format labels correctly', () => {
      metrics.incrementCounter('requests', 1, {
        provider: 'openai',
        status: 'success',
      });
      const output = metrics.toPrometheusFormat();

      expect(output).toContain('provider="openai"');
      expect(output).toContain('status="success"');
    });

    it('should sort labels alphabetically', () => {
      metrics.incrementCounter('test', 1, { z: 'last', a: 'first' });
      const output = metrics.toPrometheusFormat();

      const aIndex = output.indexOf('a="first"');
      const zIndex = output.indexOf('z="last"');

      expect(aIndex).toBeLessThan(zIndex);
    });
  });

  describe('reset', () => {
    it('should clear all metrics', () => {
      metrics.incrementCounter('test_counter', 42);
      metrics.setGauge('test_gauge', 100);
      metrics.recordHistogram('test_histogram', 75);

      metrics.reset();

      expect(metrics.getCounter('test_counter')).toBe(0);
      expect(metrics.getGauge('test_gauge')).toBe(0);
      expect(metrics.getHistogram('test_histogram')).toBeUndefined();
    });

    it('should allow new metrics after reset', () => {
      metrics.incrementCounter('test', 1);
      metrics.reset();
      metrics.incrementCounter('test', 5);

      expect(metrics.getCounter('test')).toBe(5);
    });
  });

  describe('label handling', () => {
    it('should handle empty labels', () => {
      metrics.incrementCounter('test', 1, {});
      expect(metrics.getCounter('test', {})).toBe(1);
      expect(metrics.getCounter('test')).toBe(1); // Should be same as no labels
    });

    it('should distinguish between different label combinations', () => {
      metrics.incrementCounter('requests', 1, { provider: 'openai' });
      metrics.incrementCounter('requests', 2, {
        provider: 'openai',
        model: 'gpt-4o',
      });

      expect(metrics.getCounter('requests', { provider: 'openai' })).toBe(1);
      expect(
        metrics.getCounter('requests', {
          provider: 'openai',
          model: 'gpt-4o',
        }),
      ).toBe(2);
    });

    it('should handle label order consistently', () => {
      metrics.incrementCounter('test', 1, { a: '1', b: '2' });
      metrics.incrementCounter('test', 2, { b: '2', a: '1' });

      // Different order should map to same metric
      expect(metrics.getCounter('test', { a: '1', b: '2' })).toBe(3);
      expect(metrics.getCounter('test', { b: '2', a: '1' })).toBe(3);
    });
  });

  describe('edge cases', () => {
    it('should handle zero values', () => {
      metrics.incrementCounter('test', 0);
      metrics.setGauge('test', 0);
      metrics.recordHistogram('test', 0);

      expect(metrics.getCounter('test')).toBe(0);
      expect(metrics.getGauge('test')).toBe(0);

      const histogram = metrics.getHistogram('test');
      expect(histogram?.sum).toBe(0);
    });

    it('should handle negative values in gauges', () => {
      metrics.setGauge('test', -42);
      expect(metrics.getGauge('test')).toBe(-42);
    });

    it('should handle very large values', () => {
      metrics.incrementCounter('test', Number.MAX_SAFE_INTEGER);
      expect(metrics.getCounter('test')).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should handle special characters in label values', () => {
      metrics.incrementCounter('test', 1, {
        key: 'value"with"quotes',
      });

      expect(metrics.getCounter('test', { key: 'value"with"quotes' })).toBe(1);
    });
  });
});
