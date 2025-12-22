/**
 * Relevance Metric
 *
 * Measures how relevant the output is to the input question.
 */

import { BaseMetric } from './BaseMetric.js';
import type {
  MetricResult,
  EvaluationInput,
  RelevanceMetricConfig,
  LLMProviderInterface,
} from '../../types/index.js';

/**
 * Relevance metric
 */
export class Relevance extends BaseMetric {
  readonly type = 'relevance' as const;
  private provider?: LLMProviderInterface;
  private model: string;
  private prompt?: string;

  constructor(config: RelevanceMetricConfig = {}) {
    super(config);
    this.model = config.model ?? 'claude-sonnet-4-20250514';
    this.prompt = config.prompt;
    this.initName(config);
  }

  /**
   * Set the LLM provider for evaluation
   */
  setProvider(provider: LLMProviderInterface): void {
    this.provider = provider;
  }

  async evaluate(input: EvaluationInput): Promise<MetricResult> {
    // If no provider, use heuristic-based relevance
    if (!this.provider) {
      return this.evaluateHeuristic(input);
    }

    return this.evaluateWithLLM(input);
  }

  /**
   * Evaluate relevance using heuristics
   */
  private evaluateHeuristic(input: EvaluationInput): MetricResult {
    const questionWords = this.extractKeywords(input.input);
    const answerWords = this.extractKeywords(input.output);

    if (questionWords.length === 0) {
      return this.createResult(1, 'No keywords in input to match', {
        method: 'heuristic',
      });
    }

    // Calculate keyword overlap
    let matches = 0;
    for (const word of questionWords) {
      if (answerWords.some((aw) => aw.includes(word) || word.includes(aw))) {
        matches++;
      }
    }

    const keywordOverlap = matches / questionWords.length;

    // Check if answer addresses the question type
    const questionType = this.detectQuestionType(input.input);
    const typeRelevance = this.checkAnswerType(input.output, questionType);

    // Combined score
    const score = keywordOverlap * 0.6 + typeRelevance * 0.4;

    return this.createResult(
      score,
      `Keyword overlap: ${(keywordOverlap * 100).toFixed(1)}%, Type relevance: ${(typeRelevance * 100).toFixed(1)}%`,
      {
        method: 'heuristic',
        keywordOverlap,
        typeRelevance,
        questionType,
      },
    );
  }

  /**
   * Evaluate relevance using LLM
   */
  private async evaluateWithLLM(input: EvaluationInput): Promise<MetricResult> {
    const prompt = this.prompt ?? this.getDefaultPrompt();

    const messages = [
      {
        role: 'user',
        content: prompt
          .replace('{input}', input.input)
          .replace('{output}', input.output),
      },
    ];

    try {
      const response = await this.provider!.complete({
        model: this.model,
        messages,
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
   * Get default evaluation prompt
   */
  private getDefaultPrompt(): string {
    return `Evaluate how relevant this response is to the question.

Question: {input}
Response: {output}

Rate the relevance on a scale of 1-5 where:
1 = Completely irrelevant
2 = Mostly irrelevant with some related content
3 = Somewhat relevant but misses key points
4 = Mostly relevant with minor gaps
5 = Completely relevant and addresses the question

Provide your rating as "Score: X" followed by a brief explanation.`;
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
      'shall',
      'can',
      'need',
      'dare',
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
      'into',
      'through',
      'during',
      'before',
      'after',
      'above',
      'below',
      'between',
      'under',
      'again',
      'further',
      'then',
      'once',
      'here',
      'there',
      'when',
      'where',
      'why',
      'how',
      'all',
      'each',
      'few',
      'more',
      'most',
      'other',
      'some',
      'such',
      'no',
      'nor',
      'not',
      'only',
      'own',
      'same',
      'so',
      'than',
      'too',
      'very',
      'just',
      'and',
      'but',
      'if',
      'or',
      'because',
      'until',
      'while',
      'it',
      'this',
      'that',
      'these',
      'those',
      'i',
      'me',
      'my',
      'we',
      'you',
      'what',
      'which',
      'who',
      'whom',
      'please',
      'thank',
      'thanks',
    ]);

    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word));
  }

  /**
   * Detect question type
   */
  private detectQuestionType(
    question: string,
  ): 'what' | 'how' | 'why' | 'when' | 'where' | 'who' | 'yes_no' | 'other' {
    const lower = question.toLowerCase();
    if (lower.startsWith('what') || lower.includes('what ')) return 'what';
    if (lower.startsWith('how') || lower.includes('how ')) return 'how';
    if (lower.startsWith('why') || lower.includes('why ')) return 'why';
    if (lower.startsWith('when') || lower.includes('when ')) return 'when';
    if (lower.startsWith('where') || lower.includes('where ')) return 'where';
    if (lower.startsWith('who') || lower.includes('who ')) return 'who';
    if (
      lower.startsWith('is ') ||
      lower.startsWith('are ') ||
      lower.startsWith('do ') ||
      lower.startsWith('does ') ||
      lower.startsWith('can ') ||
      lower.startsWith('will ')
    ) {
      return 'yes_no';
    }
    return 'other';
  }

  /**
   * Check if answer type matches question type
   */
  private checkAnswerType(answer: string, questionType: string): number {
    const lower = answer.toLowerCase();

    switch (questionType) {
      case 'yes_no':
        if (lower.includes('yes') || lower.includes('no')) return 1;
        return 0.5;
      case 'how':
        if (
          lower.includes('by ') ||
          lower.includes('using ') ||
          lower.includes('step')
        )
          return 1;
        return 0.6;
      case 'why':
        if (
          lower.includes('because') ||
          lower.includes('since') ||
          lower.includes('reason')
        )
          return 1;
        return 0.6;
      case 'when':
        if (
          /\d{4}|\d{1,2}\/\d{1,2}|today|yesterday|tomorrow|year|month|day/.test(
            lower,
          )
        )
          return 1;
        return 0.6;
      case 'where':
        if (/at |in |on |located|place|location/.test(lower)) return 1;
        return 0.6;
      case 'who':
        if (/[A-Z][a-z]+\s+[A-Z][a-z]+/.test(answer)) return 1;
        return 0.6;
      default:
        return 0.7;
    }
  }
}

/**
 * Create a relevance metric
 */
export function createRelevanceMetric(
  config?: RelevanceMetricConfig,
): Relevance {
  return new Relevance(config);
}
