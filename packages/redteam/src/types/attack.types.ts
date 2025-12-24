/**
 * Attack Types for Red Team Testing
 */

/**
 * Attack category identifiers
 */
export type AttackCategory =
  | 'jailbreak'
  | 'prompt_injection'
  | 'data_exfiltration'
  | 'manipulation'
  | 'bypass'
  | 'social_engineering'
  | 'privilege_escalation'
  | 'denial_of_service'
  | 'information_disclosure'
  | 'custom';

/**
 * Severity levels for attacks and vulnerabilities
 */
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'informational';

/**
 * Attack status
 */
export type AttackStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

/**
 * Attack result outcome
 */
export type AttackOutcome =
  | 'success'
  | 'failure'
  | 'partial'
  | 'blocked'
  | 'error';

/**
 * Base attack definition
 */
export interface Attack {
  /** Unique identifier */
  id: string;
  /** Attack name */
  name: string;
  /** Attack description */
  description: string;
  /** Category of attack */
  category: AttackCategory;
  /** Severity rating */
  severity: Severity;
  /** Attack payload/prompt */
  payload: string;
  /** Expected behavior if attack succeeds */
  expectedBehavior?: string;
  /** Tags for categorization */
  tags: string[];
  /** Source/reference for the attack */
  source?: string;
  /** MITRE ATT&CK mapping if applicable */
  mitreMapping?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Attack variant with mutations
 */
export interface AttackVariant extends Attack {
  /** Original attack ID this variant is based on */
  originalId: string;
  /** Mutation type applied */
  mutationType: MutationType;
  /** Mutation parameters */
  mutationParams?: Record<string, unknown>;
}

/**
 * Mutation types for attack generation
 */
export type MutationType =
  | 'character_substitution'
  | 'encoding'
  | 'unicode_normalization'
  | 'token_splitting'
  | 'language_translation'
  | 'paraphrase'
  | 'roleplay_wrap'
  | 'instruction_wrap'
  | 'context_injection'
  | 'delimiter_injection'
  | 'case_variation'
  | 'whitespace_manipulation'
  | 'homoglyph_substitution'
  | 'invisible_characters'
  | 'custom';

/**
 * Result of executing an attack
 */
export interface AttackResult {
  /** Attack that was executed */
  attack: Attack;
  /** Outcome of the attack */
  outcome: AttackOutcome;
  /** Response from the target */
  response: string;
  /** Whether the attack bypassed defenses */
  bypassed: boolean;
  /** Confidence score (0-1) that attack succeeded */
  confidence: number;
  /** Detection indicators found */
  detectionIndicators: string[];
  /** Time taken to execute (ms) */
  executionTimeMs: number;
  /** Timestamp of execution */
  timestamp: number;
  /** Additional context */
  context?: Record<string, unknown>;
  /** Error if execution failed */
  error?: string;
}

/**
 * Attack execution options
 */
export interface AttackExecutionOptions {
  /** Timeout in milliseconds */
  timeout?: number;
  /** Number of retry attempts */
  retries?: number;
  /** Delay between retries (ms) */
  retryDelay?: number;
  /** Whether to continue on error */
  continueOnError?: boolean;
  /** Custom headers for requests */
  headers?: Record<string, string>;
  /** Temperature for model calls */
  temperature?: number;
  /** Additional model parameters */
  modelParams?: Record<string, unknown>;
}

/**
 * Attack filter criteria
 */
export interface AttackFilter {
  /** Filter by categories */
  categories?: AttackCategory[];
  /** Filter by severity */
  severities?: Severity[];
  /** Filter by tags */
  tags?: string[];
  /** Search query for name/description */
  query?: string;
  /** Filter by source */
  source?: string;
  /** Maximum number of attacks */
  limit?: number;
  /** Random sampling */
  randomSample?: boolean;
}

/**
 * Attack library statistics
 */
export interface AttackLibraryStats {
  /** Total number of attacks */
  totalAttacks: number;
  /** Attacks by category */
  byCategory: Record<AttackCategory, number>;
  /** Attacks by severity */
  bySeverity: Record<Severity, number>;
  /** Unique tags */
  uniqueTags: string[];
  /** Sources */
  sources: string[];
}

/**
 * Jailbreak-specific attack
 */
export interface JailbreakAttack extends Attack {
  category: 'jailbreak';
  /** Jailbreak technique type */
  technique: JailbreakTechnique;
  /** Whether it's a known bypass */
  knownBypass: boolean;
  /** Model versions known to be affected */
  affectedModels?: string[];
}

/**
 * Jailbreak techniques
 */
export type JailbreakTechnique =
  | 'dan' // Do Anything Now
  | 'developer_mode'
  | 'roleplay'
  | 'hypothetical'
  | 'reverse_psychology'
  | 'token_manipulation'
  | 'multi_turn'
  | 'context_overflow'
  | 'instruction_hierarchy'
  | 'persona'
  | 'fictional_framing'
  | 'translation'
  | 'encoding'
  | 'custom';

/**
 * Prompt injection attack
 */
export interface InjectionAttack extends Attack {
  category: 'prompt_injection';
  /** Injection type */
  injectionType: InjectionType;
  /** Target location in prompt */
  targetLocation: 'system' | 'user' | 'assistant' | 'tool';
}

/**
 * Injection types
 */
export type InjectionType =
  | 'direct' // Direct instruction injection
  | 'indirect' // Via external data
  | 'recursive' // Self-propagating
  | 'blind' // No response feedback
  | 'stored' // Persisted in memory/context
  | 'reflected' // Echoed back
  | 'dom' // Through structured data
  | 'custom';

/**
 * Data exfiltration attack
 */
export interface ExfiltrationAttack extends Attack {
  category: 'data_exfiltration';
  /** Type of data targeted */
  targetData: ExfiltrationTarget;
  /** Exfiltration method */
  method: ExfiltrationMethod;
}

/**
 * Exfiltration targets
 */
export type ExfiltrationTarget =
  | 'system_prompt'
  | 'user_data'
  | 'conversation_history'
  | 'tool_credentials'
  | 'internal_state'
  | 'training_data'
  | 'configuration'
  | 'custom';

/**
 * Exfiltration methods
 */
export type ExfiltrationMethod =
  | 'direct_query'
  | 'side_channel'
  | 'inference'
  | 'error_exploitation'
  | 'encoding_tricks'
  | 'context_manipulation'
  | 'custom';
