/**
 * MultiCriteriaCollector
 *
 * Multi-dimensional feedback collector.
 */

import { BaseCollector } from './BaseCollector.js';
import type {
  MultiCriteriaFeedback,
  MultiCriteriaCollectorOptions,
  CollectMultiCriteriaInput,
  CriterionDefinition,
  CriterionRating,
} from '../../types/index.js';

/**
 * Multi-criteria feedback collector
 */
export class MultiCriteriaCollector extends BaseCollector<
  CollectMultiCriteriaInput,
  MultiCriteriaFeedback
> {
  private criteria: CriterionDefinition[];
  private requireAllCriteria: boolean;
  private allowCorrections: boolean;

  constructor(options: MultiCriteriaCollectorOptions) {
    super(options);

    if (!options.criteria || options.criteria.length === 0) {
      throw new Error('At least one criterion is required');
    }

    this.criteria = options.criteria;
    this.requireAllCriteria = options.requireAllCriteria ?? true;
    this.allowCorrections = options.allowCorrections ?? true;
  }

  protected validate(input: CollectMultiCriteriaInput): void {
    // Validate required fields
    if (!input.responseId) {
      throw new Error('responseId is required');
    }
    if (!input.input) {
      throw new Error('input is required');
    }
    if (!input.output) {
      throw new Error('output is required');
    }
    if (!input.ratings || Object.keys(input.ratings).length === 0) {
      throw new Error('ratings is required');
    }

    // Validate criteria ratings
    const providedCriteria = Object.keys(input.ratings);
    const definedCriteria = this.criteria.map((c) => c.name);

    // Check for unknown criteria
    for (const name of providedCriteria) {
      if (!definedCriteria.includes(name)) {
        throw new Error(`Unknown criterion: ${name}`);
      }
    }

    // Check for missing criteria
    if (this.requireAllCriteria) {
      for (const name of definedCriteria) {
        if (!(name in input.ratings)) {
          throw new Error(`Missing required criterion: ${name}`);
        }
      }
    }

    // Validate rating values
    for (const [name, rating] of Object.entries(input.ratings)) {
      const criterion = this.criteria.find((c) => c.name === name);
      if (criterion) {
        const [min, max] = criterion.scale;
        if (rating < min || rating > max) {
          throw new Error(
            `Rating for ${name} must be between ${min} and ${max}`,
          );
        }
      }
    }

    // Validate overall rating
    if (input.overallRating !== undefined) {
      if (
        !Number.isInteger(input.overallRating) ||
        input.overallRating < 1 ||
        input.overallRating > 5
      ) {
        throw new Error('overallRating must be an integer between 1 and 5');
      }
    }
  }

  protected transform(input: CollectMultiCriteriaInput): MultiCriteriaFeedback {
    const criteriaRatings: CriterionRating[] = [];

    for (const [name, rating] of Object.entries(input.ratings)) {
      const criterionRating: CriterionRating = { name, rating };

      if (this.allowCorrections && input.corrections?.[name]) {
        criterionRating.correction = input.corrections[name];
      }

      criteriaRatings.push(criterionRating);
    }

    return {
      id: this.generateId(),
      type: 'multi_criteria',
      responseId: input.responseId,
      conversationId: input.conversationId,
      input: input.input,
      output: input.output,
      criteria: criteriaRatings,
      overallRating: input.overallRating,
      comment: input.comment,
      userId: input.userId,
      timestamp: this.autoTimestamp ? Date.now() : 0,
      metadata: input.metadata,
    };
  }

  /**
   * Get criterion definitions
   */
  getCriteria(): CriterionDefinition[] {
    return [...this.criteria];
  }

  /**
   * Add a criterion
   */
  addCriterion(criterion: CriterionDefinition): void {
    if (this.criteria.some((c) => c.name === criterion.name)) {
      throw new Error(`Criterion ${criterion.name} already exists`);
    }
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
}

/**
 * Create a multi-criteria collector
 */
export function createMultiCriteriaCollector(
  options: MultiCriteriaCollectorOptions,
): MultiCriteriaCollector {
  return new MultiCriteriaCollector(options);
}
