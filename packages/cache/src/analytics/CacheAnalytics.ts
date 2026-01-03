/**
 * CacheAnalytics
 *
 * Analytics and metrics tracking for cache operations.
 */

import type {
  CacheEntry,
  AnalyticsData,
  CostSavingsReport,
  PerformanceMetrics,
  HitEvent,
  MissEvent,
  ModelPricing,
  AnalyticsConfig,
} from '../types/index.js';
import { percentile, mean } from '../core/utils.js';

/**
 * Default model pricing (per 1K tokens)
 */
const DEFAULT_MODEL_PRICING: Record<string, ModelPricing> = {
  'gpt-4o': { inputPer1K: 0.0025, outputPer1K: 0.01 },
  'gpt-4o-mini': { inputPer1K: 0.00015, outputPer1K: 0.0006 },
  'gpt-4-turbo': { inputPer1K: 0.01, outputPer1K: 0.03 },
  'gpt-4': { inputPer1K: 0.03, outputPer1K: 0.06 },
  'gpt-3.5-turbo': { inputPer1K: 0.0005, outputPer1K: 0.0015 },
  'claude-3-opus': { inputPer1K: 0.015, outputPer1K: 0.075 },
  'claude-sonnet-4-20250514': { inputPer1K: 0.003, outputPer1K: 0.015 },
  'claude-3-5-sonnet': { inputPer1K: 0.003, outputPer1K: 0.015 },
  'claude-3-haiku': { inputPer1K: 0.00025, outputPer1K: 0.00125 },
  default: { inputPer1K: 0.005, outputPer1K: 0.015 },
};

/**
 * Default analytics configuration
 */
const DEFAULT_CONFIG: Required<AnalyticsConfig> = {
  enabled: true,
  sampleRate: 1.0,
  retentionSeconds: 86400 * 7, // 7 days
  flushIntervalMs: 60000, // 1 minute
  modelPricing: DEFAULT_MODEL_PRICING,
};

/**
 * CacheAnalytics
 *
 * Tracks cache performance metrics, hit rates, and cost savings.
 *
 * @example
 * ```typescript
 * const analytics = new CacheAnalytics({ enabled: true });
 *
 * // Record events
 * analytics.recordHit(entry, 'exact', 5.2);
 * analytics.recordMiss(12.3);
 *
 * // Get summary
 * const summary = analytics.getSummary();
 * console.log(`Hit rate: ${(summary.hitRate * 100).toFixed(1)}%`);
 * ```
 */
export class CacheAnalytics {
  private config: Required<AnalyticsConfig>;
  private hits = 0;
  private misses = 0;
  private exactHits = 0;
  private semanticHits = 0;
  private tokensSaved = 0;
  private inputTokensSaved = 0;
  private outputTokensSaved = 0;
  private latencies: number[] = [];
  private modelHits = new Map<string, number>();
  private namespaceHits = new Map<string, number>();
  private hitEvents: HitEvent[] = [];
  private missEvents: MissEvent[] = [];
  private setCount = 0;

  constructor(config?: Partial<AnalyticsConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Record a cache hit
   */
  recordHit(
    entry: CacheEntry,
    type: 'exact' | 'semantic',
    latencyMs: number,
  ): void {
    if (!this.config.enabled) return;
    if (Math.random() > this.config.sampleRate) return;

    this.hits++;
    if (type === 'exact') {
      this.exactHits++;
    } else {
      this.semanticHits++;
    }

    this.latencies.push(latencyMs);

    // Track tokens saved
    const usage = entry.response.usage;
    this.tokensSaved += usage.totalTokens;
    this.inputTokensSaved += usage.promptTokens;
    this.outputTokensSaved += usage.completionTokens;

    // Track by model
    const modelCount = this.modelHits.get(entry.request.model) ?? 0;
    this.modelHits.set(entry.request.model, modelCount + 1);

    // Track by namespace
    if (entry.metadata.namespace) {
      const nsCount = this.namespaceHits.get(entry.metadata.namespace) ?? 0;
      this.namespaceHits.set(entry.metadata.namespace, nsCount + 1);
    }

    // Record event
    this.hitEvents.push({
      timestamp: Date.now(),
      type,
      model: entry.request.model,
      namespace: entry.metadata.namespace,
      similarity: entry.metadata.similarity,
      latencyMs,
      tokensSaved: usage.totalTokens,
    });

    // Trim old events
    this.trimEvents();
  }

  /**
   * Record a cache miss
   */
  recordMiss(
    latencyMs: number,
    reason: MissEvent['reason'] = 'not_found',
  ): void {
    if (!this.config.enabled) return;
    if (Math.random() > this.config.sampleRate) return;

    this.misses++;
    this.latencies.push(latencyMs);

    // Record event
    this.missEvents.push({
      timestamp: Date.now(),
      model: 'unknown',
      latencyMs,
      reason,
    });

    // Trim old events
    this.trimEvents();
  }

  /**
   * Record a cache set operation
   */
  recordSet(_entry: CacheEntry): void {
    if (!this.config.enabled) return;
    this.setCount++;
  }

  /**
   * Get analytics summary
   */
  getSummary(): AnalyticsData {
    const total = this.hits + this.misses;

    return {
      totalHits: this.hits,
      totalMisses: this.misses,
      exactHits: this.exactHits,
      semanticHits: this.semanticHits,
      hitRate: total > 0 ? this.hits / total : 0,
      avgLatencyMs: mean(this.latencies),
      p50LatencyMs: percentile(this.latencies, 50),
      p95LatencyMs: percentile(this.latencies, 95),
      p99LatencyMs: percentile(this.latencies, 99),
      totalTokensSaved: this.tokensSaved,
      estimatedCostSavingsUSD: this.calculateCostSavings(),
      topModels: this.getTopModels(5),
      topNamespaces: this.getTopNamespaces(5),
      hourlyStats: this.getHourlyStats(),
    };
  }

  /**
   * Get cost savings report
   */
  getCostSavingsReport(periodLabel = 'all-time'): CostSavingsReport {
    const total = this.hits + this.misses;
    const costSaved = this.calculateCostSavings();

    // Estimate what cost would have been without cache
    const avgCostPerRequest = costSaved / (this.hits || 1);
    const estimatedCostWithoutCache = avgCostPerRequest * total;

    return {
      period: periodLabel,
      totalRequests: total,
      cachedRequests: this.hits,
      hitRate: total > 0 ? this.hits / total : 0,
      inputTokensSaved: this.inputTokensSaved,
      outputTokensSaved: this.outputTokensSaved,
      totalTokensSaved: this.tokensSaved,
      estimatedCostWithoutCache,
      actualCostWithCache: estimatedCostWithoutCache - costSaved,
      costSaved,
      reductionPercent:
        estimatedCostWithoutCache > 0
          ? (costSaved / estimatedCostWithoutCache) * 100
          : 0,
    };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    const total = this.hits + this.misses;

    return {
      avgLookupMs: mean(this.latencies),
      avgEmbeddingMs: 0, // Would need to track separately
      avgStoreReadMs: mean(this.latencies),
      avgStoreWriteMs: 0, // Would need to track separately
      p50LatencyMs: percentile(this.latencies, 50),
      p95LatencyMs: percentile(this.latencies, 95),
      p99LatencyMs: percentile(this.latencies, 99),
      totalOperations: total + this.setCount,
      failedOperations: 0, // Would need to track separately
      errorRate: 0,
    };
  }

  /**
   * Reset all analytics
   */
  reset(): void {
    this.hits = 0;
    this.misses = 0;
    this.exactHits = 0;
    this.semanticHits = 0;
    this.tokensSaved = 0;
    this.inputTokensSaved = 0;
    this.outputTokensSaved = 0;
    this.latencies = [];
    this.modelHits.clear();
    this.namespaceHits.clear();
    this.hitEvents = [];
    this.missEvents = [];
    this.setCount = 0;
  }

  /**
   * Export analytics data
   */
  export(format: 'json' | 'csv' = 'json'): string {
    const data = this.getSummary();

    if (format === 'csv') {
      const headers = Object.keys(data).filter(
        (k) => typeof data[k as keyof AnalyticsData] !== 'object',
      );
      const values = headers.map((h) => data[h as keyof AnalyticsData]);
      return `${headers.join(',')}\n${values.join(',')}`;
    }

    return JSON.stringify(data, null, 2);
  }

  private calculateCostSavings(): number {
    let savings = 0;

    for (const [model, hits] of this.modelHits) {
      const pricing =
        this.config.modelPricing[model] ?? this.config.modelPricing['default'];

      // Estimate average tokens per request based on total
      const avgInputTokens = this.inputTokensSaved / (this.hits || 1);
      const avgOutputTokens = this.outputTokensSaved / (this.hits || 1);

      const inputCost = (avgInputTokens / 1000) * pricing.inputPer1K * hits;
      const outputCost = (avgOutputTokens / 1000) * pricing.outputPer1K * hits;

      savings += inputCost + outputCost;
    }

    // If no model-specific data, use default pricing
    if (savings === 0 && this.tokensSaved > 0) {
      const defaultPricing = this.config.modelPricing['default'];
      savings =
        (this.inputTokensSaved / 1000) * defaultPricing.inputPer1K +
        (this.outputTokensSaved / 1000) * defaultPricing.outputPer1K;
    }

    return savings;
  }

  private getTopModels(n: number): Array<{ model: string; hits: number }> {
    return Array.from(this.modelHits.entries())
      .map(([model, hits]) => ({ model, hits }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, n);
  }

  private getTopNamespaces(
    n: number,
  ): Array<{ namespace: string; hits: number }> {
    return Array.from(this.namespaceHits.entries())
      .map(([namespace, hits]) => ({ namespace, hits }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, n);
  }

  private getHourlyStats(): Array<{
    hour: number;
    hits: number;
    misses: number;
    avgLatencyMs: number;
  }> {
    const hourlyData = new Map<
      number,
      { hits: number; misses: number; latencies: number[] }
    >();

    // Process hit events
    for (const event of this.hitEvents) {
      const hour = new Date(event.timestamp).getHours();
      const data = hourlyData.get(hour) ?? {
        hits: 0,
        misses: 0,
        latencies: [],
      };
      data.hits++;
      data.latencies.push(event.latencyMs);
      hourlyData.set(hour, data);
    }

    // Process miss events
    for (const event of this.missEvents) {
      const hour = new Date(event.timestamp).getHours();
      const data = hourlyData.get(hour) ?? {
        hits: 0,
        misses: 0,
        latencies: [],
      };
      data.misses++;
      data.latencies.push(event.latencyMs);
      hourlyData.set(hour, data);
    }

    return Array.from(hourlyData.entries())
      .map(([hour, data]) => ({
        hour,
        hits: data.hits,
        misses: data.misses,
        avgLatencyMs: mean(data.latencies),
      }))
      .sort((a, b) => a.hour - b.hour);
  }

  private trimEvents(): void {
    const cutoff = Date.now() - this.config.retentionSeconds * 1000;
    this.hitEvents = this.hitEvents.filter((e) => e.timestamp > cutoff);
    this.missEvents = this.missEvents.filter((e) => e.timestamp > cutoff);
  }
}

/**
 * Create a CacheAnalytics instance
 */
export function createCacheAnalytics(
  config?: Partial<AnalyticsConfig>,
): CacheAnalytics {
  return new CacheAnalytics(config);
}
