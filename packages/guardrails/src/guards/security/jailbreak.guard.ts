/**
 * Jailbreak Guard
 *
 * Detects jailbreak attempts designed to bypass AI safety measures.
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
 * Jailbreak guard configuration
 */
export interface JailbreakGuardOptions extends Partial<GuardConfig> {
  /** Check for DAN-style attacks */
  checkDAN?: boolean;
  /** Check for roleplay attacks */
  checkRoleplay?: boolean;
  /** Check for hypothetical scenarios */
  checkHypothetical?: boolean;
  /** Custom patterns */
  customPatterns?: RegExp[];
}

/**
 * Jailbreak detection details
 */
export interface JailbreakDetails {
  /** Types of jailbreak detected */
  jailbreakTypes: string[];
  /** Matched patterns */
  patterns: string[];
  /** Risk score (0-1) */
  riskScore: number;
}

/**
 * Known jailbreak patterns
 */
const JAILBREAK_PATTERNS: Array<{
  name: string;
  pattern: RegExp;
  weight: number;
}> = [
  // DAN (Do Anything Now) patterns
  {
    name: 'dan_prompt',
    pattern: /\b(DAN|do\s+anything\s+now)\b/gi,
    weight: 0.9,
  },
  {
    name: 'dan_mode',
    pattern: /\b(DAN|developer|jailbreak)\s+mode\b/gi,
    weight: 0.9,
  },

  // Evil/uncensored mode patterns
  {
    name: 'evil_mode',
    pattern:
      /\b(evil|uncensored|unfiltered|unrestricted)\s+(mode|version|AI)\b/gi,
    weight: 0.8,
  },
  {
    name: 'no_limits',
    pattern:
      /\b(without|no)\s+(limits?|restrictions?|filters?|censorship|boundaries)\b/gi,
    weight: 0.7,
  },

  // Roleplay bypass attempts
  {
    name: 'roleplay_evil',
    pattern:
      /\b(roleplay|act|pretend)\s+(as|like)\s+(an?\s+)?(evil|malicious|unethical)\b/gi,
    weight: 0.8,
  },
  {
    name: 'fictional_bypass',
    pattern:
      /\b(in\s+)?this\s+(fictional|hypothetical|imaginary)\s+(world|scenario|story)\b/gi,
    weight: 0.5,
  },

  // Character impersonation
  {
    name: 'impersonate_unrestricted',
    pattern:
      /\b(impersonate|become|transform\s+into)\s+(an?\s+)?(unrestricted|unfiltered|uncensored)\b/gi,
    weight: 0.8,
  },
  {
    name: 'two_responses',
    pattern:
      /\b(give|provide)\s+(me\s+)?(two|2|both)\s+(responses?|answers?)\b/gi,
    weight: 0.6,
  },

  // Ignore safety patterns
  {
    name: 'ignore_safety',
    pattern:
      /\b(ignore|bypass|skip|disable)\s+(safety|ethical|moral)\s+(guidelines?|rules?|restrictions?)\b/gi,
    weight: 0.9,
  },
  {
    name: 'override_training',
    pattern:
      /\b(override|bypass|ignore)\s+(your\s+)?(training|programming|instructions?)\b/gi,
    weight: 0.9,
  },

  // Hypothetical framing
  {
    name: 'hypothetical_harm',
    pattern:
      /\bhypothetically,?\s+(how\s+(would|could)|if\s+someone\s+wanted\s+to)\b/gi,
    weight: 0.6,
  },
  {
    name: 'educational_harm',
    pattern: /\bfor\s+(educational|research|academic)\s+purposes?\s+only\b/gi,
    weight: 0.4,
  },

  // Token smuggling
  {
    name: 'token_smuggling',
    pattern: /\b(split|encode|obfuscate)\s+(the\s+)?(words?|text|message)\b/gi,
    weight: 0.5,
  },

  // Positive reinforcement manipulation
  {
    name: 'reward_manipulation',
    pattern:
      /\bI('ll|'m\s+going\s+to)\s+(give|reward)\s+you\s+(points?|tokens?|credits?)\b/gi,
    weight: 0.6,
  },

  // Threat-based manipulation
  {
    name: 'threat_manipulation',
    pattern:
      /\bif\s+you\s+(don't|refuse|fail),?\s+(I('ll|'m)|someone\s+will)\b/gi,
    weight: 0.5,
  },
];

/**
 * Jailbreak Guard
 *
 * Detects attempts to bypass AI safety measures.
 */
export class JailbreakGuard extends BaseGuard<void, JailbreakDetails> {
  readonly name = 'jailbreak';
  readonly supportedTypes: ContentType[] = ['input'];

  private patterns: Array<{ name: string; pattern: RegExp; weight: number }>;
  private checkDAN: boolean;
  private checkRoleplay: boolean;
  private checkHypothetical: boolean;

  constructor(options: JailbreakGuardOptions = {}) {
    super(options);
    this.checkDAN = options.checkDAN ?? true;
    this.checkRoleplay = options.checkRoleplay ?? true;
    this.checkHypothetical = options.checkHypothetical ?? true;

    // Filter patterns based on options
    this.patterns = JAILBREAK_PATTERNS.filter((p) => {
      if (!this.checkDAN && p.name.startsWith('dan_')) return false;
      if (
        !this.checkRoleplay &&
        (p.name.includes('roleplay') || p.name.includes('impersonate'))
      )
        return false;
      if (!this.checkHypothetical && p.name.includes('hypothetical'))
        return false;
      return true;
    });

    // Add custom patterns
    if (options.customPatterns) {
      this.patterns.push(
        ...options.customPatterns.map((p, i) => ({
          name: `custom_${i}`,
          pattern: p,
          weight: 0.7,
        })),
      );
    }
  }

  protected doCheck(
    context: GuardContext,
  ): Promise<GuardResult<JailbreakDetails>> {
    const { input } = context;
    const jailbreakTypes: string[] = [];
    const matchedPatterns: string[] = [];
    const detections: DetectionDetail[] = [];
    let totalWeight = 0;
    let matchWeight = 0;

    // Pattern matching
    for (const { name, pattern, weight } of this.patterns) {
      totalWeight += weight;
      const regex = new RegExp(pattern.source, pattern.flags);
      const matches = input.match(regex);

      if (matches) {
        jailbreakTypes.push(name);
        matchedPatterns.push(...matches);
        matchWeight += weight;

        for (const match of matches) {
          const index = input.toLowerCase().indexOf(match.toLowerCase());
          detections.push({
            category: 'jailbreak',
            pattern: name,
            startIndex: index,
            endIndex: index + match.length,
            matchedText: match,
          });
        }
      }
    }

    // Calculate risk score based on weighted matches
    const riskScore =
      totalWeight > 0 ? Math.min(1, matchWeight / (totalWeight * 0.3)) : 0;

    const details: JailbreakDetails = {
      jailbreakTypes,
      patterns: matchedPatterns,
      riskScore,
    };

    if (
      jailbreakTypes.length > 0 &&
      riskScore >= (this.config.threshold ?? 0.5)
    ) {
      return Promise.resolve(
        this.withConfidence(
          this.fail(
            `Jailbreak attempt detected: ${jailbreakTypes.join(', ')}`,
            details,
            detections,
          ),
          riskScore,
        ),
      );
    }

    // Warn on lower confidence matches
    if (jailbreakTypes.length > 0) {
      return Promise.resolve(
        this.warn(
          `Suspicious patterns detected: ${jailbreakTypes.join(', ')}`,
          details,
          detections,
        ),
      );
    }

    return Promise.resolve(this.pass(details, 'No jailbreak attempt detected'));
  }
}

// Register the guard
GuardRegistry.register({
  metadata: {
    name: 'jailbreak',
    description:
      'Detects jailbreak attempts designed to bypass AI safety measures',
    category: 'security',
    supportedTypes: ['input'],
    defaultConfig: {
      enabled: true,
      onFailure: 'block',
      threshold: 0.5,
      sensitivity: 'high',
    },
  },
  factory: (config) => new JailbreakGuard(config),
});

export default JailbreakGuard;
