/**
 * Configuration Types
 *
 * Configuration type definitions for the guardrails system.
 */

import { z } from 'zod';

import type { GuardConfig, GuardAction, SensitivityLevel } from './guard.types';

/**
 * Failure modes for the guardrails engine
 */
export type FailureMode =
  /** Stop on first failure */
  | 'fail-fast'
  /** Continue and collect all results */
  | 'collect-all'
  /** Continue with warnings, don't block */
  | 'fail-safe';

/**
 * Execution modes for pipeline
 */
export type ExecutionMode =
  /** Run guards one at a time */
  | 'sequential'
  /** Run all guards in parallel */
  | 'parallel';

/**
 * Telemetry configuration
 */
export interface TelemetryConfig {
  /** Enable logging */
  logging?: {
    enabled: boolean;
    level: 'debug' | 'info' | 'warn' | 'error';
    /** Pretty print for development */
    pretty?: boolean;
  };
  /** Enable Prometheus metrics */
  metrics?: {
    enabled: boolean;
    /** Custom labels */
    labels?: Record<string, string>;
  };
  /** Enable OpenTelemetry tracing */
  tracing?: {
    enabled: boolean;
    /** Service name */
    serviceName?: string;
  };
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  /** Enable caching */
  enabled: boolean;
  /** Time-to-live in milliseconds */
  ttlMs: number;
  /** Maximum cache entries */
  maxSize: number;
  /** Cache key generator */
  keyGenerator?: (input: string, guardName: string) => string;
}

/**
 * Main guardrails configuration
 */
export interface GuardrailsConfig {
  /** Guard configurations */
  guards: GuardConfig[];
  /** Failure handling mode */
  failureMode: FailureMode;
  /** Default action when no guards match */
  defaultAction: GuardAction;
  /** Execution mode */
  executionMode?: ExecutionMode;
  /** Default sensitivity level */
  defaultSensitivity?: SensitivityLevel;
  /** Telemetry configuration */
  telemetry?: TelemetryConfig;
  /** Cache configuration */
  cache?: CacheConfig;
  /** Custom error messages */
  errorMessages?: Record<string, string>;
  /** Global timeout in milliseconds */
  timeoutMs?: number;
}

/**
 * Content-specific guard configurations
 */
export interface ContentGuardsConfig {
  /** Toxicity guard */
  toxicity?: ToxicityGuardConfig;
  /** PII guard */
  pii?: PIIGuardConfig;
  /** Topic guard */
  topic?: TopicGuardConfig;
  /** Bias guard */
  bias?: BiasGuardConfig;
}

/**
 * Toxicity guard configuration
 */
export interface ToxicityGuardConfig extends GuardConfig {
  /** Categories to check */
  categories?: ToxicityCategory[];
  /** Per-category thresholds */
  categoryThresholds?: Partial<Record<ToxicityCategory, number>>;
}

export type ToxicityCategory =
  | 'hate'
  | 'violence'
  | 'sexual'
  | 'harassment'
  | 'self-harm'
  | 'dangerous';

/**
 * PII guard configuration
 */
export interface PIIGuardConfig extends GuardConfig {
  /** PII types to detect */
  types?: PIIType[];
  /** Custom regex patterns */
  customPatterns?: Record<string, RegExp>;
  /** Masking format */
  maskFormat?: string;
  /** Masking character */
  maskChar?: string;
}

export type PIIType =
  | 'email'
  | 'phone'
  | 'ssn'
  | 'credit-card'
  | 'address'
  | 'name'
  | 'ip-address'
  | 'date-of-birth';

/**
 * Topic guard configuration
 */
export interface TopicGuardConfig extends GuardConfig {
  /** Allowed topics */
  allowedTopics?: string[];
  /** Blocked topics */
  blockedTopics?: string[];
  /** Topic classification model */
  model?: string;
}

/**
 * Bias guard configuration
 */
export interface BiasGuardConfig extends GuardConfig {
  /** Bias categories to detect */
  categories?: BiasCategory[];
}

export type BiasCategory =
  | 'gender'
  | 'race'
  | 'religion'
  | 'political'
  | 'age'
  | 'disability';

/**
 * Security guard configurations
 */
export interface SecurityGuardsConfig {
  /** Prompt injection guard */
  promptInjection?: PromptInjectionGuardConfig;
  /** Jailbreak guard */
  jailbreak?: JailbreakGuardConfig;
  /** Data leakage guard */
  dataLeakage?: DataLeakageGuardConfig;
}

/**
 * Prompt injection guard configuration
 */
export interface PromptInjectionGuardConfig extends GuardConfig {
  /** Detection patterns */
  patterns?: string[];
  /** Use heuristic analysis */
  useHeuristics?: boolean;
}

/**
 * Jailbreak guard configuration
 */
export interface JailbreakGuardConfig extends GuardConfig {
  /** Known jailbreak patterns */
  patterns?: string[];
  /** Check for roleplay attacks */
  checkRoleplay?: boolean;
  /** Check for DAN-style attacks */
  checkDAN?: boolean;
}

/**
 * Data leakage guard configuration
 */
export interface DataLeakageGuardConfig extends GuardConfig {
  /** Patterns for sensitive data */
  sensitivePatterns?: string[];
  /** Block API keys */
  blockApiKeys?: boolean;
  /** Block passwords */
  blockPasswords?: boolean;
  /** Custom sensitive data regex */
  customPatterns?: Record<string, RegExp>;
}

/**
 * Validation guard configurations
 */
export interface ValidationGuardsConfig {
  /** Schema guard */
  schema?: SchemaGuardConfig;
  /** Format guard */
  format?: FormatGuardConfig;
  /** Factuality guard */
  factuality?: FactualityGuardConfig;
}

/**
 * Schema guard configuration
 */
export interface SchemaGuardConfig extends GuardConfig {
  /** Zod schema for validation */
  schema?: z.ZodType;
  /** Allow additional properties */
  strict?: boolean;
}

/**
 * Format guard configuration
 */
export interface FormatGuardConfig extends GuardConfig {
  /** Expected format */
  format?: 'json' | 'xml' | 'markdown' | 'yaml' | 'custom';
  /** Custom format validator */
  customValidator?: (content: string) => boolean;
}

/**
 * Factuality guard configuration
 */
export interface FactualityGuardConfig extends GuardConfig {
  /** Fact-checking service endpoint */
  factCheckEndpoint?: string;
  /** Sources to verify against */
  verificationSources?: string[];
}

/**
 * Operational guard configurations
 */
export interface OperationalGuardsConfig {
  /** Token budget guard */
  tokenBudget?: TokenBudgetGuardConfig;
  /** Rate limit guard */
  rateLimit?: RateLimitGuardConfig;
  /** Cost guard */
  cost?: CostGuardConfig;
}

/**
 * Token budget guard configuration
 */
export interface TokenBudgetGuardConfig extends GuardConfig {
  /** Maximum tokens per request */
  maxTokensPerRequest?: number;
  /** Maximum tokens per session */
  maxTokensPerSession?: number;
  /** Warning threshold (0-1) */
  warningThreshold?: number;
}

/**
 * Rate limit guard configuration
 */
export interface RateLimitGuardConfig extends GuardConfig {
  /** Maximum requests per window */
  maxRequests: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** Rate limit by key */
  keyBy?: 'user' | 'session' | 'ip' | 'global';
  /** Skip successful requests */
  skipSuccessfulRequests?: boolean;
}

/**
 * Cost guard configuration
 */
export interface CostGuardConfig extends GuardConfig {
  /** Maximum cost per request */
  maxCostPerRequest?: number;
  /** Maximum cost per session */
  maxCostPerSession?: number;
  /** Maximum daily cost */
  maxDailyCost?: number;
  /** Cost per token (input) */
  costPerInputToken?: number;
  /** Cost per token (output) */
  costPerOutputToken?: number;
}

/**
 * Zod schemas for validation
 */
export const TelemetryConfigSchema = z.object({
  logging: z
    .object({
      enabled: z.boolean(),
      level: z.enum(['debug', 'info', 'warn', 'error']),
      pretty: z.boolean().optional(),
    })
    .optional(),
  metrics: z
    .object({
      enabled: z.boolean(),
      labels: z.record(z.string()).optional(),
    })
    .optional(),
  tracing: z
    .object({
      enabled: z.boolean(),
      serviceName: z.string().optional(),
    })
    .optional(),
});

export const CacheConfigSchema = z.object({
  enabled: z.boolean(),
  ttlMs: z.number().positive(),
  maxSize: z.number().positive(),
  keyGenerator: z.function().optional(),
});

export const GuardrailsConfigSchema = z.object({
  guards: z.array(z.unknown()),
  failureMode: z.enum(['fail-fast', 'collect-all', 'fail-safe']),
  defaultAction: z.enum(['allow', 'block', 'transform', 'warn']),
  executionMode: z.enum(['sequential', 'parallel']).optional(),
  defaultSensitivity: z.enum(['low', 'medium', 'high']).optional(),
  telemetry: TelemetryConfigSchema.optional(),
  cache: CacheConfigSchema.optional(),
  errorMessages: z.record(z.string()).optional(),
  timeoutMs: z.number().positive().optional(),
});
