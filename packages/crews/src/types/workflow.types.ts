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
  /** Step type */
  type?:
    | 'step'
    | 'conditional'
    | 'loop'
    | 'parallel'
    | 'task'
    | 'crew'
    | 'checkpoint';
  /** Step description */
  description?: string;
  /** Agent to execute this step */
  agent?: string;
  /** Agent name (alternative) */
  agentName?: string;
  /** Task configuration for this step */
  task?: TaskConfig;
  /** Task config (alternative) */
  taskConfig?: TaskConfig;
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
  /** Step name */
  name?: string;
  /** Step type */
  type?: string;
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
  /** Step name */
  name?: string;
  /** Step type */
  type?: string;
  /** Condition to evaluate */
  condition: ConditionFn;
  /** Step to execute if true */
  ifTrue?: WorkflowStepConfig;
  /** Step to execute if false */
  ifFalse?: WorkflowStepConfig;
  /** Steps to execute if condition is true (alternative) */
  thenSteps?: WorkflowStepConfig[];
  /** Steps to execute if condition is false (alternative) */
  elseSteps?: WorkflowStepConfig[];
}

/**
 * Loop step configuration
 */
export interface LoopStepConfig {
  /** Step name */
  name?: string;
  /** Step type */
  type?: string;
  /** Condition to continue looping */
  condition: ConditionFn;
  /** Step to execute in loop */
  body?: WorkflowStepConfig;
  /** Steps to execute in loop (alternative) */
  bodySteps?: WorkflowStepConfig[];
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
  workflowId?: string;
  /** Current step name */
  currentStep?: string;
  /** Step name (alternative) */
  stepName?: string;
  /** Results from previous steps */
  results?: Map<string, StepResult>;
  /** Step results (alternative) */
  stepResults?: Map<string, StepResult>;
  /** Shared state */
  state?: Map<string, unknown>;
  /** Variables */
  variables: Record<string, unknown> | Map<string, unknown>;
  /** Input to the workflow */
  input?: string;
  /** Crew reference */
  crew?: unknown;
  /** Abort signal */
  signal?: AbortSignal;
  /** Set variable function */
  setVariable?: (key: string, value: unknown) => void;
  /** Get variable function */
  getVariable?: (key: string) => unknown;
  /** Emit event function */
  emit?: (event: Record<string, unknown>) => void;
  /** Check if aborted */
  isAborted?: () => boolean;
}

/**
 * Workflow definition
 */
export interface WorkflowDefinition {
  /** Workflow ID */
  id?: string;
  /** Workflow name */
  name: string;
  /** Description */
  description?: string;
  /** Workflow version */
  version?: string;
  /** Steps in the workflow */
  steps: WorkflowStep[] | WorkflowStepConfig[];
  /** Entry point step */
  entryPoint?: string;
  /** Timeout for entire workflow */
  timeoutMs?: number;
  /** Checkpoint configuration */
  checkpointing?: CheckpointConfig;
  /** Step handlers map */
  handlers?: Map<string, StepHandler>;
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
  /** Checkpoint interval */
  interval?: number | 'after-step';
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
  workflowName?: string;
  /** Timestamp */
  timestamp: Date;
  /** Last completed step */
  lastCompletedStep?: string;
  /** Step index */
  stepIndex?: number;
  /** Step results so far */
  stepResults: Map<string, StepResult> | Record<string, StepResult>;
  /** Workflow state */
  state?: Map<string, unknown>;
  /** Variables */
  variables: Record<string, unknown>;
  /** Input */
  input?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * DAG node representation
 */
export interface DAGNode {
  /** Node ID */
  id: string;
  /** Node name */
  name?: string;
  /** Step associated with this node */
  step?: WorkflowStep;
  /** Step config (alternative) */
  stepConfig?: WorkflowStepConfig;
  /** Dependencies (node IDs) */
  dependencies?: string[];
  /** Incoming edges (node IDs) */
  incomingEdges?: string[];
  /** Outgoing edges (node IDs) */
  outgoingEdges?: string[];
  /** Execution state */
  state?: 'pending' | 'ready' | 'running' | 'completed' | 'failed' | 'skipped';
  /** Result if completed */
  result?: StepResult;
}

/**
 * DAG structure
 */
export interface DAG {
  /** DAG ID */
  id?: string;
  /** All nodes */
  nodes: DAGNode[];
  /** Entry node ID */
  entryNode?: string;
  /** Exit node IDs */
  exitNodes?: string[];
  /** Whether the DAG is valid (acyclic) */
  isValid?: boolean;
  /** Edges (optional) */
  edges?: Array<{ from: string; to: string }>;
}

/**
 * DAG execution result
 */
export interface DAGResult {
  /** Whether execution succeeded */
  success: boolean;
  /** All step results */
  stepResults?: Map<string, StepResult>;
  /** Results map (alternative) */
  results?: Map<string, StepResult>;
  /** Events during execution */
  events?: DAGEvent[];
  /** Final output */
  output?: unknown;
  /** Execution order */
  executionOrder?: string[];
  /** Total duration */
  totalDurationMs?: number;
  /** Execution time (alternative) */
  executionTimeMs?: number;
  /** Errors */
  errors?: Array<{ stepId: string; error: string }>;
  /** Failed node IDs */
  failedNodes?: string[];
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
    | 'dag:completed'
    | 'dag:start'
    | 'dag:aborted'
    | 'dag:error'
    | 'dag:complete'
    | 'node:start'
    | 'node:complete'
    | 'node:error'
    | 'node:retry'
    | 'node:skipped';
  /** DAG ID */
  dagId?: string;
  /** Step ID */
  stepId?: string;
  /** Node ID */
  nodeId?: string;
  /** Node name */
  nodeName?: string;
  /** Timestamp */
  timestamp: Date;
  /** Step result */
  result?: StepResult;
  /** Error */
  error?: string;
  /** Retry attempt number */
  attempt?: number;
  /** Skip reason */
  reason?: string;
  /** Success flag for dag:complete */
  success?: boolean;
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
