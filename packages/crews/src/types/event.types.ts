/**
 * Event Types
 *
 * Type definitions for crew events and real-time streaming.
 */

import type { TaskResult } from './task.types';
import type { CrewMetrics, DelegationStrategyType } from './crew.types';
import type { StepResult } from './workflow.types';

/**
 * All possible crew event types
 */
export type CrewEvent =
  // Crew lifecycle events
  | CrewStartedEvent
  | CrewCompletedEvent
  | CrewErrorEvent
  | CrewPausedEvent
  | CrewResumedEvent
  | CrewAbortedEvent
  // Task events
  | TaskQueuedEvent
  | TaskAssignedEvent
  | TaskStartedEvent
  | TaskProgressEvent
  | TaskCompletedEvent
  | TaskFailedEvent
  | TaskRetriedEvent
  // Agent events
  | AgentThinkingEvent
  | AgentToolUseEvent
  | AgentToolResultEvent
  | AgentResponseEvent
  | AgentErrorEvent
  // Delegation events
  | DelegationDecisionEvent
  | DelegationFailedEvent
  | DelegationRejectedEvent
  // Collaboration events
  | CollaborationMessageEvent
  | HelpRequestedEvent
  | HelpProvidedEvent
  | HelpRequestEvent
  | HelpResponseEvent
  | KnowledgeSharedEvent
  | KnowledgeContributedEvent
  // Conflict events
  | ConflictDetectedEvent
  | ConflictResolvedEvent
  | ConflictEscalatedEvent
  // Consensus events
  | ConsensusRequestedEvent
  | ConsensusReachedEvent
  | ConsensusVoteEvent
  // Auction events
  | AuctionStartedEvent
  // Workflow events
  | WorkflowStepStartedEvent
  | WorkflowStepCompletedEvent
  | WorkflowCheckpointEvent
  // Monitoring events
  | MetricsUpdateEvent
  | DebugBreakpointEvent;

/**
 * Base event interface
 */
export interface BaseEvent {
  /** Event type */
  type: string;
  /** Event timestamp */
  timestamp: Date;
  /** Crew name */
  crewName: string;
}

// ============ Crew Lifecycle Events ============

export interface CrewStartedEvent extends BaseEvent {
  type: 'crew:started';
  taskCount: number;
  agentCount: number;
  strategy: DelegationStrategyType;
}

export interface CrewCompletedEvent extends BaseEvent {
  type: 'crew:completed';
  success: boolean;
  results: TaskResult[];
  metrics: CrewMetrics;
  finalOutput?: string;
}

export interface CrewErrorEvent extends BaseEvent {
  type: 'crew:error';
  error: string;
  fatal: boolean;
  taskId?: string;
  agentName?: string;
}

export interface CrewPausedEvent extends BaseEvent {
  type: 'crew:paused';
  reason?: string;
  pendingTasks: number;
}

export interface CrewResumedEvent extends BaseEvent {
  type: 'crew:resumed';
  fromCheckpoint?: string;
}

export interface CrewAbortedEvent extends BaseEvent {
  type: 'crew:aborted';
  reason: string;
  completedTasks: number;
  pendingTasks: number;
}

// ============ Task Events ============

export interface TaskQueuedEvent extends BaseEvent {
  type: 'task:queued';
  taskId: string;
  description: string;
  priority: string;
  dependencies: string[];
}

export interface TaskAssignedEvent extends BaseEvent {
  type: 'task:assigned';
  taskId: string;
  agentName: string;
  reason: string;
  strategy: DelegationStrategyType;
}

export interface TaskStartedEvent extends BaseEvent {
  type: 'task:started';
  taskId: string;
  agentName: string;
}

export interface TaskProgressEvent extends BaseEvent {
  type: 'task:progress';
  taskId: string;
  agentName: string;
  progress: number; // 0-100
  message?: string;
}

export interface TaskCompletedEvent extends BaseEvent {
  type: 'task:completed';
  taskId: string;
  agentName: string;
  result: TaskResult;
  durationMs: number;
}

export interface TaskFailedEvent extends BaseEvent {
  type: 'task:failed';
  taskId: string;
  agentName: string;
  error: string;
  willRetry: boolean;
  attempt: number;
}

export interface TaskRetriedEvent extends BaseEvent {
  type: 'task:retried';
  taskId: string;
  agentName: string;
  attempt: number;
  maxAttempts: number;
  reason: string;
}

// ============ Agent Events ============

export interface AgentThinkingEvent extends BaseEvent {
  type: 'agent:thinking';
  agentName: string;
  taskId: string;
  thought: string;
  iteration: number;
}

export interface AgentToolUseEvent extends BaseEvent {
  type: 'agent:tool_use';
  agentName: string;
  taskId: string;
  toolName: string;
  toolInput: unknown;
}

export interface AgentToolResultEvent extends BaseEvent {
  type: 'agent:tool_result';
  agentName: string;
  taskId: string;
  toolName: string;
  result: unknown;
  durationMs: number;
}

export interface AgentResponseEvent extends BaseEvent {
  type: 'agent:response';
  agentName: string;
  taskId: string;
  response: string;
  tokensUsed: number;
}

export interface AgentErrorEvent extends BaseEvent {
  type: 'agent:error';
  agentName: string;
  taskId?: string;
  error: string;
  recoverable: boolean;
}

// ============ Delegation Events ============

export interface DelegationDecisionEvent extends BaseEvent {
  type: 'delegation:decision';
  taskId: string;
  fromAgent?: string;
  toAgent: string;
  strategy: DelegationStrategyType;
  reason: string;
  confidence: number;
  alternatives?: string[];
}

export interface DelegationFailedEvent extends BaseEvent {
  type: 'delegation:failed';
  taskId: string;
  reason: string;
  attemptedAgents: string[];
}

export interface DelegationRejectedEvent extends BaseEvent {
  type: 'delegation:rejected';
  taskId: string;
  agentName: string;
  reason: string;
}

// ============ Collaboration Events ============

export interface CollaborationMessageEvent extends BaseEvent {
  type: 'collaboration:message';
  fromAgent: string;
  toAgent: string;
  message: string;
  messageType: 'request' | 'response' | 'info' | 'question';
  taskId?: string;
}

export interface HelpRequestedEvent extends BaseEvent {
  type: 'collaboration:help_requested';
  fromAgent: string;
  taskId: string;
  request: string;
  targetAgents?: string[];
}

export interface HelpProvidedEvent extends BaseEvent {
  type: 'collaboration:help_provided';
  fromAgent: string;
  toAgent: string;
  taskId: string;
  response: string;
  helpful: boolean;
}

export interface KnowledgeSharedEvent extends BaseEvent {
  type: 'collaboration:knowledge_shared';
  fromAgent: string;
  topic: string;
  content: string;
  confidence: number;
}

// ============ Conflict Events ============

export interface ConflictDetectedEvent extends BaseEvent {
  type: 'conflict:detected';
  conflictId: string;
  conflictType: 'disagreement' | 'contradiction' | 'resource' | 'priority';
  agents: string[];
  taskId?: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ConflictResolvedEvent extends BaseEvent {
  type: 'conflict:resolved';
  conflictId: string;
  resolution: string;
  resolvedBy: 'voting' | 'manager' | 'merge' | 'escalation';
  accepted: boolean;
}

export interface ConflictEscalatedEvent extends BaseEvent {
  type: 'conflict:escalated';
  conflictId: string;
  reason: string;
  escalatedTo: string;
}

// ============ Collaboration Additional Events ============

export interface HelpRequestEvent extends BaseEvent {
  type: 'collaboration:help_request';
  from: string;
  taskId: string;
  request: string;
  targetAgents?: string[];
}

export interface HelpResponseEvent extends BaseEvent {
  type: 'collaboration:help_response';
  from: string;
  to: string;
  taskId: string;
  response: string;
  helpful: boolean;
}

export interface KnowledgeContributedEvent extends BaseEvent {
  type: 'collaboration:knowledge_contributed';
  contributor: string;
  topic: string;
  content: string;
}

// ============ Consensus Events ============

export interface ConsensusRequestedEvent extends BaseEvent {
  type: 'consensus:requested';
  taskId: string;
  topic: string;
  options: string[];
  requiredVotes: number;
}

export interface ConsensusReachedEvent extends BaseEvent {
  type: 'consensus:reached';
  taskId: string;
  decision: string;
  votes: Record<string, string>;
  unanimous: boolean;
}

export interface ConsensusVoteEvent extends BaseEvent {
  type: 'consensus:vote';
  taskId: string;
  voter: string;
  vote: string;
  reason?: string;
}

// ============ Auction Events ============

export interface AuctionStartedEvent extends BaseEvent {
  type: 'auction:started';
  taskId: string;
  description: string;
  participants: string[];
}

// ============ Workflow Events ============

export interface WorkflowStepStartedEvent extends BaseEvent {
  type: 'workflow:step_started';
  workflowId: string;
  stepName: string;
  agentName?: string;
}

export interface WorkflowStepCompletedEvent extends BaseEvent {
  type: 'workflow:step_completed';
  workflowId: string;
  stepName: string;
  result: StepResult;
  nextSteps: string[];
}

export interface WorkflowCheckpointEvent extends BaseEvent {
  type: 'workflow:checkpoint';
  workflowId: string;
  checkpointId: string;
  stepName: string;
  canResume: boolean;
}

// ============ Monitoring Events ============

export interface MetricsUpdateEvent extends BaseEvent {
  type: 'metrics:update';
  metrics: Partial<CrewMetrics>;
  interval: 'tick' | 'task' | 'minute';
}

export interface DebugBreakpointEvent extends BaseEvent {
  type: 'debug:breakpoint';
  breakpointType: 'step' | 'task' | 'agent' | 'error';
  agentName?: string;
  taskId?: string;
  stepName?: string;
  state: Record<string, unknown>;
}

/**
 * Event handler type
 */
export type CrewEventHandler<T extends CrewEvent = CrewEvent> = (
  event: T,
) => void | Promise<void>;

/**
 * Event subscription
 */
export interface EventSubscription {
  /** Unsubscribe from events */
  unsubscribe: () => void;
}

/**
 * Event filter options
 */
export interface EventFilterOptions {
  /** Event types to include */
  types?: string[];
  /** Agents to filter by */
  agents?: string[];
  /** Tasks to filter by */
  tasks?: string[];
  /** Minimum severity for conflict events */
  minSeverity?: 'low' | 'medium' | 'high';
}
