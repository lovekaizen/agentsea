/**
 * Pipeline Types
 *
 * Type definitions for the guardrails pipeline system.
 */

import { z } from 'zod';

import type {
  Guard,
  GuardResult,
  GuardContext,
  GuardAction,
} from './guard.types';
import type { ExecutionMode, FailureMode } from './config.types';

/**
 * Pipeline configuration
 */
export interface PipelineConfig {
  /** Pipeline name */
  name: string;
  /** Description */
  description?: string;
  /** Guard names in execution order */
  guards: string[];
  /** Execution mode */
  executionMode: ExecutionMode;
  /** Failure mode */
  failureMode: FailureMode;
  /** Continue on specific guard failures */
  continueOnFailure?: string[];
  /** Skip guards based on previous results */
  skipConditions?: SkipCondition[];
  /** Timeout for entire pipeline in ms */
  timeoutMs?: number;
}

/**
 * Condition to skip a guard
 */
export interface SkipCondition {
  /** Guard to potentially skip */
  guard: string;
  /** Skip if this guard already passed */
  ifPassed?: string;
  /** Skip if this guard already failed */
  ifFailed?: string;
  /** Custom condition function */
  condition?: (results: GuardResult[]) => boolean;
}

/**
 * Pipeline execution state
 */
export interface PipelineState {
  /** Pipeline name */
  pipelineName: string;
  /** Current status */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  /** Guard results collected so far */
  results: GuardResult[];
  /** Guards that have been executed */
  executedGuards: string[];
  /** Guards that were skipped */
  skippedGuards: string[];
  /** Current guard being executed */
  currentGuard?: string;
  /** Start time */
  startTime: Date;
  /** End time */
  endTime?: Date;
  /** Total execution time in ms */
  totalLatencyMs?: number;
  /** Error if failed */
  error?: Error;
}

/**
 * Result of pipeline execution
 */
export interface PipelineResult {
  /** Overall passed status */
  passed: boolean;
  /** Final action to take */
  action: GuardAction;
  /** Pipeline state */
  state: PipelineState;
  /** All guard results */
  results: GuardResult[];
  /** Summary message */
  message?: string;
  /** Transformed content (if any transformations applied) */
  transformedContent?: string;
}

/**
 * Pipeline interface
 */
export interface Pipeline {
  /** Pipeline name */
  readonly name: string;
  /** Pipeline configuration */
  readonly config: PipelineConfig;

  /**
   * Execute the pipeline
   */
  execute(context: GuardContext): Promise<PipelineResult>;

  /**
   * Execute with streaming results
   */
  executeStream(
    context: GuardContext,
  ): AsyncGenerator<PipelineEvent, PipelineResult>;

  /**
   * Cancel the pipeline execution
   */
  cancel(): void;

  /**
   * Get current state
   */
  getState(): PipelineState;

  /**
   * Add a guard to the pipeline
   */
  addGuard(guard: Guard, position?: number): void;

  /**
   * Remove a guard from the pipeline
   */
  removeGuard(guardName: string): void;
}

/**
 * Pipeline events for streaming
 */
export type PipelineEvent =
  | PipelineStartEvent
  | GuardStartEvent
  | GuardCompleteEvent
  | GuardSkippedEvent
  | PipelineCompleteEvent
  | PipelineErrorEvent;

export interface PipelineStartEvent {
  type: 'pipeline_start';
  pipelineName: string;
  guardCount: number;
  timestamp: Date;
}

export interface GuardStartEvent {
  type: 'guard_start';
  guardName: string;
  guardIndex: number;
  timestamp: Date;
}

export interface GuardCompleteEvent {
  type: 'guard_complete';
  guardName: string;
  result: GuardResult;
  timestamp: Date;
}

export interface GuardSkippedEvent {
  type: 'guard_skipped';
  guardName: string;
  reason: string;
  timestamp: Date;
}

export interface PipelineCompleteEvent {
  type: 'pipeline_complete';
  pipelineName: string;
  result: PipelineResult;
  timestamp: Date;
}

export interface PipelineErrorEvent {
  type: 'pipeline_error';
  pipelineName: string;
  error: Error;
  guardName?: string;
  timestamp: Date;
}

/**
 * Pipeline builder for fluent API
 */
export interface PipelineBuilder {
  /** Set pipeline name */
  name(name: string): PipelineBuilder;
  /** Set description */
  description(description: string): PipelineBuilder;
  /** Add a guard */
  addGuard(guardName: string): PipelineBuilder;
  /** Add multiple guards */
  addGuards(guardNames: string[]): PipelineBuilder;
  /** Set execution mode */
  executionMode(mode: ExecutionMode): PipelineBuilder;
  /** Set failure mode */
  failureMode(mode: FailureMode): PipelineBuilder;
  /** Set timeout */
  timeout(ms: number): PipelineBuilder;
  /** Add skip condition */
  skipIf(condition: SkipCondition): PipelineBuilder;
  /** Build the pipeline */
  build(): Pipeline;
}

/**
 * Zod schemas for validation
 */
export const SkipConditionSchema = z.object({
  guard: z.string(),
  ifPassed: z.string().optional(),
  ifFailed: z.string().optional(),
  condition: z.function().optional(),
});

export const PipelineConfigSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  guards: z.array(z.string()),
  executionMode: z.enum(['sequential', 'parallel']),
  failureMode: z.enum(['fail-fast', 'collect-all', 'fail-safe']),
  continueOnFailure: z.array(z.string()).optional(),
  skipConditions: z.array(SkipConditionSchema).optional(),
  timeoutMs: z.number().positive().optional(),
});

export const PipelineStateSchema = z.object({
  pipelineName: z.string(),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']),
  results: z.array(z.unknown()),
  executedGuards: z.array(z.string()),
  skippedGuards: z.array(z.string()),
  currentGuard: z.string().optional(),
  startTime: z.date(),
  endTime: z.date().optional(),
  totalLatencyMs: z.number().optional(),
  error: z.unknown().optional(),
});
