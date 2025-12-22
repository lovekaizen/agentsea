/**
 * Cost Guard
 *
 * Tracks and enforces cost limits for AI operations.
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
 * Cost guard configuration
 */
export interface CostGuardOptions extends Partial<GuardConfig> {
  /** Maximum cost per request (in cents) */
  maxCostPerRequest?: number;
  /** Maximum cost per session (in cents) */
  maxCostPerSession?: number;
  /** Maximum daily cost (in cents) */
  maxDailyCost?: number;
  /** Cost per input token (in cents) */
  costPerInputToken?: number;
  /** Cost per output token (in cents) */
  costPerOutputToken?: number;
  /** Token counter function */
  tokenCounter?: (text: string) => number;
  /** Warning threshold (0-1) */
  warningThreshold?: number;
}

/**
 * Cost details
 */
export interface CostDetails {
  /** Estimated cost of current request (cents) */
  estimatedCost: number;
  /** Total session cost (cents) */
  sessionCost: number;
  /** Total daily cost (cents) */
  dailyCost: number;
  /** Remaining session budget (cents) */
  remainingSessionBudget: number;
  /** Remaining daily budget (cents) */
  remainingDailyBudget: number;
  /** Token counts */
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  /** Is approaching limit */
  isApproachingLimit: boolean;
}

/**
 * Cost tracking storage
 */
interface CostRecord {
  sessionCost: number;
  dailyCost: number;
  lastReset: Date;
}

const costRecords = new Map<string, CostRecord>();

/**
 * Simple token counter (approximation)
 */
function simpleTokenCounter(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Get or create cost record
 */
function getCostRecord(key: string): CostRecord {
  let record = costRecords.get(key);
  const now = new Date();

  if (!record) {
    record = {
      sessionCost: 0,
      dailyCost: 0,
      lastReset: now,
    };
    costRecords.set(key, record);
    return record;
  }

  // Reset daily cost if new day
  const lastResetDay = record.lastReset.toDateString();
  const today = now.toDateString();
  if (lastResetDay !== today) {
    record.dailyCost = 0;
    record.lastReset = now;
  }

  return record;
}

/**
 * Cost Guard
 *
 * Tracks and enforces cost limits.
 */
export class CostGuard extends BaseGuard<void, CostDetails> {
  readonly name = 'cost';
  readonly supportedTypes: ContentType[] = ['input', 'output'];

  private maxCostPerRequest: number;
  private maxCostPerSession: number;
  private maxDailyCost: number;
  private costPerInputToken: number;
  private costPerOutputToken: number;
  private tokenCounter: (text: string) => number;
  private warningThreshold: number;

  constructor(options: CostGuardOptions = {}) {
    super(options);
    // Default costs based on Claude 3.5 Sonnet pricing (approximate)
    // $3 per million input tokens, $15 per million output tokens
    this.maxCostPerRequest = options.maxCostPerRequest ?? 100; // $1
    this.maxCostPerSession = options.maxCostPerSession ?? 1000; // $10
    this.maxDailyCost = options.maxDailyCost ?? 10000; // $100
    this.costPerInputToken = options.costPerInputToken ?? 0.0003; // $3/1M
    this.costPerOutputToken = options.costPerOutputToken ?? 0.0015; // $15/1M
    this.tokenCounter = options.tokenCounter ?? simpleTokenCounter;
    this.warningThreshold = options.warningThreshold ?? 0.8;
  }

  protected doCheck(context: GuardContext): Promise<GuardResult<CostDetails>> {
    const { input, type, sessionId } = context;

    // Count tokens
    const tokens = this.tokenCounter(input);

    // Calculate cost based on type
    const isInput = type === 'input';
    const costPerToken = isInput
      ? this.costPerInputToken
      : this.costPerOutputToken;
    const estimatedCost = tokens * costPerToken;

    // Get cost record
    const key = sessionId ?? 'default';
    const record = getCostRecord(key);

    // Calculate totals
    const newSessionCost = record.sessionCost + estimatedCost;
    const newDailyCost = record.dailyCost + estimatedCost;

    // Calculate remaining budgets
    const remainingSessionBudget = Math.max(
      0,
      this.maxCostPerSession - newSessionCost,
    );
    const remainingDailyBudget = Math.max(0, this.maxDailyCost - newDailyCost);

    // Calculate usage
    const sessionUsage = newSessionCost / this.maxCostPerSession;
    const dailyUsage = newDailyCost / this.maxDailyCost;
    const maxUsage = Math.max(sessionUsage, dailyUsage);
    const isApproachingLimit = maxUsage >= this.warningThreshold;

    const details: CostDetails = {
      estimatedCost,
      sessionCost: newSessionCost,
      dailyCost: newDailyCost,
      remainingSessionBudget,
      remainingDailyBudget,
      tokens: {
        input: isInput ? tokens : 0,
        output: isInput ? 0 : tokens,
        total: tokens,
      },
      isApproachingLimit,
    };

    // Check request limit
    if (estimatedCost > this.maxCostPerRequest) {
      return Promise.resolve(
        this.fail(
          `Request cost too high: ${this.formatCost(estimatedCost)} (max: ${this.formatCost(this.maxCostPerRequest)})`,
          details,
        ),
      );
    }

    // Check session limit
    if (newSessionCost > this.maxCostPerSession) {
      return Promise.resolve(
        this.fail(
          `Session cost limit exceeded: ${this.formatCost(newSessionCost)} (max: ${this.formatCost(this.maxCostPerSession)})`,
          details,
        ),
      );
    }

    // Check daily limit
    if (newDailyCost > this.maxDailyCost) {
      return Promise.resolve(
        this.fail(
          `Daily cost limit exceeded: ${this.formatCost(newDailyCost)} (max: ${this.formatCost(this.maxDailyCost)})`,
          details,
        ),
      );
    }

    // Update cost record
    record.sessionCost = newSessionCost;
    record.dailyCost = newDailyCost;

    // Warn if approaching limit
    if (isApproachingLimit) {
      return Promise.resolve(
        this.warn(
          `Approaching cost limit: ${(maxUsage * 100).toFixed(1)}% of budget used`,
          details,
        ),
      );
    }

    return Promise.resolve(
      this.pass(
        details,
        `Cost OK: ${this.formatCost(estimatedCost)} (session: ${this.formatCost(newSessionCost)})`,
      ),
    );
  }

  /**
   * Format cost in dollars
   */
  private formatCost(cents: number): string {
    return `$${(cents / 100).toFixed(4)}`;
  }

  /**
   * Reset session cost
   */
  static resetSession(sessionId: string): void {
    const record = costRecords.get(sessionId);
    if (record) {
      record.sessionCost = 0;
    }
  }

  /**
   * Reset all costs
   */
  static resetAll(): void {
    costRecords.clear();
  }

  /**
   * Get current costs
   */
  static getCosts(
    sessionId: string,
  ): { session: number; daily: number } | null {
    const record = costRecords.get(sessionId);
    if (!record) return null;

    return {
      session: record.sessionCost,
      daily: record.dailyCost,
    };
  }
}

// Register the guard
GuardRegistry.register({
  metadata: {
    name: 'cost',
    description: 'Tracks and enforces cost limits for AI operations',
    category: 'operational',
    supportedTypes: ['input', 'output'],
    defaultConfig: {
      enabled: true,
      onFailure: 'block',
      threshold: 0.8,
      sensitivity: 'medium',
    },
  },
  factory: (config) => new CostGuard(config),
});

export default CostGuard;
