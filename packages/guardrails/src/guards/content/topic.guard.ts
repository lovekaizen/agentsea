/**
 * Topic Guard
 *
 * Classifies content into topics and allows/blocks based on configuration.
 */

import type {
  GuardContext,
  GuardResult,
  GuardConfig,
  ContentType,
  DetectionDetail,
} from '../../types';
import { BaseGuard } from '../../core/base-guard';
import { GuardRegistry } from '../../core/guard-registry';

/**
 * Topic guard configuration
 */
export interface TopicGuardOptions extends Partial<GuardConfig> {
  /** Allowed topics (whitelist) */
  allowedTopics?: string[];
  /** Blocked topics (blacklist) */
  blockedTopics?: string[];
  /** Custom topic keywords */
  topicKeywords?: Record<string, string[]>;
  /** Minimum confidence for classification */
  minConfidence?: number;
}

/**
 * Topic detection details
 */
export interface TopicDetails {
  /** Detected topics */
  topics: string[];
  /** Confidence scores per topic */
  scores: Record<string, number>;
  /** Blocked topics found */
  blockedTopics: string[];
  /** Whether content is within allowed topics */
  withinAllowed: boolean;
}

/**
 * Default topic keywords
 */
const DEFAULT_TOPIC_KEYWORDS: Record<string, string[]> = {
  technology: [
    'computer',
    'software',
    'hardware',
    'programming',
    'code',
    'api',
    'database',
    'server',
    'cloud',
    'ai',
    'machine learning',
    'algorithm',
  ],
  finance: [
    'money',
    'bank',
    'investment',
    'stock',
    'trading',
    'crypto',
    'bitcoin',
    'loan',
    'credit',
    'mortgage',
    'insurance',
    'tax',
  ],
  health: [
    'medical',
    'doctor',
    'hospital',
    'disease',
    'symptom',
    'treatment',
    'medication',
    'health',
    'wellness',
    'mental health',
    'therapy',
  ],
  politics: [
    'election',
    'government',
    'political',
    'democrat',
    'republican',
    'congress',
    'senate',
    'president',
    'vote',
    'policy',
    'legislation',
  ],
  religion: [
    'god',
    'church',
    'mosque',
    'temple',
    'bible',
    'quran',
    'prayer',
    'faith',
    'religious',
    'spiritual',
    'worship',
    'heaven',
    'hell',
  ],
  adult: ['xxx', 'nsfw', 'adult content', 'explicit', '18+'],
  gambling: [
    'casino',
    'betting',
    'poker',
    'blackjack',
    'slots',
    'lottery',
    'wager',
    'odds',
    'gambling',
  ],
  weapons: [
    'gun',
    'rifle',
    'pistol',
    'firearm',
    'ammunition',
    'explosive',
    'bomb',
    'weapon',
    'knife',
    'sword',
  ],
  drugs: [
    'cocaine',
    'heroin',
    'meth',
    'marijuana',
    'cannabis',
    'drug dealer',
    'narcotics',
    'opioid',
    'illegal drugs',
  ],
};

/**
 * Topic Guard
 *
 * Classifies content by topic using keyword matching.
 */
export class TopicGuard extends BaseGuard<void, TopicDetails> {
  readonly name = 'topic';
  readonly supportedTypes: ContentType[] = ['input', 'output'];

  private allowedTopics: Set<string>;
  private blockedTopics: Set<string>;
  private topicKeywords: Record<string, string[]>;
  private minConfidence: number;

  constructor(options: TopicGuardOptions = {}) {
    super(options);
    this.allowedTopics = new Set(options.allowedTopics ?? []);
    this.blockedTopics = new Set(options.blockedTopics ?? []);
    this.topicKeywords = {
      ...DEFAULT_TOPIC_KEYWORDS,
      ...options.topicKeywords,
    };
    this.minConfidence = options.minConfidence ?? 0.3;
  }

  protected doCheck(context: GuardContext): Promise<GuardResult<TopicDetails>> {
    const { input } = context;
    const inputLower = input.toLowerCase();
    const scores: Record<string, number> = {};
    const detectedTopics: string[] = [];
    const detections: DetectionDetail[] = [];

    // Score each topic
    for (const [topic, keywords] of Object.entries(this.topicKeywords)) {
      let matchCount = 0;
      const matchedKeywords: string[] = [];

      for (const keyword of keywords) {
        const regex = new RegExp(`\\b${this.escapeRegex(keyword)}\\b`, 'gi');
        const matches = inputLower.match(regex);
        if (matches) {
          matchCount += matches.length;
          matchedKeywords.push(keyword);

          // Record detections
          let idx = -1;
          for (const match of matches) {
            idx = inputLower.indexOf(match.toLowerCase(), idx + 1);
            if (idx !== -1) {
              detections.push({
                category: topic,
                pattern: keyword,
                startIndex: idx,
                endIndex: idx + match.length,
                matchedText: match,
              });
            }
          }
        }
      }

      // Calculate score (normalized by keyword count and text length)
      const score = Math.min(
        1,
        (matchCount * 2) / Math.max(1, keywords.length),
      );
      scores[topic] = score;

      if (score >= this.minConfidence) {
        detectedTopics.push(topic);
      }
    }

    // Check against allowed/blocked lists
    const blockedTopicsFound = detectedTopics.filter((t) =>
      this.blockedTopics.has(t),
    );

    // Check if within allowed topics (if allowlist is configured)
    const withinAllowed =
      this.allowedTopics.size === 0 ||
      detectedTopics.some((t) => this.allowedTopics.has(t));

    const details: TopicDetails = {
      topics: detectedTopics,
      scores,
      blockedTopics: blockedTopicsFound,
      withinAllowed,
    };

    // Fail if blocked topics found
    if (blockedTopicsFound.length > 0) {
      const maxScore = Math.max(
        ...blockedTopicsFound.map((t) => scores[t] ?? 0),
      );
      return Promise.resolve(
        this.withConfidence(
          this.fail(
            `Content contains blocked topic(s): ${blockedTopicsFound.join(', ')}`,
            details,
            detections.filter((d) => blockedTopicsFound.includes(d.category)),
          ),
          maxScore,
        ),
      );
    }

    // Fail if not within allowed topics (when allowlist is configured)
    if (this.allowedTopics.size > 0 && !withinAllowed) {
      return Promise.resolve(
        this.fail(
          `Content topic not in allowed list. Detected: ${detectedTopics.join(', ') || 'none'}`,
          details,
        ),
      );
    }

    return Promise.resolve(
      this.pass(
        details,
        `Topic classification: ${detectedTopics.join(', ') || 'general'}`,
      ),
    );
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

// Register the guard
GuardRegistry.register({
  metadata: {
    name: 'topic',
    description:
      'Classifies content by topic and allows/blocks based on configuration',
    category: 'content',
    supportedTypes: ['input', 'output'],
    defaultConfig: {
      enabled: true,
      onFailure: 'block',
      threshold: 0.3,
      sensitivity: 'medium',
    },
  },
  factory: (config) => new TopicGuard(config),
});

export default TopicGuard;
