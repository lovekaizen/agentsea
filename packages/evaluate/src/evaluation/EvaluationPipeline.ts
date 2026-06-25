/**
 * EvaluationPipeline
 *
 * Main orchestrator for running evaluations.
 */

import { EvalRunner } from './EvalRunner.js';
import type {
  MetricInterface,
  JudgeInterface,
  EvaluationPipelineConfig,
  PipelineEvaluationOptions,
  PipelineEvaluationResult,
  SingleEvaluationResult,
  MetricsSummary,
  FailureAnalysis,
  EvaluationSummary,
  FailureFilterOptions,
} from '../types/index.js';

/**
 * Evaluation pipeline
 */
export class EvaluationPipeline {
  private metrics: MetricInterface[];
  private llmJudge?: JudgeInterface;
  private runner: EvalRunner;
  private runnerOptions: {
    parallelism: number;
    timeout: number;
    retries: number;
  };

  constructor(config: EvaluationPipelineConfig) {
    this.metrics = config.metrics;
    this.llmJudge = config.llmJudge;

    // Capture configured concurrency so per-call runners honor it too
    // (evaluate() builds its own runner to attach per-call callbacks).
    this.runnerOptions = {
      parallelism: config.parallelism ?? 5,
      timeout: config.timeout ?? 30000,
      retries: config.retries ?? 1,
    };

    this.runner = new EvalRunner(this.runnerOptions);
  }

  /**
   * Run evaluation pipeline
   */
  async evaluate(
    options: PipelineEvaluationOptions,
  ): Promise<PipelineEvaluationResult> {
    const startTime = performance.now();
    const results: SingleEvaluationResult[] = [];
    const total = options.dataset.size;
    let completed = 0;

    // Set up callbacks (reuse the pipeline's configured concurrency settings)
    const runner = new EvalRunner({
      ...this.runnerOptions,
      onItemComplete: (result) => {
        results.push(result);
        completed++;

        if (options.onProgress) {
          const elapsed = performance.now() - startTime;
          const avgTime = elapsed / completed;
          const remaining = (total - completed) * avgTime;

          options.onProgress({
            completed,
            total,
            currentItem: result.itemId,
            elapsedMs: elapsed,
            estimatedRemainingMs: remaining,
          });
        }
      },
      onError: (error) => {
        if (options.onError) {
          options.onError(error);
        }
        if (options.stopOnError) {
          throw error.error;
        }
      },
    });

    // Run evaluation
    await runner.run(
      options.dataset,
      options.generateFn,
      this.metrics,
      this.llmJudge,
    );

    const totalDurationMs = performance.now() - startTime;

    // Calculate metrics summary
    const metricsSummary = this.calculateMetricsSummary(results);

    // Analyze failures
    const failures = this.analyzeFailures(results);

    // Create summary
    const summary = this.createSummary(results, totalDurationMs);

    return this.createResult(results, metricsSummary, failures, summary);
  }

  /**
   * Run evaluation as stream
   */
  async *evaluateStream(
    options: PipelineEvaluationOptions,
  ): AsyncGenerator<SingleEvaluationResult, PipelineEvaluationResult, unknown> {
    const startTime = performance.now();
    const results: SingleEvaluationResult[] = [];
    const total = options.dataset.size;

    // Stream results
    for await (const result of this.runner.runStream(
      options.dataset,
      options.generateFn,
      this.metrics,
      this.llmJudge,
    )) {
      results.push(result);

      if (options.onProgress) {
        const elapsed = performance.now() - startTime;
        const avgTime = elapsed / results.length;
        const remaining = (total - results.length) * avgTime;

        options.onProgress({
          completed: results.length,
          total,
          currentItem: result.itemId,
          elapsedMs: elapsed,
          estimatedRemainingMs: remaining,
        });
      }

      yield result;
    }

    const totalDurationMs = performance.now() - startTime;
    const metricsSummary = this.calculateMetricsSummary(results);
    const failures = this.analyzeFailures(results);
    const summary = this.createSummary(results, totalDurationMs);

    return this.createResult(results, metricsSummary, failures, summary);
  }

  /**
   * Calculate metrics summary
   */
  private calculateMetricsSummary(
    results: SingleEvaluationResult[],
  ): MetricsSummary {
    const summary: MetricsSummary = {};

    if (results.length === 0) return summary;

    // Collect all metric names
    const metricNames = new Set<string>();
    for (const result of results) {
      for (const name of Object.keys(result.scores)) {
        metricNames.add(name);
      }
    }

    // Calculate statistics for each metric
    for (const name of metricNames) {
      const scores = results
        .map((r) => r.scores[name])
        .filter((s) => s !== undefined);

      if (scores.length === 0) continue;

      const sorted = [...scores].sort((a, b) => a - b);
      const sum = scores.reduce((a, b) => a + b, 0);
      const mean = sum / scores.length;
      const variance =
        scores.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / scores.length;
      const std = Math.sqrt(variance);

      const passCount = scores.filter((s) => s >= 0.5).length;

      summary[name] = {
        mean,
        std,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        median: sorted[Math.floor(sorted.length / 2)],
        p90: sorted[Math.floor(sorted.length * 0.9)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        passRate: passCount / scores.length,
      };
    }

    return summary;
  }

  /**
   * Analyze failures
   */
  private analyzeFailures(
    results: SingleEvaluationResult[],
  ): FailureAnalysis[] {
    return results
      .filter((r) => !r.passed)
      .map((r) => {
        const failedMetrics = Object.entries(r.scores)
          .filter(([, score]) => score < 0.5)
          .map(([name]) => name);

        const explanations = failedMetrics
          .map((m) => r.explanations?.[m])
          .filter(Boolean)
          .join('; ');

        return {
          itemId: r.itemId,
          input: r.input,
          output: r.output,
          expectedOutput: r.expectedOutput,
          scores: r.scores,
          failedMetrics,
          explanation: explanations || undefined,
        };
      });
  }

  /**
   * Create evaluation summary
   */
  private createSummary(
    results: SingleEvaluationResult[],
    totalDurationMs: number,
  ): EvaluationSummary {
    const passedItems = results.filter((r) => r.passed).length;

    const allScores = results.flatMap((r) => Object.values(r.scores));
    const avgScore =
      allScores.length > 0
        ? allScores.reduce((a, b) => a + b, 0) / allScores.length
        : 0;

    return {
      totalItems: results.length,
      passedItems,
      failedItems: results.length - passedItems,
      passRate: results.length > 0 ? passedItems / results.length : 0,
      avgScore,
      totalDurationMs,
      avgDurationMs: results.length > 0 ? totalDurationMs / results.length : 0,
      timestamp: Date.now(),
    };
  }

  /**
   * Create result object
   */
  private createResult(
    results: SingleEvaluationResult[],
    metrics: MetricsSummary,
    failures: FailureAnalysis[],
    summary: EvaluationSummary,
  ): PipelineEvaluationResult {
    return {
      results,
      metrics,
      failures,
      summary,

      exportJSON(): string {
        return JSON.stringify(
          {
            results,
            metrics,
            failures,
            summary,
          },
          null,
          2,
        );
      },

      exportCSV(): string {
        if (results.length === 0) return '';

        // Get all score columns
        const scoreColumns = new Set<string>();
        for (const r of results) {
          for (const name of Object.keys(r.scores)) {
            scoreColumns.add(name);
          }
        }

        const headers = [
          'itemId',
          'input',
          'output',
          'passed',
          ...scoreColumns,
        ];
        const rows = results.map((r) => {
          const values = [
            r.itemId,
            `"${r.input.replace(/"/g, '""')}"`,
            `"${r.output.replace(/"/g, '""')}"`,
            r.passed.toString(),
            ...Array.from(scoreColumns).map(
              (c) => r.scores[c]?.toFixed(4) ?? '',
            ),
          ];
          return values.join(',');
        });

        return [headers.join(','), ...rows].join('\n');
      },

      getFailures(options?: FailureFilterOptions): FailureAnalysis[] {
        let filtered = [...failures];

        if (options?.threshold !== undefined) {
          filtered = filtered.filter((f) =>
            Object.values(f.scores).some((s) => s < options.threshold!),
          );
        }

        if (options?.metric) {
          filtered = filtered.filter((f) =>
            f.failedMetrics.includes(options.metric!),
          );
        }

        if (options?.limit) {
          filtered = filtered.slice(0, options.limit);
        }

        return filtered;
      },
    };
  }

  /**
   * Add a metric
   */
  addMetric(metric: MetricInterface): void {
    this.metrics.push(metric);
  }

  /**
   * Remove a metric
   */
  removeMetric(name: string): boolean {
    const index = this.metrics.findIndex((m) => m.name === name);
    if (index >= 0) {
      this.metrics.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Set judge
   */
  setJudge(judge: JudgeInterface): void {
    this.llmJudge = judge;
  }

  /**
   * Get metrics
   */
  getMetrics(): MetricInterface[] {
    return [...this.metrics];
  }
}

/**
 * Create an evaluation pipeline
 */
export function createEvaluationPipeline(
  config: EvaluationPipelineConfig,
): EvaluationPipeline {
  return new EvaluationPipeline(config);
}
