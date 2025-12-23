/**
 * Metrics collection and reporting
 */

import type { GatewayMetrics } from '../core/types.js';

export interface MetricsConfig {
  prefix?: string;
  labels?: string[];
  histogramBuckets?: {
    latency?: number[];
    tokens?: number[];
  };
}

export interface HistogramData {
  count: number;
  sum: number;
  buckets: Map<number, number>;
}

/**
 * Simple in-memory metrics collector
 */
export class MetricsCollector {
  private readonly prefix: string;
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, HistogramData> = new Map();
  private readonly latencyBuckets: number[];
  private readonly tokenBuckets: number[];

  constructor(config: MetricsConfig = {}) {
    this.prefix = config.prefix || 'agentsea_gateway';
    this.latencyBuckets = config.histogramBuckets?.latency || [
      50, 100, 250, 500, 1000, 2500, 5000, 10000,
    ];
    this.tokenBuckets = config.histogramBuckets?.tokens || [
      100, 500, 1000, 2000, 5000, 10000, 50000,
    ];
  }

  /**
   * Get token histogram buckets
   */
  getTokenBuckets(): number[] {
    return [...this.tokenBuckets];
  }

  /**
   * Increment a counter
   */
  incrementCounter(
    name: string,
    value: number = 1,
    labels?: Record<string, string>,
  ): void {
    const key = this.formatKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
  }

  /**
   * Set a gauge value
   */
  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.formatKey(name, labels);
    this.gauges.set(key, value);
  }

  /**
   * Record a histogram observation
   */
  recordHistogram(
    name: string,
    value: number,
    labels?: Record<string, string>,
    buckets?: number[],
  ): void {
    const key = this.formatKey(name, labels);
    let histogram = this.histograms.get(key);

    if (!histogram) {
      histogram = {
        count: 0,
        sum: 0,
        buckets: new Map(),
      };
      // Initialize buckets
      const bucketsToUse = buckets || this.latencyBuckets;
      for (const bucket of bucketsToUse) {
        histogram.buckets.set(bucket, 0);
      }
      histogram.buckets.set(Infinity, 0);
      this.histograms.set(key, histogram);
    }

    histogram.count++;
    histogram.sum += value;

    // Update bucket counts
    for (const [bucket, count] of histogram.buckets) {
      if (value <= bucket) {
        histogram.buckets.set(bucket, count + 1);
      }
    }
  }

  /**
   * Record request metrics
   */
  recordRequest(data: {
    provider: string;
    model: string;
    status: 'success' | 'error';
    latencyMs: number;
    inputTokens: number;
    outputTokens: number;
    cost: number;
    cached: boolean;
  }): void {
    const labels = { provider: data.provider, model: data.model };

    // Request count
    this.incrementCounter('requests_total', 1, {
      ...labels,
      status: data.status,
      cached: String(data.cached),
    });

    // Latency histogram
    this.recordHistogram('request_latency_ms', data.latencyMs, labels);

    // Token counters
    this.incrementCounter('tokens_input_total', data.inputTokens, labels);
    this.incrementCounter('tokens_output_total', data.outputTokens, labels);

    // Cost counter (in microdollars for precision)
    this.incrementCounter(
      'cost_microdollars_total',
      Math.round(data.cost * 1_000_000),
      labels,
    );

    // Cache metrics
    if (data.cached) {
      this.incrementCounter('cache_hits_total', 1);
    }
  }

  /**
   * Get counter value
   */
  getCounter(name: string, labels?: Record<string, string>): number {
    const key = this.formatKey(name, labels);
    return this.counters.get(key) || 0;
  }

  /**
   * Get gauge value
   */
  getGauge(name: string, labels?: Record<string, string>): number {
    const key = this.formatKey(name, labels);
    return this.gauges.get(key) || 0;
  }

  /**
   * Get histogram data
   */
  getHistogram(
    name: string,
    labels?: Record<string, string>,
  ): HistogramData | undefined {
    const key = this.formatKey(name, labels);
    return this.histograms.get(key);
  }

  /**
   * Get all metrics as a summary object
   */
  getSummary(): GatewayMetrics {
    const requestsTotal = this.sumAllCounters('requests_total');
    const requestsSuccess = this.sumCountersByLabel(
      'requests_total',
      'status',
      'success',
    );
    const requestsError = this.sumCountersByLabel(
      'requests_total',
      'status',
      'error',
    );
    const requestsCached = this.sumCountersByLabel(
      'requests_total',
      'cached',
      'true',
    );

    const latencyHistogram = this.aggregateHistograms('request_latency_ms');
    const avgLatency =
      latencyHistogram.count > 0
        ? latencyHistogram.sum / latencyHistogram.count
        : 0;

    const inputTokens = this.sumAllCounters('tokens_input_total');
    const outputTokens = this.sumAllCounters('tokens_output_total');

    const totalCostMicro = this.sumAllCounters('cost_microdollars_total');

    const cacheHits = this.getCounter('cache_hits_total');
    const cacheMisses = requestsTotal - cacheHits;

    return {
      requests: {
        total: requestsTotal,
        successful: requestsSuccess,
        failed: requestsError,
        cached: requestsCached,
      },
      latency: {
        avg: avgLatency,
        p50: this.calculatePercentile('request_latency_ms', 0.5),
        p95: this.calculatePercentile('request_latency_ms', 0.95),
        p99: this.calculatePercentile('request_latency_ms', 0.99),
      },
      tokens: {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens,
      },
      cost: {
        total: totalCostMicro / 1_000_000,
        byProvider: this.getCostByLabel('provider'),
        byModel: this.getCostByLabel('model'),
      },
      cache: {
        hits: cacheHits,
        misses: cacheMisses,
        hitRate: requestsTotal > 0 ? cacheHits / requestsTotal : 0,
      },
      providers: {},
    };
  }

  /**
   * Export metrics in Prometheus format
   */
  toPrometheusFormat(): string {
    const lines: string[] = [];

    // Counters
    for (const [key, value] of this.counters) {
      lines.push(`${this.prefix}_${key} ${value}`);
    }

    // Gauges
    for (const [key, value] of this.gauges) {
      lines.push(`${this.prefix}_${key} ${value}`);
    }

    // Histograms
    for (const [key, histogram] of this.histograms) {
      for (const [bucket, count] of histogram.buckets) {
        const le = bucket === Infinity ? '+Inf' : bucket;
        lines.push(`${this.prefix}_${key}_bucket{le="${le}"} ${count}`);
      }
      lines.push(`${this.prefix}_${key}_sum ${histogram.sum}`);
      lines.push(`${this.prefix}_${key}_count ${histogram.count}`);
    }

    return lines.join('\n');
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }

  /**
   * Format metric key with labels
   */
  private formatKey(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return name;
    }
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return `${name}{${labelStr}}`;
  }

  /**
   * Sum counters by a specific label value
   */
  private sumCountersByLabel(
    name: string,
    labelKey: string,
    labelValue: string,
  ): number {
    let sum = 0;
    for (const [key, value] of this.counters) {
      if (key.startsWith(name) && key.includes(`${labelKey}="${labelValue}"`)) {
        sum += value;
      }
    }
    return sum;
  }

  /**
   * Sum all counters with a given name prefix
   */
  private sumAllCounters(namePrefix: string): number {
    let sum = 0;
    for (const [key, value] of this.counters) {
      if (key.startsWith(namePrefix)) {
        sum += value;
      }
    }
    return sum;
  }

  /**
   * Get cost breakdown by label
   */
  private getCostByLabel(labelKey: string): Record<string, number> {
    const result: Record<string, number> = {};
    const prefix = 'cost_microdollars_total';

    for (const [key, value] of this.counters) {
      if (key.startsWith(prefix)) {
        const match = key.match(new RegExp(`${labelKey}="([^"]+)"`));
        if (match) {
          const labelValue = match[1];
          result[labelValue] = (result[labelValue] || 0) + value / 1_000_000;
        }
      }
    }

    return result;
  }

  /**
   * Aggregate histograms for a metric name
   */
  private aggregateHistograms(name: string): HistogramData {
    const result: HistogramData = {
      count: 0,
      sum: 0,
      buckets: new Map(),
    };

    for (const [key, histogram] of this.histograms) {
      if (key.startsWith(name)) {
        result.count += histogram.count;
        result.sum += histogram.sum;
        for (const [bucket, count] of histogram.buckets) {
          const existing = result.buckets.get(bucket) || 0;
          result.buckets.set(bucket, existing + count);
        }
      }
    }

    return result;
  }

  /**
   * Calculate percentile from histogram (approximate)
   */
  private calculatePercentile(name: string, percentile: number): number {
    const histogram = this.aggregateHistograms(name);

    if (histogram.count === 0) return 0;

    // Sort by bucket boundary
    const sortedBuckets = Array.from(histogram.buckets.entries()).sort(
      ([a], [b]) => a - b,
    );

    const targetCount = histogram.count * percentile;
    let prevBucket = 0;
    let prevCount = 0;

    for (const [bucket, count] of sortedBuckets) {
      if (count >= targetCount) {
        // Found the bucket containing our percentile
        // Linear interpolation within this bucket
        const bucketRange = bucket - prevBucket;
        const bucketCount = count - prevCount; // Values in this bucket

        if (bucketCount === 0) {
          return prevBucket;
        }

        const positionInBucket = targetCount - prevCount;
        const fraction = positionInBucket / bucketCount;
        return prevBucket + bucketRange * Math.max(0, Math.min(1, fraction));
      }
      prevBucket = bucket;
      prevCount = count;
    }

    return prevBucket;
  }
}
