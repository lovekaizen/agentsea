/**
 * RoundRobin Strategy
 *
 * Simple round-robin task distribution across agents.
 */

import type { TaskConfig } from '../../types';
import { AgentCapabilities, type CrewAgent } from '../../agents';
import type { ExecutionContext } from '../../core';
import {
  BaseDelegationStrategy,
  type DelegationResult,
} from './DelegationStrategy';

/**
 * Round-robin strategy configuration
 */
export interface RoundRobinConfig {
  /** Skip busy agents */
  skipBusy?: boolean;
  /** Wrap around when reaching the end */
  wrapAround?: boolean;
}

/**
 * Round-robin delegation strategy
 */
export class RoundRobinStrategy extends BaseDelegationStrategy {
  readonly name = 'round-robin' as const;

  private currentIndex: number = 0;
  private readonly skipBusy: boolean;
  private readonly wrapAround: boolean;

  constructor(config: RoundRobinConfig = {}) {
    super();
    this.skipBusy = config.skipBusy ?? true;
    this.wrapAround = config.wrapAround ?? true;
  }

  async selectAgent(
    task: TaskConfig,
    agents: CrewAgent[],
    _context: ExecutionContext,
  ): Promise<DelegationResult> {
    const startTime = Date.now();

    if (agents.length === 0) {
      this.createFailure('No agents available', []);
    }

    // Filter available agents if configured
    let available = this.skipBusy ? this.filterAvailable(agents) : agents;

    if (available.length === 0) {
      this.createFailure('All agents are busy', agents);
    }

    // Filter by capability if task has requirements
    if (task.requiredCapabilities && task.requiredCapabilities.length > 0) {
      available = available.filter((agent) => {
        const requiredCaps = task.requiredCapabilities!.map((name) => ({
          name,
          description: '',
          proficiency: 'intermediate' as const,
        }));
        const match = AgentCapabilities.match(requiredCaps, agent.capabilities);
        return match.canExecute;
      });

      if (available.length === 0) {
        this.createFailure('No agents have all required capabilities', agents);
      }
    }

    // Ensure index is within bounds
    if (this.currentIndex >= available.length) {
      if (this.wrapAround) {
        this.currentIndex = 0;
      } else {
        this.createFailure('No more agents in rotation', agents);
      }
    }

    // Select current agent
    const selectedAgent = available[this.currentIndex];

    // Advance index for next selection
    this.currentIndex = (this.currentIndex + 1) % available.length;

    return Promise.resolve({
      selectedAgent: selectedAgent.name,
      reason: `Round-robin selection (position ${this.currentIndex})`,
      confidence: 1.0, // Round-robin is deterministic
      alternativeAgents: available
        .filter((a) => a.name !== selectedAgent.name)
        .map((a) => a.name),
      decisionTimeMs: Date.now() - startTime,
      metadata: {
        strategy: 'round-robin',
        position: this.currentIndex,
        totalAgents: available.length,
      },
    });
  }

  /**
   * Batch assignment with round-robin distribution
   */
  assignTasks(
    tasks: TaskConfig[],
    agents: CrewAgent[],
    _context: ExecutionContext,
  ): Promise<Map<string, string>> {
    const assignments = new Map<string, string>();
    const available = this.skipBusy ? this.filterAvailable(agents) : agents;

    if (available.length === 0) {
      return Promise.resolve(assignments);
    }

    for (const task of tasks) {
      const agent = available[this.currentIndex % available.length];
      assignments.set(task.id!, agent.name);
      this.currentIndex++;
    }

    return Promise.resolve(assignments);
  }

  /**
   * Reset the rotation
   */
  reset(): void {
    this.currentIndex = 0;
  }

  /**
   * Get current position in rotation
   */
  getCurrentPosition(): number {
    return this.currentIndex;
  }

  /**
   * Set position in rotation
   */
  setPosition(position: number): void {
    this.currentIndex = position;
  }
}

/**
 * Factory function
 */
export function createRoundRobinStrategy(
  config?: RoundRobinConfig,
): RoundRobinStrategy {
  return new RoundRobinStrategy(config);
}

export default RoundRobinStrategy;
