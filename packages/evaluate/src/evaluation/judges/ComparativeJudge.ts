/**
 * ComparativeJudge
 *
 * A/B comparison evaluation between two responses.
 */

import type {
  JudgeInterface,
  JudgeResult,
  EvaluationInput,
  ComparativeJudgeConfig,
  ComparisonInput,
  ComparisonResult,
  LLMProviderInterface,
} from '../../types/index.js';

/**
 * Comparative judge for A/B evaluation
 */
export class ComparativeJudge implements JudgeInterface {
  readonly type = 'comparative' as const;

  private provider: LLMProviderInterface;
  private model: string;
  private criteria: string[];
  private tieBreaker?: string;
  private temperature: number;

  constructor(config: ComparativeJudgeConfig) {
    if (!config.provider) {
      throw new Error('ComparativeJudge requires a provider');
    }
    if (!config.criteria || config.criteria.length === 0) {
      throw new Error('ComparativeJudge requires at least one criterion');
    }

    this.provider = config.provider;
    this.model = config.model ?? 'claude-sonnet-4-6';
    this.criteria = config.criteria;
    this.tieBreaker = config.tieBreaker;
    this.temperature = config.temperature ?? 0;
  }

  /**
   * Evaluate using standard input (compares output to expected)
   */
  async evaluate(input: EvaluationInput): Promise<JudgeResult> {
    if (!input.expectedOutput) {
      return {
        scores: {},
        explanations: { error: 'No expected output to compare against' },
        overallScore: 0,
      };
    }

    // Compare output to expected output
    const comparison = await this.compare({
      input: input.input,
      responseA: input.output,
      responseB: input.expectedOutput,
      context: input.context,
    });

    // Convert comparison result to judge result
    const score =
      comparison.winner === 'A' ? 1 : comparison.winner === 'B' ? 0 : 0.5;

    return {
      scores: { comparison: score },
      explanations: { comparison: comparison.reasoning },
      overallScore: score,
      metadata: {
        winner: comparison.winner,
        criteriaScores: comparison.criteriaScores,
        confidence: comparison.confidence,
      },
    };
  }

  /**
   * Compare two responses
   */
  async compare(input: ComparisonInput): Promise<ComparisonResult> {
    const prompt = this.buildComparisonPrompt(input);

    try {
      const response = await this.provider.complete({
        model: this.model,
        messages: [
          { role: 'system', content: this.getSystemPrompt() },
          { role: 'user', content: prompt },
        ],
        temperature: this.temperature,
      });

      return this.parseComparisonResponse(response.content);
    } catch (error) {
      return {
        winner: 'tie',
        reasoning: `Comparison failed: ${(error as Error).message}`,
        confidence: 0,
      };
    }
  }

  /**
   * Build comparison prompt
   */
  private buildComparisonPrompt(input: ComparisonInput): string {
    const criteriaList = this.criteria
      .map((c, i) => `${i + 1}. ${c}`)
      .join('\n');

    return `Compare these two responses and determine which is better.

Question/Input: ${input.input}

${input.context ? `Context:\n${input.context.join('\n')}\n\n` : ''}

Response A:
${input.responseA}

Response B:
${input.responseB}

Evaluate both responses on the following criteria:
${criteriaList}

For each criterion, indicate which response is better (A, B, or tie).
Then provide an overall winner.

${this.tieBreaker ? `In case of an overall tie, use "${this.tieBreaker}" as the tie-breaker criterion.` : ''}

Format your response as:
Criterion 1: [A/B/tie] - [brief reason]
Criterion 2: [A/B/tie] - [brief reason]
...
Overall Winner: [A/B/tie]
Reasoning: [explanation]
Confidence: [high/medium/low]`;
  }

  /**
   * Get system prompt
   */
  private getSystemPrompt(): string {
    return `You are an expert at comparing AI-generated responses.
Be objective and fair in your comparisons.
Consider all provided criteria carefully.
Provide clear reasoning for your choices.`;
  }

  /**
   * Parse comparison response
   */
  private parseComparisonResponse(response: string): ComparisonResult {
    const criteriaScores: Record<string, { A: number; B: number }> = {};

    // Parse per-criterion scores
    for (const criterion of this.criteria) {
      const pattern = new RegExp(`${criterion}[^:]*:\\s*(A|B|tie)`, 'i');
      const match = response.match(pattern);
      if (match) {
        const winner = match[1].toUpperCase();
        criteriaScores[criterion] = {
          A: winner === 'A' ? 1 : winner === 'TIE' ? 0.5 : 0,
          B: winner === 'B' ? 1 : winner === 'TIE' ? 0.5 : 0,
        };
      }
    }

    // Parse overall winner
    const winnerMatch = response.match(/Overall\s*Winner:\s*(A|B|tie)/i);
    let winner: 'A' | 'B' | 'tie' = 'tie';
    if (winnerMatch) {
      const w = winnerMatch[1].toUpperCase();
      winner = w === 'A' ? 'A' : w === 'B' ? 'B' : 'tie';
    }

    // Parse confidence
    const confMatch = response.match(/Confidence:\s*(high|medium|low)/i);
    let confidence = 0.5;
    if (confMatch) {
      const conf = confMatch[1].toLowerCase();
      confidence = conf === 'high' ? 0.9 : conf === 'medium' ? 0.7 : 0.5;
    }

    // Extract reasoning
    const reasoningMatch = response.match(
      /Reasoning:\s*(.+?)(?=Confidence:|$)/is,
    );
    const reasoning = reasoningMatch ? reasoningMatch[1].trim() : response;

    return {
      winner,
      reasoning,
      criteriaScores:
        Object.keys(criteriaScores).length > 0 ? criteriaScores : undefined,
      confidence,
    };
  }

  /**
   * Get criteria
   */
  getCriteria(): string[] {
    return [...this.criteria];
  }

  /**
   * Set criteria
   */
  setCriteria(criteria: string[]): void {
    if (criteria.length === 0) {
      throw new Error('At least one criterion is required');
    }
    this.criteria = criteria;
  }
}

/**
 * Create a comparative judge
 */
export function createComparativeJudge(
  config: ComparativeJudgeConfig,
): ComparativeJudge {
  return new ComparativeJudge(config);
}
