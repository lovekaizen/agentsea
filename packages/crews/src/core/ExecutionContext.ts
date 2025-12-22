/**
 * ExecutionContext Class
 *
 * Shared context management for crew execution with event emission.
 */

import EventEmitter from 'eventemitter3';
import { nanoid } from 'nanoid';
import type {
  CrewEvent,
  CrewEventHandler,
  EventSubscription,
  TaskResult,
  CrewStatus,
} from '../types';

/**
 * Configuration for ExecutionContext
 */
export interface ExecutionContextConfig {
  /** Crew name */
  crewName: string;
  /** Crew ID (auto-generated if not provided) */
  crewId?: string;
  /** Initial global context */
  globalContext?: Record<string, unknown>;
  /** Enable event buffering */
  bufferEvents?: boolean;
  /** Maximum buffer size */
  maxBufferSize?: number;
}

/**
 * Snapshot of context state for checkpointing
 */
export interface ContextCheckpoint {
  id: string;
  timestamp: Date;
  crewId: string;
  crewName: string;
  state: Map<string, unknown>;
  completedTasks: Map<string, TaskResult>;
  agentStates: Map<string, unknown>;
  variables: Record<string, unknown>;
}

/**
 * Execution context for crew operations
 */
export class ExecutionContext {
  readonly crewId: string;
  readonly crewName: string;

  private state: Map<string, unknown>;
  private completedTasks: Map<string, TaskResult>;
  private agentStates: Map<string, unknown>;
  private variables: Record<string, unknown>;
  private eventEmitter: EventEmitter;
  private eventBuffer: CrewEvent[];
  private bufferEvents: boolean;
  private maxBufferSize: number;
  private abortController: AbortController;
  private status: CrewStatus;
  private startTime?: Date;
  private endTime?: Date;

  constructor(config: ExecutionContextConfig) {
    this.crewId = config.crewId ?? nanoid();
    this.crewName = config.crewName;
    this.state = new Map();
    this.completedTasks = new Map();
    this.agentStates = new Map();
    this.variables = {};
    this.eventEmitter = new EventEmitter();
    this.eventBuffer = [];
    this.bufferEvents = config.bufferEvents ?? false;
    this.maxBufferSize = config.maxBufferSize ?? 1000;
    this.abortController = new AbortController();
    this.status = 'idle';

    // Set initial global context
    if (config.globalContext) {
      for (const [key, value] of Object.entries(config.globalContext)) {
        this.state.set(key, value);
      }
    }
  }

  // ============ State Management ============

  /**
   * Set a value in shared state
   */
  set(key: string, value: unknown): void {
    this.state.set(key, value);
  }

  /**
   * Get a value from shared state
   */
  get<T>(key: string): T | undefined {
    return this.state.get(key) as T | undefined;
  }

  /**
   * Check if a key exists in shared state
   */
  has(key: string): boolean {
    return this.state.has(key);
  }

  /**
   * Delete a key from shared state
   */
  delete(key: string): boolean {
    return this.state.delete(key);
  }

  /**
   * Get all state keys
   */
  keys(): string[] {
    return Array.from(this.state.keys());
  }

  /**
   * Get all state entries
   */
  entries(): Array<[string, unknown]> {
    return Array.from(this.state.entries());
  }

  /**
   * Clear all shared state
   */
  clearState(): void {
    this.state.clear();
  }

  // ============ Variables ============

  /**
   * Set a variable
   */
  setVariable(name: string, value: unknown): void {
    this.variables[name] = value;
  }

  /**
   * Get a variable
   */
  getVariable<T>(name: string): T | undefined {
    return this.variables[name] as T | undefined;
  }

  /**
   * Get all variables
   */
  getVariables(): Record<string, unknown> {
    return { ...this.variables };
  }

  // ============ Task Tracking ============

  /**
   * Mark a task as completed
   */
  markTaskCompleted(taskId: string, result: TaskResult): void {
    this.completedTasks.set(taskId, result);
  }

  /**
   * Check if a task is completed
   */
  isTaskCompleted(taskId: string): boolean {
    return this.completedTasks.has(taskId);
  }

  /**
   * Get a completed task result
   */
  getTaskResult(taskId: string): TaskResult | undefined {
    return this.completedTasks.get(taskId);
  }

  /**
   * Get all completed tasks
   */
  getCompletedTasks(): Map<string, TaskResult> {
    return new Map(this.completedTasks);
  }

  /**
   * Get completed task IDs
   */
  getCompletedTaskIds(): Set<string> {
    return new Set(this.completedTasks.keys());
  }

  /**
   * Get completed task count
   */
  getCompletedTaskCount(): number {
    return this.completedTasks.size;
  }

  // ============ Agent State ============

  /**
   * Set agent state
   */
  setAgentState(agentName: string, state: unknown): void {
    this.agentStates.set(agentName, state);
  }

  /**
   * Get agent state
   */
  getAgentState<T>(agentName: string): T | undefined {
    return this.agentStates.get(agentName) as T | undefined;
  }

  /**
   * Get all agent states
   */
  getAgentStates(): Map<string, unknown> {
    return new Map(this.agentStates);
  }

  // ============ Event System ============

  /**
   * Emit an event
   */
  emit(event: Omit<CrewEvent, 'crewName' | 'timestamp'>): void {
    const fullEvent = {
      ...event,
      crewName: this.crewName,
      timestamp: new Date(),
    } as CrewEvent;

    if (this.bufferEvents) {
      this.eventBuffer.push(fullEvent);
      if (this.eventBuffer.length > this.maxBufferSize) {
        this.eventBuffer.shift();
      }
    }

    this.eventEmitter.emit(event.type, fullEvent);
    this.eventEmitter.emit('*', fullEvent);
  }

  /**
   * Subscribe to events of a specific type
   */
  on<T extends CrewEvent>(
    type: T['type'] | '*',
    handler: CrewEventHandler<T>,
  ): EventSubscription {
    this.eventEmitter.on(type, handler as (...args: unknown[]) => void);
    return {
      unsubscribe: () =>
        this.eventEmitter.off(type, handler as (...args: unknown[]) => void),
    };
  }

  /**
   * Subscribe to events once
   */
  once<T extends CrewEvent>(
    type: T['type'],
    handler: CrewEventHandler<T>,
  ): EventSubscription {
    this.eventEmitter.once(type, handler as (...args: unknown[]) => void);
    return {
      unsubscribe: () =>
        this.eventEmitter.off(type, handler as (...args: unknown[]) => void),
    };
  }

  /**
   * Remove all listeners for a type
   */
  off(type: string): void {
    this.eventEmitter.removeAllListeners(type);
  }

  /**
   * Get buffered events
   */
  getEventBuffer(): CrewEvent[] {
    return [...this.eventBuffer];
  }

  /**
   * Clear event buffer
   */
  clearEventBuffer(): void {
    this.eventBuffer = [];
  }

  // ============ Lifecycle ============

  /**
   * Get abort signal
   */
  get signal(): AbortSignal {
    return this.abortController.signal;
  }

  /**
   * Check if execution is aborted
   */
  get isAborted(): boolean {
    return this.abortController.signal.aborted;
  }

  /**
   * Abort execution
   */
  abort(reason?: string): void {
    this.abortController.abort(reason);
    this.status = 'aborted';
    this.endTime = new Date();
  }

  /**
   * Get current status
   */
  getStatus(): CrewStatus {
    return this.status;
  }

  /**
   * Set status
   */
  setStatus(status: CrewStatus): void {
    this.status = status;
    if (status === 'running' && !this.startTime) {
      this.startTime = new Date();
    }
    if (status === 'completed' || status === 'failed' || status === 'aborted') {
      this.endTime = new Date();
    }
  }

  /**
   * Get execution duration in milliseconds
   */
  getDuration(): number | undefined {
    if (!this.startTime) return undefined;
    const end = this.endTime ?? new Date();
    return end.getTime() - this.startTime.getTime();
  }

  // ============ Checkpointing ============

  /**
   * Create a checkpoint of current state
   */
  createCheckpoint(): ContextCheckpoint {
    return {
      id: nanoid(),
      timestamp: new Date(),
      crewId: this.crewId,
      crewName: this.crewName,
      state: new Map(this.state),
      completedTasks: new Map(this.completedTasks),
      agentStates: new Map(this.agentStates),
      variables: { ...this.variables },
    };
  }

  /**
   * Restore from a checkpoint
   */
  restoreCheckpoint(checkpoint: ContextCheckpoint): void {
    this.state = new Map(checkpoint.state);
    this.completedTasks = new Map(checkpoint.completedTasks);
    this.agentStates = new Map(checkpoint.agentStates);
    this.variables = { ...checkpoint.variables };
  }

  /**
   * Export state for serialization
   */
  exportState(): Record<string, unknown> {
    return {
      crewId: this.crewId,
      crewName: this.crewName,
      status: this.status,
      state: Object.fromEntries(this.state),
      completedTasks: Object.fromEntries(
        Array.from(this.completedTasks.entries()),
      ),
      agentStates: Object.fromEntries(this.agentStates),
      variables: this.variables,
      startTime: this.startTime?.toISOString(),
      endTime: this.endTime?.toISOString(),
    };
  }

  /**
   * Import state from serialized data
   */
  importState(data: Record<string, unknown>): void {
    if (data.state && typeof data.state === 'object') {
      this.state = new Map(
        Object.entries(data.state as Record<string, unknown>),
      );
    }
    if (data.completedTasks && typeof data.completedTasks === 'object') {
      this.completedTasks = new Map(
        Object.entries(data.completedTasks as Record<string, TaskResult>),
      );
    }
    if (data.agentStates && typeof data.agentStates === 'object') {
      this.agentStates = new Map(
        Object.entries(data.agentStates as Record<string, unknown>),
      );
    }
    if (data.variables && typeof data.variables === 'object') {
      this.variables = data.variables as Record<string, unknown>;
    }
    if (data.status) {
      this.status = data.status as CrewStatus;
    }
    if (data.startTime) {
      this.startTime = new Date(data.startTime as string);
    }
    if (data.endTime) {
      this.endTime = new Date(data.endTime as string);
    }
  }

  // ============ Reset ============

  /**
   * Reset context for new execution
   */
  reset(): void {
    this.state.clear();
    this.completedTasks.clear();
    this.agentStates.clear();
    this.variables = {};
    this.eventBuffer = [];
    this.abortController = new AbortController();
    this.status = 'idle';
    this.startTime = undefined;
    this.endTime = undefined;
  }
}

/**
 * Factory function for creating execution contexts
 */
export function createExecutionContext(
  config: ExecutionContextConfig,
): ExecutionContext {
  return new ExecutionContext(config);
}

export default ExecutionContext;
