/**
 * Tests for AnnotationQueue
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import { AnnotationQueue } from '../annotation/AnnotationQueue.js';
import { AnnotationTask } from '../annotation/AnnotationTask.js';
import type { AnnotationItem } from '../types/index.js';

describe('AnnotationQueue', () => {
  let task: AnnotationTask;
  let items: AnnotationItem[];

  beforeEach(() => {
    const schema = z.object({
      category: z.enum(['good', 'bad', 'neutral']),
    });

    task = new AnnotationTask({
      name: 'Test Task',
      description: 'Test annotation task',
      instructions: 'Classify the response',
      schema,
      annotatorsPerItem: 2,
    });

    items = [
      {
        id: 'item-1',
        taskId: task.id,
        data: { input: 'Test input 1', output: 'Test output 1' },
        status: 'pending' as const,
        priority: 0,
        annotations: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'item-2',
        taskId: task.id,
        data: { input: 'Test input 2', output: 'Test output 2' },
        status: 'pending' as const,
        priority: 0,
        annotations: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'item-3',
        taskId: task.id,
        data: { input: 'Test input 3', output: 'Test output 3' },
        status: 'pending' as const,
        priority: 0,
        annotations: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];
  });

  describe('constructor', () => {
    it('should create queue with task and items', () => {
      const queue = new AnnotationQueue({
        task,
        items,
      });

      expect(queue).toBeDefined();
      expect(queue.task).toBe(task);
      expect(queue.getItems()).toHaveLength(3);
    });
  });

  describe('getNextItem', () => {
    it('should return next available item for annotator', () => {
      const queue = new AnnotationQueue({ task, items });

      const item = queue.getNextItem('annotator-1');

      expect(item).toBeDefined();
      expect(item?.id).toBe('item-1');
      expect(item?.status).toBe('assigned');
    });

    it('should not return same item to same annotator', () => {
      const queue = new AnnotationQueue({ task, items });

      const item1 = queue.getNextItem('annotator-1');
      const item2 = queue.getNextItem('annotator-1');

      expect(item1?.id).toBe('item-1');
      expect(item2?.id).toBe('item-2');
      expect(item1?.id).not.toBe(item2?.id);
    });

    it('should return null when no items available', () => {
      const singleItem: AnnotationItem[] = [
        {
          id: 'item-1',
          taskId: task.id,
          data: { input: 'Test', output: 'Test' },
          status: 'pending' as const,
          priority: 0,
          annotations: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const queue = new AnnotationQueue({
        task,
        items: singleItem,
      });

      // First annotator gets the item
      queue.getNextItem('annotator-1');
      // Second annotator gets the item
      queue.getNextItem('annotator-2');
      // Third annotator should get null (item already has enough annotations)
      const item = queue.getNextItem('annotator-3');

      expect(item).toBeNull();
    });

    it('should skip completed items', () => {
      const completedItem: AnnotationItem = {
        id: 'completed',
        taskId: task.id,
        data: { input: 'Test', output: 'Test' },
        status: 'completed' as const,
        priority: 0,
        annotations: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const queue = new AnnotationQueue({
        task,
        items: [completedItem, ...items],
      });

      const item = queue.getNextItem('annotator-1');

      expect(item?.id).not.toBe('completed');
    });

    it('should emit item:assigned event', () => {
      const queue = new AnnotationQueue({ task, items });
      const listener = vi.fn();

      queue.on('item:assigned', listener);
      queue.getNextItem('annotator-1');

      expect(listener).toHaveBeenCalledWith('item-1', 'annotator-1');
    });
  });

  describe('assignItem', () => {
    it('should assign item to annotator', () => {
      const queue = new AnnotationQueue({ task, items });

      queue.assignItem('item-1', 'annotator-1');

      const item = queue.getItem('item-1');
      expect(item?.status).toBe('assigned');
      expect(item?.assignedTo).toContain('annotator-1');
    });

    it('should throw error for non-existent item', () => {
      const queue = new AnnotationQueue({ task, items });

      expect(() => {
        queue.assignItem('nonexistent', 'annotator-1');
      }).toThrow('not found');
    });

    it('should track multiple assignments', () => {
      const queue = new AnnotationQueue({ task, items });

      queue.assignItem('item-1', 'annotator-1');
      queue.assignItem('item-1', 'annotator-2');

      const item = queue.getItem('item-1');
      expect(item?.assignedTo).toContain('annotator-1');
      expect(item?.assignedTo).toContain('annotator-2');
    });

    it('should update timestamp', () => {
      const queue = new AnnotationQueue({ task, items });
      const originalTime = items[0].updatedAt;

      // Wait a bit to ensure timestamp changes
      setTimeout(() => {
        queue.assignItem('item-1', 'annotator-1');

        const item = queue.getItem('item-1');
        expect(item?.updatedAt).toBeGreaterThan(originalTime);
      }, 10);
    });
  });

  describe('submitAnnotation', () => {
    it('should submit valid annotation', () => {
      const queue = new AnnotationQueue({ task, items });
      queue.assignItem('item-1', 'annotator-1');

      const annotation = queue.submitAnnotation(
        'item-1',
        'annotator-1',
        { category: 'good' },
        5000,
      );

      expect(annotation).toBeDefined();
      expect(annotation.itemId).toBe('item-1');
      expect(annotation.annotatorId).toBe('annotator-1');
      expect(annotation.value).toEqual({ category: 'good' });
      expect(annotation.duration).toBe(5000);
    });

    it('should throw error for invalid annotation', () => {
      const queue = new AnnotationQueue({ task, items });

      expect(() => {
        queue.submitAnnotation(
          'item-1',
          'annotator-1',
          { invalid: 'data' },
          1000,
        );
      }).toThrow('Invalid annotation');
    });

    it('should update item status to in_progress', () => {
      const queue = new AnnotationQueue({ task, items });

      queue.submitAnnotation(
        'item-1',
        'annotator-1',
        { category: 'good' },
        1000,
      );

      const item = queue.getItem('item-1');
      expect(item?.status).toBe('in_progress');
    });

    it('should update item status to completed when enough annotations', () => {
      const queue = new AnnotationQueue({ task, items });

      queue.submitAnnotation(
        'item-1',
        'annotator-1',
        { category: 'good' },
        1000,
      );
      queue.submitAnnotation(
        'item-1',
        'annotator-2',
        { category: 'good' },
        1000,
      );

      const item = queue.getItem('item-1');
      expect(item?.status).toBe('completed');
      expect(item?.annotations).toHaveLength(2);
    });

    it('should increment annotator count', () => {
      const queue = new AnnotationQueue({ task, items });

      queue.submitAnnotation(
        'item-1',
        'annotator-1',
        { category: 'good' },
        1000,
      );
      queue.submitAnnotation(
        'item-2',
        'annotator-1',
        { category: 'bad' },
        1000,
      );

      expect(queue.getAnnotatorCount('annotator-1')).toBe(2);
    });

    it('should emit item:annotated event', () => {
      const queue = new AnnotationQueue({ task, items });
      const listener = vi.fn();

      queue.on('item:annotated', listener);
      queue.submitAnnotation(
        'item-1',
        'annotator-1',
        { category: 'good' },
        1000,
      );

      expect(listener).toHaveBeenCalled();
    });

    it('should throw error for non-existent item', () => {
      const queue = new AnnotationQueue({ task, items });

      expect(() => {
        queue.submitAnnotation(
          'nonexistent',
          'annotator-1',
          { category: 'good' },
          1000,
        );
      }).toThrow('not found');
    });
  });

  describe('flagItem', () => {
    it('should flag item for review', () => {
      const queue = new AnnotationQueue({ task, items });

      queue.flagItem('item-1', 'Unclear content');

      const item = queue.getItem('item-1');
      expect(item?.status).toBe('flagged');
    });

    it('should emit item:flagged event', () => {
      const queue = new AnnotationQueue({ task, items });
      const listener = vi.fn();

      queue.on('item:flagged', listener);
      queue.flagItem('item-1', 'Unclear content');

      expect(listener).toHaveBeenCalledWith('item-1', 'Unclear content');
    });

    it('should throw error for non-existent item', () => {
      const queue = new AnnotationQueue({ task, items });

      expect(() => {
        queue.flagItem('nonexistent', 'reason');
      }).toThrow('not found');
    });
  });

  describe('skipItem', () => {
    it('should remove item from annotator assignments', () => {
      const queue = new AnnotationQueue({ task, items });

      queue.assignItem('item-1', 'annotator-1');
      queue.skipItem('item-1', 'annotator-1');

      const item = queue.getItem('item-1');
      expect(item?.assignedTo).not.toContain('annotator-1');
    });

    it('should allow reassignment after skip', () => {
      const queue = new AnnotationQueue({ task, items });

      queue.assignItem('item-1', 'annotator-1');
      queue.skipItem('item-1', 'annotator-1');

      const nextItem = queue.getNextItem('annotator-1');
      expect(nextItem?.id).toBe('item-1');
    });

    it('should throw error for non-existent item', () => {
      const queue = new AnnotationQueue({ task, items });

      expect(() => {
        queue.skipItem('nonexistent', 'annotator-1');
      }).toThrow('not found');
    });
  });

  describe('getBatchAssignment', () => {
    it('should assign batch of items', () => {
      const queue = new AnnotationQueue({ task, items });

      const batch = queue.getBatchAssignment('annotator-1', 2);

      expect(batch.annotatorId).toBe('annotator-1');
      expect(batch.itemIds).toHaveLength(2);
      expect(batch.itemIds[0]).toBe('item-1');
      expect(batch.itemIds[1]).toBe('item-2');
    });

    it('should handle batch size larger than available items', () => {
      const queue = new AnnotationQueue({ task, items });

      const batch = queue.getBatchAssignment('annotator-1', 10);

      expect(batch.itemIds).toHaveLength(3);
    });

    it('should return empty batch when no items available', () => {
      const queue = new AnnotationQueue({ task, items: [] });

      const batch = queue.getBatchAssignment('annotator-1', 5);

      expect(batch.itemIds).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    it('should return queue statistics', () => {
      const queue = new AnnotationQueue({ task, items });

      const stats = queue.getStats();

      expect(stats.taskId).toBe(task.id);
      expect(stats.totalItems).toBe(3);
      expect(stats.pendingItems).toBe(3);
      expect(stats.assignedItems).toBe(0);
      expect(stats.completedItems).toBe(0);
      expect(stats.flaggedItems).toBe(0);
    });

    it('should reflect assigned items', () => {
      const queue = new AnnotationQueue({ task, items });

      queue.assignItem('item-1', 'annotator-1');
      queue.submitAnnotation(
        'item-1',
        'annotator-1',
        { category: 'good' },
        1000,
      );

      const stats = queue.getStats();

      expect(stats.assignedItems).toBe(1);
      expect(stats.pendingItems).toBe(2);
    });

    it('should reflect completed items', () => {
      const queue = new AnnotationQueue({ task, items });

      queue.submitAnnotation(
        'item-1',
        'annotator-1',
        { category: 'good' },
        1000,
      );
      queue.submitAnnotation(
        'item-1',
        'annotator-2',
        { category: 'good' },
        1000,
      );

      const stats = queue.getStats();

      expect(stats.completedItems).toBe(1);
    });

    it('should reflect flagged items', () => {
      const queue = new AnnotationQueue({ task, items });

      queue.flagItem('item-1', 'Unclear');

      const stats = queue.getStats();

      expect(stats.flaggedItems).toBe(1);
    });

    it('should calculate average annotations per item', () => {
      const queue = new AnnotationQueue({ task, items });

      queue.submitAnnotation(
        'item-1',
        'annotator-1',
        { category: 'good' },
        1000,
      );
      queue.submitAnnotation(
        'item-2',
        'annotator-1',
        { category: 'good' },
        1000,
      );

      const stats = queue.getStats();

      expect(stats.averageAnnotationsPerItem).toBeCloseTo(2 / 3);
    });
  });

  describe('getItem', () => {
    it('should return item by id', () => {
      const queue = new AnnotationQueue({ task, items });

      const item = queue.getItem('item-2');

      expect(item?.id).toBe('item-2');
      expect(item?.data.input).toBe('Test input 2');
    });

    it('should return undefined for non-existent item', () => {
      const queue = new AnnotationQueue({ task, items });

      const item = queue.getItem('nonexistent');

      expect(item).toBeUndefined();
    });
  });

  describe('getItems', () => {
    it('should return all items', () => {
      const queue = new AnnotationQueue({ task, items });

      const allItems = queue.getItems();

      expect(allItems).toHaveLength(3);
    });
  });

  describe('getItemsByStatus', () => {
    it('should filter items by status', () => {
      const queue = new AnnotationQueue({ task, items });

      queue.assignItem('item-1', 'annotator-1');
      queue.flagItem('item-2', 'reason');

      const pending = queue.getItemsByStatus('pending');
      const assigned = queue.getItemsByStatus('assigned');
      const flagged = queue.getItemsByStatus('flagged');

      expect(pending).toHaveLength(1);
      expect(assigned).toHaveLength(1);
      expect(flagged).toHaveLength(1);
    });
  });

  describe('getAnnotatorCount', () => {
    it('should return count for annotator', () => {
      const queue = new AnnotationQueue({ task, items });

      queue.submitAnnotation(
        'item-1',
        'annotator-1',
        { category: 'good' },
        1000,
      );
      queue.submitAnnotation(
        'item-2',
        'annotator-1',
        { category: 'bad' },
        1000,
      );
      queue.submitAnnotation(
        'item-3',
        'annotator-1',
        { category: 'neutral' },
        1000,
      );

      expect(queue.getAnnotatorCount('annotator-1')).toBe(3);
    });

    it('should return 0 for new annotator', () => {
      const queue = new AnnotationQueue({ task, items });

      expect(queue.getAnnotatorCount('new-annotator')).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty queue', () => {
      const queue = new AnnotationQueue({ task, items: [] });

      const item = queue.getNextItem('annotator-1');
      expect(item).toBeNull();

      const stats = queue.getStats();
      expect(stats.totalItems).toBe(0);
    });

    it('should handle multiple annotators efficiently', () => {
      const queue = new AnnotationQueue({ task, items });

      const item1 = queue.getNextItem('annotator-1');
      const item2 = queue.getNextItem('annotator-2');
      const item3 = queue.getNextItem('annotator-3');

      expect(item1?.id).toBe('item-1');
      expect(item2?.id).toBe('item-2');
      expect(item3?.id).toBe('item-3');
    });

    it('should prevent duplicate assignments to same annotator', () => {
      const queue = new AnnotationQueue({ task, items });

      queue.assignItem('item-1', 'annotator-1');
      queue.assignItem('item-1', 'annotator-1');

      const item = queue.getItem('item-1');
      expect(item?.assignedTo?.filter((a) => a === 'annotator-1')).toHaveLength(
        1,
      );
    });
  });

  describe('getStats', () => {
    it('reports zero agreement when no item has 2+ annotations', () => {
      const queue = new AnnotationQueue({ task, items });
      queue.submitAnnotation(
        'item-1',
        'annotator-1',
        { category: 'good' },
        100,
      );

      const stats = queue.getStats();
      expect(stats.totalItems).toBe(3);
      expect(stats.averageAgreement).toBe(0);
    });

    it('computes full agreement when both annotators agree', () => {
      const queue = new AnnotationQueue({ task, items });
      queue.submitAnnotation(
        'item-1',
        'annotator-1',
        { category: 'good' },
        100,
      );
      queue.submitAnnotation(
        'item-1',
        'annotator-2',
        { category: 'good' },
        100,
      );

      const stats = queue.getStats();
      expect(stats.averageAgreement).toBe(1);
    });

    it('computes partial agreement when annotators disagree', () => {
      const queue = new AnnotationQueue({ task, items });
      queue.submitAnnotation(
        'item-1',
        'annotator-1',
        { category: 'good' },
        100,
      );
      queue.submitAnnotation('item-1', 'annotator-2', { category: 'bad' }, 100);

      const stats = queue.getStats();
      // 2 annotators, max agreement on any single value is 1/2
      expect(stats.averageAgreement).toBe(0.5);
    });
  });
});
