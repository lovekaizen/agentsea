/**
 * Parallel Execution
 *
 * Utilities for concurrent task execution in workflows.
 */

import type { TaskConfig, TaskResult } from '../types';
import type { CrewAgent } from '../agents';
import type { ExecutionContext } from '../core';

/**
 * Parallel execution options
 */
export interface ParallelExecutionOptions {
  /** Maximum concurrent executions */
  maxConcurrency?: number;
  /** Timeout for each task (ms) */
  taskTimeout?: number;
  /** Fail fast - stop all on first failure */
  failFast?: boolean;
  /** Continue on error */
  continueOnError?: boolean;
}

/**
 * Parallel task result
 */
export interface ParallelTaskResult {
  taskId: string;
  status: 'success' | 'failed' | 'timeout';
  result?: TaskResult;
  error?: string;
  executionTimeMs: number;
}

/**
 * Batch execution result
 */
export interface BatchResult {
  results: ParallelTaskResult[];
  totalTimeMs: number;
  successCount: number;
  failureCount: number;
  allSuccessful: boolean;
}

/**
 * Parallel executor
 *
 * Executes tasks in parallel with concurrency control.
 */
export class ParallelExecutor {
  private readonly options: Required<ParallelExecutionOptions>;

  constructor(options: ParallelExecutionOptions = {}) {
    this.options = {
      maxConcurrency: options.maxConcurrency ?? 5,
      taskTimeout: options.taskTimeout ?? 60000,
      failFast: options.failFast ?? false,
      continueOnError: options.continueOnError ?? true,
    };
  }

  /**
   * Execute tasks in parallel
   */
  async executeBatch(
    tasks: TaskConfig[],
    executor: (task: TaskConfig) => Promise<TaskResult>,
    _context?: ExecutionContext,
  ): Promise<BatchResult> {
    const startTime = Date.now();
    const results: ParallelTaskResult[] = [];
    let aborted = false;

    // Create semaphore for concurrency control
    const semaphore = new Semaphore(this.options.maxConcurrency);

    // Create task promises
    const taskPromises = tasks.map(async (task) => {
      if (aborted) {
        return {
          taskId: task.id!,
          status: 'failed' as const,
          error: 'Batch aborted',
          executionTimeMs: 0,
        };
      }

      // Acquire semaphore
      await semaphore.acquire();
      const taskStartTime = Date.now();

      try {
        // Execute with timeout
        const result = await Promise.race([
          executor(task),
          this.createTimeout(this.options.taskTimeout),
        ]);

        return {
          taskId: task.id!,
          status: 'success' as const,
          result,
          executionTimeMs: Date.now() - taskStartTime,
        };
      } catch (error) {
        const isTimeout = error instanceof TimeoutError;

        if (this.options.failFast && !isTimeout) {
          aborted = true;
        }

        return {
          taskId: task.id!,
          status: isTimeout ? ('timeout' as const) : ('failed' as const),
          error: error instanceof Error ? error.message : String(error),
          executionTimeMs: Date.now() - taskStartTime,
        };
      } finally {
        semaphore.release();
      }
    });

    // Wait for all tasks
    const parallelResults = await Promise.all(taskPromises);
    results.push(...parallelResults);

    // Calculate statistics
    const successCount = results.filter((r) => r.status === 'success').length;
    const failureCount = results.filter((r) => r.status !== 'success').length;

    return {
      results,
      totalTimeMs: Date.now() - startTime,
      successCount,
      failureCount,
      allSuccessful: failureCount === 0,
    };
  }

  /**
   * Execute tasks with agent assignment
   */
  async executeWithAgents(
    tasks: TaskConfig[],
    agents: CrewAgent[],
    context: ExecutionContext,
  ): Promise<BatchResult> {
    // Create executor that uses available agents
    const agentQueue = new AgentPool(agents);

    const executor = async (task: TaskConfig): Promise<TaskResult> => {
      const agent = await agentQueue.acquire();

      try {
        return await agent.executeTask(task);
      } finally {
        agentQueue.release(agent);
      }
    };

    return this.executeBatch(tasks, executor, context);
  }

  /**
   * Map over items with parallel execution
   */
  async map<T, R>(
    items: T[],
    mapper: (item: T, index: number) => Promise<R>,
  ): Promise<Array<{ item: T; result?: R; error?: string }>> {
    const semaphore = new Semaphore(this.options.maxConcurrency);
    let aborted = false;

    const results = await Promise.all(
      items.map(async (item, index) => {
        if (aborted) {
          return { item, error: 'Aborted' };
        }

        await semaphore.acquire();

        try {
          const result = await mapper(item, index);
          return { item, result };
        } catch (error) {
          if (this.options.failFast) {
            aborted = true;
          }
          return {
            item,
            error: error instanceof Error ? error.message : String(error),
          };
        } finally {
          semaphore.release();
        }
      }),
    );

    return results;
  }

  /**
   * Execute tasks in batches
   */
  async executeBatches<T, R>(
    items: T[],
    batchSize: number,
    processor: (batch: T[]) => Promise<R[]>,
  ): Promise<R[]> {
    const results: R[] = [];
    const batches: T[][] = [];

    // Create batches
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    // Process batches in parallel
    const semaphore = new Semaphore(this.options.maxConcurrency);

    await Promise.all(
      batches.map(async (batch) => {
        await semaphore.acquire();

        try {
          const batchResults = await processor(batch);
          results.push(...batchResults);
        } finally {
          semaphore.release();
        }
      }),
    );

    return results;
  }

  /**
   * Create a timeout promise
   */
  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError(`Task timed out after ${ms}ms`));
      }, ms);
    });
  }
}

/**
 * Semaphore for concurrency control
 */
class Semaphore {
  private permits: number;
  private readonly waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise((resolve) => {
      this.waiting.push(resolve);
    });
  }

  release(): void {
    if (this.waiting.length > 0) {
      const next = this.waiting.shift()!;
      next();
    } else {
      this.permits++;
    }
  }
}

/**
 * Agent pool for parallel task execution
 */
class AgentPool {
  private readonly available: CrewAgent[];
  private readonly waiting: Array<(agent: CrewAgent) => void> = [];

  constructor(agents: CrewAgent[]) {
    this.available = [...agents];
  }

  async acquire(): Promise<CrewAgent> {
    if (this.available.length > 0) {
      return this.available.pop()!;
    }

    return new Promise((resolve) => {
      this.waiting.push(resolve);
    });
  }

  release(agent: CrewAgent): void {
    if (this.waiting.length > 0) {
      const next = this.waiting.shift()!;
      next(agent);
    } else {
      this.available.push(agent);
    }
  }
}

/**
 * Timeout error
 */
class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Factory function
 */
export function createParallelExecutor(
  options?: ParallelExecutionOptions,
): ParallelExecutor {
  return new ParallelExecutor(options);
}

export default ParallelExecutor;
