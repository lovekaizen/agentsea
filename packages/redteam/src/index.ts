/**
 * @lov3kaizen/agentsea-redteam
 *
 * AI Safety & Red Teaming Toolkit for proactive security testing of AI agents.
 *
 * This package provides comprehensive tools for:
 * - Attack simulation and penetration testing
 * - Vulnerability scanning and analysis
 * - Safety benchmark evaluation
 * - Compliance checking against AI regulations
 * - Real-time threat detection
 * - Audit logging and evidence collection
 * - Continuous security testing
 *
 * @example
 * ```typescript
 * import { createRedTeam, createAttackLibrary, createVulnerabilityScanner } from '@lov3kaizen/agentsea-redteam';
 *
 * // Create a red team instance
 * const redTeam = createRedTeam({
 *   config: {
 *     target: {
 *       type: 'agent',
 *       name: 'my-agent',
 *       endpoint: 'https://api.example.com/chat',
 *     },
 *   },
 * });
 *
 * // Run security tests
 * const results = await redTeam.run();
 * console.log('Risk Score:', results.summary.riskScore);
 * ```
 */

// Core orchestration
export {
  RedTeam,
  createRedTeam,
  TestSuite,
  TestSuiteBuilder,
  createTestSuite,
  testSuite,
  ReportGenerator,
  createReportGenerator,
  type RedTeamEvents,
  type RedTeamResults,
  type RedTeamSummary,
  type RedTeamOptions,
  type AttackHandler,
  type Scanner,
  type ScannerOptions,
  type BenchmarkRunner,
  type BenchmarkRunnerOptions,
  type ComplianceChecker as RedTeamComplianceChecker,
  type ComplianceCheckerOptions,
  type TestSuiteEvents,
  type TestSuiteRunOptions,
  type TestExecutor,
  type Report,
  type ReportConfig,
  type ReportSection as ReportSectionType,
  type ReportBranding,
  type ReportSummary,
  type ReportFinding,
  type ReportRecommendation,
  type ReportMetadata,
  type ExecutiveSummary,
  type MethodologySection,
  type ScopeSection,
  type RiskAssessment,
} from './core/index.js';

// Attack library and generators
export {
  AttackLibrary,
  createAttackLibrary,
  defaultAttackLibrary,
  AttackRegistry,
  createAttackRegistry,
  defaultAttackRegistry,
  MutationGenerator,
  createMutationGenerator,
  CombinationGenerator,
  createCombinationGenerator,
  AdversarialGenerator,
  createAdversarialGenerator,
  type AttackRegistryEvents,
  type AttackExecutor,
  type AttackValidator,
  type AttackRegistryConfig,
  type MutationConfig as MutationGeneratorConfig,
  type Mutator,
  type CombinationConfig,
  type CombinationStrategy,
  type CombinedAttack,
  type AdversarialConfig,
  type AdversarialStrategy,
  type AdversarialAttack,
} from './attacks/index.js';

// Vulnerability scanning
export {
  VulnerabilityScanner,
  createVulnerabilityScanner,
  PromptAnalyzer,
  createPromptAnalyzer,
  SystemPromptAudit,
  createSystemPromptAudit,
  type VulnerabilityScannerEvents,
  type ScanTestExecutor,
} from './scanning/index.js';

// Threat detection
export {
  JailbreakDetector,
  createJailbreakDetector,
} from './detection/index.js';

// Safety benchmarks
export {
  SafetyBenchmark,
  createSafetyBenchmark,
  defaultSafetyScorer,
  type RespondFn,
  type ScorerFn,
} from './benchmarks/index.js';

// Compliance checking
export {
  ComplianceChecker,
  createComplianceChecker,
  type RequirementEvaluation,
  type ComplianceEvaluations,
} from './compliance/index.js';

// Audit logging
export {
  AuditLogger,
  EvidenceCollector,
  createAuditLogger,
  createEvidenceCollector,
  FileAuditStore,
  createFileAuditStore,
  type AuditStore,
  type AuditEntryInput,
} from './audit/index.js';

// Continuous testing
export {
  ContinuousTesting,
  Scheduler,
  AlertManager,
  createContinuousTesting,
  createScheduler,
  createAlertManager,
  nextRunAt,
  nextCronAt,
  type TestRunner,
} from './continuous/index.js';

// Integrations
export {
  createAgentSeaIntegration,
  createCIIntegration,
  type AgentSeaIntegrationConfig,
  type CIIntegrationConfig,
} from './integrations/index.js';

// Types - export from types module
export * from './types/index.js';

// Version (keep in sync with package.json)
export const VERSION = '1.0.0';
