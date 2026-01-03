/**
 * ContinuousEval
 *
 * Continuous evaluation monitoring.
 */

import { EventEmitter } from 'eventemitter3';
import type {
  ContinuousEvalConfig,
  ContinuousEvalStats,
  MonitoringStatus,
  EvaluationPipelineRef,
  EvalInput,
  EvalOutput,
  ABTestConfig,
} from '../types/index.js';
import { AlertManager } from './AlertManager.js';
import { ABTestRunner } from './ABTestRunner.js';

interface ContinuousEvalEvents {
  'eval:started': () => void;
  'eval:completed': (result: EvalOutput) => void;
  'eval:error': (error: Error) => void;
  'status:changed': (status: MonitoringStatus) => void;
}

/**
 * Continuous evaluation monitor
 */
export class ContinuousEval extends EventEmitter<ContinuousEvalEvents> {
  private pipeline: EvaluationPipelineRef;
  private sampleRate: number;
  private status: MonitoringStatus = 'stopped';
  private startedAt?: number;
  private lastEvalAt?: number;
  private totalEvaluations = 0;
  private passedCount = 0;
  private scoreHistory: Record<string, number[]> = {};
  private alertManager?: AlertManager;
  private abTests: Map<string, ABTestRunner> = new Map();
  private intervalId?: NodeJS.Timeout;

  constructor(config: ContinuousEvalConfig) {
    super();
    this.pipeline = config.pipeline;
    this.sampleRate = config.sampleRate;
  }

  /**
   * Set alert manager
   */
  setAlerts(
    alertManager: AlertManager,
    rules: Record<string, { threshold: number; direction: 'above' | 'below' }>,
  ): void {
    this.alertManager = alertManager;
    for (const [metric, rule] of Object.entries(rules)) {
      alertManager.addRule({
        metric,
        threshold: rule.threshold,
        direction: rule.direction,
      });
    }
  }

  /**
   * Start monitoring
   */
  start(): void {
    if (this.status === 'running') return;

    this.status = 'running';
    this.startedAt = Date.now();
    this.emit('status:changed', this.status);
    this.emit('eval:started');
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    this.status = 'stopped';
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.emit('status:changed', this.status);
  }

  /**
   * Pause monitoring
   */
  pause(): void {
    if (this.status === 'running') {
      this.status = 'paused';
      this.emit('status:changed', this.status);
    }
  }

  /**
   * Resume monitoring
   */
  resume(): void {
    if (this.status === 'paused') {
      this.status = 'running';
      this.emit('status:changed', this.status);
    }
  }

  /**
   * Evaluate a sample
   */
  async evaluate(input: EvalInput): Promise<EvalOutput | null> {
    // Check if we should sample
    if (Math.random() > this.sampleRate) {
      return null;
    }

    if (this.status !== 'running') {
      return null;
    }

    try {
      const result = await this.pipeline.evaluate(input);

      this.totalEvaluations++;
      this.lastEvalAt = Date.now();

      if (result.passed) {
        this.passedCount++;
      }

      // Track scores
      for (const [metric, score] of Object.entries(result.scores)) {
        if (!this.scoreHistory[metric]) {
          this.scoreHistory[metric] = [];
        }
        this.scoreHistory[metric].push(score);

        // Keep only last 1000 scores
        if (this.scoreHistory[metric].length > 1000) {
          this.scoreHistory[metric].shift();
        }

        // Check alerts
        if (this.alertManager) {
          this.alertManager.check(metric, score);
        }
      }

      this.emit('eval:completed', result);

      return result;
    } catch (error) {
      this.status = 'error';
      this.emit('eval:error', error as Error);
      this.emit('status:changed', this.status);
      return null;
    }
  }

  /**
   * Get statistics
   */
  getStats(): ContinuousEvalStats {
    const avgScores: Record<string, number> = {};

    for (const [metric, scores] of Object.entries(this.scoreHistory)) {
      if (scores.length > 0) {
        avgScores[metric] = scores.reduce((a, b) => a + b, 0) / scores.length;
      }
    }

    return {
      status: this.status,
      startedAt: this.startedAt,
      lastEvalAt: this.lastEvalAt,
      totalEvaluations: this.totalEvaluations,
      passRate:
        this.totalEvaluations > 0
          ? this.passedCount / this.totalEvaluations
          : 0,
      avgScores,
      alertsTriggered: this.alertManager?.getAlertCount() ?? 0,
    };
  }

  /**
   * Create A/B test
   */
  createABTest(config: ABTestConfig): ABTestRunner {
    const test = new ABTestRunner(config);
    this.abTests.set(test.id, test);
    return test;
  }

  /**
   * Get A/B test
   */
  getABTest(id: string): ABTestRunner | undefined {
    return this.abTests.get(id);
  }

  /**
   * Get all A/B tests
   */
  getABTests(): ABTestRunner[] {
    return Array.from(this.abTests.values());
  }

  /**
   * Get score history for a metric
   */
  getScoreHistory(metric: string): number[] {
    return this.scoreHistory[metric] ?? [];
  }

  /**
   * Reset statistics
   */
  reset(): void {
    this.totalEvaluations = 0;
    this.passedCount = 0;
    this.scoreHistory = {};
    this.lastEvalAt = undefined;
  }
}

/**
 * Create a continuous evaluator
 */
export function createContinuousEval(
  config: ContinuousEvalConfig,
): ContinuousEval {
  return new ContinuousEval(config);
}
