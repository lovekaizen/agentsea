/**
 * A/B Test Framework
 *
 * Run experiments on prompts with statistical analysis.
 */

import murmurhash from 'murmurhash';
import type {
  ABTestConfig,
  ABTestData,
  ABTestStatus,
  TestVariant,
  VariantAssignment,
  MetricRecord,
  VariantStats,
  ABTestResults,
  MetricComparison,
  GetVariantOptions,
  StorageAdapter,
} from '../types/index.js';
import { generateId } from '../utils/hashing.js';

/**
 * A/B Test class - manages a single experiment
 */
export class ABTest {
  readonly id: string;
  readonly name: string;
  readonly prompt: string;
  readonly variants: TestVariant[];
  readonly metrics: string[];
  readonly targetSampleSize: number;
  readonly confidenceLevel: number;

  private storage: StorageAdapter;
  private status: ABTestStatus;
  private startedAt?: Date;
  private endedAt?: Date;

  constructor(data: ABTestData, storage: StorageAdapter) {
    this.id = data.id;
    this.name = data.name;
    this.prompt = data.prompt;
    this.variants = data.variants;
    this.metrics = data.metrics;
    this.targetSampleSize = data.targetSampleSize || 1000;
    this.confidenceLevel = data.confidenceLevel || 0.95;
    this.status = data.status;
    this.startedAt = data.startedAt;
    this.endedAt = data.endedAt;
    this.storage = storage;
  }

  /**
   * Start the test
   */
  async start(): Promise<void> {
    if (this.status !== 'draft') {
      throw new Error(`Cannot start test in ${this.status} status`);
    }

    this.status = 'running';
    this.startedAt = new Date();
    await this.storage.updateTestStatus(this.id, 'running');
  }

  /**
   * Pause the test
   */
  async pause(): Promise<void> {
    if (this.status !== 'running') {
      throw new Error(`Cannot pause test in ${this.status} status`);
    }

    this.status = 'paused';
    await this.storage.updateTestStatus(this.id, 'paused');
  }

  /**
   * Resume the test
   */
  async resume(): Promise<void> {
    if (this.status !== 'paused') {
      throw new Error(`Cannot resume test in ${this.status} status`);
    }

    this.status = 'running';
    await this.storage.updateTestStatus(this.id, 'running');
  }

  /**
   * End the test
   */
  async end(): Promise<void> {
    if (this.status !== 'running' && this.status !== 'paused') {
      throw new Error(`Cannot end test in ${this.status} status`);
    }

    this.status = 'completed';
    this.endedAt = new Date();
    await this.storage.updateTestStatus(this.id, 'completed');
  }

  /**
   * Cancel the test
   */
  async cancel(): Promise<void> {
    if (this.status === 'completed' || this.status === 'cancelled') {
      throw new Error(`Cannot cancel test in ${this.status} status`);
    }

    this.status = 'cancelled';
    this.endedAt = new Date();
    await this.storage.updateTestStatus(this.id, 'cancelled');
  }

  /**
   * Get variant assignment for a user
   */
  async getVariant(options: GetVariantOptions): Promise<TestVariant> {
    // Check for existing assignment
    const existing = await this.storage.getVariantAssignment(
      this.id,
      options.userId,
    );

    if (existing) {
      const variant = this.variants.find((v) => v.name === existing.variant);
      if (variant) return variant;
    }

    // Deterministic assignment based on user ID
    const hash = murmurhash.v3(`${this.id}:${options.userId}`);
    const normalized = (hash >>> 0) / 0xffffffff; // Normalize to 0-1

    let cumulative = 0;
    for (const variant of this.variants) {
      cumulative += variant.weight;
      if (normalized < cumulative) {
        // Save assignment
        const assignment: VariantAssignment = {
          testId: this.id,
          userId: options.userId,
          variant: variant.name,
          version: variant.version,
          assignedAt: new Date(),
        };
        await this.storage.saveVariantAssignment(assignment);

        return variant;
      }
    }

    // Fallback to first variant
    return this.variants[0];
  }

  /**
   * Record a metric value
   */
  async recordMetric(
    variant: string,
    metric: string,
    value: number,
    options: { userId?: string; metadata?: Record<string, unknown> } = {},
  ): Promise<void> {
    if (this.status !== 'running') {
      throw new Error('Test is not running');
    }

    if (!this.metrics.includes(metric)) {
      throw new Error(`Unknown metric: ${metric}`);
    }

    const record: MetricRecord = {
      testId: this.id,
      variant,
      metric,
      value,
      userId: options.userId,
      timestamp: new Date(),
      metadata: options.metadata,
    };

    await this.storage.saveMetricRecord(record);
  }

  /**
   * Get test results
   */
  async getResults(): Promise<ABTestResults> {
    const records = await this.storage.getMetricRecords(this.id);

    // Calculate stats for each variant
    const variants: Record<string, VariantStats> = {};
    let totalSamples = 0;

    for (const variant of this.variants) {
      const variantRecords = records.filter((r) => r.variant === variant.name);
      const sampleSize = new Set(variantRecords.map((r) => r.userId)).size;
      totalSamples += sampleSize;

      const metricStats: VariantStats['metrics'] = {};

      for (const metric of this.metrics) {
        const metricRecords = variantRecords.filter((r) => r.metric === metric);
        const values = metricRecords.map((r) => r.value);

        if (values.length > 0) {
          const mean = values.reduce((a, b) => a + b, 0) / values.length;
          const sortedValues = [...values].sort((a, b) => a - b);
          const median = sortedValues[Math.floor(sortedValues.length / 2)];
          const variance =
            values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
            values.length;
          const stdDev = Math.sqrt(variance);

          metricStats[metric] = {
            mean,
            stdDev,
            min: Math.min(...values),
            max: Math.max(...values),
            median,
            count: values.length,
          };
        }
      }

      variants[variant.name] = {
        name: variant.name,
        sampleSize,
        metrics: metricStats,
      };
    }

    // Calculate comparisons
    const comparisons = this.calculateComparisons(variants);

    // Determine significance and winner
    const isSignificant = comparisons.some((c) => c.isSignificant);
    let winner: string | undefined;
    let pValue: number | undefined;

    if (isSignificant && this.variants.length === 2) {
      const mainComparison = comparisons[0];
      pValue = mainComparison?.pValue;

      if (mainComparison?.relativeDifference > 0) {
        winner = mainComparison.treatment.variant;
      } else if (mainComparison?.relativeDifference < 0) {
        winner = mainComparison.control.variant;
      }
    }

    return {
      testId: this.id,
      testName: this.name,
      status: this.status,
      totalSamples,
      variants,
      comparisons,
      isSignificant,
      winner,
      pValue,
      recommendation: this.generateRecommendation(
        isSignificant,
        winner,
        totalSamples,
      ),
    };
  }

  /**
   * Calculate statistical comparisons between variants
   */
  private calculateComparisons(
    variants: Record<string, VariantStats>,
  ): MetricComparison[] {
    const comparisons: MetricComparison[] = [];

    if (this.variants.length < 2) return comparisons;

    const controlVariant = this.variants[0];
    const control = variants[controlVariant.name];

    for (let i = 1; i < this.variants.length; i++) {
      const treatmentVariant = this.variants[i];
      const treatment = variants[treatmentVariant.name];

      for (const metric of this.metrics) {
        const controlStats = control.metrics[metric];
        const treatmentStats = treatment.metrics[metric];

        if (!controlStats || !treatmentStats) continue;

        // Calculate t-test
        const { pValue, confidenceInterval } = this.tTest(
          controlStats.mean,
          controlStats.stdDev,
          controlStats.count,
          treatmentStats.mean,
          treatmentStats.stdDev,
          treatmentStats.count,
        );

        const absoluteDifference = treatmentStats.mean - controlStats.mean;
        const relativeDifference =
          controlStats.mean !== 0
            ? (absoluteDifference / controlStats.mean) * 100
            : 0;

        comparisons.push({
          metric,
          control: {
            variant: controlVariant.name,
            mean: controlStats.mean,
            stdDev: controlStats.stdDev,
          },
          treatment: {
            variant: treatmentVariant.name,
            mean: treatmentStats.mean,
            stdDev: treatmentStats.stdDev,
          },
          absoluteDifference,
          relativeDifference,
          pValue,
          isSignificant: pValue < 1 - this.confidenceLevel,
          confidenceInterval,
        });
      }
    }

    return comparisons;
  }

  /**
   * Perform a two-sample t-test
   */
  private tTest(
    mean1: number,
    std1: number,
    n1: number,
    mean2: number,
    std2: number,
    n2: number,
  ): { pValue: number; confidenceInterval: [number, number] } {
    // Welch's t-test
    const se = Math.sqrt((std1 * std1) / n1 + (std2 * std2) / n2);
    const t = (mean1 - mean2) / (se || 1);

    // Approximate p-value using normal distribution for large samples
    // Note: For more accurate results with small samples, use t-distribution with
    // Welch-Satterthwaite degrees of freedom
    const pValue = 2 * (1 - this.normalCDF(Math.abs(t)));

    // Confidence interval
    const zScore = this.inverseCDF((1 + this.confidenceLevel) / 2);
    const margin = zScore * se;
    const diff = mean2 - mean1;
    const confidenceInterval: [number, number] = [diff - margin, diff + margin];

    return { pValue, confidenceInterval };
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
   * Inverse normal CDF approximation
   */
  private inverseCDF(p: number): number {
    // Rational approximation for lower region
    const a = [
      -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
      1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
    ];
    const b = [
      -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
      6.680131188771972e1, -1.328068155288572e1,
    ];
    const c = [
      -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
      -2.549732539343734, 4.374664141464968, 2.938163982698783,
    ];
    const d = [
      7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
      3.754408661907416,
    ];

    const pLow = 0.02425;
    const pHigh = 1 - pLow;

    let q: number, r: number;

    if (p < pLow) {
      q = Math.sqrt(-2 * Math.log(p));
      return (
        (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
      );
    } else if (p <= pHigh) {
      q = p - 0.5;
      r = q * q;
      return (
        ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
          q) /
        (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
      );
    } else {
      q = Math.sqrt(-2 * Math.log(1 - p));
      return (
        -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
      );
    }
  }

  /**
   * Generate a recommendation based on results
   */
  private generateRecommendation(
    isSignificant: boolean,
    winner: string | undefined,
    totalSamples: number,
  ): string {
    if (totalSamples < this.targetSampleSize * 0.1) {
      return 'Insufficient data. Continue collecting samples.';
    }

    if (totalSamples < this.targetSampleSize) {
      const percentage = Math.round(
        (totalSamples / this.targetSampleSize) * 100,
      );
      return `${percentage}% of target sample size reached. Continue test for more reliable results.`;
    }

    if (!isSignificant) {
      return 'No statistically significant difference detected between variants.';
    }

    if (winner) {
      return `Variant '${winner}' is the statistically significant winner. Consider promoting to production.`;
    }

    return 'Results are inconclusive. Consider extending the test or reviewing metrics.';
  }

  /**
   * Get test status
   */
  getStatus(): ABTestStatus {
    return this.status;
  }

  /**
   * Check if test is complete
   */
  isComplete(): boolean {
    return this.status === 'completed' || this.status === 'cancelled';
  }

  /**
   * Convert to data object
   */
  toData(): ABTestData {
    return {
      id: this.id,
      name: this.name,
      prompt: this.prompt,
      variants: this.variants,
      metrics: this.metrics,
      targetSampleSize: this.targetSampleSize,
      confidenceLevel: this.confidenceLevel,
      status: this.status,
      createdAt: new Date(),
      startedAt: this.startedAt,
      endedAt: this.endedAt,
    };
  }
}

/**
 * Create an A/B test configuration
 */
export function createABTestConfig(
  config: Omit<ABTestConfig, 'id'>,
): ABTestData {
  // Validate weights sum to 1
  const totalWeight = config.variants.reduce((sum, v) => sum + v.weight, 0);
  if (Math.abs(totalWeight - 1) > 0.001) {
    throw new Error(`Variant weights must sum to 1 (got ${totalWeight})`);
  }

  return {
    ...config,
    id: generateId(),
    status: 'draft',
    createdAt: new Date(),
  };
}
