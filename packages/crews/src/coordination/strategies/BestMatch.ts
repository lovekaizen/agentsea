/**
 * BestMatch Strategy
 *
 * Capability-based matching to find the best agent for each task.
 */

import type { TaskConfig, RankedAgent } from '../../types';
import { AgentCapabilities, type CrewAgent } from '../../agents';
import type { ExecutionContext } from '../../core';
import {
  BaseDelegationStrategy,
  type DelegationResult,
} from './DelegationStrategy';

/**
 * Best-match strategy configuration
 */
export interface BestMatchConfig {
  /** Minimum score required for selection */
  minimumScore?: number;
  /** Consider keyword matching in task description */
  useKeywordMatching?: boolean;
  /** Weight for capability score (vs availability) */
  capabilityWeight?: number;
  /** Prefer available agents over better matches */
  preferAvailable?: boolean;
}

/**
 * Best-match delegation strategy
 */
export class BestMatchStrategy extends BaseDelegationStrategy {
  readonly name = 'best-match' as const;

  private readonly minimumScore: number;
  private readonly useKeywordMatching: boolean;
  private readonly capabilityWeight: number;
  private readonly preferAvailable: boolean;

  constructor(config: BestMatchConfig = {}) {
    super();
    this.minimumScore = config.minimumScore ?? 0;
    this.useKeywordMatching = config.useKeywordMatching ?? true;
    this.capabilityWeight = config.capabilityWeight ?? 0.7;
    this.preferAvailable = config.preferAvailable ?? true;
  }

  selectAgent(
    task: TaskConfig,
    agents: CrewAgent[],
    _context: ExecutionContext,
  ): Promise<DelegationResult> {
    const startTime = Date.now();

    if (agents.length === 0) {
      this.createFailure('No agents available', []);
    }

    // Rank all agents for this task
    const ranked = this.rankAgents(task, agents);

    if (ranked.length === 0) {
      this.createFailure('No agents can handle this task', agents);
    }

    // Filter by minimum score
    const qualified = ranked.filter((r) => r.score >= this.minimumScore);

    if (qualified.length === 0) {
      this.createFailure(
        `No agents meet minimum score threshold (${this.minimumScore})`,
        agents,
      );
    }

    // Prefer available agents if configured
    let selected = qualified[0];
    if (this.preferAvailable) {
      const availableQualified = qualified.filter(
        (r) => !agents.find((a) => a.name === r.agentName)?.isBusy,
      );
      if (availableQualified.length > 0) {
        selected = availableQualified[0];
      }
    }

    // Build reason
    const reason = this.buildReason(selected, task);

    return Promise.resolve({
      selectedAgent: selected.agentName,
      reason,
      confidence: selected.score,
      alternativeAgents: qualified
        .filter((r) => r.agentName !== selected.agentName)
        .slice(0, 3)
        .map((r) => r.agentName),
      decisionTimeMs: Date.now() - startTime,
      metadata: {
        strategy: 'best-match',
        score: selected.score,
        matchedCapabilities: selected.matchedCapabilities.map((c) => c.name),
        missingCapabilities: selected.missingCapabilities.map((c) => c.name),
        rankedCount: qualified.length,
      },
    });
  }

  /**
   * Rank agents for a task
   */
  private rankAgents(task: TaskConfig, agents: CrewAgent[]): RankedAgent[] {
    const rankings: RankedAgent[] = [];

    for (const agent of agents) {
      // Get capability match
      const capScore = AgentCapabilities.calculateAgentScore(agent, task);

      // Add keyword matching if enabled
      let finalScore = capScore;
      if (this.useKeywordMatching) {
        const keywordScore = agent.role.calculateRelevanceScore(
          task.description,
        );
        finalScore =
          capScore * this.capabilityWeight +
          keywordScore * (1 - this.capabilityWeight);
      }

      // Reduce score if agent is busy
      if (agent.isBusy) {
        finalScore *= 0.5;
      }

      // Get capability details
      const requiredCaps = (task.requiredCapabilities ?? []).map((name) => ({
        name,
        description: '',
        proficiency: 'intermediate' as const,
      }));
      const match = AgentCapabilities.match(requiredCaps, agent.capabilities);

      rankings.push({
        agentName: agent.name,
        score: finalScore,
        matchedCapabilities: match.matched,
        missingCapabilities: match.missing,
      });
    }

    // Sort by score descending
    rankings.sort((a, b) => b.score - a.score);

    return rankings;
  }

  /**
   * Build explanation for selection
   */
  private buildReason(selected: RankedAgent, _task: TaskConfig): string {
    const parts: string[] = [];

    parts.push(`Best match with score ${(selected.score * 100).toFixed(1)}%`);

    if (selected.matchedCapabilities.length > 0) {
      const capNames = selected.matchedCapabilities
        .map((c) => c.name)
        .join(', ');
      parts.push(`Matched capabilities: ${capNames}`);
    }

    if (selected.missingCapabilities.length > 0) {
      const missingNames = selected.missingCapabilities
        .map((c) => c.name)
        .join(', ');
      parts.push(`Missing: ${missingNames}`);
    }

    return parts.join('. ');
  }

  /**
   * Find agents that can definitely handle a task
   */
  findCapableAgents(task: TaskConfig, agents: CrewAgent[]): CrewAgent[] {
    const ranked = this.rankAgents(task, agents);
    return ranked
      .filter(
        (r) =>
          r.missingCapabilities.length === 0 && r.score >= this.minimumScore,
      )
      .map((r) => agents.find((a) => a.name === r.agentName)!)
      .filter(Boolean);
  }
}

/**
 * Factory function
 */
export function createBestMatchStrategy(
  config?: BestMatchConfig,
): BestMatchStrategy {
  return new BestMatchStrategy(config);
}

export default BestMatchStrategy;
