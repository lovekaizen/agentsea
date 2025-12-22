/**
 * CorrectionCollector
 *
 * Text correction feedback collector.
 */

import { BaseCollector } from './BaseCollector.js';
import type {
  CorrectionFeedback,
  FeedbackCollectorOptions,
  CollectCorrectionInput,
} from '../../types/index.js';

/**
 * Correction feedback collector
 */
export class CorrectionCollector extends BaseCollector<
  CollectCorrectionInput,
  CorrectionFeedback
> {
  constructor(options: FeedbackCollectorOptions = {}) {
    super(options);
  }

  protected validate(input: CollectCorrectionInput): void {
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
    if (!input.correctedOutput) {
      throw new Error('correctedOutput is required');
    }

    // Validate correction type
    const validTypes = ['factual', 'grammar', 'style', 'completeness', 'other'];
    if (!validTypes.includes(input.correctionType)) {
      throw new Error(
        `correctionType must be one of: ${validTypes.join(', ')}`,
      );
    }

    // Validate that correction is actually different
    if (input.output === input.correctedOutput) {
      throw new Error('correctedOutput must be different from output');
    }
  }

  protected transform(input: CollectCorrectionInput): CorrectionFeedback {
    return {
      id: this.generateId(),
      type: 'correction',
      responseId: input.responseId,
      conversationId: input.conversationId,
      input: input.input,
      output: input.output,
      correctedOutput: input.correctedOutput,
      correctionType: input.correctionType,
      explanation: input.explanation,
      userId: input.userId,
      timestamp: this.autoTimestamp ? Date.now() : 0,
      metadata: input.metadata,
    };
  }
}

/**
 * Create a correction collector
 */
export function createCorrectionCollector(
  options?: FeedbackCollectorOptions,
): CorrectionCollector {
  return new CorrectionCollector(options);
}
