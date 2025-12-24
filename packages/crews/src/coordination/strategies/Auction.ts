/**
 * Auction Strategy
 *
 * Agents bid on tasks, highest confidence wins.
 */

import type { TaskConfig } from '../../types';
import { AgentCapabilities, type CrewAgent, type TaskBid } from '../../agents';
import type { ExecutionContext } from '../../core';
import {
  BaseDelegationStrategy,
  type DelegationResult,
} from './DelegationStrategy';

/**
 * Auction strategy configuration
 */
export interface AuctionConfig {
  /** Time to wait for bids (ms) */
  biddingTimeMs?: number;
  /** Minimum bid confidence to accept */
  minimumBid?: number;
  /** Selection criteria */
  selectionCriteria?: 'confidence' | 'fastest' | 'cheapest';
  /** Allow agents to update bids */
  allowRebidding?: boolean;
  /** Timeout for individual bids (ms) */
  bidTimeoutMs?: number;
}

/**
 * Auction-based delegation strategy
 */
export class AuctionStrategy extends BaseDelegationStrategy {
  readonly name = 'auction' as const;

  private readonly biddingTimeMs: number;
  private readonly minimumBid: number;
  private readonly selectionCriteria: 'confidence' | 'fastest' | 'cheapest';
  private readonly allowRebidding: boolean;
  private readonly bidTimeoutMs: number;

  constructor(config: AuctionConfig = {}) {
    super();
    this.biddingTimeMs = config.biddingTimeMs ?? 5000;
    this.minimumBid = config.minimumBid ?? 0.1;
    this.selectionCriteria = config.selectionCriteria ?? 'confidence';
    this.allowRebidding = config.allowRebidding ?? false;
    this.bidTimeoutMs = config.bidTimeoutMs ?? 2000;
  }

  async selectAgent(
    task: TaskConfig,
    agents: CrewAgent[],
    context: ExecutionContext,
  ): Promise<DelegationResult> {
    const startTime = Date.now();

    if (agents.length === 0) {
      this.createFailure('No agents available', []);
    }

    // Filter to available agents
    let available = this.filterAvailable(agents);

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

    // Collect bids from all agents
    const bids = await this.collectBids(task, available);

    if (bids.length === 0) {
      this.createFailure('No agents submitted bids', agents);
    }

    // Filter by minimum bid
    const qualifiedBids = bids.filter((b) => b.confidence >= this.minimumBid);

    if (qualifiedBids.length === 0) {
      this.createFailure(
        `No bids met minimum threshold (${this.minimumBid})`,
        agents,
      );
    }

    // Select winner based on criteria
    const winner = this.selectWinner(qualifiedBids);

    // Emit auction event
    context.emit({
      type: 'delegation:decision',
      taskId: task.id!,
      toAgent: winner.agentName,
      strategy: 'auction',
      reason: `Won auction with confidence ${winner.confidence.toFixed(2)}`,
      confidence: winner.confidence,
      alternatives: qualifiedBids
        .filter((b) => b.agentName !== winner.agentName)
        .map((b) => b.agentName),
    });

    return {
      selectedAgent: winner.agentName,
      reason: this.buildReason(winner, qualifiedBids),
      confidence: winner.confidence,
      alternativeAgents: qualifiedBids
        .filter((b) => b.agentName !== winner.agentName)
        .map((b) => b.agentName),
      decisionTimeMs: Date.now() - startTime,
      metadata: {
        strategy: 'auction',
        totalBids: bids.length,
        qualifiedBids: qualifiedBids.length,
        winningBid: winner,
        allBids: bids,
      },
    };
  }

  /**
   * Collect bids from agents
   */
  private async collectBids(
    task: TaskConfig,
    agents: CrewAgent[],
  ): Promise<TaskBid[]> {
    const bidPromises = agents.map((agent) =>
      this.getBidWithTimeout(agent, task),
    );

    // Wait for all bids (with timeout)
    const results = await Promise.allSettled(bidPromises);

    // Collect successful bids
    const bids: TaskBid[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        bids.push(result.value);
      }
    }

    return bids;
  }

  /**
   * Get a bid from an agent with timeout
   */
  private async getBidWithTimeout(
    agent: CrewAgent,
    task: TaskConfig,
  ): Promise<TaskBid | null> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(null), this.bidTimeoutMs);

      agent
        .bidOnTask(task)
        .then((bid) => {
          clearTimeout(timeout);
          resolve(bid);
        })
        .catch(() => {
          clearTimeout(timeout);
          resolve(null);
        });
    });
  }

  /**
   * Select the winning bid
   */
  private selectWinner(bids: TaskBid[]): TaskBid {
    switch (this.selectionCriteria) {
      case 'fastest':
        // Prefer lowest estimated time
        return bids.reduce((best, bid) => {
          const bestTime = best.estimatedTime ?? Infinity;
          const bidTime = bid.estimatedTime ?? Infinity;
          return bidTime < bestTime ? bid : best;
        }, bids[0]);

      case 'cheapest':
        // For now, use fastest as proxy for cheapest
        return bids.reduce((best, bid) => {
          const bestTime = best.estimatedTime ?? Infinity;
          const bidTime = bid.estimatedTime ?? Infinity;
          return bidTime < bestTime ? bid : best;
        }, bids[0]);

      case 'confidence':
      default:
        // Highest confidence wins
        return bids.reduce(
          (best, bid) => (bid.confidence > best.confidence ? bid : best),
          bids[0],
        );
    }
  }

  /**
   * Build explanation for auction result
   */
  private buildReason(winner: TaskBid, allBids: TaskBid[]): string {
    const parts: string[] = [];

    parts.push(`Won auction (${this.selectionCriteria} criteria)`);
    parts.push(`Confidence: ${(winner.confidence * 100).toFixed(1)}%`);

    if (winner.estimatedTime) {
      parts.push(`Est. time: ${winner.estimatedTime}ms`);
    }

    parts.push(`Capabilities: ${winner.capabilities.join(', ')}`);

    if (allBids.length > 1) {
      parts.push(`Competed against ${allBids.length - 1} other bid(s)`);
    }

    return parts.join('. ');
  }

  /**
   * Run a multi-round auction with rebidding
   */
  async runMultiRoundAuction(
    task: TaskConfig,
    agents: CrewAgent[],
    rounds: number = 2,
  ): Promise<TaskBid[]> {
    let currentBids = await this.collectBids(task, agents);

    if (!this.allowRebidding || rounds <= 1) {
      return currentBids;
    }

    for (let round = 1; round < rounds; round++) {
      // Share current best bid
      const currentBest = currentBids.reduce(
        (best, bid) => (bid.confidence > best.confidence ? bid : best),
        currentBids[0],
      );

      // Let agents rebid knowing the current best
      const rebidPromises = agents.map(async (agent) => {
        const currentBid = currentBids.find((b) => b.agentName === agent.name);
        if (!currentBid) return null;

        // Only rebid if not already the leader
        if (currentBid.agentName === currentBest.agentName) {
          return currentBid;
        }

        // Get new bid
        return this.getBidWithTimeout(agent, task);
      });

      const results = await Promise.allSettled(rebidPromises);
      currentBids = results
        .filter((r) => r.status === 'fulfilled' && r.value)
        .map((r) => (r as PromiseFulfilledResult<TaskBid>).value);
    }

    return currentBids;
  }
}

/**
 * Factory function
 */
export function createAuctionStrategy(config?: AuctionConfig): AuctionStrategy {
  return new AuctionStrategy(config);
}

export default AuctionStrategy;
