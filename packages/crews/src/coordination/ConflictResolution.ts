/**
 * Conflict Resolution
 *
 * Handles disagreements and conflicts between agents.
 */

import type { ExecutionContext } from '../core';
import type { TaskConfig } from '../types';

/**
 * Conflict types
 */
export type ConflictType =
  | 'disagreement' // Agents disagree on approach or answer
  | 'resource' // Multiple agents want same resource
  | 'priority' // Conflicting task priorities
  | 'dependency' // Circular or conflicting dependencies
  | 'output' // Incompatible outputs
  | 'assertion'; // Contradictory assertions

/**
 * Agent response for conflict detection
 */
export interface AgentResponse {
  agentName: string;
  content: string;
  confidence: number;
  reasoning?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Conflict definition
 */
export interface Conflict {
  id: string;
  type: ConflictType;
  description: string;
  participants: string[];
  responses: AgentResponse[];
  task?: TaskConfig;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detected: Date;
}

/**
 * Resolution strategy
 */
export type ResolutionStrategy =
  | 'voting' // Agents vote on correct answer
  | 'authority' // Higher authority agent decides
  | 'consensus' // Reach consensus through discussion
  | 'merge' // Merge compatible responses
  | 'human' // Escalate to human
  | 'newest' // Use most recent response
  | 'highest-confidence'; // Use response with highest confidence

/**
 * Resolution result
 */
export interface Resolution {
  conflictId: string;
  strategy: ResolutionStrategy;
  winner?: AgentResponse;
  merged?: string;
  explanation: string;
  successful: boolean;
  escalated: boolean;
  resolved: Date;
}

/**
 * Conflict resolver configuration
 */
export interface ConflictResolverConfig {
  /** Default resolution strategy */
  defaultStrategy?: ResolutionStrategy;
  /** Minimum confidence difference to auto-resolve */
  autoResolveThreshold?: number;
  /** Enable automatic conflict detection */
  autoDetect?: boolean;
  /** Escalate on repeated conflicts */
  escalateOnRepeated?: number;
  /** Track resolution history */
  trackHistory?: boolean;
}

/**
 * Conflict resolver
 *
 * Detects and resolves conflicts between agent responses.
 */
export class ConflictResolver {
  private readonly config: Required<ConflictResolverConfig>;
  private readonly history: Resolution[] = [];
  private readonly conflictCounts: Map<string, number> = new Map();
  private conflictCounter = 0;

  constructor(config: ConflictResolverConfig = {}) {
    this.config = {
      defaultStrategy: config.defaultStrategy ?? 'highest-confidence',
      autoResolveThreshold: config.autoResolveThreshold ?? 0.3,
      autoDetect: config.autoDetect ?? true,
      escalateOnRepeated: config.escalateOnRepeated ?? 3,
      trackHistory: config.trackHistory ?? true,
    };
  }

  /**
   * Detect conflicts between agent responses
   */
  detectConflict(
    responses: AgentResponse[],
    task: TaskConfig,
    context: ExecutionContext,
  ): Conflict | null {
    if (responses.length < 2) {
      return null;
    }

    // Check for disagreement
    const disagreement = this.detectDisagreement(responses);
    if (disagreement) {
      const conflict = this.createConflict(
        'disagreement',
        disagreement.description,
        responses,
        task,
        disagreement.severity,
      );

      context.emit({
        type: 'conflict:detected',
        conflictId: conflict.id,
        conflictType: 'disagreement',
        participants: conflict.participants,
        taskId: task.id,
      });

      return conflict;
    }

    // Check for contradictory assertions
    const contradiction = this.detectContradiction(responses);
    if (contradiction) {
      const conflict = this.createConflict(
        'assertion',
        contradiction.description,
        responses,
        task,
        contradiction.severity,
      );

      context.emit({
        type: 'conflict:detected',
        conflictId: conflict.id,
        conflictType: 'assertion',
        participants: conflict.participants,
        taskId: task.id,
      });

      return conflict;
    }

    return null;
  }

  /**
   * Resolve a conflict
   */
  async resolve(
    conflict: Conflict,
    context: ExecutionContext,
    strategy?: ResolutionStrategy,
  ): Promise<Resolution> {
    const resolveStrategy = strategy ?? this.config.defaultStrategy;

    // Check for repeated conflicts
    const conflictKey = `${conflict.type}-${conflict.participants.sort().join(',')}`;
    const repeatCount = (this.conflictCounts.get(conflictKey) ?? 0) + 1;
    this.conflictCounts.set(conflictKey, repeatCount);

    // Escalate if too many repeated conflicts
    if (repeatCount >= this.config.escalateOnRepeated) {
      return this.escalate(
        conflict,
        context,
        'Repeated conflicts between same agents',
      );
    }

    let resolution: Resolution;

    switch (resolveStrategy) {
      case 'voting':
        resolution = await this.resolveByVoting(conflict, context);
        break;

      case 'authority':
        resolution = await this.resolveByAuthority(conflict, context);
        break;

      case 'consensus':
        resolution = await this.resolveByConsensus(conflict, context);
        break;

      case 'merge':
        resolution = await this.resolveByMerge(conflict, context);
        break;

      case 'human':
        resolution = await this.escalate(
          conflict,
          context,
          'Human resolution requested',
        );
        break;

      case 'newest':
        resolution = this.resolveByNewest(conflict);
        break;

      case 'highest-confidence':
      default:
        resolution = this.resolveByConfidence(conflict);
        break;
    }

    // Track history
    if (this.config.trackHistory) {
      this.history.push(resolution);
    }

    // Emit resolution event
    context.emit({
      type: 'conflict:resolved',
      conflictId: conflict.id,
      strategy: resolveStrategy,
      winner: resolution.winner?.agentName,
      escalated: resolution.escalated,
    });

    return resolution;
  }

  /**
   * Create a conflict object
   */
  private createConflict(
    type: ConflictType,
    description: string,
    responses: AgentResponse[],
    task: TaskConfig,
    severity: Conflict['severity'],
  ): Conflict {
    return {
      id: `conflict-${++this.conflictCounter}`,
      type,
      description,
      participants: responses.map((r) => r.agentName),
      responses,
      task,
      severity,
      detected: new Date(),
    };
  }

  /**
   * Detect disagreement between responses
   */
  private detectDisagreement(
    responses: AgentResponse[],
  ): { description: string; severity: Conflict['severity'] } | null {
    // Calculate semantic similarity between responses
    // For now, use simple heuristics
    const contents = responses.map((r) => r.content.toLowerCase());

    // Check if responses have significantly different lengths
    const lengths = contents.map((c) => c.length);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const maxDiff = Math.max(...lengths.map((l) => Math.abs(l - avgLength)));

    if (maxDiff > avgLength * 0.5) {
      return {
        description: 'Responses have significantly different lengths',
        severity: 'low',
      };
    }

    // Check for contradictory keywords
    const contradictoryPairs = [
      ['yes', 'no'],
      ['true', 'false'],
      ['correct', 'incorrect'],
      ['should', 'should not'],
      ['can', 'cannot'],
      ['will', 'will not'],
      ['agree', 'disagree'],
    ];

    for (const [word1, word2] of contradictoryPairs) {
      const hasWord1 = contents.some((c) => c.includes(word1));
      const hasWord2 = contents.some((c) => c.includes(word2));

      if (hasWord1 && hasWord2) {
        return {
          description: `Contradictory statements detected (${word1} vs ${word2})`,
          severity: 'medium',
        };
      }
    }

    // Check confidence spread
    const confidences = responses.map((r) => r.confidence);
    const minConfidence = Math.min(...confidences);
    const maxConfidence = Math.max(...confidences);

    if (maxConfidence - minConfidence > this.config.autoResolveThreshold) {
      return {
        description: 'Large confidence spread between responses',
        severity: 'low',
      };
    }

    return null;
  }

  /**
   * Detect contradictory assertions
   */
  private detectContradiction(
    responses: AgentResponse[],
  ): { description: string; severity: Conflict['severity'] } | null {
    // Check for explicit contradictions in metadata
    for (let i = 0; i < responses.length; i++) {
      for (let j = i + 1; j < responses.length; j++) {
        const r1 = responses[i];
        const r2 = responses[j];

        // Check if both have assertions
        const assertions1 = r1.metadata?.assertions as string[] | undefined;
        const assertions2 = r2.metadata?.assertions as string[] | undefined;

        if (assertions1 && assertions2) {
          for (const a1 of assertions1) {
            for (const a2 of assertions2) {
              if (this.areContradictory(a1, a2)) {
                return {
                  description: `Contradictory assertions: "${a1}" vs "${a2}"`,
                  severity: 'high',
                };
              }
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Check if two assertions are contradictory
   */
  private areContradictory(a1: string, a2: string): boolean {
    const norm1 = a1.toLowerCase().trim();
    const norm2 = a2.toLowerCase().trim();

    // Direct negation
    if (norm1.startsWith('not ') && norm1.slice(4) === norm2) return true;
    if (norm2.startsWith('not ') && norm2.slice(4) === norm1) return true;

    return false;
  }

  /**
   * Resolve by highest confidence
   */
  private resolveByConfidence(conflict: Conflict): Resolution {
    const sorted = [...conflict.responses].sort(
      (a, b) => b.confidence - a.confidence,
    );
    const winner = sorted[0];

    return {
      conflictId: conflict.id,
      strategy: 'highest-confidence',
      winner,
      explanation: `Selected response with highest confidence (${(winner.confidence * 100).toFixed(1)}%)`,
      successful: true,
      escalated: false,
      resolved: new Date(),
    };
  }

  /**
   * Resolve by newest response
   */
  private resolveByNewest(conflict: Conflict): Resolution {
    // Assume responses are in order, take the last one
    const winner = conflict.responses[conflict.responses.length - 1];

    return {
      conflictId: conflict.id,
      strategy: 'newest',
      winner,
      explanation: 'Selected most recent response',
      successful: true,
      escalated: false,
      resolved: new Date(),
    };
  }

  /**
   * Resolve by voting
   */
  private resolveByVoting(
    conflict: Conflict,
    _context: ExecutionContext,
  ): Promise<Resolution> {
    // Simple voting: each response is a vote for itself
    // Weight by confidence
    const votes = new Map<string, number>();

    for (const response of conflict.responses) {
      const key = response.content.substring(0, 100); // Use first 100 chars as key
      const current = votes.get(key) ?? 0;
      votes.set(key, current + response.confidence);
    }

    // Find winner
    let maxVotes = 0;
    let winningKey = '';
    for (const [key, voteCount] of votes) {
      if (voteCount > maxVotes) {
        maxVotes = voteCount;
        winningKey = key;
      }
    }

    const winner = conflict.responses.find(
      (r) => r.content.substring(0, 100) === winningKey,
    );

    return Promise.resolve({
      conflictId: conflict.id,
      strategy: 'voting',
      winner,
      explanation: `Selected by weighted voting (${maxVotes.toFixed(2)} total weight)`,
      successful: !!winner,
      escalated: false,
      resolved: new Date(),
    });
  }

  /**
   * Resolve by authority
   */
  private resolveByAuthority(
    conflict: Conflict,
    _context: ExecutionContext,
  ): Promise<Resolution> {
    // Find response from agent with highest authority (by role)
    // For now, use confidence as proxy for authority
    return Promise.resolve(this.resolveByConfidence(conflict));
  }

  /**
   * Resolve by consensus
   */
  private resolveByConsensus(
    conflict: Conflict,
    _context: ExecutionContext,
  ): Promise<Resolution> {
    // Check if there's already majority agreement
    const contentGroups = new Map<string, AgentResponse[]>();

    for (const response of conflict.responses) {
      const key = response.content.substring(0, 100);
      const group = contentGroups.get(key) ?? [];
      group.push(response);
      contentGroups.set(key, group);
    }

    // Find largest group
    let largestGroup: AgentResponse[] = [];
    for (const group of contentGroups.values()) {
      if (group.length > largestGroup.length) {
        largestGroup = group;
      }
    }

    // Check if majority
    if (largestGroup.length > conflict.responses.length / 2) {
      const winner = largestGroup.reduce((best, r) =>
        r.confidence > best.confidence ? r : best,
      );

      return Promise.resolve({
        conflictId: conflict.id,
        strategy: 'consensus',
        winner,
        explanation: `Consensus reached with ${largestGroup.length}/${conflict.responses.length} agreement`,
        successful: true,
        escalated: false,
        resolved: new Date(),
      });
    }

    // No consensus - fall back to confidence
    return Promise.resolve({
      ...this.resolveByConfidence(conflict),
      strategy: 'consensus',
      explanation: 'No consensus reached, fell back to highest confidence',
    });
  }

  /**
   * Resolve by merging responses
   */
  private resolveByMerge(
    conflict: Conflict,
    _context: ExecutionContext,
  ): Promise<Resolution> {
    // Try to merge compatible responses
    const mergedParts: string[] = [];
    const usedResponses: string[] = [];

    for (const response of conflict.responses) {
      // Check if this response adds new information
      const contentLower = response.content.toLowerCase();
      const isNew = !mergedParts.some(
        (part) =>
          part.toLowerCase().includes(contentLower) ||
          contentLower.includes(part.toLowerCase()),
      );

      if (isNew) {
        mergedParts.push(response.content);
        usedResponses.push(response.agentName);
      }
    }

    if (mergedParts.length > 1) {
      return Promise.resolve({
        conflictId: conflict.id,
        strategy: 'merge',
        merged: mergedParts.join('\n\n'),
        explanation: `Merged responses from ${usedResponses.join(', ')}`,
        successful: true,
        escalated: false,
        resolved: new Date(),
      });
    }

    // Couldn't merge - use highest confidence
    return Promise.resolve({
      ...this.resolveByConfidence(conflict),
      strategy: 'merge',
      explanation: 'Could not merge responses, fell back to highest confidence',
    });
  }

  /**
   * Escalate to human
   */
  private escalate(
    conflict: Conflict,
    context: ExecutionContext,
    reason: string,
  ): Promise<Resolution> {
    context.emit({
      type: 'conflict:escalated',
      conflictId: conflict.id,
      reason,
      participants: conflict.participants,
    });

    return Promise.resolve({
      conflictId: conflict.id,
      strategy: 'human',
      explanation: `Escalated to human: ${reason}`,
      successful: false,
      escalated: true,
      resolved: new Date(),
    });
  }

  /**
   * Get resolution history
   */
  getHistory(conflictId?: string): Resolution[] {
    if (conflictId) {
      return this.history.filter((r) => r.conflictId === conflictId);
    }
    return [...this.history];
  }

  /**
   * Get resolution statistics
   */
  getStatistics(): {
    totalConflicts: number;
    byStrategy: Record<string, number>;
    successRate: number;
    escalationRate: number;
  } {
    const byStrategy: Record<string, number> = {};
    let successful = 0;
    let escalated = 0;

    for (const resolution of this.history) {
      byStrategy[resolution.strategy] =
        (byStrategy[resolution.strategy] ?? 0) + 1;
      if (resolution.successful) successful++;
      if (resolution.escalated) escalated++;
    }

    return {
      totalConflicts: this.history.length,
      byStrategy,
      successRate:
        this.history.length > 0 ? successful / this.history.length : 0,
      escalationRate:
        this.history.length > 0 ? escalated / this.history.length : 0,
    };
  }

  /**
   * Clear history and counts
   */
  clear(): void {
    this.history.length = 0;
    this.conflictCounts.clear();
  }
}

/**
 * Factory function
 */
export function createConflictResolver(
  config?: ConflictResolverConfig,
): ConflictResolver {
  return new ConflictResolver(config);
}

export default ConflictResolver;
