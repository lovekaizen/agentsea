/**
 * ContextRelevance Metric
 *
 * Measures how relevant the retrieved context is to the input question (for RAG).
 */

import { BaseMetric } from './BaseMetric.js';
import type {
  MetricResult,
  EvaluationInput,
  ContextRelevanceMetricConfig,
  LLMProviderInterface,
} from '../../types/index.js';

/**
 * Context relevance metric for RAG evaluation
 */
export class ContextRelevance extends BaseMetric {
  readonly type = 'context_relevance' as const;
  private provider?: LLMProviderInterface;
  private model: string;
  private minRelevantChunks: number;

  constructor(config: ContextRelevanceMetricConfig = {}) {
    super(config);
    this.model = config.model ?? 'claude-sonnet-4-6';
    this.minRelevantChunks = config.minRelevantChunks ?? 1;
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
      return this.createResult(0, 'No context provided for relevance check', {
        skipped: true,
        reason: 'no_context',
      });
    }

    // If no provider, use heuristic-based relevance
    if (!this.provider) {
      return this.evaluateHeuristic(input);
    }

    return this.evaluateWithLLM(input);
  }

  /**
   * Evaluate context relevance using heuristics
   */
  private evaluateHeuristic(input: EvaluationInput): MetricResult {
    const questionKeywords = this.extractKeywords(input.input);

    if (questionKeywords.length === 0) {
      return this.createResult(1, 'No keywords to match in question', {
        method: 'heuristic',
      });
    }

    const chunkScores: Array<{
      index: number;
      score: number;
      matchedKeywords: string[];
    }> = [];

    for (let i = 0; i < input.context!.length; i++) {
      const chunk = input.context![i].toLowerCase();
      const matchedKeywords: string[] = [];

      for (const keyword of questionKeywords) {
        if (chunk.includes(keyword)) {
          matchedKeywords.push(keyword);
        }
      }

      const score = matchedKeywords.length / questionKeywords.length;
      chunkScores.push({ index: i, score, matchedKeywords });
    }

    // Sort by relevance
    chunkScores.sort((a, b) => b.score - a.score);

    // Calculate overall score
    const relevantChunks = chunkScores.filter((c) => c.score >= 0.3);
    const avgRelevance =
      chunkScores.length > 0
        ? chunkScores.reduce((sum, c) => sum + c.score, 0) / chunkScores.length
        : 0;

    // Boost score if we have enough relevant chunks
    const coverageBonus =
      relevantChunks.length >= this.minRelevantChunks ? 0.1 : 0;
    const finalScore = Math.min(1, avgRelevance + coverageBonus);

    return this.createResult(
      finalScore,
      `${relevantChunks.length}/${input.context!.length} chunks are relevant`,
      {
        method: 'heuristic',
        chunkScores,
        relevantChunkCount: relevantChunks.length,
        avgRelevance,
      },
    );
  }

  /**
   * Evaluate context relevance using LLM
   */
  private async evaluateWithLLM(input: EvaluationInput): Promise<MetricResult> {
    const chunkResults: Array<{
      index: number;
      score: number;
      explanation: string;
    }> = [];

    // Evaluate each chunk individually
    for (let i = 0; i < input.context!.length; i++) {
      const chunk = input.context![i];

      const prompt = `Evaluate how relevant this context chunk is to answering the question.

Question: ${input.input}

Context chunk:
${chunk}

Rate the relevance on a scale of 1-5 where:
1 = Completely irrelevant
2 = Mostly irrelevant with tangential connection
3 = Somewhat relevant but not directly useful
4 = Mostly relevant and useful
5 = Highly relevant and directly answers the question

Provide only your rating as "Score: X" with a one-line explanation.`;

      try {
        const response = await this.provider!.complete({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0,
        });

        const scoreMatch = response.content.match(/Score:\s*(\d+(?:\.\d+)?)/i);
        const score = scoreMatch ? parseFloat(scoreMatch[1]) / 5 : 0.5;

        chunkResults.push({
          index: i,
          score,
          explanation: response.content,
        });
      } catch {
        // Fall back to heuristic for this chunk
        const keywords = this.extractKeywords(input.input);
        const chunkLower = chunk.toLowerCase();
        const matches = keywords.filter((k) => chunkLower.includes(k)).length;
        const score = keywords.length > 0 ? matches / keywords.length : 0.5;

        chunkResults.push({
          index: i,
          score,
          explanation: 'Evaluated using heuristic fallback',
        });
      }
    }

    // Calculate overall score
    const avgScore =
      chunkResults.length > 0
        ? chunkResults.reduce((sum, r) => sum + r.score, 0) /
          chunkResults.length
        : 0;

    const relevantCount = chunkResults.filter((r) => r.score >= 0.6).length;

    return this.createResult(
      avgScore,
      `Average relevance: ${(avgScore * 100).toFixed(1)}%, ${relevantCount}/${chunkResults.length} chunks relevant`,
      {
        method: 'llm',
        model: this.model,
        chunkResults,
        relevantChunkCount: relevantCount,
      },
    );
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      'a',
      'an',
      'the',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'must',
      'to',
      'of',
      'in',
      'for',
      'on',
      'with',
      'at',
      'by',
      'from',
      'as',
      'and',
      'but',
      'if',
      'or',
      'not',
      'what',
      'which',
      'who',
      'whom',
      'this',
      'that',
      'these',
      'those',
      'i',
      'me',
      'my',
      'we',
      'you',
      'your',
      'it',
      'its',
      'how',
      'why',
      'when',
      'where',
      'can',
      'please',
      'tell',
      'me',
      'about',
    ]);

    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word));
  }
}

/**
 * Create a context relevance metric
 */
export function createContextRelevanceMetric(
  config?: ContextRelevanceMetricConfig,
): ContextRelevance {
  return new ContextRelevance(config);
}
