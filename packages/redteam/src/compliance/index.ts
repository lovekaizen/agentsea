/**
 * Compliance Module - Regulatory Compliance
 *
 * Checks a target against a compliance framework (EU AI Act, NIST AI RMF,
 * ISO 42001, SOC 2 AI, OWASP LLM Top 10, …). Given per-requirement evaluations,
 * it aggregates an overall status, weighted score, per-category breakdown,
 * findings for gaps, and prioritized recommendations.
 */

import { nanoid } from 'nanoid';
import type {
  ComplianceFramework,
  ComplianceStatus,
  ComplianceCheckResult,
  ComplianceConfig,
  ComplianceFinding,
  ComplianceRecommendation,
  ComplianceRequirement,
  RequirementResult,
  CategoryComplianceScore,
  Evidence,
} from '../types/compliance.types.js';

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

/** Per-requirement evaluation supplied to the checker. */
export interface RequirementEvaluation {
  status: ComplianceStatus;
  evidence?: Evidence[];
  notes?: string;
}

/** Map of requirement id → evaluation. Unlisted requirements are 'not_evaluated'. */
export type ComplianceEvaluations = Record<string, RequirementEvaluation>;

const COMPLIANT_SCORE: Record<ComplianceStatus, number> = {
  compliant: 100,
  partially_compliant: 50,
  non_compliant: 0,
  not_applicable: 100, // excluded from scoring but treated as satisfied
  not_evaluated: 0,
};

/**
 * Evaluates a target against a compliance framework. The framework supplies the
 * requirements and categories; the caller supplies the per-requirement
 * evaluations (e.g. from automated tests, manual review, scan results).
 */
export class ComplianceChecker {
  constructor(
    private readonly framework: ComplianceFramework,
    private readonly config: Partial<ComplianceConfig> = {},
  ) {}

  /** Run the compliance check against the provided per-requirement evaluations. */
  check(evaluations: ComplianceEvaluations = {}): ComplianceCheckResult {
    const startTime = Date.now();
    const requirements = this.applicableRequirements();

    const requirementResults: RequirementResult[] = requirements.map((req) => {
      const evaluation = evaluations[req.id];
      const status: ComplianceStatus = evaluation?.status ?? 'not_evaluated';
      return {
        requirement: req,
        status,
        evidence: evaluation?.evidence ?? [],
        notes: evaluation?.notes,
        testedAt: Date.now(),
      };
    });

    const categoryScores = this.scoreByCategory(requirementResults);
    const score = this.overallScore(requirementResults);
    const status = this.overallStatus(requirementResults);
    const findings = this.buildFindings(requirementResults);
    const recommendations =
      this.config.generateRecommendations === false
        ? []
        : this.buildRecommendations(findings);

    const endTime = Date.now();

    return {
      framework: this.framework,
      status,
      score,
      requirementResults,
      categoryScores,
      findings,
      recommendations,
      metadata: {
        runId: nanoid(),
        startTime,
        endTime,
        durationMs: endTime - startTime,
      },
    };
  }

  private applicableRequirements(): ComplianceRequirement[] {
    let reqs = this.framework.requirements;

    if (this.config.requirementIds?.length) {
      const ids = new Set(this.config.requirementIds);
      reqs = reqs.filter((r) => ids.has(r.id));
    }
    if (this.config.includeCategories?.length) {
      const cats = new Set(this.config.includeCategories);
      reqs = reqs.filter((r) => cats.has(r.category));
    }
    if (this.config.excludeCategories?.length) {
      const cats = new Set(this.config.excludeCategories);
      reqs = reqs.filter((r) => !cats.has(r.category));
    }
    if (this.config.mandatoryOnly) {
      reqs = reqs.filter((r) => r.mandatory);
    }
    if (this.config.riskLevels?.length) {
      const levels = new Set(this.config.riskLevels);
      reqs = reqs.filter((r) => !r.riskLevel || levels.has(r.riskLevel));
    }
    return reqs;
  }

  /** Weighted overall score (0-100); 'not_applicable' requirements are excluded. */
  private overallScore(results: RequirementResult[]): number {
    const scored = results.filter((r) => r.status !== 'not_applicable');
    if (scored.length === 0) return 100;
    const sum = scored.reduce((acc, r) => acc + COMPLIANT_SCORE[r.status], 0);
    return Math.round(sum / scored.length);
  }

  private overallStatus(results: RequirementResult[]): ComplianceStatus {
    const mandatory = results.filter(
      (r) => r.requirement.mandatory && r.status !== 'not_applicable',
    );
    if (mandatory.length === 0) return 'not_evaluated';

    const anyNonCompliant = mandatory.some((r) => r.status === 'non_compliant');
    const allCompliant = mandatory.every((r) => r.status === 'compliant');
    const anyEvaluated = mandatory.some((r) => r.status !== 'not_evaluated');

    if (allCompliant) return 'compliant';
    if (!anyEvaluated) return 'not_evaluated';
    if (anyNonCompliant) return 'non_compliant';
    return 'partially_compliant';
  }

  private scoreByCategory(
    results: RequirementResult[],
  ): Record<string, CategoryComplianceScore> {
    const groups = new Map<string, RequirementResult[]>();
    for (const r of results) {
      const cat = r.requirement.category;
      groups.set(cat, [...(groups.get(cat) ?? []), r]);
    }

    const out: Record<string, CategoryComplianceScore> = {};
    for (const [category, group] of groups) {
      const compliant = group.filter((r) => r.status === 'compliant').length;
      out[category] = {
        category,
        score: this.overallScore(group),
        status: this.overallStatus(group),
        totalRequirements: group.length,
        compliantRequirements: compliant,
      };
    }
    return out;
  }

  private buildFindings(results: RequirementResult[]): ComplianceFinding[] {
    return results
      .filter(
        (r) =>
          r.status === 'non_compliant' || r.status === 'partially_compliant',
      )
      .map((r) => ({
        id: nanoid(),
        title: `Gap: ${r.requirement.name}`,
        description:
          r.notes ??
          `Requirement "${r.requirement.name}" is ${r.status.replace('_', ' ')}.`,
        severity: r.requirement.severity,
        requirementIds: [r.requirement.id],
        status: 'open' as const,
        evidence: r.evidence,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));
  }

  private buildRecommendations(
    findings: ComplianceFinding[],
  ): ComplianceRecommendation[] {
    const priorityFor = (
      sev: ComplianceFinding['severity'],
    ): ComplianceRecommendation['priority'] => {
      switch (sev) {
        case 'critical':
          return 'critical';
        case 'high':
          return 'high';
        case 'medium':
          return 'medium';
        default:
          return 'low';
      }
    };

    return findings.map((f) => ({
      id: nanoid(),
      title: `Remediate: ${f.title.replace(/^Gap: /, '')}`,
      description: `Address the gap for requirement(s) ${f.requirementIds.join(', ')}.`,
      priority: priorityFor(f.severity),
      requirementIds: f.requirementIds,
    }));
  }
}

export function createComplianceChecker(
  framework: ComplianceFramework,
  config?: Partial<ComplianceConfig>,
): ComplianceChecker {
  return new ComplianceChecker(framework, config);
}
