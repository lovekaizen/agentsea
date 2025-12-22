/**
 * Factuality Guard
 *
 * Checks content for factual claims and provides verification hooks.
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
 * Factuality guard configuration
 */
export interface FactualityGuardOptions extends Partial<GuardConfig> {
  /** Custom fact checker function */
  factChecker?: (claims: string[]) => Promise<FactCheckResult[]>;
  /** Known facts to verify against */
  knownFacts?: Record<string, string | boolean | number>;
  /** Patterns to identify factual claims */
  claimPatterns?: RegExp[];
  /** Minimum confidence for claims */
  minConfidence?: number;
}

/**
 * Fact check result
 */
export interface FactCheckResult {
  claim: string;
  verified: boolean;
  confidence: number;
  source?: string;
  correction?: string;
}

/**
 * Factuality details
 */
export interface FactualityDetails {
  /** Extracted claims */
  claims: string[];
  /** Verification results */
  results: FactCheckResult[];
  /** Overall factuality score */
  factualityScore: number;
  /** Unverified claims */
  unverifiedClaims: string[];
  /** False claims */
  falseClaims: string[];
}

/**
 * Default patterns to identify factual claims
 */
const DEFAULT_CLAIM_PATTERNS: RegExp[] = [
  // Statistics and numbers
  /\b(\d+(?:\.\d+)?%?)\s+(of|percent|per cent)\s+/gi,
  /\b(approximately|about|around|nearly|over|under|exactly)\s+(\d+(?:,\d{3})*(?:\.\d+)?)\b/gi,

  // Dates and events
  /\b(in|on|during|since|from)\s+(19|20)\d{2}\b/gi,
  /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+(19|20)\d{2}\b/gi,

  // Claims with "is/are/was/were"
  /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(is|are|was|were)\s+(the\s+)?(largest|smallest|first|last|oldest|youngest|most|least)\b/gi,

  // Scientific claims
  /\bstudies?\s+(show|indicate|suggest|prove|demonstrate)\b/gi,
  /\bresearch\s+(shows?|indicates?|suggests?|proves?|demonstrates?)\b/gi,
  /\baccording\s+to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,

  // Definitive statements
  /\b(the\s+)?(fact|truth)\s+(is|that)\b/gi,
  /\b(it\s+is|this\s+is)\s+(true|false|correct|incorrect|accurate|inaccurate)\s+that\b/gi,

  // Absolute claims
  /\b(always|never|all|none|every|no\s+one)\s+/gi,
];

/**
 * Factuality Guard
 *
 * Identifies factual claims in content and provides verification hooks.
 * Note: Actual fact-checking requires external services or knowledge bases.
 */
export class FactualityGuard extends BaseGuard<void, FactualityDetails> {
  readonly name = 'factuality';
  readonly supportedTypes: ContentType[] = ['output'];

  private factChecker?: (claims: string[]) => Promise<FactCheckResult[]>;
  private knownFacts: Record<string, string | boolean | number>;
  private claimPatterns: RegExp[];
  private minConfidence: number;

  constructor(options: FactualityGuardOptions = {}) {
    super(options);
    this.factChecker = options.factChecker;
    this.knownFacts = options.knownFacts ?? {};
    this.claimPatterns = options.claimPatterns ?? DEFAULT_CLAIM_PATTERNS;
    this.minConfidence = options.minConfidence ?? 0.7;
  }

  protected async doCheck(
    context: GuardContext,
  ): Promise<GuardResult<FactualityDetails>> {
    const { input } = context;

    // Extract claims
    const claims = this.extractClaims(input);

    if (claims.length === 0) {
      return Promise.resolve(
        this.pass(
          {
            claims: [],
            results: [],
            factualityScore: 1,
            unverifiedClaims: [],
            falseClaims: [],
          },
          'No factual claims detected',
        ),
      );
    }

    // Verify claims
    const results = await this.verifyClaims(claims);

    // Calculate scores
    const verifiedCount = results.filter(
      (r) => r.verified && r.confidence >= this.minConfidence,
    ).length;
    const falseClaims = results.filter(
      (r) => !r.verified && r.confidence >= this.minConfidence,
    );
    const unverifiedClaims = results
      .filter((r) => r.confidence < this.minConfidence)
      .map((r) => r.claim);

    const factualityScore =
      claims.length > 0 ? verifiedCount / claims.length : 1;

    const details: FactualityDetails = {
      claims,
      results,
      factualityScore,
      unverifiedClaims,
      falseClaims: falseClaims.map((r) => r.claim),
    };

    // Build detections for false claims
    const detections: DetectionDetail[] = falseClaims.map((r) => ({
      category: 'factuality',
      pattern: 'false_claim',
      matchedText: r.claim,
      context: r.correction,
    }));

    // Fail if there are high-confidence false claims
    if (falseClaims.length > 0) {
      return Promise.resolve(
        this.withConfidence(
          this.fail(
            `Found ${falseClaims.length} potentially false claim(s)`,
            details,
            detections,
          ),
          1 - factualityScore,
        ),
      );
    }

    // Warn if many claims are unverified
    if (unverifiedClaims.length > claims.length * 0.5) {
      return Promise.resolve(
        this.warn(
          `${unverifiedClaims.length} of ${claims.length} claims could not be verified`,
          details,
        ),
      );
    }

    return Promise.resolve(
      this.pass(
        details,
        `Factuality check passed (${verifiedCount}/${claims.length} verified)`,
      ),
    );
  }

  /**
   * Extract factual claims from content
   */
  private extractClaims(content: string): string[] {
    const claims = new Set<string>();

    for (const pattern of this.claimPatterns) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match;

      while ((match = regex.exec(content)) !== null) {
        // Extract surrounding sentence
        const start = content.lastIndexOf('.', match.index);
        const end = content.indexOf('.', match.index + match[0].length);

        const sentence = content
          .slice(
            start === -1 ? 0 : start + 1,
            end === -1 ? content.length : end + 1,
          )
          .trim();

        if (sentence.length > 10 && sentence.length < 500) {
          claims.add(sentence);
        }
      }
    }

    return Array.from(claims);
  }

  /**
   * Verify claims using available methods
   */
  private async verifyClaims(claims: string[]): Promise<FactCheckResult[]> {
    // Use custom fact checker if provided
    if (this.factChecker) {
      return this.factChecker(claims);
    }

    // Fall back to basic known facts checking
    return claims.map((claim) => this.checkAgainstKnownFacts(claim));
  }

  /**
   * Check a claim against known facts
   */
  private checkAgainstKnownFacts(claim: string): FactCheckResult {
    const claimLower = claim.toLowerCase();

    for (const [fact, value] of Object.entries(this.knownFacts)) {
      const factLower = fact.toLowerCase();

      if (claimLower.includes(factLower)) {
        // Check if claim aligns with known fact
        const valueStr = String(value).toLowerCase();
        const isVerified = claimLower.includes(valueStr);

        return {
          claim,
          verified: isVerified,
          confidence: 0.8,
          source: 'known_facts',
          correction: isVerified ? undefined : `Known fact: ${fact} = ${value}`,
        };
      }
    }

    // Claim not found in known facts
    return {
      claim,
      verified: true, // Assume true if we can't verify
      confidence: 0.3, // Low confidence
    };
  }
}

/**
 * Create a factuality guard with a custom fact checker
 */
export function createFactualityGuard(
  factChecker: (claims: string[]) => Promise<FactCheckResult[]>,
  options?: Partial<FactualityGuardOptions>,
): FactualityGuard {
  return new FactualityGuard({
    ...options,
    factChecker,
  });
}

// Register the guard
GuardRegistry.register({
  metadata: {
    name: 'factuality',
    description: 'Checks content for factual claims and provides verification',
    category: 'validation',
    supportedTypes: ['output'],
    defaultConfig: {
      enabled: false, // Disabled by default as it requires external services
      onFailure: 'warn',
      threshold: 0.7,
      sensitivity: 'medium',
    },
  },
  factory: (config) => new FactualityGuard(config),
});

export default FactualityGuard;
