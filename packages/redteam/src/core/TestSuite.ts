/**
 * TestSuite - Test Suite Execution Framework
 *
 * Manages and executes collections of test cases for
 * security and safety evaluation.
 */

import { EventEmitter } from 'eventemitter3';
import { nanoid } from 'nanoid';
import type {
  TestCase,
  TestCaseResult,
  TestSuiteConfig,
  TestSuiteResult,
  TestSummary,
  TestProgress,
  TestReporter,
  TestResultOutcome,
  RetryPolicy,
} from '../types/test.types.js';
import type { TargetConfig } from '../types/config.types.js';
import type { AttackResult } from '../types/attack.types.js';

/**
 * TestSuite events
 */
export interface TestSuiteEvents {
  /** Suite started */
  'suite:start': (suiteId: string) => void;
  /** Suite completed */
  'suite:complete': (result: TestSuiteResult) => void;
  /** Test started */
  'test:start': (testCase: TestCase) => void;
  /** Test completed */
  'test:complete': (result: TestCaseResult) => void;
  /** Test skipped */
  'test:skip': (testCase: TestCase, reason: string) => void;
  /** Test retrying */
  'test:retry': (testCase: TestCase, attempt: number) => void;
  /** Progress update */
  progress: (progress: TestProgress) => void;
}

/**
 * Test suite run options
 */
export interface TestSuiteRunOptions {
  /** Target configuration */
  target: TargetConfig;
  /** Dry run mode */
  dryRun?: boolean;
  /** Reporter */
  reporter?: TestReporter;
  /** Filter by tags */
  filterTags?: string[];
  /** Skip tests with tags */
  skipTags?: string[];
  /** Override timeout */
  timeout?: number;
  /** Override retry policy */
  retryPolicy?: RetryPolicy;
}

/**
 * Test executor function type
 */
export type TestExecutor = (
  testCase: TestCase,
  target: TargetConfig,
) => Promise<AttackResult>;

/**
 * TestSuite - Test Suite Class
 */
export class TestSuite extends EventEmitter<TestSuiteEvents> {
  /** Suite ID */
  readonly id: string;
  /** Suite name */
  readonly name: string;
  /** Suite description */
  readonly description?: string;

  private config: TestSuiteConfig;
  private testCases: TestCase[];
  private executor?: TestExecutor;
  private isRunning: boolean = false;
  private shouldAbort: boolean = false;

  constructor(config: TestSuiteConfig) {
    super();
    this.id = nanoid();
    this.name = config.name;
    this.description = config.description;
    this.config = config;
    this.testCases = [...config.testCases];
  }

  /**
   * Set test executor
   */
  setExecutor(executor: TestExecutor): this {
    this.executor = executor;
    return this;
  }

  /**
   * Add a test case
   */
  addTestCase(testCase: TestCase): this {
    this.testCases.push(testCase);
    return this;
  }

  /**
   * Add multiple test cases
   */
  addTestCases(testCases: TestCase[]): this {
    this.testCases.push(...testCases);
    return this;
  }

  /**
   * Remove a test case
   */
  removeTestCase(testCaseId: string): this {
    this.testCases = this.testCases.filter((tc) => tc.id !== testCaseId);
    return this;
  }

  /**
   * Get all test cases
   */
  getTestCases(): TestCase[] {
    return [...this.testCases];
  }

  /**
   * Filter test cases
   */
  private filterTestCases(options: TestSuiteRunOptions): TestCase[] {
    let filtered = [...this.testCases];

    // Filter by tags (include)
    if (options.filterTags && options.filterTags.length > 0) {
      filtered = filtered.filter((tc) =>
        tc.tags.some((tag) => options.filterTags!.includes(tag)),
      );
    }

    // Skip by tags (exclude)
    if (options.skipTags && options.skipTags.length > 0) {
      filtered = filtered.filter(
        (tc) => !tc.tags.some((tag) => options.skipTags!.includes(tag)),
      );
    }

    // Skip explicitly marked tests
    filtered = filtered.filter((tc) => !tc.skip);

    return filtered;
  }

  /**
   * Run the test suite
   */
  async run(options: TestSuiteRunOptions): Promise<TestSuiteResult> {
    if (this.isRunning) {
      throw new Error('Test suite is already running');
    }

    if (!this.executor) {
      throw new Error('No test executor configured');
    }

    this.isRunning = true;
    this.shouldAbort = false;
    const suiteId = this.id;
    const startTime = Date.now();

    this.emit('suite:start', suiteId);
    options.reporter?.onSuiteStart?.(this.config);

    // Setup
    if (this.config.setup) {
      await this.config.setup();
    }

    const results: TestCaseResult[] = [];
    const testCases = this.filterTestCases(options);
    const totalTests = testCases.length;
    let completedTests = 0;

    try {
      if (
        this.config.parallel &&
        this.config.maxParallel &&
        this.config.maxParallel > 1
      ) {
        // Parallel execution
        const chunks = this.chunkArray(testCases, this.config.maxParallel);
        for (const chunk of chunks) {
          if (this.shouldAbort) break;
          const chunkResults = await Promise.all(
            chunk.map((tc) => this.runTestCase(tc, options)),
          );
          results.push(...chunkResults);
          completedTests += chunkResults.length;
          this.emitProgress(completedTests, totalTests, results, startTime);

          // Check fail fast
          if (this.config.failFast && chunkResults.some((r) => !r.passed)) {
            break;
          }
        }
      } else {
        // Sequential execution
        for (const testCase of testCases) {
          if (this.shouldAbort) break;

          const result = await this.runTestCase(testCase, options);
          results.push(result);
          completedTests++;
          this.emitProgress(completedTests, totalTests, results, startTime);

          // Check fail fast
          if (this.config.failFast && !result.passed) {
            break;
          }
        }
      }
    } finally {
      // Teardown
      if (this.config.teardown) {
        await this.config.teardown();
      }
      this.isRunning = false;
    }

    // Add skipped tests
    const skippedCases = this.testCases.filter((tc) => tc.skip);
    for (const tc of skippedCases) {
      this.emit('test:skip', tc, tc.skipReason || 'Marked as skip');
      results.push({
        testCase: tc,
        attackResult: this.createMockAttackResult(tc),
        passed: false,
        status: 'completed',
        failureReason: tc.skipReason || 'Skipped',
        durationMs: 0,
        timestamp: Date.now(),
        retryCount: 0,
      });
    }

    const endTime = Date.now();
    const summary = this.calculateSummary(results);
    const outcome = this.determineOutcome(summary);

    const suiteResult: TestSuiteResult = {
      id: suiteId,
      name: this.name,
      outcome,
      status: 'completed',
      results,
      summary,
      startTime,
      endTime,
      durationMs: endTime - startTime,
    };

    this.emit('suite:complete', suiteResult);
    options.reporter?.onSuiteComplete?.(suiteResult);

    return suiteResult;
  }

  /**
   * Run a single test case
   */
  private async runTestCase(
    testCase: TestCase,
    options: TestSuiteRunOptions,
  ): Promise<TestCaseResult> {
    const startTime = Date.now();
    let retryCount = 0;
    let lastError: string | undefined;

    // Before each hook
    if (this.config.beforeEach) {
      await this.config.beforeEach(testCase);
    }

    this.emit('test:start', testCase);
    options.reporter?.onTestStart?.(testCase);

    const timeout = testCase.timeout || options.timeout || 30000;
    const maxRetries = options.retryPolicy?.maxRetries || 0;

    let result: TestCaseResult;

    while (retryCount <= maxRetries) {
      try {
        if (options.dryRun) {
          // Dry run - don't actually execute
          result = {
            testCase,
            attackResult: this.createMockAttackResult(testCase),
            passed: true,
            status: 'completed',
            durationMs: 0,
            timestamp: Date.now(),
            retryCount,
          };
          break;
        }

        // Execute with timeout
        const attackResult = await this.executeWithTimeout(
          () => this.executor!(testCase, options.target),
          timeout,
        );

        // Evaluate result
        const passed = this.evaluateResult(testCase, attackResult);

        result = {
          testCase,
          attackResult,
          passed,
          status: 'completed',
          failureReason: passed
            ? undefined
            : this.getFailureReason(testCase, attackResult),
          durationMs: Date.now() - startTime,
          timestamp: Date.now(),
          retryCount,
        };
        break;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        retryCount++;

        if (retryCount <= maxRetries) {
          this.emit('test:retry', testCase, retryCount);
          await this.delay(options.retryPolicy?.initialDelay || 1000);
        } else {
          result = {
            testCase,
            attackResult: this.createMockAttackResult(testCase),
            passed: false,
            status: 'failed',
            failureReason: lastError,
            durationMs: Date.now() - startTime,
            timestamp: Date.now(),
            retryCount: retryCount - 1,
          };
        }
      }
    }

    // After each hook
    if (this.config.afterEach) {
      await this.config.afterEach(result!);
    }

    this.emit('test:complete', result!);
    options.reporter?.onTestComplete?.(result!);

    return result!;
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number,
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Test timeout')), timeout),
      ),
    ]);
  }

  /**
   * Evaluate test result
   */
  private evaluateResult(
    testCase: TestCase,
    attackResult: AttackResult,
  ): boolean {
    switch (testCase.expectedResult) {
      case 'blocked':
        return !attackResult.bypassed && attackResult.outcome === 'blocked';
      case 'allowed':
        return attackResult.bypassed || attackResult.outcome === 'success';
      case 'detected':
        return attackResult.detectionIndicators.length > 0;
      case 'mitigated':
        return (
          attackResult.outcome === 'partial' ||
          attackResult.outcome === 'blocked'
        );
      default:
        return false;
    }
  }

  /**
   * Get failure reason
   */
  private getFailureReason(
    testCase: TestCase,
    attackResult: AttackResult,
  ): string {
    if (testCase.expectedResult === 'blocked' && attackResult.bypassed) {
      return 'Attack bypassed defenses (expected blocked)';
    }
    if (
      testCase.expectedResult === 'detected' &&
      attackResult.detectionIndicators.length === 0
    ) {
      return 'Attack not detected (expected detection)';
    }
    return `Expected ${testCase.expectedResult}, got ${attackResult.outcome}`;
  }

  /**
   * Create mock attack result for dry runs and skips
   */
  private createMockAttackResult(testCase: TestCase): AttackResult {
    return {
      attack: testCase.attack,
      outcome: 'blocked',
      response: '[MOCK]',
      bypassed: false,
      confidence: 0,
      detectionIndicators: [],
      executionTimeMs: 0,
      timestamp: Date.now(),
    };
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(results: TestCaseResult[]): TestSummary {
    const total = results.length;
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter(
      (r) => !r.passed && r.status === 'completed',
    ).length;
    const skipped = results.filter((r) =>
      r.failureReason?.includes('Skip'),
    ).length;
    const errors = results.filter((r) => r.status === 'failed').length;

    const bySeverity = this.groupBySeverity(results);

    return {
      total,
      passed,
      failed,
      skipped,
      errors,
      passRate: total > 0 ? passed / total : 0,
      bySeverity,
    };
  }

  /**
   * Group results by severity
   */
  private groupBySeverity(
    results: TestCaseResult[],
  ): TestSummary['bySeverity'] {
    const bySeverity: TestSummary['bySeverity'] = {
      critical: { passed: 0, failed: 0 },
      high: { passed: 0, failed: 0 },
      medium: { passed: 0, failed: 0 },
      low: { passed: 0, failed: 0 },
      informational: { passed: 0, failed: 0 },
    };

    for (const result of results) {
      const severity = result.testCase.failureSeverity;
      if (result.passed) {
        bySeverity[severity].passed++;
      } else {
        bySeverity[severity].failed++;
      }
    }

    return bySeverity;
  }

  /**
   * Determine overall outcome
   */
  private determineOutcome(summary: TestSummary): TestResultOutcome {
    if (summary.errors > 0) return 'error';
    if (summary.failed === 0 && summary.passed > 0) return 'passed';
    if (summary.passed === 0 && summary.failed > 0) return 'failed';
    if (summary.passed > 0 && summary.failed > 0) return 'mixed';
    if (summary.skipped === summary.total) return 'skipped';
    return 'error';
  }

  /**
   * Emit progress
   */
  private emitProgress(
    current: number,
    total: number,
    results: TestCaseResult[],
    startTime: number,
  ): void {
    const elapsed = Date.now() - startTime;
    const avgTimePerTest = current > 0 ? elapsed / current : 0;
    const remaining = total - current;

    const progress: TestProgress = {
      current,
      total,
      percentage: total > 0 ? (current / total) * 100 : 0,
      currentTestName:
        results.length > 0 ? results[results.length - 1].testCase.name : '',
      passed: results.filter((r) => r.passed).length,
      failed: results.filter((r) => !r.passed).length,
      elapsedMs: elapsed,
      estimatedRemainingMs: remaining * avgTimePerTest,
    };

    this.emit('progress', progress);
  }

  /**
   * Abort the test suite
   */
  abort(): void {
    this.shouldAbort = true;
  }

  /**
   * Check if running
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Helper to chunk array
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Helper to delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a test suite
 */
export function createTestSuite(config: TestSuiteConfig): TestSuite {
  return new TestSuite(config);
}

/**
 * Test suite builder for fluent API
 */
export class TestSuiteBuilder {
  private config: Partial<TestSuiteConfig> = {
    name: 'Unnamed Suite',
    testCases: [],
  };

  name(name: string): this {
    this.config.name = name;
    return this;
  }

  description(description: string): this {
    this.config.description = description;
    return this;
  }

  addTest(testCase: TestCase): this {
    this.config.testCases!.push(testCase);
    return this;
  }

  parallel(maxParallel: number = 4): this {
    this.config.parallel = true;
    this.config.maxParallel = maxParallel;
    return this;
  }

  sequential(): this {
    this.config.parallel = false;
    return this;
  }

  failFast(enabled: boolean = true): this {
    this.config.failFast = enabled;
    return this;
  }

  setup(fn: () => Promise<void>): this {
    this.config.setup = fn;
    return this;
  }

  teardown(fn: () => Promise<void>): this {
    this.config.teardown = fn;
    return this;
  }

  beforeEach(fn: (testCase: TestCase) => Promise<void>): this {
    this.config.beforeEach = fn;
    return this;
  }

  afterEach(fn: (result: TestCaseResult) => Promise<void>): this {
    this.config.afterEach = fn;
    return this;
  }

  build(): TestSuite {
    return new TestSuite(this.config as TestSuiteConfig);
  }
}

/**
 * Create a test suite builder
 */
export function testSuite(): TestSuiteBuilder {
  return new TestSuiteBuilder();
}
