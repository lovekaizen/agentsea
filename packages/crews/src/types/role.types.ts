/**
 * Role Types
 *
 * Type definitions for agent roles and capabilities.
 */

/**
 * Proficiency level for a capability
 */
export type ProficiencyLevel = 'novice' | 'intermediate' | 'expert' | 'master';

/**
 * Capability that an agent can possess
 */
export interface Capability {
  /** Unique name of the capability */
  name: string;
  /** Description of what this capability enables */
  description: string;
  /** Proficiency level in this capability */
  proficiency: ProficiencyLevel;
  /** Tool names required for this capability */
  tools?: string[];
  /** Keywords for matching tasks */
  keywords?: string[];
}

/**
 * Configuration for creating a Role
 */
export interface RoleConfig {
  /** Unique name of the role */
  name: string;
  /** Description of the role's purpose */
  description: string;
  /** List of capabilities this role possesses */
  capabilities: Capability[];
  /** System prompt for the agent in this role */
  systemPrompt: string;
  /** Goals the agent should work towards */
  goals?: string[];
  /** Constraints the agent must respect */
  constraints?: string[];
  /** Backstory for the agent persona */
  backstory?: string;
  /** Whether this role can delegate to others */
  canDelegate?: boolean;
  /** Whether this role can receive delegated tasks */
  canReceiveDelegation?: boolean;
  /** Maximum tasks this role can handle concurrently */
  maxConcurrentTasks?: number;
}

/**
 * Result of matching capabilities
 */
export interface CapabilityMatch {
  /** Capabilities that were successfully matched */
  matched: Capability[];
  /** Capabilities that were not found */
  missing: Capability[];
  /** Overall match score (0-1) */
  score: number;
  /** Whether the agent can execute with these capabilities */
  canExecute: boolean;
}

/**
 * Agent ranked by capability match
 */
export interface RankedAgent {
  /** Agent name */
  agentName: string;
  /** Match score (0-1) */
  score: number;
  /** Matched capabilities */
  matchedCapabilities: Capability[];
  /** Missing capabilities */
  missingCapabilities: Capability[];
}

/**
 * Proficiency weights for scoring
 */
export const PROFICIENCY_WEIGHTS: Record<ProficiencyLevel, number> = {
  novice: 0.25,
  intermediate: 0.5,
  expert: 0.75,
  master: 1.0,
};
