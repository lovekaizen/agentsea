/**
 * Optimization Types
 *
 * Type definitions for cost optimization recommendations.
 */

import type { AIProvider } from './cost.types.js';
import type { AttributionDimension } from './attribution.types.js';

/**
 * Optimization category
 */
export type OptimizationCategory =
  | 'model-selection'
  | 'prompt-optimization'
  | 'caching'
  | 'batching'
  | 'rate-limiting'
  | 'usage-pattern'
  | 'provider-switch'
  | 'feature-optimization';

/**
 * Optimization impact level
 */
export type ImpactLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Optimization effort level
 */
export type EffortLevel = 'trivial' | 'easy' | 'medium' | 'hard';

/**
 * Optimization status
 */
export type OptimizationStatus =
  | 'identified'
  | 'in_progress'
  | 'implemented'
  | 'dismissed'
  | 'verified';

/**
 * Optimization recommendation
 */
export interface OptimizationRecommendation {
  /** Recommendation ID */
  id: string;
  /** Title */
  title: string;
  /** Description */
  description: string;
  /** Category */
  category: OptimizationCategory;
  /** Impact level */
  impact: ImpactLevel;
  /** Implementation effort */
  effort: EffortLevel;
  /** Estimated monthly savings */
  estimatedSavings: number;
  /** Confidence in estimate (0-1) */
  confidence: number;
  /** Priority score (higher = more important) */
  priorityScore: number;
  /** Affected dimension */
  affectedDimension?: AttributionDimension;
  /** Affected dimension value */
  affectedValue?: string;
  /** Current state */
  currentState: OptimizationCurrentState;
  /** Recommended action */
  recommendedAction: OptimizationAction;
  /** Implementation steps */
  implementationSteps?: string[];
  /** Risks and considerations */
  risks?: string[];
  /** Status */
  status: OptimizationStatus;
  /** Created at */
  createdAt: Date;
  /** Updated at */
  updatedAt: Date;
  /** Implemented at */
  implementedAt?: Date;
  /** Verified savings */
  verifiedSavings?: number;
}

/**
 * Current state for optimization
 */
export interface OptimizationCurrentState {
  /** Current monthly cost */
  currentCost: number;
  /** Current usage metrics */
  currentUsage: {
    requests: number;
    tokens: number;
    avgTokensPerRequest: number;
  };
  /** Time period analyzed */
  period: {
    start: Date;
    end: Date;
  };
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Optimization action
 */
export interface OptimizationAction {
  /** Action type */
  type: OptimizationActionType;
  /** Target model (for model switches) */
  targetModel?: string;
  /** Target provider */
  targetProvider?: AIProvider;
  /** Parameters */
  parameters?: Record<string, unknown>;
  /** Expected new cost */
  expectedCost: number;
  /** Expected savings percentage */
  expectedSavingsPercent: number;
}

/**
 * Optimization action type
 */
export type OptimizationActionType =
  | 'switch-model'
  | 'switch-provider'
  | 'enable-caching'
  | 'implement-batching'
  | 'optimize-prompts'
  | 'reduce-output-tokens'
  | 'implement-rate-limiting'
  | 'remove-redundant-calls'
  | 'consolidate-requests'
  | 'adjust-parameters'
  | 'custom';

/**
 * Model switch recommendation
 */
export interface ModelSwitchRecommendation extends OptimizationRecommendation {
  category: 'model-selection';
  /** Current model */
  currentModel: string;
  /** Current provider */
  currentProvider: AIProvider;
  /** Recommended model */
  recommendedModel: string;
  /** Recommended provider */
  recommendedProvider: AIProvider;
  /** Quality comparison */
  qualityComparison: {
    /** Estimated quality difference (-100 to 100) */
    qualityDelta: number;
    /** Quality metrics */
    metrics?: {
      name: string;
      current: number;
      expected: number;
    }[];
  };
  /** Latency comparison */
  latencyComparison?: {
    currentAvgMs: number;
    expectedAvgMs: number;
    delta: number;
  };
}

/**
 * Caching recommendation
 */
export interface CachingRecommendation extends OptimizationRecommendation {
  category: 'caching';
  /** Cache hit rate potential */
  potentialHitRate: number;
  /** Cacheable request percentage */
  cacheablePercent: number;
  /** Repeated request patterns */
  patterns: CacheablePattern[];
  /** Recommended cache TTL */
  recommendedTtl?: number;
}

/**
 * Cacheable pattern
 */
export interface CacheablePattern {
  /** Pattern description */
  pattern: string;
  /** Occurrence count */
  count: number;
  /** Cost of repetitions */
  repetitionCost: number;
  /** Sample (anonymized) */
  sample?: string;
}

/**
 * Prompt optimization recommendation
 */
export interface PromptOptimizationRecommendation
  extends OptimizationRecommendation {
  category: 'prompt-optimization';
  /** Current average input tokens */
  currentAvgInputTokens: number;
  /** Target average input tokens */
  targetAvgInputTokens: number;
  /** Optimization techniques */
  techniques: PromptOptimizationTechnique[];
}

/**
 * Prompt optimization technique
 */
export interface PromptOptimizationTechnique {
  /** Technique name */
  name: string;
  /** Description */
  description: string;
  /** Potential token reduction */
  potentialReduction: number;
  /** Example before */
  before?: string;
  /** Example after */
  after?: string;
}

/**
 * Optimization analyzer configuration
 */
export interface OptimizationAnalyzerConfig {
  /** Minimum savings threshold to report */
  minSavingsThreshold?: number;
  /** Analysis period in days */
  analysisPeriod?: number;
  /** Categories to analyze */
  categories?: OptimizationCategory[];
  /** Minimum confidence threshold */
  minConfidence?: number;
  /** Include low-impact recommendations */
  includeLowImpact?: boolean;
  /** Custom model quality mappings */
  modelQualityMappings?: Record<string, number>;
}

/**
 * Optimization analysis result
 */
export interface OptimizationAnalysisResult {
  /** Analysis timestamp */
  analyzedAt: Date;
  /** Analysis period */
  period: {
    start: Date;
    end: Date;
  };
  /** Total current cost */
  totalCurrentCost: number;
  /** Total potential savings */
  totalPotentialSavings: number;
  /** Savings percentage */
  savingsPercentage: number;
  /** Recommendations */
  recommendations: OptimizationRecommendation[];
  /** By category summary */
  byCategory: {
    category: OptimizationCategory;
    count: number;
    totalSavings: number;
  }[];
  /** Top opportunities */
  topOpportunities: OptimizationRecommendation[];
  /** Quick wins (high impact, low effort) */
  quickWins: OptimizationRecommendation[];
}

/**
 * Optimization tracking
 */
export interface OptimizationTracking {
  /** Recommendation ID */
  recommendationId: string;
  /** Status history */
  statusHistory: {
    status: OptimizationStatus;
    timestamp: Date;
    by?: string;
    notes?: string;
  }[];
  /** Cost before implementation */
  costBefore?: number;
  /** Cost after implementation */
  costAfter?: number;
  /** Actual savings */
  actualSavings?: number;
  /** Verification period */
  verificationPeriod?: {
    start: Date;
    end: Date;
  };
}

/**
 * A/B test for optimization
 */
export interface OptimizationABTest {
  /** Test ID */
  id: string;
  /** Recommendation being tested */
  recommendationId: string;
  /** Control group (current setup) */
  control: {
    model: string;
    provider: AIProvider;
    parameters?: Record<string, unknown>;
  };
  /** Treatment group (optimization) */
  treatment: {
    model: string;
    provider: AIProvider;
    parameters?: Record<string, unknown>;
  };
  /** Traffic split (0-1) */
  trafficSplit: number;
  /** Metrics to compare */
  metrics: string[];
  /** Status */
  status: 'draft' | 'running' | 'paused' | 'completed';
  /** Start date */
  startDate?: Date;
  /** End date */
  endDate?: Date;
  /** Results */
  results?: OptimizationABTestResults;
}

/**
 * A/B test results
 */
export interface OptimizationABTestResults {
  /** Sample sizes */
  sampleSizes: {
    control: number;
    treatment: number;
  };
  /** Cost comparison */
  cost: {
    control: number;
    treatment: number;
    savings: number;
    savingsPercent: number;
    pValue?: number;
    isSignificant: boolean;
  };
  /** Quality metrics */
  quality?: {
    metric: string;
    control: number;
    treatment: number;
    pValue?: number;
    isSignificant: boolean;
  }[];
  /** Latency comparison */
  latency?: {
    controlAvgMs: number;
    treatmentAvgMs: number;
    pValue?: number;
    isSignificant: boolean;
  };
  /** Recommendation */
  recommendation: 'adopt' | 'reject' | 'extend-test' | 'inconclusive';
}
