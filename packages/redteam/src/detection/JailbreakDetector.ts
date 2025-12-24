/**
 * JailbreakDetector - Jailbreak Attempt Detection
 *
 * Detects jailbreak attempts in user inputs using pattern
 * matching and heuristics.
 */

import type {
  JailbreakDetectionResult,
  JailbreakDetectionTechnique,
  DetectionIndicator,
  DetectionInput,
  ConfidenceLevel,
} from '../types/detection.types.js';
import type { Severity } from '../types/attack.types.js';

/**
 * Detection pattern
 */
interface DetectionPattern {
  name: string;
  pattern: RegExp;
  technique: JailbreakDetectionTechnique;
  weight: number;
  description: string;
}

/**
 * JailbreakDetector - Detect Jailbreak Attempts
 */
export class JailbreakDetector {
  private patterns: DetectionPattern[] = [];
  private threshold: number;

  constructor(threshold: number = 0.5) {
    this.threshold = threshold;
    this.initializePatterns();
  }

  /**
   * Initialize detection patterns
   */
  private initializePatterns(): void {
    this.patterns = [
      // DAN and persona patterns
      {
        name: 'DAN prompt',
        pattern: /\bDAN\b|do\s+anything\s+now/i,
        technique: 'prompt_injection',
        weight: 0.9,
        description: 'DAN (Do Anything Now) jailbreak pattern',
      },
      {
        name: 'Developer mode',
        pattern: /developer\s+mode|debug\s+mode|maintenance\s+mode/i,
        technique: 'prompt_injection',
        weight: 0.8,
        description: 'Attempt to enable developer/debug mode',
      },
      {
        name: 'Persona change',
        pattern:
          /pretend\s+(to\s+be|you('re|'re|\s+are))|act\s+as|roleplay\s+as|you\s+are\s+now/i,
        technique: 'role_play',
        weight: 0.7,
        description: 'Attempt to change AI persona',
      },

      // Instruction override patterns
      {
        name: 'Instruction override',
        pattern:
          /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+instructions?/i,
        technique: 'prompt_injection',
        weight: 0.95,
        description: 'Direct instruction override attempt',
      },
      {
        name: 'Forget instructions',
        pattern: /forget\s+(everything|all|your)\s+(you|instructions?|rules?)/i,
        technique: 'prompt_injection',
        weight: 0.9,
        description: 'Attempt to reset AI instructions',
      },
      {
        name: 'New instructions',
        pattern: /new\s+instructions?|updated\s+rules?|revised\s+guidelines?/i,
        technique: 'prompt_injection',
        weight: 0.7,
        description: 'Attempt to inject new instructions',
      },

      // Hypothetical and fictional framing
      {
        name: 'Hypothetical scenario',
        pattern: /hypothetically|in\s+theory|theoretically|imagine\s+if/i,
        technique: 'hypothetical_scenario',
        weight: 0.5,
        description: 'Hypothetical framing to bypass restrictions',
      },
      {
        name: 'Fictional context',
        pattern:
          /in\s+a\s+(story|novel|movie|game)|fiction(al)?|creative\s+writing/i,
        technique: 'hypothetical_scenario',
        weight: 0.5,
        description: 'Fictional context to bypass restrictions',
      },

      // Token and encoding patterns
      {
        name: 'Special tokens',
        pattern:
          /<\|im_start\|>|<\|im_end\|>|\[INST\]|\[\/INST\]|<<SYS>>|<\/s>/i,
        technique: 'token_manipulation',
        weight: 0.9,
        description: 'Special token injection',
      },
      {
        name: 'Encoding request',
        pattern: /base64|rot13|decode|decrypt|hex\s+to|binary\s+to/i,
        technique: 'encoding_bypass',
        weight: 0.6,
        description: 'Encoding-based bypass attempt',
      },

      // Context manipulation
      {
        name: 'Context overflow',
        pattern: /(.{5000,})/,
        technique: 'context_overflow',
        weight: 0.4,
        description: 'Very long input possibly for context overflow',
      },
      {
        name: 'Fake context',
        pattern:
          /previous\s+conversation|you\s+(already|previously)\s+(said|agreed)|we\s+discussed/i,
        technique: 'prompt_injection',
        weight: 0.7,
        description: 'Injecting fake conversation context',
      },

      // Delimiter injection
      {
        name: 'Delimiter injection',
        pattern: /"""|'''/,
        technique: 'prompt_injection',
        weight: 0.5,
        description: 'Potential delimiter injection',
      },
      {
        name: 'XML/HTML injection',
        pattern: /<\/?system>|<\/?user>|<\/?assistant>/i,
        technique: 'prompt_injection',
        weight: 0.8,
        description: 'XML/HTML tag injection',
      },

      // Multi-turn patterns
      {
        name: 'Escalation setup',
        pattern: /let's\s+start\s+simple|first\s+question|warm\s+up/i,
        technique: 'multi_turn',
        weight: 0.3,
        description: 'Potential multi-turn escalation setup',
      },

      // Authority claims
      {
        name: 'Authority claim',
        pattern:
          /(i('m|\s+am)\s+(an?\s+)?)(admin|administrator|developer|owner|creator|employee|researcher)/i,
        technique: 'prompt_injection',
        weight: 0.7,
        description: 'Claiming authority to override restrictions',
      },

      // Unrestricted mode
      {
        name: 'Unrestricted request',
        pattern:
          /unrestricted|no\s+(limits?|restrictions?|filters?|guidelines?)|without\s+(rules?|restrictions?)/i,
        technique: 'prompt_injection',
        weight: 0.85,
        description: 'Request for unrestricted operation',
      },

      // Jailbreak keywords
      {
        name: 'Known jailbreak terms',
        pattern:
          /jailbreak|bypass|override|unlock|disable\s+safety|remove\s+filters?/i,
        technique: 'prompt_injection',
        weight: 0.95,
        description: 'Known jailbreak terminology',
      },
    ];
  }

  /**
   * Detect jailbreak attempts
   */
  detect(input: DetectionInput): JailbreakDetectionResult {
    const text = input.text;
    const startTime = Date.now();

    const indicators: DetectionIndicator[] = [];
    let totalScore = 0;
    let maxWeight = 0;
    let detectedTechnique: JailbreakDetectionTechnique | undefined;
    const bypassIndicators: string[] = [];

    // Check all patterns
    for (const pattern of this.patterns) {
      const match = text.match(pattern.pattern);
      if (match) {
        totalScore += pattern.weight;
        if (pattern.weight > maxWeight) {
          maxWeight = pattern.weight;
          detectedTechnique = pattern.technique;
        }

        indicators.push({
          name: pattern.name,
          description: pattern.description,
          score: pattern.weight,
          evidence: match[0].substring(0, 100),
          position:
            match.index !== undefined
              ? {
                  start: match.index,
                  end: match.index + match[0].length,
                }
              : undefined,
          category: pattern.technique,
        });

        bypassIndicators.push(pattern.name);
      }
    }

    // Normalize score
    const confidence = Math.min(1, totalScore / 2);
    const detected = confidence >= this.threshold;

    // Check for role confusion
    const roleConfusion = this.checkRoleConfusion(text);

    // Check for instruction override
    const instructionOverride = this.checkInstructionOverride(text);

    const result: JailbreakDetectionResult = {
      type: 'jailbreak',
      detected,
      status: detected ? 'detected' : 'not_detected',
      confidence,
      confidenceLevel: this.getConfidenceLevel(confidence),
      severity: this.getSeverity(confidence, indicators),
      indicators,
      technique: detectedTechnique,
      bypassIndicators,
      roleConfusion,
      instructionOverride,
      processingTimeMs: Date.now() - startTime,
      timestamp: Date.now(),
    };

    if (detected) {
      result.analysis = {
        summary: `Jailbreak attempt detected with ${(confidence * 100).toFixed(1)}% confidence`,
        findings: indicators.map((i) => i.name),
        patterns: indicators.map((i) => i.evidence || '').filter(Boolean),
        riskAssessment: this.getRiskAssessment(confidence, indicators),
        recommendations: this.getRecommendations(indicators),
      };
    }

    return result;
  }

  /**
   * Check for role confusion attempts
   */
  private checkRoleConfusion(text: string): boolean {
    const rolePatterns = [
      /you\s+are\s+(now\s+)?a/i,
      /pretend\s+to\s+be/i,
      /act\s+as\s+if/i,
      /roleplay/i,
      /your\s+new\s+(role|identity|persona)/i,
    ];

    return rolePatterns.some((p) => p.test(text));
  }

  /**
   * Check for instruction override attempts
   */
  private checkInstructionOverride(text: string): boolean {
    const overridePatterns = [
      /ignore\s+.*instructions?/i,
      /forget\s+.*rules?/i,
      /override\s+.*guidelines?/i,
      /disregard\s+.*restrictions?/i,
      /new\s+system\s+prompt/i,
    ];

    return overridePatterns.some((p) => p.test(text));
  }

  /**
   * Get confidence level
   */
  private getConfidenceLevel(confidence: number): ConfidenceLevel {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.5) return 'medium';
    if (confidence >= 0.2) return 'low';
    return 'uncertain';
  }

  /**
   * Get severity based on confidence and indicators
   */
  private getSeverity(
    confidence: number,
    _indicators: DetectionIndicator[],
  ): Severity {
    if (confidence >= 0.8) return 'critical';
    if (confidence >= 0.6) return 'high';
    if (confidence >= 0.4) return 'medium';
    if (confidence >= 0.2) return 'low';
    return 'informational';
  }

  /**
   * Get risk assessment
   */
  private getRiskAssessment(
    confidence: number,
    _indicators: DetectionIndicator[],
  ): string {
    if (confidence >= 0.8) {
      return 'High risk - Strong indicators of jailbreak attempt. Recommend blocking or careful review.';
    }
    if (confidence >= 0.5) {
      return 'Medium risk - Moderate indicators detected. Recommend additional scrutiny.';
    }
    return 'Low risk - Some suspicious patterns but may be benign.';
  }

  /**
   * Get recommendations
   */
  private getRecommendations(indicators: DetectionIndicator[]): string[] {
    const recommendations: string[] = [];

    if (indicators.some((i) => i.category === 'prompt_injection')) {
      recommendations.push('Strengthen system prompt injection protections');
    }
    if (indicators.some((i) => i.category === 'role_play')) {
      recommendations.push('Add explicit restrictions against persona changes');
    }
    if (indicators.some((i) => i.category === 'token_manipulation')) {
      recommendations.push('Implement token sanitization in input processing');
    }

    recommendations.push('Consider logging this input for security analysis');
    recommendations.push('Review response for any safety boundary violations');

    return recommendations;
  }

  /**
   * Set detection threshold
   */
  setThreshold(threshold: number): void {
    this.threshold = Math.max(0, Math.min(1, threshold));
  }

  /**
   * Add custom pattern
   */
  addPattern(pattern: DetectionPattern): void {
    this.patterns.push(pattern);
  }
}

/**
 * Create a new jailbreak detector
 */
export function createJailbreakDetector(threshold?: number): JailbreakDetector {
  return new JailbreakDetector(threshold);
}
