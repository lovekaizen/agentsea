/**
 * Cost Tracker
 *
 * Tracks individual API calls and their costs.
 */

import { EventEmitter } from 'eventemitter3';
import { nanoid } from 'nanoid';
import type {
  AIProvider,
  TokenUsage,
  CostBreakdown,
  CostRecord,
  CostAttribution,
  CostEvents,
  CostStorageAdapter,
} from '../types/index.js';
import type { ModelPricingRegistry } from '../pricing/ModelPricingRegistry.js';

/**
 * Cost tracker configuration
 */
export interface CostTrackerConfig {
  /** Pricing registry */
  pricingRegistry: ModelPricingRegistry;
  /** Storage adapter */
  storage?: CostStorageAdapter;
  /** Default attribution */
  defaultAttribution?: Partial<CostAttribution>;
  /** Auto-flush interval in ms (0 to disable) */
  autoFlushInterval?: number;
  /** Buffer size before auto-flush */
  bufferSize?: number;
  /** Enable real-time events */
  realTimeEvents?: boolean;
}

/**
 * Track API call options
 */
export interface TrackOptions {
  /** Provider */
  provider: AIProvider;
  /** Model */
  model: string;
  /** Token usage */
  tokens: TokenUsage;
  /** Request latency in ms */
  latencyMs?: number;
  /** Whether request succeeded */
  success?: boolean;
  /** Error message */
  error?: string;
  /** Attribution */
  attribution?: CostAttribution;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
  /** Custom timestamp */
  timestamp?: Date;
}

/**
 * Cost Tracker class
 */
export class CostTracker extends EventEmitter<CostEvents> {
  private pricingRegistry: ModelPricingRegistry;
  private storage?: CostStorageAdapter;
  private defaultAttribution?: Partial<CostAttribution>;
  private buffer: CostRecord[] = [];
  private bufferSize: number;
  private autoFlushTimer?: ReturnType<typeof setInterval>;
  private realTimeEvents: boolean;

  constructor(config: CostTrackerConfig) {
    super();
    this.pricingRegistry = config.pricingRegistry;
    this.storage = config.storage;
    this.defaultAttribution = config.defaultAttribution;
    this.bufferSize = config.bufferSize ?? 100;
    this.realTimeEvents = config.realTimeEvents ?? true;

    // Start auto-flush timer
    if (config.autoFlushInterval && config.autoFlushInterval > 0) {
      this.autoFlushTimer = setInterval(() => {
        this.flush().catch((err) => {
          this.emit('error', { message: 'Auto-flush failed', cause: err });
        });
      }, config.autoFlushInterval);
    }
  }

  /**
   * Track an API call
   */
  async track(options: TrackOptions): Promise<CostRecord> {
    // Calculate cost
    const cost = this.calculateCost(
      options.provider,
      options.model,
      options.tokens,
    );

    // Create record
    const record: CostRecord = {
      id: nanoid(),
      timestamp: options.timestamp ?? new Date(),
      provider: options.provider,
      model: options.model,
      tokens: options.tokens,
      cost,
      latencyMs: options.latencyMs,
      success: options.success ?? true,
      error: options.error,
      attribution: this.mergeAttribution(options.attribution),
      metadata: options.metadata,
    };

    // Add to buffer
    this.buffer.push(record);

    // Emit real-time event
    if (this.realTimeEvents) {
      this.emit('cost:recorded', record);
    }

    // Auto-flush if buffer is full
    if (this.buffer.length >= this.bufferSize) {
      await this.flush();
    }

    return record;
  }

  /**
   * Track from Anthropic API response
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
      attribution?: CostAttribution;
      metadata?: Record<string, unknown>;
    },
  ): Promise<CostRecord> {
    const usage = response.usage ?? { input_tokens: 0, output_tokens: 0 };

    return this.track({
      provider: 'anthropic',
      model: response.model,
      tokens: {
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        totalTokens: usage.input_tokens + usage.output_tokens,
        cacheReadTokens: usage.cache_read_input_tokens,
        cacheWriteTokens: usage.cache_creation_input_tokens,
      },
      latencyMs: options?.latencyMs,
      attribution: options?.attribution,
      metadata: options?.metadata,
    });
  }

  /**
   * Track from OpenAI API response
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
      attribution?: CostAttribution;
      metadata?: Record<string, unknown>;
    },
  ): Promise<CostRecord> {
    const usage = response.usage ?? {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    };

    return this.track({
      provider: 'openai',
      model: response.model,
      tokens: {
        inputTokens: usage.prompt_tokens,
        outputTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      },
      latencyMs: options?.latencyMs,
      attribution: options?.attribution,
      metadata: options?.metadata,
    });
  }

  /**
   * Track a failed request
   */
  async trackError(options: {
    provider: AIProvider;
    model: string;
    error: string;
    estimatedInputTokens?: number;
    latencyMs?: number;
    attribution?: CostAttribution;
    metadata?: Record<string, unknown>;
  }): Promise<CostRecord> {
    return this.track({
      provider: options.provider,
      model: options.model,
      tokens: {
        inputTokens: options.estimatedInputTokens ?? 0,
        outputTokens: 0,
        totalTokens: options.estimatedInputTokens ?? 0,
      },
      latencyMs: options.latencyMs,
      success: false,
      error: options.error,
      attribution: options.attribution,
      metadata: options.metadata,
    });
  }

  /**
   * Calculate cost for token usage
   */
  private calculateCost(
    provider: AIProvider,
    model: string,
    tokens: TokenUsage,
  ): CostBreakdown {
    try {
      const result = this.pricingRegistry.calculateCost(
        provider,
        model,
        tokens.inputTokens,
        tokens.outputTokens,
        {
          cacheReadTokens: tokens.cacheReadTokens,
          cacheWriteTokens: tokens.cacheWriteTokens,
        },
      );

      return {
        inputCost: result.inputCost,
        outputCost: result.outputCost,
        cacheReadCost: result.cacheReadCost,
        cacheCost: result.cacheCost,
        totalCost: result.totalCost,
        currency: result.currency,
      };
    } catch {
      // If no pricing found, return zero costs
      return {
        inputCost: 0,
        outputCost: 0,
        totalCost: 0,
        currency: 'USD',
      };
    }
  }

  /**
   * Merge attribution with defaults
   */
  private mergeAttribution(
    attribution?: CostAttribution,
  ): CostAttribution | undefined {
    if (!attribution && !this.defaultAttribution) {
      return undefined;
    }

    return {
      ...this.defaultAttribution,
      ...attribution,
      labels: {
        ...this.defaultAttribution?.labels,
        ...attribution?.labels,
      },
    };
  }

  /**
   * Flush buffer to storage
   */
  async flush(): Promise<number> {
    if (this.buffer.length === 0) {
      return 0;
    }

    const records = [...this.buffer];
    this.buffer = [];

    if (this.storage) {
      await this.storage.saveCostRecords(records);
    }

    this.emit('cost:batch', { records });

    return records.length;
  }

  /**
   * Get buffered records
   */
  getBuffer(): CostRecord[] {
    return [...this.buffer];
  }

  /**
   * Get buffer size
   */
  getBufferSize(): number {
    return this.buffer.length;
  }

  /**
   * Clear buffer without flushing
   */
  clearBuffer(): void {
    this.buffer = [];
  }

  /**
   * Set default attribution
   */
  setDefaultAttribution(attribution: Partial<CostAttribution>): void {
    this.defaultAttribution = attribution;
  }

  /**
   * Create a scoped tracker with preset attribution
   */
  scoped(attribution: Partial<CostAttribution>): ScopedCostTracker {
    return new ScopedCostTracker(this, attribution);
  }

  /**
   * Close tracker
   */
  async close(): Promise<void> {
    if (this.autoFlushTimer) {
      clearInterval(this.autoFlushTimer);
      this.autoFlushTimer = undefined;
    }

    await this.flush();
  }
}

/**
 * Scoped Cost Tracker
 *
 * A cost tracker with preset attribution for a specific scope.
 */
export class ScopedCostTracker {
  private parent: CostTracker;
  private scopeAttribution: Partial<CostAttribution>;

  constructor(parent: CostTracker, attribution: Partial<CostAttribution>) {
    this.parent = parent;
    this.scopeAttribution = attribution;
  }

  /**
   * Track an API call with scoped attribution
   */
  async track(
    options: Omit<TrackOptions, 'attribution'> & {
      attribution?: Partial<CostAttribution>;
    },
  ): Promise<CostRecord> {
    return this.parent.track({
      ...options,
      attribution: {
        ...this.scopeAttribution,
        ...options.attribution,
        labels: {
          ...this.scopeAttribution.labels,
          ...options.attribution?.labels,
        },
      },
    });
  }

  /**
   * Track Anthropic response
   */
  async trackAnthropicResponse(
    response: Parameters<CostTracker['trackAnthropicResponse']>[0],
    options?: Omit<
      NonNullable<Parameters<CostTracker['trackAnthropicResponse']>[1]>,
      'attribution'
    > & { attribution?: Partial<CostAttribution> },
  ): Promise<CostRecord> {
    return this.parent.trackAnthropicResponse(response, {
      ...options,
      attribution: {
        ...this.scopeAttribution,
        ...options?.attribution,
      },
    });
  }

  /**
   * Track OpenAI response
   */
  async trackOpenAIResponse(
    response: Parameters<CostTracker['trackOpenAIResponse']>[0],
    options?: Omit<
      NonNullable<Parameters<CostTracker['trackOpenAIResponse']>[1]>,
      'attribution'
    > & { attribution?: Partial<CostAttribution> },
  ): Promise<CostRecord> {
    return this.parent.trackOpenAIResponse(response, {
      ...options,
      attribution: {
        ...this.scopeAttribution,
        ...options?.attribution,
      },
    });
  }

  /**
   * Create a nested scope
   */
  scoped(attribution: Partial<CostAttribution>): ScopedCostTracker {
    return new ScopedCostTracker(this.parent, {
      ...this.scopeAttribution,
      ...attribution,
      labels: {
        ...this.scopeAttribution.labels,
        ...attribution.labels,
      },
    });
  }
}
