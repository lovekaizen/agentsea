/**
 * AnnotationQueue
 *
 * Manage annotation task queues and assignments.
 */

import { nanoid } from 'nanoid';
import { EventEmitter } from 'eventemitter3';
import type {
  AnnotationItem,
  AnnotationItemStatus,
  Annotation,
  AnnotationQueueConfig,
  QueueStats,
  BatchAssignment,
  ConsensusResult,
} from '../types/index.js';
import type { AnnotationTask } from './AnnotationTask.js';
import { ConsensusManager } from './ConsensusManager.js';

interface QueueEvents {
  'item:assigned': (itemId: string, annotatorId: string) => void;
  'item:annotated': (itemId: string, annotation: Annotation) => void;
  'item:consensus': (itemId: string, consensus: ConsensusResult) => void;
  'item:flagged': (itemId: string, reason: string) => void;
}

/**
 * Annotation queue
 */
export class AnnotationQueue extends EventEmitter<QueueEvents> {
  readonly task: AnnotationTask;
  private items: Map<string, AnnotationItem>;
  private annotatorAssignments: Map<string, Set<string>>;
  private annotatorCounts: Map<string, number>;

  constructor(config: AnnotationQueueConfig) {
    super();
    this.task = config.task as AnnotationTask;
    this.items = new Map();
    this.annotatorAssignments = new Map();
    this.annotatorCounts = new Map();

    // Initialize items
    for (const item of config.items) {
      this.items.set(item.id, item);
    }
  }

  /**
   * Get next item for annotator
   */
  getNextItem(annotatorId: string): AnnotationItem | null {
    const assigned = this.annotatorAssignments.get(annotatorId) ?? new Set();

    // First pass: prefer items with no assignments (for efficient distribution)
    for (const item of this.items.values()) {
      // Skip already assigned to this annotator
      if (assigned.has(item.id)) continue;

      // Skip completed items
      if (item.status === 'completed') continue;

      // Skip items that have enough annotators assigned
      const assignedCount = item.assignedTo?.length ?? 0;
      if (assignedCount >= this.task.annotatorsPerItem) continue;

      // Prefer unassigned items
      if (assignedCount === 0) {
        this.assignItem(item.id, annotatorId);
        return item;
      }
    }

    // Second pass: assign partially assigned items
    for (const item of this.items.values()) {
      // Skip already assigned to this annotator
      if (assigned.has(item.id)) continue;

      // Skip completed items
      if (item.status === 'completed') continue;

      // Skip items that have enough annotators assigned
      const assignedCount = item.assignedTo?.length ?? 0;
      if (assignedCount >= this.task.annotatorsPerItem) continue;

      // Assign this item
      this.assignItem(item.id, annotatorId);
      return item;
    }

    return null;
  }

  /**
   * Assign item to annotator
   */
  assignItem(itemId: string, annotatorId: string): void {
    const item = this.items.get(itemId);
    if (!item) {
      throw new Error(`Item ${itemId} not found`);
    }

    // Track assignment
    if (!this.annotatorAssignments.has(annotatorId)) {
      this.annotatorAssignments.set(annotatorId, new Set());
    }
    this.annotatorAssignments.get(annotatorId)!.add(itemId);

    // Update item
    if (!item.assignedTo) {
      item.assignedTo = [];
    }
    if (!item.assignedTo.includes(annotatorId)) {
      item.assignedTo.push(annotatorId);
    }
    item.status = 'assigned';
    item.updatedAt = Date.now();

    this.emit('item:assigned', itemId, annotatorId);
  }

  /**
   * Submit annotation for item
   */
  submitAnnotation(
    itemId: string,
    annotatorId: string,
    value: Record<string, unknown>,
    duration: number,
  ): Annotation {
    const item = this.items.get(itemId);
    if (!item) {
      throw new Error(`Item ${itemId} not found`);
    }

    // Validate annotation
    const validation = this.task.validateAnnotation(value);
    if (!validation.valid) {
      throw new Error(`Invalid annotation: ${validation.error}`);
    }

    const annotation: Annotation = {
      id: nanoid(),
      itemId,
      annotatorId,
      value,
      duration,
      createdAt: Date.now(),
    };

    item.annotations.push(annotation);
    item.updatedAt = Date.now();

    // Update annotator count
    this.annotatorCounts.set(
      annotatorId,
      (this.annotatorCounts.get(annotatorId) ?? 0) + 1,
    );

    // Check if item has enough annotations
    if (item.annotations.length >= this.task.annotatorsPerItem) {
      item.status = 'completed';
    } else {
      item.status = 'in_progress';
    }

    this.emit('item:annotated', itemId, annotation);

    return annotation;
  }

  /**
   * Flag item for review
   */
  flagItem(itemId: string, reason: string): void {
    const item = this.items.get(itemId);
    if (!item) {
      throw new Error(`Item ${itemId} not found`);
    }

    item.status = 'flagged';
    item.updatedAt = Date.now();

    this.emit('item:flagged', itemId, reason);
  }

  /**
   * Skip item
   */
  skipItem(itemId: string, annotatorId: string): void {
    const item = this.items.get(itemId);
    if (!item) {
      throw new Error(`Item ${itemId} not found`);
    }

    // Remove from annotator's assignments
    const assigned = this.annotatorAssignments.get(annotatorId);
    if (assigned) {
      assigned.delete(itemId);
    }

    // Remove annotator from item
    if (item.assignedTo) {
      const idx = item.assignedTo.indexOf(annotatorId);
      if (idx >= 0) {
        item.assignedTo.splice(idx, 1);
      }
    }

    item.updatedAt = Date.now();
  }

  /**
   * Get batch assignment for annotator
   */
  getBatchAssignment(annotatorId: string, count: number): BatchAssignment {
    const itemIds: string[] = [];

    for (let i = 0; i < count; i++) {
      const item = this.getNextItem(annotatorId);
      if (!item) break;
      itemIds.push(item.id);
    }

    return {
      annotatorId,
      itemIds,
    };
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    let pending = 0;
    let assigned = 0;
    let completed = 0;
    let flagged = 0;
    let totalAnnotations = 0;

    // Inter-annotator agreement is only defined for items annotated by 2+ people.
    const consensus = new ConsensusManager({ method: 'majority' });
    let agreementSum = 0;
    let agreementItems = 0;

    for (const item of this.items.values()) {
      switch (item.status) {
        case 'pending':
          pending++;
          break;
        case 'assigned':
        case 'in_progress':
          assigned++;
          break;
        case 'completed':
          completed++;
          break;
        case 'flagged':
          flagged++;
          break;
      }
      totalAnnotations += item.annotations.length;

      if (item.annotations.length >= 2) {
        agreementSum += consensus.calculateAgreement(item.annotations);
        agreementItems++;
      }
    }

    const avgAnnotationsPerItem =
      this.items.size > 0 ? totalAnnotations / this.items.size : 0;

    return {
      taskId: this.task.id,
      totalItems: this.items.size,
      pendingItems: pending,
      assignedItems: assigned,
      completedItems: completed,
      flaggedItems: flagged,
      averageAnnotationsPerItem: avgAnnotationsPerItem,
      averageAgreement: agreementItems > 0 ? agreementSum / agreementItems : 0,
    };
  }

  /**
   * Get item by ID
   */
  getItem(itemId: string): AnnotationItem | undefined {
    return this.items.get(itemId);
  }

  /**
   * Get all items
   */
  getItems(): AnnotationItem[] {
    return Array.from(this.items.values());
  }

  /**
   * Get items by status
   */
  getItemsByStatus(status: AnnotationItemStatus): AnnotationItem[] {
    return Array.from(this.items.values()).filter(
      (item) => item.status === status,
    );
  }

  /**
   * Get annotator's completed count
   */
  getAnnotatorCount(annotatorId: string): number {
    return this.annotatorCounts.get(annotatorId) ?? 0;
  }
}

/**
 * Create an annotation queue
 */
export function createAnnotationQueue(
  config: AnnotationQueueConfig,
): AnnotationQueue {
  return new AnnotationQueue(config);
}
