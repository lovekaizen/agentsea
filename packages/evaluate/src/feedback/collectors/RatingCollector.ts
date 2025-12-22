/**
 * RatingCollector
 *
 * Star rating (1-5) feedback collector.
 */

import { BaseCollector } from './BaseCollector.js';
import type {
  RatingFeedback,
  RatingCollectorOptions,
  CollectRatingInput,
  StarRating,
} from '../../types/index.js';

/**
 * Star rating feedback collector
 */
export class RatingCollector extends BaseCollector<
  CollectRatingInput,
  RatingFeedback
> {
  private allowComment: boolean;
  private minRating: StarRating;
  private maxRating: StarRating;

  constructor(options: RatingCollectorOptions = {}) {
    super(options);
    this.allowComment = options.allowComment ?? true;
    this.minRating = options.minRating ?? 1;
    this.maxRating = options.maxRating ?? 5;
  }

  protected validate(input: CollectRatingInput): void {
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
    if (!input.feedback) {
      throw new Error('feedback is required');
    }

    const rating = input.feedback.rating;
    if (
      typeof rating !== 'number' ||
      rating < 1 ||
      rating > 5 ||
      !Number.isInteger(rating)
    ) {
      throw new Error('feedback.rating must be an integer between 1 and 5');
    }
    if (rating < this.minRating || rating > this.maxRating) {
      throw new Error(
        `feedback.rating must be between ${this.minRating} and ${this.maxRating}`,
      );
    }
  }

  protected transform(input: CollectRatingInput): RatingFeedback {
    return {
      id: this.generateId(),
      type: 'rating',
      responseId: input.responseId,
      conversationId: input.conversationId,
      input: input.input,
      output: input.output,
      rating: input.feedback.rating,
      comment: this.allowComment ? input.feedback.comment : undefined,
      userId: input.userId,
      timestamp: this.autoTimestamp ? Date.now() : 0,
      metadata: input.metadata,
    };
  }
}

/**
 * Create a rating collector
 */
export function createRatingCollector(
  options?: RatingCollectorOptions,
): RatingCollector {
  return new RatingCollector(options);
}
