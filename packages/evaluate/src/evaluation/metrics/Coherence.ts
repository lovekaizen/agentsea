/**
 * Coherence Metric
 *
 * Measures the logical coherence and consistency of the output.
 */

import { BaseMetric } from './BaseMetric.js';
import type {
  MetricResult,
  EvaluationInput,
  CoherenceMetricConfig,
} from '../../types/index.js';

/**
 * Coherence metric
 */
export class Coherence extends BaseMetric {
  readonly type = 'coherence' as const;
  private checkLogicalFlow: boolean;
  private checkConsistency: boolean;

  constructor(config: CoherenceMetricConfig = {}) {
    super(config);
    this.checkLogicalFlow = config.checkLogicalFlow ?? true;
    this.checkConsistency = config.checkConsistency ?? true;
    this.initName(config);
  }

  async evaluate(input: EvaluationInput): Promise<MetricResult> {
    const scores: number[] = [];
    const details: Record<string, number> = {};

    // Check structural coherence
    const structuralScore = this.checkStructure(input.output);
    scores.push(structuralScore);
    details.structural = structuralScore;

    // Check logical flow
    if (this.checkLogicalFlow) {
      const flowScore = this.checkFlow(input.output);
      scores.push(flowScore);
      details.logicalFlow = flowScore;
    }

    // Check consistency
    if (this.checkConsistency) {
      const consistencyScore = this.checkInternalConsistency(input.output);
      scores.push(consistencyScore);
      details.consistency = consistencyScore;
    }

    // Check completeness
    const completenessScore = this.checkCompleteness(input.output);
    scores.push(completenessScore);
    details.completeness = completenessScore;

    const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    return Promise.resolve(
      this.createResult(
        averageScore,
        this.generateExplanation(details),
        details,
      ),
    );
  }

  /**
   * Check structural coherence
   */
  private checkStructure(text: string): number {
    let score = 1;

    // Check for complete sentences
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    if (sentences.length === 0) {
      return 0.3;
    }

    // Check for proper sentence structure
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      // Sentence should start with capital or be a list item
      if (!/^[A-Z\d\-*•]/.test(trimmed) && trimmed.length > 0) {
        score -= 0.1;
      }
    }

    // Check for dangling content
    if (text.endsWith(',') || text.endsWith(':') || text.endsWith(';')) {
      score -= 0.2;
    }

    // Check for balanced parentheses/brackets
    const openParens = (text.match(/\(/g) || []).length;
    const closeParens = (text.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      score -= 0.2;
    }

    return Math.max(0, score);
  }

  /**
   * Check logical flow
   */
  private checkFlow(text: string): number {
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    if (sentences.length <= 1) {
      return 1; // Single sentence is always coherent
    }

    let score = 1;

    // Check for transition words (good flow)
    const transitionWords = [
      'however',
      'therefore',
      'moreover',
      'furthermore',
      'additionally',
      'first',
      'second',
      'third',
      'finally',
      'then',
      'next',
      'also',
      'because',
      'since',
      'although',
      'while',
      'whereas',
      'consequently',
      'as a result',
      'in addition',
      'on the other hand',
      'in conclusion',
    ];

    const hasTransitions = transitionWords.some((tw) =>
      text.toLowerCase().includes(tw),
    );

    if (sentences.length > 3 && !hasTransitions) {
      score -= 0.15; // Long text without transitions
    }

    // Check for abrupt topic changes (rough heuristic)
    for (let i = 1; i < sentences.length; i++) {
      const prevWords = new Set(
        sentences[i - 1]
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 3),
      );
      const currWords = sentences[i]
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3);

      const overlap = currWords.filter((w) => prevWords.has(w)).length;
      if (currWords.length > 5 && overlap === 0) {
        score -= 0.05; // No word overlap might indicate topic jump
      }
    }

    return Math.max(0, score);
  }

  /**
   * Check internal consistency
   */
  private checkInternalConsistency(text: string): number {
    let score = 1;

    // Check for contradictory patterns
    const contradictions = [
      [/\bis\b.*\bis not\b/i, /\bis not\b.*\bis\b/i],
      [/\byes\b/i, /\bno\b/i],
      [/\balways\b/i, /\bnever\b/i],
      [/\bcan\b/i, /\bcannot\b/i],
      [/\bcorrect\b.*\bnot correct\b/i, /\bnot correct\b.*\bcorrect\b/i],
    ];

    for (const [pattern1, pattern2] of contradictions) {
      if (pattern1.test(text) || pattern2.test(text)) {
        // Contradictory terms present - might be explaining nuance or actual contradiction
        score -= 0.1;
      }
    }

    // Check for repeated information (might indicate incoherence)
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const normalizedSentences = sentences.map((s) =>
      s.toLowerCase().replace(/\s+/g, ' ').trim(),
    );

    const uniqueSentences = new Set(normalizedSentences);
    if (uniqueSentences.size < sentences.length) {
      const repetitionRatio = 1 - uniqueSentences.size / sentences.length;
      score -= repetitionRatio * 0.3;
    }

    return Math.max(0, score);
  }

  /**
   * Check completeness
   */
  private checkCompleteness(text: string): number {
    // Check if response seems truncated
    const trimmed = text.trim();

    if (trimmed.length === 0) {
      return 0;
    }

    // Ends mid-sentence indicators
    const incompleteEndings = [
      ',',
      ':',
      ';',
      ' and',
      ' or',
      ' but',
      ' the',
      ' a',
      ' an',
      ' is',
      ' are',
      ' was',
      ' were',
      ' be',
      ' been',
      ' have',
      ' has',
      ' had',
      ' will',
      ' would',
      ' should',
      ' could',
    ];
    for (const ending of incompleteEndings) {
      if (trimmed.endsWith(ending)) {
        return 0.5;
      }
    }

    // Check for ellipsis at end (might indicate intentional or truncation)
    if (trimmed.endsWith('...')) {
      return 0.7;
    }

    return 1;
  }

  /**
   * Generate explanation from scores
   */
  private generateExplanation(details: Record<string, number>): string {
    const issues: string[] = [];

    if (details.structural < 0.7) {
      issues.push('structural issues detected');
    }
    if (details.logicalFlow !== undefined && details.logicalFlow < 0.7) {
      issues.push('logical flow could be improved');
    }
    if (details.consistency !== undefined && details.consistency < 0.7) {
      issues.push('some inconsistencies found');
    }
    if (details.completeness < 0.7) {
      issues.push('response may be incomplete');
    }

    if (issues.length === 0) {
      return 'Response is coherent and well-structured';
    }

    return `Issues: ${issues.join(', ')}`;
  }
}

/**
 * Create a coherence metric
 */
export function createCoherenceMetric(
  config?: CoherenceMetricConfig,
): Coherence {
  return new Coherence(config);
}
