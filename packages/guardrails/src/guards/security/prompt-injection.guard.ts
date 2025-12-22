/**
 * Prompt Injection Guard
 *
 * Detects prompt injection attempts in user input.
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
 * Prompt injection guard configuration
 */
export interface PromptInjectionGuardOptions extends Partial<GuardConfig> {
  /** Additional patterns to check */
  customPatterns?: RegExp[];
  /** Use heuristic analysis */
  useHeuristics?: boolean;
  /** Check for delimiter attacks */
  checkDelimiters?: boolean;
}

/**
 * Prompt injection detection details
 */
export interface PromptInjectionDetails {
  /** Types of injection detected */
  injectionTypes: string[];
  /** Matched patterns */
  patterns: string[];
  /** Heuristic indicators found */
  heuristics: string[];
  /** Risk score (0-1) */
  riskScore: number;
}

/**
 * Common prompt injection patterns
 */
const INJECTION_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  // System prompt manipulation
  {
    name: 'system_override',
    pattern:
      /\b(ignore|forget|disregard)\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?|context)\b/gi,
  },
  {
    name: 'new_instructions',
    pattern:
      /\b(new|updated?|revised?)\s+(instructions?|prompt|rules?|context)\s*[:]/gi,
  },
  {
    name: 'system_prompt',
    pattern: /\b(system\s*[:]\s*|you\s+are\s+(now\s+)?a)/gi,
  },

  // Role manipulation
  {
    name: 'role_switch',
    pattern:
      /\b(pretend|act|behave|imagine|roleplay)\s+(you('re|\s+are)|as\s+(if|though))\b/gi,
  },
  {
    name: 'character_assign',
    pattern: /\byou\s+are\s+(now\s+)?(called|named|a|an|the)\b/gi,
  },

  // Delimiter attacks
  {
    name: 'delimiter_end',
    pattern:
      /(<\/?system>|<\/?user>|<\/?assistant>|\[\/?(INST|SYS)\]|```(end|stop|system))/gi,
  },
  {
    name: 'prompt_termination',
    pattern: /\b(end\s+of\s+(system\s+)?prompt|prompt\s+ends?\s+here)\b/gi,
  },

  // Direct command patterns
  {
    name: 'direct_command',
    pattern:
      /\b(execute|run|perform|do)\s+(this|the\s+following)\s+(command|action|task)\b/gi,
  },
  {
    name: 'override_command',
    pattern:
      /\b(override|bypass|skip|disable)\s+(safety|filter|guard|check|restriction)\b/gi,
  },

  // Meta-prompt attacks
  {
    name: 'reveal_prompt',
    pattern:
      /\b(reveal|show|display|print|output)\s+(your\s+)?(system\s+)?(prompt|instructions?|rules?)\b/gi,
  },
  {
    name: 'internal_state',
    pattern:
      /\b(what\s+(are|is)\s+your|show\s+me\s+your)\s+(instructions?|prompt|system\s+message)\b/gi,
  },

  // Special token attacks
  {
    name: 'special_tokens',
    pattern: /<\|(?:im_start|im_end|endoftext|pad|sep)\|>/gi,
  },
];

/**
 * Heuristic indicators for injection attempts
 */
const HEURISTIC_INDICATORS = [
  {
    name: 'excessive_caps',
    check: (text: string) => {
      const words = text.split(/\s+/);
      const capsWords = words.filter(
        (w) => w === w.toUpperCase() && w.length > 2,
      );
      return capsWords.length > words.length * 0.3;
    },
  },
  {
    name: 'instruction_keywords',
    check: (text: string) => {
      const keywords = [
        'must',
        'always',
        'never',
        'important',
        'critical',
        'mandatory',
      ];
      const count = keywords.filter((k) =>
        text.toLowerCase().includes(k),
      ).length;
      return count >= 3;
    },
  },
  {
    name: 'unusual_formatting',
    check: (text: string) => {
      return /[#*_]{3,}|={5,}|-{5,}/.test(text);
    },
  },
  {
    name: 'base64_content',
    check: (text: string) => {
      return /[A-Za-z0-9+/]{50,}={0,2}/.test(text);
    },
  },
  {
    name: 'xml_like_tags',
    check: (text: string) => {
      return /<[a-z_]+>[^<]*<\/[a-z_]+>/gi.test(text);
    },
  },
];

/**
 * Prompt Injection Guard
 *
 * Detects various forms of prompt injection attacks.
 */
export class PromptInjectionGuard extends BaseGuard<
  void,
  PromptInjectionDetails
> {
  readonly name = 'prompt-injection';
  readonly supportedTypes: ContentType[] = ['input'];

  private patterns: Array<{ name: string; pattern: RegExp }>;
  private useHeuristics: boolean;
  private checkDelimiters: boolean;

  constructor(options: PromptInjectionGuardOptions = {}) {
    super(options);
    this.patterns = [
      ...INJECTION_PATTERNS,
      ...(options.customPatterns?.map((p, i) => ({
        name: `custom_${i}`,
        pattern: p,
      })) ?? []),
    ];
    this.useHeuristics = options.useHeuristics ?? true;
    this.checkDelimiters = options.checkDelimiters ?? true;
  }

  protected doCheck(
    context: GuardContext,
  ): Promise<GuardResult<PromptInjectionDetails>> {
    const { input } = context;
    const injectionTypes: string[] = [];
    const matchedPatterns: string[] = [];
    const heuristics: string[] = [];
    const detections: DetectionDetail[] = [];

    // Pattern matching
    for (const { name, pattern } of this.patterns) {
      const regex = new RegExp(pattern.source, pattern.flags);
      const matches = input.match(regex);

      if (matches) {
        injectionTypes.push(name);
        matchedPatterns.push(...matches);

        for (const match of matches) {
          const index = input.toLowerCase().indexOf(match.toLowerCase());
          detections.push({
            category: 'prompt-injection',
            pattern: name,
            startIndex: index,
            endIndex: index + match.length,
            matchedText: match,
          });
        }
      }
    }

    // Heuristic analysis
    if (this.useHeuristics) {
      for (const indicator of HEURISTIC_INDICATORS) {
        if (indicator.check(input)) {
          heuristics.push(indicator.name);
        }
      }
    }

    // Calculate risk score
    const patternScore = Math.min(1, injectionTypes.length * 0.25);
    const heuristicScore = Math.min(0.5, heuristics.length * 0.15);
    const riskScore = Math.min(1, patternScore + heuristicScore);

    const details: PromptInjectionDetails = {
      injectionTypes,
      patterns: matchedPatterns,
      heuristics,
      riskScore,
    };

    if (injectionTypes.length > 0) {
      return Promise.resolve(
        this.withConfidence(
          this.fail(
            `Prompt injection detected: ${injectionTypes.join(', ')}`,
            details,
            detections,
          ),
          riskScore,
        ),
      );
    }

    // Warn if heuristics triggered but no patterns matched
    if (heuristics.length >= 2) {
      return Promise.resolve(
        this.warn(
          `Suspicious content detected: ${heuristics.join(', ')}`,
          details,
        ),
      );
    }

    return Promise.resolve(this.pass(details, 'No prompt injection detected'));
  }
}

// Register the guard
GuardRegistry.register({
  metadata: {
    name: 'prompt-injection',
    description: 'Detects prompt injection attempts in user input',
    category: 'security',
    supportedTypes: ['input'],
    defaultConfig: {
      enabled: true,
      onFailure: 'block',
      threshold: 0.5,
      sensitivity: 'high',
    },
  },
  factory: (config) => new PromptInjectionGuard(config),
});

export default PromptInjectionGuard;
