/**
 * Accuracy Metric
 *
 * Measures how accurately the output matches the expected output.
 */

import { BaseMetric } from './BaseMetric.js';
import type {
  MetricResult,
  EvaluationInput,
  AccuracyMetricConfig,
} from '../../types/index.js';

/**
 * Accuracy metric
 */
export class Accuracy extends BaseMetric {
  readonly type = 'accuracy' as const;
  private matchType: 'exact' | 'fuzzy' | 'semantic';
  private caseSensitive: boolean;
  private ignoreWhitespace: boolean;

  constructor(config: AccuracyMetricConfig = { type: 'fuzzy' }) {
    super(config);
    this.matchType = config.type ?? 'fuzzy';
    this.caseSensitive = config.caseSensitive ?? false;
    this.ignoreWhitespace = config.ignoreWhitespace ?? true;
    this.initName(config);
  }

  async evaluate(input: EvaluationInput): Promise<MetricResult> {
    if (!input.expectedOutput) {
      return this.createResult(
        1,
        'No expected output provided, skipping accuracy check',
        { skipped: true },
      );
    }

    const output = this.preprocess(input.output);
    const expected = this.preprocess(input.expectedOutput);

    let score: number;
    let explanation: string;

    switch (this.matchType) {
      case 'exact':
        score = output === expected ? 1 : 0;
        explanation =
          score === 1
            ? 'Output exactly matches expected output'
            : 'Output does not match expected output';
        break;

      case 'fuzzy':
        score = this.calculateFuzzySimilarity(output, expected);
        explanation = `Fuzzy similarity: ${(score * 100).toFixed(1)}%`;
        break;

      case 'semantic':
        // Semantic matching would require embeddings - fall back to fuzzy for now
        score = this.calculateFuzzySimilarity(output, expected);
        explanation = `Semantic similarity (approximated): ${(score * 100).toFixed(1)}%`;
        break;

      default:
        score = 0;
        explanation = 'Unknown match type';
    }

    return Promise.resolve(
      this.createResult(score, explanation, {
        matchType: this.matchType,
        outputLength: output.length,
        expectedLength: expected.length,
      }),
    );
  }

  /**
   * Preprocess text for comparison
   */
  private preprocess(text: string): string {
    let processed = text;

    if (!this.caseSensitive) {
      processed = processed.toLowerCase();
    }

    if (this.ignoreWhitespace) {
      processed = processed.replace(/\s+/g, ' ').trim();
    }

    return processed;
  }

  /**
   * Calculate fuzzy similarity using Levenshtein distance
   */
  private calculateFuzzySimilarity(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length === 0 || b.length === 0) return 0;

    // Levenshtein distance
    const matrix: number[][] = [];

    for (let i = 0; i <= a.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= b.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost,
        );
      }
    }

    const maxLen = Math.max(a.length, b.length);
    return 1 - matrix[a.length][b.length] / maxLen;
  }
}

/**
 * Create an accuracy metric
 */
export function createAccuracyMetric(config?: AccuracyMetricConfig): Accuracy {
  return new Accuracy(config);
}
