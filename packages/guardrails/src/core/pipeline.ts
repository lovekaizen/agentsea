/**
 * Pipeline
 *
 * Pipeline implementation for executing multiple guards
 * in sequence or parallel with configurable failure handling.
 */

import type {
  Guard,
  GuardContext,
  GuardResult,
  GuardAction,
  Pipeline as IPipeline,
  PipelineConfig,
  PipelineState,
  PipelineResult,
  PipelineEvent,
  PipelineBuilder as IPipelineBuilder,
  SkipCondition,
  ExecutionMode,
  FailureMode,
} from '../types';
import { GuardRegistry } from './guard-registry';

/**
 * Default pipeline configuration
 */
const DEFAULT_PIPELINE_CONFIG: Omit<PipelineConfig, 'name' | 'guards'> = {
  executionMode: 'sequential',
  failureMode: 'fail-fast',
  timeoutMs: 30000,
};

/**
 * Pipeline implementation
 *
 * Executes a sequence of guards with configurable behavior.
 */
export class Pipeline implements IPipeline {
  readonly name: string;
  readonly config: PipelineConfig;

  private guards: Guard[] = [];
  private state: PipelineState;
  private cancelled = false;

  constructor(config: PipelineConfig, guards?: Guard[]) {
    this.name = config.name;
    this.config = { ...DEFAULT_PIPELINE_CONFIG, ...config };
    this.guards = guards ?? [];
    this.state = this.createInitialState();

    // If guard names provided but no guard instances, resolve from registry
    if (this.guards.length === 0 && config.guards.length > 0) {
      this.guards = GuardRegistry.createGuards(config.guards);
    }
  }

  /**
   * Execute the pipeline
   */
  async execute(context: GuardContext): Promise<PipelineResult> {
    this.reset();
    this.state.status = 'running';
    this.state.startTime = new Date();

    try {
      const results =
        this.config.executionMode === 'parallel'
          ? await this.executeParallel(context)
          : await this.executeSequential(context);

      // Update status based on results before building final result
      // Check if cancelled first
      if (this.state.status !== 'cancelled') {
        const failed = results.some((r) => !r.passed);
        this.state.status = failed ? 'failed' : 'completed';
      }

      return this.buildResult(results);
    } catch (error) {
      this.state.status = 'failed';
      this.state.error =
        error instanceof Error ? error : new Error(String(error));
      throw error;
    } finally {
      this.state.endTime = new Date();
      this.state.totalLatencyMs =
        this.state.endTime.getTime() - this.state.startTime.getTime();
    }
  }

  /**
   * Execute with streaming results
   */
  async *executeStream(
    context: GuardContext,
  ): AsyncGenerator<PipelineEvent, PipelineResult> {
    this.reset();
    this.state.status = 'running';
    this.state.startTime = new Date();

    yield {
      type: 'pipeline_start',
      pipelineName: this.name,
      guardCount: this.guards.length,
      timestamp: new Date(),
    };

    const results: GuardResult[] = [];

    try {
      for (let i = 0; i < this.guards.length; i++) {
        if (this.cancelled) {
          this.state.status = 'cancelled';
          break;
        }

        const guard = this.guards[i];
        this.state.currentGuard = guard.name;

        // Check skip conditions
        const skipReason = this.shouldSkip(guard.name, results);
        if (skipReason) {
          this.state.skippedGuards.push(guard.name);
          yield {
            type: 'guard_skipped',
            guardName: guard.name,
            reason: skipReason,
            timestamp: new Date(),
          };
          continue;
        }

        yield {
          type: 'guard_start',
          guardName: guard.name,
          guardIndex: i,
          timestamp: new Date(),
        };

        const result = await this.executeGuard(guard, context, results);
        results.push(result);
        this.state.results.push(result);
        this.state.executedGuards.push(guard.name);

        yield {
          type: 'guard_complete',
          guardName: guard.name,
          result,
          timestamp: new Date(),
        };

        // Check for early termination
        if (this.shouldTerminate(result)) {
          break;
        }
      }

      const pipelineResult = this.buildResult(results);
      this.state.status = pipelineResult.passed ? 'completed' : 'failed';

      yield {
        type: 'pipeline_complete',
        pipelineName: this.name,
        result: pipelineResult,
        timestamp: new Date(),
      };

      return pipelineResult;
    } catch (error) {
      this.state.status = 'failed';
      this.state.error =
        error instanceof Error ? error : new Error(String(error));

      yield {
        type: 'pipeline_error',
        pipelineName: this.name,
        error: this.state.error,
        guardName: this.state.currentGuard,
        timestamp: new Date(),
      };

      throw error;
    } finally {
      this.state.endTime = new Date();
      this.state.totalLatencyMs =
        this.state.endTime.getTime() - this.state.startTime.getTime();
    }
  }

  /**
   * Cancel the pipeline execution
   */
  cancel(): void {
    this.cancelled = true;
  }

  /**
   * Get current state
   */
  getState(): PipelineState {
    return { ...this.state };
  }

  /**
   * Add a guard to the pipeline
   */
  addGuard(guard: Guard, position?: number): void {
    if (position !== undefined) {
      this.guards.splice(position, 0, guard);
      this.config.guards.splice(position, 0, guard.name);
    } else {
      this.guards.push(guard);
      this.config.guards.push(guard.name);
    }
  }

  /**
   * Remove a guard from the pipeline
   */
  removeGuard(guardName: string): void {
    const index = this.guards.findIndex((g) => g.name === guardName);
    if (index !== -1) {
      this.guards.splice(index, 1);
      this.config.guards.splice(index, 1);
    }
  }

  /**
   * Execute guards sequentially
   */
  private async executeSequential(
    context: GuardContext,
  ): Promise<GuardResult[]> {
    const results: GuardResult[] = [];

    for (const guard of this.guards) {
      if (this.cancelled) {
        this.state.status = 'cancelled';
        break;
      }

      this.state.currentGuard = guard.name;

      // Check skip conditions
      const skipReason = this.shouldSkip(guard.name, results);
      if (skipReason) {
        this.state.skippedGuards.push(guard.name);
        continue;
      }

      const result = await this.executeGuard(guard, context, results);
      results.push(result);
      this.state.results.push(result);
      this.state.executedGuards.push(guard.name);

      // Check for early termination
      if (this.shouldTerminate(result)) {
        break;
      }
    }

    return results;
  }

  /**
   * Execute guards in parallel
   */
  private async executeParallel(context: GuardContext): Promise<GuardResult[]> {
    const promises = this.guards.map(async (guard) => {
      this.state.executedGuards.push(guard.name);
      return this.executeGuard(guard, context, []);
    });

    const results = await Promise.all(promises);
    this.state.results = results;
    return results;
  }

  /**
   * Execute a single guard with timeout
   */
  private async executeGuard(
    guard: Guard,
    context: GuardContext,
    previousResults: GuardResult[],
  ): Promise<GuardResult> {
    const contextWithResults: GuardContext = {
      ...context,
      previousResults,
    };

    if (this.config.timeoutMs) {
      return Promise.race([
        guard.check(contextWithResults),
        this.createTimeoutPromise(guard.name),
      ]);
    }

    return guard.check(contextWithResults);
  }

  /**
   * Create a timeout promise
   */
  private createTimeoutPromise(guardName: string): Promise<GuardResult> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            `Guard '${guardName}' timed out after ${this.config.timeoutMs}ms`,
          ),
        );
      }, this.config.timeoutMs);
    });
  }

  /**
   * Check if a guard should be skipped
   */
  private shouldSkip(guardName: string, results: GuardResult[]): string | null {
    if (!this.config.skipConditions) return null;

    for (const condition of this.config.skipConditions) {
      if (condition.guard !== guardName) continue;

      if (condition.ifPassed) {
        const passedResult = results.find(
          (r) => r.guardName === condition.ifPassed && r.passed,
        );
        if (passedResult) {
          return `Skipped because '${condition.ifPassed}' passed`;
        }
      }

      if (condition.ifFailed) {
        const failedResult = results.find(
          (r) => r.guardName === condition.ifFailed && !r.passed,
        );
        if (failedResult) {
          return `Skipped because '${condition.ifFailed}' failed`;
        }
      }

      if (condition.condition && condition.condition(results)) {
        return 'Skipped by custom condition';
      }
    }

    return null;
  }

  /**
   * Check if pipeline should terminate early
   */
  private shouldTerminate(result: GuardResult): boolean {
    if (this.config.failureMode === 'fail-fast' && !result.passed) {
      // Check if this guard is in continueOnFailure list
      if (this.config.continueOnFailure?.includes(result.guardName)) {
        return false;
      }
      return true;
    }
    return false;
  }

  /**
   * Build the final pipeline result
   */
  private buildResult(results: GuardResult[]): PipelineResult {
    const failedResults = results.filter((r) => !r.passed);
    const passed = failedResults.length === 0;

    // Determine final action
    let action: GuardAction = 'allow';
    if (!passed) {
      // Use the most restrictive action
      if (failedResults.some((r) => r.action === 'block')) {
        action = 'block';
      } else if (failedResults.some((r) => r.action === 'transform')) {
        action = 'transform';
      } else if (failedResults.some((r) => r.action === 'warn')) {
        action = 'warn';
      }
    }

    // Handle fail-safe mode
    if (this.config.failureMode === 'fail-safe' && action === 'block') {
      action = 'warn';
    }

    // Build transformed content if any transformations
    let transformedContent: string | undefined;
    const transformResults = results.filter((r) => r.transformedContent);
    if (transformResults.length > 0) {
      // Apply transformations in order
      transformedContent = transformResults.reduce(
        (content, r) => r.transformedContent ?? content,
        '',
      );
    }

    // Build message
    const messages = failedResults.map((r) => r.message).filter(Boolean);
    const message =
      messages.length > 0 ? messages.join('; ') : 'All checks passed';

    return {
      passed: passed || this.config.failureMode === 'fail-safe',
      action,
      state: this.getState(),
      results,
      message,
      transformedContent,
    };
  }

  /**
   * Create initial state
   */
  private createInitialState(): PipelineState {
    return {
      pipelineName: this.name,
      status: 'pending',
      results: [],
      executedGuards: [],
      skippedGuards: [],
      startTime: new Date(),
    };
  }

  /**
   * Reset state for new execution
   */
  private reset(): void {
    this.state = this.createInitialState();
    this.cancelled = false;
  }
}

/**
 * Pipeline builder for fluent API
 */
export class PipelineBuilder implements IPipelineBuilder {
  private config: Partial<PipelineConfig> = {
    guards: [],
    executionMode: 'sequential',
    failureMode: 'fail-fast',
  };

  name(name: string): PipelineBuilder {
    this.config.name = name;
    return this;
  }

  description(description: string): PipelineBuilder {
    this.config.description = description;
    return this;
  }

  addGuard(guardName: string): PipelineBuilder {
    this.config.guards = [...(this.config.guards ?? []), guardName];
    return this;
  }

  addGuards(guardNames: string[]): PipelineBuilder {
    this.config.guards = [...(this.config.guards ?? []), ...guardNames];
    return this;
  }

  executionMode(mode: ExecutionMode): PipelineBuilder {
    this.config.executionMode = mode;
    return this;
  }

  failureMode(mode: FailureMode): PipelineBuilder {
    this.config.failureMode = mode;
    return this;
  }

  timeout(ms: number): PipelineBuilder {
    this.config.timeoutMs = ms;
    return this;
  }

  skipIf(condition: SkipCondition): PipelineBuilder {
    this.config.skipConditions = [
      ...(this.config.skipConditions ?? []),
      condition,
    ];
    return this;
  }

  build(): Pipeline {
    if (!this.config.name) {
      throw new Error('Pipeline name is required');
    }
    if (!this.config.guards || this.config.guards.length === 0) {
      throw new Error('Pipeline must have at least one guard');
    }
    return new Pipeline(this.config as PipelineConfig);
  }
}

/**
 * Create a new pipeline builder
 */
export function createPipeline(): PipelineBuilder {
  return new PipelineBuilder();
}
