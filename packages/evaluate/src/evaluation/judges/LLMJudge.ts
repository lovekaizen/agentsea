/**
 * LLMJudge
 *
 * LLM-as-judge evaluation using configurable criteria.
 */

import type {
  JudgeInterface,
  JudgeResult,
  EvaluationInput,
  LLMJudgeConfig,
  JudgeCriterion,
  LLMProviderInterface,
} from '../../types/index.js';

/**
 * LLM-as-judge evaluator
 */
export class LLMJudge implements JudgeInterface {
  readonly type = 'llm' as const;

  private provider: LLMProviderInterface;
  private model: string;
  private criteria: JudgeCriterion[];
  private systemPrompt: string;
  private temperature: number;
  private maxRetries: number;

  constructor(config: LLMJudgeConfig) {
    if (!config.provider) {
      throw new Error('LLMJudge requires a provider');
    }
    if (!config.criteria || config.criteria.length === 0) {
      throw new Error('LLMJudge requires at least one criterion');
    }

    this.provider = config.provider;
    this.model = config.model;
    this.criteria = config.criteria;
    this.systemPrompt = config.systemPrompt ?? this.getDefaultSystemPrompt();
    this.temperature = config.temperature ?? 0;
    this.maxRetries = config.maxRetries ?? 2;
  }

  async evaluate(input: EvaluationInput): Promise<JudgeResult> {
    const scores: Record<string, number> = {};
    const explanations: Record<string, string> = {};

    // Evaluate each criterion
    for (const criterion of this.criteria) {
      const result = await this.evaluateCriterion(criterion, input);
      scores[criterion.name] = result.score;
      explanations[criterion.name] = result.explanation;
    }

    // Calculate overall score (weighted average)
    const totalWeight = this.criteria.reduce(
      (sum, c) => sum + (c.weight ?? 1),
      0,
    );
    const weightedSum = this.criteria.reduce(
      (sum, c) => sum + scores[c.name] * (c.weight ?? 1),
      0,
    );
    const overallScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

    return {
      scores,
      explanations,
      overallScore,
      confidence: this.calculateConfidence(scores),
    };
  }

  /**
   * Evaluate a single criterion
   */
  private async evaluateCriterion(
    criterion: JudgeCriterion,
    input: EvaluationInput,
  ): Promise<{ score: number; explanation: string }> {
    const prompt = this.buildPrompt(criterion, input);

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.provider.complete({
          model: this.model,
          messages: [
            { role: 'system', content: this.systemPrompt },
            { role: 'user', content: prompt },
          ],
          temperature: this.temperature,
        });

        return this.parseResponse(response.content, criterion);
      } catch (error) {
        if (attempt === this.maxRetries) {
          return {
            score: 0,
            explanation: `Evaluation failed after ${this.maxRetries + 1} attempts: ${(error as Error).message}`,
          };
        }
        // Wait before retry
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * (attempt + 1)),
        );
      }
    }

    return { score: 0, explanation: 'Evaluation failed' };
  }

  /**
   * Build the evaluation prompt
   */
  private buildPrompt(
    criterion: JudgeCriterion,
    input: EvaluationInput,
  ): string {
    let prompt = criterion.prompt
      .replace('{input}', input.input)
      .replace('{output}', input.output);

    if (input.expectedOutput) {
      prompt = prompt.replace('{expected}', input.expectedOutput);
    }

    if (input.reference) {
      prompt = prompt.replace('{reference}', input.reference);
    }

    if (input.context) {
      prompt = prompt.replace('{context}', input.context.join('\n\n'));
    }

    return prompt;
  }

  /**
   * Parse LLM response to extract score
   */
  private parseResponse(
    response: string,
    criterion: JudgeCriterion,
  ): { score: number; explanation: string } {
    // Try to find score in common formats
    const scorePatterns = [
      /Score:\s*(\d+(?:\.\d+)?)/i,
      /Rating:\s*(\d+(?:\.\d+)?)/i,
      /(\d+(?:\.\d+)?)\s*\/\s*5/,
      /(\d+(?:\.\d+)?)\s*out\s+of\s+5/i,
    ];

    let rawScore: number | null = null;

    for (const pattern of scorePatterns) {
      const match = response.match(pattern);
      if (match) {
        rawScore = parseFloat(match[1]);
        break;
      }
    }

    if (rawScore === null) {
      // Try to find any number at the start
      const numMatch = response.match(/^(\d+(?:\.\d+)?)/);
      if (numMatch) {
        rawScore = parseFloat(numMatch[1]);
      }
    }

    // Normalize score to 0-1 range
    const range = criterion.scoreRange ?? { min: 1, max: 5 };
    let normalizedScore = 0.5; // Default

    if (rawScore !== null) {
      normalizedScore = (rawScore - range.min) / (range.max - range.min);
      normalizedScore = Math.max(0, Math.min(1, normalizedScore));
    }

    // Extract explanation (everything after the score)
    let explanation = response;
    const scoreIndex = response.search(/Score:|Rating:|\d+\s*\/\s*5/i);
    if (scoreIndex > 0) {
      explanation = response.substring(scoreIndex);
    }

    return { score: normalizedScore, explanation: explanation.trim() };
  }

  /**
   * Calculate confidence based on score consistency
   */
  private calculateConfidence(scores: Record<string, number>): number {
    const values = Object.values(scores);
    if (values.length <= 1) return 1;

    // Calculate standard deviation
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length;
    const std = Math.sqrt(variance);

    // Lower std means higher confidence
    return Math.max(0.5, 1 - std);
  }

  /**
   * Get default system prompt
   */
  private getDefaultSystemPrompt(): string {
    return `You are an expert evaluator for AI-generated responses. Your task is to objectively assess responses based on specific criteria.

Guidelines:
- Be consistent in your scoring
- Provide clear explanations for your ratings
- Focus on the specific criterion being evaluated
- Use the full range of the scoring scale
- Be fair and unbiased`;
  }

  /**
   * Add a new criterion
   */
  addCriterion(criterion: JudgeCriterion): void {
    this.criteria.push(criterion);
  }

  /**
   * Remove a criterion
   */
  removeCriterion(name: string): boolean {
    const index = this.criteria.findIndex((c) => c.name === name);
    if (index >= 0) {
      this.criteria.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get criteria
   */
  getCriteria(): JudgeCriterion[] {
    return [...this.criteria];
  }
}

/**
 * Create an LLM judge
 */
export function createLLMJudge(config: LLMJudgeConfig): LLMJudge {
  return new LLMJudge(config);
}
