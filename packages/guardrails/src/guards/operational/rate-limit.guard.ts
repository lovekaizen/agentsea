/**
 * Rate Limit Guard
 *
 * Implements request rate limiting with sliding window algorithm.
 */

import type {
  GuardContext,
  GuardResult,
  GuardConfig,
  ContentType,
} from '../../types';
import { BaseGuard } from '../../core/base-guard';
import { GuardRegistry } from '../../core/guard-registry';

/**
 * Rate limit guard configuration
 */
export interface RateLimitGuardOptions extends Partial<GuardConfig> {
  /** Maximum requests per window */
  maxRequests: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** Rate limit by key */
  keyBy?: 'user' | 'session' | 'ip' | 'global';
  /** Skip successful requests from count */
  skipSuccessfulRequests?: boolean;
  /** Custom key extractor */
  keyExtractor?: (context: GuardContext) => string;
}

/**
 * Rate limit details
 */
export interface RateLimitDetails {
  /** Current request count in window */
  currentCount: number;
  /** Maximum requests allowed */
  maxRequests: number;
  /** Remaining requests */
  remaining: number;
  /** Window reset time */
  resetTime: Date;
  /** Time until reset in ms */
  retryAfterMs: number;
  /** Rate limit key used */
  key: string;
}

/**
 * Request record for sliding window
 */
interface RequestRecord {
  timestamps: number[];
}

/**
 * Rate limit storage
 */
const requestRecords = new Map<string, RequestRecord>();

/**
 * Rate Limit Guard
 *
 * Implements sliding window rate limiting.
 */
export class RateLimitGuard extends BaseGuard<void, RateLimitDetails> {
  readonly name = 'rate-limit';
  readonly supportedTypes: ContentType[] = ['input'];

  private maxRequests: number;
  private windowMs: number;
  private keyBy: 'user' | 'session' | 'ip' | 'global';
  private skipSuccessfulRequests: boolean;
  private keyExtractor?: (context: GuardContext) => string;

  constructor(options: RateLimitGuardOptions) {
    super(options);
    this.maxRequests = options.maxRequests ?? 60;
    this.windowMs = options.windowMs ?? 60000; // 1 minute default
    this.keyBy = options.keyBy ?? 'global';
    this.skipSuccessfulRequests = options.skipSuccessfulRequests ?? false;
    this.keyExtractor = options.keyExtractor;
  }

  protected doCheck(
    context: GuardContext,
  ): Promise<GuardResult<RateLimitDetails>> {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get rate limit key
    const key = this.getKey(context);

    // Get or create request record
    let record = requestRecords.get(key);
    if (!record) {
      record = { timestamps: [] };
      requestRecords.set(key, record);
    }

    // Clean old timestamps
    record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

    // Count requests in window
    const currentCount = record.timestamps.length;

    // Calculate remaining and reset time
    const remaining = Math.max(0, this.maxRequests - currentCount);
    const oldestTimestamp = record.timestamps[0] ?? now;
    const resetTime = new Date(oldestTimestamp + this.windowMs);
    const retryAfterMs = Math.max(0, resetTime.getTime() - now);

    const details: RateLimitDetails = {
      currentCount,
      maxRequests: this.maxRequests,
      remaining,
      resetTime,
      retryAfterMs,
      key,
    };

    // Check if rate limited
    if (currentCount >= this.maxRequests) {
      return Promise.resolve(
        this.fail(
          `Rate limit exceeded: ${currentCount}/${this.maxRequests} requests. Retry after ${Math.ceil(retryAfterMs / 1000)}s`,
          details,
        ),
      );
    }

    // Record this request
    if (!this.skipSuccessfulRequests) {
      record.timestamps.push(now);
    }

    // Warn if approaching limit
    if (remaining <= Math.ceil(this.maxRequests * 0.2)) {
      return Promise.resolve(
        this.warn(
          `Approaching rate limit: ${remaining} requests remaining`,
          details,
        ),
      );
    }

    return Promise.resolve(
      this.pass(details, `Rate limit OK: ${remaining} requests remaining`),
    );
  }

  /**
   * Get rate limit key based on configuration
   */
  private getKey(context: GuardContext): string {
    if (this.keyExtractor) {
      return this.keyExtractor(context);
    }

    switch (this.keyBy) {
      case 'user':
        return `user:${context.userId ?? 'anonymous'}`;
      case 'session':
        return `session:${context.sessionId ?? 'default'}`;
      case 'ip':
        return `ip:${(context.metadata?.ip as string) ?? 'unknown'}`;
      case 'global':
      default:
        return 'global';
    }
  }

  /**
   * Reset rate limit for a key
   */
  static reset(key: string): void {
    requestRecords.delete(key);
  }

  /**
   * Reset all rate limits
   */
  static resetAll(): void {
    requestRecords.clear();
  }

  /**
   * Get current count for a key
   */
  static getCount(key: string, windowMs: number): number {
    const record = requestRecords.get(key);
    if (!record) return 0;

    const windowStart = Date.now() - windowMs;
    return record.timestamps.filter((ts) => ts > windowStart).length;
  }

  /**
   * Mark a request as successful (for skipSuccessfulRequests option)
   */
  markSuccess(context: GuardContext): void {
    if (this.skipSuccessfulRequests) {
      const key = this.getKey(context);
      const record = requestRecords.get(key);
      if (record && record.timestamps.length > 0) {
        record.timestamps.pop();
      }
    }
  }
}

// Register the guard
GuardRegistry.register({
  metadata: {
    name: 'rate-limit',
    description: 'Implements request rate limiting with sliding window',
    category: 'operational',
    supportedTypes: ['input'],
    defaultConfig: {
      enabled: true,
      onFailure: 'block',
      options: {
        maxRequests: 60,
        windowMs: 60000,
        keyBy: 'global',
      },
    },
  },
  factory: (config) =>
    new RateLimitGuard({
      ...config,
      maxRequests: (config.options?.maxRequests as number) ?? 60,
      windowMs: (config.options?.windowMs as number) ?? 60000,
    }),
});

export default RateLimitGuard;
