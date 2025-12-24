/**
 * Tests for FeedbackStore
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MemoryFeedbackStore,
  createFeedbackStore,
} from '../feedback/FeedbackStore.js';
import type { FeedbackEntry } from '../types/index.js';

describe('MemoryFeedbackStore', () => {
  let store: MemoryFeedbackStore;

  beforeEach(() => {
    store = new MemoryFeedbackStore();
  });

  describe('save', () => {
    it('should save feedback entry', async () => {
      const entry: FeedbackEntry = {
        id: 'fb-1',
        type: 'thumbs',
        responseId: 'resp-1',
        input: 'What is AI?',
        output: 'AI is Artificial Intelligence',
        rating: 'up',
        timestamp: Date.now(),
      };

      const id = await store.save(entry);

      expect(id).toBe('fb-1');
    });

    it('should retrieve saved entry', async () => {
      const entry: FeedbackEntry = {
        id: 'fb-2',
        type: 'rating',
        responseId: 'resp-2',
        input: 'Question',
        output: 'Answer',
        rating: 4,
        timestamp: Date.now(),
      };

      await store.save(entry);
      const retrieved = await store.get('fb-2');

      expect(retrieved).toEqual(entry);
    });
  });

  describe('saveBatch', () => {
    it('should save multiple entries', async () => {
      const entries: FeedbackEntry[] = [
        {
          id: 'fb-1',
          type: 'thumbs',
          responseId: 'r1',
          input: 'Q1',
          output: 'A1',
          rating: 'up',
          timestamp: Date.now(),
        },
        {
          id: 'fb-2',
          type: 'thumbs',
          responseId: 'r2',
          input: 'Q2',
          output: 'A2',
          rating: 'down',
          timestamp: Date.now(),
        },
      ];

      const ids = await store.saveBatch(entries);

      expect(ids).toHaveLength(2);
      expect(ids).toEqual(['fb-1', 'fb-2']);
    });
  });

  describe('get', () => {
    it('should return null for non-existent entry', async () => {
      const entry = await store.get('nonexistent');
      expect(entry).toBeNull();
    });

    it('should retrieve entry by id', async () => {
      const entry: FeedbackEntry = {
        id: 'fb-3',
        type: 'rating',
        responseId: 'resp-3',
        input: 'Test',
        output: 'Test answer',
        rating: 5,
        timestamp: Date.now(),
      };

      await store.save(entry);
      const retrieved = await store.get('fb-3');

      expect(retrieved?.id).toBe('fb-3');
      expect(retrieved?.rating).toBe(5);
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      const entries: FeedbackEntry[] = [
        {
          id: 'fb-1',
          type: 'thumbs',
          responseId: 'r1',
          conversationId: 'conv-1',
          userId: 'user-1',
          input: 'Q1',
          output: 'A1',
          rating: 'up',
          timestamp: 1000,
        },
        {
          id: 'fb-2',
          type: 'rating',
          responseId: 'r2',
          conversationId: 'conv-1',
          userId: 'user-2',
          input: 'Q2',
          output: 'A2',
          rating: 4,
          timestamp: 2000,
        },
        {
          id: 'fb-3',
          type: 'thumbs',
          responseId: 'r3',
          conversationId: 'conv-2',
          userId: 'user-1',
          input: 'Q3',
          output: 'A3',
          rating: 'down',
          timestamp: 3000,
        },
      ];

      await store.saveBatch(entries);
    });

    it('should query all entries', async () => {
      const result = await store.query({});

      expect(result.entries).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.hasMore).toBe(false);
    });

    it('should filter by type', async () => {
      const result = await store.query({ type: 'thumbs' });

      expect(result.entries).toHaveLength(2);
      expect(result.entries.every((e) => e.type === 'thumbs')).toBe(true);
    });

    it('should filter by multiple types', async () => {
      const result = await store.query({ type: ['thumbs', 'rating'] });

      expect(result.entries).toHaveLength(3);
    });

    it('should filter by userId', async () => {
      const result = await store.query({ userId: 'user-1' });

      expect(result.entries).toHaveLength(2);
      expect(result.entries.every((e) => e.userId === 'user-1')).toBe(true);
    });

    it('should filter by conversationId', async () => {
      const result = await store.query({ conversationId: 'conv-1' });

      expect(result.entries).toHaveLength(2);
    });

    it('should filter by responseId', async () => {
      const result = await store.query({ responseId: 'r2' });

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].id).toBe('fb-2');
    });

    it('should filter by time range', async () => {
      const result = await store.query({
        startTime: 1500,
        endTime: 2500,
      });

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].id).toBe('fb-2');
    });

    it('should filter by metadata', async () => {
      const entry: FeedbackEntry = {
        id: 'fb-meta',
        type: 'rating',
        responseId: 'r',
        input: 'Q',
        output: 'A',
        rating: 5,
        timestamp: Date.now(),
        metadata: { tag: 'important', category: 'test' },
      };

      await store.save(entry);

      const result = await store.query({
        metadata: { tag: 'important' },
      });

      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.entries.some((e) => e.id === 'fb-meta')).toBe(true);
    });

    it('should order by timestamp ascending', async () => {
      const result = await store.query({
        orderBy: 'timestamp',
        orderDir: 'asc',
      });

      expect(result.entries[0].id).toBe('fb-1');
      expect(result.entries[2].id).toBe('fb-3');
    });

    it('should order by timestamp descending', async () => {
      const result = await store.query({
        orderBy: 'timestamp',
        orderDir: 'desc',
      });

      expect(result.entries[0].id).toBe('fb-3');
      expect(result.entries[2].id).toBe('fb-1');
    });

    it('should order by rating', async () => {
      const result = await store.query({
        orderBy: 'rating',
        orderDir: 'desc',
      });

      expect(result.entries).toHaveLength(3);
    });

    it('should paginate results', async () => {
      const result = await store.query({
        limit: 2,
        offset: 0,
      });

      expect(result.entries).toHaveLength(2);
      expect(result.total).toBe(3);
      expect(result.hasMore).toBe(true);
    });

    it('should handle second page', async () => {
      const result = await store.query({
        limit: 2,
        offset: 2,
      });

      expect(result.entries).toHaveLength(1);
      expect(result.hasMore).toBe(false);
    });

    it('should combine filters', async () => {
      const result = await store.query({
        type: 'thumbs',
        userId: 'user-1',
        orderBy: 'timestamp',
        orderDir: 'desc',
      });

      expect(result.entries).toHaveLength(2);
      expect(result.entries[0].id).toBe('fb-3');
    });
  });

  describe('delete', () => {
    it('should delete existing entry', async () => {
      const entry: FeedbackEntry = {
        id: 'fb-del',
        type: 'thumbs',
        responseId: 'r',
        input: 'Q',
        output: 'A',
        rating: 'up',
        timestamp: Date.now(),
      };

      await store.save(entry);
      const deleted = await store.delete('fb-del');

      expect(deleted).toBe(true);

      const retrieved = await store.get('fb-del');
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent entry', async () => {
      const deleted = await store.delete('nonexistent');
      expect(deleted).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all entries', async () => {
      await store.saveBatch([
        {
          id: '1',
          type: 'thumbs',
          responseId: 'r',
          input: 'Q',
          output: 'A',
          rating: 'up',
          timestamp: Date.now(),
        },
        {
          id: '2',
          type: 'thumbs',
          responseId: 'r',
          input: 'Q',
          output: 'A',
          rating: 'down',
          timestamp: Date.now(),
        },
      ]);

      await store.clear();

      const result = await store.query({});
      expect(result.entries).toHaveLength(0);
    });
  });

  describe('close', () => {
    it('should close without errors', async () => {
      await expect(store.close()).resolves.toBeUndefined();
    });
  });

  describe('feedback types', () => {
    it('should handle thumbs feedback', async () => {
      const entry: FeedbackEntry = {
        id: 'thumbs-1',
        type: 'thumbs',
        responseId: 'r',
        input: 'Q',
        output: 'A',
        rating: 'up',
        timestamp: Date.now(),
      };

      await store.save(entry);
      const retrieved = await store.get('thumbs-1');

      expect(retrieved?.type).toBe('thumbs');
      expect(retrieved?.rating).toBe('up');
    });

    it('should handle rating feedback', async () => {
      const entry: FeedbackEntry = {
        id: 'rating-1',
        type: 'rating',
        responseId: 'r',
        input: 'Q',
        output: 'A',
        rating: 4,
        maxRating: 5,
        timestamp: Date.now(),
      };

      await store.save(entry);
      const retrieved = await store.get('rating-1');

      expect(retrieved?.type).toBe('rating');
      expect(retrieved?.rating).toBe(4);
    });

    it('should handle preference feedback', async () => {
      const entry: FeedbackEntry = {
        id: 'pref-1',
        type: 'preference',
        responseId: 'r',
        input: 'Q',
        output: 'A',
        preferredResponse: 'Better answer',
        alternativeResponse: 'Worse answer',
        timestamp: Date.now(),
      };

      await store.save(entry);
      const retrieved = await store.get('pref-1');

      expect(retrieved?.type).toBe('preference');
      expect(retrieved?.preferredResponse).toBe('Better answer');
    });

    it('should handle correction feedback', async () => {
      const entry: FeedbackEntry = {
        id: 'corr-1',
        type: 'correction',
        responseId: 'r',
        input: 'Q',
        output: 'Wrong answer',
        correctedOutput: 'Correct answer',
        timestamp: Date.now(),
      };

      await store.save(entry);
      const retrieved = await store.get('corr-1');

      expect(retrieved?.type).toBe('correction');
      expect(retrieved?.correctedOutput).toBe('Correct answer');
    });

    it('should handle multi-criteria feedback', async () => {
      const entry: FeedbackEntry = {
        id: 'multi-1',
        type: 'multi_criteria',
        responseId: 'r',
        input: 'Q',
        output: 'A',
        criteriaRatings: {
          accuracy: 5,
          clarity: 4,
          helpfulness: 3,
        },
        overallRating: 4,
        timestamp: Date.now(),
      };

      await store.save(entry);
      const retrieved = await store.get('multi-1');

      expect(retrieved?.type).toBe('multi_criteria');
      expect(retrieved?.criteriaRatings).toEqual({
        accuracy: 5,
        clarity: 4,
        helpfulness: 3,
      });
    });
  });
});

describe('createFeedbackStore', () => {
  it('should create memory store', () => {
    const store = createFeedbackStore({ type: 'memory' });
    expect(store).toBeInstanceOf(MemoryFeedbackStore);
  });

  it('should throw error for sqlite without path', () => {
    expect(() => {
      createFeedbackStore({ type: 'sqlite' });
    }).toThrow('requires a path');
  });

  it('should throw error for unknown type', () => {
    expect(() => {
      createFeedbackStore({ type: 'unknown' as any });
    }).toThrow('Unknown store type');
  });
});
