/**
 * EvalRunner
 *
 * Execute evaluations with parallelism and error handling.
 */

import type {
  MetricInterface,
  JudgeInterface,
  EvalDatasetInterface,
  EvalDatasetItem,
  EvaluationInput,
  SingleEvaluationResult,
  EvaluationError,
  EvalRunnerConfig,
} from '../types/index.js';

/**
 * Evaluation runner
 */
export class EvalRunner {
  private parallelism: number;
  private timeout: number;
  private retries: number;
  private onItemComplete?: (result: SingleEvaluationResult) => void;
  private onError?: (error: EvaluationError) => void;

  constructor(config: EvalRunnerConfig = {}) {
    this.parallelism = config.parallelism ?? 5;
    this.timeout = config.timeout ?? 30000;
    this.retries = config.retries ?? 1;
    this.onItemComplete = config.onItemComplete;
    this.onError = config.onError;
  }

  /**
   * Run evaluation on a dataset
   */
  async run(
    dataset: EvalDatasetInterface,
    generateFn: (input: string, context?: string[]) => Promise<string>,
    metrics: MetricInterface[],
    judge?: JudgeInterface,
  ): Promise<SingleEvaluationResult[]> {
    const items = dataset.getItems();
    const results: SingleEvaluationResult[] = [];

    // Process in batches
    for (let i = 0; i < items.length; i += this.parallelism) {
      const batch = items.slice(i, i + this.parallelism);
      const batchResults = await Promise.all(
        batch.map((item) =>
          this.evaluateItem(item, generateFn, metrics, judge),
        ),
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Run evaluation as async generator
   */
  async *runStream(
    dataset: EvalDatasetInterface,
    generateFn: (input: string, context?: string[]) => Promise<string>,
    metrics: MetricInterface[],
    judge?: JudgeInterface,
  ): AsyncGenerator<SingleEvaluationResult, void, unknown> {
    const items = dataset.getItems();

    for (let i = 0; i < items.length; i += this.parallelism) {
      const batch = items.slice(i, i + this.parallelism);
      const batchResults = await Promise.all(
        batch.map((item) =>
          this.evaluateItem(item, generateFn, metrics, judge),
        ),
      );

      for (const result of batchResults) {
        yield result;
      }
    }
  }

  /**
   * Evaluate a single item
   */
  private async evaluateItem(
    item: EvalDatasetItem,
    generateFn: (input: string, context?: string[]) => Promise<string>,
    metrics: MetricInterface[],
    judge?: JudgeInterface,
  ): Promise<SingleEvaluationResult> {
    const startTime = performance.now();
    let output = '';
    let generationError: Error | null = null;

    // Generate output with retries
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        output = await this.withTimeout(
          generateFn(item.input, item.context),
          this.timeout,
        );
        break;
      } catch (error) {
        generationError = error as Error;
        if (attempt === this.retries) {
          const evalError: EvaluationError = {
            itemId: item.id,
            input: item.input,
            error: generationError,
            phase: 'generation',
          };
          this.onError?.(evalError);

          return {
            itemId: item.id,
            input: item.input,
            output: '',
            expectedOutput: item.expectedOutput,
            context: item.context,
            scores: {},
            passed: false,
            durationMs: performance.now() - startTime,
          };
        }
      }
    }

    // Create evaluation input
    const evalInput: EvaluationInput = {
      input: item.input,
      output,
      expectedOutput: item.expectedOutput,
      context: item.context,
      reference: item.reference,
      metadata: item.metadata,
    };

    // Run metrics
    const scores: Record<string, number> = {};
    const explanations: Record<string, string> = {};

    for (const metric of metrics) {
      try {
        const result = await this.withTimeout(
          metric.evaluate(evalInput),
          this.timeout,
        );
        scores[metric.name] = result.score;
        if (result.explanation) {
          explanations[metric.name] = result.explanation;
        }
      } catch (error) {
        const evalError: EvaluationError = {
          itemId: item.id,
          input: item.input,
          error: error as Error,
          phase: 'evaluation',
        };
        this.onError?.(evalError);
        scores[metric.name] = 0;
        explanations[metric.name] = `Error: ${(error as Error).message}`;
      }
    }

    // Run judge if provided
    let judgeResult;
    if (judge) {
      try {
        judgeResult = await this.withTimeout(
          judge.evaluate(evalInput),
          this.timeout,
        );
        // Merge judge scores
        for (const [key, value] of Object.entries(judgeResult.scores)) {
          scores[`judge_${key}`] = value;
        }
      } catch (error) {
        const evalError: EvaluationError = {
          itemId: item.id,
          input: item.input,
          error: error as Error,
          phase: 'evaluation',
        };
        this.onError?.(evalError);
      }
    }

    // Determine if passed (all scores above threshold)
    const passed = Object.values(scores).every((score) => score >= 0.5);

    const result: SingleEvaluationResult = {
      itemId: item.id,
      input: item.input,
      output,
      expectedOutput: item.expectedOutput,
      context: item.context,
      scores,
      explanations:
        Object.keys(explanations).length > 0 ? explanations : undefined,
      judgeResult,
      passed,
      durationMs: performance.now() - startTime,
    };

    this.onItemComplete?.(result);

    return result;
  }

  /**
   * Run with timeout
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Evaluation timeout')), timeoutMs),
      ),
    ]);
  }
}

/**
 * Create an eval runner
 */
export function createEvalRunner(config?: EvalRunnerConfig): EvalRunner {
  return new EvalRunner(config);
}
