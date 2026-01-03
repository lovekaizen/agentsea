/**
 * AgentEvaluator
 *
 * Comprehensive evaluation for AgentSea agents.
 */

import { EvaluationPipeline } from '../../evaluation/EvaluationPipeline.js';
import { EvalDataset } from '../../evaluation/EvalDataset.js';
import type {
  EvalDatasetItem,
  PipelineEvaluationResult,
} from '../../types/index.js';

/**
 * Scenario configuration
 */
export interface EvaluationScenario {
  category: string;
  dataset: EvalDataset;
  weight?: number;
}

/**
 * Evaluator options
 */
export interface AgentEvaluatorOptions {
  pipeline: EvaluationPipeline;
  scenarios: EvaluationScenario[];
}

/**
 * Agent interface (simplified)
 */
export interface AgentInterface {
  execute(input: string, context?: unknown): Promise<string>;
}

/**
 * Agent evaluation result
 */
export interface AgentEvaluationResult {
  overallScore: number;
  categoryScores: Record<string, number>;
  categoryResults: Record<string, PipelineEvaluationResult>;
  recommendations: string[];
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    passRate: number;
  };
}

/**
 * Agent evaluator
 */
export class AgentEvaluator {
  private pipeline: EvaluationPipeline;
  private scenarios: EvaluationScenario[];

  constructor(options: AgentEvaluatorOptions) {
    this.pipeline = options.pipeline;
    this.scenarios = options.scenarios;
  }

  /**
   * Evaluate an agent
   */
  async evaluate(agent: AgentInterface): Promise<AgentEvaluationResult> {
    const categoryScores: Record<string, number> = {};
    const categoryResults: Record<string, PipelineEvaluationResult> = {};
    const recommendations: string[] = [];

    let totalTests = 0;
    let totalPassed = 0;
    let weightedScoreSum = 0;
    let totalWeight = 0;

    for (const scenario of this.scenarios) {
      const result = await this.pipeline.evaluate({
        dataset: scenario.dataset,
        generateFn: async (input, context) => {
          return agent.execute(input, context);
        },
      });

      const avgScore = result.summary.avgScore;
      const weight = scenario.weight ?? 1;

      categoryScores[scenario.category] = avgScore;
      categoryResults[scenario.category] = result;

      totalTests += result.summary.totalItems;
      totalPassed += result.summary.passedItems;
      weightedScoreSum += avgScore * weight;
      totalWeight += weight;

      // Generate recommendations
      if (avgScore < 0.7) {
        recommendations.push(
          `Improve ${scenario.category}: current score ${(avgScore * 100).toFixed(1)}%`,
        );
      }

      if (result.summary.passRate < 0.8) {
        const topFailures = result.failures
          .slice(0, 3)
          .map((f) => f.failedMetrics.join(', '));
        if (topFailures.length > 0) {
          recommendations.push(
            `${scenario.category} failures often in: ${[...new Set(topFailures)].join(', ')}`,
          );
        }
      }
    }

    const overallScore = totalWeight > 0 ? weightedScoreSum / totalWeight : 0;

    return {
      overallScore,
      categoryScores,
      categoryResults,
      recommendations,
      summary: {
        totalTests,
        passed: totalPassed,
        failed: totalTests - totalPassed,
        passRate: totalTests > 0 ? totalPassed / totalTests : 0,
      },
    };
  }

  /**
   * Run quick benchmark
   */
  async benchmark(
    agent: AgentInterface,
    sampleSize = 10,
  ): Promise<{ score: number; latencyMs: number }> {
    const allItems: EvalDatasetItem[] = [];

    for (const scenario of this.scenarios) {
      allItems.push(...scenario.dataset.sample(sampleSize).getItems());
    }

    const startTime = performance.now();
    let totalScore = 0;
    let count = 0;

    for (const item of allItems.slice(0, sampleSize)) {
      try {
        const output = await agent.execute(item.input);
        // Simple heuristic score based on output existence
        if (output && output.length > 0) {
          totalScore += 1;
        }
        count++;
      } catch {
        // Error handling - count as failure
        count++;
      }
    }

    const latencyMs = (performance.now() - startTime) / count;

    return {
      score: count > 0 ? totalScore / count : 0,
      latencyMs,
    };
  }

  /**
   * Add a scenario
   */
  addScenario(scenario: EvaluationScenario): void {
    this.scenarios.push(scenario);
  }

  /**
   * Get scenarios
   */
  getScenarios(): EvaluationScenario[] {
    return [...this.scenarios];
  }
}

/**
 * Create an agent evaluator
 */
export function createAgentEvaluator(
  options: AgentEvaluatorOptions,
): AgentEvaluator {
  return new AgentEvaluator(options);
}
