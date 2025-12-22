/**
 * Task Class
 *
 * Represents a task with lifecycle management and state tracking.
 */

import { nanoid } from 'nanoid';
import type {
  TaskConfig,
  TaskStatus,
  TaskPriority,
  TaskResult,
  TaskMetadata,
  TaskState,
} from '../types';

/**
 * Task class for managing task lifecycle
 */
export class Task {
  readonly id: string;
  readonly description: string;
  readonly expectedOutput: string;
  readonly priority: TaskPriority;
  readonly dependencies: string[];
  readonly deadline?: Date;
  readonly context: Record<string, unknown>;
  readonly assignTo?: string;
  readonly requiredCapabilities: string[];
  readonly estimatedTokens?: number;
  readonly maxRetries: number;
  readonly timeoutMs?: number;
  readonly tags: string[];

  private _status: TaskStatus;
  private _assignedAgent?: string;
  private _result?: TaskResult;
  private _metadata: TaskMetadata;

  constructor(config: TaskConfig) {
    this.id = config.id ?? nanoid();
    this.description = config.description;
    this.expectedOutput = config.expectedOutput;
    this.priority = config.priority ?? 'medium';
    this.dependencies = config.dependencies ?? [];
    this.deadline = config.deadline;
    this.context = config.context ?? {};
    this.assignTo = config.assignTo;
    this.requiredCapabilities = config.requiredCapabilities ?? [];
    this.estimatedTokens = config.estimatedTokens;
    this.maxRetries = config.maxRetries ?? 3;
    this.timeoutMs = config.timeoutMs;
    this.tags = config.tags ?? [];

    this._status = 'pending';
    this._assignedAgent = undefined;
    this._result = undefined;
    this._metadata = {
      createdAt: new Date(),
      updatedAt: new Date(),
      attempts: 0,
      statusHistory: [{ status: 'pending', timestamp: new Date() }],
    };
  }

  // ============ Getters ============

  get status(): TaskStatus {
    return this._status;
  }

  get assignedAgent(): string | undefined {
    return this._assignedAgent;
  }

  get result(): TaskResult | undefined {
    return this._result;
  }

  get metadata(): TaskMetadata {
    return { ...this._metadata };
  }

  get isCompleted(): boolean {
    return this._status === 'completed';
  }

  get isFailed(): boolean {
    return this._status === 'failed';
  }

  get isPending(): boolean {
    return this._status === 'pending';
  }

  get isBlocked(): boolean {
    return this._status === 'blocked';
  }

  get isInProgress(): boolean {
    return this._status === 'in_progress';
  }

  get isAssigned(): boolean {
    return this._status === 'assigned';
  }

  get attempts(): number {
    return this._metadata.attempts;
  }

  // ============ Lifecycle Methods ============

  /**
   * Assign the task to an agent
   */
  assign(agentName: string): void {
    if (this._status !== 'pending' && this._status !== 'blocked') {
      throw new Error(`Cannot assign task in status: ${this._status}`);
    }

    this._assignedAgent = agentName;
    this.updateStatus('assigned');
    this._metadata.assignedAt = new Date();
    this._metadata.attempts++;
  }

  /**
   * Start task execution
   */
  start(): void {
    if (this._status !== 'assigned') {
      throw new Error(`Cannot start task in status: ${this._status}`);
    }

    this.updateStatus('in_progress');
    this._metadata.startedAt = new Date();
  }

  /**
   * Complete the task with a result
   */
  complete(result: Omit<TaskResult, 'completedAt' | 'completedBy'>): void {
    if (this._status !== 'in_progress') {
      throw new Error(`Cannot complete task in status: ${this._status}`);
    }

    this._result = {
      ...result,
      completedAt: new Date(),
      completedBy: this._assignedAgent!,
    };

    this._metadata.actualDuration = this._metadata.startedAt
      ? Date.now() - this._metadata.startedAt.getTime()
      : undefined;

    this.updateStatus('completed');
  }

  /**
   * Mark the task as failed
   */
  fail(error: string): void {
    if (this._status !== 'in_progress' && this._status !== 'assigned') {
      throw new Error(`Cannot fail task in status: ${this._status}`);
    }

    this._result = {
      output: '',
      completedAt: new Date(),
      completedBy: this._assignedAgent || 'unknown',
      iterations: 0,
      tokensUsed: 0,
      error,
    };

    this.updateStatus('failed');
  }

  /**
   * Block the task (e.g., due to unmet dependencies)
   */
  block(reason?: string): void {
    this.updateStatus('blocked', reason);
  }

  /**
   * Unblock the task
   */
  unblock(): void {
    if (this._status !== 'blocked') {
      throw new Error(`Cannot unblock task in status: ${this._status}`);
    }
    this.updateStatus('pending');
  }

  /**
   * Cancel the task
   */
  cancel(reason?: string): void {
    if (this._status === 'completed') {
      throw new Error('Cannot cancel completed task');
    }
    this.updateStatus('cancelled', reason);
  }

  /**
   * Reset the task for retry
   */
  reset(): void {
    if (this._status !== 'failed') {
      throw new Error('Can only reset failed tasks');
    }

    this._status = 'pending';
    this._assignedAgent = undefined;
    this._result = undefined;
    this._metadata.statusHistory?.push({
      status: 'pending',
      timestamp: new Date(),
      reason: 'reset for retry',
    });
    this._metadata.updatedAt = new Date();
  }

  // ============ Query Methods ============

  /**
   * Check if the task can start (dependencies satisfied)
   */
  canStart(completedTaskIds: Set<string> = new Set()): boolean {
    if (this._status !== 'pending' && this._status !== 'blocked') {
      return false;
    }

    // Check if all dependencies are completed
    for (const depId of this.dependencies) {
      if (!completedTaskIds.has(depId)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if all dependencies are satisfied
   */
  dependenciesSatisfied(completedTaskIds: Set<string>): boolean {
    for (const depId of this.dependencies) {
      if (!completedTaskIds.has(depId)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if task can be retried
   */
  canRetry(): boolean {
    return (
      this._status === 'failed' && this._metadata.attempts < this.maxRetries
    );
  }

  /**
   * Check if task is past deadline
   */
  isPastDeadline(): boolean {
    if (!this.deadline) return false;
    return new Date() > this.deadline;
  }

  /**
   * Get time remaining until deadline (ms)
   */
  getTimeRemaining(): number | null {
    if (!this.deadline) return null;
    return Math.max(0, this.deadline.getTime() - Date.now());
  }

  /**
   * Get priority weight for queue ordering
   */
  getPriorityWeight(): number {
    const weights: Record<TaskPriority, number> = {
      critical: 100,
      high: 75,
      medium: 50,
      low: 25,
    };
    return weights[this.priority];
  }

  /**
   * Compare to another task for priority ordering
   */
  compareTo(other: Task): number {
    // Higher priority first
    const priorityDiff = other.getPriorityWeight() - this.getPriorityWeight();
    if (priorityDiff !== 0) return priorityDiff;

    // Earlier deadline first
    if (this.deadline && other.deadline) {
      return this.deadline.getTime() - other.deadline.getTime();
    }
    if (this.deadline) return -1;
    if (other.deadline) return 1;

    // Earlier creation first
    return (
      this._metadata.createdAt.getTime() - other._metadata.createdAt.getTime()
    );
  }

  // ============ Private Methods ============

  private updateStatus(status: TaskStatus, reason?: string): void {
    this._status = status;
    this._metadata.updatedAt = new Date();
    this._metadata.statusHistory?.push({
      status,
      timestamp: new Date(),
      reason,
    });
  }

  // ============ Serialization ============

  /**
   * Get the full task state
   */
  getState(): TaskState {
    return {
      config: this.toConfig(),
      status: this._status,
      assignedAgent: this._assignedAgent,
      result: this._result,
      metadata: { ...this._metadata },
    };
  }

  /**
   * Convert to config object
   */
  toConfig(): TaskConfig {
    return {
      id: this.id,
      description: this.description,
      expectedOutput: this.expectedOutput,
      priority: this.priority,
      dependencies:
        this.dependencies.length > 0 ? this.dependencies : undefined,
      deadline: this.deadline,
      context: Object.keys(this.context).length > 0 ? this.context : undefined,
      assignTo: this.assignTo,
      requiredCapabilities:
        this.requiredCapabilities.length > 0
          ? this.requiredCapabilities
          : undefined,
      estimatedTokens: this.estimatedTokens,
      maxRetries: this.maxRetries,
      timeoutMs: this.timeoutMs,
      tags: this.tags.length > 0 ? this.tags : undefined,
    };
  }

  /**
   * Serialize to JSON
   */
  toJSON(): TaskState {
    return this.getState();
  }

  /**
   * Create from state
   */
  static fromState(state: TaskState): Task {
    const task = new Task(state.config);
    task._status = state.status;
    task._assignedAgent = state.assignedAgent;
    task._result = state.result;
    task._metadata = state.metadata;
    return task;
  }
}

/**
 * Factory function for creating tasks
 */
export function createTask(config: TaskConfig): Task {
  return new Task(config);
}

export default Task;
