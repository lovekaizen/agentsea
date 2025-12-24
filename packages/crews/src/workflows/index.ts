/**
 * Workflows Module
 *
 * Workflow building, DAG execution, and checkpointing.
 */

// Workflow builder
export {
  WorkflowBuilder,
  BranchBuilder,
  LoopBuilder,
  workflow,
  type StepHandler,
  type ConditionFn,
} from './WorkflowBuilder';

// DAG executor
export {
  DAGExecutor,
  createDAGExecutor,
  createDAGFromSteps,
  type DAGExecutorConfig,
} from './DAGExecutor';

// Parallel execution
export {
  ParallelExecutor,
  createParallelExecutor,
  type ParallelExecutionOptions,
  type ParallelTaskResult,
  type BatchResult,
} from './ParallelExecution';

// Checkpointing
export {
  CheckpointManager,
  createCheckpointManager,
  InMemoryCheckpointStorage,
  type CheckpointManagerConfig,
  type CheckpointStorage,
  type CheckpointStatistics,
  type WorkflowState,
} from './Checkpointing';
