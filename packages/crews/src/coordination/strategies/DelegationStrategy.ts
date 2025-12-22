/**
 * DelegationStrategy Interface
 *
 * Base interface for all delegation strategies.
 */

import type { DelegationStrategyType, TaskConfig } from '../../types';
import type { CrewAgent } from '../../agents';
import type { ExecutionContext } from '../../core';

/**
 * Result of a delegation decision
 */
export interface DelegationResult {
  /** Selected agent name */
  selectedAgent: string;
  /** Reason for selection */
  reason: string;
  /** Confidence in the selection (0-1) */
  confidence: number;
  /** Alternative agents considered */
  alternativeAgents?: string[];
  /** Time taken to make decision (ms) */
  decisionTimeMs?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Delegation failure
 */
export interface DelegationFailure {
  /** Reason for failure */
  reason: string;
  /** Agents that were considered */
  consideredAgents: string[];
  /** Suggestions for resolution */
  suggestions?: string[];
}

/**
 * Base interface for delegation strategies
 */
export interface DelegationStrategy {
  /** Strategy name/type */
  readonly name: DelegationStrategyType;

  /**
   * Select an agent for a task
   */
  selectAgent(
    task: TaskConfig,
    agents: CrewAgent[],
    context: ExecutionContext,
  ): Promise<DelegationResult>;

  /**
   * Batch assign multiple tasks to agents
   */
  assignTasks?(
    tasks: TaskConfig[],
    agents: CrewAgent[],
    context: ExecutionContext,
  ): Promise<Map<string, string>>; // taskId -> agentName

  /**
   * Reset strategy state (if any)
   */
  reset?(): void;
}

/**
 * Abstract base class for delegation strategies
 */
export abstract class BaseDelegationStrategy implements DelegationStrategy {
  abstract readonly name: DelegationStrategyType;

  abstract selectAgent(
    task: TaskConfig,
    agents: CrewAgent[],
    context: ExecutionContext,
  ): Promise<DelegationResult>;

  /**
   * Default batch assignment - sequential selection
   */
  async assignTasks(
    tasks: TaskConfig[],
    agents: CrewAgent[],
    context: ExecutionContext,
  ): Promise<Map<string, string>> {
    const assignments = new Map<string, string>();
    const availableAgents = [...agents];

    for (const task of tasks) {
      if (availableAgents.length === 0) {
        break;
      }

      try {
        const result = await this.selectAgent(task, availableAgents, context);
        assignments.set(task.id!, result.selectedAgent);

        // Remove assigned agent from available pool (if not parallel capable)
        const assignedIndex = availableAgents.findIndex(
          (a) => a.name === result.selectedAgent,
        );
        if (
          assignedIndex >= 0 &&
          !availableAgents[assignedIndex].parallelCapable
        ) {
          availableAgents.splice(assignedIndex, 1);
        }
      } catch {
        // Skip tasks that can't be assigned
      }
    }

    return assignments;
  }

  /**
   * Filter available agents (not busy)
   */
  protected filterAvailable(agents: CrewAgent[]): CrewAgent[] {
    return agents.filter((a) => !a.isBusy);
  }

  /**
   * Create a failure result
   */
  protected createFailure(reason: string, agents: CrewAgent[]): never {
    const failure: DelegationFailure = {
      reason,
      consideredAgents: agents.map((a) => a.name),
    };
    throw new DelegationError(failure);
  }

  reset(): void {
    // Default: no state to reset
  }
}

/**
 * Error thrown when delegation fails
 */
export class DelegationError extends Error {
  readonly failure: DelegationFailure;

  constructor(failure: DelegationFailure) {
    super(`Delegation failed: ${failure.reason}`);
    this.name = 'DelegationError';
    this.failure = failure;
  }
}

export default DelegationStrategy;
