/**
 * Toxicity Guard
 *
 * Detects toxic, harmful, or inappropriate content.
 */

import type {
  GuardContext,
  GuardResult,
  GuardConfig,
  ContentType,
  DetectionDetail,
  ToxicityCategory,
} from '../../types';
import { BaseGuard } from '../../core/base-guard';
import { GuardRegistry } from '../../core/guard-registry';

/**
 * Toxicity guard configuration
 */
export interface ToxicityGuardOptions extends Partial<GuardConfig> {
  /** Categories to check */
  categories?: ToxicityCategory[];
  /** Per-category thresholds */
  categoryThresholds?: Partial<Record<ToxicityCategory, number>>;
}

/**
 * Toxicity detection details
 */
export interface ToxicityDetails {
  /** Categories detected */
  categories: ToxicityCategory[];
  /** Scores per category */
  scores: Partial<Record<ToxicityCategory, number>>;
  /** Matched patterns */
  patterns: string[];
}

/**
 * Pattern matchers for different toxicity categories
 */
const TOXICITY_PATTERNS: Record<ToxicityCategory, RegExp[]> = {
  hate: [
    /\b(hate|hatred|despise)\s+(you|them|all|every)\b/gi,
    /\b(kill|murder|destroy)\s+(all|every|the)\s+\w+/gi,
    /\bracist|sexist|bigot\b/gi,
    /\bslur\b/gi,
  ],
  violence: [
    /\b(kill|murder|hurt|harm|attack|assault|beat|stab|shoot)\s+(you|them|him|her|someone|people)\b/gi,
    /\b(bomb|weapon|gun|knife)\s+(threat|attack)\b/gi,
    /\bviolent\s+act\b/gi,
    /\btorture\b/gi,
  ],
  sexual: [
    /\bsexual\s+(assault|harassment|abuse)\b/gi,
    /\bexplicit\s+content\b/gi,
    /\bpornograph/gi,
  ],
  harassment: [
    /\b(harass|bully|stalk|intimidate)\b/gi,
    /\byou('re|\s+are)\s+(stupid|idiot|moron|dumb|worthless)\b/gi,
    /\b(go\s+)?(die|kill\s+yourself)\b/gi,
    /\bthreaten/gi,
  ],
  'self-harm': [
    /\b(suicide|self[- ]harm|cut\s+myself|end\s+(my|it)\s+all)\b/gi,
    /\b(want|going)\s+to\s+die\b/gi,
    /\bhurt\s+myself\b/gi,
  ],
  dangerous: [
    /\b(make|create|build)\s+(a\s+)?(bomb|explosive|weapon)\b/gi,
    /\b(how\s+to\s+)?(hack|exploit|attack)\s+(system|server|website)\b/gi,
    /\billegal\s+(drug|substance)\b/gi,
  ],
};

/**
 * Default category thresholds
 */
const DEFAULT_THRESHOLDS: Record<ToxicityCategory, number> = {
  hate: 0.7,
  violence: 0.7,
  sexual: 0.7,
  harassment: 0.7,
  'self-harm': 0.5,
  dangerous: 0.6,
};

/**
 * Toxicity Guard
 *
 * Detects toxic content based on pattern matching and heuristics.
 */
export class ToxicityGuard extends BaseGuard<void, ToxicityDetails> {
  readonly name = 'toxicity';
  readonly supportedTypes: ContentType[] = ['input', 'output'];

  private categories: ToxicityCategory[];
  private thresholds: Record<ToxicityCategory, number>;

  constructor(options: ToxicityGuardOptions = {}) {
    super(options);
    this.categories =
      options.categories ??
      (Object.keys(TOXICITY_PATTERNS) as ToxicityCategory[]);
    this.thresholds = {
      ...DEFAULT_THRESHOLDS,
      ...options.categoryThresholds,
    };
  }

  protected doCheck(
    context: GuardContext,
  ): Promise<GuardResult<ToxicityDetails>> {
    const { input } = context;
    const detectedCategories: ToxicityCategory[] = [];
    const scores: Partial<Record<ToxicityCategory, number>> = {};
    const matchedPatterns: string[] = [];
    const detections: DetectionDetail[] = [];

    // Check each category
    for (const category of this.categories) {
      const patterns = TOXICITY_PATTERNS[category];
      if (!patterns) continue;

      let categoryMatches = 0;
      const categoryPatterns: string[] = [];

      for (const pattern of patterns) {
        const matches = input.match(pattern);
        if (matches) {
          categoryMatches += matches.length;
          categoryPatterns.push(...matches);

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

      // Calculate score based on matches (normalized)
      const score = Math.min(1, categoryMatches * 0.3);
      scores[category] = score;

      if (score >= this.thresholds[category]) {
        detectedCategories.push(category);
        matchedPatterns.push(...categoryPatterns);
      }
    }

    const details: ToxicityDetails = {
      categories: detectedCategories,
      scores,
      patterns: matchedPatterns,
    };

    if (detectedCategories.length > 0) {
      const maxScore = Math.max(...Object.values(scores));
      return Promise.resolve(
        this.withConfidence(
          this.fail(
            `Toxic content detected: ${detectedCategories.join(', ')}`,
            details,
            detections,
          ),
          maxScore,
        ),
      );
    }

    return Promise.resolve(this.pass(details, 'No toxic content detected'));
  }
}

// Register the guard
GuardRegistry.register({
  metadata: {
    name: 'toxicity',
    description: 'Detects toxic, harmful, or inappropriate content',
    category: 'content',
    supportedTypes: ['input', 'output'],
    defaultConfig: {
      enabled: true,
      onFailure: 'block',
      threshold: 0.7,
      sensitivity: 'medium',
    },
  },
  factory: (config) => new ToxicityGuard(config),
});

export default ToxicityGuard;
