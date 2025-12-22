/**
 * AnnotationTask
 *
 * Define and manage annotation tasks.
 */

import { nanoid } from 'nanoid';
import { z } from 'zod';
import type {
  IAnnotationTask,
  AnnotationTaskConfig,
  AnnotationTaskStatus,
} from '../types/index.js';

/**
 * Annotation task class
 */
export class AnnotationTask implements IAnnotationTask {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly instructions: string;
  readonly schema: z.ZodSchema;
  status: AnnotationTaskStatus;
  readonly itemsPerAnnotator: number;
  readonly annotatorsPerItem: number;
  readonly deadline?: Date;
  readonly createdAt: number;
  updatedAt: number;
  completedAt?: number;
  readonly metadata?: Record<string, unknown>;

  constructor(config: AnnotationTaskConfig) {
    this.id = nanoid();
    this.name = config.name;
    this.description = config.description;
    this.instructions = config.instructions;
    this.schema = config.schema;
    this.status = 'draft';
    this.itemsPerAnnotator = config.itemsPerAnnotator ?? 100;
    this.annotatorsPerItem = config.annotatorsPerItem ?? 1;
    this.deadline = config.deadline;
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
    this.metadata = config.metadata;
  }

  /**
   * Start the task
   */
  start(): void {
    if (this.status !== 'draft') {
      throw new Error(`Cannot start task in ${this.status} status`);
    }
    this.status = 'active';
    this.updatedAt = Date.now();
  }

  /**
   * Pause the task
   */
  pause(): void {
    if (this.status !== 'active') {
      throw new Error(`Cannot pause task in ${this.status} status`);
    }
    this.status = 'paused';
    this.updatedAt = Date.now();
  }

  /**
   * Resume the task
   */
  resume(): void {
    if (this.status !== 'paused') {
      throw new Error(`Cannot resume task in ${this.status} status`);
    }
    this.status = 'active';
    this.updatedAt = Date.now();
  }

  /**
   * Complete the task
   */
  complete(): void {
    if (this.status !== 'active') {
      throw new Error(`Cannot complete task in ${this.status} status`);
    }
    this.status = 'completed';
    this.completedAt = Date.now();
    this.updatedAt = Date.now();
  }

  /**
   * Cancel the task
   */
  cancel(): void {
    if (this.status === 'completed') {
      throw new Error('Cannot cancel completed task');
    }
    this.status = 'cancelled';
    this.updatedAt = Date.now();
  }

  /**
   * Validate an annotation against the schema
   */
  validateAnnotation(value: unknown): { valid: boolean; error?: string } {
    try {
      this.schema.parse(value);
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          error: error.errors.map((e) => e.message).join(', '),
        };
      }
      return { valid: false, error: 'Unknown validation error' };
    }
  }

  /**
   * Check if task is past deadline
   */
  isPastDeadline(): boolean {
    if (!this.deadline) return false;
    return Date.now() > this.deadline.getTime();
  }

  /**
   * Get task configuration for display
   */
  toConfig(): AnnotationTaskConfig {
    return {
      name: this.name,
      description: this.description,
      instructions: this.instructions,
      schema: this.schema,
      itemsPerAnnotator: this.itemsPerAnnotator,
      annotatorsPerItem: this.annotatorsPerItem,
      deadline: this.deadline,
      metadata: this.metadata,
    };
  }
}

/**
 * Create an annotation task
 */
export function createAnnotationTask(
  config: AnnotationTaskConfig,
): AnnotationTask {
  return new AnnotationTask(config);
}

/**
 * Pre-built annotation schemas
 */

/**
 * Binary classification schema
 */
export const BinaryClassificationSchema = z.object({
  label: z.enum(['positive', 'negative']),
  confidence: z.number().min(0).max(1).optional(),
  notes: z.string().optional(),
});

/**
 * Quality rating schema
 */
export const QualityRatingSchema = z.object({
  accuracy: z.number().min(1).max(5),
  helpfulness: z.number().min(1).max(5),
  safety: z.enum(['pass', 'fail']),
  corrections: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * Text span annotation schema
 */
export const TextSpanSchema = z.object({
  spans: z.array(
    z.object({
      start: z.number(),
      end: z.number(),
      label: z.string(),
      text: z.string().optional(),
    }),
  ),
  notes: z.string().optional(),
});
