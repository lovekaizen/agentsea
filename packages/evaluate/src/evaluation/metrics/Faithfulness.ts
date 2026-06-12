/**
 * Faithfulness Metric
 *
 * Measures how faithful a RAG response is to the provided context.
 */

import { BaseMetric } from './BaseMetric.js';
import type {
  MetricResult,
  EvaluationInput,
  FaithfulnessMetricConfig,
  LLMProviderInterface,
} from '../../types/index.js';

/**
 * Faithfulness metric for RAG evaluation
 */
export class Faithfulness extends BaseMetric {
  readonly type = 'faithfulness' as const;
  private provider?: LLMProviderInterface;
  private model: string;

  constructor(config: FaithfulnessMetricConfig = {}) {
    super(config);
    this.model = config.model ?? 'claude-sonnet-4-6';
    this.initName(config);
  }

  /**
   * Set the LLM provider for evaluation
   */
  setProvider(provider: LLMProviderInterface): void {
    this.provider = provider;
  }

  async evaluate(input: EvaluationInput): Promise<MetricResult> {
    if (!input.context || input.context.length === 0) {
      return this.createResult(
        1,
        'No context provided, skipping faithfulness check',
        { skipped: true },
      );
    }

    // If no provider, use heuristic-based faithfulness
    if (!this.provider) {
      return this.evaluateHeuristic(input);
    }

    return this.evaluateWithLLM(input);
  }

  /**
   * Evaluate faithfulness using heuristics
   */
  private evaluateHeuristic(input: EvaluationInput): MetricResult {
    const context = input.context!.join(' ').toLowerCase();

    // Extract claims from output (sentences that state facts)
    const claims = this.extractClaims(input.output);

    if (claims.length === 0) {
      return this.createResult(1, 'No factual claims detected in output', {
        method: 'heuristic',
        claimsChecked: 0,
      });
    }

    // Check each claim against context
    let supportedClaims = 0;
    const claimResults: Array<{ claim: string; supported: boolean }> = [];

    for (const claim of claims) {
      const supported = this.checkClaimSupport(claim, context);
      if (supported) {
        supportedClaims++;
      }
      claimResults.push({ claim, supported });
    }

    const score = supportedClaims / claims.length;

    return this.createResult(
      score,
      `${supportedClaims}/${claims.length} claims supported by context`,
      {
        method: 'heuristic',
        claimsChecked: claims.length,
        supportedClaims,
        claimResults,
      },
    );
  }

  /**
   * Evaluate faithfulness using LLM
   */
  private async evaluateWithLLM(input: EvaluationInput): Promise<MetricResult> {
    const contextStr = input
      .context!.map((c, i) => `[${i + 1}] ${c}`)
      .join('\n\n');

    const prompt = `You are evaluating the faithfulness of an AI response to the provided context.

Context:
${contextStr}

Response to evaluate:
${input.output}

Evaluate whether the response is faithful to the context:
1. Are all claims in the response supported by the context?
2. Does the response introduce any information not in the context?
3. Does the response contradict any information in the context?

Rate the faithfulness on a scale of 1-5 where:
1 = Response contains multiple unsupported or contradictory claims
2 = Response contains some unsupported claims
3 = Response is mostly faithful with minor unsupported details
4 = Response is faithful with only trivial additions
5 = Response is completely faithful to the context

Provide your rating as "Score: X" followed by a brief explanation.`;

    try {
      const response = await this.provider!.complete({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
      });

      // Parse score from response
      const scoreMatch = response.content.match(/Score:\s*(\d+(?:\.\d+)?)/i);
      const score = scoreMatch ? parseFloat(scoreMatch[1]) / 5 : 0.5;

      return this.createResult(score, response.content, {
        method: 'llm',
        model: this.model,
      });
    } catch (error) {
      // Fall back to heuristic on error
      const result = this.evaluateHeuristic(input);
      return {
        ...result,
        details: {
          ...result.details,
          llmError: (error as Error).message,
        },
      };
    }
  }

  /**
   * Extract factual claims from text
   */
  private extractClaims(text: string): string[] {
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 10);

    // Filter to sentences that look like factual claims
    return sentences.filter((sentence) => {
      const lower = sentence.toLowerCase();
      // Skip questions
      if (lower.includes('?')) return false;
      // Skip opinions/hedged statements
      if (
        /\b(i think|i believe|maybe|perhaps|possibly|might|could be)\b/.test(
          lower,
        )
      ) {
        return false;
      }
      // Skip meta statements
      if (/\b(as mentioned|according to|based on)\b/.test(lower)) {
        return false;
      }
      return true;
    });
  }

  /**
   * Check if a claim is supported by context
   */
  private checkClaimSupport(claim: string, context: string): boolean {
    // Extract key phrases from claim
    const claimWords = claim
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3);

    if (claimWords.length === 0) return true;

    // Check for significant overlap with context
    let matchedWords = 0;
    for (const word of claimWords) {
      if (context.includes(word)) {
        matchedWords++;
      }
    }

    // Require at least 50% of key words to be in context
    const overlapRatio = matchedWords / claimWords.length;
    return overlapRatio >= 0.5;
  }
}

/**
 * Create a faithfulness metric
 */
export function createFaithfulnessMetric(
  config?: FaithfulnessMetricConfig,
): Faithfulness {
  return new Faithfulness(config);
}
