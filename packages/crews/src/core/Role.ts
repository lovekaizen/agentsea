/**
 * Role Class
 *
 * Represents an agent role with capabilities and system prompt generation.
 */

import type {
  RoleConfig,
  Capability,
  CapabilityMatch,
  ProficiencyLevel,
} from '../types';

/**
 * Role class for defining agent personas and capabilities
 */
export class Role {
  readonly name: string;
  readonly description: string;
  readonly capabilities: Capability[];
  readonly systemPrompt: string;
  readonly goals: string[];
  readonly constraints: string[];
  readonly backstory: string;
  readonly canDelegate: boolean;
  readonly canReceiveDelegation: boolean;
  readonly maxConcurrentTasks: number;

  private capabilityMap: Map<string, Capability>;

  constructor(config: RoleConfig) {
    this.name = config.name;
    this.description = config.description;
    this.capabilities = config.capabilities;
    this.systemPrompt = config.systemPrompt;
    this.goals = config.goals ?? [];
    this.constraints = config.constraints ?? [];
    this.backstory = config.backstory ?? '';
    this.canDelegate = config.canDelegate ?? false;
    this.canReceiveDelegation = config.canReceiveDelegation ?? true;
    this.maxConcurrentTasks = config.maxConcurrentTasks ?? 1;

    // Build capability lookup map
    this.capabilityMap = new Map();
    for (const cap of this.capabilities) {
      this.capabilityMap.set(cap.name.toLowerCase(), cap);
    }
  }

  /**
   * Generate a complete system prompt incorporating all role aspects
   */
  generateSystemPrompt(): string {
    const parts: string[] = [];

    // Base system prompt
    parts.push(this.systemPrompt);

    // Add role context
    parts.push(`\n\nYou are acting as a ${this.name}: ${this.description}`);

    // Add backstory if provided
    if (this.backstory) {
      parts.push(`\n\nBackground: ${this.backstory}`);
    }

    // Add goals
    if (this.goals.length > 0) {
      parts.push('\n\nYour goals:');
      for (const goal of this.goals) {
        parts.push(`- ${goal}`);
      }
    }

    // Add constraints
    if (this.constraints.length > 0) {
      parts.push('\n\nConstraints you must respect:');
      for (const constraint of this.constraints) {
        parts.push(`- ${constraint}`);
      }
    }

    // Add capabilities context
    if (this.capabilities.length > 0) {
      parts.push('\n\nYour capabilities:');
      for (const cap of this.capabilities) {
        parts.push(`- ${cap.name} (${cap.proficiency}): ${cap.description}`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Check if this role has a specific capability
   */
  hasCapability(name: string): boolean {
    return this.capabilityMap.has(name.toLowerCase());
  }

  /**
   * Get a specific capability by name
   */
  getCapability(name: string): Capability | undefined {
    return this.capabilityMap.get(name.toLowerCase());
  }

  /**
   * Get proficiency level for a capability
   */
  getProficiency(name: string): ProficiencyLevel | undefined {
    const cap = this.getCapability(name);
    return cap?.proficiency;
  }

  /**
   * Get proficiency score (0-1) for a capability
   */
  getProficiencyScore(name: string): number {
    const cap = this.getCapability(name);
    if (!cap) return 0;

    const weights: Record<ProficiencyLevel, number> = {
      novice: 0.25,
      intermediate: 0.5,
      expert: 0.75,
      master: 1.0,
    };

    return weights[cap.proficiency];
  }

  /**
   * Get all tools required by this role's capabilities
   */
  getRequiredTools(): string[] {
    const tools = new Set<string>();
    for (const cap of this.capabilities) {
      if (cap.tools) {
        for (const tool of cap.tools) {
          tools.add(tool);
        }
      }
    }
    return Array.from(tools);
  }

  /**
   * Get all keywords from this role's capabilities
   */
  getKeywords(): string[] {
    const keywords = new Set<string>();
    for (const cap of this.capabilities) {
      if (cap.keywords) {
        for (const keyword of cap.keywords) {
          keywords.add(keyword.toLowerCase());
        }
      }
    }
    return Array.from(keywords);
  }

  /**
   * Match required capabilities against this role
   */
  matchCapabilities(required: Capability[]): CapabilityMatch {
    const matched: Capability[] = [];
    const missing: Capability[] = [];

    for (const req of required) {
      const available = this.getCapability(req.name);
      if (available) {
        matched.push(available);
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
   * Calculate relevance score for a task description
   */
  calculateRelevanceScore(taskDescription: string): number {
    const descLower = taskDescription.toLowerCase();
    const keywords = this.getKeywords();

    if (keywords.length === 0) {
      // No keywords defined, use capability names
      let matchCount = 0;
      for (const cap of this.capabilities) {
        if (descLower.includes(cap.name.toLowerCase())) {
          matchCount++;
        }
      }
      return this.capabilities.length > 0
        ? matchCount / this.capabilities.length
        : 0;
    }

    // Count keyword matches
    let matchCount = 0;
    for (const keyword of keywords) {
      if (descLower.includes(keyword)) {
        matchCount++;
      }
    }

    return keywords.length > 0 ? matchCount / keywords.length : 0;
  }

  /**
   * Serialize to JSON
   */
  toJSON(): RoleConfig {
    return {
      name: this.name,
      description: this.description,
      capabilities: this.capabilities,
      systemPrompt: this.systemPrompt,
      goals: this.goals.length > 0 ? this.goals : undefined,
      constraints: this.constraints.length > 0 ? this.constraints : undefined,
      backstory: this.backstory || undefined,
      canDelegate: this.canDelegate,
      canReceiveDelegation: this.canReceiveDelegation,
      maxConcurrentTasks: this.maxConcurrentTasks,
    };
  }

  /**
   * Create from JSON
   */
  static fromJSON(json: RoleConfig): Role {
    return new Role(json);
  }

  /**
   * Create a simple role with minimal configuration
   */
  static simple(
    name: string,
    description: string,
    systemPrompt: string,
    capabilities: string[] = [],
  ): Role {
    return new Role({
      name,
      description,
      systemPrompt,
      capabilities: capabilities.map((cap) => ({
        name: cap,
        description: cap,
        proficiency: 'intermediate' as ProficiencyLevel,
      })),
    });
  }
}

/**
 * Factory function for creating roles
 */
export function createRole(config: RoleConfig): Role {
  return new Role(config);
}

export default Role;
