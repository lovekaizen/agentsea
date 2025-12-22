/**
 * Consensus Strategy
 *
 * Multi-agent voting to decide task assignment.
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
 * Vote from an agent
 */
export interface Vote {
  /** Voting agent */
  voter: string;
  /** Candidate agent being voted for */
  candidate: string;
  /** Vote weight (default 1) */
  weight: number;
  /** Reasoning for the vote */
  reasoning?: string;
}

/**
 * Consensus strategy configuration
 */
export interface ConsensusConfig {
  /** Required agreement ratio (0-1) */
  requiredAgreement?: number;
  /** Maximum voting rounds */
  maxRounds?: number;
  /** Tie breaker method */
  tieBreaker?: 'random' | 'first' | 'manager' | 'highest-capability';
  /** Timeout for voting (ms) */
  voteTimeoutMs?: number;
  /** Weight votes by agent authority/experience */
  weightedVoting?: boolean;
  /** Minimum votes required */
  minimumVotes?: number;
}

/**
 * Voting round result
 */
export interface VotingRound {
  round: number;
  votes: Vote[];
  tally: Map<string, number>;
  winner?: string;
  consensusReached: boolean;
  agreementRatio: number;
}

/**
 * Consensus-based delegation strategy
 */
export class ConsensusStrategy extends BaseDelegationStrategy {
  readonly name = 'consensus' as const;

  private readonly requiredAgreement: number;
  private readonly maxRounds: number;
  private readonly tieBreaker:
    | 'random'
    | 'first'
    | 'manager'
    | 'highest-capability';
  private readonly voteTimeoutMs: number;
  private readonly weightedVoting: boolean;
  private readonly minimumVotes: number;

  constructor(config: ConsensusConfig = {}) {
    super();
    this.requiredAgreement = config.requiredAgreement ?? 0.5;
    this.maxRounds = config.maxRounds ?? 3;
    this.tieBreaker = config.tieBreaker ?? 'highest-capability';
    this.voteTimeoutMs = config.voteTimeoutMs ?? 3000;
    this.weightedVoting = config.weightedVoting ?? false;
    this.minimumVotes = config.minimumVotes ?? 1;
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

    // Get available candidates
    const candidates = this.filterAvailable(agents);
    if (candidates.length === 0) {
      this.createFailure('All agents are busy', agents);
    }

    // If only one candidate, no voting needed
    if (candidates.length === 1) {
      return {
        selectedAgent: candidates[0].name,
        reason: 'Only one candidate available',
        confidence: 1.0,
        decisionTimeMs: Date.now() - startTime,
        metadata: {
          strategy: 'consensus',
          noVotingNeeded: true,
        },
      };
    }

    // Run voting rounds
    let finalResult: VotingRound | undefined;
    const allRounds: VotingRound[] = [];

    for (let round = 1; round <= this.maxRounds; round++) {
      const roundResult = await this.runVotingRound(
        round,
        task,
        agents,
        candidates,
        context,
      );
      allRounds.push(roundResult);

      if (roundResult.consensusReached || roundResult.winner) {
        finalResult = roundResult;
        break;
      }
    }

    // If no consensus after max rounds, use tie breaker
    if (!finalResult?.winner) {
      const lastRound = allRounds[allRounds.length - 1];
      const winner = this.breakTie(lastRound.tally, candidates, task);

      return {
        selectedAgent: winner.name,
        reason: `No consensus after ${this.maxRounds} rounds, resolved by ${this.tieBreaker}`,
        confidence: lastRound.agreementRatio,
        alternativeAgents: candidates
          .filter((c) => c.name !== winner.name)
          .map((c) => c.name),
        decisionTimeMs: Date.now() - startTime,
        metadata: {
          strategy: 'consensus',
          rounds: allRounds.length,
          consensusReached: false,
          tieBreaker: this.tieBreaker,
          finalTally: Object.fromEntries(lastRound.tally),
        },
      };
    }

    return {
      selectedAgent: finalResult.winner,
      reason: `Consensus reached in round ${finalResult.round} with ${(finalResult.agreementRatio * 100).toFixed(1)}% agreement`,
      confidence: finalResult.agreementRatio,
      alternativeAgents: candidates
        .filter((c) => c.name !== finalResult.winner)
        .map((c) => c.name),
      decisionTimeMs: Date.now() - startTime,
      metadata: {
        strategy: 'consensus',
        rounds: allRounds.length,
        consensusReached: true,
        finalRound: finalResult,
        allRounds,
      },
    };
  }

  /**
   * Run a single voting round
   */
  private async runVotingRound(
    round: number,
    task: TaskConfig,
    voters: CrewAgent[],
    candidates: CrewAgent[],
    _context: ExecutionContext,
  ): Promise<VotingRound> {
    // Collect votes from all agents
    const votes = await this.collectVotes(task, voters, candidates);

    // Tally votes
    const tally = this.tallyVotes(votes);

    // Check for consensus
    const totalWeight = votes.reduce((sum, v) => sum + v.weight, 0);
    const maxVotes = Math.max(...Array.from(tally.values()));
    const agreementRatio = totalWeight > 0 ? maxVotes / totalWeight : 0;
    const consensusReached = agreementRatio >= this.requiredAgreement;

    // Find winner if consensus reached
    let winner: string | undefined;
    if (consensusReached) {
      for (const [candidate, voteCount] of tally) {
        if (voteCount === maxVotes) {
          winner = candidate;
          break;
        }
      }
    }

    return {
      round,
      votes,
      tally,
      winner,
      consensusReached,
      agreementRatio,
    };
  }

  /**
   * Collect votes from agents
   */
  private async collectVotes(
    task: TaskConfig,
    voters: CrewAgent[],
    candidates: CrewAgent[],
  ): Promise<Vote[]> {
    const votes: Vote[] = [];
    const candidateNames = candidates.map((c) => c.name);

    for (const voter of voters) {
      const vote = await this.getVote(voter, task, candidateNames);
      if (vote) {
        votes.push(vote);
      }
    }

    return votes;
  }

  /**
   * Get a vote from an agent
   */
  private getVote(
    voter: CrewAgent,
    task: TaskConfig,
    candidates: string[],
  ): Promise<Vote | null> {
    // For now, simulate voting based on capability matching
    // In a real implementation, this could ask the LLM to vote

    // Calculate scores for each candidate
    const scores: Array<{ name: string; score: number }> = [];
    for (const candidateName of candidates) {
      // Self-vote with slight bias
      if (candidateName === voter.name) {
        scores.push({ name: candidateName, score: 0.7 });
      } else {
        // Random factor for diversity
        const randomFactor = 0.8 + Math.random() * 0.4;
        scores.push({
          name: candidateName,
          score: Math.random() * randomFactor,
        });
      }
    }

    // Sort by score
    scores.sort((a, b) => b.score - a.score);

    // Vote for top candidate
    const selected = scores[0];
    if (!selected) return null;

    // Calculate weight
    let weight = 1;
    if (this.weightedVoting) {
      // Weight by capability score
      weight = voter.calculateTaskScore(task) || 0.5;
    }

    return Promise.resolve({
      voter: voter.name,
      candidate: selected.name,
      weight,
      reasoning: `Selected based on perceived suitability (score: ${selected.score.toFixed(2)})`,
    });
  }

  /**
   * Tally votes
   */
  private tallyVotes(votes: Vote[]): Map<string, number> {
    const tally = new Map<string, number>();

    for (const vote of votes) {
      const current = tally.get(vote.candidate) ?? 0;
      tally.set(vote.candidate, current + vote.weight);
    }

    return tally;
  }

  /**
   * Break a tie between candidates
   */
  private breakTie(
    tally: Map<string, number>,
    candidates: CrewAgent[],
    task: TaskConfig,
  ): CrewAgent {
    // Get tied candidates
    const maxVotes = Math.max(...Array.from(tally.values()));
    const tied = candidates.filter(
      (c) => (tally.get(c.name) ?? 0) === maxVotes,
    );

    if (tied.length === 1) {
      return tied[0];
    }

    switch (this.tieBreaker) {
      case 'random':
        return tied[Math.floor(Math.random() * tied.length)];

      case 'first':
        return tied[0];

      case 'manager':
        // Find first manager in tied candidates
        for (const candidate of tied) {
          if (candidate.role.canDelegate) {
            return candidate;
          }
        }
        return tied[0];

      case 'highest-capability':
      default: {
        // Select by capability score
        const ranked = AgentCapabilities.rank(tied, task);
        if (ranked.length > 0) {
          const best = tied.find((c) => c.name === ranked[0].agentName);
          if (best) return best;
        }
        return tied[0];
      }
    }
  }

  /**
   * Run a full consensus process with deliberation
   */
  async runWithDeliberation(
    task: TaskConfig,
    agents: CrewAgent[],
    context: ExecutionContext,
  ): Promise<{
    result: DelegationResult;
    deliberation: VotingRound[];
    consensus: boolean;
  }> {
    const startTime = Date.now();
    const candidates = this.filterAvailable(agents);
    const allRounds: VotingRound[] = [];
    let consensusReached = false;

    for (let round = 1; round <= this.maxRounds; round++) {
      const roundResult = await this.runVotingRound(
        round,
        task,
        agents,
        candidates,
        context,
      );
      allRounds.push(roundResult);

      // Emit event for transparency
      context.emit({
        type: 'delegation:decision',
        taskId: task.id!,
        toAgent: roundResult.winner ?? '',
        strategy: 'consensus',
        reason: `Round ${round}: ${roundResult.consensusReached ? 'consensus' : 'no consensus'}`,
        confidence: roundResult.agreementRatio,
      });

      if (roundResult.consensusReached && roundResult.winner) {
        consensusReached = true;
        break;
      }
    }

    const lastRound = allRounds[allRounds.length - 1];
    const winner =
      lastRound.winner ?? this.breakTie(lastRound.tally, candidates, task).name;

    return {
      result: {
        selectedAgent: winner,
        reason: consensusReached
          ? `Consensus reached after ${allRounds.length} round(s)`
          : `No consensus, resolved by ${this.tieBreaker}`,
        confidence: lastRound.agreementRatio,
        decisionTimeMs: Date.now() - startTime,
        metadata: {
          strategy: 'consensus',
          rounds: allRounds.length,
          consensusReached,
        },
      },
      deliberation: allRounds,
      consensus: consensusReached,
    };
  }
}

/**
 * Factory function
 */
export function createConsensusStrategy(
  config?: ConsensusConfig,
): ConsensusStrategy {
  return new ConsensusStrategy(config);
}

export default ConsensusStrategy;
