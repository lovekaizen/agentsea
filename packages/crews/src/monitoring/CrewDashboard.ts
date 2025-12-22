/**
 * Crew Dashboard
 *
 * Real-time monitoring and visualization of crew execution.
 */

import { EventEmitter } from 'eventemitter3';
import type { Crew } from '../core/Crew';
import type {
  CrewStatus,
  CrewMetrics,
  CrewEvent,
  TimelineEntry,
} from '../types';

/**
 * Agent status for dashboard
 */
export interface AgentStatus {
  name: string;
  role: string;
  status: 'idle' | 'busy' | 'error';
  currentTask?: string;
  tasksCompleted: number;
  tasksFailed: number;
  tokensUsed: number;
  lastActivity?: Date;
}

/**
 * Dashboard update event
 */
export interface DashboardUpdate {
  type:
    | 'status_change'
    | 'agent_update'
    | 'task_update'
    | 'metrics_update'
    | 'event';
  timestamp: Date;
  data: unknown;
}

/**
 * Dashboard configuration
 */
export interface DashboardConfig {
  /** Update interval (ms) */
  updateInterval?: number;
  /** Track full event history */
  trackEvents?: boolean;
  /** Maximum events to keep */
  maxEvents?: number;
}

/**
 * Crew dashboard
 *
 * Provides real-time monitoring of crew execution.
 */
export class CrewDashboard extends EventEmitter<{
  update: (update: DashboardUpdate) => void;
  statusChange: (status: CrewStatus) => void;
  agentUpdate: (agent: AgentStatus) => void;
  error: (error: Error) => void;
}> {
  private readonly crew: Crew;
  private readonly config: Required<DashboardConfig>;
  private readonly events: CrewEvent[] = [];
  private updateTimer?: ReturnType<typeof setInterval>;
  private lastStatus?: CrewStatus;
  private subscribed: boolean = false;

  constructor(crew: Crew, config: DashboardConfig = {}) {
    super();
    this.crew = crew;
    this.config = {
      updateInterval: config.updateInterval ?? 1000,
      trackEvents: config.trackEvents ?? true,
      maxEvents: config.maxEvents ?? 1000,
    };
  }

  /**
   * Start monitoring
   */
  start(): void {
    if (this.subscribed) return;

    this.subscribed = true;

    // Start periodic updates
    this.updateTimer = setInterval(() => {
      this.emitUpdate();
    }, this.config.updateInterval);

    // Emit initial state
    this.emitUpdate();
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = undefined;
    }
    this.subscribed = false;
  }

  /**
   * Subscribe to updates
   */
  subscribe(callback: (update: DashboardUpdate) => void): () => void {
    this.on('update', callback);

    // Start if not already started
    if (!this.subscribed) {
      this.start();
    }

    return () => {
      this.off('update', callback);
    };
  }

  /**
   * Record an event
   */
  recordEvent(event: CrewEvent): void {
    if (!this.config.trackEvents) return;

    this.events.push(event);

    // Trim old events
    if (this.events.length > this.config.maxEvents) {
      this.events.shift();
    }

    this.emit('update', {
      type: 'event',
      timestamp: new Date(),
      data: event,
    });
  }

  // ============ Status Getters ============

  /**
   * Get current crew status
   */
  getCrewStatus(): CrewStatus {
    return this.crew.getStatus();
  }

  /**
   * Get agent statuses
   */
  getAgentStatuses(): Map<string, AgentStatus> {
    const statuses = new Map<string, AgentStatus>();

    for (const agent of this.crew.getAgents()) {
      const stats = agent.getStats();

      statuses.set(agent.name, {
        name: agent.name,
        role: agent.role.name,
        status: stats.isBusy ? 'busy' : 'idle',
        currentTask: stats.currentTask,
        tasksCompleted: stats.tasksCompleted,
        tasksFailed: stats.tasksFailed,
        tokensUsed: stats.totalTokensUsed,
      });
    }

    return statuses;
  }

  /**
   * Get crew metrics
   */
  getMetrics(): CrewMetrics {
    return this.crew.getMetrics();
  }

  /**
   * Get timeline
   */
  getTimeline(): TimelineEntry[] {
    return this.crew.getTimeline();
  }

  /**
   * Get events
   */
  getEvents(filter?: {
    type?: string;
    agent?: string;
    since?: Date;
    limit?: number;
  }): CrewEvent[] {
    let filtered = [...this.events];

    if (filter?.type) {
      filtered = filtered.filter((e) => e.type === filter.type);
    }

    if (filter?.agent) {
      filtered = filtered.filter((e) => {
        const anyEvent = e as Record<string, unknown>;
        return anyEvent.agentName === filter.agent;
      });
    }

    if (filter?.since) {
      filtered = filtered.filter((e) => {
        const anyEvent = e as Record<string, unknown>;
        const timestamp = anyEvent.timestamp as Date | undefined;
        return timestamp && timestamp >= filter.since!;
      });
    }

    if (filter?.limit) {
      filtered = filtered.slice(-filter.limit);
    }

    return filtered;
  }

  // ============ Progress Tracking ============

  /**
   * Get progress summary
   */
  getProgress(): {
    percentage: number;
    completedTasks: number;
    totalTasks: number;
    currentTask?: string;
    elapsedTime: number;
    estimatedRemaining?: number;
  } {
    const status = this.getCrewStatus();
    const metrics = this.getMetrics();
    const total =
      status.tasksPending +
      status.tasksInProgress +
      status.tasksCompleted +
      status.tasksFailed;
    const completed = status.tasksCompleted;

    return {
      percentage: total > 0 ? (completed / total) * 100 : 0,
      completedTasks: completed,
      totalTasks: total,
      elapsedTime: metrics.totalExecutionTimeMs,
    };
  }

  /**
   * Get task breakdown
   */
  getTaskBreakdown(): {
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
    total: number;
  } {
    const status = this.getCrewStatus();
    return {
      pending: status.tasksPending,
      inProgress: status.tasksInProgress,
      completed: status.tasksCompleted,
      failed: status.tasksFailed,
      total:
        status.tasksPending +
        status.tasksInProgress +
        status.tasksCompleted +
        status.tasksFailed,
    };
  }

  /**
   * Get agent breakdown
   */
  getAgentBreakdown(): {
    total: number;
    busy: number;
    idle: number;
    performance: Array<{
      name: string;
      completed: number;
      failed: number;
      successRate: number;
    }>;
  } {
    const agents = this.crew.getAgents();
    const performance = agents.map((agent) => {
      const stats = agent.getStats();
      return {
        name: agent.name,
        completed: stats.tasksCompleted,
        failed: stats.tasksFailed,
        successRate: stats.successRate,
      };
    });

    const status = this.getCrewStatus();

    return {
      total: agents.length,
      busy: status.agentsBusy,
      idle: status.agentsAvailable,
      performance,
    };
  }

  // ============ Internal ============

  /**
   * Emit an update
   */
  private emitUpdate(): void {
    const currentStatus = this.getCrewStatus();

    // Check for status change
    if (this.lastStatus && this.lastStatus.state !== currentStatus.state) {
      this.emit('statusChange', currentStatus);
    }

    this.lastStatus = currentStatus;

    // Emit metrics update
    this.emit('update', {
      type: 'metrics_update',
      timestamp: new Date(),
      data: {
        status: currentStatus,
        metrics: this.getMetrics(),
        agents: Object.fromEntries(this.getAgentStatuses()),
      },
    });
  }

  /**
   * Get dashboard snapshot
   */
  getSnapshot(): DashboardSnapshot {
    return {
      timestamp: new Date(),
      status: this.getCrewStatus(),
      metrics: this.getMetrics(),
      agents: Object.fromEntries(this.getAgentStatuses()),
      progress: this.getProgress(),
      taskBreakdown: this.getTaskBreakdown(),
      agentBreakdown: this.getAgentBreakdown(),
      recentEvents: this.events.slice(-10),
    };
  }
}

/**
 * Dashboard snapshot
 */
export interface DashboardSnapshot {
  timestamp: Date;
  status: CrewStatus;
  metrics: CrewMetrics;
  agents: Record<string, AgentStatus>;
  progress: ReturnType<CrewDashboard['getProgress']>;
  taskBreakdown: ReturnType<CrewDashboard['getTaskBreakdown']>;
  agentBreakdown: ReturnType<CrewDashboard['getAgentBreakdown']>;
  recentEvents: CrewEvent[];
}

/**
 * Factory function
 */
export function createDashboard(
  crew: Crew,
  config?: DashboardConfig,
): CrewDashboard {
  return new CrewDashboard(crew, config);
}

export default CrewDashboard;
