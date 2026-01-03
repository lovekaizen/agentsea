/**
 * Core Module - Red Team Toolkit
 *
 * Main orchestration components for AI security testing.
 */

// Main orchestrator
export {
  RedTeam,
  createRedTeam,
  type RedTeamEvents,
  type RedTeamResults,
  type RedTeamSummary,
  type RedTeamOptions,
  type AttackHandler,
  type Scanner,
  type ScannerOptions,
  type BenchmarkRunner,
  type BenchmarkRunnerOptions,
  type ComplianceChecker,
  type ComplianceCheckerOptions,
} from './RedTeam.js';

// Test suite
export {
  TestSuite,
  TestSuiteBuilder,
  createTestSuite,
  testSuite,
  type TestSuiteEvents,
  type TestSuiteRunOptions,
  type TestExecutor,
} from './TestSuite.js';

// Report generation
export {
  ReportGenerator,
  createReportGenerator,
  type Report,
  type ReportConfig,
  type ReportSection,
  type ReportBranding,
  type ReportSummary,
  type ReportFinding,
  type ReportRecommendation,
  type ReportMetadata,
  type ExecutiveSummary,
  type MethodologySection,
  type ScopeSection,
  type RiskAssessment,
} from './Report.js';
