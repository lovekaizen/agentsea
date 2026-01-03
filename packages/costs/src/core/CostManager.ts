/**
 * Cost Manager
 *
 * Main orchestrator for cost management, providing a unified API
 * for tracking, budgeting, attribution, and analytics.
 */

import { EventEmitter } from 'eventemitter3';
import type {
  CostManagerConfig,
  CostRecord,
  CostAttribution,
  CostSummary,
  CostByDimension,
  CostTrendPoint,
  CostQueryOptions,
  CostEvents,
  CostStorageAdapter,
  AIProvider,
  TokenUsage,
} from '../types/index.js';
import { ModelPricingRegistry } from '../pricing/ModelPricingRegistry.js';
import { TokenCounter } from '../pricing/TokenCounter.js';
import { CostTracker, ScopedCostTracker, TrackOptions } from './CostTracker.js';

/**
 * Cost Manager initialization options
 */
export interface CostManagerOptions extends CostManagerConfig {
  /** Storage adapter */
  storage?: CostStorageAdapter;
  /** Custom pricing registry */
  pricingRegistry?: ModelPricingRegistry;
}

/**
 * Cost Manager class
 */
export class CostManager extends EventEmitter<CostEvents> {
  private storage?: CostStorageAdapter;
  private pricingRegistry: ModelPricingRegistry;
  private tokenCounter: TokenCounter;
  private tracker: CostTracker;
  private config: CostManagerConfig;
  private initialized = false;

  constructor(options: CostManagerOptions = {}) {
    super();

    this.config = {
      currency: options.currency ?? 'USD',
      autoFlushInterval: options.autoFlushInterval ?? 30000, // 30 seconds
      bufferSize: options.bufferSize ?? 100,
      realTimeTracking: options.realTimeTracking ?? true,
      defaultAttribution: options.defaultAttribution,
    };

    this.storage = options.storage;

    // Initialize pricing registry
    this.pricingRegistry =
      options.pricingRegistry ?? new ModelPricingRegistry();

    // Initialize token counter
    this.tokenCounter = new TokenCounter(this.pricingRegistry);

    // Initialize tracker
    this.tracker = new CostTracker({
      pricingRegistry: this.pricingRegistry,
      storage: this.storage,
      defaultAttribution: this.config.defaultAttribution,
      autoFlushInterval: this.config.autoFlushInterval,
      bufferSize: this.config.bufferSize,
      realTimeEvents: this.config.realTimeTracking,
    });

    // Forward tracker events
    this.tracker.on('cost:recorded', (record) => {
      this.emit('cost:recorded', record);
    });
    this.tracker.on('cost:batch', (records) => {
      this.emit('cost:batch', records);
    });
    this.tracker.on('error', (error) => {
      this.emit('error', error);
    });
  }

  /**
   * Initialize the cost manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (this.storage) {
      await this.storage.initialize();
    }

    this.initialized = true;
  }

  /**
   * Close the cost manager
   */
  async close(): Promise<void> {
    await this.tracker.close();

    if (this.storage) {
      await this.storage.close();
    }

    this.initialized = false;
  }

  // ==================== Tracking ====================

  /**
   * Track an API call
   */
  async track(options: TrackOptions): Promise<CostRecord> {
    return this.tracker.track(options);
  }

  /**
   * Track from Anthropic API response
   */
  async trackAnthropicResponse(
    response: Parameters<CostTracker['trackAnthropicResponse']>[0],
    options?: Parameters<CostTracker['trackAnthropicResponse']>[1],
  ): Promise<CostRecord> {
    return this.tracker.trackAnthropicResponse(response, options);
  }

  /**
   * Track from OpenAI API response
   */
  async trackOpenAIResponse(
    response: Parameters<CostTracker['trackOpenAIResponse']>[0],
    options?: Parameters<CostTracker['trackOpenAIResponse']>[1],
  ): Promise<CostRecord> {
    return this.tracker.trackOpenAIResponse(response, options);
  }

  /**
   * Track a failed request
   */
  async trackError(
    options: Parameters<CostTracker['trackError']>[0],
  ): Promise<CostRecord> {
    return this.tracker.trackError(options);
  }

  /**
   * Create a scoped tracker
   */
  scoped(attribution: Partial<CostAttribution>): ScopedCostTracker {
    return this.tracker.scoped(attribution);
  }

  /**
   * Flush pending records to storage
   */
  async flush(): Promise<number> {
    return this.tracker.flush();
  }

  // ==================== Token Counting ====================

  /**
   * Count tokens in text
   */
  async countTokens(
    text: string,
    options?: { model?: string; provider?: AIProvider },
  ): Promise<number> {
    const result = await this.tokenCounter.countTokens({
      text,
      model: options?.model,
      provider: options?.provider,
    });
    return result.tokens;
  }

  /**
   * Estimate cost before making a request
   */
  async estimateCost(
    input: string | number,
    options: {
      model: string;
      provider?: AIProvider;
      estimatedOutputTokens?: number;
    },
  ): Promise<{
    estimatedCost: number;
    inputTokens: number;
    outputTokens: number;
    currency: string;
  }> {
    const result = await this.tokenCounter.estimateCost({
      input,
      model: options.model,
      provider: options.provider,
      estimatedOutputTokens: options.estimatedOutputTokens,
    });

    return {
      estimatedCost: result.estimatedCost,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      currency: result.currency,
    };
  }

  // ==================== Pricing ====================

  /**
   * Get pricing registry
   */
  getPricingRegistry(): ModelPricingRegistry {
    return this.pricingRegistry;
  }

  /**
   * Get token counter
   */
  getTokenCounter(): TokenCounter {
    return this.tokenCounter;
  }

  /**
   * Calculate cost for token usage
   */
  calculateCost(
    provider: AIProvider,
    model: string,
    tokens: TokenUsage,
  ): {
    totalCost: number;
    inputCost: number;
    outputCost: number;
    currency: string;
  } {
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
      totalCost: result.totalCost,
      inputCost: result.inputCost,
      outputCost: result.outputCost,
      currency: result.currency,
    };
  }

  // ==================== Queries ====================

  /**
   * Get cost summary
   */
  async getSummary(options: CostQueryOptions = {}): Promise<CostSummary> {
    if (!this.storage) {
      throw new Error('Storage adapter required for queries');
    }

    return this.storage.getCostSummary(options);
  }

  /**
   * Get costs by dimension
   */
  async getCostsByDimension(
    dimension: string,
    options: CostQueryOptions = {},
  ): Promise<CostByDimension[]> {
    if (!this.storage) {
      throw new Error('Storage adapter required for queries');
    }

    return this.storage.getCostsByDimension(dimension, options);
  }

  /**
   * Get cost trends
   */
  async getCostTrends(
    options: CostQueryOptions = {},
  ): Promise<CostTrendPoint[]> {
    if (!this.storage) {
      throw new Error('Storage adapter required for queries');
    }

    return this.storage.getCostTrends(options);
  }

  /**
   * Query cost records
   */
  async queryRecords(options: CostQueryOptions = {}): Promise<CostRecord[]> {
    if (!this.storage) {
      throw new Error('Storage adapter required for queries');
    }

    return this.storage.queryCostRecords(options);
  }

  /**
   * Get a specific cost record
   */
  async getRecord(id: string): Promise<CostRecord | null> {
    if (!this.storage) {
      throw new Error('Storage adapter required for queries');
    }

    return this.storage.getCostRecord(id);
  }

  // ==================== Statistics ====================

  /**
   * Get total cost for a time period
   */
  async getTotalCost(options: CostQueryOptions = {}): Promise<number> {
    const summary = await this.getSummary(options);
    return summary.totalCost;
  }

  /**
   * Get total tokens for a time period
   */
  async getTotalTokens(options: CostQueryOptions = {}): Promise<number> {
    const summary = await this.getSummary(options);
    return summary.totalTokens;
  }

  /**
   * Get request count for a time period
   */
  async getRequestCount(options: CostQueryOptions = {}): Promise<number> {
    const summary = await this.getSummary(options);
    return summary.requestCount;
  }

  /**
   * Get error rate for a time period
   */
  async getErrorRate(options: CostQueryOptions = {}): Promise<number> {
    const summary = await this.getSummary(options);
    if (summary.requestCount === 0) return 0;
    return summary.errorCount / summary.requestCount;
  }

  /**
   * Get average cost per request
   */
  async getAvgCostPerRequest(options: CostQueryOptions = {}): Promise<number> {
    const summary = await this.getSummary(options);
    return summary.avgCostPerRequest;
  }

  // ==================== Top Consumers ====================

  /**
   * Get top models by cost
   */
  async getTopModels(
    options: CostQueryOptions & { limit?: number } = {},
  ): Promise<CostByDimension[]> {
    const results = await this.getCostsByDimension('model', options);
    return results
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, options.limit ?? 10);
  }

  /**
   * Get top users by cost
   */
  async getTopUsers(
    options: CostQueryOptions & { limit?: number } = {},
  ): Promise<CostByDimension[]> {
    const results = await this.getCostsByDimension('user', options);
    return results
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, options.limit ?? 10);
  }

  /**
   * Get top features by cost
   */
  async getTopFeatures(
    options: CostQueryOptions & { limit?: number } = {},
  ): Promise<CostByDimension[]> {
    const results = await this.getCostsByDimension('feature', options);
    return results
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, options.limit ?? 10);
  }

  // ==================== Maintenance ====================

  /**
   * Cleanup old records
   */
  async cleanup(olderThan: Date): Promise<number> {
    if (!this.storage) {
      throw new Error('Storage adapter required for cleanup');
    }

    return this.storage.cleanup(olderThan);
  }

  /**
   * Get storage stats
   */
  async getStorageStats(): Promise<{
    recordCount: number;
    storageSizeBytes?: number;
    oldestRecord?: Date;
    newestRecord?: Date;
  }> {
    if (!this.storage) {
      return { recordCount: 0 };
    }

    const stats = await this.storage.getStats();
    return {
      recordCount: stats.costRecordCount,
      storageSizeBytes: stats.storageSizeBytes,
      oldestRecord: stats.oldestRecord,
      newestRecord: stats.newestRecord,
    };
  }

  /**
   * Optimize storage
   */
  async optimizeStorage(): Promise<void> {
    if (!this.storage) {
      throw new Error('Storage adapter required for optimization');
    }

    await this.storage.optimize();
  }

  // ==================== Export/Import ====================

  /**
   * Export cost records
   */
  async exportRecords(options: CostQueryOptions = {}): Promise<{
    records: CostRecord[];
    summary: CostSummary;
    exportedAt: Date;
  }> {
    const [records, summary] = await Promise.all([
      this.queryRecords(options),
      this.getSummary(options),
    ]);

    return {
      records,
      summary,
      exportedAt: new Date(),
    };
  }

  /**
   * Import cost records
   */
  async importRecords(records: CostRecord[]): Promise<number> {
    if (!this.storage) {
      throw new Error('Storage adapter required for import');
    }

    await this.storage.saveCostRecords(records);
    return records.length;
  }
}

/**
 * Create a cost manager with default configuration
 */
export function createCostManager(options?: CostManagerOptions): CostManager {
  return new CostManager(options);
}
