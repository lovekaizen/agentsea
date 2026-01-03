/**
 * Detection Types for Runtime Safety Monitoring
 */

import type { Severity } from './attack.types.js';

/**
 * Detection type identifiers
 */
export type DetectionType =
  | 'jailbreak'
  | 'prompt_injection'
  | 'data_leakage'
  | 'bias'
  | 'toxicity'
  | 'hallucination'
  | 'pii_exposure'
  | 'harmful_content'
  | 'manipulation'
  | 'off_topic'
  | 'custom';

/**
 * Detection confidence level
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'uncertain';

/**
 * Detection status
 */
export type DetectionStatus =
  | 'detected'
  | 'not_detected'
  | 'uncertain'
  | 'error';

/**
 * Base detection result
 */
export interface DetectionResult {
  /** Detection type */
  type: DetectionType;
  /** Whether threat was detected */
  detected: boolean;
  /** Status */
  status: DetectionStatus;
  /** Confidence score (0-1) */
  confidence: number;
  /** Confidence level */
  confidenceLevel: ConfidenceLevel;
  /** Severity if detected */
  severity?: Severity;
  /** Indicators found */
  indicators: DetectionIndicator[];
  /** Analysis details */
  analysis?: DetectionAnalysis;
  /** Processing time in ms */
  processingTimeMs: number;
  /** Timestamp */
  timestamp: number;
  /** Error if any */
  error?: string;
}

/**
 * Detection indicator
 */
export interface DetectionIndicator {
  /** Indicator name */
  name: string;
  /** Description */
  description: string;
  /** Score contribution (0-1) */
  score: number;
  /** Evidence */
  evidence?: string;
  /** Position in text if applicable */
  position?: {
    start: number;
    end: number;
  };
  /** Category */
  category?: string;
}

/**
 * Detection analysis
 */
export interface DetectionAnalysis {
  /** Summary */
  summary: string;
  /** Detailed findings */
  findings: string[];
  /** Patterns matched */
  patterns?: string[];
  /** Risk assessment */
  riskAssessment?: string;
  /** Recommendations */
  recommendations?: string[];
}

/**
 * Jailbreak detection result
 */
export interface JailbreakDetectionResult extends DetectionResult {
  type: 'jailbreak';
  /** Jailbreak technique detected */
  technique?: JailbreakDetectionTechnique;
  /** Attack vector */
  attackVector?: string;
  /** Bypass indicators */
  bypassIndicators: string[];
  /** Role confusion detected */
  roleConfusion: boolean;
  /** Instruction override detected */
  instructionOverride: boolean;
}

/**
 * Jailbreak detection techniques
 */
export type JailbreakDetectionTechnique =
  | 'prompt_injection'
  | 'role_play'
  | 'hypothetical_scenario'
  | 'token_manipulation'
  | 'instruction_hierarchy'
  | 'context_overflow'
  | 'encoding_bypass'
  | 'multi_turn'
  | 'unknown';

/**
 * Data leakage detection result
 */
export interface DataLeakageDetectionResult extends DetectionResult {
  type: 'data_leakage';
  /** Type of data leaked */
  leakedDataTypes: LeakedDataType[];
  /** Specific items found */
  leakedItems: LeakedItem[];
  /** Source of leakage */
  source?:
    | 'system_prompt'
    | 'training_data'
    | 'user_data'
    | 'tool_output'
    | 'unknown';
  /** Exposure severity */
  exposureSeverity: Severity;
}

/**
 * Leaked data types
 */
export type LeakedDataType =
  | 'system_prompt'
  | 'api_key'
  | 'credential'
  | 'pii'
  | 'internal_instruction'
  | 'training_example'
  | 'configuration'
  | 'custom';

/**
 * Leaked item detail
 */
export interface LeakedItem {
  /** Data type */
  type: LeakedDataType;
  /** Value or pattern */
  value: string;
  /** Whether redacted */
  redacted: boolean;
  /** Confidence */
  confidence: number;
  /** Context */
  context?: string;
}

/**
 * Bias detection result
 */
export interface BiasDetectionResult extends DetectionResult {
  type: 'bias';
  /** Bias categories detected */
  biasCategories: DetectedBiasCategory[];
  /** Overall bias score (0-1) */
  biasScore: number;
  /** Fairness metrics */
  fairnessMetrics?: FairnessMetrics;
  /** Stereotypes detected */
  stereotypes: DetectedStereotype[];
}

/**
 * Detected bias category
 */
export interface DetectedBiasCategory {
  /** Category */
  category: BiasDetectionCategory;
  /** Score (0-1) */
  score: number;
  /** Direction */
  direction?: 'positive' | 'negative' | 'neutral';
  /** Examples */
  examples: string[];
}

/**
 * Bias detection categories
 */
export type BiasDetectionCategory =
  | 'gender'
  | 'race'
  | 'age'
  | 'religion'
  | 'nationality'
  | 'disability'
  | 'sexual_orientation'
  | 'socioeconomic'
  | 'political'
  | 'other';

/**
 * Detected stereotype
 */
export interface DetectedStereotype {
  /** Stereotype text */
  text: string;
  /** Target group */
  targetGroup: string;
  /** Type */
  type: 'positive' | 'negative' | 'neutral';
  /** Confidence */
  confidence: number;
}

/**
 * Fairness metrics
 */
export interface FairnessMetrics {
  /** Demographic parity */
  demographicParity?: number;
  /** Equalized odds */
  equalizedOdds?: number;
  /** Predictive parity */
  predictiveParity?: number;
  /** Individual fairness */
  individualFairness?: number;
}

/**
 * Hallucination detection result
 */
export interface HallucinationDetectionResult extends DetectionResult {
  type: 'hallucination';
  /** Hallucination type */
  hallucinationType: HallucinationType;
  /** Factual claims made */
  claims: FactualClaim[];
  /** Verified claims */
  verifiedClaims: number;
  /** Unverified claims */
  unverifiedClaims: number;
  /** Contradicted claims */
  contradictedClaims: number;
  /** Hallucination rate */
  hallucinationRate: number;
}

/**
 * Hallucination types
 */
export type HallucinationType =
  | 'factual' // Incorrect facts
  | 'fabrication' // Made up information
  | 'contradiction' // Self-contradiction
  | 'confabulation' // Confident falsehoods
  | 'extrinsic' // Info not in context
  | 'intrinsic'; // Misrepresenting context;

/**
 * Factual claim
 */
export interface FactualClaim {
  /** Claim text */
  claim: string;
  /** Verification status */
  status: 'verified' | 'unverified' | 'contradicted' | 'uncertain';
  /** Source if verified */
  source?: string;
  /** Confidence */
  confidence: number;
  /** Evidence */
  evidence?: string;
}

/**
 * Toxicity detection result
 */
export interface ToxicityDetectionResult extends DetectionResult {
  type: 'toxicity';
  /** Overall toxicity score (0-1) */
  toxicityScore: number;
  /** Toxicity categories */
  categories: ToxicityCategoryScore[];
  /** Flagged segments */
  flaggedSegments: ToxicSegment[];
  /** Language detected */
  language?: string;
}

/**
 * Toxicity category score
 */
export interface ToxicityCategoryScore {
  /** Category */
  category: ToxicityCategory;
  /** Score (0-1) */
  score: number;
  /** Above threshold */
  flagged: boolean;
}

/**
 * Toxicity categories
 */
export type ToxicityCategory =
  | 'toxicity'
  | 'severe_toxicity'
  | 'obscene'
  | 'identity_attack'
  | 'insult'
  | 'threat'
  | 'sexual_explicit'
  | 'profanity';

/**
 * Toxic segment
 */
export interface ToxicSegment {
  /** Segment text */
  text: string;
  /** Start position */
  start: number;
  /** End position */
  end: number;
  /** Category */
  category: ToxicityCategory;
  /** Score */
  score: number;
}

/**
 * Detection configuration
 */
export interface DetectionConfig {
  /** Detection types to enable */
  enabledTypes: DetectionType[];
  /** Confidence thresholds */
  thresholds: Record<DetectionType, number>;
  /** Severity thresholds */
  severityThresholds?: Record<Severity, number>;
  /** Use LLM for analysis */
  useLLM?: boolean;
  /** Model for LLM analysis */
  llmModel?: string;
  /** Custom patterns */
  customPatterns?: Record<string, RegExp[]>;
  /** Blocklists */
  blocklists?: Record<string, string[]>;
  /** Allowlists */
  allowlists?: Record<string, string[]>;
}

/**
 * Detection input
 */
export interface DetectionInput {
  /** Text to analyze */
  text: string;
  /** Role (user, assistant, system) */
  role?: 'user' | 'assistant' | 'system';
  /** Conversation context */
  context?: string[];
  /** System prompt for reference */
  systemPrompt?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Multi-detection result
 */
export interface MultiDetectionResult {
  /** Input analyzed */
  input: DetectionInput;
  /** Results by type */
  results: Record<DetectionType, DetectionResult>;
  /** Overall threat level */
  overallThreatLevel: Severity | 'none';
  /** Summary */
  summary: string;
  /** Recommended actions */
  recommendedActions: string[];
  /** Total processing time */
  totalProcessingTimeMs: number;
}

/**
 * Detection metrics
 */
export interface DetectionMetrics {
  /** Total detections */
  totalDetections: number;
  /** By type */
  byType: Record<DetectionType, number>;
  /** By severity */
  bySeverity: Record<Severity, number>;
  /** True positive rate */
  truePositiveRate?: number;
  /** False positive rate */
  falsePositiveRate?: number;
  /** Precision */
  precision?: number;
  /** Recall */
  recall?: number;
  /** F1 score */
  f1Score?: number;
}

/**
 * Detection alert
 */
export interface DetectionAlert {
  /** Alert ID */
  id: string;
  /** Detection result */
  detection: DetectionResult;
  /** Alert level */
  level: 'critical' | 'warning' | 'info';
  /** Message */
  message: string;
  /** Created at */
  createdAt: number;
  /** Acknowledged */
  acknowledged: boolean;
  /** Acknowledged by */
  acknowledgedBy?: string;
  /** Acknowledged at */
  acknowledgedAt?: number;
}
