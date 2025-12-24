/**
 * ABTestRunner
 *
 * A/B testing framework for model comparison.
 */

import { EventEmitter } from 'eventemitter3';
import { nanoid } from 'nanoid';
import type {
  ABTestConfig,
  ABTestStatus,
  ABTestResults,
  ABMetricResult,
  MetricSummary,
  SampleAssignment,
} from '../types/index.js';

interface ABTestEvents {
  'test:started': () => void;
  'test:completed': (results: ABTestResults) => void;
  'test:significant': (metric: string, winner: 'control' | 'treatment') => void;
  'sample:assigned': (assignment: SampleAssignment) => void;
}

/**
 * A/B test runner
 */
export class ABTestRunner extends EventEmitter<ABTestEvents> {
  readonly id: string;
  readonly name: string;
  private config: ABTestConfig;
  private status: ABTestStatus = 'draft';
  private startedAt?: number;
  private completedAt?: number;
  private controlSamples: Map<string, Record<string, number>> = new Map();
  private treatmentSamples: Map<string, Record<string, number>> = new Map();
  private sampleCount = 0;

  constructor(config: ABTestConfig) {
    super();
    this.id = nanoid();
    this.name = config.name;
    this.config = config;
  }

  /**
   * Start the A/B test
   */
  start(): Promise<void> {
    if (this.status !== 'draft') {
      throw new Error(`Cannot start test in ${this.status} status`);
    }

    this.status = 'running';
    this.startedAt = Date.now();
    this.emit('test:started');
    return Promise.resolve();
  }

  /**
   * Stop the A/B test
   */
  stop(): ABTestResults {
    this.status = 'completed';
    this.completedAt = Date.now();

    const results = this.getResults();
    this.emit('test:completed', results);

    return results;
  }

  /**
   * Pause the test
   */
  pause(): void {
    if (this.status === 'running') {
      this.status = 'paused';
    }
  }

  /**
   * Resume the test
   */
  resume(): void {
    if (this.status === 'paused') {
      this.status = 'running';
    }
  }

  /**
   * Assign a sample to a variant
   */
  assignVariant(): 'control' | 'treatment' {
    if (this.status !== 'running') {
      throw new Error('Test is not running');
    }

    // Random assignment based on traffic split
    const isControl = Math.random() >= this.config.trafficSplit;
    const variant = isControl ? 'control' : 'treatment';

    const assignment: SampleAssignment = {
      variant,
      testId: this.id,
      assignedAt: Date.now(),
    };

    this.emit('sample:assigned', assignment);

    return variant;
  }

  /**
   * Record sample result
   */
  recordSample(
    variant: 'control' | 'treatment',
    sampleId: string,
    scores: Record<string, number>,
  ): void {
    if (this.status !== 'running') {
      throw new Error('Test is not running');
    }

    const samples =
      variant === 'control' ? this.controlSamples : this.treatmentSamples;
    samples.set(sampleId, scores);
    this.sampleCount++;

    // Check for significance
    if (this.sampleCount >= this.config.minSamples) {
      this.checkSignificance();
    }

    // Check for max duration
    if (
      this.config.maxDuration &&
      this.startedAt &&
      Date.now() - this.startedAt > this.config.maxDuration
    ) {
      this.stop();
    }
  }

  /**
   * Get current results
   */
  getResults(): ABTestResults {
    const metrics: Record<string, ABMetricResult> = {};

    for (const metric of this.config.metrics) {
      metrics[metric] = this.calculateMetricResult(metric);
    }

    // Determine overall winner
    let controlWins = 0;
    let treatmentWins = 0;

    for (const result of Object.values(metrics)) {
      if (result.isSignificant) {
        if (result.winner === 'control') controlWins++;
        else if (result.winner === 'treatment') treatmentWins++;
      }
    }

    let winner: 'control' | 'treatment' | 'none' = 'none';
    if (controlWins > treatmentWins) winner = 'control';
    else if (treatmentWins > controlWins) winner = 'treatment';

    const isSignificant = Object.values(metrics).some((m) => m.isSignificant);
    const confidence = isSignificant
      ? Math.max(...Object.values(metrics).map((m) => 1 - m.pValue))
      : 0;

    return {
      controlSamples: this.controlSamples.size,
      treatmentSamples: this.treatmentSamples.size,
      metrics,
      winner,
      isSignificant,
      confidence,
      recommendation: this.generateRecommendation(
        winner,
        isSignificant,
        metrics,
      ),
    };
  }

  /**
   * Calculate result for a single metric
   */
  private calculateMetricResult(metric: string): ABMetricResult {
    const controlScores = this.getScoresForMetric(this.controlSamples, metric);
    const treatmentScores = this.getScoresForMetric(
      this.treatmentSamples,
      metric,
    );

    const controlSummary = this.calculateSummary(controlScores);
    const treatmentSummary = this.calculateSummary(treatmentScores);

    const difference = treatmentSummary.mean - controlSummary.mean;
    const differencePercent =
      controlSummary.mean !== 0 ? (difference / controlSummary.mean) * 100 : 0;

    // Simple t-test approximation
    const pValue = this.calculatePValue(controlScores, treatmentScores);
    const isSignificant = pValue < (this.config.significanceLevel ?? 0.05);

    let winner: 'control' | 'treatment' | 'none' = 'none';
    if (isSignificant) {
      winner = difference > 0 ? 'treatment' : 'control';
    }

    return {
      control: controlSummary,
      treatment: treatmentSummary,
      difference,
      differencePercent,
      pValue,
      isSignificant,
      winner,
    };
  }

  /**
   * Get scores for a metric from samples
   */
  private getScoresForMetric(
    samples: Map<string, Record<string, number>>,
    metric: string,
  ): number[] {
    const scores: number[] = [];
    for (const sampleScores of samples.values()) {
      if (metric in sampleScores) {
        scores.push(sampleScores[metric]);
      }
    }
    return scores;
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(scores: number[]): MetricSummary {
    if (scores.length === 0) {
      return {
        mean: 0,
        std: 0,
        sampleCount: 0,
        confidenceInterval: [0, 0],
      };
    }

    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance =
      scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
    const std = Math.sqrt(variance);

    // 95% confidence interval
    const se = std / Math.sqrt(scores.length);
    const margin = 1.96 * se;

    return {
      mean,
      std,
      sampleCount: scores.length,
      confidenceInterval: [mean - margin, mean + margin],
    };
  }

  /**
   * Calculate p-value using Welch's t-test approximation
   */
  private calculatePValue(control: number[], treatment: number[]): number {
    if (control.length < 2 || treatment.length < 2) return 1;

    const n1 = control.length;
    const n2 = treatment.length;
    const mean1 = control.reduce((a, b) => a + b, 0) / n1;
    const mean2 = treatment.reduce((a, b) => a + b, 0) / n2;

    const var1 =
      control.reduce((sum, x) => sum + Math.pow(x - mean1, 2), 0) / (n1 - 1);
    const var2 =
      treatment.reduce((sum, x) => sum + Math.pow(x - mean2, 2), 0) / (n2 - 1);

    const se = Math.sqrt(var1 / n1 + var2 / n2);
    if (se === 0) return 1;

    const t = Math.abs(mean1 - mean2) / se;

    // Approximate p-value using normal distribution for large samples
    // This is a simplification - real implementation would use t-distribution
    const pValue = 2 * (1 - this.normalCDF(t));

    return Math.max(0, Math.min(1, pValue));
  }

  /**
   * Normal CDF approximation
   */
  private normalCDF(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * x);
    const y =
      1.0 -
      ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
  }

  /**
   * Check for statistical significance
   */
  private checkSignificance(): void {
    for (const metric of this.config.metrics) {
      const result = this.calculateMetricResult(metric);
      if (result.isSignificant && result.winner !== 'none') {
        this.emit('test:significant', metric, result.winner);
      }
    }
  }

  /**
   * Generate recommendation
   */
  private generateRecommendation(
    winner: 'control' | 'treatment' | 'none',
    isSignificant: boolean,
    metrics: Record<string, ABMetricResult>,
  ): string {
    if (!isSignificant) {
      const totalSamples =
        this.controlSamples.size + this.treatmentSamples.size;
      if (totalSamples < this.config.minSamples) {
        return `Not enough samples yet. Need ${this.config.minSamples - totalSamples} more.`;
      }
      return 'No significant difference detected. Consider running longer or adjusting variants.';
    }

    if (winner === 'treatment') {
      const improvements = Object.entries(metrics)
        .filter(([, r]) => r.winner === 'treatment')
        .map(([m, r]) => `${m}: +${r.differencePercent.toFixed(1)}%`);
      return `Treatment variant wins. Improvements: ${improvements.join(', ')}`;
    }

    if (winner === 'control') {
      return 'Control variant performs better. Consider keeping current configuration.';
    }

    return 'Mixed results. Review individual metrics for details.';
  }

  /**
   * Get test status
   */
  getStatus(): ABTestStatus {
    return this.status;
  }

  /**
   * Get test configuration
   */
  getConfig(): ABTestConfig {
    return { ...this.config };
  }

  /**
   * Get test timestamps
   */
  getTimestamps(): { startedAt?: number; completedAt?: number } {
    return {
      startedAt: this.startedAt,
      completedAt: this.completedAt,
    };
  }
}

/**
 * Create an A/B test runner
 */
export function createABTestRunner(config: ABTestConfig): ABTestRunner {
  return new ABTestRunner(config);
}
