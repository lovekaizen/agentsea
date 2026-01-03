/**
 * Guard Types
 *
 * Core type definitions for the guardrails guard system.
 */

import { z } from 'zod';

/**
 * Action to take when a guard check completes
 */
export type GuardAction = 'allow' | 'block' | 'transform' | 'warn';

/**
 * Type of content being checked
 */
export type ContentType = 'input' | 'output' | 'both';

/**
 * Sensitivity levels for guard checks
 */
export type SensitivityLevel = 'low' | 'medium' | 'high';

/**
 * Guard configuration
 */
export interface GuardConfig {
  /** Unique guard name */
  name: string;
  /** Whether the guard is enabled */
  enabled: boolean;
  /** Action on failure */
  onFailure: GuardAction;
  /** Confidence threshold (0-1) for triggering action */
  threshold?: number;
  /** Sensitivity level */
  sensitivity?: SensitivityLevel;
  /** Custom configuration options */
  options?: Record<string, unknown>;
}

/**
 * Context provided to guards during checks
 */
export interface GuardContext<T = unknown> {
  /** The content being checked */
  input: string;
  /** Type of content (input/output) */
  type: ContentType;
  /** Session identifier */
  sessionId?: string;
  /** User identifier */
  userId?: string;
  /** Request metadata */
  metadata?: Record<string, unknown>;
  /** Results from previous guards in the pipeline */
  previousResults?: GuardResult[];
  /** Custom data for the guard */
  customData?: T;
  /** Timestamp of the check */
  timestamp: Date;
}

/**
 * Details about a detected issue
 */
export interface DetectionDetail {
  /** Category of the detection */
  category: string;
  /** Specific pattern or rule that matched */
  pattern?: string;
  /** Location in the content (start index) */
  startIndex?: number;
  /** Location in the content (end index) */
  endIndex?: number;
  /** Matched text */
  matchedText?: string;
  /** Additional context */
  context?: string;
}

/**
 * Result of a guard check
 */
export interface GuardResult<T = unknown> {
  /** Whether the check passed */
  passed: boolean;
  /** Name of the guard */
  guardName: string;
  /** Action to take */
  action: GuardAction;
  /** Human-readable message */
  message?: string;
  /** Confidence score (0-1) */
  confidence?: number;
  /** Detailed findings */
  details?: T;
  /** Detection details for failures */
  detections?: DetectionDetail[];
  /** Time taken for the check in milliseconds */
  latencyMs: number;
  /** Transformed content (if action is 'transform') */
  transformedContent?: string;
  /** Timestamp of the result */
  timestamp: Date;
}

/**
 * Guard interface - the core contract for all guards
 */
export interface Guard<TInput = unknown, TOutput = unknown> {
  /** Unique guard name */
  readonly name: string;
  /** Guard configuration */
  readonly config: GuardConfig;
  /** Content types this guard supports */
  readonly supportedTypes: ContentType[];

  /**
   * Check content against this guard
   */
  check(context: GuardContext<TInput>): Promise<GuardResult<TOutput>>;

  /**
   * Optional transformation function
   */
  transform?(content: string, context: GuardContext<TInput>): Promise<string>;
}

/**
 * Guard factory function type
 */
export type GuardFactory<T extends Guard = Guard> = (
  config: Partial<GuardConfig>,
) => T;

/**
 * Guard decorator metadata
 */
export interface GuardMetadata {
  name: string;
  description: string;
  category: GuardCategory;
  supportedTypes: ContentType[];
  defaultConfig: Partial<GuardConfig>;
}

/**
 * Guard categories for organization
 */
export type GuardCategory =
  | 'content'
  | 'security'
  | 'validation'
  | 'operational';

/**
 * Zod schemas for validation
 */
export const GuardConfigSchema = z.object({
  name: z.string().min(1),
  enabled: z.boolean().default(true),
  onFailure: z.enum(['allow', 'block', 'transform', 'warn']).default('block'),
  threshold: z.number().min(0).max(1).optional(),
  sensitivity: z.enum(['low', 'medium', 'high']).optional(),
  options: z.record(z.unknown()).optional(),
});

export const GuardContextSchema = z.object({
  input: z.string(),
  type: z.enum(['input', 'output', 'both']),
  sessionId: z.string().optional(),
  userId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  previousResults: z.array(z.unknown()).optional(),
  customData: z.unknown().optional(),
  timestamp: z.date(),
});

export const GuardResultSchema = z.object({
  passed: z.boolean(),
  guardName: z.string(),
  action: z.enum(['allow', 'block', 'transform', 'warn']),
  message: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  details: z.unknown().optional(),
  detections: z
    .array(
      z.object({
        category: z.string(),
        pattern: z.string().optional(),
        startIndex: z.number().optional(),
        endIndex: z.number().optional(),
        matchedText: z.string().optional(),
        context: z.string().optional(),
      }),
    )
    .optional(),
  latencyMs: z.number(),
  transformedContent: z.string().optional(),
  timestamp: z.date(),
});
