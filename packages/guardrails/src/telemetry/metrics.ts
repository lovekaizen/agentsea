/**
 * Metrics
 *
 * Prometheus metrics for guardrails.
 */

import type { GuardResult } from '../types';

/**
 * Metrics interface (compatible with prom-client)
 */
export interface Counter {
  inc(labels?: Record<string, string>, value?: number): void;
}

export interface Histogram {
  observe(labels?: Record<string, string>, value?: number): void;
  startTimer(labels?: Record<string, string>): () => number;
}

export interface Gauge {
  set(labels?: Record<string, string>, value?: number): void;
  inc(labels?: Record<string, string>, value?: number): void;
  dec(labels?: Record<string, string>, value?: number): void;
}

/**
 * Metrics configuration
 */
export interface MetricsConfig {
  /** Metric prefix */
  prefix?: string;
  /** Default labels */
  defaultLabels?: Record<string, string>;
  /** Enable metrics */
  enabled?: boolean;
}

/**
 * Guardrails Metrics
 *
 * Prometheus-compatible metrics for guardrails.
 *
 * @example
 * ```typescript
 * import { Counter, Histogram } from 'prom-client';
 *
 * const metrics = new GuardrailsMetrics({
 *   prefix: 'guardrails',
 *   defaultLabels: { service: 'my-app' },
 * });
 *
 * // Record a guard check
 * metrics.recordGuardCheck('toxicity', true, 0.8, 25);
 * ```
 */
export class GuardrailsMetrics {
  private prefix: string;
  private defaultLabels: Record<string, string>;
  private enabled: boolean;

  // Metrics storage (for non-prom-client usage)
  private counters = new Map<string, number>();
  private histogramValues = new Map<string, number[]>();

  constructor(config: MetricsConfig = {}) {
    this.prefix = config.prefix ?? 'guardrails';
    this.defaultLabels = config.defaultLabels ?? {};
    this.enabled = config.enabled ?? true;
  }

  /**
   * Record a guard check
   */
  recordGuardCheck(
    guardName: string,
    passed: boolean,
    confidence: number | undefined,
    latencyMs: number,
  ): void {
    if (!this.enabled) return;

    const labels = {
      ...this.defaultLabels,
      guard: guardName,
      result: passed ? 'pass' : 'fail',
    };

    // Increment check counter
    this.incrementCounter('checks_total', labels);

    // Record latency
    this.observeHistogram('check_latency_seconds', labels, latencyMs / 1000);

    // Record confidence if available
    if (confidence !== undefined) {
      this.observeHistogram('check_confidence', { ...labels }, confidence);
    }
  }

  /**
   * Record a blocked request
   */
  recordBlocked(guardName: string, reason: string): void {
    if (!this.enabled) return;

    const labels = {
      ...this.defaultLabels,
      guard: guardName,
      reason,
    };

    this.incrementCounter('blocked_total', labels);
  }

  /**
   * Record a transformation
   */
  recordTransformation(guardName: string): void {
    if (!this.enabled) return;

    const labels = {
      ...this.defaultLabels,
      guard: guardName,
    };

    this.incrementCounter('transformations_total', labels);
  }

  /**
   * Record pipeline execution
   */
  recordPipelineExecution(
    pipelineName: string,
    passed: boolean,
    guardCount: number,
    latencyMs: number,
  ): void {
    if (!this.enabled) return;

    const labels = {
      ...this.defaultLabels,
      pipeline: pipelineName,
      result: passed ? 'pass' : 'fail',
    };

    this.incrementCounter('pipeline_executions_total', labels);
    this.observeHistogram('pipeline_latency_seconds', labels, latencyMs / 1000);
    this.observeHistogram(
      'pipeline_guard_count',
      { ...this.defaultLabels, pipeline: pipelineName },
      guardCount,
    );
  }

  /**
   * Record from guard result
   */
  recordGuardResult(result: GuardResult): void {
    this.recordGuardCheck(
      result.guardName,
      result.passed,
      result.confidence,
      result.latencyMs,
    );

    if (!result.passed) {
      this.recordBlocked(result.guardName, result.action);
    }

    if (result.action === 'transform' && result.transformedContent) {
      this.recordTransformation(result.guardName);
    }
  }

  /**
   * Get all metric values (for testing/debugging)
   */
  getMetrics(): {
    counters: Record<string, number>;
    histograms: Record<string, number[]>;
  } {
    return {
      counters: Object.fromEntries(this.counters),
      histograms: Object.fromEntries(this.histogramValues),
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.counters.clear();
    this.histogramValues.clear();
  }

  /**
   * Increment a counter
   */
  private incrementCounter(
    name: string,
    labels: Record<string, string>,
    value = 1,
  ): void {
    const key = this.buildKey(name, labels);
    const current = this.counters.get(key) ?? 0;
    this.counters.set(key, current + value);
  }

  /**
   * Observe a histogram value
   */
  private observeHistogram(
    name: string,
    labels: Record<string, string>,
    value: number,
  ): void {
    const key = this.buildKey(name, labels);
    const values = this.histogramValues.get(key) ?? [];
    values.push(value);
    this.histogramValues.set(key, values);
  }

  /**
   * Build metric key from name and labels
   */
  private buildKey(name: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');

    return `${this.prefix}_${name}{${labelStr}}`;
  }
}

/**
 * Create metrics instance
 */
export function createMetrics(config?: MetricsConfig): GuardrailsMetrics {
  return new GuardrailsMetrics(config);
}

export default GuardrailsMetrics;
