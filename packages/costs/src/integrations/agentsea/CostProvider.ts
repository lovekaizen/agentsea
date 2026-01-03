/**
 * Cost Provider for AgentSea
 *
 * Integrates cost tracking with AgentSea agents.
 */

import { EventEmitter } from 'eventemitter3';
import type {
  CostRecord,
  CostAttribution,
  CostSummary,
  BudgetCheckResult,
  AIProvider,
  BudgetManagerConfig,
  CostStorageAdapter,
} from '../../types/index.js';
import { CostManager, CostManagerOptions } from '../../core/CostManager.js';
import { BudgetManager } from '../../budgets/BudgetManager.js';
import { ScopedCostTracker } from '../../core/CostTracker.js';

/**
 * Provider events
 */
export interface CostProviderEvents {
  'cost:recorded': CostRecord;
  'cost:batch': { records: CostRecord[] };
  'budget:warning': { budgetId: string; message: string };
  'budget:exceeded': { budgetId: string; message: string };
  error: { message: string; cause?: unknown };
}

/**
 * Cost Provider configuration
 */
export interface CostProviderConfig {
  /** Storage adapter */
  storage?: CostStorageAdapter;
  /** Cost manager options */
  costManagerOptions?: CostManagerOptions;
  /** Budget manager options */
  budgetManagerOptions?: BudgetManagerConfig;
  /** Enable budget enforcement */
  enforceBudgets?: boolean;
  /** Default attribution for all calls */
  defaultAttribution?: Partial<CostAttribution>;
}

/**
 * Agent cost context
 */
export interface AgentCostContext {
  /** Agent ID */
  agentId: string;
  /** Session ID */
  sessionId?: string;
  /** User ID */
  userId?: string;
  /** Additional labels */
  labels?: Record<string, string>;
}

/**
 * Cost Provider for AgentSea agents
 */
export class CostProvider extends EventEmitter<CostProviderEvents> {
  private costManager: CostManager;
  private budgetManager?: BudgetManager;
  private enforceBudgets: boolean;
  private defaultAttribution?: Partial<CostAttribution>;
  private initialized = false;

  constructor(config: CostProviderConfig = {}) {
    super();

    this.enforceBudgets = config.enforceBudgets ?? false;
    this.defaultAttribution = config.defaultAttribution;

    // Initialize cost manager
    this.costManager = new CostManager({
      ...config.costManagerOptions,
      storage: config.storage,
      defaultAttribution: config.defaultAttribution,
    });

    // Initialize budget manager if enforcement is enabled
    if (this.enforceBudgets) {
      this.budgetManager = new BudgetManager(
        config.budgetManagerOptions ?? {},
        config.storage,
      );
    }

    // Forward events
    this.setupEventForwarding();
  }

  /**
   * Initialize the provider
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.costManager.initialize();
    if (this.budgetManager) {
      await this.budgetManager.initialize();
    }

    this.initialized = true;
  }

  /**
   * Close the provider
   */
  async close(): Promise<void> {
    await this.costManager.close();
    if (this.budgetManager) {
      this.budgetManager.close();
    }
    this.initialized = false;
  }

  /**
   * Create an agent cost tracker
   */
  createAgentTracker(context: AgentCostContext): AgentCostTracker {
    return new AgentCostTracker(
      this.costManager.scoped({
        agentId: context.agentId,
        sessionId: context.sessionId,
        userId: context.userId,
        labels: context.labels,
      }),
      this.budgetManager,
      this.enforceBudgets,
    );
  }

  /**
   * Track an API call
   */
  async track(
    provider: AIProvider,
    model: string,
    inputTokens: number,
    outputTokens: number,
    options?: {
      latencyMs?: number;
      success?: boolean;
      error?: string;
      attribution?: Partial<CostAttribution>;
      metadata?: Record<string, unknown>;
    },
  ): Promise<CostRecord> {
    return this.costManager.track({
      provider,
      model,
      tokens: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
      latencyMs: options?.latencyMs,
      success: options?.success ?? true,
      error: options?.error,
      attribution: options?.attribution,
      metadata: options?.metadata,
    });
  }

  /**
   * Check budget before making a call
   */
  async checkBudget(
    estimatedCost: number,
    attribution?: Partial<CostAttribution>,
  ): Promise<BudgetCheckResult> {
    if (!this.budgetManager) {
      return {
        allowed: true,
        matchingBudgets: [],
        exceededBudgets: [],
        warningBudgets: [],
        action: 'allow',
      };
    }

    return this.budgetManager.checkBudget({
      estimatedCost,
      attribution: {
        ...this.defaultAttribution,
        ...attribution,
      },
    });
  }

  /**
   * Get cost summary
   */
  async getSummary(options?: {
    startDate?: Date;
    endDate?: Date;
    agentId?: string;
    userId?: string;
  }): Promise<CostSummary> {
    return this.costManager.getSummary({
      startDate: options?.startDate,
      endDate: options?.endDate,
      agentIds: options?.agentId ? [options.agentId] : undefined,
      userIds: options?.userId ? [options.userId] : undefined,
    });
  }

  /**
   * Get cost manager
   */
  getCostManager(): CostManager {
    return this.costManager;
  }

  /**
   * Get budget manager
   */
  getBudgetManager(): BudgetManager | undefined {
    return this.budgetManager;
  }

  /**
   * Estimate cost for a request
   */
  async estimateCost(
    input: string | number,
    model: string,
    options?: {
      provider?: AIProvider;
      estimatedOutputTokens?: number;
    },
  ): Promise<number> {
    const result = await this.costManager.estimateCost(input, {
      model,
      provider: options?.provider,
      estimatedOutputTokens: options?.estimatedOutputTokens,
    });
    return result.estimatedCost;
  }

  /**
   * Setup event forwarding
   */
  private setupEventForwarding(): void {
    this.costManager.on('cost:recorded', (record) => {
      this.emit('cost:recorded', record);
    });

    this.costManager.on('cost:batch', (batch) => {
      this.emit('cost:batch', batch);
    });

    this.costManager.on('error', (error) => {
      this.emit('error', error);
    });

    if (this.budgetManager) {
      this.budgetManager.on('budget:warning', (alert) => {
        this.emit('budget:warning', {
          budgetId: alert.budgetId,
          message: alert.message,
        });
      });

      this.budgetManager.on('budget:exceeded', (alert) => {
        this.emit('budget:exceeded', {
          budgetId: alert.budgetId,
          message: alert.message,
        });
      });
    }
  }
}

/**
 * Agent Cost Tracker
 *
 * Scoped cost tracking for a specific agent.
 */
export class AgentCostTracker {
  private tracker: ScopedCostTracker;
  private budgetManager?: BudgetManager;
  private enforceBudgets: boolean;

  constructor(
    tracker: ScopedCostTracker,
    budgetManager?: BudgetManager,
    enforceBudgets = false,
  ) {
    this.tracker = tracker;
    this.budgetManager = budgetManager;
    this.enforceBudgets = enforceBudgets;
  }

  /**
   * Track an API call
   */
  async track(
    provider: AIProvider,
    model: string,
    inputTokens: number,
    outputTokens: number,
    options?: {
      latencyMs?: number;
      success?: boolean;
      error?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<CostRecord> {
    return this.tracker.track({
      provider,
      model,
      tokens: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
      latencyMs: options?.latencyMs,
      success: options?.success ?? true,
      error: options?.error,
      metadata: options?.metadata,
    });
  }

  /**
   * Track Anthropic response
   */
  async trackAnthropicResponse(
    response: {
      model: string;
      usage?: {
        input_tokens: number;
        output_tokens: number;
        cache_read_input_tokens?: number;
        cache_creation_input_tokens?: number;
      };
    },
    options?: {
      latencyMs?: number;
      metadata?: Record<string, unknown>;
    },
  ): Promise<CostRecord> {
    return this.tracker.trackAnthropicResponse(response, options);
  }

  /**
   * Track OpenAI response
   */
  async trackOpenAIResponse(
    response: {
      model: string;
      usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
    },
    options?: {
      latencyMs?: number;
      metadata?: Record<string, unknown>;
    },
  ): Promise<CostRecord> {
    return this.tracker.trackOpenAIResponse(response, options);
  }

  /**
   * Check budget before making a call
   */
  async checkBudget(estimatedCost: number): Promise<BudgetCheckResult> {
    if (!this.budgetManager) {
      return {
        allowed: true,
        matchingBudgets: [],
        exceededBudgets: [],
        warningBudgets: [],
        action: 'allow',
      };
    }

    return this.budgetManager.checkBudget({
      estimatedCost,
    });
  }

  /**
   * Wrap an async function with cost tracking
   */
  wrap<
    TArgs extends unknown[],
    TResult extends {
      model: string;
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
        prompt_tokens?: number;
        completion_tokens?: number;
      };
    },
  >(
    fn: (...args: TArgs) => Promise<TResult>,
    options: {
      provider: AIProvider;
      extractUsage?: (result: TResult) => {
        inputTokens: number;
        outputTokens: number;
      };
    },
  ): (...args: TArgs) => Promise<TResult> {
    return async (...args: TArgs): Promise<TResult> => {
      const startTime = Date.now();

      try {
        const result = await fn(...args);
        const latencyMs = Date.now() - startTime;

        // Extract usage
        let inputTokens = 0;
        let outputTokens = 0;

        if (options.extractUsage) {
          const usage = options.extractUsage(result);
          inputTokens = usage.inputTokens;
          outputTokens = usage.outputTokens;
        } else if (result.usage) {
          inputTokens =
            result.usage.input_tokens ?? result.usage.prompt_tokens ?? 0;
          outputTokens =
            result.usage.output_tokens ?? result.usage.completion_tokens ?? 0;
        }

        // Track the call
        await this.track(
          options.provider,
          result.model,
          inputTokens,
          outputTokens,
          { latencyMs },
        );

        return result;
      } catch (error) {
        const latencyMs = Date.now() - startTime;

        // Track the error
        await this.tracker.track({
          provider: options.provider,
          model: 'unknown',
          tokens: {
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
          },
          latencyMs,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });

        throw error;
      }
    };
  }

  /**
   * Create a nested scope
   */
  scoped(attribution: Partial<CostAttribution>): AgentCostTracker {
    return new AgentCostTracker(
      this.tracker.scoped(attribution),
      this.budgetManager,
      this.enforceBudgets,
    );
  }
}

/**
 * Create a cost provider
 */
export function createCostProvider(
  config: CostProviderConfig = {},
): CostProvider {
  return new CostProvider(config);
}
