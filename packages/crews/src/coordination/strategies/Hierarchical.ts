/**
 * Hierarchical Strategy
 *
 * Manager-worker delegation with authority levels.
 */

import type { TaskConfig } from '../../types';
import type { CrewAgent } from '../../agents';
import type { ExecutionContext } from '../../core';
import { AgentCapabilities } from '../../agents';
import {
  BaseDelegationStrategy,
  type DelegationResult,
} from './DelegationStrategy';

/**
 * Agent hierarchy definition
 */
export interface AgentHierarchy {
  /** Manager agent names (highest authority) */
  managers: string[];
  /** Map of manager to their workers */
  workers: Map<string, string[]>;
  /** Authority levels (higher = more authority) */
  authorityLevels?: Map<string, number>;
}

/**
 * Hierarchical strategy configuration
 */
export interface HierarchicalConfig {
  /** Agent hierarchy */
  hierarchy?: AgentHierarchy;
  /** Allow managers to handle tasks directly */
  managersCanExecute?: boolean;
  /** Escalate to manager if no worker available */
  escalateToManager?: boolean;
  /** Use capability matching for worker selection */
  useCapabilityMatching?: boolean;
}

/**
 * Hierarchical delegation strategy
 */
export class HierarchicalStrategy extends BaseDelegationStrategy {
  readonly name = 'hierarchical' as const;

  private hierarchy: AgentHierarchy;
  private readonly managersCanExecute: boolean;
  private readonly escalateToManager: boolean;
  private readonly useCapabilityMatching: boolean;

  constructor(config: HierarchicalConfig = {}) {
    super();
    this.hierarchy = config.hierarchy ?? {
      managers: [],
      workers: new Map(),
    };
    this.managersCanExecute = config.managersCanExecute ?? false;
    this.escalateToManager = config.escalateToManager ?? true;
    this.useCapabilityMatching = config.useCapabilityMatching ?? true;
  }

  /**
   * Set the hierarchy
   */
  setHierarchy(hierarchy: AgentHierarchy): void {
    this.hierarchy = hierarchy;
  }

  /**
   * Add a manager
   */
  addManager(managerName: string, workers: string[] = []): void {
    if (!this.hierarchy.managers.includes(managerName)) {
      this.hierarchy.managers.push(managerName);
    }
    this.hierarchy.workers.set(managerName, workers);
  }

  /**
   * Add a worker to a manager
   */
  addWorker(managerName: string, workerName: string): void {
    const workers = this.hierarchy.workers.get(managerName) ?? [];
    if (!workers.includes(workerName)) {
      workers.push(workerName);
      this.hierarchy.workers.set(managerName, workers);
    }
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

    // Build agent lookup
    const agentMap = new Map<string, CrewAgent>();
    for (const agent of agents) {
      agentMap.set(agent.name, agent);
    }

    // Auto-detect hierarchy if not set
    if (this.hierarchy.managers.length === 0) {
      this.autoDetectHierarchy(agents);
    }

    // Find the appropriate manager for this task
    const manager = this.findManagerForTask(task, agents);

    if (!manager) {
      // No hierarchy - fall back to best match
      return this.fallbackSelection(task, agents, startTime);
    }

    // Get manager's workers
    const workerNames = this.hierarchy.workers.get(manager.name) ?? [];
    const workers = workerNames
      .map((name) => agentMap.get(name))
      .filter((w): w is CrewAgent => w !== undefined);

    // Find available workers
    const availableWorkers = workers.filter((w) => !w.isBusy);

    if (availableWorkers.length > 0) {
      // Select best worker
      const selectedWorker = this.selectWorker(task, availableWorkers);

      return {
        selectedAgent: selectedWorker.name,
        reason: `Delegated by ${manager.name} (hierarchical)`,
        confidence: AgentCapabilities.calculateAgentScore(selectedWorker, task),
        alternativeAgents: availableWorkers
          .filter((w) => w.name !== selectedWorker.name)
          .map((w) => w.name),
        decisionTimeMs: Date.now() - startTime,
        metadata: {
          strategy: 'hierarchical',
          manager: manager.name,
          delegatedTo: selectedWorker.name,
          totalWorkers: workers.length,
          availableWorkers: availableWorkers.length,
        },
      };
    }

    // No workers available - check if manager can handle it
    if (this.managersCanExecute && !manager.isBusy) {
      return {
        selectedAgent: manager.name,
        reason: 'No workers available, manager handling directly',
        confidence: AgentCapabilities.calculateAgentScore(manager, task),
        decisionTimeMs: Date.now() - startTime,
        metadata: {
          strategy: 'hierarchical',
          manager: manager.name,
          escalated: true,
          reason: 'no_available_workers',
        },
      };
    }

    // Check other managers
    if (this.escalateToManager) {
      for (const managerName of this.hierarchy.managers) {
        if (managerName === manager.name) continue;

        const otherManager = agentMap.get(managerName);
        if (otherManager && !otherManager.isBusy) {
          const otherWorkerNames =
            this.hierarchy.workers.get(managerName) ?? [];
          const otherWorkers = otherWorkerNames
            .map((name) => agentMap.get(name))
            .filter((w): w is CrewAgent => w !== undefined && !w.isBusy);

          if (otherWorkers.length > 0) {
            const selectedWorker = this.selectWorker(task, otherWorkers);
            return {
              selectedAgent: selectedWorker.name,
              reason: `Escalated to ${managerName}, delegated to ${selectedWorker.name}`,
              confidence: AgentCapabilities.calculateAgentScore(
                selectedWorker,
                task,
              ),
              decisionTimeMs: Date.now() - startTime,
              metadata: {
                strategy: 'hierarchical',
                originalManager: manager.name,
                escalatedTo: managerName,
                delegatedTo: selectedWorker.name,
              },
            };
          }
        }
      }
    }

    this.createFailure('No available agents in hierarchy', agents);
  }

  /**
   * Auto-detect hierarchy based on agent roles
   */
  private autoDetectHierarchy(agents: CrewAgent[]): void {
    const managers: string[] = [];
    const workers: string[] = [];

    for (const agent of agents) {
      // Check if agent's role suggests manager status
      const roleName = agent.role.name.toLowerCase();
      const isManager =
        roleName.includes('manager') ||
        roleName.includes('lead') ||
        roleName.includes('supervisor') ||
        roleName.includes('director') ||
        agent.role.canDelegate;

      if (isManager) {
        managers.push(agent.name);
      } else {
        workers.push(agent.name);
      }
    }

    // If no managers found, make first agent the manager
    if (managers.length === 0 && agents.length > 0) {
      managers.push(agents[0].name);
      workers.splice(workers.indexOf(agents[0].name), 1);
    }

    // Assign all workers to first manager for now
    this.hierarchy = {
      managers,
      workers: new Map([[managers[0], workers]]),
    };
  }

  /**
   * Find the best manager for a task
   */
  private findManagerForTask(
    task: TaskConfig,
    agents: CrewAgent[],
  ): CrewAgent | undefined {
    const agentMap = new Map<string, CrewAgent>();
    for (const agent of agents) {
      agentMap.set(agent.name, agent);
    }

    // Find manager with workers that can handle this task
    let bestManager: CrewAgent | undefined;
    let bestScore = 0;

    for (const managerName of this.hierarchy.managers) {
      const manager = agentMap.get(managerName);
      if (!manager) continue;

      // Score based on workers' capabilities
      const workerNames = this.hierarchy.workers.get(managerName) ?? [];
      let totalScore = 0;

      for (const workerName of workerNames) {
        const worker = agentMap.get(workerName);
        if (worker) {
          totalScore += AgentCapabilities.calculateAgentScore(worker, task);
        }
      }

      const avgScore =
        workerNames.length > 0 ? totalScore / workerNames.length : 0;

      if (avgScore > bestScore) {
        bestScore = avgScore;
        bestManager = manager;
      }
    }

    return bestManager;
  }

  /**
   * Select the best worker for a task
   */
  private selectWorker(task: TaskConfig, workers: CrewAgent[]): CrewAgent {
    if (!this.useCapabilityMatching) {
      return workers[0];
    }

    const ranked = AgentCapabilities.rank(workers, task);
    if (ranked.length > 0) {
      const best = workers.find((w) => w.name === ranked[0].agentName);
      if (best) return best;
    }

    return workers[0];
  }

  /**
   * Fallback to simple best-match selection
   */
  private fallbackSelection(
    task: TaskConfig,
    agents: CrewAgent[],
    startTime: number,
  ): Promise<DelegationResult> {
    const available = this.filterAvailable(agents);
    if (available.length === 0) {
      this.createFailure('No available agents', agents);
    }

    const ranked = AgentCapabilities.rank(available, task);
    const selected =
      available.find((a) => a.name === ranked[0]?.agentName) ?? available[0];

    return Promise.resolve({
      selectedAgent: selected.name,
      reason: 'No hierarchy defined, using best match',
      confidence: AgentCapabilities.calculateAgentScore(selected, task),
      alternativeAgents: available
        .filter((a) => a.name !== selected.name)
        .map((a) => a.name),
      decisionTimeMs: Date.now() - startTime,
      metadata: {
        strategy: 'hierarchical',
        fallback: true,
      },
    });
  }

  reset(): void {
    // Keep hierarchy but could reset state if needed
  }

  /**
   * Get current hierarchy
   */
  getHierarchy(): AgentHierarchy {
    return {
      managers: [...this.hierarchy.managers],
      workers: new Map(this.hierarchy.workers),
    };
  }
}

/**
 * Factory function
 */
export function createHierarchicalStrategy(
  config?: HierarchicalConfig,
): HierarchicalStrategy {
  return new HierarchicalStrategy(config);
}

export default HierarchicalStrategy;
