/**
 * BaseMetric
 *
 * Abstract base class for evaluation metrics.
 */

import type {
  MetricResult,
  MetricInterface,
  EvaluationInput,
  BaseMetricConfig,
  ScoreRange,
} from '../../types/index.js';

/**
 * Abstract base class for metrics
 */
export abstract class BaseMetric implements MetricInterface {
  abstract readonly type: string;
  readonly name: string;
  protected threshold: number;
  protected weight: number;
  protected scoreRange: ScoreRange;

  constructor(config: BaseMetricConfig = {}) {
    this.name = config.name ?? '';
    this.threshold = config.threshold ?? 0.5;
    this.weight = config.weight ?? 1;
    this.scoreRange = config.scoreRange ?? { min: 0, max: 1 };
  }

  /**
   * Initialize name from type (called by subclasses after super())
   */
  protected initName(config: BaseMetricConfig): void {
    if (!this.name && config.name) {
      (this as { name: string }).name = config.name;
    } else if (!this.name) {
      (this as { name: string }).name = this.type;
    }
  }

  /**
   * Evaluate input and return metric result
   */
  abstract evaluate(input: EvaluationInput): Promise<MetricResult>;

  /**
   * Check if score passes threshold
   */
  passes(score: number): boolean {
    return score >= this.threshold;
  }

  /**
   * Normalize score to 0-1 range
   */
  protected normalizeScore(score: number): number {
    const { min, max } = this.scoreRange;
    if (max === min) return score >= max ? 1 : 0;
    return Math.max(0, Math.min(1, (score - min) / (max - min)));
  }

  /**
   * Create a metric result
   */
  protected createResult(
    score: number,
    explanation?: string,
    details?: Record<string, unknown>,
  ): MetricResult {
    return {
      metric: this.type,
      score,
      explanation,
      details,
    };
  }
}
