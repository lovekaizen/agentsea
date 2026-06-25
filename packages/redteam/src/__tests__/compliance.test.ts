import { describe, it, expect } from 'vitest';
import { ComplianceChecker } from '../compliance/index.js';
import type {
  ComplianceFramework,
  ComplianceRequirement,
} from '../compliance/index.js';

function req(
  id: string,
  category: string,
  overrides: Partial<ComplianceRequirement> = {},
): ComplianceRequirement {
  return {
    id,
    name: `Requirement ${id}`,
    description: `desc ${id}`,
    category,
    severity: 'high',
    mandatory: true,
    verificationMethod: 'automated_test',
    ...overrides,
  };
}

const framework: ComplianceFramework = {
  id: 'demo',
  name: 'Demo Framework',
  version: '1.0',
  description: 'test framework',
  requirements: [
    req('R1', 'security'),
    req('R2', 'security'),
    req('R3', 'privacy'),
  ],
  categories: [
    { id: 'security', name: 'Security', description: '', weight: 1 },
    { id: 'privacy', name: 'Privacy', description: '', weight: 1 },
  ],
};

describe('ComplianceChecker', () => {
  it('reports full compliance when all requirements pass', () => {
    const checker = new ComplianceChecker(framework);
    const result = checker.check({
      R1: { status: 'compliant' },
      R2: { status: 'compliant' },
      R3: { status: 'compliant' },
    });

    expect(result.status).toBe('compliant');
    expect(result.score).toBe(100);
    expect(result.findings).toHaveLength(0);
  });

  it('flags non-compliant requirements as findings with recommendations', () => {
    const checker = new ComplianceChecker(framework);
    const result = checker.check({
      R1: { status: 'compliant' },
      R2: { status: 'non_compliant' },
      R3: { status: 'partially_compliant' },
    });

    expect(result.status).toBe('non_compliant');
    expect(result.score).toBeLessThan(100);
    // R2 (non-compliant) + R3 (partial) → 2 findings
    expect(result.findings).toHaveLength(2);
    expect(result.recommendations).toHaveLength(2);
    expect(result.findings.map((f) => f.requirementIds[0]).sort()).toEqual([
      'R2',
      'R3',
    ]);
  });

  it('computes per-category scores', () => {
    const checker = new ComplianceChecker(framework);
    const result = checker.check({
      R1: { status: 'compliant' },
      R2: { status: 'non_compliant' },
      R3: { status: 'compliant' },
    });

    expect(result.categoryScores.security.score).toBe(50); // 1 of 2
    expect(result.categoryScores.privacy.score).toBe(100); // 1 of 1
    expect(result.categoryScores.security.compliantRequirements).toBe(1);
  });

  it('honors mandatoryOnly and category filters in config', () => {
    const checker = new ComplianceChecker(
      {
        ...framework,
        requirements: [
          req('R1', 'security'),
          req('R2', 'security', { mandatory: false }),
        ],
      },
      { mandatoryOnly: true },
    );

    const result = checker.check({ R1: { status: 'compliant' } });
    // Only the mandatory R1 is evaluated.
    expect(result.requirementResults).toHaveLength(1);
    expect(result.status).toBe('compliant');
  });

  it('excludes not_applicable requirements from scoring', () => {
    const checker = new ComplianceChecker(framework);
    const result = checker.check({
      R1: { status: 'compliant' },
      R2: { status: 'compliant' },
      R3: { status: 'not_applicable' },
    });
    expect(result.score).toBe(100);
  });
});
