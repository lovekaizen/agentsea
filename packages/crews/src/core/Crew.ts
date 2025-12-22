/**
 * Crew Orchestrator
 *
 * Main class for orchestrating multi-agent crews.
 */

import { nanoid } from 'nanoid';
import type {
  CrewConfig,
  CrewResult,
  CrewMetrics,
  CrewStatus,
  CrewStatusDetails,
  TaskConfig,
  TaskResult,
  DelegationStrategyType,
  TimelineEntry,
  CrewProgress,
  CrewCheckpoint,
} from '../types';
import { Task } from './Task';
import { TaskQueue } from './TaskQueue';
import { ExecutionContext } from './ExecutionContext';
import { CrewAgent, createCrewAgent } from '../agents';
import { AgentRegistry } from '../agents/AgentRegistry';
import {
  DelegationCoordinator,
  CollaborationManager,
  ConflictResolver,
  type DelegationResult,
} from '../coordination';

/**
 * Crew execution options
 */
export interface CrewExecutionOptions {
  /** Initial input for the crew */
  input?: string;
  /** Initial context values */
  context?: Record<string, unknown>;
  /** Override delegation strategy */
  delegationStrategy?: DelegationStrategyType;
  /** Timeout for the entire execution (ms) */
  timeoutMs?: number;
  /** Enable verbose logging */
  verbose?: boolean;
}

/**
 * Crew - Multi-agent orchestrator
 *
 * The main class for creating and running multi-agent crews.
 */
export class Crew {
  readonly id: string;
  readonly name: string;
  readonly description?: string;

  private readonly config: CrewConfig;
  private readonly agents: AgentRegistry;
  private readonly taskQueue: TaskQueue;
  private readonly delegation: DelegationCoordinator;
  private readonly collaboration: CollaborationManager;
  private readonly conflictResolver: ConflictResolver;
  private context!: ExecutionContext;

  private state: CrewStatus = 'idle';
  private startTime?: Date;
  private endTime?: Date;
  private currentIteration: number = 0;
  private readonly maxIterations: number;
  private readonly timeline: TimelineEntry[] = [];
  private readonly results: Map<string, TaskResult> = new Map();

  constructor(config: CrewConfig) {
    this.id = nanoid();
    this.name = config.name;
    this.description = config.description;
    this.config = config;
    this.maxIterations = config.maxIterations ?? 100;

    // Initialize components
    this.agents = new AgentRegistry();
    this.taskQueue = new TaskQueue({ defaultPriority: 'medium' });
    this.delegation = new DelegationCoordinator({
      defaultStrategy: config.delegationStrategy,
    });
    this.collaboration = new CollaborationManager();
    this.conflictResolver = new ConflictResolver();

    // Initialize agents from config
    this.initializeAgents();
  }

  // ============ Agent Management ============

  /**
   * Initialize agents from config
   */
  private initializeAgents(): void {
    for (const agentConfig of this.config.agents) {
      const agent = createCrewAgent({ config: agentConfig });
      this.addAgent(agent);
    }
  }

  /**
   * Add an agent to the crew
   */
  addAgent(agent: CrewAgent): void {
    this.agents.register(agent);
    this.collaboration.registerAgent(agent);
  }

  /**
   * Remove an agent from the crew
   */
  removeAgent(name: string): void {
    this.agents.unregister(name);
    this.collaboration.unregisterAgent(name);
  }

  /**
   * Get an agent by name
   */
  getAgent(name: string): CrewAgent | undefined {
    return this.agents.get(name);
  }

  /**
   * Get all agents
   */
  getAgents(): CrewAgent[] {
    return this.agents.getAll();
  }

  // ============ Task Management ============

  /**
   * Add a task to the crew
   */
  addTask(taskConfig: TaskConfig): Task {
    const task = new Task(taskConfig);
    this.taskQueue.enqueue(task);
    return task;
  }

  /**
   * Add multiple tasks
   */
  addTasks(tasks: TaskConfig[]): Task[] {
    return tasks.map((t) => this.addTask(t));
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): Task | undefined {
    return this.taskQueue.get(taskId);
  }

  /**
   * Get all tasks
   */
  getTasks(): Task[] {
    return this.taskQueue.getAll();
  }

  // ============ Execution ============

  /**
   * Start crew execution
   */
  async kickoff(options: CrewExecutionOptions = {}): Promise<CrewResult> {
    // Collect all events for final result
    const events: CrewEvent[] = [];

    // Execute with stream and collect events
    for await (const event of this.kickoffStream(options)) {
      events.push(event);
    }

    // Build final result
    const taskResults = Array.from(this.results.values());

    return {
      success: this.state === 'completed',
      taskResults,
      metrics: this.getMetrics(),
      timeline: [...this.timeline],
      finalOutput: this.buildFinalOutput(taskResults),
      events,
    };
  }

  /**
   * Start crew execution with streaming events
   */
  async *kickoffStream(
    options: CrewExecutionOptions = {},
  ): AsyncGenerator<CrewEvent> {
    // Initialize execution context
    this.context = new ExecutionContext({
      crewName: this.name,
    });

    // Set initial context values
    if (options.context) {
      for (const [key, value] of Object.entries(options.context)) {
        this.context.set(key, value);
      }
    }

    // Set input
    if (options.input) {
      this.context.set('input', options.input);
    }

    // Setup event forwarding
    const eventQueue: CrewEvent[] = [];
    this.context.on('*', (event) => {
      eventQueue.push(event);
    });

    // Emit crew started
    this.state = 'running';
    this.startTime = new Date();
    this.currentIteration = 0;

    const startedEvent: CrewEvent = {
      type: 'crew:started',
      crewName: this.name,
      agentCount: this.agents.getAll().length,
      taskCount: this.taskQueue.size,
    };
    yield startedEvent;
    this.addTimelineEntry('crew_started', this.name);

    // Setup timeout if specified
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (options.timeoutMs) {
      timeoutId = setTimeout(() => {
        this.abort();
      }, options.timeoutMs);
    }

    try {
      // Main execution loop
      while (
        this.state === 'running' &&
        this.currentIteration < this.maxIterations
      ) {
        this.currentIteration++;

        // Get ready tasks
        const readyTasks = this.taskQueue.getReadyTasks(
          this.context.getCompletedTasks(),
        );

        if (readyTasks.length === 0) {
          // Check if we're done
          if (
            this.taskQueue.getByStatus('pending').length === 0 &&
            this.taskQueue.getByStatus('assigned').length === 0 &&
            this.taskQueue.getByStatus('in_progress').length === 0
          ) {
            break;
          }

          // Wait for in-progress tasks
          await this.sleep(100);
          continue;
        }

        // Process tasks
        for (const task of readyTasks) {
          // Check if still running
          if (this.state !== 'running') break;

          // Delegate task
          const delegationResult = await this.delegateTask(task, options);

          // Yield delegation event
          yield {
            type: 'task:assigned',
            taskId: task.id,
            taskDescription: task.description,
            agentName: delegationResult.selectedAgent,
            reason: delegationResult.reason,
          };

          // Execute task
          const taskResult = await this.executeTask(task, delegationResult);

          // Yield task result events
          yield {
            type: 'task:completed',
            taskId: task.id,
            result: taskResult.output,
            agentName: delegationResult.selectedAgent,
          };

          // Yield any queued events
          while (eventQueue.length > 0) {
            yield eventQueue.shift()!;
          }
        }

        // Handle paused state
        while (this.state === 'paused') {
          await this.sleep(100);
        }
      }

      // Determine final state
      const failedTasks = this.taskQueue.getByStatus('failed');
      if (failedTasks.length > 0) {
        this.state = 'failed';
        yield {
          type: 'crew:error',
          crewName: this.name,
          error: `${failedTasks.length} task(s) failed`,
          recoverable: false,
        };
      } else if (this.state !== 'aborted') {
        this.state = 'completed';
      }
    } catch (error) {
      this.state = 'failed';
      yield {
        type: 'crew:error',
        crewName: this.name,
        error: error instanceof Error ? error.message : String(error),
        recoverable: false,
      };
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      this.endTime = new Date();
    }

    // Emit crew completed
    yield {
      type: 'crew:completed',
      crewName: this.name,
      metrics: this.getMetrics(),
      success: this.state === 'completed',
    };
    this.addTimelineEntry('crew_completed', this.name);
  }

  /**
   * Delegate a task to an agent
   */
  private async delegateTask(
    task: Task,
    options: CrewExecutionOptions,
  ): Promise<DelegationResult> {
    const agents = this.agents.getAll();
    const strategy =
      options.delegationStrategy ?? this.config.delegationStrategy;

    const result = await this.delegation.delegate(
      task.toConfig(),
      agents,
      this.context,
      strategy,
    );

    // Assign task to agent
    task.assign(result.selectedAgent);
    this.addTimelineEntry('task_delegated', task.id, {
      agent: result.selectedAgent,
      strategy,
    });

    return result;
  }

  /**
   * Execute a task with assigned agent
   */
  private async executeTask(
    task: Task,
    delegation: DelegationResult,
  ): Promise<TaskResult> {
    const agent = this.agents.get(delegation.selectedAgent);

    if (!agent) {
      const error = new Error(`Agent ${delegation.selectedAgent} not found`);
      task.fail(error.message);
      throw error;
    }

    // Start task
    task.start();
    this.addTimelineEntry('task_started', task.id, { agent: agent.name });

    // Emit task started event
    this.context.emit({
      type: 'task:started',
      taskId: task.id,
      agentName: agent.name,
    });

    try {
      // Execute task
      const result = await agent.executeTask(task.toConfig());

      // Complete task
      task.complete(result);
      this.results.set(task.id, result);
      this.context.markTaskCompleted(task.id, result);
      this.agents.recordSuccess(agent.name);
      this.addTimelineEntry('task_completed', task.id, {
        agent: agent.name,
        success: true,
      });

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Check for retry
      if (task.canRetry()) {
        task.incrementRetryCount();
        this.addTimelineEntry('task_retried', task.id, {
          agent: agent.name,
          error: errorMsg,
        });

        this.context.emit({
          type: 'task:retried',
          taskId: task.id,
          agentName: agent.name,
          attemptNumber: task.getRetryCount(),
          reason: errorMsg,
        });

        // Re-queue task
        task.reset();
        return this.executeTask(task, delegation);
      }

      // Task failed
      task.fail(errorMsg);
      this.agents.recordFailure(agent.name);
      this.addTimelineEntry('task_failed', task.id, {
        agent: agent.name,
        error: errorMsg,
      });

      throw error;
    }
  }

  /**
   * Build final output from task results
   */
  private buildFinalOutput(results: TaskResult[]): string {
    if (results.length === 0) {
      return '';
    }

    if (results.length === 1) {
      return results[0].output;
    }

    // Combine all outputs
    return results
      .map((r, i) => `## Task ${i + 1} Result\n\n${r.output}`)
      .join('\n\n---\n\n');
  }

  // ============ Control ============

  /**
   * Pause crew execution
   */
  pause(): void {
    if (this.state === 'running') {
      this.state = 'paused';
      this.context.emit({
        type: 'crew:paused',
        crewName: this.name,
      });
      this.addTimelineEntry('crew_paused', this.name);
    }
  }

  /**
   * Resume crew execution
   */
  resume(): void {
    if (this.state === 'paused') {
      this.state = 'running';
      this.context.emit({
        type: 'crew:resumed',
        crewName: this.name,
      });
      this.addTimelineEntry('crew_resumed', this.name);
    }
  }

  /**
   * Abort crew execution
   */
  abort(): void {
    if (this.state === 'running' || this.state === 'paused') {
      this.state = 'aborted';
      this.context.abort();
      this.context.emit({
        type: 'crew:aborted',
        crewName: this.name,
        reason: 'User requested abort',
      });
      this.addTimelineEntry('crew_aborted', this.name);
    }
  }

  // ============ State & Metrics ============

  /**
   * Get current crew status
   */
  getStatus(): CrewStatusDetails {
    return {
      state: this.state,
      currentIteration: this.currentIteration,
      maxIterations: this.maxIterations,
      startTime: this.startTime,
      endTime: this.endTime,
      tasksPending: this.taskQueue.getByStatus('pending').length,
      tasksInProgress: this.taskQueue.getByStatus('in_progress').length,
      tasksCompleted: this.taskQueue.getByStatus('completed').length,
      tasksFailed: this.taskQueue.getByStatus('failed').length,
      agentsBusy: this.agents.getAll().filter((a) => a.isBusy).length,
      agentsAvailable: this.agents.getAll().filter((a) => !a.isBusy).length,
    };
  }

  /**
   * Get crew metrics
   */
  getMetrics(): CrewMetrics {
    const allTasks = this.taskQueue.getAll();
    const completedTasks = this.taskQueue.getByStatus('completed');
    const failedTasks = this.taskQueue.getByStatus('failed');
    const agents = this.agents.getAll();

    // Calculate total execution time
    const totalExecutionTimeMs =
      this.startTime && this.endTime
        ? this.endTime.getTime() - this.startTime.getTime()
        : 0;

    // Calculate total tokens
    let totalTokens = 0;
    for (const result of this.results.values()) {
      totalTokens += result.tokensUsed ?? 0;
    }

    // Build agent metrics
    const agentMetrics: CrewMetrics['agentMetrics'] = {};
    for (const agent of agents) {
      const stats = agent.getStats();
      agentMetrics[agent.name] = {
        tasksAssigned: stats.tasksCompleted + stats.tasksFailed,
        tasksCompleted: stats.tasksCompleted,
        tasksFailed: stats.tasksFailed,
        tokensUsed: stats.totalTokensUsed,
        averageLatencyMs: 0, // Would need to track this separately
      };
    }

    // Get delegation statistics
    const delegationStats = this.delegation.getStatistics();

    return {
      totalTasks: allTasks.length,
      completedTasks: completedTasks.length,
      failedTasks: failedTasks.length,
      totalExecutionTimeMs,
      averageTaskTimeMs:
        completedTasks.length > 0
          ? totalExecutionTimeMs / completedTasks.length
          : 0,
      totalIterations: this.currentIteration,
      totalTokens,
      agentMetrics,
      delegationStats: {
        totalDelegations: delegationStats.totalDelegations,
        byStrategy: delegationStats.byStrategy,
        averageConfidence: delegationStats.averageConfidence,
      },
    };
  }

  /**
   * Get crew progress
   */
  getProgress(): CrewProgress {
    const allTasks = this.taskQueue.getAll();
    const completed = this.taskQueue.getByStatus('completed').length;
    const total = allTasks.length;

    return {
      percentage: total > 0 ? (completed / total) * 100 : 0,
      completedTasks: completed,
      totalTasks: total,
      currentTask: this.taskQueue.getByStatus('in_progress')[0]?.description,
      estimatedRemainingMs: 0, // Would need historical data
    };
  }

  /**
   * Get timeline
   */
  getTimeline(): TimelineEntry[] {
    return [...this.timeline];
  }

  // ============ Checkpointing ============

  /**
   * Create a checkpoint of current state
   */
  createCheckpoint(): CrewCheckpoint {
    return {
      id: nanoid(),
      crewId: this.id,
      timestamp: new Date(),
      state: this.state,
      context: this.context?.createCheckpoint(),
      taskQueue: this.taskQueue.getAll().map((t) => t.toConfig()),
      results: Object.fromEntries(this.results),
      timeline: [...this.timeline],
      iteration: this.currentIteration,
    };
  }

  /**
   * Restore from checkpoint
   */
  restoreCheckpoint(checkpoint: CrewCheckpoint): void {
    if (this.state !== 'idle') {
      throw new Error('Cannot restore checkpoint while crew is running');
    }

    // Clear current state
    this.taskQueue.clear();
    this.results.clear();
    this.timeline.length = 0;

    // Restore tasks
    for (const taskConfig of checkpoint.taskQueue) {
      this.addTask(taskConfig);
    }

    // Restore results
    for (const [taskId, result] of Object.entries(checkpoint.results)) {
      this.results.set(taskId, result);
    }

    // Restore timeline
    this.timeline.push(...checkpoint.timeline);

    // Restore iteration
    this.currentIteration = checkpoint.iteration;
  }

  // ============ Utilities ============

  /**
   * Add a timeline entry
   */
  private addTimelineEntry(
    event: string,
    entityId: string,
    data?: Record<string, unknown>,
  ): void {
    this.timeline.push({
      timestamp: new Date(),
      event,
      entityId,
      data,
    });
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Reset crew for re-execution
   */
  reset(): void {
    if (this.state === 'running' || this.state === 'paused') {
      throw new Error('Cannot reset while crew is running');
    }

    this.state = 'idle';
    this.startTime = undefined;
    this.endTime = undefined;
    this.currentIteration = 0;
    this.timeline.length = 0;
    this.results.clear();
    this.taskQueue.clear();
    this.delegation.reset();
    this.collaboration.clear();
    this.conflictResolver.clear();
  }

  // ============ Serialization ============

  /**
   * Get crew configuration
   */
  getConfig(): CrewConfig {
    return { ...this.config };
  }
}

/**
 * Factory function
 */
export function createCrew(config: CrewConfig): Crew {
  return new Crew(config);
}

export default Crew;
