/**
 * Scanning Types for Vulnerability Assessment
 */

import type { AttackCategory, Severity } from './attack.types.js';
import type { TestSuiteResult } from './test.types.js';

/**
 * Scan type identifiers
 */
export type ScanType =
  | 'vulnerability'
  | 'prompt_analysis'
  | 'system_prompt_audit'
  | 'configuration_review'
  | 'comprehensive';

/**
 * Scan status
 */
export type ScanStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Vulnerability category
 */
export type VulnerabilityCategory =
  | 'injection'
  | 'authentication'
  | 'authorization'
  | 'data_exposure'
  | 'misconfiguration'
  | 'insecure_design'
  | 'output_handling'
  | 'supply_chain'
  | 'model_theft'
  | 'custom';

/**
 * Vulnerability definition
 */
export interface Vulnerability {
  /** Vulnerability ID */
  id: string;
  /** Name */
  name: string;
  /** Description */
  description: string;
  /** Category */
  category: VulnerabilityCategory;
  /** Severity */
  severity: Severity;
  /** CVSS score if applicable */
  cvssScore?: number;
  /** CWE ID if applicable */
  cweId?: string;
  /** OWASP mapping */
  owaspMapping?: string;
  /** Affected component */
  affectedComponent: string;
  /** Attack vector */
  attackVector?: string;
  /** Exploitability */
  exploitability: 'easy' | 'moderate' | 'difficult' | 'theoretical';
  /** Impact */
  impact: string;
  /** Remediation */
  remediation: string;
  /** References */
  references?: string[];
  /** Evidence */
  evidence?: VulnerabilityEvidence[];
  /** First detected */
  firstDetected: number;
  /** Last seen */
  lastSeen: number;
  /** Status */
  status:
    | 'open'
    | 'confirmed'
    | 'in_progress'
    | 'resolved'
    | 'accepted_risk'
    | 'false_positive';
}

/**
 * Vulnerability evidence
 */
export interface VulnerabilityEvidence {
  /** Evidence type */
  type:
    | 'request'
    | 'response'
    | 'log'
    | 'screenshot'
    | 'test_result'
    | 'custom';
  /** Description */
  description: string;
  /** Content */
  content: string;
  /** Timestamp */
  timestamp: number;
}

/**
 * Scan configuration
 */
export interface ScanConfig {
  /** Scan type */
  type: ScanType;
  /** Target to scan */
  target: ScanTarget;
  /** Attack categories to test */
  attackCategories?: AttackCategory[];
  /** Specific attacks to include */
  includeAttacks?: string[];
  /** Attacks to exclude */
  excludeAttacks?: string[];
  /** Severity threshold */
  minSeverity?: Severity;
  /** Max duration in ms */
  maxDuration?: number;
  /** Parallel tests */
  parallel?: boolean;
  /** Max parallel tests */
  maxParallel?: number;
  /** Stop on first finding */
  stopOnFirstFinding?: boolean;
  /** Authentication if needed */
  authentication?: ScanAuthentication;
  /** Rate limiting */
  rateLimit?: RateLimitConfig;
  /** Progress callback */
  onProgress?: (progress: ScanProgress) => void;
  /** Finding callback */
  onFinding?: (vulnerability: Vulnerability) => void;
}

/**
 * Scan target
 */
export interface ScanTarget {
  /** Target type */
  type: 'agent' | 'endpoint' | 'model' | 'prompt' | 'system';
  /** Target identifier/URL */
  identifier: string;
  /** Name */
  name?: string;
  /** Model if applicable */
  model?: string;
  /** System prompt if available */
  systemPrompt?: string;
  /** Headers if needed */
  headers?: Record<string, string>;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Scan authentication
 */
export interface ScanAuthentication {
  /** Auth type */
  type: 'api_key' | 'bearer' | 'basic' | 'oauth' | 'custom';
  /** Credentials */
  credentials: Record<string, string>;
  /** Header name */
  headerName?: string;
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Max requests per second */
  requestsPerSecond: number;
  /** Burst size */
  burstSize?: number;
  /** Retry on rate limit */
  retryOnRateLimit?: boolean;
  /** Max retries */
  maxRetries?: number;
}

/**
 * Scan result
 */
export interface ScanResult {
  /** Scan ID */
  id: string;
  /** Scan type */
  type: ScanType;
  /** Target scanned */
  target: ScanTarget;
  /** Status */
  status: ScanStatus;
  /** Vulnerabilities found */
  vulnerabilities: Vulnerability[];
  /** Summary statistics */
  summary: ScanSummary;
  /** Test results if applicable */
  testResults?: TestSuiteResult;
  /** Scan metadata */
  metadata: ScanMetadata;
  /** Error if failed */
  error?: string;
}

/**
 * Scan summary
 */
export interface ScanSummary {
  /** Total tests run */
  totalTests: number;
  /** Tests passed */
  testsPassed: number;
  /** Tests failed */
  testsFailed: number;
  /** Vulnerabilities found */
  vulnerabilitiesFound: number;
  /** By severity */
  bySeverity: Record<Severity, number>;
  /** By category */
  byCategory: Record<VulnerabilityCategory, number>;
  /** Risk score (0-100) */
  riskScore: number;
  /** Risk level */
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'minimal';
}

/**
 * Scan metadata
 */
export interface ScanMetadata {
  /** Start time */
  startTime: number;
  /** End time */
  endTime: number;
  /** Duration in ms */
  durationMs: number;
  /** Scanner version */
  scannerVersion: string;
  /** Configuration used */
  configuration: Partial<ScanConfig>;
  /** Environment */
  environment?: string;
}

/**
 * Scan progress
 */
export interface ScanProgress {
  /** Scan ID */
  scanId: string;
  /** Phase */
  phase: 'initializing' | 'scanning' | 'analyzing' | 'reporting' | 'completed';
  /** Current test */
  currentTest?: string;
  /** Tests completed */
  testsCompleted: number;
  /** Total tests */
  totalTests: number;
  /** Percentage */
  percentage: number;
  /** Vulnerabilities found so far */
  vulnerabilitiesFound: number;
  /** Elapsed time in ms */
  elapsedMs: number;
  /** Estimated remaining time */
  estimatedRemainingMs?: number;
}

/**
 * Prompt analysis configuration
 */
export interface PromptAnalysisConfig {
  /** Prompt to analyze */
  prompt: string;
  /** Analysis types */
  analysisTypes: PromptAnalysisType[];
  /** Check for injections */
  checkInjections?: boolean;
  /** Check for sensitive data */
  checkSensitiveData?: boolean;
  /** Use LLM for analysis */
  useLLM?: boolean;
  /** Model for analysis */
  model?: string;
}

/**
 * Prompt analysis types
 */
export type PromptAnalysisType =
  | 'structure'
  | 'security'
  | 'quality'
  | 'effectiveness'
  | 'bias'
  | 'clarity'
  | 'completeness';

/**
 * Prompt analysis result
 */
export interface PromptAnalysisResult {
  /** Prompt analyzed */
  prompt: string;
  /** Overall score (0-100) */
  overallScore: number;
  /** Analysis by type */
  analyses: Record<PromptAnalysisType, PromptTypeAnalysis>;
  /** Issues found */
  issues: PromptIssue[];
  /** Suggestions */
  suggestions: PromptSuggestion[];
  /** Security assessment */
  securityAssessment?: PromptSecurityAssessment;
  /** Processing time */
  processingTimeMs: number;
}

/**
 * Prompt type analysis
 */
export interface PromptTypeAnalysis {
  /** Score (0-100) */
  score: number;
  /** Findings */
  findings: string[];
  /** Strengths */
  strengths?: string[];
  /** Weaknesses */
  weaknesses?: string[];
}

/**
 * Prompt issue
 */
export interface PromptIssue {
  /** Issue type */
  type: 'security' | 'quality' | 'clarity' | 'bias' | 'effectiveness';
  /** Severity */
  severity: Severity;
  /** Description */
  description: string;
  /** Location in prompt */
  location?: { start: number; end: number };
  /** Recommendation */
  recommendation: string;
}

/**
 * Prompt suggestion
 */
export interface PromptSuggestion {
  /** Suggestion type */
  type: 'improvement' | 'alternative' | 'addition' | 'removal';
  /** Description */
  description: string;
  /** Current text */
  currentText?: string;
  /** Suggested text */
  suggestedText?: string;
  /** Expected improvement */
  expectedImprovement: string;
  /** Priority */
  priority: 'high' | 'medium' | 'low';
}

/**
 * Prompt security assessment
 */
export interface PromptSecurityAssessment {
  /** Overall security score (0-100) */
  securityScore: number;
  /** Injection vulnerability score */
  injectionVulnerability: number;
  /** Data leakage risk */
  dataLeakageRisk: number;
  /** Jailbreak susceptibility */
  jailbreakSusceptibility: number;
  /** Detected patterns */
  detectedPatterns: SecurityPattern[];
  /** Recommendations */
  recommendations: string[];
}

/**
 * Security pattern
 */
export interface SecurityPattern {
  /** Pattern name */
  name: string;
  /** Risk level */
  risk: Severity;
  /** Description */
  description: string;
  /** Match location */
  location?: { start: number; end: number };
}

/**
 * System prompt audit configuration
 */
export interface SystemPromptAuditConfig {
  /** System prompt to audit */
  systemPrompt: string;
  /** Audit categories */
  categories: SystemPromptAuditCategory[];
  /** Compare against best practices */
  compareBestPractices?: boolean;
  /** Test for vulnerabilities */
  testVulnerabilities?: boolean;
  /** Generate improved version */
  generateImproved?: boolean;
}

/**
 * System prompt audit categories
 */
export type SystemPromptAuditCategory =
  | 'security'
  | 'clarity'
  | 'boundaries'
  | 'consistency'
  | 'completeness'
  | 'safety'
  | 'instruction_hierarchy';

/**
 * System prompt audit result
 */
export interface SystemPromptAuditResult {
  /** Prompt audited */
  systemPrompt: string;
  /** Overall score (0-100) */
  overallScore: number;
  /** Scores by category */
  categoryScores: Record<SystemPromptAuditCategory, number>;
  /** Issues found */
  issues: SystemPromptIssue[];
  /** Vulnerabilities */
  vulnerabilities: Vulnerability[];
  /** Best practice violations */
  bestPracticeViolations?: BestPracticeViolation[];
  /** Improved version if generated */
  improvedVersion?: string;
  /** Improvement explanation */
  improvementExplanation?: string;
}

/**
 * System prompt issue
 */
export interface SystemPromptIssue {
  /** Category */
  category: SystemPromptAuditCategory;
  /** Severity */
  severity: Severity;
  /** Description */
  description: string;
  /** Location */
  location?: { start: number; end: number };
  /** Suggestion */
  suggestion: string;
}

/**
 * Best practice violation
 */
export interface BestPracticeViolation {
  /** Practice name */
  practice: string;
  /** Description */
  description: string;
  /** Impact */
  impact: string;
  /** Recommendation */
  recommendation: string;
  /** Reference */
  reference?: string;
}
