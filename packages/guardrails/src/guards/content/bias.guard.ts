/**
 * Bias Guard
 *
 * Detects potentially biased language in content.
 */

import type {
  GuardContext,
  GuardResult,
  GuardConfig,
  ContentType,
  DetectionDetail,
  BiasCategory,
} from '../../types';
import { BaseGuard } from '../../core/base-guard';
import { GuardRegistry } from '../../core/guard-registry';

/**
 * Bias guard configuration
 */
export interface BiasGuardOptions extends Partial<GuardConfig> {
  /** Bias categories to check */
  categories?: BiasCategory[];
  /** Custom bias patterns */
  customPatterns?: Record<string, RegExp[]>;
}

/**
 * Bias detection details
 */
export interface BiasDetails {
  /** Detected bias categories */
  categories: BiasCategory[];
  /** Scores per category */
  scores: Partial<Record<BiasCategory, number>>;
  /** Matched patterns */
  patterns: string[];
}

/**
 * Bias detection patterns
 */
const BIAS_PATTERNS: Record<BiasCategory, RegExp[]> = {
  gender: [
    /\b(all\s+)?(men|women)\s+(are|always|never|can't|cannot)\b/gi,
    /\b(typical|typical)\s+(man|woman|male|female)\b/gi,
    /\b(girls?|boys?)\s+(don't|can't|shouldn't)\b/gi,
    /\b(man|woman)\s+(should|must|need\s+to)\b/gi,
    /\bfemale\s+(doctor|engineer|pilot|driver)/gi,
    /\bmale\s+(nurse|teacher|secretary)/gi,
  ],
  race: [
    /\b(all|every)\s+\w+\s+(people|person)\s+(are|is)\b/gi,
    /\b(those|these)\s+(people|folks)\s+(always|never)\b/gi,
    /\b(typical|stereotypical)\s+\w+\s+(behavior|attitude)/gi,
  ],
  religion: [
    /\b(all|every)\s+(christians?|muslims?|jews?|hindus?|buddhists?)\s+(are|believe)\b/gi,
    /\b(typical|stereotypical)\s+(christian|muslim|jewish|hindu|buddhist)\b/gi,
    /\breligious\s+extremist/gi,
  ],
  political: [
    /\b(all|every)\s+(liberals?|conservatives?|democrats?|republicans?)\s+(are|want|believe)\b/gi,
    /\b(typical|stereotypical)\s+(liberal|conservative|democrat|republican)\b/gi,
    /\b(left|right)[\s-]?wing\s+nut/gi,
  ],
  age: [
    /\b(old\s+people|elderly)\s+(are|can't|don't|always)\b/gi,
    /\b(young\s+people|millennials?|boomers?)\s+(are|can't|don't|always)\b/gi,
    /\b(too\s+old|too\s+young)\s+(to|for)\b/gi,
    /\bok\s+boomer\b/gi,
  ],
  disability: [
    /\b(disabled\s+people|handicapped)\s+(are|can't|can\s+never)\b/gi,
    /\b(retard|cripple|lame)\b/gi,
    /\bmental(ly)?\s+(retard|handicap)/gi,
    /\bconfined\s+to\s+(a\s+)?wheelchair/gi,
  ],
};

/**
 * Bias Guard
 *
 * Detects potentially biased language using pattern matching.
 */
export class BiasGuard extends BaseGuard<void, BiasDetails> {
  readonly name = 'bias';
  readonly supportedTypes: ContentType[] = ['input', 'output'];

  private categories: BiasCategory[];
  private patterns: Map<BiasCategory, RegExp[]>;

  constructor(options: BiasGuardOptions = {}) {
    super(options);
    this.categories =
      options.categories ?? (Object.keys(BIAS_PATTERNS) as BiasCategory[]);

    // Build patterns map
    this.patterns = new Map();
    for (const category of this.categories) {
      const categoryPatterns = [
        ...(BIAS_PATTERNS[category] ?? []),
        ...(options.customPatterns?.[category] ?? []),
      ];
      if (categoryPatterns.length > 0) {
        this.patterns.set(category, categoryPatterns);
      }
    }
  }

  protected doCheck(context: GuardContext): Promise<GuardResult<BiasDetails>> {
    const { input } = context;
    const detectedCategories: BiasCategory[] = [];
    const scores: Partial<Record<BiasCategory, number>> = {};
    const matchedPatterns: string[] = [];
    const detections: DetectionDetail[] = [];

    // Check each category
    for (const [category, categoryPatterns] of this.patterns) {
      let matchCount = 0;
      const categoryMatches: string[] = [];

      for (const pattern of categoryPatterns) {
        const regex = new RegExp(pattern.source, pattern.flags);
        const matches = input.match(regex);

        if (matches) {
          matchCount += matches.length;
          categoryMatches.push(...matches);

          // Record detections
          for (const match of matches) {
            const index = input.toLowerCase().indexOf(match.toLowerCase());
            detections.push({
              category,
              pattern: pattern.source,
              startIndex: index,
              endIndex: index + match.length,
              matchedText: match,
            });
          }
        }
      }

      // Calculate score. A confirmed match is a real detection, so a single
      // match must reach the default block threshold (0.5) on its own —
      // otherwise withConfidence() would silently downgrade it to "allow".
      const score =
        matchCount > 0 ? Math.min(1, 0.5 + (matchCount - 1) * 0.25) : 0;
      scores[category] = score;

      if (matchCount > 0) {
        detectedCategories.push(category);
        matchedPatterns.push(...categoryMatches);
      }
    }

    const details: BiasDetails = {
      categories: detectedCategories,
      scores,
      patterns: matchedPatterns,
    };

    if (detectedCategories.length > 0) {
      const maxScore = Math.max(...Object.values(scores));
      return Promise.resolve(
        this.withConfidence(
          this.fail(
            `Potentially biased language detected: ${detectedCategories.join(', ')}`,
            details,
            detections,
          ),
          maxScore,
        ),
      );
    }

    return Promise.resolve(this.pass(details, 'No biased language detected'));
  }
}

// Register the guard
GuardRegistry.register({
  metadata: {
    name: 'bias',
    description: 'Detects potentially biased language in content',
    category: 'content',
    supportedTypes: ['input', 'output'],
    defaultConfig: {
      enabled: true,
      onFailure: 'warn',
      threshold: 0.5,
      sensitivity: 'medium',
    },
  },
  factory: (config) => new BiasGuard(config),
});

export default BiasGuard;
