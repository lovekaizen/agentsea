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
  private requireComment: 'always' | 'on_low' | 'never';
  private lowRatingThreshold: number;

  constructor(options: RatingCollectorOptions = {}) {
    super(options);
    this.allowComment = options.allowComment ?? true;
    this.minRating = options.minRating ?? 1;
    this.maxRating = options.maxRating ?? 5;
    this.requireComment = options.requireComment ?? 'never';
    this.lowRatingThreshold = options.lowRatingThreshold ?? 3;
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
    if (typeof rating !== 'number') {
      throw new Error('feedback.rating must be a number');
    }
    if (rating < this.minRating || rating > this.maxRating) {
      throw new Error(
        `feedback.rating must be between ${this.minRating} and ${this.maxRating}`,
      );
    }

    // Check comment requirements
    const isLowRating = rating <= this.lowRatingThreshold;
    const hasComment = !!input.feedback.comment?.trim();

    if (this.requireComment === 'always' && !hasComment) {
      throw new Error('Comment is required');
    }
    if (this.requireComment === 'on_low' && isLowRating && !hasComment) {
      throw new Error('Comment is required for low ratings');
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
      maxRating: this.maxRating,
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
