/**
 * CombinationGenerator - Attack Combination Generation
 *
 * Generates combined attacks by merging multiple attack
 * payloads and techniques for more sophisticated testing.
 */

import { nanoid } from 'nanoid';
import type {
  Attack,
  AttackCategory,
  Severity,
} from '../../types/attack.types.js';

/**
 * Combination configuration
 */
export interface CombinationConfig {
  /** Attacks to combine */
  attacks: Attack[];
  /** Combination depth (how many attacks to combine) */
  depth?: number;
  /** Maximum combinations to generate */
  maxCombinations?: number;
  /** Combination strategies */
  strategies?: CombinationStrategy[];
  /** Preserve attack order */
  preserveOrder?: boolean;
  /** Custom separator */
  separator?: string;
}

/**
 * Combination strategies
 */
export type CombinationStrategy =
  | 'sequential' // Attacks one after another
  | 'nested' // Attacks nested within each other
  | 'interleaved' // Attacks interleaved
  | 'prefixed' // One attack as prefix
  | 'suffixed' // One attack as suffix
  | 'wrapped' // One attack wraps another
  | 'merged' // Payloads merged together
  | 'custom';

/**
 * Combined attack result
 */
export interface CombinedAttack extends Attack {
  /** Source attack IDs */
  sourceAttacks: string[];
  /** Combination strategy used */
  combinationStrategy: CombinationStrategy;
}

/**
 * CombinationGenerator - Generate Combined Attacks
 */
export class CombinationGenerator {
  /**
   * Generate attack combinations
   */
  generate(config: CombinationConfig): CombinedAttack[] {
    const combinations: CombinedAttack[] = [];
    const strategies = config.strategies || ['sequential', 'nested', 'wrapped'];
    const depth = config.depth || 2;
    const maxCombinations = config.maxCombinations || 100;

    // Generate pairs (depth 2)
    if (depth >= 2) {
      const pairs = this.generatePairs(config.attacks, config.preserveOrder);
      for (const pair of pairs) {
        for (const strategy of strategies) {
          const combined = this.combineAttacks(
            pair,
            strategy,
            config.separator,
          );
          if (combined) {
            combinations.push(combined);
            if (combinations.length >= maxCombinations) {
              return combinations;
            }
          }
        }
      }
    }

    // Generate triplets (depth 3)
    if (depth >= 3 && combinations.length < maxCombinations) {
      const triplets = this.generateTriplets(
        config.attacks,
        config.preserveOrder,
      );
      for (const triplet of triplets) {
        const combined = this.combineAttacks(
          triplet,
          'sequential',
          config.separator,
        );
        if (combined) {
          combinations.push(combined);
          if (combinations.length >= maxCombinations) {
            return combinations;
          }
        }
      }
    }

    return combinations;
  }

  /**
   * Combine specific attacks with a strategy
   */
  combineWith(
    attacks: Attack[],
    strategy: CombinationStrategy,
    separator?: string,
  ): CombinedAttack | null {
    return this.combineAttacks(attacks, strategy, separator);
  }

  /**
   * Generate all pairs
   */
  private generatePairs(
    attacks: Attack[],
    preserveOrder?: boolean,
  ): Attack[][] {
    const pairs: Attack[][] = [];

    for (let i = 0; i < attacks.length; i++) {
      for (let j = i + 1; j < attacks.length; j++) {
        pairs.push([attacks[i], attacks[j]]);
        if (!preserveOrder) {
          pairs.push([attacks[j], attacks[i]]);
        }
      }
    }

    return pairs;
  }

  /**
   * Generate all triplets
   */
  private generateTriplets(
    attacks: Attack[],
    _preserveOrder?: boolean,
  ): Attack[][] {
    const triplets: Attack[][] = [];

    for (let i = 0; i < attacks.length; i++) {
      for (let j = i + 1; j < attacks.length; j++) {
        for (let k = j + 1; k < attacks.length; k++) {
          triplets.push([attacks[i], attacks[j], attacks[k]]);
        }
      }
    }

    return triplets;
  }

  /**
   * Combine attacks using a strategy
   */
  private combineAttacks(
    attacks: Attack[],
    strategy: CombinationStrategy,
    separator?: string,
  ): CombinedAttack | null {
    if (attacks.length < 2) return null;

    let payload: string;
    const sep = separator || '\n\n';

    switch (strategy) {
      case 'sequential':
        payload = attacks.map((a) => a.payload).join(sep);
        break;

      case 'nested':
        payload = this.createNestedPayload(attacks);
        break;

      case 'interleaved':
        payload = this.createInterleavedPayload(attacks);
        break;

      case 'prefixed':
        payload =
          attacks[0].payload +
          sep +
          attacks
            .slice(1)
            .map((a) => a.payload)
            .join(sep);
        break;

      case 'suffixed':
        payload =
          attacks
            .slice(0, -1)
            .map((a) => a.payload)
            .join(sep) +
          sep +
          attacks[attacks.length - 1].payload;
        break;

      case 'wrapped':
        payload = this.createWrappedPayload(attacks);
        break;

      case 'merged':
        payload = this.createMergedPayload(attacks);
        break;

      default:
        payload = attacks.map((a) => a.payload).join(sep);
    }

    const categories = [...new Set(attacks.map((a) => a.category))];
    const highestSeverity = this.getHighestSeverity(
      attacks.map((a) => a.severity),
    );
    const allTags = [...new Set(attacks.flatMap((a) => a.tags))];

    return {
      id: `combo-${nanoid(8)}`,
      name: `Combined: ${attacks.map((a) => a.name).join(' + ')}`,
      description: `Combined attack using ${strategy} strategy from: ${attacks.map((a) => a.name).join(', ')}`,
      category: categories.length === 1 ? categories[0] : 'custom',
      severity: highestSeverity,
      payload,
      tags: [...allTags, 'combined', strategy],
      sourceAttacks: attacks.map((a) => a.id),
      combinationStrategy: strategy,
    };
  }

  /**
   * Create nested payload
   */
  private createNestedPayload(attacks: Attack[]): string {
    if (attacks.length === 0) return '';
    if (attacks.length === 1) return attacks[0].payload;

    // Nest each subsequent attack within the previous
    let result = attacks[attacks.length - 1].payload;
    for (let i = attacks.length - 2; i >= 0; i--) {
      result = attacks[i].payload.replace(/\{NESTED\}|$/, `\n---\n${result}`);
    }

    return result;
  }

  /**
   * Create interleaved payload
   */
  private createInterleavedPayload(attacks: Attack[]): string {
    // Split each payload into sentences and interleave
    const sentences = attacks.map((a) => a.payload.split(/(?<=[.!?])\s+/));

    const maxLength = Math.max(...sentences.map((s) => s.length));
    const result: string[] = [];

    for (let i = 0; i < maxLength; i++) {
      for (const sents of sentences) {
        if (i < sents.length) {
          result.push(sents[i]);
        }
      }
    }

    return result.join(' ');
  }

  /**
   * Create wrapped payload
   */
  private createWrappedPayload(attacks: Attack[]): string {
    if (attacks.length < 2) return attacks[0]?.payload || '';

    const wrapper = attacks[0].payload;
    const inner = attacks
      .slice(1)
      .map((a) => a.payload)
      .join('\n');

    // Try to find a good insertion point
    const insertionPoint = wrapper.indexOf('.');
    if (insertionPoint > -1) {
      return (
        wrapper.slice(0, insertionPoint + 1) +
        ` [BEGIN INNER REQUEST] ${inner} [END INNER REQUEST] ` +
        wrapper.slice(insertionPoint + 1)
      );
    }

    return `${wrapper}\n\n[INNER REQUEST]\n${inner}\n[/INNER REQUEST]`;
  }

  /**
   * Create merged payload
   */
  private createMergedPayload(attacks: Attack[]): string {
    // Merge by alternating words
    const words = attacks.map((a) => a.payload.split(/\s+/));
    const maxLength = Math.max(...words.map((w) => w.length));
    const result: string[] = [];

    for (let i = 0; i < maxLength; i++) {
      for (const wordList of words) {
        if (i < wordList.length) {
          result.push(wordList[i]);
        }
      }
    }

    return result.join(' ');
  }

  /**
   * Get highest severity
   */
  private getHighestSeverity(severities: Severity[]): Severity {
    const order: Severity[] = [
      'critical',
      'high',
      'medium',
      'low',
      'informational',
    ];

    for (const severity of order) {
      if (severities.includes(severity)) {
        return severity;
      }
    }

    return 'medium';
  }

  /**
   * Generate category-based combinations
   */
  generateByCategoryPairs(
    attacks: Attack[],
    categoryPairs: [AttackCategory, AttackCategory][],
  ): CombinedAttack[] {
    const combinations: CombinedAttack[] = [];

    for (const [cat1, cat2] of categoryPairs) {
      const attacks1 = attacks.filter((a) => a.category === cat1);
      const attacks2 = attacks.filter((a) => a.category === cat2);

      for (const a1 of attacks1) {
        for (const a2 of attacks2) {
          const combined = this.combineAttacks([a1, a2], 'sequential');
          if (combined) {
            combinations.push(combined);
          }
        }
      }
    }

    return combinations;
  }
}

/**
 * Create a new combination generator
 */
export function createCombinationGenerator(): CombinationGenerator {
  return new CombinationGenerator();
}
