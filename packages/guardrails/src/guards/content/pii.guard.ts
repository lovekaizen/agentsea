/**
 * PII Guard
 *
 * Detects and optionally masks Personally Identifiable Information (PII).
 */

import type {
  GuardContext,
  GuardResult,
  GuardConfig,
  ContentType,
  DetectionDetail,
  PIIType,
} from '../../types';
import { BaseGuard } from '../../core/base-guard';
import { GuardRegistry } from '../../core/guard-registry';

/**
 * PII guard configuration
 */
export interface PIIGuardOptions extends Partial<GuardConfig> {
  /** PII types to detect */
  types?: PIIType[];
  /** Custom regex patterns */
  customPatterns?: Record<string, RegExp>;
  /** Masking format (e.g., '[REDACTED]') */
  maskFormat?: string;
  /** Character to use for masking */
  maskChar?: string;
  /** Enable masking transformation */
  enableMasking?: boolean;
}

/**
 * PII detection details
 */
export interface PIIDetails {
  /** Types of PII found */
  types: PIIType[];
  /** Count of each type */
  counts: Partial<Record<PIIType, number>>;
  /** Total PII instances found */
  totalCount: number;
  /** Masked content (if masking enabled) */
  maskedContent?: string;
}

/**
 * PII detection patterns
 */
const PII_PATTERNS: Record<PIIType, RegExp> = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
  ssn: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
  'credit-card':
    /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
  address:
    /\b\d{1,5}\s+(?:[A-Za-z0-9]+\s){1,4}(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Lane|Ln|Drive|Dr|Court|Ct|Way|Circle|Cir)\b/gi,
  name: /\b(?:Mr\.|Mrs\.|Ms\.|Dr\.)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g,
  'ip-address':
    /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
  'date-of-birth':
    /\b(?:0?[1-9]|1[0-2])[-/](?:0?[1-9]|[12][0-9]|3[01])[-/](?:19|20)\d{2}\b/g,
};

/**
 * Default mask format
 */
const DEFAULT_MASK_FORMAT = '[REDACTED]';

/**
 * PII Guard
 *
 * Detects personally identifiable information and can optionally mask it.
 */
export class PIIGuard extends BaseGuard<void, PIIDetails> {
  readonly name = 'pii';
  readonly supportedTypes: ContentType[] = ['input', 'output'];

  private types: PIIType[];
  private patterns: Map<string, RegExp>;
  private maskFormat: string;
  private maskChar: string;
  private enableMasking: boolean;

  constructor(options: PIIGuardOptions = {}) {
    super(options);
    this.types = options.types ?? (Object.keys(PII_PATTERNS) as PIIType[]);
    this.maskFormat = options.maskFormat ?? DEFAULT_MASK_FORMAT;
    this.maskChar = options.maskChar ?? '*';
    this.enableMasking = options.enableMasking ?? true;

    // Build patterns map
    this.patterns = new Map();
    for (const type of this.types) {
      if (PII_PATTERNS[type]) {
        this.patterns.set(type, PII_PATTERNS[type]);
      }
    }

    // Add custom patterns
    if (options.customPatterns) {
      for (const [name, pattern] of Object.entries(options.customPatterns)) {
        this.patterns.set(name, pattern);
      }
    }
  }

  protected doCheck(context: GuardContext): Promise<GuardResult<PIIDetails>> {
    const { input } = context;
    const detectedTypes: PIIType[] = [];
    const counts: Partial<Record<PIIType, number>> = {};
    const detections: DetectionDetail[] = [];
    let totalCount = 0;

    // Check each pattern
    for (const [type, pattern] of this.patterns) {
      // Create a new regex to reset lastIndex
      const regex = new RegExp(pattern.source, pattern.flags);
      const matches: RegExpExecArray[] = [];
      let match;

      while ((match = regex.exec(input)) !== null) {
        matches.push(match);
      }

      if (matches.length > 0) {
        detectedTypes.push(type as PIIType);
        counts[type as PIIType] = matches.length;
        totalCount += matches.length;

        for (const m of matches) {
          detections.push({
            category: type,
            pattern: pattern.source,
            startIndex: m.index,
            endIndex: m.index + m[0].length,
            matchedText: this.maskPII(m[0], type),
          });
        }
      }
    }

    const details: PIIDetails = {
      types: detectedTypes,
      counts,
      totalCount,
    };

    if (totalCount > 0) {
      // Apply masking if action is transform
      if (this.config.onFailure === 'transform' && this.enableMasking) {
        const maskedContent = this.maskAllPII(input);
        details.maskedContent = maskedContent;

        return Promise.resolve(
          this.transformed(
            maskedContent,
            details,
            `Found and masked ${totalCount} PII instance(s): ${detectedTypes.join(', ')}`,
          ),
        );
      }

      return Promise.resolve(
        this.fail(
          `Found ${totalCount} PII instance(s): ${detectedTypes.join(', ')}`,
          details,
          detections,
        ),
      );
    }

    return Promise.resolve(this.pass(details, 'No PII detected'));
  }

  /**
   * Transform function to mask PII
   */
  transform(content: string): Promise<string> {
    return Promise.resolve(this.maskAllPII(content));
  }

  /**
   * Mask a single PII value
   */
  private maskPII(value: string, type: string): string {
    if (this.maskFormat === '[REDACTED]') {
      return `[${type.toUpperCase()}_REDACTED]`;
    }

    // Partial masking (show first and last chars)
    if (value.length <= 4) {
      return this.maskChar.repeat(value.length);
    }

    return (
      value[0] +
      this.maskChar.repeat(value.length - 2) +
      value[value.length - 1]
    );
  }

  /**
   * Mask all PII in content
   */
  private maskAllPII(content: string): string {
    let masked = content;

    for (const [type, pattern] of this.patterns) {
      const regex = new RegExp(pattern.source, pattern.flags);
      masked = masked.replace(regex, (match) => this.maskPII(match, type));
    }

    return masked;
  }
}

// Register the guard
GuardRegistry.register({
  metadata: {
    name: 'pii',
    description:
      'Detects and optionally masks Personally Identifiable Information',
    category: 'content',
    supportedTypes: ['input', 'output'],
    defaultConfig: {
      enabled: true,
      onFailure: 'transform',
      threshold: 0.0,
      sensitivity: 'high',
    },
  },
  factory: (config) => new PIIGuard(config),
});

export default PIIGuard;
