/**
 * RubricJudge
 *
 * Rubric-based evaluation using defined scoring levels.
 */

import type {
  JudgeInterface,
  JudgeResult,
  EvaluationInput,
  RubricJudgeConfig,
  RubricConfig,
  LLMProviderInterface,
} from '../../types/index.js';

/**
 * Rubric-based judge
 */
export class RubricJudge implements JudgeInterface {
  readonly type = 'rubric' as const;

  private provider: LLMProviderInterface;
  private model: string;
  private rubric: RubricConfig;
  private temperature: number;

  constructor(config: RubricJudgeConfig) {
    if (!config.provider) {
      throw new Error('RubricJudge requires a provider');
    }
    if (!config.rubric) {
      throw new Error('RubricJudge requires a rubric');
    }
    if (!config.rubric.levels || config.rubric.levels.length === 0) {
      throw new Error('Rubric must have at least one level');
    }

    this.provider = config.provider;
    this.model = config.model ?? 'claude-sonnet-4-20250514';
    this.rubric = config.rubric;
    this.temperature = config.temperature ?? 0;
  }

  async evaluate(input: EvaluationInput): Promise<JudgeResult> {
    const prompt = this.buildPrompt(input);

    try {
      const response = await this.provider.complete({
        model: this.model,
        messages: [
          { role: 'system', content: this.getSystemPrompt() },
          { role: 'user', content: prompt },
        ],
        temperature: this.temperature,
      });

      return this.parseResponse(response.content);
    } catch (error) {
      return {
        scores: { [this.rubric.criteria]: 0 },
        explanations: {
          [this.rubric.criteria]:
            `Evaluation failed: ${(error as Error).message}`,
        },
        overallScore: 0,
      };
    }
  }

  /**
   * Build the evaluation prompt
   */
  private buildPrompt(input: EvaluationInput): string {
    const levelsDescription = this.rubric.levels
      .map((level) => {
        let desc = `Score ${level.score}: ${level.description}`;
        if (level.examples && level.examples.length > 0) {
          desc += `\n  Examples: ${level.examples.join('; ')}`;
        }
        return desc;
      })
      .join('\n');

    return `Evaluate the following response using this rubric.

Criterion: ${this.rubric.criteria}

Scoring Rubric:
${levelsDescription}

Input/Question: ${input.input}

Response to Evaluate:
${input.output}

${input.expectedOutput ? `Expected/Reference Output:\n${input.expectedOutput}\n` : ''}
${input.context ? `Context:\n${input.context.join('\n')}\n` : ''}

Based on the rubric, provide:
1. The score (${this.rubric.levels.map((l) => l.score).join(', ')})
2. A brief justification for your choice

Format: "Score: X - [justification]"`;
  }

  /**
   * Get system prompt
   */
  private getSystemPrompt(): string {
    return `You are an expert evaluator using a predefined rubric.
Your task is to carefully match the response to the most appropriate rubric level.
Be consistent and fair in your assessment.`;
  }

  /**
   * Parse response to extract score
   */
  private parseResponse(response: string): JudgeResult {
    // Find score
    const scoreMatch = response.match(/Score:\s*(\d+)/i);
    let score = 0;

    if (scoreMatch) {
      const rawScore = parseInt(scoreMatch[1], 10);
      const level = this.rubric.levels.find((l) => l.score === rawScore);
      if (level) {
        // Normalize to 0-1
        const minScore = Math.min(...this.rubric.levels.map((l) => l.score));
        const maxScore = Math.max(...this.rubric.levels.map((l) => l.score));
        score = (rawScore - minScore) / (maxScore - minScore);
      }
    }

    return {
      scores: { [this.rubric.criteria]: score },
      explanations: { [this.rubric.criteria]: response },
      overallScore: score,
    };
  }

  /**
   * Get rubric
   */
  getRubric(): RubricConfig {
    return { ...this.rubric };
  }

  /**
   * Update rubric
   */
  setRubric(rubric: RubricConfig): void {
    if (!rubric.levels || rubric.levels.length === 0) {
      throw new Error('Rubric must have at least one level');
    }
    this.rubric = rubric;
  }
}

/**
 * Create a rubric judge
 */
export function createRubricJudge(config: RubricJudgeConfig): RubricJudge {
  return new RubricJudge(config);
}

/**
 * Pre-built rubrics
 */

/**
 * Quality rubric for general response quality
 */
export const QualityRubric: RubricConfig = {
  criteria: 'response_quality',
  levels: [
    {
      score: 1,
      description: 'Poor quality - Incorrect, irrelevant, or harmful response',
      examples: ['Wrong answer', 'Off-topic response', 'Gibberish'],
    },
    {
      score: 2,
      description:
        'Below average - Partially addresses question but significant issues',
      examples: ['Missing key information', 'Contains errors', 'Confusing'],
    },
    {
      score: 3,
      description:
        'Average - Addresses question adequately but room for improvement',
      examples: ['Correct but lacks depth', 'Could be clearer'],
    },
    {
      score: 4,
      description: 'Good - Well-written, accurate, and helpful response',
      examples: ['Clear explanation', 'Addresses all parts of question'],
    },
    {
      score: 5,
      description: 'Excellent - Outstanding response that exceeds expectations',
      examples: ['Comprehensive', 'Insightful', 'Well-structured'],
    },
  ],
};

/**
 * Code quality rubric
 */
export const CodeQualityRubric: RubricConfig = {
  criteria: 'code_quality',
  levels: [
    {
      score: 1,
      description:
        'Critical issues - Code has bugs, security issues, or does not compile',
    },
    {
      score: 2,
      description: 'Significant issues - Code works but has major problems',
    },
    {
      score: 3,
      description:
        'Functional - Code works with minor issues or style problems',
    },
    {
      score: 4,
      description:
        'Good - Clean, efficient code with minor improvements possible',
    },
    {
      score: 5,
      description:
        'Excellent - Production-ready, well-documented, follows best practices',
    },
  ],
};

/**
 * Helpfulness rubric
 */
export const HelpfulnessRubric: RubricConfig = {
  criteria: 'helpfulness',
  levels: [
    {
      score: 1,
      description: 'Not helpful at all - Response does not address user needs',
    },
    {
      score: 2,
      description: 'Slightly helpful - Provides minimal useful information',
    },
    { score: 3, description: 'Moderately helpful - Addresses some user needs' },
    {
      score: 4,
      description: 'Very helpful - Addresses most user needs effectively',
    },
    {
      score: 5,
      description:
        'Extremely helpful - Exceeds expectations in addressing needs',
    },
  ],
};
