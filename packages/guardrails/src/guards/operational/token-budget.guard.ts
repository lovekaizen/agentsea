/**
 * Token Budget Guard
 *
 * Enforces token limits per request and session.
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
 * Token budget guard configuration
 */
export interface TokenBudgetGuardOptions extends Partial<GuardConfig> {
  /** Maximum tokens per request */
  maxTokensPerRequest?: number;
  /** Maximum tokens per session */
  maxTokensPerSession?: number;
  /** Warning threshold (0-1) */
  warningThreshold?: number;
  /** Token counter function */
  tokenCounter?: (text: string) => number;
}

/**
 * Token budget details
 */
export interface TokenBudgetDetails {
  /** Tokens in current content */
  currentTokens: number;
  /** Session total tokens */
  sessionTokens: number;
  /** Remaining request tokens */
  remainingRequestTokens: number;
  /** Remaining session tokens */
  remainingSessionTokens: number;
  /** Whether approaching limit */
  isApproachingLimit: boolean;
  /** Usage percentage */
  usagePercentage: number;
}

/**
 * Session token storage
 */
const sessionTokens = new Map<string, number>();

/**
 * Simple token counter (approximation)
 * For production, use a proper tokenizer like tiktoken
 */
function simpleTokenCounter(text: string): number {
  // Rough approximation: ~4 characters per token for English
  return Math.ceil(text.length / 4);
}

/**
 * Token Budget Guard
 *
 * Enforces token limits for requests and sessions.
 */
export class TokenBudgetGuard extends BaseGuard<void, TokenBudgetDetails> {
  readonly name = 'token-budget';
  readonly supportedTypes: ContentType[] = ['input', 'output'];

  private maxTokensPerRequest: number;
  private maxTokensPerSession: number;
  private warningThreshold: number;
  private tokenCounter: (text: string) => number;

  constructor(options: TokenBudgetGuardOptions = {}) {
    super(options);
    this.maxTokensPerRequest = options.maxTokensPerRequest ?? 4096;
    this.maxTokensPerSession = options.maxTokensPerSession ?? 100000;
    this.warningThreshold = options.warningThreshold ?? 0.8;
    this.tokenCounter = options.tokenCounter ?? simpleTokenCounter;
  }

  protected doCheck(
    context: GuardContext,
  ): Promise<GuardResult<TokenBudgetDetails>> {
    const { input, sessionId } = context;

    // Count tokens
    const currentTokens = this.tokenCounter(input);

    // Get session tokens
    const session = sessionId ?? 'default';
    const currentSessionTokens = sessionTokens.get(session) ?? 0;

    // Calculate remaining
    const remainingRequestTokens = Math.max(
      0,
      this.maxTokensPerRequest - currentTokens,
    );
    const remainingSessionTokens = Math.max(
      0,
      this.maxTokensPerSession - currentSessionTokens - currentTokens,
    );

    // Calculate usage
    const requestUsage = currentTokens / this.maxTokensPerRequest;
    const sessionUsage =
      (currentSessionTokens + currentTokens) / this.maxTokensPerSession;
    const usagePercentage = Math.max(requestUsage, sessionUsage);

    const isApproachingLimit = usagePercentage >= this.warningThreshold;

    const details: TokenBudgetDetails = {
      currentTokens,
      sessionTokens: currentSessionTokens,
      remainingRequestTokens,
      remainingSessionTokens,
      isApproachingLimit,
      usagePercentage,
    };

    // Check request limit
    if (currentTokens > this.maxTokensPerRequest) {
      return Promise.resolve(
        this.fail(
          `Token limit exceeded: ${currentTokens} tokens (max: ${this.maxTokensPerRequest})`,
          details,
        ),
      );
    }

    // Check session limit
    if (currentSessionTokens + currentTokens > this.maxTokensPerSession) {
      return Promise.resolve(
        this.fail(
          `Session token limit exceeded: ${currentSessionTokens + currentTokens} tokens (max: ${this.maxTokensPerSession})`,
          details,
        ),
      );
    }

    // Update session tokens
    sessionTokens.set(session, currentSessionTokens + currentTokens);

    // Warn if approaching limit
    if (isApproachingLimit) {
      return Promise.resolve(
        this.warn(
          `Approaching token limit: ${(usagePercentage * 100).toFixed(1)}% used`,
          details,
        ),
      );
    }

    return Promise.resolve(
      this.pass(
        details,
        `Token budget OK: ${currentTokens} tokens (${(usagePercentage * 100).toFixed(1)}% used)`,
      ),
    );
  }

  /**
   * Reset session tokens
   */
  static resetSession(sessionId: string): void {
    sessionTokens.delete(sessionId);
  }

  /**
   * Reset all sessions
   */
  static resetAllSessions(): void {
    sessionTokens.clear();
  }

  /**
   * Get session token count
   */
  static getSessionTokens(sessionId: string): number {
    return sessionTokens.get(sessionId) ?? 0;
  }
}

// Register the guard
GuardRegistry.register({
  metadata: {
    name: 'token-budget',
    description: 'Enforces token limits per request and session',
    category: 'operational',
    supportedTypes: ['input', 'output'],
    defaultConfig: {
      enabled: true,
      onFailure: 'block',
      threshold: 0.8,
      sensitivity: 'medium',
    },
  },
  factory: (config) => new TokenBudgetGuard(config),
});

export default TokenBudgetGuard;
