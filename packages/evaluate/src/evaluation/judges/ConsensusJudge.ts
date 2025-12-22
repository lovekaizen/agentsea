/**
 * ConsensusJudge
 *
 * Multi-judge consensus evaluation.
 */

import type {
  JudgeInterface,
  JudgeResult,
  EvaluationInput,
  ConsensusJudgeConfig,
} from '../../types/index.js';

/**
 * Consensus judge combining multiple judges
 */
export class ConsensusJudge implements JudgeInterface {
  readonly type = 'consensus' as const;

  private judges: JudgeInterface[];
  private aggregation: 'majority' | 'average' | 'weighted';
  private weights?: number[];
  private minAgreement: number;

  constructor(config: ConsensusJudgeConfig) {
    if (!config.judges || config.judges.length === 0) {
      throw new Error('ConsensusJudge requires at least one judge');
    }

    this.judges = config.judges;
    this.aggregation = config.aggregation;
    this.weights = config.weights;
    this.minAgreement = config.minAgreement ?? 0.5;

    // Validate weights
    if (this.weights && this.weights.length !== this.judges.length) {
      throw new Error('Weights array must match number of judges');
    }
  }

  async evaluate(input: EvaluationInput): Promise<JudgeResult> {
    // Get results from all judges
    const results = await Promise.all(
      this.judges.map((judge) => judge.evaluate(input)),
    );

    // Aggregate results based on strategy
    switch (this.aggregation) {
      case 'majority':
        return this.aggregateMajority(results);
      case 'average':
        return this.aggregateAverage(results);
      case 'weighted':
        return this.aggregateWeighted(results);
      default:
        return this.aggregateAverage(results);
    }
  }

  /**
   * Aggregate using majority voting
   */
  private aggregateMajority(results: JudgeResult[]): JudgeResult {
    const allScores: Record<string, number[]> = {};
    const allExplanations: Record<string, string[]> = {};

    // Collect all scores and explanations
    for (const result of results) {
      for (const [metric, score] of Object.entries(result.scores)) {
        if (!allScores[metric]) {
          allScores[metric] = [];
          allExplanations[metric] = [];
        }
        allScores[metric].push(score);
      }
      for (const [metric, explanation] of Object.entries(result.explanations)) {
        if (!allExplanations[metric]) {
          allExplanations[metric] = [];
        }
        allExplanations[metric].push(explanation);
      }
    }

    // For each metric, use majority vote (round to nearest 0.5)
    const consensusScores: Record<string, number> = {};
    const consensusExplanations: Record<string, string> = {};
    const agreementScores: Record<string, number> = {};

    for (const [metric, scores] of Object.entries(allScores)) {
      // Round scores to nearest 0.5 for voting
      const rounded = scores.map((s) => Math.round(s * 2) / 2);
      const counts = new Map<number, number>();

      for (const s of rounded) {
        counts.set(s, (counts.get(s) ?? 0) + 1);
      }

      // Find most common score
      let maxCount = 0;
      let consensusScore = 0;
      for (const [score, count] of counts) {
        if (count > maxCount) {
          maxCount = count;
          consensusScore = score;
        }
      }

      consensusScores[metric] = consensusScore;
      agreementScores[metric] = maxCount / scores.length;

      // Combine explanations from judges who agree
      const agreeingExplanations = scores
        .map((s, i) => ({
          score: s,
          explanation: allExplanations[metric]?.[i],
        }))
        .filter((item) => Math.round(item.score * 2) / 2 === consensusScore)
        .map((item) => item.explanation)
        .filter(Boolean);

      consensusExplanations[metric] =
        agreeingExplanations.join(' | ') || 'No consensus explanation';
    }

    // Calculate overall score
    const overallScores = results.map((r) => r.overallScore ?? 0);
    const roundedOverall = overallScores.map((s) => Math.round(s * 2) / 2);
    const overallCounts = new Map<number, number>();
    for (const s of roundedOverall) {
      overallCounts.set(s, (overallCounts.get(s) ?? 0) + 1);
    }

    let overallConsensus = 0;
    let maxOverallCount = 0;
    for (const [score, count] of overallCounts) {
      if (count > maxOverallCount) {
        maxOverallCount = count;
        overallConsensus = score;
      }
    }

    const agreement = maxOverallCount / results.length;

    return {
      scores: consensusScores,
      explanations: consensusExplanations,
      overallScore: overallConsensus,
      confidence: agreement >= this.minAgreement ? agreement : undefined,
      metadata: {
        aggregation: 'majority',
        agreement,
        judgeCount: results.length,
        agreementScores,
        meetsMinAgreement: agreement >= this.minAgreement,
      },
    };
  }

  /**
   * Aggregate using simple average
   */
  private aggregateAverage(results: JudgeResult[]): JudgeResult {
    const allScores: Record<string, number[]> = {};
    const allExplanations: Record<string, string[]> = {};

    // Collect all scores
    for (const result of results) {
      for (const [metric, score] of Object.entries(result.scores)) {
        if (!allScores[metric]) {
          allScores[metric] = [];
          allExplanations[metric] = [];
        }
        allScores[metric].push(score);
      }
      for (const [metric, explanation] of Object.entries(result.explanations)) {
        if (!allExplanations[metric]) {
          allExplanations[metric] = [];
        }
        allExplanations[metric].push(explanation);
      }
    }

    // Calculate averages
    const avgScores: Record<string, number> = {};
    const stdScores: Record<string, number> = {};

    for (const [metric, scores] of Object.entries(allScores)) {
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      avgScores[metric] = mean;

      // Calculate std for confidence
      const variance =
        scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) /
        scores.length;
      stdScores[metric] = Math.sqrt(variance);
    }

    // Combine explanations
    const combinedExplanations: Record<string, string> = {};
    for (const [metric, explanations] of Object.entries(allExplanations)) {
      combinedExplanations[metric] = explanations.join(' | ');
    }

    // Calculate overall score
    const overallScores = results.map((r) => r.overallScore ?? 0);
    const overallMean =
      overallScores.reduce((a, b) => a + b, 0) / overallScores.length;
    const overallVariance =
      overallScores.reduce((sum, s) => sum + Math.pow(s - overallMean, 2), 0) /
      overallScores.length;
    const overallStd = Math.sqrt(overallVariance);

    // Confidence based on agreement (lower std = higher confidence)
    const confidence = Math.max(0.5, 1 - overallStd);

    return {
      scores: avgScores,
      explanations: combinedExplanations,
      overallScore: overallMean,
      confidence,
      metadata: {
        aggregation: 'average',
        judgeCount: results.length,
        standardDeviations: stdScores,
        overallStd,
      },
    };
  }

  /**
   * Aggregate using weighted average
   */
  private aggregateWeighted(results: JudgeResult[]): JudgeResult {
    const weights = this.weights ?? results.map(() => 1);
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    const weightedScores: Record<string, number> = {};
    const allExplanations: Record<string, string[]> = {};

    // Calculate weighted scores
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const weight = weights[i];

      for (const [metric, score] of Object.entries(result.scores)) {
        if (!weightedScores[metric]) {
          weightedScores[metric] = 0;
          allExplanations[metric] = [];
        }
        weightedScores[metric] += score * weight;
      }
      for (const [metric, explanation] of Object.entries(result.explanations)) {
        if (!allExplanations[metric]) {
          allExplanations[metric] = [];
        }
        allExplanations[metric].push(explanation);
      }
    }

    // Normalize by total weight
    for (const metric of Object.keys(weightedScores)) {
      weightedScores[metric] /= totalWeight;
    }

    // Combine explanations
    const combinedExplanations: Record<string, string> = {};
    for (const [metric, explanations] of Object.entries(allExplanations)) {
      combinedExplanations[metric] = explanations.join(' | ');
    }

    // Calculate weighted overall score
    const weightedOverall =
      results.reduce(
        (sum, r, i) => sum + (r.overallScore ?? 0) * weights[i],
        0,
      ) / totalWeight;

    return {
      scores: weightedScores,
      explanations: combinedExplanations,
      overallScore: weightedOverall,
      metadata: {
        aggregation: 'weighted',
        judgeCount: results.length,
        weights,
      },
    };
  }

  /**
   * Add a judge
   */
  addJudge(judge: JudgeInterface, weight?: number): void {
    this.judges.push(judge);
    if (this.weights && weight !== undefined) {
      this.weights.push(weight);
    }
  }

  /**
   * Remove a judge by index
   */
  removeJudge(index: number): boolean {
    if (index >= 0 && index < this.judges.length) {
      this.judges.splice(index, 1);
      if (this.weights) {
        this.weights.splice(index, 1);
      }
      return true;
    }
    return false;
  }

  /**
   * Get judge count
   */
  getJudgeCount(): number {
    return this.judges.length;
  }
}

/**
 * Create a consensus judge
 */
export function createConsensusJudge(
  config: ConsensusJudgeConfig,
): ConsensusJudge {
  return new ConsensusJudge(config);
}
