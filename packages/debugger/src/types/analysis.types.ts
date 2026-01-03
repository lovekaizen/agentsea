/**
 * Analysis Types
 *
 * Type definitions for failure analysis and what-if scenarios.
 */

import type { AgentState } from './debugger.types.js';
import type { ReplayDifference, ReplayModification } from './replay.types.js';

/**
 * Failure analysis result
 */
export interface FailureAnalysis {
  /** Analysis ID */
  id: string;
  /** Recording ID */
  recordingId: string;
  /** Analysis timestamp */
  analyzedAt: number;
  /** Root cause description */
  rootCause: string;
  /** Contributing factors */
  contributingFactors: ContributingFactor[];
  /** Recommendations */
  recommendations: Recommendation[];
  /** Error step index */
  errorStepIndex?: number;
  /** Error message */
  errorMessage?: string;
  /** Stack trace */
  stackTrace?: string;
  /** Severity */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Confidence */
  confidence: number;
}

/**
 * Contributing factor
 */
export interface ContributingFactor {
  /** Factor ID */
  id: string;
  /** Factor type */
  type: string;
  /** Factor description */
  description: string;
  /** Severity */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Step indices */
  stepIndices: number[];
  /** Evidence */
  evidence?: Record<string, unknown>;
}

/**
 * Recommendation
 */
export interface Recommendation {
  /** Recommendation ID */
  id: string;
  /** Priority (1 = highest) */
  priority: number;
  /** Title */
  title: string;
  /** Description */
  description: string;
  /** Related factor IDs */
  relatedFactors: string[];
}

/**
 * What-if scenario
 */
export interface WhatIfScenario {
  /** Scenario ID */
  id: string;
  /** Scenario name */
  name: string;
  /** Description */
  description?: string;
  /** Base recording ID */
  baseRecordingId: string;
  /** Modifications */
  modifications: ReplayModification[];
  /** Status */
  status: ScenarioStatus;
  /** Created at */
  createdAt: number;
}

/**
 * Scenario status
 */
export type ScenarioStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * Scenario result
 */
export interface ScenarioResult {
  /** Scenario ID */
  scenarioId: string;
  /** Success */
  success: boolean;
  /** Original recording ID */
  originalRecordingId: string;
  /** Modified steps count */
  modifiedSteps: number;
  /** Differences */
  differences: ReplayDifference[];
  /** Divergence point */
  divergencePoint?: number;
  /** Final state */
  finalState: AgentState;
  /** Executed at */
  executedAt: number;
  /** Duration */
  durationMs: number;
}

/**
 * Scenario comparison
 */
export interface ScenarioComparison {
  /** Scenario ID */
  scenarioId: string;
  /** Scenario name */
  scenarioName: string;
  /** Original recording ID */
  originalRecordingId: string;
  /** Outcome changed */
  outcomeChanged: boolean;
  /** Divergence point */
  divergencePoint?: number;
  /** Divergence percentage */
  divergencePercentage: number;
  /** Differences */
  differences: ReplayDifference[];
  /** Summary */
  summary: string;
}

/**
 * Performance profile
 */
export interface PerformanceProfile {
  /** Recording ID */
  recordingId: string;
  /** Total duration */
  totalDurationMs: number;
  /** LLM time */
  llmTimeMs: number;
  /** Tool execution time */
  toolTimeMs: number;
  /** Overhead time */
  overheadMs: number;
  /** Token metrics */
  tokens: {
    total: number;
    perSecond: number;
    costUSD: number;
  };
  /** Bottlenecks */
  bottlenecks: Bottleneck[];
  /** Step performance */
  stepPerformance: StepPerformance[];
}

/**
 * Bottleneck
 */
export interface Bottleneck {
  /** Step index */
  stepIndex: number;
  /** Type */
  type: 'slow-tool' | 'slow-llm' | 'large-context' | 'retry';
  /** Description */
  description: string;
  /** Duration */
  durationMs: number;
  /** Percentage of total time */
  percentage: number;
  /** Suggestion */
  suggestion?: string;
}

/**
 * Step performance
 */
export interface StepPerformance {
  /** Step index */
  stepIndex: number;
  /** Step type */
  type: string;
  /** Duration */
  durationMs: number;
  /** Tokens used */
  tokensUsed: number;
  /** Is bottleneck */
  isBottleneck: boolean;
}

/**
 * Factor category
 */
export type FactorCategory =
  | 'tool-failure'
  | 'context-issue'
  | 'decision-error'
  | 'resource-limit'
  | 'external-dependency'
  | 'configuration'
  | 'unknown';

/**
 * Similar failure reference
 */
export interface SimilarFailure {
  /** Recording ID */
  recordingId: string;
  /** Similarity score */
  similarity: number;
  /** Matching factors */
  matchingFactors: string[];
  /** Timestamp */
  timestamp: number;
}

/**
 * Comparison metric
 */
export interface ComparisonMetric {
  /** Metric name */
  name: string;
  /** Original value */
  original: number;
  /** Modified value */
  modified: number;
  /** Delta */
  delta: number;
  /** Delta percentage */
  deltaPercent: number;
  /** Is improvement */
  improved: boolean;
}

/**
 * Input variation type
 */
export type InputVariationType =
  | 'text-change'
  | 'context-addition'
  | 'context-removal'
  | 'tool-result-change'
  | 'state-modification';

/**
 * Input variation for what-if scenarios
 */
export interface InputVariation {
  /** Variation ID */
  id: string;
  /** Variation type */
  type: InputVariationType;
  /** Step index to apply at */
  stepIndex: number;
  /** Original value */
  original: unknown;
  /** Modified value */
  modified: unknown;
  /** Description */
  description?: string;
}

/**
 * Path analysis result
 */
export interface PathAnalysis {
  /** Recording ID */
  recordingId: string;
  /** Total paths identified */
  totalPaths: number;
  /** Critical decision points */
  criticalPoints: number[];
  /** Alternative paths */
  alternatives: AlternativePathAnalysis[];
  /** Optimal path (if identified) */
  optimalPath?: string;
}

/**
 * Alternative path analysis
 */
export interface AlternativePathAnalysis {
  /** Path ID */
  id: string;
  /** Decision point step index */
  decisionPoint: number;
  /** Alternative option taken */
  alternativeOption: string;
  /** Predicted outcome */
  predictedOutcome: string;
  /** Confidence */
  confidence: number;
  /** Cost difference */
  costDelta?: number;
}
