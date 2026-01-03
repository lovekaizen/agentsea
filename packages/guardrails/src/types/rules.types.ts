/**
 * Rules Engine Types
 *
 * Type definitions for the JSON-based rules engine.
 */

import { z } from 'zod';

import type { GuardAction, GuardContext, GuardResult } from './guard.types';

/**
 * Comparison operators for conditions
 */
export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'matches'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'not_in'
  | 'exists'
  | 'not_exists';

/**
 * Logical operators for combining conditions
 */
export type LogicalOperator = 'and' | 'or' | 'not';

/**
 * A single condition in a rule
 */
export interface Condition {
  /** Field to evaluate (supports dot notation) */
  field: string;
  /** Comparison operator */
  operator: ConditionOperator;
  /** Value to compare against */
  value?: unknown;
  /** Negate the condition */
  negate?: boolean;
  /** Case insensitive comparison */
  caseInsensitive?: boolean;
}

/**
 * A group of conditions with logical operator
 */
export interface ConditionGroup {
  /** Logical operator to combine conditions */
  operator: LogicalOperator;
  /** Conditions in this group */
  conditions: (Condition | ConditionGroup)[];
}

/**
 * Action types in rules
 */
export type RuleActionType =
  | 'allow'
  | 'block'
  | 'transform'
  | 'warn'
  | 'log'
  | 'notify'
  | 'custom';

/**
 * Action to execute when a rule matches
 */
export interface RuleAction {
  /** Action type */
  type: RuleActionType;
  /** Action parameters */
  params?: Record<string, unknown>;
  /** Custom action handler name */
  handler?: string;
  /** Message to include */
  message?: string;
}

/**
 * A complete rule definition
 */
export interface Rule {
  /** Unique rule identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of the rule */
  description?: string;
  /** Rule priority (higher = earlier execution) */
  priority: number;
  /** Whether the rule is enabled */
  enabled: boolean;
  /** Rule conditions */
  conditions: Condition | ConditionGroup;
  /** Actions to execute when conditions match */
  actions: RuleAction[];
  /** Tags for categorization */
  tags?: string[];
  /** Metadata */
  metadata?: Record<string, unknown>;
  /** When this rule was created */
  createdAt?: Date;
  /** When this rule was last updated */
  updatedAt?: Date;
}

/**
 * Rule set - a collection of rules
 */
export interface RuleSet {
  /** Rule set identifier */
  id: string;
  /** Rule set name */
  name: string;
  /** Description */
  description?: string;
  /** Version */
  version: string;
  /** Rules in this set */
  rules: Rule[];
  /** Default action if no rules match */
  defaultAction?: GuardAction;
  /** Whether to stop on first match */
  stopOnFirstMatch?: boolean;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result of evaluating a single rule
 */
export interface RuleEvaluationResult {
  /** Rule that was evaluated */
  ruleId: string;
  /** Rule name */
  ruleName: string;
  /** Whether the rule matched */
  matched: boolean;
  /** Actions executed */
  actionsExecuted: RuleAction[];
  /** Execution time in ms */
  latencyMs: number;
  /** Error if any */
  error?: Error;
}

/**
 * Result of evaluating a rule set
 */
export interface RuleSetEvaluationResult {
  /** Rule set that was evaluated */
  ruleSetId: string;
  /** Individual rule results */
  ruleResults: RuleEvaluationResult[];
  /** Final action determined */
  finalAction: GuardAction;
  /** Total execution time in ms */
  totalLatencyMs: number;
  /** Number of rules that matched */
  matchedCount: number;
  /** Message */
  message?: string;
}

/**
 * Context for rule evaluation
 */
export interface RuleContext extends GuardContext {
  /** Previous guard results */
  guardResults?: GuardResult[];
  /** Current rule being evaluated */
  currentRule?: Rule;
  /** Variables set during evaluation */
  variables?: Record<string, unknown>;
}

/**
 * Custom action handler
 */
export type CustomActionHandler = (
  action: RuleAction,
  context: RuleContext,
) => Promise<void>;

/**
 * Rules engine configuration
 */
export interface RulesEngineConfig {
  /** Rule sets to load */
  ruleSets?: RuleSet[];
  /** Path to rule files */
  rulesPath?: string;
  /** Watch for rule file changes */
  watchForChanges?: boolean;
  /** Custom action handlers */
  customHandlers?: Record<string, CustomActionHandler>;
  /** Default action */
  defaultAction?: GuardAction;
  /** Enable caching */
  enableCache?: boolean;
  /** Cache TTL in ms */
  cacheTtlMs?: number;
}

/**
 * Zod schemas for validation
 */
export const ConditionSchema: z.ZodType<Condition> = z.object({
  field: z.string().min(1),
  operator: z.enum([
    'equals',
    'not_equals',
    'contains',
    'not_contains',
    'starts_with',
    'ends_with',
    'matches',
    'gt',
    'gte',
    'lt',
    'lte',
    'in',
    'not_in',
    'exists',
    'not_exists',
  ]),
  value: z.unknown().optional(),
  negate: z.boolean().optional(),
  caseInsensitive: z.boolean().optional(),
});

export const ConditionGroupSchema: z.ZodType<ConditionGroup> = z.lazy(() =>
  z.object({
    operator: z.enum(['and', 'or', 'not']),
    conditions: z.array(z.union([ConditionSchema, ConditionGroupSchema])),
  }),
);

export const RuleActionSchema = z.object({
  type: z.enum([
    'allow',
    'block',
    'transform',
    'warn',
    'log',
    'notify',
    'custom',
  ]),
  params: z.record(z.unknown()).optional(),
  handler: z.string().optional(),
  message: z.string().optional(),
});

export const RuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  priority: z.number().default(0),
  enabled: z.boolean().default(true),
  conditions: z.union([ConditionSchema, ConditionGroupSchema]),
  actions: z.array(RuleActionSchema).min(1),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export const RuleSetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  version: z.string().default('1.0.0'),
  rules: z.array(RuleSchema),
  defaultAction: z.enum(['allow', 'block', 'transform', 'warn']).optional(),
  stopOnFirstMatch: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const RulesEngineConfigSchema = z.object({
  ruleSets: z.array(RuleSetSchema).optional(),
  rulesPath: z.string().optional(),
  watchForChanges: z.boolean().optional(),
  customHandlers: z.record(z.function()).optional(),
  defaultAction: z.enum(['allow', 'block', 'transform', 'warn']).optional(),
  enableCache: z.boolean().optional(),
  cacheTtlMs: z.number().positive().optional(),
});
