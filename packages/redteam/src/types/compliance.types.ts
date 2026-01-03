/**
 * Compliance Types for AI Regulation and Standards
 */

import type { Severity } from './attack.types.js';

/**
 * Compliance framework identifiers
 */
export type ComplianceFrameworkId =
  | 'eu_ai_act'
  | 'nist_ai_rmf'
  | 'iso_42001'
  | 'soc2_ai'
  | 'hipaa_ai'
  | 'gdpr_ai'
  | 'ccpa_ai'
  | 'owasp_llm'
  | 'custom';

/**
 * Compliance status
 */
export type ComplianceStatus =
  | 'compliant'
  | 'non_compliant'
  | 'partially_compliant'
  | 'not_applicable'
  | 'not_evaluated';

/**
 * Risk level classification
 */
export type RiskLevel = 'unacceptable' | 'high' | 'limited' | 'minimal';

/**
 * Compliance framework definition
 */
export interface ComplianceFramework {
  /** Framework identifier */
  id: string;
  /** Framework name */
  name: string;
  /** Framework version */
  version: string;
  /** Description */
  description: string;
  /** Issuing authority */
  authority?: string;
  /** Effective date */
  effectiveDate?: string;
  /** Requirements */
  requirements: ComplianceRequirement[];
  /** Categories */
  categories: ComplianceCategory[];
  /** Documentation URL */
  documentationUrl?: string;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Compliance requirement
 */
export interface ComplianceRequirement {
  /** Requirement ID */
  id: string;
  /** Requirement name/title */
  name: string;
  /** Description */
  description: string;
  /** Category */
  category: string;
  /** Severity if not met */
  severity: Severity;
  /** Risk level (EU AI Act specific) */
  riskLevel?: RiskLevel;
  /** Whether mandatory */
  mandatory: boolean;
  /** Verification method */
  verificationMethod: VerificationMethod;
  /** Test IDs that verify this requirement */
  testIds?: string[];
  /** Evidence needed */
  evidenceRequired?: string[];
  /** Reference section in framework */
  reference?: string;
  /** Sub-requirements */
  subRequirements?: ComplianceRequirement[];
}

/**
 * Verification method
 */
export type VerificationMethod =
  | 'automated_test'
  | 'manual_review'
  | 'documentation_review'
  | 'interview'
  | 'observation'
  | 'log_analysis'
  | 'penetration_test'
  | 'code_review'
  | 'combined';

/**
 * Compliance category
 */
export interface ComplianceCategory {
  /** Category ID */
  id: string;
  /** Category name */
  name: string;
  /** Description */
  description: string;
  /** Weight for scoring */
  weight: number;
  /** Parent category ID */
  parentId?: string;
}

/**
 * Compliance check result
 */
export interface ComplianceCheckResult {
  /** Framework checked */
  framework: ComplianceFramework;
  /** Overall status */
  status: ComplianceStatus;
  /** Overall score (0-100) */
  score: number;
  /** Individual requirement results */
  requirementResults: RequirementResult[];
  /** Category scores */
  categoryScores: Record<string, CategoryComplianceScore>;
  /** Findings */
  findings: ComplianceFinding[];
  /** Recommendations */
  recommendations: ComplianceRecommendation[];
  /** Run metadata */
  metadata: ComplianceRunMetadata;
}

/**
 * Requirement result
 */
export interface RequirementResult {
  /** Requirement */
  requirement: ComplianceRequirement;
  /** Status */
  status: ComplianceStatus;
  /** Evidence collected */
  evidence: Evidence[];
  /** Notes */
  notes?: string;
  /** Tested at */
  testedAt: number;
  /** Tested by */
  testedBy?: string;
}

/**
 * Category compliance score
 */
export interface CategoryComplianceScore {
  /** Category */
  category: string;
  /** Score (0-100) */
  score: number;
  /** Status */
  status: ComplianceStatus;
  /** Requirements in this category */
  totalRequirements: number;
  /** Compliant requirements */
  compliantRequirements: number;
}

/**
 * Compliance finding
 */
export interface ComplianceFinding {
  /** Finding ID */
  id: string;
  /** Title */
  title: string;
  /** Description */
  description: string;
  /** Severity */
  severity: Severity;
  /** Related requirement IDs */
  requirementIds: string[];
  /** Status */
  status: 'open' | 'in_progress' | 'resolved' | 'accepted_risk';
  /** Evidence */
  evidence?: Evidence[];
  /** Remediation */
  remediation?: string;
  /** Due date for remediation */
  dueDate?: string;
  /** Assigned to */
  assignedTo?: string;
  /** Created at */
  createdAt: number;
  /** Updated at */
  updatedAt: number;
}

/**
 * Compliance recommendation
 */
export interface ComplianceRecommendation {
  /** Recommendation ID */
  id: string;
  /** Title */
  title: string;
  /** Description */
  description: string;
  /** Priority */
  priority: 'critical' | 'high' | 'medium' | 'low';
  /** Related requirement IDs */
  requirementIds: string[];
  /** Effort estimate */
  effortEstimate?: 'minimal' | 'moderate' | 'significant' | 'extensive';
  /** Impact if implemented */
  impact?: string;
  /** Resources/links */
  resources?: string[];
}

/**
 * Evidence item
 */
export interface Evidence {
  /** Evidence ID */
  id: string;
  /** Evidence type */
  type: EvidenceType;
  /** Title */
  title: string;
  /** Description */
  description?: string;
  /** Content or reference */
  content: string;
  /** File path if applicable */
  filePath?: string;
  /** Collected at */
  collectedAt: number;
  /** Collected by */
  collectedBy?: string;
  /** Hash for integrity */
  hash?: string;
}

/**
 * Evidence type
 */
export type EvidenceType =
  | 'test_result'
  | 'log_entry'
  | 'screenshot'
  | 'document'
  | 'configuration'
  | 'code_snippet'
  | 'api_response'
  | 'audit_log'
  | 'interview_notes'
  | 'custom';

/**
 * Compliance run metadata
 */
export interface ComplianceRunMetadata {
  /** Run ID */
  runId: string;
  /** Start time */
  startTime: number;
  /** End time */
  endTime: number;
  /** Duration in ms */
  durationMs: number;
  /** Environment */
  environment?: string;
  /** Auditor */
  auditor?: string;
  /** Scope */
  scope?: string;
  /** Notes */
  notes?: string;
}

/**
 * Compliance configuration
 */
export interface ComplianceConfig {
  /** Frameworks to check */
  frameworks: string[];
  /** Specific requirements to check */
  requirementIds?: string[];
  /** Categories to include */
  includeCategories?: string[];
  /** Categories to exclude */
  excludeCategories?: string[];
  /** Only mandatory requirements */
  mandatoryOnly?: boolean;
  /** Risk levels to include (EU AI Act) */
  riskLevels?: RiskLevel[];
  /** Generate recommendations */
  generateRecommendations?: boolean;
  /** Collect evidence */
  collectEvidence?: boolean;
  /** Evidence storage path */
  evidencePath?: string;
  /** Progress callback */
  onProgress?: (progress: ComplianceProgress) => void;
}

/**
 * Compliance progress
 */
export interface ComplianceProgress {
  /** Current framework */
  frameworkId: string;
  /** Current requirement index */
  currentRequirement: number;
  /** Total requirements */
  totalRequirements: number;
  /** Percentage complete */
  percentage: number;
  /** Current status */
  currentStatus: ComplianceStatus;
}

/**
 * EU AI Act specific types
 */
export interface EUAIActRequirement extends ComplianceRequirement {
  /** Article reference */
  article: string;
  /** Annex reference */
  annex?: string;
  /** Risk level */
  riskLevel: RiskLevel;
  /** Conformity assessment required */
  conformityAssessmentRequired: boolean;
  /** Registration required */
  registrationRequired: boolean;
}

/**
 * NIST AI RMF specific types
 */
export interface NISTRMFRequirement extends ComplianceRequirement {
  /** Function (Govern, Map, Measure, Manage) */
  function: 'govern' | 'map' | 'measure' | 'manage';
  /** Category code */
  categoryCode: string;
  /** Subcategory code */
  subcategoryCode?: string;
  /** Suggested actions */
  suggestedActions?: string[];
}

/**
 * ISO 42001 specific types
 */
export interface ISO42001Requirement extends ComplianceRequirement {
  /** Clause reference */
  clause: string;
  /** Control objective */
  controlObjective?: string;
  /** Control type */
  controlType: 'preventive' | 'detective' | 'corrective';
}

/**
 * SOC 2 AI specific types
 */
export interface SOC2AIRequirement extends ComplianceRequirement {
  /** Trust service category */
  trustServiceCategory:
    | 'security'
    | 'availability'
    | 'processing_integrity'
    | 'confidentiality'
    | 'privacy';
  /** Control number */
  controlNumber: string;
  /** Points of focus */
  pointsOfFocus?: string[];
}

/**
 * OWASP LLM Top 10 specific types
 */
export interface OWASPLLMRequirement extends ComplianceRequirement {
  /** OWASP ID (LLM01, LLM02, etc.) */
  owaspId: string;
  /** Vulnerability name */
  vulnerabilityName: string;
  /** Common attack vectors */
  attackVectors?: string[];
  /** Prevention strategies */
  preventionStrategies?: string[];
}

/**
 * Compliance report
 */
export interface ComplianceReport {
  /** Report ID */
  id: string;
  /** Title */
  title: string;
  /** Generated at */
  generatedAt: number;
  /** Report period */
  period?: {
    start: number;
    end: number;
  };
  /** Executive summary */
  executiveSummary: string;
  /** Framework results */
  frameworkResults: ComplianceCheckResult[];
  /** Overall compliance score */
  overallScore: number;
  /** Overall status */
  overallStatus: ComplianceStatus;
  /** Key findings */
  keyFindings: ComplianceFinding[];
  /** Prioritized recommendations */
  prioritizedRecommendations: ComplianceRecommendation[];
  /** Trend comparison */
  trendComparison?: ComplianceTrend;
  /** Report format */
  format: 'json' | 'pdf' | 'html' | 'markdown';
}

/**
 * Compliance trend
 */
export interface ComplianceTrend {
  /** Previous score */
  previousScore: number;
  /** Current score */
  currentScore: number;
  /** Change */
  change: number;
  /** Direction */
  direction: 'improved' | 'declined' | 'stable';
  /** Historical scores */
  history: Array<{
    date: number;
    score: number;
  }>;
}
