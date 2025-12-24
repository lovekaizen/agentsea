/**
 * Report - Report Generation for Red Team Results
 *
 * Generates comprehensive reports from test results,
 * vulnerabilities, and compliance findings.
 */

import { nanoid } from 'nanoid';
import type { RedTeamResults, RedTeamSummary } from './RedTeam.js';
import type { Severity } from '../types/attack.types.js';

/**
 * Report configuration
 */
export interface ReportConfig {
  /** Report title */
  title?: string;
  /** Report format */
  format?: 'json' | 'html' | 'markdown' | 'pdf';
  /** Include sections */
  sections?: ReportSection[];
  /** Branding */
  branding?: ReportBranding;
  /** Include raw data */
  includeRawData?: boolean;
  /** Include evidence */
  includeEvidence?: boolean;
  /** Severity threshold */
  severityThreshold?: Severity;
  /** Custom templates */
  templates?: Record<string, string>;
}

/**
 * Report sections
 */
export type ReportSection =
  | 'executive_summary'
  | 'methodology'
  | 'scope'
  | 'findings'
  | 'vulnerabilities'
  | 'attack_results'
  | 'benchmark_results'
  | 'compliance_results'
  | 'risk_assessment'
  | 'recommendations'
  | 'appendix';

/**
 * Report branding
 */
export interface ReportBranding {
  /** Logo URL or base64 */
  logo?: string;
  /** Company name */
  companyName?: string;
  /** Primary color */
  primaryColor?: string;
  /** Secondary color */
  secondaryColor?: string;
  /** Footer text */
  footerText?: string;
  /** Header text */
  headerText?: string;
}

/**
 * Report summary
 */
export interface ReportSummary {
  /** Overall risk level */
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'minimal';
  /** Risk score */
  riskScore: number;
  /** Key findings count */
  keyFindings: number;
  /** Critical vulnerabilities */
  criticalVulnerabilities: number;
  /** High vulnerabilities */
  highVulnerabilities: number;
  /** Tests passed */
  testsPassed: number;
  /** Tests failed */
  testsFailed: number;
  /** Compliance score */
  complianceScore: number;
  /** Quick summary text */
  summaryText: string;
}

/**
 * Report finding
 */
export interface ReportFinding {
  /** Finding ID */
  id: string;
  /** Title */
  title: string;
  /** Description */
  description: string;
  /** Severity */
  severity: Severity;
  /** Category */
  category: string;
  /** Evidence */
  evidence?: string[];
  /** Recommendation */
  recommendation: string;
  /** Status */
  status: 'new' | 'confirmed' | 'in_progress' | 'resolved';
  /** References */
  references?: string[];
  /** CVSS score */
  cvssScore?: number;
  /** CWE ID */
  cweId?: string;
}

/**
 * Report structure
 */
export interface Report {
  /** Report ID */
  id: string;
  /** Title */
  title: string;
  /** Generated at */
  generatedAt: number;
  /** Format */
  format: ReportConfig['format'];
  /** Summary */
  summary: ReportSummary;
  /** Executive summary */
  executiveSummary?: ExecutiveSummary;
  /** Methodology */
  methodology?: MethodologySection;
  /** Scope */
  scope?: ScopeSection;
  /** Findings */
  findings: ReportFinding[];
  /** Risk assessment */
  riskAssessment?: RiskAssessment;
  /** Recommendations */
  recommendations: ReportRecommendation[];
  /** Raw results */
  rawResults?: RedTeamResults;
  /** Content (formatted output) */
  content?: string;
  /** Metadata */
  metadata: ReportMetadata;
}

/**
 * Executive summary section
 */
export interface ExecutiveSummary {
  /** Overview */
  overview: string;
  /** Key findings */
  keyFindings: string[];
  /** Risk overview */
  riskOverview: string;
  /** Immediate actions */
  immediateActions: string[];
  /** Overall assessment */
  assessment: string;
}

/**
 * Methodology section
 */
export interface MethodologySection {
  /** Approach */
  approach: string;
  /** Tools used */
  toolsUsed: string[];
  /** Standards followed */
  standards: string[];
  /** Limitations */
  limitations?: string[];
}

/**
 * Scope section
 */
export interface ScopeSection {
  /** In scope */
  inScope: string[];
  /** Out of scope */
  outOfScope?: string[];
  /** Target description */
  targetDescription: string;
  /** Testing period */
  testingPeriod: {
    start: number;
    end: number;
  };
}

/**
 * Risk assessment section
 */
export interface RiskAssessment {
  /** Overall risk */
  overallRisk: 'critical' | 'high' | 'medium' | 'low' | 'minimal';
  /** Risk score */
  riskScore: number;
  /** Risk breakdown */
  breakdown: {
    category: string;
    risk: string;
    score: number;
  }[];
  /** Trend */
  trend?: 'improving' | 'stable' | 'degrading';
  /** Comparison */
  comparison?: {
    previousScore: number;
    change: number;
  };
}

/**
 * Report recommendation
 */
export interface ReportRecommendation {
  /** ID */
  id: string;
  /** Title */
  title: string;
  /** Description */
  description: string;
  /** Priority */
  priority: 'critical' | 'high' | 'medium' | 'low';
  /** Effort */
  effort: 'minimal' | 'moderate' | 'significant' | 'extensive';
  /** Impact */
  impact: string;
  /** Related findings */
  relatedFindings: string[];
  /** Resources */
  resources?: string[];
}

/**
 * Report metadata
 */
export interface ReportMetadata {
  /** Generator version */
  generatorVersion: string;
  /** Configuration used */
  configuration: Partial<ReportConfig>;
  /** Run duration */
  runDurationMs: number;
  /** Environment */
  environment?: string;
  /** Auditor */
  auditor?: string;
}

/**
 * Report Generator
 */
export class ReportGenerator {
  private defaultConfig: ReportConfig = {
    title: 'AI Security Assessment Report',
    format: 'json',
    sections: [
      'executive_summary',
      'scope',
      'findings',
      'vulnerabilities',
      'risk_assessment',
      'recommendations',
    ],
    includeRawData: false,
    includeEvidence: true,
  };

  /**
   * Generate a report from results
   */
  generate(results: RedTeamResults, config?: ReportConfig): Report {
    const mergedConfig = { ...this.defaultConfig, ...config };
    const reportId = nanoid();

    const findings = this.extractFindings(results);
    const recommendations = this.generateRecommendations(findings, results);
    const summary = this.calculateSummary(results, findings);

    const report: Report = {
      id: reportId,
      title: mergedConfig.title!,
      generatedAt: Date.now(),
      format: mergedConfig.format,
      summary,
      findings,
      recommendations,
      metadata: {
        generatorVersion: '1.0.0',
        configuration: mergedConfig,
        runDurationMs: results.durationMs,
      },
    };

    // Add optional sections
    if (mergedConfig.sections?.includes('executive_summary')) {
      report.executiveSummary = this.generateExecutiveSummary(
        results,
        summary,
        findings,
      );
    }

    if (mergedConfig.sections?.includes('methodology')) {
      report.methodology = this.generateMethodology();
    }

    if (mergedConfig.sections?.includes('scope')) {
      report.scope = this.generateScope(results);
    }

    if (mergedConfig.sections?.includes('risk_assessment')) {
      report.riskAssessment = this.generateRiskAssessment(results, findings);
    }

    if (mergedConfig.includeRawData) {
      report.rawResults = results;
    }

    // Generate formatted content
    report.content = this.formatReport(report, mergedConfig);

    return report;
  }

  /**
   * Extract findings from results
   */
  private extractFindings(results: RedTeamResults): ReportFinding[] {
    const findings: ReportFinding[] = [];

    // From vulnerabilities
    for (const scanResult of results.scanResults) {
      for (const vuln of scanResult.vulnerabilities) {
        findings.push({
          id: vuln.id,
          title: vuln.name,
          description: vuln.description,
          severity: vuln.severity,
          category: vuln.category,
          evidence: vuln.evidence?.map((e) => e.content),
          recommendation: vuln.remediation,
          status:
            vuln.status === 'open'
              ? 'new'
              : vuln.status === 'accepted_risk' ||
                  vuln.status === 'false_positive'
                ? 'resolved'
                : vuln.status,
          references: vuln.references,
          cvssScore: vuln.cvssScore,
          cweId: vuln.cweId,
        });
      }
    }

    // From failed tests
    for (const testResult of results.testResults) {
      for (const result of testResult.results) {
        if (!result.passed) {
          findings.push({
            id: nanoid(),
            title: `Failed Test: ${result.testCase.name}`,
            description: result.failureReason || 'Test failed',
            severity: result.testCase.failureSeverity,
            category: result.testCase.attack.category,
            recommendation:
              'Review and address the security gap identified by this test',
            status: 'new',
          });
        }
      }
    }

    // From successful attacks
    for (const attackResult of results.attackResults) {
      if (attackResult.bypassed) {
        findings.push({
          id: nanoid(),
          title: `Bypassed Defense: ${attackResult.attack.name}`,
          description: `Attack successfully bypassed defenses: ${attackResult.attack.description}`,
          severity: attackResult.attack.severity,
          category: attackResult.attack.category,
          evidence: [attackResult.response.substring(0, 500)],
          recommendation: `Implement controls to block ${attackResult.attack.category} attacks`,
          status: 'confirmed',
        });
      }
    }

    // From compliance issues
    for (const complianceResult of results.complianceResults) {
      for (const finding of complianceResult.findings) {
        findings.push({
          id: finding.id,
          title: finding.title,
          description: finding.description,
          severity: finding.severity,
          category: 'compliance',
          recommendation:
            finding.remediation || 'Address compliance requirement',
          status:
            finding.status === 'open'
              ? 'new'
              : finding.status === 'accepted_risk'
                ? 'resolved'
                : finding.status,
        });
      }
    }

    // Sort by severity
    return findings.sort((a, b) => {
      const severityOrder: Record<Severity, number> = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
        informational: 4,
      };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    findings: ReportFinding[],
    results: RedTeamResults,
  ): ReportRecommendation[] {
    const recommendations: ReportRecommendation[] = [];
    const findingsByCategory = this.groupBy(findings, 'category');

    // Critical and high severity first
    const criticalFindings = findings.filter((f) => f.severity === 'critical');
    if (criticalFindings.length > 0) {
      recommendations.push({
        id: nanoid(),
        title: 'Address Critical Vulnerabilities Immediately',
        description: `${criticalFindings.length} critical vulnerabilities require immediate attention.`,
        priority: 'critical',
        effort: 'significant',
        impact:
          'Eliminating critical vulnerabilities significantly reduces risk of compromise',
        relatedFindings: criticalFindings.map((f) => f.id),
      });
    }

    const highFindings = findings.filter((f) => f.severity === 'high');
    if (highFindings.length > 0) {
      recommendations.push({
        id: nanoid(),
        title: 'Remediate High Severity Issues',
        description: `${highFindings.length} high severity issues should be addressed promptly.`,
        priority: 'high',
        effort: 'moderate',
        impact: 'Reduces attack surface and potential for exploitation',
        relatedFindings: highFindings.map((f) => f.id),
      });
    }

    // Category-specific recommendations
    for (const [category, categoryFindings] of Object.entries(
      findingsByCategory,
    )) {
      if (categoryFindings.length >= 2) {
        recommendations.push({
          id: nanoid(),
          title: `Improve ${this.formatCategory(category)} Controls`,
          description: `Multiple ${category} issues identified (${categoryFindings.length} findings). Consider implementing comprehensive controls.`,
          priority: this.getPriorityFromFindings(categoryFindings),
          effort: 'moderate',
          impact: `Systematic improvement of ${category} defenses`,
          relatedFindings: categoryFindings.map((f) => f.id),
        });
      }
    }

    // Benchmark-based recommendations
    if (results.benchmarkResults.length > 0) {
      const avgScore = results.summary.benchmarks.averageScore;
      if (avgScore < 0.7) {
        recommendations.push({
          id: nanoid(),
          title: 'Improve Safety Benchmark Scores',
          description: `Average safety benchmark score of ${(avgScore * 100).toFixed(1)}% is below acceptable threshold.`,
          priority: avgScore < 0.5 ? 'high' : 'medium',
          effort: 'significant',
          impact: 'Improved safety and reduced harmful output risks',
          relatedFindings: [],
        });
      }
    }

    // Compliance recommendations
    if (results.summary.compliance.nonCompliant > 0) {
      recommendations.push({
        id: nanoid(),
        title: 'Achieve Compliance Standards',
        description: `${results.summary.compliance.nonCompliant} compliance frameworks are not fully met.`,
        priority: 'high',
        effort: 'extensive',
        impact: 'Regulatory compliance and reduced legal/operational risk',
        relatedFindings: findings
          .filter((f) => f.category === 'compliance')
          .map((f) => f.id),
      });
    }

    return recommendations;
  }

  /**
   * Calculate summary
   */
  private calculateSummary(
    results: RedTeamResults,
    findings: ReportFinding[],
  ): ReportSummary {
    const critical = findings.filter((f) => f.severity === 'critical').length;
    const high = findings.filter((f) => f.severity === 'high').length;

    let riskLevel: ReportSummary['riskLevel'] = 'minimal';
    if (critical > 0) riskLevel = 'critical';
    else if (high > 0) riskLevel = 'high';
    else if (findings.filter((f) => f.severity === 'medium').length > 0)
      riskLevel = 'medium';
    else if (findings.length > 0) riskLevel = 'low';

    return {
      riskLevel,
      riskScore: results.summary.riskScore,
      keyFindings: findings.length,
      criticalVulnerabilities: critical,
      highVulnerabilities: high,
      testsPassed: results.summary.tests.passed,
      testsFailed: results.summary.tests.failed,
      complianceScore: results.summary.compliance.averageScore,
      summaryText: this.generateSummaryText(results.summary, findings),
    };
  }

  /**
   * Generate summary text
   */
  private generateSummaryText(
    summary: RedTeamSummary,
    _findings: ReportFinding[],
  ): string {
    const parts: string[] = [];

    if (summary.vulnerabilities.critical > 0) {
      parts.push(
        `${summary.vulnerabilities.critical} critical vulnerabilities require immediate attention.`,
      );
    }

    if (summary.attacks.successful > 0) {
      parts.push(
        `${summary.attacks.successful} out of ${summary.attacks.total} attack tests bypassed defenses.`,
      );
    }

    parts.push(`Overall risk score: ${summary.riskScore.toFixed(0)}/100.`);
    parts.push(summary.assessment);

    return parts.join(' ');
  }

  /**
   * Generate executive summary
   */
  private generateExecutiveSummary(
    results: RedTeamResults,
    summary: ReportSummary,
    findings: ReportFinding[],
  ): ExecutiveSummary {
    const criticalFindings = findings.filter(
      (f) => f.severity === 'critical' || f.severity === 'high',
    );

    return {
      overview: `This security assessment evaluated the AI system across ${results.testResults.length} test suites, ${results.attackResults.length} attack scenarios, and ${results.complianceResults.length} compliance frameworks.`,
      keyFindings: criticalFindings.slice(0, 5).map((f) => f.title),
      riskOverview: `The overall risk score is ${summary.riskScore.toFixed(0)}/100, classified as ${summary.riskLevel.toUpperCase()} risk.`,
      immediateActions: this.getImmediateActions(findings),
      assessment: results.summary.assessment,
    };
  }

  /**
   * Get immediate actions
   */
  private getImmediateActions(findings: ReportFinding[]): string[] {
    const actions: string[] = [];
    const critical = findings.filter((f) => f.severity === 'critical');

    for (const finding of critical.slice(0, 3)) {
      actions.push(`Address: ${finding.title}`);
    }

    if (actions.length === 0) {
      actions.push('No critical issues requiring immediate action');
    }

    return actions;
  }

  /**
   * Generate methodology section
   */
  private generateMethodology(): MethodologySection {
    return {
      approach:
        'Automated security testing combined with targeted attack simulations and compliance verification.',
      toolsUsed: [
        'RedTeam Toolkit',
        'Attack Library (jailbreak, injection, exfiltration)',
        'Safety Benchmarks (HarmBench, TruthfulQA, BBQ)',
        'Compliance Frameworks',
      ],
      standards: ['OWASP LLM Top 10', 'NIST AI RMF', 'EU AI Act requirements'],
      limitations: [
        'Testing limited to configured attack patterns',
        'May not cover all possible attack vectors',
        'Results represent point-in-time assessment',
      ],
    };
  }

  /**
   * Generate scope section
   */
  private generateScope(results: RedTeamResults): ScopeSection {
    return {
      inScope: [
        `Target: ${results.config.target.name}`,
        `Type: ${results.config.target.type}`,
        `Model: ${results.config.target.model || 'Not specified'}`,
      ],
      outOfScope: [
        'Physical security',
        'Network infrastructure',
        'Third-party dependencies',
      ],
      targetDescription: `AI system "${results.config.target.name}" configured as ${results.config.target.type}`,
      testingPeriod: {
        start: results.startTime,
        end: results.endTime,
      },
    };
  }

  /**
   * Generate risk assessment
   */
  private generateRiskAssessment(
    results: RedTeamResults,
    findings: ReportFinding[],
  ): RiskAssessment {
    const categories = [
      'jailbreak',
      'injection',
      'exfiltration',
      'compliance',
      'safety',
    ];
    const breakdown = categories.map((category) => {
      const categoryFindings = findings.filter((f) => f.category === category);
      const score = this.calculateCategoryScore(categoryFindings);
      return {
        category: this.formatCategory(category),
        risk: this.getRiskLevel(score),
        score,
      };
    });

    return {
      overallRisk: this.getRiskLevelFromScore(results.summary.riskScore),
      riskScore: results.summary.riskScore,
      breakdown,
    };
  }

  /**
   * Format report to content
   */
  private formatReport(report: Report, config: ReportConfig): string {
    switch (config.format) {
      case 'markdown':
        return this.formatMarkdown(report);
      case 'html':
        return this.formatHTML(report);
      case 'json':
      default:
        return JSON.stringify(report, null, 2);
    }
  }

  /**
   * Format as Markdown
   */
  private formatMarkdown(report: Report): string {
    const lines: string[] = [];

    lines.push(`# ${report.title}`);
    lines.push('');
    lines.push(`Generated: ${new Date(report.generatedAt).toISOString()}`);
    lines.push('');

    // Summary
    lines.push('## Summary');
    lines.push('');
    lines.push(`- **Risk Level:** ${report.summary.riskLevel.toUpperCase()}`);
    lines.push(`- **Risk Score:** ${report.summary.riskScore}/100`);
    lines.push(`- **Key Findings:** ${report.summary.keyFindings}`);
    lines.push(
      `- **Critical Issues:** ${report.summary.criticalVulnerabilities}`,
    );
    lines.push(
      `- **Tests Passed/Failed:** ${report.summary.testsPassed}/${report.summary.testsFailed}`,
    );
    lines.push('');

    // Executive Summary
    if (report.executiveSummary) {
      lines.push('## Executive Summary');
      lines.push('');
      lines.push(report.executiveSummary.overview);
      lines.push('');
      lines.push('### Key Findings');
      for (const finding of report.executiveSummary.keyFindings) {
        lines.push(`- ${finding}`);
      }
      lines.push('');
      lines.push('### Risk Overview');
      lines.push(report.executiveSummary.riskOverview);
      lines.push('');
    }

    // Findings
    lines.push('## Findings');
    lines.push('');
    for (const finding of report.findings) {
      lines.push(`### [${finding.severity.toUpperCase()}] ${finding.title}`);
      lines.push('');
      lines.push(finding.description);
      lines.push('');
      lines.push(`**Recommendation:** ${finding.recommendation}`);
      lines.push('');
    }

    // Recommendations
    lines.push('## Recommendations');
    lines.push('');
    for (const rec of report.recommendations) {
      lines.push(`### ${rec.title}`);
      lines.push('');
      lines.push(`**Priority:** ${rec.priority.toUpperCase()}`);
      lines.push('');
      lines.push(rec.description);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format as HTML
   */
  private formatHTML(report: Report): string {
    return `<!DOCTYPE html>
<html>
<head>
  <title>${report.title}</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    .critical { color: #dc3545; }
    .high { color: #fd7e14; }
    .medium { color: #ffc107; }
    .low { color: #28a745; }
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .metric { text-align: center; }
    .metric-value { font-size: 2em; font-weight: bold; }
  </style>
</head>
<body>
  <h1>${report.title}</h1>
  <p>Generated: ${new Date(report.generatedAt).toISOString()}</p>

  <div class="summary">
    <div class="card metric">
      <div class="metric-value ${report.summary.riskLevel}">${report.summary.riskScore}</div>
      <div>Risk Score</div>
    </div>
    <div class="card metric">
      <div class="metric-value">${report.summary.keyFindings}</div>
      <div>Findings</div>
    </div>
    <div class="card metric">
      <div class="metric-value critical">${report.summary.criticalVulnerabilities}</div>
      <div>Critical Issues</div>
    </div>
  </div>

  <h2>Findings</h2>
  ${report.findings
    .map(
      (f) => `
    <div class="card">
      <h3 class="${f.severity}">[${f.severity.toUpperCase()}] ${f.title}</h3>
      <p>${f.description}</p>
      <p><strong>Recommendation:</strong> ${f.recommendation}</p>
    </div>
  `,
    )
    .join('')}

  <h2>Recommendations</h2>
  ${report.recommendations
    .map(
      (r) => `
    <div class="card">
      <h3>${r.title}</h3>
      <p><strong>Priority:</strong> ${r.priority.toUpperCase()}</p>
      <p>${r.description}</p>
    </div>
  `,
    )
    .join('')}
</body>
</html>`;
  }

  /**
   * Helper methods
   */
  private groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce(
      (groups, item) => {
        const value = String(item[key]);
        (groups[value] = groups[value] || []).push(item);
        return groups;
      },
      {} as Record<string, T[]>,
    );
  }

  private formatCategory(category: string): string {
    return category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private getPriorityFromFindings(
    findings: ReportFinding[],
  ): ReportRecommendation['priority'] {
    if (findings.some((f) => f.severity === 'critical')) return 'critical';
    if (findings.some((f) => f.severity === 'high')) return 'high';
    if (findings.some((f) => f.severity === 'medium')) return 'medium';
    return 'low';
  }

  private calculateCategoryScore(findings: ReportFinding[]): number {
    if (findings.length === 0) return 100;
    const weights: Record<Severity, number> = {
      critical: 25,
      high: 15,
      medium: 8,
      low: 3,
      informational: 1,
    };
    const deduction = findings.reduce((sum, f) => sum + weights[f.severity], 0);
    return Math.max(0, 100 - deduction);
  }

  private getRiskLevel(score: number): string {
    if (score >= 90) return 'Minimal';
    if (score >= 70) return 'Low';
    if (score >= 50) return 'Medium';
    if (score >= 30) return 'High';
    return 'Critical';
  }

  private getRiskLevelFromScore(score: number): RiskAssessment['overallRisk'] {
    if (score >= 90) return 'minimal';
    if (score >= 70) return 'low';
    if (score >= 50) return 'medium';
    if (score >= 30) return 'high';
    return 'critical';
  }
}

/**
 * Create a report generator
 */
export function createReportGenerator(): ReportGenerator {
  return new ReportGenerator();
}
