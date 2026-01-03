/**
 * @lov3kaizen/agentsea-crews
 *
 * Multi-agent orchestration framework for building AI agent teams.
 */

// Types
export * from './types';

// Core
export {
  // Role
  Role,
  createRole,

  // Task
  Task,
  createTask,

  // TaskQueue
  TaskQueue,
  createTaskQueue,
  type TaskQueueConfig,
  type TaskQueueStats,

  // ExecutionContext
  ExecutionContext,
  createExecutionContext,
  type ExecutionContextConfig,
  type ContextCheckpoint,

  // Crew
  Crew,
  createCrew,
  type CrewExecutionOptions,
} from './core';

// Agents
export {
  // CrewAgent
  CrewAgent,
  createCrewAgent,
  type CrewAgentOptions,
  type CrewAgentStats,
  type TaskBid,
  type HelpRequest,
  type HelpResponse,
  type AgentExecutionResult,

  // AgentCapabilities
  AgentCapabilities,
  type CapableAgent,

  // AgentRegistry
  AgentRegistry,
  createAgentRegistry,
  type AgentRegistryConfig,
  type RegisteredAgent,
} from './agents';

// Coordination
export {
  // Strategies
  type DelegationStrategy,
  type DelegationResult,
  type DelegationFailure,
  BaseDelegationStrategy,
  DelegationError,
  RoundRobinStrategy,
  BestMatchStrategy,
  AuctionStrategy,
  HierarchicalStrategy,
  ConsensusStrategy,
  createStrategy,
  createRoundRobinStrategy,
  createBestMatchStrategy,
  createAuctionStrategy,
  createHierarchicalStrategy,
  createConsensusStrategy,
  STRATEGY_TYPES,

  // Delegation Coordinator
  DelegationCoordinator,
  createDelegationCoordinator,
  type DelegationCoordinatorConfig,
  type DelegationHistoryEntry,

  // Collaboration
  CollaborationManager,
  createCollaborationManager,
  type CollaborationConfig,
  type CollaborationMessage,
  type CollaborationMessageType,
  type CollaborationChannel,
  type Knowledge,

  // Conflict Resolution
  ConflictResolver,
  createConflictResolver,
  type ConflictResolverConfig,
  type Conflict,
  type ConflictType,
  type Resolution,
  type ResolutionStrategy,
  type AgentResponse,
} from './coordination';

// Workflows
export {
  // WorkflowBuilder
  WorkflowBuilder,
  BranchBuilder,
  LoopBuilder,
  workflow,
  type StepHandler,
  type ConditionFn,

  // DAGExecutor
  DAGExecutor,
  createDAGExecutor,
  createDAGFromSteps,
  type DAGExecutorConfig,

  // Parallel Execution
  ParallelExecutor,
  createParallelExecutor,
  type ParallelExecutionOptions,
  type ParallelTaskResult,
  type BatchResult,

  // Checkpointing
  CheckpointManager,
  createCheckpointManager,
  InMemoryCheckpointStorage,
  type CheckpointManagerConfig,
  type CheckpointStorage,
  type CheckpointStatistics,
  type WorkflowState,
} from './workflows';

// Memory
export {
  // SharedMemory
  SharedMemory,
  createSharedMemory,
  type SharedMemoryConfig,
  type MemoryChangeEvent,
  type MemoryNamespace,

  // ConversationHistory
  ConversationHistory,
  createConversationHistory,
  type ConversationHistoryConfig,
  type ConversationMessage,
  type MultiAgentMessage,
  type ConversationThread,
  type MessageRole,

  // KnowledgeBase
  KnowledgeBase,
  createKnowledgeBase,
  type KnowledgeBaseConfig,
  type KnowledgeItem,
  type KnowledgeType,
  type KnowledgeQueryOptions,
} from './memory';

// Monitoring
export {
  // Dashboard
  CrewDashboard,
  createDashboard,
  type DashboardConfig,
  type DashboardUpdate,
  type DashboardSnapshot,
  type AgentStatus,

  // Debug Mode
  DebugMode,
  createDebugMode,
  type DebugModeConfig,
  type Breakpoint,
  type BreakpointType,
  type DebugContext,
  type AgentInspection,
  type StepResult,
} from './monitoring';

// Templates
export {
  // Research Crew
  createResearchCrew,
  createResearchCrewConfig,
  ResearchTasks,
  type ResearchCrewOptions,

  // Writing Crew
  createWritingCrew,
  createWritingCrewConfig,
  WritingTasks,
  type WritingCrewOptions,

  // Code Review Crew
  createCodeReviewCrew,
  createCodeReviewCrewConfig,
  CodeReviewTasks,
  type CodeReviewCrewOptions,

  // Customer Support Crew
  createCustomerSupportCrew,
  createCustomerSupportCrewConfig,
  CustomerSupportTasks,
  type CustomerSupportCrewOptions,
} from './templates';
