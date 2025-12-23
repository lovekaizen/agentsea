/**
 * Task Types
 *
 * Type definitions for task management and lifecycle.
 */

/**
 * Priority level for tasks
 */
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Status of a task in its lifecycle
 */
export type TaskStatus =
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'blocked'
  | 'cancelled';

/**
 * Configuration for creating a Task
 */
export interface TaskConfig {
  /** Unique identifier (auto-generated if not provided) */
  id?: string;
  /** Description of what the task should accomplish */
  description: string;
  /** Expected output format or content */
  expectedOutput: string;
  /** Task priority */
  priority?: TaskPriority;
  /** Task IDs that must complete before this task */
  dependencies?: string[];
  /** Deadline for task completion */
  deadline?: Date;
  /** Additional context for the task */
  context?: Record<string, unknown>;
  /** Specific agent to assign (optional) */
  assignTo?: string;
  /** Required capabilities for this task */
  requiredCapabilities?: string[];
  /** Estimated tokens needed */
  estimatedTokens?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Timeout in milliseconds */
  timeoutMs?: number;
  /** Tags for categorization */
  tags?: string[];
}

/**
 * Result of a completed task
 */
export interface TaskResult {
  /** The output produced by the task */
  output: string;
  /** Parsed/structured output if applicable */
  structuredOutput?: unknown;
  /** Quality score (0-1) */
  quality?: number;
  /** When the task was completed */
  completedAt: Date;
  /** Number of iterations taken */
  iterations: number;
  /** Total tokens used */
  tokensUsed: number;
  /** Latency in milliseconds */
  latencyMs?: number;
  /** Cost in USD */
  cost?: number;
  /** Agent that completed the task */
  completedBy: string;
  /** Error message if task failed */
  error?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Metadata about a task's lifecycle
 */
export interface TaskMetadata {
  /** When the task was created */
  createdAt: Date;
  /** When the task was last updated */
  updatedAt: Date;
  /** Number of assignment attempts */
  attempts: number;
  /** When the task was assigned */
  assignedAt?: Date;
  /** When execution started */
  startedAt?: Date;
  /** Estimated duration in milliseconds */
  estimatedDuration?: number;
  /** Actual duration in milliseconds */
  actualDuration?: number;
  /** History of status changes */
  statusHistory?: Array<{
    status: TaskStatus;
    timestamp: Date;
    reason?: string;
  }>;
}

/**
 * Full task state
 */
export interface TaskState {
  /** Task configuration */
  config: TaskConfig;
  /** Current status */
  status: TaskStatus;
  /** Assigned agent name */
  assignedAgent?: string;
  /** Task result (if completed or failed) */
  result?: TaskResult;
  /** Task metadata */
  metadata: TaskMetadata;
}

/**
 * Priority weights for queue ordering
 */
export const PRIORITY_WEIGHTS: Record<TaskPriority, number> = {
  critical: 100,
  high: 75,
  medium: 50,
  low: 25,
};
