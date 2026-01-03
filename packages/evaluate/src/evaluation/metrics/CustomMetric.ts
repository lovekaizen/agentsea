/**
 * CustomMetric
 *
 * Allows users to define custom evaluation metrics.
 */

import { BaseMetric } from './BaseMetric.js';
import type {
  MetricResult,
  EvaluationInput,
  CustomMetricConfig,
} from '../../types/index.js';

/**
 * Custom metric with user-defined evaluation function
 */
export class CustomMetric extends BaseMetric {
  readonly type = 'custom' as const;
  private evaluateFn: (input: EvaluationInput) => Promise<MetricResult>;

  constructor(config: CustomMetricConfig) {
    super(config);

    if (!config.evaluateFn) {
      throw new Error('Custom metric requires an evaluateFn');
    }

    this.evaluateFn = config.evaluateFn;
    this.initName(config);
  }

  async evaluate(input: EvaluationInput): Promise<MetricResult> {
    try {
      const result = await this.evaluateFn(input);

      // Ensure the result has the custom metric type
      return {
        ...result,
        metric: this.name,
      };
    } catch (error) {
      return this.createResult(
        0,
        `Custom metric evaluation failed: ${(error as Error).message}`,
        {
          error: (error as Error).message,
        },
      );
    }
  }
}

/**
 * Create a custom metric
 */
export function createCustomMetric(config: CustomMetricConfig): CustomMetric {
  return new CustomMetric(config);
}

/**
 * Helper to create a simple custom metric from a scoring function
 */
export function createSimpleMetric(
  name: string,
  scoreFn: (
    input: string,
    output: string,
    expected?: string,
  ) => number | Promise<number>,
  options?: { threshold?: number; weight?: number },
): CustomMetric {
  return new CustomMetric({
    name,
    threshold: options?.threshold,
    weight: options?.weight,
    evaluateFn: async (input) => {
      const score = await scoreFn(
        input.input,
        input.output,
        input.expectedOutput,
      );
      return {
        metric: name,
        score,
        explanation: `${name} score: ${(score * 100).toFixed(1)}%`,
      };
    },
  });
}

/**
 * Pre-built custom metrics
 */

/**
 * Length metric - checks if output is within expected length range
 */
export function createLengthMetric(options: {
  minLength?: number;
  maxLength?: number;
  targetLength?: number;
  tolerance?: number;
}): CustomMetric {
  return new CustomMetric({
    name: 'length',
    evaluateFn: (input) => {
      const length = input.output.length;

      if (options.targetLength !== undefined) {
        const tolerance = options.tolerance ?? 0.2;
        const diff =
          Math.abs(length - options.targetLength) / options.targetLength;
        const score = Math.max(0, 1 - diff / tolerance);
        return Promise.resolve({
          metric: 'length',
          score,
          explanation: `Output length: ${length}, target: ${options.targetLength}`,
          details: { length, target: options.targetLength, diff },
        });
      }

      const minOk =
        options.minLength === undefined || length >= options.minLength;
      const maxOk =
        options.maxLength === undefined || length <= options.maxLength;

      const score = minOk && maxOk ? 1 : 0;
      return Promise.resolve({
        metric: 'length',
        score,
        explanation:
          minOk && maxOk
            ? 'Output length is within acceptable range'
            : `Output length ${length} is outside range [${options.minLength ?? 0}, ${options.maxLength ?? 'inf'}]`,
        details: {
          length,
          minLength: options.minLength,
          maxLength: options.maxLength,
        },
      });
    },
  });
}

/**
 * Regex metric - checks if output matches a pattern
 */
export function createRegexMetric(options: {
  pattern: RegExp;
  name?: string;
  shouldMatch?: boolean;
}): CustomMetric {
  return new CustomMetric({
    name: options.name ?? 'regex',
    evaluateFn: (input) => {
      const matches = options.pattern.test(input.output);
      const shouldMatch = options.shouldMatch ?? true;
      const score = matches === shouldMatch ? 1 : 0;

      return Promise.resolve({
        metric: options.name ?? 'regex',
        score,
        explanation: shouldMatch
          ? matches
            ? 'Output matches expected pattern'
            : 'Output does not match expected pattern'
          : matches
            ? 'Output matches forbidden pattern'
            : 'Output correctly avoids forbidden pattern',
        details: { pattern: options.pattern.source, matches },
      });
    },
  });
}

/**
 * JSON validity metric - checks if output is valid JSON
 */
export function createJSONMetric(options?: {
  schema?: Record<string, unknown>;
}): CustomMetric {
  return new CustomMetric({
    name: 'json_validity',
    evaluateFn: (input) => {
      try {
        const parsed = JSON.parse(input.output);

        // If schema provided, validate structure (basic validation)
        if (options?.schema) {
          const schemaKeys = Object.keys(options.schema);
          const parsedKeys = Object.keys(parsed);
          const missingKeys = schemaKeys.filter((k) => !parsedKeys.includes(k));

          if (missingKeys.length > 0) {
            return Promise.resolve({
              metric: 'json_validity',
              score: 0.5,
              explanation: `Valid JSON but missing keys: ${missingKeys.join(', ')}`,
              details: { valid: true, missingKeys },
            });
          }
        }

        return Promise.resolve({
          metric: 'json_validity',
          score: 1,
          explanation: 'Output is valid JSON',
          details: { valid: true },
        });
      } catch (error) {
        return Promise.resolve({
          metric: 'json_validity',
          score: 0,
          explanation: `Invalid JSON: ${(error as Error).message}`,
          details: { valid: false, error: (error as Error).message },
        });
      }
    },
  });
}

/**
 * Contains metric - checks if output contains required phrases
 */
export function createContainsMetric(options: {
  required?: string[];
  forbidden?: string[];
  caseSensitive?: boolean;
}): CustomMetric {
  return new CustomMetric({
    name: 'contains',
    evaluateFn: (input) => {
      const output = options.caseSensitive
        ? input.output
        : input.output.toLowerCase();
      const missing: string[] = [];
      const foundForbidden: string[] = [];

      // Check required phrases
      if (options.required) {
        for (const phrase of options.required) {
          const searchPhrase = options.caseSensitive
            ? phrase
            : phrase.toLowerCase();
          if (!output.includes(searchPhrase)) {
            missing.push(phrase);
          }
        }
      }

      // Check forbidden phrases
      if (options.forbidden) {
        for (const phrase of options.forbidden) {
          const searchPhrase = options.caseSensitive
            ? phrase
            : phrase.toLowerCase();
          if (output.includes(searchPhrase)) {
            foundForbidden.push(phrase);
          }
        }
      }

      const requiredScore = options.required
        ? (options.required.length - missing.length) / options.required.length
        : 1;
      const forbiddenScore = options.forbidden
        ? (options.forbidden.length - foundForbidden.length) /
          options.forbidden.length
        : 1;

      const score = (requiredScore + forbiddenScore) / 2;

      return Promise.resolve({
        metric: 'contains',
        score,
        explanation:
          missing.length === 0 && foundForbidden.length === 0
            ? 'Output contains all required phrases and no forbidden phrases'
            : `Missing: [${missing.join(', ')}], Forbidden found: [${foundForbidden.join(', ')}]`,
        details: { missing, foundForbidden },
      });
    },
  });
}
