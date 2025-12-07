import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RateLimiter, SlidingWindowRateLimiter } from '../rate-limiter';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    limiter = new RateLimiter(10, 2); // 10 max tokens, 2 tokens per second refill
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('consume', () => {
    it('should consume tokens when available', () => {
      expect(limiter.consume(1)).toBe(true);
      expect(limiter.getTokens()).toBe(9);
    });

    it('should consume multiple tokens', () => {
      expect(limiter.consume(5)).toBe(true);
      expect(limiter.getTokens()).toBe(5);
    });

    it('should return false when not enough tokens', () => {
      limiter.consume(8);
      expect(limiter.consume(5)).toBe(false);
    });

    it('should consume exactly the remaining tokens', () => {
      limiter.consume(7);
      expect(limiter.consume(3)).toBe(true);
      expect(limiter.getTokens()).toBe(0);
    });

    it('should default to consuming 1 token', () => {
      expect(limiter.consume()).toBe(true);
      expect(limiter.getTokens()).toBe(9);
    });
  });

  describe('token refill', () => {
    it('should refill tokens over time', () => {
      limiter.consume(10);
      expect(limiter.getTokens()).toBe(0);

      // Advance time by 1 second (should refill 2 tokens)
      vi.advanceTimersByTime(1000);

      expect(limiter.getTokens()).toBe(2);
    });

    it('should not exceed max tokens', () => {
      // Advance time significantly
      vi.advanceTimersByTime(10000);

      expect(limiter.getTokens()).toBe(10);
    });

    it('should refill proportionally', () => {
      limiter.consume(10);

      // Advance time by 500ms (should refill 1 token)
      vi.advanceTimersByTime(500);

      expect(limiter.getTokens()).toBe(1);
    });
  });

  describe('waitForTokens', () => {
    it('should resolve immediately when tokens available', async () => {
      const promise = limiter.waitForTokens(5);

      // Should resolve without waiting
      await expect(promise).resolves.toBeUndefined();
      expect(limiter.getTokens()).toBe(5);
    });

    it('should wait until tokens are available', async () => {
      limiter.consume(10);

      const promise = limiter.waitForTokens(2);

      // Advance time to refill tokens
      vi.advanceTimersByTime(1000);

      await promise;
      expect(limiter.getTokens()).toBe(0);
    });
  });

  describe('getTokens', () => {
    it('should return current token count', () => {
      expect(limiter.getTokens()).toBe(10);

      limiter.consume(3);
      expect(limiter.getTokens()).toBe(7);
    });

    it('should trigger refill when called', () => {
      limiter.consume(10);
      vi.advanceTimersByTime(500);

      // getTokens triggers refill
      expect(limiter.getTokens()).toBe(1);
    });
  });

  describe('reset', () => {
    it('should reset tokens to max', () => {
      limiter.consume(8);
      expect(limiter.getTokens()).toBe(2);

      limiter.reset();
      expect(limiter.getTokens()).toBe(10);
    });
  });
});

describe('SlidingWindowRateLimiter', () => {
  let limiter: SlidingWindowRateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    limiter = new SlidingWindowRateLimiter(5, 10000); // 5 requests per 10 seconds
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('isAllowed', () => {
    it('should allow requests within limit', () => {
      expect(limiter.isAllowed('user1')).toBe(true);
      expect(limiter.isAllowed('user1')).toBe(true);
      expect(limiter.isAllowed('user1')).toBe(true);
    });

    it('should block requests when limit exceeded', () => {
      for (let i = 0; i < 5; i++) {
        expect(limiter.isAllowed('user1')).toBe(true);
      }

      expect(limiter.isAllowed('user1')).toBe(false);
    });

    it('should track different keys separately', () => {
      for (let i = 0; i < 5; i++) {
        limiter.isAllowed('user1');
      }

      expect(limiter.isAllowed('user1')).toBe(false);
      expect(limiter.isAllowed('user2')).toBe(true);
    });

    it('should allow requests after window expires', () => {
      for (let i = 0; i < 5; i++) {
        limiter.isAllowed('user1');
      }

      expect(limiter.isAllowed('user1')).toBe(false);

      // Advance time past the window
      vi.advanceTimersByTime(10001);

      expect(limiter.isAllowed('user1')).toBe(true);
    });

    it('should use sliding window correctly', () => {
      // Make 3 requests
      limiter.isAllowed('user1');
      limiter.isAllowed('user1');
      limiter.isAllowed('user1');

      // Advance time by 5 seconds
      vi.advanceTimersByTime(5000);

      // Make 2 more requests (still within limit)
      expect(limiter.isAllowed('user1')).toBe(true);
      expect(limiter.isAllowed('user1')).toBe(true);

      // 6th request should fail (5 requests in 10 second window)
      expect(limiter.isAllowed('user1')).toBe(false);

      // Advance time by 5 more seconds (first 3 requests now outside window)
      vi.advanceTimersByTime(5001);

      // Should be allowed again
      expect(limiter.isAllowed('user1')).toBe(true);
    });
  });

  describe('getRemaining', () => {
    it('should return max requests when no requests made', () => {
      expect(limiter.getRemaining('user1')).toBe(5);
    });

    it('should return correct remaining count', () => {
      limiter.isAllowed('user1');
      limiter.isAllowed('user1');

      expect(limiter.getRemaining('user1')).toBe(3);
    });

    it('should return 0 when limit reached', () => {
      for (let i = 0; i < 5; i++) {
        limiter.isAllowed('user1');
      }

      expect(limiter.getRemaining('user1')).toBe(0);
    });

    it('should update after window expires', () => {
      for (let i = 0; i < 5; i++) {
        limiter.isAllowed('user1');
      }

      expect(limiter.getRemaining('user1')).toBe(0);

      vi.advanceTimersByTime(10001);

      expect(limiter.getRemaining('user1')).toBe(5);
    });
  });

  describe('reset', () => {
    it('should reset requests for a specific key', () => {
      for (let i = 0; i < 5; i++) {
        limiter.isAllowed('user1');
      }

      expect(limiter.isAllowed('user1')).toBe(false);

      limiter.reset('user1');

      expect(limiter.isAllowed('user1')).toBe(true);
      expect(limiter.getRemaining('user1')).toBe(4);
    });

    it('should not affect other keys', () => {
      limiter.isAllowed('user1');
      limiter.isAllowed('user2');

      limiter.reset('user1');

      expect(limiter.getRemaining('user1')).toBe(5);
      expect(limiter.getRemaining('user2')).toBe(4);
    });
  });

  describe('clear', () => {
    it('should reset all keys', () => {
      limiter.isAllowed('user1');
      limiter.isAllowed('user1');
      limiter.isAllowed('user2');

      limiter.clear();

      expect(limiter.getRemaining('user1')).toBe(5);
      expect(limiter.getRemaining('user2')).toBe(5);
    });
  });
});
