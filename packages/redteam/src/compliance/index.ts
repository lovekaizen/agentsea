/**
 * Compliance Module - Regulatory Compliance
 *
 * Compliance checking against frameworks like EU AI Act,
 * NIST AI RMF, ISO 42001, SOC 2 AI, and OWASP LLM Top 10.
 */

// Re-export types
export type {
  ComplianceFramework,
  ComplianceFrameworkId,
  ComplianceStatus,
  ComplianceRequirement,
  ComplianceCheckResult,
  ComplianceConfig,
  ComplianceProgress,
  ComplianceFinding,
  ComplianceRecommendation,
  ComplianceCategory,
  ComplianceReport,
  ComplianceTrend,
  RiskLevel,
  Evidence,
  EvidenceType,
  EUAIActRequirement,
  NISTRMFRequirement,
  ISO42001Requirement,
  SOC2AIRequirement,
  OWASPLLMRequirement,
} from '../types/compliance.types.js';

/**
 * Placeholder for ComplianceChecker implementation
 * TODO: Implement full compliance checker
 */
export class ComplianceChecker {
  constructor(public readonly frameworkId: string) {}
}
