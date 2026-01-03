/**
 * Delegation Coordinator
 *
 * Manages delegation strategies and coordinates task assignment.
 */

import type { TaskConfig, DelegationStrategyType } from '../types';
import type { CrewAgent } from '../agents';
import type { ExecutionContext } from '../core';
import {
  type DelegationStrategy,
  type DelegationResult,
  DelegationError,
  createStrategy,
  STRATEGY_TYPES,
} from './strategies';

/**
 * Delegation coordinator configuration
 */
export interface DelegationCoordinatorConfig {
  /** Default strategy to use */
  defaultStrategy?: DelegationStrategyType;
  /** Strategy-specific configurations */
  strategyConfigs?: Partial<
    Record<DelegationStrategyType, Record<string, unknown>>
  >;
  /** Enable fallback to other strategies on failure */
  enableFallback?: boolean;
  /** Fallback strategy order */
  fallbackOrder?: DelegationStrategyType[];
  /** Maximum delegation attempts */
  maxAttempts?: number;
  /** Track delegation history */
  trackHistory?: boolean;
}

/**
 * Delegation history entry
 */
export interface DelegationHistoryEntry {
  taskId: string;
  strategy: DelegationStrategyType;
  result: DelegationResult;
  timestamp: Date;
  attempt: number;
}

/**
 * Delegation coordinator
 *
 * Central point for managing task delegation across different strategies.
 */
export class DelegationCoordinator {
  private readonly strategies: Map<DelegationStrategyType, DelegationStrategy> =
    new Map();
  private readonly defaultStrategy: DelegationStrategyType;
  private readonly enableFallback: boolean;
  private readonly fallbackOrder: DelegationStrategyType[];
  private readonly maxAttempts: number;
  private readonly trackHistory: boolean;
  private readonly history: DelegationHistoryEntry[] = [];

  constructor(config: DelegationCoordinatorConfig = {}) {
    this.defaultStrategy = config.defaultStrategy ?? 'best-match';
    this.enableFallback = config.enableFallback ?? true;
    this.fallbackOrder = config.fallbackOrder ?? [
      'best-match',
      'round-robin',
      'auction',
    ];
    this.maxAttempts = config.maxAttempts ?? 3;
    this.trackHistory = config.trackHistory ?? true;

    // Initialize strategies with configs
    for (const type of STRATEGY_TYPES) {
      const strategyConfig = config.strategyConfigs?.[type] ?? {};
      this.strategies.set(type, createStrategy(type, strategyConfig));
    }
  }

  /**
   * Register a custom strategy
   */
  registerStrategy(
    type: DelegationStrategyType,
    strategy: DelegationStrategy,
  ): void {
    this.strategies.set(type, strategy);
  }

  /**
   * Get a strategy by type
   */
  getStrategy(type: DelegationStrategyType): DelegationStrategy | undefined {
    return this.strategies.get(type);
  }

  /**
   * Delegate a task to an agent
   */
  async delegate(
    task: TaskConfig,
    agents: CrewAgent[],
    context: ExecutionContext,
    strategyType?: DelegationStrategyType,
  ): Promise<DelegationResult> {
    const strategy = strategyType ?? this.defaultStrategy;
    let lastError: Error | undefined;
    let attempt = 0;

    // Build strategy order
    const strategyOrder = this.buildStrategyOrder(strategy);

    for (const currentStrategy of strategyOrder) {
      attempt++;
      if (attempt > this.maxAttempts) {
        break;
      }

      const delegationStrategy = this.strategies.get(currentStrategy);
      if (!delegationStrategy) {
        continue;
      }

      try {
        const result = await delegationStrategy.selectAgent(
          task,
          agents,
          context,
        );

        // Record history
        if (this.trackHistory) {
          this.history.push({
            taskId: task.id!,
            strategy: currentStrategy,
            result,
            timestamp: new Date(),
            attempt,
          });
        }

        // Emit delegation event
        context.emit({
          type: 'delegation:decision',
          taskId: task.id!,
          toAgent: result.selectedAgent,
          strategy: currentStrategy,
          reason: result.reason,
          confidence: result.confidence,
          alternatives: result.alternativeAgents,
        });

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Emit delegation failure event
        context.emit({
          type: 'delegation:failed',
          taskId: task.id!,
          strategy: currentStrategy,
          reason: lastError.message,
          willRetry: this.enableFallback && attempt < this.maxAttempts,
        });

        if (!this.enableFallback) {
          throw error;
        }
      }
    }

    // All strategies failed
    throw new DelegationError(
      `Failed to delegate task after ${attempt} attempts`,
      agents,
      lastError?.message,
    );
  }

  /**
   * Delegate multiple tasks at once
   */
  async delegateBatch(
    tasks: TaskConfig[],
    agents: CrewAgent[],
    context: ExecutionContext,
    strategyType?: DelegationStrategyType,
  ): Promise<Map<string, DelegationResult>> {
    const results = new Map<string, DelegationResult>();

    // Delegate each task
    for (const task of tasks) {
      try {
        const result = await this.delegate(task, agents, context, strategyType);
        results.set(task.id!, result);
      } catch (error) {
        // Store failed delegation
        results.set(task.id!, {
          selectedAgent: '',
          reason: error instanceof Error ? error.message : String(error),
          confidence: 0,
          decisionTimeMs: 0,
          metadata: {
            failed: true,
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }

    return results;
  }

  /**
   * Find the best agent for a task without delegating
   */
  async findBestAgent(
    task: TaskConfig,
    agents: CrewAgent[],
    context: ExecutionContext,
  ): Promise<CrewAgent | undefined> {
    try {
      const result = await this.delegate(task, agents, context, 'best-match');
      return agents.find((a) => a.name === result.selectedAgent);
    } catch {
      return undefined;
    }
  }

  /**
   * Get delegation recommendations for a task
   */
  async getRecommendations(
    task: TaskConfig,
    agents: CrewAgent[],
    context: ExecutionContext,
    limit: number = 3,
  ): Promise<Array<{ agent: CrewAgent; score: number; reason: string }>> {
    const recommendations: Array<{
      agent: CrewAgent;
      score: number;
      reason: string;
    }> = [];

    // Try each strategy and collect recommendations
    for (const [strategyType, strategy] of this.strategies) {
      try {
        const result = await strategy.selectAgent(task, agents, context);
        const agent = agents.find((a) => a.name === result.selectedAgent);

        if (agent) {
          const existing = recommendations.find(
            (r) => r.agent.name === agent.name,
          );
          if (!existing) {
            recommendations.push({
              agent,
              score: result.confidence,
              reason: `${strategyType}: ${result.reason}`,
            });
          } else {
            // Update score if higher
            if (result.confidence > existing.score) {
              existing.score = result.confidence;
              existing.reason = `${strategyType}: ${result.reason}`;
            }
          }
        }
      } catch {
        // Strategy failed, continue with others
      }
    }

    // Sort by score and limit
    return recommendations.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * Get delegation history
   */
  getHistory(taskId?: string): DelegationHistoryEntry[] {
    if (taskId) {
      return this.history.filter((h) => h.taskId === taskId);
    }
    return [...this.history];
  }

  /**
   * Get delegation statistics
   */
  getStatistics(): {
    totalDelegations: number;
    byStrategy: Record<string, number>;
    averageConfidence: number;
    averageAttempts: number;
  } {
    const byStrategy: Record<string, number> = {};
    let totalConfidence = 0;
    let totalAttempts = 0;

    for (const entry of this.history) {
      byStrategy[entry.strategy] = (byStrategy[entry.strategy] ?? 0) + 1;
      totalConfidence += entry.result.confidence;
      totalAttempts += entry.attempt;
    }

    return {
      totalDelegations: this.history.length,
      byStrategy,
      averageConfidence:
        this.history.length > 0 ? totalConfidence / this.history.length : 0,
      averageAttempts:
        this.history.length > 0 ? totalAttempts / this.history.length : 0,
    };
  }

  /**
   * Clear delegation history
   */
  clearHistory(): void {
    this.history.length = 0;
  }

  /**
   * Reset all strategies
   */
  reset(): void {
    for (const strategy of this.strategies.values()) {
      strategy.reset?.();
    }
    this.clearHistory();
  }

  /**
   * Build the strategy order for delegation
   */
  private buildStrategyOrder(
    primary: DelegationStrategyType,
  ): DelegationStrategyType[] {
    const order: DelegationStrategyType[] = [primary];

    if (this.enableFallback) {
      for (const fallback of this.fallbackOrder) {
        if (!order.includes(fallback)) {
          order.push(fallback);
        }
      }
    }

    return order;
  }
}

/**
 * Factory function
 */
export function createDelegationCoordinator(
  config?: DelegationCoordinatorConfig,
): DelegationCoordinator {
  return new DelegationCoordinator(config);
}

export default DelegationCoordinator;
