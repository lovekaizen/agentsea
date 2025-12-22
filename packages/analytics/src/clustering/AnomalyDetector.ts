/**
 * Anomaly Detector
 *
 * Detects anomalies in conversation metrics.
 */

import { EventEmitter } from 'eventemitter3';
import { nanoid } from 'nanoid';
import type {
  Anomaly,
  AnomalyDetectionOptions,
  AnomalyDetectionResult,
  AnalyticsStorageAdapter,
} from '../types/index.js';

/**
 * Anomaly detector events
 */
export interface AnomalyDetectorEvents {
  'detection:complete': (result: AnomalyDetectionResult) => void;
  'anomaly:found': (anomaly: Anomaly) => void;
  error: (error: Error) => void;
}

/**
 * Default detection options
 */
const DEFAULT_OPTIONS: AnomalyDetectionOptions = {
  sensitivity: 'medium',
  minScore: 0.5,
  types: [
    'volume_spike',
    'volume_drop',
    'sentiment_shift',
    'success_rate_change',
    'latency_increase',
  ],
};

/**
 * Time bucket for aggregation
 */
interface TimeBucket {
  timestamp: number;
  count: number;
  sentiment: number;
  successRate: number;
  avgDuration: number;
  values: number[];
}

/**
 * AnomalyDetector - Detects anomalies in metrics
 */
export class AnomalyDetector extends EventEmitter<AnomalyDetectorEvents> {
  private readonly storage: AnalyticsStorageAdapter;

  constructor(storage: AnalyticsStorageAdapter) {
    super();
    this.storage = storage;
  }

  /**
   * Detect anomalies
   */
  async detect(
    options: AnomalyDetectionOptions = {},
  ): Promise<AnomalyDetectionResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Get time buckets for analysis
    const buckets = await this.getTimeBuckets(opts);

    if (buckets.length < 3) {
      return {
        anomalies: [],
        totalPoints: buckets.length,
      };
    }

    // Calculate baseline statistics
    const baseline = this.calculateBaseline(buckets);

    // Detect anomalies
    const anomalies: Anomaly[] = [];
    const sensitivity = this.getSensitivityMultiplier(
      opts.sensitivity ?? 'medium',
    );

    for (let i = 0; i < buckets.length; i++) {
      const bucket = buckets[i];

      // Volume anomalies
      if (
        opts.types?.includes('volume_spike') ||
        opts.types?.includes('volume_drop')
      ) {
        const volumeAnomaly = this.detectVolumeAnomaly(
          bucket,
          baseline,
          sensitivity,
        );
        if (volumeAnomaly && volumeAnomaly.score >= (opts.minScore ?? 0.5)) {
          anomalies.push(volumeAnomaly);
        }
      }

      // Sentiment anomalies
      if (opts.types?.includes('sentiment_shift')) {
        const sentimentAnomaly = this.detectSentimentAnomaly(
          bucket,
          baseline,
          sensitivity,
        );
        if (
          sentimentAnomaly &&
          sentimentAnomaly.score >= (opts.minScore ?? 0.5)
        ) {
          anomalies.push(sentimentAnomaly);
        }
      }

      // Success rate anomalies
      if (opts.types?.includes('success_rate_change')) {
        const successAnomaly = this.detectSuccessRateAnomaly(
          bucket,
          baseline,
          sensitivity,
        );
        if (successAnomaly && successAnomaly.score >= (opts.minScore ?? 0.5)) {
          anomalies.push(successAnomaly);
        }
      }

      // Latency anomalies
      if (opts.types?.includes('latency_increase')) {
        const latencyAnomaly = this.detectLatencyAnomaly(
          bucket,
          baseline,
          sensitivity,
        );
        if (latencyAnomaly && latencyAnomaly.score >= (opts.minScore ?? 0.5)) {
          anomalies.push(latencyAnomaly);
        }
      }
    }

    // Sort by severity and score
    anomalies.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      return b.score - a.score;
    });

    const result: AnomalyDetectionResult = {
      anomalies,
      totalPoints: buckets.length,
      baseline,
    };

    // Emit events
    for (const anomaly of anomalies) {
      this.emit('anomaly:found', anomaly);
    }
    this.emit('detection:complete', result);

    return result;
  }

  /**
   * Get time buckets for analysis
   */
  private async getTimeBuckets(
    options: AnomalyDetectionOptions,
  ): Promise<TimeBucket[]> {
    const timeRange = options.period
      ? typeof options.period === 'object'
        ? options.period
        : this.periodToTimeRange(options.period as string)
      : this.periodToTimeRange('month');

    // Query conversations
    const result = await this.storage.queryConversations({ timeRange });
    const conversations = result.conversations;

    // Create hourly buckets
    const bucketSize = 60 * 60 * 1000; // 1 hour
    const bucketMap = new Map<number, TimeBucket>();

    for (const conv of conversations) {
      const bucketKey = Math.floor(conv.startedAt / bucketSize) * bucketSize;

      const bucket = bucketMap.get(bucketKey) ?? {
        timestamp: bucketKey,
        count: 0,
        sentiment: 0,
        successRate: 0,
        avgDuration: 0,
        values: [],
      };

      bucket.count++;
      if (conv.sentiment?.score !== undefined) {
        bucket.sentiment += conv.sentiment.score;
      }
      if (conv.outcome?.success !== undefined) {
        bucket.successRate += conv.outcome.success ? 1 : 0;
      }
      if (conv.endedAt) {
        bucket.avgDuration += conv.endedAt - conv.startedAt;
      }
      bucket.values.push(conv.messages.length);

      bucketMap.set(bucketKey, bucket);
    }

    // Calculate averages
    const buckets: TimeBucket[] = [];
    for (const bucket of bucketMap.values()) {
      if (bucket.count > 0) {
        bucket.sentiment /= bucket.count;
        bucket.successRate /= bucket.count;
        bucket.avgDuration /= bucket.count;
      }
      buckets.push(bucket);
    }

    // Sort by timestamp
    buckets.sort((a, b) => a.timestamp - b.timestamp);

    return buckets;
  }

  /**
   * Calculate baseline statistics
   */
  private calculateBaseline(buckets: TimeBucket[]): {
    mean: number;
    stdDev: number;
    min: number;
    max: number;
  } {
    const counts = buckets.map((b) => b.count);
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance =
      counts.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / counts.length;
    const stdDev = Math.sqrt(variance);

    return {
      mean,
      stdDev,
      min: Math.min(...counts),
      max: Math.max(...counts),
    };
  }

  /**
   * Get sensitivity multiplier
   */
  private getSensitivityMultiplier(sensitivity: string): number {
    switch (sensitivity) {
      case 'low':
        return 3;
      case 'high':
        return 1.5;
      default:
        return 2;
    }
  }

  /**
   * Detect volume anomaly
   */
  private detectVolumeAnomaly(
    bucket: TimeBucket,
    baseline: { mean: number; stdDev: number },
    sensitivity: number,
  ): Anomaly | null {
    const deviation = Math.abs(bucket.count - baseline.mean);
    const threshold = baseline.stdDev * sensitivity;

    if (deviation <= threshold) return null;

    const isSpike = bucket.count > baseline.mean;
    const score = Math.min(deviation / (baseline.stdDev * 3), 1);

    return {
      id: nanoid(),
      type: isSpike ? 'volume_spike' : 'volume_drop',
      description: isSpike
        ? `Volume spike: ${bucket.count} conversations (${((bucket.count / baseline.mean - 1) * 100).toFixed(1)}% above average)`
        : `Volume drop: ${bucket.count} conversations (${((1 - bucket.count / baseline.mean) * 100).toFixed(1)}% below average)`,
      severity: this.getSeverity(score),
      score,
      detectedAt: bucket.timestamp,
      expected: baseline.mean,
      actual: bucket.count,
      deviation: deviation / baseline.stdDev,
    };
  }

  /**
   * Detect sentiment anomaly
   */
  private detectSentimentAnomaly(
    bucket: TimeBucket,
    baseline: { mean: number; stdDev: number },
    sensitivity: number,
  ): Anomaly | null {
    if (bucket.sentiment === 0) return null;

    // Calculate sentiment baseline
    const baselineSentiment = 0; // Neutral baseline
    const threshold = 0.3 / sensitivity;

    if (Math.abs(bucket.sentiment) <= threshold) return null;

    const score = Math.min(Math.abs(bucket.sentiment), 1);

    return {
      id: nanoid(),
      type: 'sentiment_shift',
      description: `Sentiment shift: ${bucket.sentiment > 0 ? 'positive' : 'negative'} (${(bucket.sentiment * 100).toFixed(1)}%)`,
      severity: this.getSeverity(score),
      score,
      detectedAt: bucket.timestamp,
      expected: baselineSentiment,
      actual: bucket.sentiment,
      deviation: Math.abs(bucket.sentiment),
    };
  }

  /**
   * Detect success rate anomaly
   */
  private detectSuccessRateAnomaly(
    bucket: TimeBucket,
    baseline: { mean: number },
    sensitivity: number,
  ): Anomaly | null {
    if (bucket.count < 5) return null; // Need minimum sample

    // Assume 0.7 baseline success rate
    const baselineSuccess = 0.7;
    const threshold = 0.2 / sensitivity;

    const diff = baselineSuccess - bucket.successRate;
    if (diff <= threshold) return null;

    const score = Math.min(diff / 0.3, 1);

    return {
      id: nanoid(),
      type: 'success_rate_change',
      description: `Success rate drop: ${(bucket.successRate * 100).toFixed(1)}% (expected ~${(baselineSuccess * 100).toFixed(1)}%)`,
      severity: this.getSeverity(score),
      score,
      detectedAt: bucket.timestamp,
      expected: baselineSuccess,
      actual: bucket.successRate,
      deviation: diff,
    };
  }

  /**
   * Detect latency anomaly
   */
  private detectLatencyAnomaly(
    bucket: TimeBucket,
    baseline: { mean: number },
    sensitivity: number,
  ): Anomaly | null {
    if (bucket.avgDuration === 0) return null;

    // Assume 3 minute baseline duration
    const baselineDuration = 3 * 60 * 1000;
    const threshold = baselineDuration * sensitivity;

    const increase = bucket.avgDuration - baselineDuration;
    if (increase <= threshold) return null;

    const score = Math.min(increase / (baselineDuration * 2), 1);

    return {
      id: nanoid(),
      type: 'latency_increase',
      description: `Duration increase: ${(bucket.avgDuration / 1000 / 60).toFixed(1)} min avg (${((increase / baselineDuration) * 100).toFixed(1)}% above baseline)`,
      severity: this.getSeverity(score),
      score,
      detectedAt: bucket.timestamp,
      expected: baselineDuration,
      actual: bucket.avgDuration,
      deviation: increase / baselineDuration,
    };
  }

  /**
   * Get severity based on score
   */
  private getSeverity(score: number): Anomaly['severity'] {
    if (score >= 0.8) return 'critical';
    if (score >= 0.6) return 'high';
    if (score >= 0.4) return 'medium';
    return 'low';
  }

  /**
   * Convert period to time range
   */
  private periodToTimeRange(period: string): { start: number; end: number } {
    const now = Date.now();
    const periods: Record<string, number> = {
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
    };
    return {
      start: now - (periods[period] ?? periods.week),
      end: now,
    };
  }

  /**
   * Detect anomaly for a specific metric
   */
  async detectForMetric(
    metric: string,
    options: AnomalyDetectionOptions = {},
  ): Promise<Anomaly[]> {
    const result = await this.detect({
      ...options,
      metric,
    });
    return result.anomalies;
  }
}
