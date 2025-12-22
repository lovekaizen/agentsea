/**
 * AgentRegistry
 *
 * Registry for managing and discovering crew agents.
 */

import type { TaskConfig, RankedAgent } from '../types';
import { AgentCapabilities, type CapableAgent } from './AgentCapabilities';

/**
 * Agent status in the registry
 */
export type AgentStatus = 'available' | 'busy' | 'unavailable' | 'error';

/**
 * Registered agent entry
 */
export interface RegisteredAgent<T extends CapableAgent = CapableAgent> {
  agent: T;
  status: AgentStatus;
  currentTask?: string;
  registeredAt: Date;
  lastActiveAt?: Date;
  tasksCompleted: number;
  tasksFailed: number;
  metadata?: Record<string, unknown>;
}

/**
 * Registry configuration
 */
export interface AgentRegistryConfig {
  /** Allow duplicate agent names */
  allowDuplicates?: boolean;
  /** Track agent statistics */
  trackStats?: boolean;
}

/**
 * Registry for crew agents
 */
export class AgentRegistry<T extends CapableAgent = CapableAgent> {
  private agents: Map<string, RegisteredAgent<T>> = new Map();
  private readonly allowDuplicates: boolean;
  private readonly trackStats: boolean;

  constructor(config: AgentRegistryConfig = {}) {
    this.allowDuplicates = config.allowDuplicates ?? false;
    this.trackStats = config.trackStats ?? true;
  }

  // ============ Registration ============

  /**
   * Register an agent
   */
  register(agent: T, metadata?: Record<string, unknown>): void {
    if (this.agents.has(agent.name) && !this.allowDuplicates) {
      throw new Error(`Agent "${agent.name}" is already registered`);
    }

    this.agents.set(agent.name, {
      agent,
      status: 'available',
      registeredAt: new Date(),
      tasksCompleted: 0,
      tasksFailed: 0,
      metadata,
    });
  }

  /**
   * Register multiple agents
   */
  registerMany(agents: T[]): void {
    for (const agent of agents) {
      this.register(agent);
    }
  }

  /**
   * Unregister an agent
   */
  unregister(name: string): boolean {
    return this.agents.delete(name);
  }

  /**
   * Check if an agent is registered
   */
  has(name: string): boolean {
    return this.agents.has(name);
  }

  // ============ Retrieval ============

  /**
   * Get an agent by name
   */
  get(name: string): T | undefined {
    return this.agents.get(name)?.agent;
  }

  /**
   * Get registered agent entry
   */
  getEntry(name: string): RegisteredAgent<T> | undefined {
    return this.agents.get(name);
  }

  /**
   * Get all agents
   */
  getAll(): T[] {
    return Array.from(this.agents.values()).map((entry) => entry.agent);
  }

  /**
   * Get all registered entries
   */
  getAllEntries(): RegisteredAgent<T>[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agent names
   */
  getNames(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Get agent count
   */
  get size(): number {
    return this.agents.size;
  }

  // ============ Status Management ============

  /**
   * Get agent status
   */
  getStatus(name: string): AgentStatus | undefined {
    return this.agents.get(name)?.status;
  }

  /**
   * Set agent status
   */
  setStatus(name: string, status: AgentStatus): void {
    const entry = this.agents.get(name);
    if (entry) {
      entry.status = status;
      entry.lastActiveAt = new Date();
    }
  }

  /**
   * Mark agent as busy with a task
   */
  markBusy(name: string, taskId: string): void {
    const entry = this.agents.get(name);
    if (entry) {
      entry.status = 'busy';
      entry.currentTask = taskId;
      entry.lastActiveAt = new Date();
    }
  }

  /**
   * Mark agent as available
   */
  markAvailable(name: string): void {
    const entry = this.agents.get(name);
    if (entry) {
      entry.status = 'available';
      entry.currentTask = undefined;
      entry.lastActiveAt = new Date();
    }
  }

  /**
   * Record task completion
   */
  recordTaskCompletion(name: string, success: boolean): void {
    const entry = this.agents.get(name);
    if (entry && this.trackStats) {
      if (success) {
        entry.tasksCompleted++;
      } else {
        entry.tasksFailed++;
      }
      entry.currentTask = undefined;
      entry.status = 'available';
      entry.lastActiveAt = new Date();
    }
  }

  // ============ Discovery ============

  /**
   * Find agents by capability
   */
  findByCapability(capabilityName: string): T[] {
    const results: T[] = [];
    for (const entry of this.agents.values()) {
      const hasCapability = entry.agent.capabilities.some(
        (c) => c.name.toLowerCase() === capabilityName.toLowerCase(),
      );
      if (hasCapability) {
        results.push(entry.agent);
      }
    }
    return results;
  }

  /**
   * Find agents by role name
   */
  findByRole(roleName: string): T[] {
    const results: T[] = [];
    for (const entry of this.agents.values()) {
      // Check if agent has a role property with matching name
      const agent = entry.agent as unknown as { role?: { name?: string } };
      if (agent.role?.name?.toLowerCase() === roleName.toLowerCase()) {
        results.push(entry.agent);
      }
    }
    return results;
  }

  /**
   * Find the best matching agent for a task
   */
  findBestMatch(task: TaskConfig): T | undefined {
    const available = this.getAvailable();
    if (available.length === 0) return undefined;

    const result = AgentCapabilities.findBestMatch(available, task);
    return result ? this.get(result.agentName) : undefined;
  }

  /**
   * Rank agents for a task
   */
  rankForTask(task: TaskConfig): RankedAgent[] {
    return AgentCapabilities.rank(this.getAll(), task);
  }

  /**
   * Find agents that can handle a task
   */
  findCapableAgents(task: TaskConfig): T[] {
    const ranked = AgentCapabilities.findCapableAgents(this.getAll(), task);
    return ranked.map((r) => this.get(r.agentName)!).filter(Boolean);
  }

  // ============ Filtering ============

  /**
   * Get available agents
   */
  getAvailable(): T[] {
    return Array.from(this.agents.values())
      .filter((entry) => entry.status === 'available')
      .map((entry) => entry.agent);
  }

  /**
   * Get busy agents
   */
  getBusy(): T[] {
    return Array.from(this.agents.values())
      .filter((entry) => entry.status === 'busy')
      .map((entry) => entry.agent);
  }

  /**
   * Get agents by status
   */
  getByStatus(status: AgentStatus): T[] {
    return Array.from(this.agents.values())
      .filter((entry) => entry.status === status)
      .map((entry) => entry.agent);
  }

  /**
   * Get available count
   */
  getAvailableCount(): number {
    let count = 0;
    for (const entry of this.agents.values()) {
      if (entry.status === 'available') count++;
    }
    return count;
  }

  /**
   * Check if any agent is available
   */
  hasAvailable(): boolean {
    for (const entry of this.agents.values()) {
      if (entry.status === 'available') return true;
    }
    return false;
  }

  // ============ Statistics ============

  /**
   * Get registry statistics
   */
  getStats(): RegistryStats {
    const stats: RegistryStats = {
      total: this.agents.size,
      available: 0,
      busy: 0,
      unavailable: 0,
      error: 0,
      totalTasksCompleted: 0,
      totalTasksFailed: 0,
    };

    for (const entry of this.agents.values()) {
      stats[entry.status]++;
      stats.totalTasksCompleted += entry.tasksCompleted;
      stats.totalTasksFailed += entry.tasksFailed;
    }

    return stats;
  }

  /**
   * Get agent statistics
   */
  getAgentStats(name: string): AgentStats | undefined {
    const entry = this.agents.get(name);
    if (!entry) return undefined;

    return {
      name: entry.agent.name,
      status: entry.status,
      currentTask: entry.currentTask,
      tasksCompleted: entry.tasksCompleted,
      tasksFailed: entry.tasksFailed,
      successRate:
        entry.tasksCompleted + entry.tasksFailed > 0
          ? entry.tasksCompleted / (entry.tasksCompleted + entry.tasksFailed)
          : 0,
      registeredAt: entry.registeredAt,
      lastActiveAt: entry.lastActiveAt,
    };
  }

  // ============ Iteration ============

  /**
   * Iterate over agents
   */
  *[Symbol.iterator](): Iterator<T> {
    for (const entry of this.agents.values()) {
      yield entry.agent;
    }
  }

  /**
   * For each agent
   */
  forEach(callback: (agent: T, name: string) => void): void {
    for (const [name, entry] of this.agents) {
      callback(entry.agent, name);
    }
  }

  // ============ Utilities ============

  /**
   * Clear all agents
   */
  clear(): void {
    this.agents.clear();
  }

  /**
   * Reset all agent statuses to available
   */
  resetAllStatuses(): void {
    for (const entry of this.agents.values()) {
      entry.status = 'available';
      entry.currentTask = undefined;
    }
  }
}

/**
 * Registry statistics
 */
export interface RegistryStats {
  total: number;
  available: number;
  busy: number;
  unavailable: number;
  error: number;
  totalTasksCompleted: number;
  totalTasksFailed: number;
}

/**
 * Individual agent statistics
 */
export interface AgentStats {
  name: string;
  status: AgentStatus;
  currentTask?: string;
  tasksCompleted: number;
  tasksFailed: number;
  successRate: number;
  registeredAt: Date;
  lastActiveAt?: Date;
}

/**
 * Factory function for creating agent registries
 */
export function createAgentRegistry<T extends CapableAgent = CapableAgent>(
  config?: AgentRegistryConfig,
): AgentRegistry<T> {
  return new AgentRegistry<T>(config);
}

export default AgentRegistry;
