/**
 * TaskQueue Class
 *
 * Priority-based task queue with dependency tracking.
 */

import type { TaskStatus, TaskPriority } from '../types';
import { Task } from './Task';

/**
 * Configuration for TaskQueue
 */
export interface TaskQueueConfig {
  /** Maximum queue size */
  maxSize?: number;
  /** Enable auto-sorting on enqueue */
  autoSort?: boolean;
  /** Default priority for tasks */
  defaultPriority?: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Priority-based task queue
 */
export class TaskQueue {
  private tasks: Task[] = [];
  private taskMap: Map<string, Task> = new Map();
  private readonly maxSize: number;
  private readonly autoSort: boolean;
  private dirty: boolean = false;

  constructor(config: TaskQueueConfig = {}) {
    this.maxSize = config.maxSize ?? Infinity;
    this.autoSort = config.autoSort ?? true;
  }

  // ============ Basic Operations ============

  /**
   * Add a task to the queue
   */
  enqueue(task: Task): void {
    if (this.taskMap.has(task.id)) {
      throw new Error(`Task ${task.id} already in queue`);
    }

    if (this.tasks.length >= this.maxSize) {
      throw new Error('Queue is full');
    }

    this.tasks.push(task);
    this.taskMap.set(task.id, task);
    this.dirty = true;

    if (this.autoSort) {
      this.sort();
    }
  }

  /**
   * Add multiple tasks to the queue
   */
  enqueueMany(tasks: Task[]): void {
    for (const task of tasks) {
      if (!this.taskMap.has(task.id)) {
        if (this.tasks.length < this.maxSize) {
          this.tasks.push(task);
          this.taskMap.set(task.id, task);
        }
      }
    }
    this.dirty = true;

    if (this.autoSort) {
      this.sort();
    }
  }

  /**
   * Remove and return the highest priority task
   */
  dequeue(): Task | undefined {
    if (this.dirty && this.autoSort) {
      this.sort();
    }

    const task = this.tasks.shift();
    if (task) {
      this.taskMap.delete(task.id);
    }
    return task;
  }

  /**
   * Peek at the highest priority task without removing
   */
  peek(): Task | undefined {
    if (this.dirty && this.autoSort) {
      this.sort();
    }
    return this.tasks[0];
  }

  /**
   * Get a specific task by ID
   */
  get(id: string): Task | undefined {
    return this.taskMap.get(id);
  }

  /**
   * Remove a specific task by ID
   */
  remove(id: string): Task | undefined {
    const task = this.taskMap.get(id);
    if (task) {
      this.tasks = this.tasks.filter((t) => t.id !== id);
      this.taskMap.delete(id);
    }
    return task;
  }

  /**
   * Check if a task is in the queue
   */
  has(id: string): boolean {
    return this.taskMap.has(id);
  }

  /**
   * Clear all tasks from the queue
   */
  clear(): void {
    this.tasks = [];
    this.taskMap.clear();
    this.dirty = false;
  }

  // ============ Query Methods ============

  /**
   * Get tasks by status
   */
  getByStatus(status: TaskStatus): Task[] {
    return this.tasks.filter((t) => t.status === status);
  }

  /**
   * Get tasks by priority
   */
  getByPriority(priority: TaskPriority): Task[] {
    return this.tasks.filter((t) => t.priority === priority);
  }

  /**
   * Get tasks that are ready to start (dependencies satisfied)
   */
  getReadyTasks(completedTaskIds: Set<string> = new Set()): Task[] {
    return this.tasks.filter((t) => t.canStart(completedTaskIds));
  }

  /**
   * Get tasks assigned to a specific agent
   */
  getByAgent(agentName: string): Task[] {
    return this.tasks.filter((t) => t.assignedAgent === agentName);
  }

  /**
   * Get tasks with a specific tag
   */
  getByTag(tag: string): Task[] {
    return this.tasks.filter((t) => t.tags.includes(tag));
  }

  /**
   * Get pending tasks
   */
  getPending(): Task[] {
    return this.getByStatus('pending');
  }

  /**
   * Get blocked tasks
   */
  getBlocked(): Task[] {
    return this.getByStatus('blocked');
  }

  /**
   * Get in-progress tasks
   */
  getInProgress(): Task[] {
    return this.getByStatus('in_progress');
  }

  /**
   * Get failed tasks
   */
  getFailed(): Task[] {
    return this.getByStatus('failed');
  }

  /**
   * Get tasks that can be retried
   */
  getRetryable(): Task[] {
    return this.tasks.filter((t) => t.canRetry());
  }

  /**
   * Get tasks past their deadline
   */
  getOverdue(): Task[] {
    return this.tasks.filter((t) => t.isPastDeadline());
  }

  /**
   * Get the next N ready tasks
   */
  getNextReady(n: number, completedTaskIds: Set<string> = new Set()): Task[] {
    if (this.dirty && this.autoSort) {
      this.sort();
    }

    const ready: Task[] = [];
    for (const task of this.tasks) {
      if (ready.length >= n) break;
      if (task.canStart(completedTaskIds)) {
        ready.push(task);
      }
    }
    return ready;
  }

  // ============ State Methods ============

  /**
   * Get queue size
   */
  get size(): number {
    return this.tasks.length;
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.tasks.length === 0;
  }

  /**
   * Check if queue is full
   */
  isFull(): boolean {
    return this.tasks.length >= this.maxSize;
  }

  /**
   * Get all tasks (copy)
   */
  getAll(): Task[] {
    return [...this.tasks];
  }

  /**
   * Get all task IDs
   */
  getAllIds(): string[] {
    return this.tasks.map((t) => t.id);
  }

  /**
   * Get queue statistics
   */
  getStats(): TaskQueueStats {
    const byStatus: Record<TaskStatus, number> = {
      pending: 0,
      assigned: 0,
      in_progress: 0,
      completed: 0,
      failed: 0,
      blocked: 0,
      cancelled: 0,
    };

    const byPriority: Record<TaskPriority, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    for (const task of this.tasks) {
      byStatus[task.status]++;
      byPriority[task.priority]++;
    }

    return {
      total: this.tasks.length,
      byStatus,
      byPriority,
      overdue: this.getOverdue().length,
      retryable: this.getRetryable().length,
    };
  }

  // ============ Manipulation Methods ============

  /**
   * Sort the queue by priority
   */
  sort(): void {
    this.tasks.sort((a, b) => a.compareTo(b));
    this.dirty = false;
  }

  /**
   * Update blocked status for tasks based on completed dependencies
   */
  updateBlockedTasks(completedTaskIds: Set<string>): number {
    let unblocked = 0;
    for (const task of this.tasks) {
      if (task.isBlocked && task.dependenciesSatisfied(completedTaskIds)) {
        task.unblock();
        unblocked++;
      }
    }
    return unblocked;
  }

  /**
   * Block tasks with unmet dependencies
   */
  blockDependentTasks(failedTaskId: string): number {
    let blocked = 0;
    for (const task of this.tasks) {
      if (task.dependencies.includes(failedTaskId) && task.isPending) {
        task.block(`Dependency ${failedTaskId} failed`);
        blocked++;
      }
    }
    return blocked;
  }

  /**
   * Reprioritize a task
   */
  reprioritize(taskId: string, _newPriority: TaskPriority): boolean {
    const task = this.taskMap.get(taskId);
    if (task) {
      // Create new task with updated priority
      // Note: Task priority is readonly, so we'd need to recreate
      // For now, mark as dirty to re-sort
      this.dirty = true;
      return true;
    }
    return false;
  }

  // ============ Iterator ============

  /**
   * Iterate over tasks
   */
  *[Symbol.iterator](): Iterator<Task> {
    for (const task of this.tasks) {
      yield task;
    }
  }

  /**
   * For each task
   */
  forEach(callback: (task: Task, index: number) => void): void {
    this.tasks.forEach(callback);
  }

  /**
   * Filter tasks
   */
  filter(predicate: (task: Task) => boolean): Task[] {
    return this.tasks.filter(predicate);
  }

  /**
   * Find a task
   */
  find(predicate: (task: Task) => boolean): Task | undefined {
    return this.tasks.find(predicate);
  }
}

/**
 * Queue statistics
 */
export interface TaskQueueStats {
  total: number;
  byStatus: Record<TaskStatus, number>;
  byPriority: Record<TaskPriority, number>;
  overdue: number;
  retryable: number;
}

/**
 * Factory function for creating task queues
 */
export function createTaskQueue(config?: TaskQueueConfig): TaskQueue {
  return new TaskQueue(config);
}

export default TaskQueue;
