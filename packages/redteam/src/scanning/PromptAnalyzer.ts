/**
 * PromptAnalyzer - Prompt Security Analysis
 *
 * Analyzes prompts for security vulnerabilities, quality issues,
 * and potential injection risks.
 */

import type {
  PromptAnalysisConfig,
  PromptAnalysisResult,
  PromptAnalysisType,
  PromptTypeAnalysis,
  PromptIssue,
  PromptSuggestion,
  PromptSecurityAssessment,
  SecurityPattern,
} from '../types/scanning.types.js';
import type { Severity } from '../types/attack.types.js';

/**
 * Analysis patterns
 */
interface AnalysisPattern {
  name: string;
  pattern: RegExp;
  severity: Severity;
  description: string;
  category: 'security' | 'quality' | 'clarity' | 'bias' | 'effectiveness';
}

/**
 * PromptAnalyzer - Analyze Prompt Security and Quality
 */
export class PromptAnalyzer {
  private securityPatterns: AnalysisPattern[] = [];
  private qualityPatterns: AnalysisPattern[] = [];

  constructor() {
    this.initializePatterns();
  }

  /**
   * Initialize analysis patterns
   */
  private initializePatterns(): void {
    // Security patterns
    this.securityPatterns = [
      {
        name: 'Direct instruction override',
        pattern:
          /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+instructions?/i,
        severity: 'critical',
        description: 'Potential injection attempting to override instructions',
        category: 'security',
      },
      {
        name: 'Role manipulation',
        pattern: /(you\s+are\s+now|pretend\s+to\s+be|act\s+as|roleplay\s+as)/i,
        severity: 'high',
        description: 'Attempt to change AI persona or role',
        category: 'security',
      },
      {
        name: 'System prompt extraction',
        pattern:
          /(what\s+(are|is)\s+your\s+(system|initial)\s+(prompt|instruction))|(show\s+me\s+your\s+prompt)/i,
        severity: 'high',
        description: 'Attempt to extract system prompt',
        category: 'security',
      },
      {
        name: 'Delimiter injection',
        pattern: /("""|\[system\]|<\/?system>|---\s*system|<\|im_start\|>)/i,
        severity: 'high',
        description: 'Potential delimiter injection attack',
        category: 'security',
      },
      {
        name: 'Encoded content',
        pattern: /(base64|decode|decrypt|rot13|hex\s+decode)/i,
        severity: 'medium',
        description: 'Request involving encoded content',
        category: 'security',
      },
      {
        name: 'Jailbreak indicators',
        pattern:
          /(DAN|developer\s+mode|unrestricted|no\s+limits|without\s+restrictions)/i,
        severity: 'critical',
        description: 'Known jailbreak pattern detected',
        category: 'security',
      },
      {
        name: 'Fake context',
        pattern:
          /(previous\s+conversation|you\s+already\s+agreed|we\s+discussed|you\s+said\s+yes)/i,
        severity: 'medium',
        description: 'Attempt to inject fake conversation context',
        category: 'security',
      },
    ];

    // Quality patterns
    this.qualityPatterns = [
      {
        name: 'Ambiguous instruction',
        pattern: /^(do\s+something|help\s+me|i\s+need|please)$/i,
        severity: 'low',
        description: 'Prompt is too vague or ambiguous',
        category: 'quality',
      },
      {
        name: 'Missing context',
        pattern: /^.{0,20}$/,
        severity: 'low',
        description: 'Prompt may be too short to provide adequate context',
        category: 'clarity',
      },
      {
        name: 'Contradictory instructions',
        pattern: /(but\s+also|however\s+always|never\s+but\s+sometimes)/i,
        severity: 'medium',
        description: 'Potentially contradictory instructions',
        category: 'clarity',
      },
    ];
  }

  /**
   * Analyze a prompt
   */
  analyze(config: PromptAnalysisConfig): PromptAnalysisResult {
    const prompt = config.prompt;
    const analysisTypes = config.analysisTypes || [
      'structure',
      'security',
      'quality',
    ];

    const result: PromptAnalysisResult = {
      prompt,
      overallScore: 100,
      analyses: {} as Record<PromptAnalysisType, PromptTypeAnalysis>,
      issues: [],
      suggestions: [],
      processingTimeMs: 0,
    };

    const startTime = Date.now();

    // Run each analysis type
    for (const type of analysisTypes) {
      result.analyses[type] = this.runAnalysis(type, prompt, config);
    }

    // Check for security issues
    if (config.checkInjections !== false) {
      const securityIssues = this.checkSecurityPatterns(prompt);
      result.issues.push(...securityIssues);
    }

    // Check for sensitive data
    if (config.checkSensitiveData) {
      const sensitiveIssues = this.checkSensitiveData(prompt);
      result.issues.push(...sensitiveIssues);
    }

    // Generate security assessment
    result.securityAssessment = this.generateSecurityAssessment(
      prompt,
      result.issues,
    );

    // Generate suggestions
    result.suggestions = this.generateSuggestions(
      result.issues,
      result.analyses,
    );

    // Calculate overall score
    result.overallScore = this.calculateOverallScore(result);

    result.processingTimeMs = Date.now() - startTime;
    return result;
  }

  /**
   * Run specific analysis type
   */
  private runAnalysis(
    type: PromptAnalysisType,
    prompt: string,
    _config: PromptAnalysisConfig,
  ): PromptTypeAnalysis {
    switch (type) {
      case 'structure':
        return this.analyzeStructure(prompt);
      case 'security':
        return this.analyzeSecurity(prompt);
      case 'quality':
        return this.analyzeQuality(prompt);
      case 'effectiveness':
        return this.analyzeEffectiveness(prompt);
      case 'bias':
        return this.analyzeBias(prompt);
      case 'clarity':
        return this.analyzeClarity(prompt);
      case 'completeness':
        return this.analyzeCompleteness(prompt);
      default:
        return { score: 100, findings: [] };
    }
  }

  /**
   * Analyze prompt structure
   */
  private analyzeStructure(prompt: string): PromptTypeAnalysis {
    const findings: string[] = [];
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    let score = 100;

    // Check length
    if (prompt.length < 50) {
      findings.push('Prompt is quite short');
      weaknesses.push('May lack sufficient detail');
      score -= 10;
    } else if (prompt.length > 4000) {
      findings.push('Prompt is very long');
      weaknesses.push('May exceed context limits or cause confusion');
      score -= 5;
    } else {
      strengths.push('Appropriate length');
    }

    // Check for clear sections
    const hasSections = /\n\n|\n-|\n\d\.|###|##/.test(prompt);
    if (hasSections) {
      strengths.push('Has clear structural elements');
    } else if (prompt.length > 200) {
      findings.push('Long prompt without clear sections');
      weaknesses.push('Could benefit from better organization');
      score -= 5;
    }

    // Check for instructions
    const hasInstructions = /(must|should|always|never|do not|please)/i.test(
      prompt,
    );
    if (hasInstructions) {
      strengths.push('Contains clear instructions');
    } else {
      findings.push('No clear instructions detected');
      weaknesses.push('May need more directive language');
      score -= 5;
    }

    return { score, findings, strengths, weaknesses };
  }

  /**
   * Analyze security aspects
   */
  private analyzeSecurity(prompt: string): PromptTypeAnalysis {
    const findings: string[] = [];
    const weaknesses: string[] = [];
    let score = 100;

    // Check security patterns
    for (const pattern of this.securityPatterns) {
      if (pattern.pattern.test(prompt)) {
        findings.push(`Detected: ${pattern.name}`);
        weaknesses.push(pattern.description);

        switch (pattern.severity) {
          case 'critical':
            score -= 30;
            break;
          case 'high':
            score -= 20;
            break;
          case 'medium':
            score -= 10;
            break;
          case 'low':
            score -= 5;
            break;
        }
      }
    }

    // Check for sensitive data patterns
    if (/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/.test(prompt)) {
      findings.push('Contains email address');
      weaknesses.push('May leak PII if in system prompt');
      score -= 5;
    }

    if (/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/.test(prompt)) {
      findings.push('Contains phone number pattern');
      weaknesses.push('May leak PII if in system prompt');
      score -= 5;
    }

    return {
      score: Math.max(0, score),
      findings,
      weaknesses,
      strengths:
        findings.length === 0
          ? ['No obvious security issues detected']
          : undefined,
    };
  }

  /**
   * Analyze quality
   */
  private analyzeQuality(prompt: string): PromptTypeAnalysis {
    const findings: string[] = [];
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    let score = 100;

    // Grammar/spelling indicators (basic)
    const wordCount = prompt.split(/\s+/).length;
    const sentenceCount = prompt.split(/[.!?]+/).filter((s) => s.trim()).length;

    if (wordCount > 0 && sentenceCount > 0) {
      const avgWordsPerSentence = wordCount / sentenceCount;
      if (avgWordsPerSentence > 30) {
        findings.push('Very long sentences detected');
        weaknesses.push('Sentences may be too complex');
        score -= 5;
      }
    }

    // Check for clear purpose
    const hasPurpose =
      /(help|assist|provide|generate|create|analyze|explain|summarize)/i.test(
        prompt,
      );
    if (hasPurpose) {
      strengths.push('Clear action/purpose specified');
    } else {
      findings.push('No clear action verb detected');
      weaknesses.push('Purpose may be unclear');
      score -= 5;
    }

    // Check for specificity
    const hasSpecifics =
      /\b(specifically|exactly|precise|must include|required)\b/i.test(prompt);
    if (hasSpecifics) {
      strengths.push('Contains specific requirements');
    }

    return { score, findings, strengths, weaknesses };
  }

  /**
   * Analyze effectiveness
   */
  private analyzeEffectiveness(prompt: string): PromptTypeAnalysis {
    const findings: string[] = [];
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    let score = 100;

    // Check for examples
    const hasExamples = /(for example|e\.g\.|such as|like this)/i.test(prompt);
    if (hasExamples) {
      strengths.push('Includes examples');
    } else if (prompt.length > 200) {
      findings.push('Complex prompt without examples');
      weaknesses.push('Examples could improve understanding');
      score -= 5;
    }

    // Check for constraints
    const hasConstraints =
      /(do not|don't|never|avoid|limit|maximum|minimum)/i.test(prompt);
    if (hasConstraints) {
      strengths.push('Includes constraints/boundaries');
    }

    // Check for output format
    const hasFormat = /(format|json|markdown|bullet|numbered|list)/i.test(
      prompt,
    );
    if (hasFormat) {
      strengths.push('Specifies output format');
    }

    return { score, findings, strengths, weaknesses };
  }

  /**
   * Analyze for bias
   */
  private analyzeBias(prompt: string): PromptTypeAnalysis {
    const findings: string[] = [];
    const weaknesses: string[] = [];
    let score = 100;

    // Check for potentially biased language
    const biasIndicators = [
      {
        pattern: /\b(obviously|clearly|everyone knows)\b/i,
        issue: 'Assumes universal agreement',
      },
      {
        pattern: /\b(always|never|all|none)\b/i,
        issue: 'Absolute language may indicate bias',
      },
      {
        pattern: /\b(should|must)\s+(believe|think|agree)\b/i,
        issue: 'Prescriptive belief language',
      },
    ];

    for (const indicator of biasIndicators) {
      if (indicator.pattern.test(prompt)) {
        findings.push(indicator.issue);
        score -= 5;
      }
    }

    return {
      score,
      findings,
      strengths:
        findings.length === 0
          ? ['No obvious bias indicators detected']
          : undefined,
      weaknesses: findings.length > 0 ? weaknesses : undefined,
    };
  }

  /**
   * Analyze clarity
   */
  private analyzeClarity(prompt: string): PromptTypeAnalysis {
    const findings: string[] = [];
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    let score = 100;

    // Check readability (basic Flesch-like)
    const words = prompt.split(/\s+/);
    const avgWordLength =
      words.reduce((sum, w) => sum + w.length, 0) / words.length;

    if (avgWordLength > 7) {
      findings.push('Uses many long/complex words');
      weaknesses.push('May be difficult to process');
      score -= 5;
    } else {
      strengths.push('Uses accessible vocabulary');
    }

    // Check for jargon without explanation
    const jargonPatterns =
      /\b(API|SDK|CLI|GUI|JSON|XML|SQL|HTTP|HTTPS|REST|GraphQL)\b/;
    if (jargonPatterns.test(prompt)) {
      findings.push('Contains technical jargon');
      weaknesses.push('May need explanation for non-technical contexts');
    }

    return { score, findings, strengths, weaknesses };
  }

  /**
   * Analyze completeness
   */
  private analyzeCompleteness(prompt: string): PromptTypeAnalysis {
    const findings: string[] = [];
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    let score = 100;

    // Check for what/why/how
    const hasWhat = /(what|which|describe|explain what)/i.test(prompt);
    const hasWhy = /(why|reason|purpose|goal)/i.test(prompt);
    const hasHow = /(how|step|process|method)/i.test(prompt);

    if (hasWhat) strengths.push('Specifies what is needed');
    if (hasWhy) strengths.push('Includes context/purpose');
    if (hasHow) strengths.push('Indicates expected approach');

    if (!hasWhat && !hasHow) {
      findings.push('Missing clear objective');
      weaknesses.push('Could specify what output is expected');
      score -= 10;
    }

    return { score, findings, strengths, weaknesses };
  }

  /**
   * Check security patterns
   */
  private checkSecurityPatterns(prompt: string): PromptIssue[] {
    const issues: PromptIssue[] = [];

    for (const pattern of this.securityPatterns) {
      const match = prompt.match(pattern.pattern);
      if (match) {
        issues.push({
          type: 'security',
          severity: pattern.severity,
          description: `${pattern.name}: ${pattern.description}`,
          location:
            match.index !== undefined
              ? {
                  start: match.index,
                  end: match.index + match[0].length,
                }
              : undefined,
          recommendation: 'Review and sanitize this content before processing',
        });
      }
    }

    return issues;
  }

  /**
   * Check for sensitive data
   */
  private checkSensitiveData(prompt: string): PromptIssue[] {
    const issues: PromptIssue[] = [];

    const sensitivePatterns = [
      {
        pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        type: 'email',
      },
      { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, type: 'phone' },
      { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, type: 'SSN' },
      { pattern: /\b\d{16}\b/g, type: 'potential card number' },
      {
        pattern: /\b(api[_-]?key|secret|password|token)\s*[:=]\s*[^\s]+/gi,
        type: 'credential',
      },
    ];

    for (const { pattern, type } of sensitivePatterns) {
      const matches = prompt.matchAll(pattern);
      for (const match of matches) {
        issues.push({
          type: 'security',
          severity: type === 'credential' ? 'critical' : 'high',
          description: `Potential ${type} detected in prompt`,
          location: {
            start: match.index,
            end: match.index + match[0].length,
          },
          recommendation: `Remove or redact ${type} before including in prompts`,
        });
      }
    }

    return issues;
  }

  /**
   * Generate security assessment
   */
  private generateSecurityAssessment(
    prompt: string,
    issues: PromptIssue[],
  ): PromptSecurityAssessment {
    const securityIssues = issues.filter((i) => i.type === 'security');

    let securityScore = 100;
    let injectionVulnerability = 0;
    let dataLeakageRisk = 0;
    let jailbreakSusceptibility = 0;

    const detectedPatterns: SecurityPattern[] = [];

    for (const issue of securityIssues) {
      securityScore -=
        issue.severity === 'critical'
          ? 30
          : issue.severity === 'high'
            ? 20
            : issue.severity === 'medium'
              ? 10
              : 5;

      // Categorize
      if (
        issue.description.toLowerCase().includes('injection') ||
        issue.description.toLowerCase().includes('override')
      ) {
        injectionVulnerability += 0.2;
      }
      if (
        issue.description.toLowerCase().includes('extract') ||
        issue.description.toLowerCase().includes('leak') ||
        issue.description.toLowerCase().includes('credential')
      ) {
        dataLeakageRisk += 0.2;
      }
      if (
        issue.description.toLowerCase().includes('jailbreak') ||
        issue.description.toLowerCase().includes('dan') ||
        issue.description.toLowerCase().includes('role')
      ) {
        jailbreakSusceptibility += 0.2;
      }

      detectedPatterns.push({
        name: issue.description.split(':')[0],
        risk: issue.severity,
        description: issue.description,
        location: issue.location,
      });
    }

    return {
      securityScore: Math.max(0, securityScore),
      injectionVulnerability: Math.min(1, injectionVulnerability),
      dataLeakageRisk: Math.min(1, dataLeakageRisk),
      jailbreakSusceptibility: Math.min(1, jailbreakSusceptibility),
      detectedPatterns,
      recommendations: this.getSecurityRecommendations(securityIssues),
    };
  }

  /**
   * Get security recommendations
   */
  private getSecurityRecommendations(issues: PromptIssue[]): string[] {
    const recommendations: string[] = [];

    if (issues.some((i) => i.description.toLowerCase().includes('injection'))) {
      recommendations.push(
        'Implement input sanitization to prevent prompt injection',
      );
    }
    if (issues.some((i) => i.description.toLowerCase().includes('jailbreak'))) {
      recommendations.push('Use a strong system prompt with clear boundaries');
    }
    if (issues.some((i) => i.description.toLowerCase().includes('extract'))) {
      recommendations.push('Avoid including sensitive information in prompts');
    }
    if (
      issues.some((i) => i.description.toLowerCase().includes('credential'))
    ) {
      recommendations.push(
        'Never include credentials in prompts - use environment variables',
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('No major security concerns detected');
    }

    return recommendations;
  }

  /**
   * Generate suggestions
   */
  private generateSuggestions(
    issues: PromptIssue[],
    analyses: Record<PromptAnalysisType, PromptTypeAnalysis>,
  ): PromptSuggestion[] {
    const suggestions: PromptSuggestion[] = [];

    // From issues
    for (const issue of issues.slice(0, 5)) {
      suggestions.push({
        type: 'improvement',
        description: issue.recommendation,
        expectedImprovement: `Resolves ${issue.severity} ${issue.type} issue`,
        priority:
          issue.severity === 'critical'
            ? 'high'
            : issue.severity === 'high'
              ? 'high'
              : 'medium',
      });
    }

    // From analyses
    for (const [type, analysis] of Object.entries(analyses)) {
      if (analysis.weaknesses) {
        for (const weakness of analysis.weaknesses.slice(0, 2)) {
          suggestions.push({
            type: 'improvement',
            description: `Improve ${type}: ${weakness}`,
            expectedImprovement: 'Better prompt effectiveness',
            priority: 'low',
          });
        }
      }
    }

    return suggestions;
  }

  /**
   * Calculate overall score
   */
  private calculateOverallScore(result: PromptAnalysisResult): number {
    let totalScore = 0;
    let count = 0;

    for (const analysis of Object.values(result.analyses)) {
      totalScore += analysis.score;
      count++;
    }

    // Deduct for issues
    const issuePenalty = result.issues.reduce((sum, issue) => {
      return (
        sum +
        (issue.severity === 'critical'
          ? 15
          : issue.severity === 'high'
            ? 10
            : issue.severity === 'medium'
              ? 5
              : 2)
      );
    }, 0);

    const avgScore = count > 0 ? totalScore / count : 100;
    return Math.max(0, Math.min(100, avgScore - issuePenalty));
  }
}

/**
 * Create a new prompt analyzer
 */
export function createPromptAnalyzer(): PromptAnalyzer {
  return new PromptAnalyzer();
}
