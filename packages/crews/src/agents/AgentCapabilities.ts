/**
 * AgentCapabilities
 *
 * Utility class for capability matching and scoring.
 */

import type {
  Capability,
  CapabilityMatch,
  RankedAgent,
  ProficiencyLevel,
  TaskConfig,
  TaskResult,
} from '../types';

/**
 * Proficiency weights for scoring
 */
const PROFICIENCY_WEIGHTS: Record<ProficiencyLevel, number> = {
  novice: 0.25,
  intermediate: 0.5,
  expert: 0.75,
  master: 1.0,
};

/**
 * Agent with capabilities for ranking
 */
export interface CapableAgent {
  name: string;
  capabilities: Capability[];
  /** Optional: busy state */
  isBusy?: boolean;
  /** Optional: execute a task */
  executeTask?: (task: TaskConfig) => Promise<TaskResult>;
  /** Optional: get agent statistics */
  getStats?: () => {
    name: string;
    role?: string;
    tasksCompleted: number;
    tasksFailed: number;
    totalTokensUsed: number;
    successRate?: number;
    isBusy?: boolean;
    currentTask?: string;
  };
}

/**
 * Utility class for capability operations
 */
export class AgentCapabilities {
  /**
   * Match required capabilities against available ones
   */
  static match(
    required: Capability[],
    available: Capability[],
  ): CapabilityMatch {
    const availableMap = new Map<string, Capability>();
    for (const cap of available) {
      availableMap.set(cap.name.toLowerCase(), cap);
    }

    const matched: Capability[] = [];
    const missing: Capability[] = [];

    for (const req of required) {
      const avail = availableMap.get(req.name.toLowerCase());
      if (avail) {
        matched.push(avail);
      } else {
        missing.push(req);
      }
    }

    const score = required.length > 0 ? matched.length / required.length : 1;
    const canExecute = missing.length === 0;

    return {
      matched,
      missing,
      score,
      canExecute,
    };
  }

  /**
   * Score a capability against a task
   */
  static score(capability: Capability, task: TaskConfig): number {
    let score = PROFICIENCY_WEIGHTS[capability.proficiency];

    // Boost score if capability keywords match task description
    if (capability.keywords && capability.keywords.length > 0) {
      const descLower = task.description.toLowerCase();
      let keywordMatches = 0;
      for (const keyword of capability.keywords) {
        if (descLower.includes(keyword.toLowerCase())) {
          keywordMatches++;
        }
      }
      const keywordBoost = keywordMatches / capability.keywords.length;
      score = score * 0.7 + keywordBoost * 0.3; // Weight: 70% proficiency, 30% keyword match
    }

    return score;
  }

  /**
   * Calculate overall capability score for an agent on a task
   */
  static calculateAgentScore(agent: CapableAgent, task: TaskConfig): number {
    if (agent.capabilities.length === 0) {
      return 0;
    }

    // Check required capabilities first
    if (task.requiredCapabilities && task.requiredCapabilities.length > 0) {
      const requiredCaps = task.requiredCapabilities.map((name) => ({
        name,
        description: '',
        proficiency: 'intermediate' as ProficiencyLevel,
      }));

      const match = this.match(requiredCaps, agent.capabilities);
      if (!match.canExecute) {
        return 0; // Cannot execute without required capabilities
      }

      // Score based on proficiency of required capabilities
      let totalScore = 0;
      for (const cap of match.matched) {
        totalScore += PROFICIENCY_WEIGHTS[cap.proficiency];
      }
      return totalScore / task.requiredCapabilities.length;
    }

    // No required capabilities - score based on keyword matching
    let maxScore = 0;
    for (const cap of agent.capabilities) {
      const capScore = this.score(cap, task);
      maxScore = Math.max(maxScore, capScore);
    }

    return maxScore;
  }

  /**
   * Rank agents by their suitability for a task
   */
  static rank(agents: CapableAgent[], task: TaskConfig): RankedAgent[] {
    const ranked: RankedAgent[] = [];

    for (const agent of agents) {
      // Get required capabilities
      const requiredCaps = (task.requiredCapabilities ?? []).map((name) => ({
        name,
        description: '',
        proficiency: 'intermediate' as ProficiencyLevel,
      }));

      const match = this.match(requiredCaps, agent.capabilities);
      const score = this.calculateAgentScore(agent, task);

      ranked.push({
        agentName: agent.name,
        score,
        matchedCapabilities: match.matched,
        missingCapabilities: match.missing,
      });
    }

    // Sort by score descending
    ranked.sort((a, b) => b.score - a.score);

    return ranked;
  }

  /**
   * Find the best matching agent for a task
   */
  static findBestMatch(
    agents: CapableAgent[],
    task: TaskConfig,
  ): RankedAgent | undefined {
    const ranked = this.rank(agents, task);
    if (ranked.length === 0) return undefined;

    // Return the top agent if they can actually execute the task
    const best = ranked[0];
    if (best.score > 0 && best.missingCapabilities.length === 0) {
      return best;
    }

    // Find first agent that can execute
    return ranked.find((r) => r.missingCapabilities.length === 0);
  }

  /**
   * Find all agents that can handle a task
   */
  static findCapableAgents(
    agents: CapableAgent[],
    task: TaskConfig,
  ): RankedAgent[] {
    return this.rank(agents, task).filter(
      (r) => r.missingCapabilities.length === 0,
    );
  }

  /**
   * Check if any agent can handle a task
   */
  static canAnyHandle(agents: CapableAgent[], task: TaskConfig): boolean {
    return this.findCapableAgents(agents, task).length > 0;
  }

  /**
   * Calculate capability overlap between two agents
   */
  static calculateOverlap(agent1: CapableAgent, agent2: CapableAgent): number {
    const caps1 = new Set(agent1.capabilities.map((c) => c.name.toLowerCase()));
    const caps2 = new Set(agent2.capabilities.map((c) => c.name.toLowerCase()));

    let overlap = 0;
    for (const cap of caps1) {
      if (caps2.has(cap)) {
        overlap++;
      }
    }

    const totalUnique = caps1.size + caps2.size - overlap;
    return totalUnique > 0 ? overlap / totalUnique : 0;
  }

  /**
   * Get all unique capabilities across agents
   */
  static getAllCapabilities(agents: CapableAgent[]): Capability[] {
    const capMap = new Map<string, Capability>();
    for (const agent of agents) {
      for (const cap of agent.capabilities) {
        const key = cap.name.toLowerCase();
        const existing = capMap.get(key);
        if (
          !existing ||
          PROFICIENCY_WEIGHTS[cap.proficiency] >
            PROFICIENCY_WEIGHTS[existing.proficiency]
        ) {
          capMap.set(key, cap);
        }
      }
    }
    return Array.from(capMap.values());
  }

  /**
   * Get capabilities that only one agent has
   */
  static getUniqueCapabilities(
    agents: CapableAgent[],
  ): Map<string, Capability[]> {
    const capCounts = new Map<string, { cap: Capability; agents: string[] }>();

    for (const agent of agents) {
      for (const cap of agent.capabilities) {
        const key = cap.name.toLowerCase();
        const existing = capCounts.get(key);
        if (existing) {
          existing.agents.push(agent.name);
        } else {
          capCounts.set(key, { cap, agents: [agent.name] });
        }
      }
    }

    const unique = new Map<string, Capability[]>();
    for (const [_key, { cap, agents: agentNames }] of capCounts) {
      if (agentNames.length === 1) {
        const existing = unique.get(agentNames[0]) ?? [];
        existing.push(cap);
        unique.set(agentNames[0], existing);
      }
    }

    return unique;
  }
}

export default AgentCapabilities;
