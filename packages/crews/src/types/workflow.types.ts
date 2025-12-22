/**
 * Workflow Types
 *
 * Type definitions for workflow building and execution.
 */

import type { TaskConfig } from './task.types';

/**
 * Step execution mode
 */
export type StepMode = 'sequential' | 'parallel' | 'conditional' | 'loop';

/**
 * Workflow step handler function
 */
export type StepHandler = (context: WorkflowContext) => Promise<StepResult>;

/**
 * Condition function for branching
 */
export type ConditionFn = (
  context: WorkflowContext,
) => boolean | Promise<boolean>;

/**
 * Configuration for a workflow step
 */
export interface WorkflowStepConfig {
  /** Unique step name */
  name: string;
  /** Step description */
  description?: string;
  /** Agent to execute this step */
  agent?: string;
  /** Task configuration for this step */
  task?: TaskConfig;
  /** Step handler function */
  handler?: StepHandler;
  /** Steps this depends on */
  dependsOn?: string[];
  /** Timeout for this step */
  timeoutMs?: number;
  /** Retry configuration */
  retry?: RetryConfig;
  /** Whether to checkpoint after this step */
  checkpoint?: boolean;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum retry attempts */
  maxAttempts: number;
  /** Delay between retries (ms) */
  delayMs?: number;
  /** Backoff multiplier */
  backoffMultiplier?: number;
  /** Maximum delay (ms) */
  maxDelayMs?: number;
  /** Retry on specific errors only */
  retryOn?: string[];
}

/**
 * Parallel step configuration
 */
export interface ParallelStepConfig {
  /** Steps to run in parallel */
  steps: WorkflowStepConfig[];
  /** Wait for all to complete or just one */
  waitFor: 'all' | 'any' | 'first-success';
  /** Maximum concurrent executions */
  maxConcurrent?: number;
}

/**
 * Conditional step configuration
 */
export interface ConditionalStepConfig {
  /** Condition to evaluate */
  condition: ConditionFn;
  /** Step to execute if true */
  ifTrue: WorkflowStepConfig;
  /** Step to execute if false */
  ifFalse?: WorkflowStepConfig;
}

/**
 * Loop step configuration
 */
export interface LoopStepConfig {
  /** Condition to continue looping */
  condition: ConditionFn;
  /** Step to execute in loop */
  body: WorkflowStepConfig;
  /** Maximum iterations */
  maxIterations?: number;
}

/**
 * Result of a step execution
 */
export interface StepResult {
  /** Step name */
  stepName: string;
  /** Whether step succeeded */
  success: boolean;
  /** Step output */
  output?: unknown;
  /** Error if failed */
  error?: string;
  /** Duration in milliseconds */
  durationMs: number;
  /** Tokens used */
  tokensUsed?: number;
  /** Agent that executed */
  executedBy?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Workflow context passed to handlers
 */
export interface WorkflowContext {
  /** Workflow ID */
  workflowId: string;
  /** Current step name */
  currentStep: string;
  /** Results from previous steps */
  results: Map<string, StepResult>;
  /** Shared state */
  state: Map<string, unknown>;
  /** Variables */
  variables: Record<string, unknown>;
  /** Input to the workflow */
  input?: string;
  /** Crew reference */
  crew?: unknown;
  /** Abort signal */
  signal?: AbortSignal;
}

/**
 * Workflow definition
 */
export interface WorkflowDefinition {
  /** Workflow name */
  name: string;
  /** Description */
  description?: string;
  /** Workflow version */
  version?: string;
  /** Steps in the workflow */
  steps: WorkflowStep[];
  /** Entry point step */
  entryPoint: string;
  /** Timeout for entire workflow */
  timeoutMs?: number;
  /** Checkpoint configuration */
  checkpointing?: CheckpointConfig;
}

/**
 * Workflow step (compiled from config)
 */
export interface WorkflowStep {
  /** Step ID */
  id: string;
  /** Step name */
  name: string;
  /** Step type */
  type: StepMode;
  /** Step configuration */
  config:
    | WorkflowStepConfig
    | ParallelStepConfig
    | ConditionalStepConfig
    | LoopStepConfig;
  /** Dependencies (step IDs) */
  dependencies: string[];
  /** Outgoing edges (step IDs) */
  nextSteps: string[];
}

/**
 * Checkpoint configuration
 */
export interface CheckpointConfig {
  /** Enable checkpointing */
  enabled: boolean;
  /** Checkpoint after every step */
  afterEveryStep?: boolean;
  /** Checkpoint at specific steps */
  atSteps?: string[];
  /** Storage backend */
  storage?: 'memory' | 'file' | 'redis';
  /** TTL for checkpoints (ms) */
  ttlMs?: number;
}

/**
 * Workflow checkpoint
 */
export interface WorkflowCheckpoint {
  /** Checkpoint ID */
  id: string;
  /** Workflow ID */
  workflowId: string;
  /** Workflow name */
  workflowName: string;
  /** Timestamp */
  timestamp: Date;
  /** Last completed step */
  lastCompletedStep: string;
  /** Step results so far */
  stepResults: Map<string, StepResult>;
  /** Workflow state */
  state: Map<string, unknown>;
  /** Variables */
  variables: Record<string, unknown>;
  /** Input */
  input?: string;
}

/**
 * DAG node representation
 */
export interface DAGNode {
  /** Node ID */
  id: string;
  /** Step associated with this node */
  step: WorkflowStep;
  /** Incoming edges (node IDs) */
  incomingEdges: string[];
  /** Outgoing edges (node IDs) */
  outgoingEdges: string[];
  /** Execution state */
  state: 'pending' | 'ready' | 'running' | 'completed' | 'failed' | 'skipped';
  /** Result if completed */
  result?: StepResult;
}

/**
 * DAG structure
 */
export interface DAG {
  /** All nodes */
  nodes: Map<string, DAGNode>;
  /** Entry node ID */
  entryNode: string;
  /** Exit node IDs */
  exitNodes: string[];
  /** Whether the DAG is valid (acyclic) */
  isValid: boolean;
}

/**
 * DAG execution result
 */
export interface DAGResult {
  /** Whether execution succeeded */
  success: boolean;
  /** All step results */
  stepResults: Map<string, StepResult>;
  /** Final output */
  output?: unknown;
  /** Execution order */
  executionOrder: string[];
  /** Total duration */
  totalDurationMs: number;
  /** Errors */
  errors?: Array<{ stepId: string; error: string }>;
}

/**
 * DAG event during execution
 */
export interface DAGEvent {
  /** Event type */
  type:
    | 'step:started'
    | 'step:completed'
    | 'step:failed'
    | 'step:skipped'
    | 'dag:completed';
  /** Step ID */
  stepId?: string;
  /** Timestamp */
  timestamp: Date;
  /** Step result */
  result?: StepResult;
  /** Error */
  error?: string;
}

/**
 * Validation result for workflow
 */
export interface ValidationResult {
  /** Whether the workflow is valid */
  valid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
}
