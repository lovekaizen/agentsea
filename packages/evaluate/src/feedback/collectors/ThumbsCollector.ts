/**
 * ThumbsCollector
 *
 * Simple thumbs up/down feedback collector.
 */

import { BaseCollector } from './BaseCollector.js';
import type {
  ThumbsFeedback,
  ThumbsCollectorOptions,
  CollectThumbsInput,
} from '../../types/index.js';

/**
 * Thumbs up/down feedback collector
 */
export class ThumbsCollector extends BaseCollector<
  CollectThumbsInput,
  ThumbsFeedback
> {
  private allowComment: boolean;
  private requireComment: 'always' | 'on_down' | 'never';

  constructor(options: ThumbsCollectorOptions = {}) {
    super(options);
    this.allowComment = options.allowComment ?? true;
    this.requireComment = options.requireComment ?? 'never';
  }

  protected validate(input: CollectThumbsInput): void {
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
    if (!['up', 'down'].includes(input.feedback.rating)) {
      throw new Error('feedback.rating must be "up" or "down"');
    }

    // Validate comment requirements
    if (this.requireComment === 'always' && !input.feedback.comment) {
      throw new Error('Comment is required');
    }
    if (
      this.requireComment === 'on_down' &&
      input.feedback.rating === 'down' &&
      !input.feedback.comment
    ) {
      throw new Error('Comment is required for negative feedback');
    }
  }

  protected transform(input: CollectThumbsInput): ThumbsFeedback {
    return {
      id: this.generateId(),
      type: 'thumbs',
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
 * Create a thumbs collector
 */
export function createThumbsCollector(
  options?: ThumbsCollectorOptions,
): ThumbsCollector {
  return new ThumbsCollector(options);
}
