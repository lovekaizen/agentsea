/**
 * PreferenceCollector
 *
 * A/B preference comparison feedback collector.
 */

import { BaseCollector } from './BaseCollector.js';
import type {
  PreferenceFeedback,
  PreferenceCollectorOptions,
  CollectPreferenceInput,
} from '../../types/index.js';

/**
 * Preference (A/B) feedback collector
 */
export class PreferenceCollector extends BaseCollector<
  CollectPreferenceInput,
  PreferenceFeedback
> {
  private allowTie: boolean;
  private requireReason: boolean;
  private requireConfidence: boolean;
  private minConfidence: number;

  constructor(options: PreferenceCollectorOptions = {}) {
    super(options);
    this.allowTie = options.allowTie ?? true;
    this.requireReason = options.requireReason ?? false;
    this.requireConfidence = options.requireConfidence ?? false;
    this.minConfidence = options.minConfidence ?? 0;
  }

  protected validate(input: CollectPreferenceInput): void {
    // Validate required fields
    if (!input.input) {
      throw new Error('input is required');
    }
    if (!input.responseA || !input.responseA.id || !input.responseA.content) {
      throw new Error('responseA with id and content is required');
    }
    if (!input.responseB || !input.responseB.id || !input.responseB.content) {
      throw new Error('responseB with id and content is required');
    }

    // Validate preference
    const validPreferences = this.allowTie ? ['A', 'B', 'tie'] : ['A', 'B'];
    if (!validPreferences.includes(input.preference)) {
      throw new Error(
        `preference must be ${this.allowTie ? '"A", "B", or "tie"' : '"A" or "B"'}`,
      );
    }

    // Validate reason
    if (this.requireReason && !input.reason) {
      throw new Error('reason is required');
    }

    // Validate confidence
    if (this.requireConfidence && input.confidence === undefined) {
      throw new Error('confidence is required');
    }
    if (input.confidence !== undefined) {
      if (input.confidence < 0 || input.confidence > 1) {
        throw new Error('confidence must be between 0 and 1');
      }
      if (input.confidence < this.minConfidence) {
        throw new Error(`confidence must be at least ${this.minConfidence}`);
      }
    }
  }

  protected transform(input: CollectPreferenceInput): PreferenceFeedback {
    return {
      id: this.generateId(),
      type: 'preference',
      responseId: `${input.responseA.id}_vs_${input.responseB.id}`,
      input: input.input,
      output:
        input.preference === 'A'
          ? input.responseA.content
          : input.responseB.content,
      responseA: input.responseA,
      responseB: input.responseB,
      preference: input.preference,
      reason: input.reason,
      confidence: input.confidence,
      userId: input.userId,
      timestamp: this.autoTimestamp ? Date.now() : 0,
      metadata: input.metadata,
    };
  }
}

/**
 * Create a preference collector
 */
export function createPreferenceCollector(
  options?: PreferenceCollectorOptions,
): PreferenceCollector {
  return new PreferenceCollector(options);
}
