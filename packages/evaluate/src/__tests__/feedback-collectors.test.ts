/**
 * Tests for Feedback Collectors
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ThumbsCollector } from '../feedback/collectors/ThumbsCollector.js';
import { RatingCollector } from '../feedback/collectors/RatingCollector.js';
import { FeedbackStore } from '../feedback/FeedbackStore.js';
import type { FeedbackStoreInterface } from '../types/index.js';

describe('ThumbsCollector', () => {
  let collector: ThumbsCollector;
  let mockStore: FeedbackStoreInterface;

  beforeEach(() => {
    mockStore = {
      save: vi.fn(async (entry) => entry.id),
      saveBatch: vi.fn(),
      get: vi.fn(),
      query: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      close: vi.fn(),
    };

    collector = new ThumbsCollector();
  });

  describe('constructor', () => {
    it('should create collector with default options', () => {
      const c = new ThumbsCollector();
      expect(c).toBeDefined();
    });

    it('should accept custom options', () => {
      const c = new ThumbsCollector({
        allowComment: false,
        requireComment: 'always',
        autoTimestamp: false,
      });

      expect(c).toBeDefined();
    });
  });

  describe('collect', () => {
    it('should collect thumbs up feedback', async () => {
      const input = {
        responseId: 'resp-1',
        input: 'What is AI?',
        output: 'AI is Artificial Intelligence',
        feedback: {
          rating: 'up' as const,
        },
      };

      const result = await collector.collect(input);

      expect(result.type).toBe('thumbs');
      expect(result.rating).toBe('up');
      expect(result.responseId).toBe('resp-1');
      expect(result.id).toBeTruthy();
    });

    it('should collect thumbs down feedback', async () => {
      const input = {
        responseId: 'resp-1',
        input: 'Question',
        output: 'Answer',
        feedback: {
          rating: 'down' as const,
        },
      };

      const result = await collector.collect(input);

      expect(result.rating).toBe('down');
    });

    it('should include comment when provided', async () => {
      const input = {
        responseId: 'resp-1',
        input: 'Question',
        output: 'Answer',
        feedback: {
          rating: 'up' as const,
          comment: 'Great answer!',
        },
      };

      const result = await collector.collect(input);

      expect(result.comment).toBe('Great answer!');
    });

    it('should exclude comment when allowComment is false', async () => {
      const c = new ThumbsCollector({ allowComment: false });

      const input = {
        responseId: 'resp-1',
        input: 'Question',
        output: 'Answer',
        feedback: {
          rating: 'up' as const,
          comment: 'Comment',
        },
      };

      const result = await c.collect(input);

      expect(result.comment).toBeUndefined();
    });

    it('should include optional fields', async () => {
      const input = {
        responseId: 'resp-1',
        conversationId: 'conv-1',
        input: 'Question',
        output: 'Answer',
        feedback: {
          rating: 'up' as const,
        },
        userId: 'user-1',
        metadata: { source: 'web' },
      };

      const result = await collector.collect(input);

      expect(result.conversationId).toBe('conv-1');
      expect(result.userId).toBe('user-1');
      expect(result.metadata).toEqual({ source: 'web' });
    });

    it('should auto-generate timestamp when enabled', async () => {
      const c = new ThumbsCollector({ autoTimestamp: true });

      const input = {
        responseId: 'resp-1',
        input: 'Question',
        output: 'Answer',
        feedback: { rating: 'up' as const },
      };

      const result = await c.collect(input);

      expect(result.timestamp).toBeGreaterThan(0);
    });

    it('should save to store when provided', async () => {
      const c = new ThumbsCollector({ store: mockStore });

      const input = {
        responseId: 'resp-1',
        input: 'Question',
        output: 'Answer',
        feedback: { rating: 'up' as const },
      };

      await c.collect(input);

      expect(mockStore.save).toHaveBeenCalled();
    });
  });

  describe('validation', () => {
    it('should throw error without responseId', async () => {
      const input = {
        input: 'Question',
        output: 'Answer',
        feedback: { rating: 'up' as const },
      };

      await expect(collector.collect(input as any)).rejects.toThrow(
        'responseId',
      );
    });

    it('should throw error without input', async () => {
      const input = {
        responseId: 'resp-1',
        output: 'Answer',
        feedback: { rating: 'up' as const },
      };

      await expect(collector.collect(input as any)).rejects.toThrow('input');
    });

    it('should throw error without output', async () => {
      const input = {
        responseId: 'resp-1',
        input: 'Question',
        feedback: { rating: 'up' as const },
      };

      await expect(collector.collect(input as any)).rejects.toThrow('output');
    });

    it('should throw error without feedback', async () => {
      const input = {
        responseId: 'resp-1',
        input: 'Question',
        output: 'Answer',
      };

      await expect(collector.collect(input as any)).rejects.toThrow('feedback');
    });

    it('should throw error with invalid rating', async () => {
      const input = {
        responseId: 'resp-1',
        input: 'Question',
        output: 'Answer',
        feedback: { rating: 'invalid' as any },
      };

      await expect(collector.collect(input)).rejects.toThrow(
        'must be "up" or "down"',
      );
    });

    it('should require comment when configured (always)', async () => {
      const c = new ThumbsCollector({ requireComment: 'always' });

      const input = {
        responseId: 'resp-1',
        input: 'Question',
        output: 'Answer',
        feedback: { rating: 'up' as const },
      };

      await expect(c.collect(input)).rejects.toThrow('Comment is required');
    });

    it('should require comment for negative feedback when configured', async () => {
      const c = new ThumbsCollector({ requireComment: 'on_down' });

      const input = {
        responseId: 'resp-1',
        input: 'Question',
        output: 'Answer',
        feedback: { rating: 'down' as const },
      };

      await expect(c.collect(input)).rejects.toThrow('required for negative');
    });

    it('should not require comment for positive feedback when on_down', async () => {
      const c = new ThumbsCollector({ requireComment: 'on_down' });

      const input = {
        responseId: 'resp-1',
        input: 'Question',
        output: 'Answer',
        feedback: { rating: 'up' as const },
      };

      const result = await c.collect(input);

      expect(result).toBeDefined();
    });
  });

  describe('collectBatch', () => {
    it('should collect multiple feedback entries', async () => {
      const inputs = [
        {
          responseId: 'resp-1',
          input: 'Q1',
          output: 'A1',
          feedback: { rating: 'up' as const },
        },
        {
          responseId: 'resp-2',
          input: 'Q2',
          output: 'A2',
          feedback: { rating: 'down' as const },
        },
      ];

      const results = await collector.collectBatch(inputs);

      expect(results).toHaveLength(2);
      expect(results[0].rating).toBe('up');
      expect(results[1].rating).toBe('down');
    });

    it('should save batch to store when provided', async () => {
      const c = new ThumbsCollector({ store: mockStore });

      const inputs = [
        {
          responseId: 'resp-1',
          input: 'Q1',
          output: 'A1',
          feedback: { rating: 'up' as const },
        },
      ];

      await c.collectBatch(inputs);

      expect(mockStore.saveBatch).toHaveBeenCalled();
    });
  });
});

describe('RatingCollector', () => {
  let collector: RatingCollector;

  beforeEach(() => {
    collector = new RatingCollector();
  });

  describe('collect', () => {
    it('should collect rating feedback', async () => {
      const input = {
        responseId: 'resp-1',
        input: 'Question',
        output: 'Answer',
        feedback: {
          rating: 4,
        },
      };

      const result = await collector.collect(input);

      expect(result.type).toBe('rating');
      expect(result.rating).toBe(4);
    });

    it('should use custom max rating', async () => {
      const c = new RatingCollector({ maxRating: 10 });

      const input = {
        responseId: 'resp-1',
        input: 'Question',
        output: 'Answer',
        feedback: {
          rating: 8,
        },
      };

      const result = await c.collect(input);

      expect(result.maxRating).toBe(10);
      expect(result.rating).toBe(8);
    });

    it('should include comment when provided', async () => {
      const input = {
        responseId: 'resp-1',
        input: 'Question',
        output: 'Answer',
        feedback: {
          rating: 5,
          comment: 'Excellent!',
        },
      };

      const result = await collector.collect(input);

      expect(result.comment).toBe('Excellent!');
    });
  });

  describe('validation', () => {
    it('should throw error for rating below min', async () => {
      const c = new RatingCollector({ minRating: 1, maxRating: 5 });

      const input = {
        responseId: 'resp-1',
        input: 'Question',
        output: 'Answer',
        feedback: { rating: 0 },
      };

      await expect(c.collect(input)).rejects.toThrow('between 1 and 5');
    });

    it('should throw error for rating above max', async () => {
      const c = new RatingCollector({ minRating: 1, maxRating: 5 });

      const input = {
        responseId: 'resp-1',
        input: 'Question',
        output: 'Answer',
        feedback: { rating: 6 },
      };

      await expect(c.collect(input)).rejects.toThrow('between 1 and 5');
    });

    it('should accept valid rating', async () => {
      const c = new RatingCollector({ minRating: 1, maxRating: 5 });

      const input = {
        responseId: 'resp-1',
        input: 'Question',
        output: 'Answer',
        feedback: { rating: 3 },
      };

      const result = await c.collect(input);

      expect(result.rating).toBe(3);
    });

    it('should require comment for low ratings when configured', async () => {
      const c = new RatingCollector({
        maxRating: 5,
        requireComment: 'on_low',
        lowRatingThreshold: 3,
      });

      const input = {
        responseId: 'resp-1',
        input: 'Question',
        output: 'Answer',
        feedback: { rating: 2 },
      };

      await expect(c.collect(input)).rejects.toThrow('required for low');
    });

    it('should not require comment for high ratings', async () => {
      const c = new RatingCollector({
        maxRating: 5,
        requireComment: 'on_low',
        lowRatingThreshold: 3,
      });

      const input = {
        responseId: 'resp-1',
        input: 'Question',
        output: 'Answer',
        feedback: { rating: 5 },
      };

      const result = await c.collect(input);

      expect(result).toBeDefined();
    });

    it('should throw error without feedback', async () => {
      const input = {
        responseId: 'resp-1',
        input: 'Question',
        output: 'Answer',
      };

      await expect(collector.collect(input as any)).rejects.toThrow('feedback');
    });

    it('should throw error for non-number rating', async () => {
      const input = {
        responseId: 'resp-1',
        input: 'Question',
        output: 'Answer',
        feedback: { rating: 'five' as any },
      };

      await expect(collector.collect(input)).rejects.toThrow(
        'must be a number',
      );
    });
  });

  describe('edge cases', () => {
    it('should handle fractional ratings', async () => {
      const c = new RatingCollector({ minRating: 0, maxRating: 5 });

      const input = {
        responseId: 'resp-1',
        input: 'Question',
        output: 'Answer',
        feedback: { rating: 3.5 },
      };

      const result = await c.collect(input);

      expect(result.rating).toBe(3.5);
    });

    it('should handle custom rating scale', async () => {
      const c = new RatingCollector({ minRating: 0, maxRating: 100 });

      const input = {
        responseId: 'resp-1',
        input: 'Question',
        output: 'Answer',
        feedback: { rating: 75 },
      };

      const result = await c.collect(input);

      expect(result.rating).toBe(75);
      expect(result.maxRating).toBe(100);
    });
  });
});
