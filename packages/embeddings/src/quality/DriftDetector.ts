/**
 * DriftDetector
 *
 * Detects drift in embedding distributions over time.
 */

import EventEmitter from 'eventemitter3';
import { EmbeddingModel } from '../core/EmbeddingModel.js';
import { mean, variance } from '../core/utils.js';
import type {
  EmbeddingVector,
  DriftDetectionResult,
  DistributionComparison,
  DimensionStats,
  ReferenceDistribution,
  DriftMonitorConfig,
  QualityAlert,
} from '../types/index.js';
import { nanoid } from 'nanoid';

/**
 * Drift detector events
 */
interface DriftDetectorEvents {
  'drift:detected': [result: DriftDetectionResult];
  'drift:alert': [alert: QualityAlert];
  'baseline:updated': [distribution: ReferenceDistribution];
}

/**
 * Drift detector for embedding distributions
 */
export class DriftDetector extends EventEmitter<DriftDetectorEvents> {
  private reference: ReferenceDistribution | null = null;
  private config: DriftMonitorConfig;
  private monitorInterval?: NodeJS.Timeout;
  private sampleBuffer: EmbeddingVector[] = [];

  constructor(config: DriftMonitorConfig = {}) {
    super();
    this.config = {
      checkInterval: config.checkInterval ?? 3600000, // 1 hour
      sampleSize: config.sampleSize ?? 1000,
      driftThreshold: config.driftThreshold ?? 0.1,
      alertSeverity: config.alertSeverity ?? 'medium',
      autoUpdateBaseline: config.autoUpdateBaseline ?? false,
      baselineUpdateInterval: config.baselineUpdateInterval ?? 86400000, // 24 hours
      ...config,
    };
  }

  /**
   * Set reference distribution from embeddings
   */
  setReference(
    embeddings: EmbeddingVector[],
    model: string,
    version?: string,
  ): ReferenceDistribution {
    if (embeddings.length === 0) {
      throw new Error('Cannot create reference from empty embeddings');
    }

    const dimensions = embeddings[0].length;

    // Calculate mean vector
    const meanVector = EmbeddingModel.average(embeddings);

    // Calculate variance per dimension
    const varianceVector: number[] = [];
    for (let d = 0; d < dimensions; d++) {
      const values = embeddings.map((e) => e[d]);
      varianceVector.push(variance(values));
    }

    this.reference = {
      id: nanoid(),
      model,
      version,
      sampleCount: embeddings.length,
      mean: meanVector,
      variance: varianceVector,
      createdAt: Date.now(),
    };

    this.emit('baseline:updated', this.reference);
    return this.reference;
  }

  /**
   * Get current reference distribution
   */
  getReference(): ReferenceDistribution | null {
    return this.reference;
  }

  /**
   * Detect drift from reference distribution
   */
  detect(currentEmbeddings: EmbeddingVector[]): DriftDetectionResult {
    if (!this.reference) {
      throw new Error('No reference distribution set');
    }

    if (currentEmbeddings.length === 0) {
      throw new Error('Cannot detect drift from empty embeddings');
    }

    const dimensions = this.reference.mean.length;

    // Calculate current distribution stats
    const currentMean = EmbeddingModel.average(currentEmbeddings);
    const currentVariance: number[] = [];
    for (let d = 0; d < dimensions; d++) {
      const values = currentEmbeddings.map((e) => e[d]);
      currentVariance.push(variance(values));
    }

    // Compare distributions
    const comparison = this.compareDistributions(
      this.reference.mean,
      this.reference.variance,
      currentMean,
      currentVariance,
    );

    // Calculate overall drift score
    const driftScore = this.calculateDriftScore(comparison);

    // Determine severity
    const severity = this.determineSeverity(driftScore);

    // Affected dimensions
    const affectedDimensions =
      comparison.dimensionStats?.filter((s) => s.significantChange).length ?? 0;

    const result: DriftDetectionResult = {
      driftDetected: driftScore >= (this.config.driftThreshold ?? 0.1),
      severity,
      driftScore,
      affectedDimensionsPercent: (affectedDimensions / dimensions) * 100,
      meanShift: comparison.meanCosineSimilarity,
      varianceChange: mean(
        currentVariance.map(
          (v, i) =>
            Math.abs(v - this.reference!.variance[i]) /
            (this.reference!.variance[i] || 1),
        ),
      ),
      distributionComparison: comparison,
      detectedAt: Date.now(),
      referenceTimestamp: this.reference.createdAt,
      currentTimestamp: Date.now(),
      recommendations: this.generateRecommendations(driftScore, severity),
    };

    if (result.driftDetected) {
      this.emit('drift:detected', result);

      if (this.shouldAlert(severity)) {
        this.emitAlert(result);
      }
    }

    return result;
  }

  /**
   * Compare two distributions
   */
  private compareDistributions(
    refMean: EmbeddingVector,
    refVariance: number[],
    curMean: EmbeddingVector,
    curVariance: number[],
  ): DistributionComparison {
    const dimensions = refMean.length;

    // Cosine similarity of means
    const meanCosineSimilarity = EmbeddingModel.cosineSimilarity(
      refMean,
      curMean,
    );

    // KL divergence approximation (assuming Gaussian)
    let klDivergence = 0;
    for (let d = 0; d < dimensions; d++) {
      const refVar = refVariance[d] || 0.0001;
      const curVar = curVariance[d] || 0.0001;
      const meanDiff = curMean[d] - refMean[d];

      klDivergence +=
        Math.log(Math.sqrt(curVar / refVar)) +
        (refVar + meanDiff * meanDiff) / (2 * curVar) -
        0.5;
    }
    klDivergence = Math.max(0, klDivergence / dimensions);

    // JS divergence (symmetrized KL)
    const jsDivergence = klDivergence / 2;

    // Wasserstein distance approximation
    let wassersteinDistance = 0;
    for (let d = 0; d < dimensions; d++) {
      const meanDiff = Math.abs(curMean[d] - refMean[d]);
      const stdDiff = Math.abs(
        Math.sqrt(curVariance[d]) - Math.sqrt(refVariance[d]),
      );
      wassersteinDistance += meanDiff + stdDiff;
    }
    wassersteinDistance /= dimensions;

    // Per-dimension stats
    const dimensionStats: DimensionStats[] = [];
    for (let d = 0; d < dimensions; d++) {
      const meanChange = curMean[d] - refMean[d];
      const varChange = curVariance[d] - refVariance[d];
      const refStd = Math.sqrt(refVariance[d] || 0.0001);

      dimensionStats.push({
        dimension: d,
        referenceMean: refMean[d],
        currentMean: curMean[d],
        meanChange,
        referenceVariance: refVariance[d],
        currentVariance: curVariance[d],
        varianceChange: varChange,
        significantChange: Math.abs(meanChange) > 2 * refStd,
      });
    }

    return {
      klDivergence,
      jsDivergence,
      wassersteinDistance,
      meanCosineSimilarity,
      dimensionStats,
    };
  }

  /**
   * Calculate overall drift score
   */
  private calculateDriftScore(comparison: DistributionComparison): number {
    // Combine multiple metrics
    const cosineDistance = 1 - comparison.meanCosineSimilarity;
    const klScore = Math.min(1, comparison.klDivergence / 10);
    const wasserstein = Math.min(1, comparison.wassersteinDistance);

    // Weighted average
    return cosineDistance * 0.4 + klScore * 0.3 + wasserstein * 0.3;
  }

  /**
   * Determine severity based on drift score
   */
  private determineSeverity(
    driftScore: number,
  ): 'none' | 'low' | 'medium' | 'high' | 'critical' {
    if (driftScore < 0.05) return 'none';
    if (driftScore < 0.1) return 'low';
    if (driftScore < 0.2) return 'medium';
    if (driftScore < 0.4) return 'high';
    return 'critical';
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    driftScore: number,
    severity: string,
  ): string[] {
    const recommendations: string[] = [];

    if (severity === 'none' || severity === 'low') {
      recommendations.push('Continue monitoring');
    }

    if (severity === 'medium') {
      recommendations.push('Consider updating the baseline distribution');
      recommendations.push('Review recent changes to input data');
    }

    if (severity === 'high') {
      recommendations.push('Re-embed affected documents');
      recommendations.push('Update baseline distribution immediately');
      recommendations.push('Investigate root cause of drift');
    }

    if (severity === 'critical') {
      recommendations.push('URGENT: Stop accepting new embeddings');
      recommendations.push('Full re-embedding required');
      recommendations.push('Review embedding model for issues');
    }

    return recommendations;
  }

  /**
   * Check if should alert
   */
  private shouldAlert(severity: string): boolean {
    const severityOrder = ['none', 'low', 'medium', 'high', 'critical'];
    const alertLevel = this.config.alertSeverity ?? 'medium';
    return severityOrder.indexOf(severity) >= severityOrder.indexOf(alertLevel);
  }

  /**
   * Emit quality alert
   */
  private emitAlert(result: DriftDetectionResult): void {
    const alert: QualityAlert = {
      id: nanoid(),
      type: 'drift_detected',
      severity: result.severity as 'low' | 'medium' | 'high' | 'critical',
      message: `Embedding drift detected with score ${result.driftScore.toFixed(3)}`,
      currentValue: result.driftScore,
      thresholdValue: this.config.driftThreshold,
      createdAt: Date.now(),
      acknowledged: false,
    };

    this.emit('drift:alert', alert);
    this.config.onAlert?.(result);
  }

  /**
   * Add sample to buffer for monitoring
   */
  addSample(embedding: EmbeddingVector): void {
    this.sampleBuffer.push(embedding);

    if (this.sampleBuffer.length >= (this.config.sampleSize ?? 1000)) {
      if (this.reference) {
        this.detect(this.sampleBuffer);
      }
      this.sampleBuffer = [];
    }
  }

  /**
   * Start continuous monitoring
   */
  startMonitoring(): void {
    if (this.monitorInterval) return;

    this.monitorInterval = setInterval(() => {
      if (this.reference && this.sampleBuffer.length >= 100) {
        this.detect(this.sampleBuffer);
        this.sampleBuffer = [];
      }
    }, this.config.checkInterval);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = undefined;
    }
  }
}

/**
 * Create a drift detector
 */
export function createDriftDetector(
  config?: DriftMonitorConfig,
): DriftDetector {
  return new DriftDetector(config);
}
