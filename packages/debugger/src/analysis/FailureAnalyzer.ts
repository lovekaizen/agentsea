/**
 * FailureAnalyzer
 *
 * Analyzes failed agent executions to identify root causes.
 */

import type {
  Recording,
  ExecutionStep,
  FailureAnalysis,
  ContributingFactor,
  Recommendation,
  StepType,
} from '../types/index.js';
import { generateId, now } from '../utils/helpers.js';

/**
 * Analysis options
 */
export interface AnalysisOptions {
  /** Include detailed step analysis */
  includeDetailedSteps?: boolean;
  /** Include memory analysis */
  includeMemoryAnalysis?: boolean;
  /** Include timing analysis */
  includeTimingAnalysis?: boolean;
  /** Custom pattern matchers */
  customPatterns?: FailurePattern[];
}

/**
 * Failure pattern definition
 */
export interface FailurePattern {
  /** Pattern ID */
  id: string;
  /** Pattern name */
  name: string;
  /** Description */
  description: string;
  /** Pattern matcher function */
  matcher: (recording: Recording, steps: ExecutionStep[]) => boolean;
  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Recommendations for this pattern */
  recommendations: string[];
}

/**
 * Step analysis result
 */
export interface StepAnalysis {
  /** Step index */
  stepIndex: number;
  /** Step type */
  type: StepType;
  /** Whether this step is suspicious */
  suspicious: boolean;
  /** Suspicion reasons */
  reasons: string[];
  /** Related steps */
  relatedSteps: number[];
}

/**
 * Default failure patterns
 */
const DEFAULT_PATTERNS: FailurePattern[] = [
  {
    id: 'repeated_tool_failure',
    name: 'Repeated Tool Failures',
    description: 'The same tool failed multiple times in succession',
    matcher: (recording, steps) => {
      const toolFailures = steps.filter(
        (s) => s.type === 'tool-result' && s.toolCall && !s.toolCall.success,
      );
      if (toolFailures.length < 2) return false;

      // Check for consecutive failures of same tool
      for (let i = 0; i < toolFailures.length - 1; i++) {
        if (
          toolFailures[i].toolCall?.name === toolFailures[i + 1].toolCall?.name
        ) {
          return true;
        }
      }
      return false;
    },
    severity: 'high',
    recommendations: [
      'Add retry logic with exponential backoff',
      'Implement fallback tools',
      'Add input validation before tool calls',
    ],
  },
  {
    id: 'low_confidence_decision',
    name: 'Low Confidence Decision',
    description: 'A critical decision was made with low confidence',
    matcher: (recording, steps) => {
      return steps.some(
        (s) =>
          s.type === 'decision' && s.decision && s.decision.confidence < 0.5,
      );
    },
    severity: 'medium',
    recommendations: [
      'Gather more context before making decisions',
      'Request clarification from user for ambiguous cases',
      'Add confidence thresholds that trigger fallback behavior',
    ],
  },
  {
    id: 'infinite_loop',
    name: 'Potential Infinite Loop',
    description: 'Similar steps repeated many times without progress',
    matcher: (recording, steps) => {
      const stepTypes = steps.map((s) => s.type);
      const windowSize = 10;

      for (let i = 0; i < stepTypes.length - windowSize * 2; i++) {
        const window1 = stepTypes.slice(i, i + windowSize).join(',');
        const window2 = stepTypes
          .slice(i + windowSize, i + windowSize * 2)
          .join(',');

        if (window1 === window2) {
          return true;
        }
      }
      return false;
    },
    severity: 'critical',
    recommendations: [
      'Add loop detection and break conditions',
      'Track state changes to detect lack of progress',
      'Implement maximum iteration limits',
    ],
  },
  {
    id: 'missing_context',
    name: 'Missing Context',
    description: 'Tool or decision made without required context',
    matcher: (recording, steps) => {
      // Check for tool calls immediately after input without context gathering
      for (let i = 0; i < steps.length - 1; i++) {
        if (steps[i].type === 'input' && steps[i + 1].type === 'tool-call') {
          return true;
        }
      }
      return false;
    },
    severity: 'low',
    recommendations: [
      'Add context gathering step before tool calls',
      'Use memory retrieval to provide relevant context',
      'Implement input analysis before action',
    ],
  },
  {
    id: 'memory_overflow',
    name: 'Memory Issues',
    description: 'Memory size grew excessively during execution',
    matcher: (recording) => {
      const initialSize = recording.initialState.memory.size;
      const finalSize = recording.finalState?.memory?.size ?? 0;
      return finalSize > initialSize * 10 && finalSize > 1024 * 1024; // 1MB
    },
    severity: 'medium',
    recommendations: [
      'Implement memory compaction',
      'Add memory limits and eviction policies',
      'Summarize long conversations',
    ],
  },
  {
    id: 'timeout_likely',
    name: 'Slow Execution',
    description: 'Execution took excessively long, possibly due to timeouts',
    matcher: (recording) => {
      const avgDuration = recording.durationMs / recording.steps.length;
      return avgDuration > 10000; // Average > 10 seconds per step
    },
    severity: 'medium',
    recommendations: [
      'Add timeout handling for external calls',
      'Implement caching for repeated operations',
      'Optimize tool implementations',
    ],
  },
];

/**
 * FailureAnalyzer
 *
 * Analyzes failed agent executions to identify root causes.
 *
 * @example
 * ```typescript
 * const analyzer = new FailureAnalyzer();
 *
 * // Analyze a failed recording
 * const analysis = analyzer.analyze(recording);
 *
 * // Get recommendations
 * console.log('Root cause:', analysis.rootCause);
 * console.log('Recommendations:', analysis.recommendations);
 *
 * // Analyze specific steps
 * const stepAnalysis = analyzer.analyzeSteps(recording.steps);
 * ```
 */
export class FailureAnalyzer {
  private patterns: FailurePattern[];
  private options: Required<AnalysisOptions>;

  constructor(options?: AnalysisOptions) {
    this.options = {
      includeDetailedSteps: options?.includeDetailedSteps ?? true,
      includeMemoryAnalysis: options?.includeMemoryAnalysis ?? true,
      includeTimingAnalysis: options?.includeTimingAnalysis ?? true,
      customPatterns: options?.customPatterns ?? [],
    };

    this.patterns = [...DEFAULT_PATTERNS, ...this.options.customPatterns];
  }

  /**
   * Analyze a failed recording
   */
  analyze(recording: Recording): FailureAnalysis {
    const contributingFactors = this.findContributingFactors(recording);
    const rootCause = this.determineRootCause(recording, contributingFactors);
    const recommendations = this.generateRecommendations(contributingFactors);
    const errorStepIndex = this.findErrorStep(recording);

    return {
      id: generateId('analysis'),
      recordingId: recording.id,
      analyzedAt: now(),
      rootCause,
      contributingFactors,
      recommendations,
      errorStepIndex,
      errorMessage: this.getErrorMessage(recording, errorStepIndex),
      stackTrace: this.getStackTrace(recording, errorStepIndex),
      severity: this.calculateOverallSeverity(contributingFactors),
      confidence: this.calculateConfidence(contributingFactors),
    };
  }

  /**
   * Find contributing factors
   */
  private findContributingFactors(recording: Recording): ContributingFactor[] {
    const factors: ContributingFactor[] = [];

    // Check all patterns
    for (const pattern of this.patterns) {
      if (pattern.matcher(recording, recording.steps)) {
        factors.push({
          id: generateId('factor'),
          type: pattern.id,
          description: pattern.description,
          severity: pattern.severity,
          stepIndices: this.findPatternSteps(recording, pattern),
          evidence: this.gatherEvidence(recording, pattern),
        });
      }
    }

    // Add error-specific factors
    const errorSteps = recording.steps.filter((s) => s.error);
    for (const step of errorSteps) {
      factors.push({
        id: generateId('factor'),
        type: 'explicit_error',
        description: step.error?.message ?? 'Unknown error',
        severity: 'high',
        stepIndices: [step.index],
        evidence: {
          errorName: step.error?.name,
          errorMessage: step.error?.message,
          errorStack: step.error?.stack,
        },
      });
    }

    // Sort by severity
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    factors.sort(
      (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
    );

    return factors;
  }

  /**
   * Find steps related to a pattern
   */
  private findPatternSteps(
    recording: Recording,
    pattern: FailurePattern,
  ): number[] {
    const indices: number[] = [];

    switch (pattern.id) {
      case 'repeated_tool_failure':
        for (const step of recording.steps) {
          if (
            step.type === 'tool-result' &&
            step.toolCall &&
            !step.toolCall.success
          ) {
            indices.push(step.index);
          }
        }
        break;

      case 'low_confidence_decision':
        for (const step of recording.steps) {
          if (
            step.type === 'decision' &&
            step.decision &&
            step.decision.confidence < 0.5
          ) {
            indices.push(step.index);
          }
        }
        break;

      default:
        // Return error steps by default
        for (const step of recording.steps) {
          if (step.error) {
            indices.push(step.index);
          }
        }
    }

    return indices;
  }

  /**
   * Gather evidence for a pattern
   */
  private gatherEvidence(
    recording: Recording,
    pattern: FailurePattern,
  ): Record<string, unknown> {
    const evidence: Record<string, unknown> = {
      patternId: pattern.id,
      patternName: pattern.name,
    };

    switch (pattern.id) {
      case 'repeated_tool_failure': {
        const failures = recording.steps.filter(
          (s) => s.type === 'tool-result' && s.toolCall && !s.toolCall.success,
        );
        evidence.failedTools = failures.map((s) => s.toolCall?.name);
        evidence.failureCount = failures.length;
        break;
      }

      case 'low_confidence_decision': {
        const lowConfidence = recording.steps.filter(
          (s) =>
            s.type === 'decision' && s.decision && s.decision.confidence < 0.5,
        );
        evidence.decisions = lowConfidence.map((s) => ({
          step: s.index,
          confidence: s.decision?.confidence,
          reason: s.decision?.reason,
        }));
        break;
      }

      case 'timeout_likely':
        evidence.totalDuration = recording.durationMs;
        evidence.avgStepDuration =
          recording.durationMs / recording.steps.length;
        break;

      case 'memory_overflow':
        evidence.initialMemorySize = recording.initialState.memory.size;
        evidence.finalMemorySize = recording.finalState?.memory?.size ?? 0;
        evidence.growth =
          (recording.finalState?.memory?.size ?? 0) /
          recording.initialState.memory.size;
        break;
    }

    return evidence;
  }

  /**
   * Determine the root cause
   */
  private determineRootCause(
    recording: Recording,
    factors: ContributingFactor[],
  ): string {
    // Check for explicit error first
    const explicitError = factors.find((f) => f.type === 'explicit_error');
    if (explicitError) {
      return explicitError.description;
    }

    // Use highest severity factor
    if (factors.length > 0) {
      return factors[0].description;
    }

    // Default analysis
    if (recording.status === 'failed') {
      return 'Execution failed without clear error indication';
    }

    return 'No failure detected';
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    factors: ContributingFactor[],
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const seenRecommendations = new Set<string>();

    for (const factor of factors) {
      const pattern = this.patterns.find((p) => p.id === factor.type);

      if (pattern) {
        for (const rec of pattern.recommendations) {
          if (!seenRecommendations.has(rec)) {
            seenRecommendations.add(rec);
            recommendations.push({
              id: generateId('rec'),
              priority: this.getPriorityFromSeverity(factor.severity),
              title: rec,
              description: `Based on pattern: ${pattern.name}`,
              relatedFactors: [factor.id],
            });
          }
        }
      }
    }

    // Sort by priority
    recommendations.sort((a, b) => a.priority - b.priority);

    return recommendations;
  }

  /**
   * Get priority from severity
   */
  private getPriorityFromSeverity(
    severity: ContributingFactor['severity'],
  ): number {
    switch (severity) {
      case 'critical':
        return 1;
      case 'high':
        return 2;
      case 'medium':
        return 3;
      case 'low':
        return 4;
      default:
        return 5;
    }
  }

  /**
   * Find the error step
   */
  private findErrorStep(recording: Recording): number | undefined {
    // Find first step with error
    for (const step of recording.steps) {
      if (step.error) {
        return step.index;
      }
    }

    // Find last failed tool call
    for (let i = recording.steps.length - 1; i >= 0; i--) {
      const step = recording.steps[i];
      if (
        step.type === 'tool-result' &&
        step.toolCall &&
        !step.toolCall.success
      ) {
        return step.index;
      }
    }

    return undefined;
  }

  /**
   * Get error message
   */
  private getErrorMessage(
    recording: Recording,
    stepIndex?: number,
  ): string | undefined {
    if (stepIndex === undefined) {
      return undefined;
    }

    const step = recording.steps[stepIndex];
    return (
      step?.error?.message ?? (step?.toolCall?.result as string | undefined)
    );
  }

  /**
   * Get stack trace
   */
  private getStackTrace(
    recording: Recording,
    stepIndex?: number,
  ): string | undefined {
    if (stepIndex === undefined) {
      return undefined;
    }

    const step = recording.steps[stepIndex];
    return step?.error?.stack;
  }

  /**
   * Calculate overall severity
   */
  private calculateOverallSeverity(
    factors: ContributingFactor[],
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (factors.length === 0) {
      return 'low';
    }

    const severities = factors.map((f) => f.severity);

    if (severities.includes('critical')) return 'critical';
    if (severities.includes('high')) return 'high';
    if (severities.includes('medium')) return 'medium';
    return 'low';
  }

  /**
   * Calculate analysis confidence
   */
  private calculateConfidence(factors: ContributingFactor[]): number {
    if (factors.length === 0) {
      return 0.3;
    }

    // More factors with more evidence = higher confidence
    let confidenceSum = 0;

    for (const factor of factors) {
      let factorConfidence = 0.5;

      if (factor.type === 'explicit_error') {
        factorConfidence = 0.95;
      } else if (Object.keys(factor.evidence ?? {}).length > 2) {
        factorConfidence = 0.8;
      }

      confidenceSum += factorConfidence;
    }

    return Math.min(confidenceSum / factors.length, 0.99);
  }

  /**
   * Analyze individual steps
   */
  analyzeSteps(steps: ExecutionStep[]): StepAnalysis[] {
    const analyses: StepAnalysis[] = [];

    for (const step of steps) {
      const analysis: StepAnalysis = {
        stepIndex: step.index,
        type: step.type,
        suspicious: false,
        reasons: [],
        relatedSteps: [],
      };

      // Check for errors
      if (step.error) {
        analysis.suspicious = true;
        analysis.reasons.push(`Error: ${step.error.message}`);
      }

      // Check for failed tool calls
      if (
        step.type === 'tool-result' &&
        step.toolCall &&
        !step.toolCall.success
      ) {
        analysis.suspicious = true;
        analysis.reasons.push(`Tool ${step.toolCall.name} failed`);
      }

      // Check for low confidence decisions
      if (
        step.type === 'decision' &&
        step.decision &&
        step.decision.confidence < 0.5
      ) {
        analysis.suspicious = true;
        analysis.reasons.push(
          `Low confidence decision (${step.decision.confidence})`,
        );
      }

      // Check for unusually long duration
      if (step.durationMs && step.durationMs > 30000) {
        analysis.suspicious = true;
        analysis.reasons.push(`Long duration (${step.durationMs}ms)`);
      }

      analyses.push(analysis);
    }

    return analyses;
  }

  /**
   * Add a custom pattern
   */
  addPattern(pattern: FailurePattern): void {
    this.patterns.push(pattern);
  }

  /**
   * Remove a pattern
   */
  removePattern(patternId: string): boolean {
    const index = this.patterns.findIndex((p) => p.id === patternId);
    if (index >= 0) {
      this.patterns.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get all patterns
   */
  getPatterns(): FailurePattern[] {
    return [...this.patterns];
  }
}

/**
 * Create a failure analyzer
 */
export function createFailureAnalyzer(
  options?: AnalysisOptions,
): FailureAnalyzer {
  return new FailureAnalyzer(options);
}
