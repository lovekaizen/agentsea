/**
 * Test Types for Red Team Testing
 */

import type {
  Attack,
  AttackResult,
  AttackExecutionOptions,
  Severity,
} from './attack.types.js';

/**
 * Test status
 */
export type TestStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Overall test result
 */
export type TestResultOutcome =
  | 'passed'
  | 'failed'
  | 'mixed'
  | 'error'
  | 'skipped';

/**
 * Test case definition
 */
export interface TestCase {
  /** Unique identifier */
  id: string;
  /** Test case name */
  name: string;
  /** Test description */
  description: string;
  /** Attack to execute */
  attack: Attack;
  /** Pre-conditions for the test */
  preconditions?: string[];
  /** Expected result */
  expectedResult: 'blocked' | 'allowed' | 'detected' | 'mitigated';
  /** Severity if test fails */
  failureSeverity: Severity;
  /** Tags for categorization */
  tags: string[];
  /** Skip this test */
  skip?: boolean;
  /** Skip reason */
  skipReason?: string;
  /** Timeout for this specific test */
  timeout?: number;
}

/**
 * Test case result
 */
export interface TestCaseResult {
  /** Test case that was executed */
  testCase: TestCase;
  /** Attack result */
  attackResult: AttackResult;
  /** Whether test passed */
  passed: boolean;
  /** Status */
  status: TestStatus;
  /** Failure reason if applicable */
  failureReason?: string;
  /** Duration in ms */
  durationMs: number;
  /** Timestamp */
  timestamp: number;
  /** Retry count */
  retryCount: number;
}

/**
 * Test suite configuration
 */
export interface TestSuiteConfig {
  /** Suite name */
  name: string;
  /** Suite description */
  description?: string;
  /** Test cases to include */
  testCases: TestCase[];
  /** Default execution options */
  defaultOptions?: AttackExecutionOptions;
  /** Setup hook */
  setup?: () => Promise<void>;
  /** Teardown hook */
  teardown?: () => Promise<void>;
  /** Before each test hook */
  beforeEach?: (testCase: TestCase) => Promise<void>;
  /** After each test hook */
  afterEach?: (result: TestCaseResult) => Promise<void>;
  /** Parallel execution */
  parallel?: boolean;
  /** Max parallel tests */
  maxParallel?: number;
  /** Stop on first failure */
  failFast?: boolean;
  /** Tags to filter tests */
  filterTags?: string[];
  /** Skip tests with tags */
  skipTags?: string[];
}

/**
 * Test suite result
 */
export interface TestSuiteResult {
  /** Suite ID */
  id: string;
  /** Suite name */
  name: string;
  /** Overall outcome */
  outcome: TestResultOutcome;
  /** Status */
  status: TestStatus;
  /** Individual test results */
  results: TestCaseResult[];
  /** Summary statistics */
  summary: TestSummary;
  /** Start time */
  startTime: number;
  /** End time */
  endTime: number;
  /** Total duration in ms */
  durationMs: number;
  /** Error if suite failed */
  error?: string;
}

/**
 * Test summary statistics
 */
export interface TestSummary {
  /** Total tests */
  total: number;
  /** Tests passed */
  passed: number;
  /** Tests failed */
  failed: number;
  /** Tests skipped */
  skipped: number;
  /** Tests with errors */
  errors: number;
  /** Pass rate (0-1) */
  passRate: number;
  /** By severity */
  bySeverity: {
    critical: { passed: number; failed: number };
    high: { passed: number; failed: number };
    medium: { passed: number; failed: number };
    low: { passed: number; failed: number };
    informational: { passed: number; failed: number };
  };
}

/**
 * Test run configuration
 */
export interface TestRunConfig {
  /** Run ID */
  runId?: string;
  /** Environment name */
  environment?: string;
  /** Target system information */
  target?: TargetInfo;
  /** Execution options */
  executionOptions?: AttackExecutionOptions;
  /** Output format */
  outputFormat?: 'json' | 'junit' | 'html' | 'markdown';
  /** Output path */
  outputPath?: string;
  /** Verbose output */
  verbose?: boolean;
  /** Reporter callback */
  reporter?: TestReporter;
}

/**
 * Target system information
 */
export interface TargetInfo {
  /** Target name/identifier */
  name: string;
  /** Target type */
  type: 'agent' | 'api' | 'model' | 'endpoint' | 'custom';
  /** Version if known */
  version?: string;
  /** Endpoint URL if applicable */
  endpoint?: string;
  /** Model being used */
  model?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Test reporter interface
 */
export interface TestReporter {
  /** Called when suite starts */
  onSuiteStart?: (suite: TestSuiteConfig) => void;
  /** Called when test starts */
  onTestStart?: (testCase: TestCase) => void;
  /** Called when test completes */
  onTestComplete?: (result: TestCaseResult) => void;
  /** Called when suite completes */
  onSuiteComplete?: (result: TestSuiteResult) => void;
  /** Called on progress update */
  onProgress?: (progress: TestProgress) => void;
}

/**
 * Test progress information
 */
export interface TestProgress {
  /** Current test index */
  current: number;
  /** Total tests */
  total: number;
  /** Percentage complete */
  percentage: number;
  /** Current test name */
  currentTestName: string;
  /** Tests passed so far */
  passed: number;
  /** Tests failed so far */
  failed: number;
  /** Elapsed time in ms */
  elapsedMs: number;
  /** Estimated remaining time in ms */
  estimatedRemainingMs?: number;
}

/**
 * Test assertion
 */
export interface TestAssertion {
  /** Assertion type */
  type: 'contains' | 'notContains' | 'matches' | 'equals' | 'custom';
  /** Expected value or pattern */
  expected: string | RegExp;
  /** Actual value */
  actual?: string;
  /** Whether assertion passed */
  passed: boolean;
  /** Assertion message */
  message?: string;
}

/**
 * Test retry policy
 */
export interface RetryPolicy {
  /** Maximum retries */
  maxRetries: number;
  /** Initial delay in ms */
  initialDelay: number;
  /** Delay multiplier for backoff */
  backoffMultiplier: number;
  /** Maximum delay in ms */
  maxDelay: number;
  /** Retry on these outcomes */
  retryOn: ('error' | 'timeout' | 'rate_limit')[];
}
