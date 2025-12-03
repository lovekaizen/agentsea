/**
 * Token bucket rate limiter
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private maxTokens: number,
    private refillRate: number, // tokens per second
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  /**
   * Try to consume tokens
   */
  consume(tokens: number = 1): boolean {
    this.refill();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }

    return false;
  }

  /**
   * Wait until tokens are available
   */
  async waitForTokens(tokens: number = 1): Promise<void> {
    while (!this.consume(tokens)) {
      const waitTime =
        Math.ceil((tokens - this.tokens) / this.refillRate) * 1000;
      await this.sleep(Math.min(waitTime, 1000));
    }
  }

  /**
   * Get remaining tokens
   */
  getTokens(): number {
    this.refill();
    return this.tokens;
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }

  /**
   * Refill tokens based on time elapsed
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000; // seconds
    const tokensToAdd = elapsed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Simple sliding window rate limiter
 */
export class SlidingWindowRateLimiter {
  private requests: Map<string, number[]> = new Map();

  constructor(
    private maxRequests: number,
    private windowMs: number,
  ) {}

  /**
   * Check if request is allowed
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];

    // Remove old requests outside the window
    const validRequests = requests.filter((time) => now - time < this.windowMs);

    if (validRequests.length < this.maxRequests) {
      validRequests.push(now);
      this.requests.set(key, validRequests);
      return true;
    }

    this.requests.set(key, validRequests);
    return false;
  }

  /**
   * Get remaining requests
   */
  getRemaining(key: string): number {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    const validRequests = requests.filter((time) => now - time < this.windowMs);
    return Math.max(0, this.maxRequests - validRequests.length);
  }

  /**
   * Reset for a specific key
   */
  reset(key: string): void {
    this.requests.delete(key);
  }

  /**
   * Clear all
   */
  clear(): void {
    this.requests.clear();
  }
}
