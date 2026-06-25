/**
 * Crew Types
 *
 * Type definitions for crew configuration and orchestration.
 */

import type { RoleConfig } from './role.types';
import type { TaskConfig, TaskResult, TaskState } from './task.types';
import type { CrewEvent } from './event.types';

/**
 * Delegation strategy types
 */
export type DelegationStrategyType =
  | 'round-robin'
  | 'best-match'
  | 'auction'
  | 'hierarchical'
  | 'consensus';

/**
 * Crew execution status
 */
export type CrewStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'aborted';

/**
 * Detailed crew status (returned by Crew.getStatus())
 */
export interface CrewStatusDetails {
  /** Current state */
  state: CrewStatus;
  /** Current iteration */
  currentIteration: number;
  /** Maximum iterations */
  maxIterations: number;
  /** Start time */
  startTime?: Date;
  /** End time */
  endTime?: Date;
  /** Pending tasks count */
  tasksPending: number;
  /** In-progress tasks count */
  tasksInProgress: number;
  /** Completed tasks count */
  tasksCompleted: number;
  /** Failed tasks count */
  tasksFailed: number;
  /** Busy agents count */
  agentsBusy: number;
  /** Available agents count */
  agentsAvailable: number;
}

/**
 * Configuration for a crew agent
 */
export interface CrewAgentConfig {
  /** Agent name */
  name: string;
  /** Role configuration */
  role: RoleConfig;
  /** Model to use (e.g., 'claude-sonnet-4-6') */
  model: string;
  /** Provider name (e.g., 'anthropic', 'openai') */
  provider: string;
  /** Tool names this agent can use */
  tools?: string[];
  /** Temperature for LLM calls */
  temperature?: number;
  /** Maximum tokens for responses */
  maxTokens?: number;
  /** Maximum iterations per task */
  maxIterations?: number;
  /** Whether agent can work in parallel */
  parallelCapable?: boolean;
}

/**
 * Configuration for the crew manager
 */
export interface ManagerConfig {
  /** Manager role configuration */
  role: RoleConfig;
  /** Model to use */
  model: string;
  /** Provider name */
  provider: string;
  /** Whether manager can delegate tasks */
  allowDelegation?: boolean;
  /** Whether manager reviews completed tasks */
  reviewsOutput?: boolean;
  /** Maximum tasks to delegate at once */
  maxDelegations?: number;
}

/**
 * Memory configuration for the crew
 */
export interface CrewMemoryConfig {
  /** Whether memory is shared across agents */
  shared?: boolean;
  /** Memory type */
  type: 'buffer' | 'summary' | 'vector' | 'hybrid';
  /** Maximum messages to retain */
  maxMessages?: number;
  /** Whether to persist conversation history */
  persistent?: boolean;
  /** Enable knowledge base */
  enableKnowledgeBase?: boolean;
}

/**
 * Main crew configuration
 */
export interface CrewConfig {
  /** Unique crew name */
  name: string;
  /** Description of the crew's purpose */
  description?: string;
  /** Agent configurations */
  agents: CrewAgentConfig[];
  /** Manager configuration (optional) */
  manager?: ManagerConfig;
  /** Delegation strategy to use */
  delegationStrategy: DelegationStrategyType;
  /** Memory configuration */
  memory?: CrewMemoryConfig;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Maximum iterations for the crew */
  maxIterations?: number;
  /** Whether agents share knowledge */
  shareKnowledge?: boolean;
  /** Enable collaboration between agents */
  enableCollaboration?: boolean;
  /** Enable conflict resolution */
  enableConflictResolution?: boolean;
  /** Timeout for entire crew execution (ms) */
  timeoutMs?: number;
  /** Maximum concurrent tasks */
  maxConcurrentTasks?: number;
  /** Custom context to pass to all agents */
  globalContext?: Record<string, unknown>;
  /**
   * Use deterministic mock execution for all agents instead of calling a real
   * LLM. Useful for tests and offline scaffolding. Defaults to false, in which
   * case agents execute against real `@lov3kaizen/agentsea-core` providers.
   */
  mock?: boolean;
  /**
   * Custom execute function applied to every agent in the crew. Takes
   * precedence over the default core-backed executor. Each call receives the
   * formatted task input and the agent's generated system prompt.
   */
  execute?: (
    input: string,
    systemPrompt: string,
  ) => Promise<{
    output: string;
    tokensUsed: number;
    latencyMs: number;
    iterations: number;
    toolCalls?: Array<{ tool: string; input: unknown; result: unknown }>;
  }>;
}

/**
 * Result of crew execution
 */
export interface CrewResult {
  /** Whether the crew completed successfully */
  success: boolean;
  /** Results from all tasks */
  taskResults: TaskResult[];
  /** Final synthesized output */
  finalOutput?: string;
  /** Execution metrics */
  metrics: CrewMetrics;
  /** Errors that occurred */
  errors?: Array<{
    taskId?: string;
    agentName?: string;
    error: string;
    timestamp: Date;
  }>;
  /** Timeline of events */
  timeline?: TimelineEntry[];
  /** Events emitted during execution */
  events?: CrewEvent[];
}

/**
 * Metrics for crew execution
 */
export interface CrewMetrics {
  /** Total tasks processed */
  totalTasks: number;
  /** Successfully completed tasks */
  completedTasks: number;
  /** Failed tasks */
  failedTasks: number;
  /** Total tokens used across all agents */
  totalTokens: number;
  /** Total execution time in milliseconds */
  totalExecutionTimeMs: number;
  /** Average task time in milliseconds */
  averageTaskTimeMs: number;
  /** Total iterations */
  totalIterations: number;
  /** Total estimated cost */
  totalCost?: number;
  /** Per-agent metrics */
  agentMetrics: Record<string, AgentMetrics>;
  /** Delegation statistics */
  delegationStats?: {
    totalDelegations: number;
    byStrategy: Record<DelegationStrategyType, number>;
    averageConfidence: number;
  };
  /** Start time */
  startedAt?: Date;
  /** End time */
  completedAt?: Date;
}

/**
 * Per-agent metrics
 */
export interface AgentMetrics {
  /** Tasks assigned to this agent */
  tasksAssigned: number;
  /** Tasks completed */
  tasksCompleted: number;
  /** Tasks failed */
  tasksFailed: number;
  /** Total tokens used */
  tokensUsed: number;
  /** Average latency in milliseconds */
  averageLatencyMs: number;
}

/**
 * Delegation statistics
 */
export interface DelegationStats {
  /** Total delegations made */
  totalDelegations: number;
  /** Successful delegations */
  successfulDelegations: number;
  /** Re-delegations due to failure */
  reDelegations: number;
  /** Average delegation decision time */
  avgDecisionTimeMs: number;
  /** Delegation by strategy */
  byStrategy: Record<DelegationStrategyType, number>;
}

/**
 * Timeline entry for crew execution
 */
export interface TimelineEntry {
  /** Timestamp */
  timestamp: Date;
  /** Event type */
  type?: string;
  /** Event name (alternative to type) */
  event?: string;
  /** Agent involved (if applicable) */
  agentName?: string;
  /** Entity ID (crew/task ID) */
  entityId?: string;
  /** Task involved (if applicable) */
  taskId?: string;
  /** Event description */
  description?: string;
  /** Additional data */
  data?: Record<string, unknown>;
}

/**
 * Checkpoint for crew state
 */
export interface CrewCheckpoint {
  /** Checkpoint ID */
  id: string;
  /** Crew ID */
  crewId?: string;
  /** Crew name */
  crewName?: string;
  /** Timestamp */
  timestamp: Date;
  /** Current crew status */
  status?: CrewStatus;
  /** Current state */
  state?: CrewStatus;
  /** Context state */
  context?: Record<string, unknown>;
  /** Task states */
  taskStates?: TaskState[];
  /** Task queue (serialized tasks) */
  taskQueue?: TaskConfig[];
  /** Results map */
  results?: Record<string, TaskResult>;
  /** Timeline entries */
  timeline?: TimelineEntry[];
  /** Current iteration */
  iteration?: number;
  /** Agent states */
  agentStates?: Record<string, unknown>;
  /** Shared memory state */
  sharedMemory?: Record<string, unknown>;
  /** Context state */
  contextState?: Record<string, unknown>;
  /** Metrics at checkpoint */
  metrics?: Partial<CrewMetrics>;
}

/**
 * Options for crew execution
 */
export interface CrewExecutionOptions {
  /** Initial input to the crew */
  input?: string;
  /** Override delegation strategy */
  strategy?: DelegationStrategyType;
  /** Timeout override */
  timeoutMs?: number;
  /** Whether to stream events */
  stream?: boolean;
  /** Checkpoint to resume from */
  resumeFrom?: string;
  /** Progress callback */
  onProgress?: (progress: CrewProgress) => void;
}

/**
 * Progress information during execution
 */
export interface CrewProgress {
  /** Percentage complete (0-100) */
  percentComplete?: number;
  /** Alternative percentage property */
  percentage?: number;
  /** Current phase */
  phase?:
    | 'initializing'
    | 'delegating'
    | 'executing'
    | 'reviewing'
    | 'completing';
  /** Tasks completed */
  tasksCompleted: number;
  /** Total tasks */
  totalTasks: number;
  /** Currently active agents */
  activeAgents?: string[];
  /** Current task being processed */
  currentTask?: string;
  /** Estimated remaining time in milliseconds */
  estimatedRemainingMs?: number;
}
