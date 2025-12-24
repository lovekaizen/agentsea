/**
 * InvalidationManager
 *
 * Manages cache invalidation strategies.
 */

import EventEmitter from 'eventemitter3';
import type {
  InvalidationManagerConfig,
  InvalidationEvent,
  InvalidationResult,
  InvalidationStats,
} from '../types/index.js';
import type { BaseCacheStore } from '../stores/BaseCacheStore.js';
import { now } from '../core/utils.js';

/**
 * InvalidationManager events
 */
export interface InvalidationManagerEvents {
  invalidate: (event: InvalidationEvent) => void;
  error: (error: Error) => void;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: InvalidationManagerConfig = {
  strategy: 'ttl',
  ttl: {
    defaultTtl: 3600,
    softTtl: false,
  },
  emitEvents: true,
};

/**
 * InvalidationManager
 *
 * Manages cache invalidation across different strategies.
 *
 * @example
 * ```typescript
 * const invalidation = new InvalidationManager(store, {
 *   strategy: 'ttl',
 *   ttl: { defaultTtl: 3600 }
 * });
 *
 * // Run invalidation
 * const result = await invalidation.run();
 *
 * // Or start automatic invalidation
 * invalidation.startAuto(60000); // Run every minute
 * ```
 */
export class InvalidationManager extends EventEmitter<InvalidationManagerEvents> {
  private store: BaseCacheStore;
  private config: InvalidationManagerConfig;
  private autoInterval: ReturnType<typeof setInterval> | null = null;
  private stats: InvalidationStats = {
    totalInvalidations: 0,
    ttlRemovals: 0,
    lruRemovals: 0,
    eventRemovals: 0,
    smartRemovals: 0,
    manualRemovals: 0,
    totalBytesFreed: 0,
  };
  private accessTimes: Map<string, number> = new Map();

  constructor(store: BaseCacheStore, config?: InvalidationManagerConfig) {
    super();
    this.store = store;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Run invalidation based on configured strategy
   */
  async run(): Promise<InvalidationResult> {
    switch (this.config.strategy) {
      case 'ttl':
        return this.runTTLInvalidation();
      case 'lru':
        return this.runLRUInvalidation();
      case 'smart':
        return this.runSmartInvalidation();
      default:
        return this.runTTLInvalidation();
    }
  }

  /**
   * Run TTL-based invalidation
   */
  async runTTLInvalidation(): Promise<InvalidationResult> {
    const startTime = performance.now();
    const invalidatedKeys: string[] = [];
    let bytesFreed = 0;
    const currentTime = now();

    const keys = await this.store.keys();

    for (const key of keys) {
      const entry = await this.store.get(key);
      if (!entry) continue;

      // Use entry's TTL if set, otherwise fall back to config-based TTL
      const ttl =
        entry.metadata.ttl ??
        this.getTTL(entry.request.model, entry.metadata.namespace);
      const age = (currentTime - entry.metadata.createdAt) / 1000; // Convert to seconds

      if (age >= ttl) {
        // Check soft TTL grace period
        if (this.config.ttl?.softTtl && this.config.ttl?.gracePeriod) {
          if (age < ttl + this.config.ttl.gracePeriod) {
            // In grace period, skip
            continue;
          }
        }

        const deleted = await this.store.delete(key);
        if (deleted) {
          invalidatedKeys.push(key);
          bytesFreed += this.estimateEntrySize(entry);
        }
      }
    }

    this.stats.totalInvalidations++;
    this.stats.ttlRemovals += invalidatedKeys.length;
    this.stats.totalBytesFreed += bytesFreed;
    this.stats.lastInvalidationAt = now();

    const result: InvalidationResult = {
      invalidatedKeys,
      entriesRemoved: invalidatedKeys.length,
      bytesFreed,
      durationMs: performance.now() - startTime,
    };

    this.emitEvent('ttl', invalidatedKeys, bytesFreed);
    return result;
  }

  /**
   * Run LRU-based invalidation
   */
  async runLRUInvalidation(): Promise<InvalidationResult> {
    const startTime = performance.now();
    const invalidatedKeys: string[] = [];
    let bytesFreed = 0;

    const maxEntries = this.config.lru?.maxEntries ?? 1000;
    const _maxSizeBytes = this.config.lru?.maxSizeBytes ?? Infinity;
    const batchSize = this.config.lru?.evictionBatchSize ?? 10;
    const minAge = this.config.lru?.minAge ?? 0;

    const currentSize = await this.store.size();
    if (currentSize <= maxEntries) {
      return {
        invalidatedKeys: [],
        entriesRemoved: 0,
        bytesFreed: 0,
        durationMs: performance.now() - startTime,
      };
    }

    // Get all entries and sort by last access time
    const keys = await this.store.keys();
    const entriesWithAccess: Array<{
      key: string;
      accessedAt: number;
      size: number;
    }> = [];

    for (const key of keys) {
      const entry = await this.store.get(key);
      if (entry) {
        entriesWithAccess.push({
          key,
          accessedAt: entry.metadata.accessedAt,
          size: this.estimateEntrySize(entry),
        });
      }
    }

    // Sort by least recently accessed
    entriesWithAccess.sort((a, b) => a.accessedAt - b.accessedAt);

    // Remove until under limit
    const toRemove = Math.min(currentSize - maxEntries, batchSize);
    const currentTime = now();

    for (let i = 0; i < toRemove && i < entriesWithAccess.length; i++) {
      const { key, accessedAt, size } = entriesWithAccess[i];

      // Check minimum age
      const age = (currentTime - accessedAt) / 1000;
      if (age < minAge) continue;

      const deleted = await this.store.delete(key);
      if (deleted) {
        invalidatedKeys.push(key);
        bytesFreed += size;
      }
    }

    this.stats.totalInvalidations++;
    this.stats.lruRemovals += invalidatedKeys.length;
    this.stats.totalBytesFreed += bytesFreed;
    this.stats.lastInvalidationAt = now();

    const result: InvalidationResult = {
      invalidatedKeys,
      entriesRemoved: invalidatedKeys.length,
      bytesFreed,
      durationMs: performance.now() - startTime,
    };

    this.emitEvent('lru', invalidatedKeys, bytesFreed);
    return result;
  }

  /**
   * Run smart invalidation (combines TTL + LRU + hit rate analysis)
   */
  async runSmartInvalidation(): Promise<InvalidationResult> {
    const startTime = performance.now();
    const invalidatedKeys: string[] = [];
    let bytesFreed = 0;

    const minHitRate = this.config.smart?.minHitRate ?? 0.1;
    const currentTime = now();

    const keys = await this.store.keys();

    for (const key of keys) {
      const entry = await this.store.get(key);
      if (!entry) continue;

      let shouldInvalidate = false;

      // Check TTL
      // Use entry's TTL if set, otherwise fall back to config-based TTL
      const ttl =
        entry.metadata.ttl ??
        this.getTTL(entry.request.model, entry.metadata.namespace);
      const age = (currentTime - entry.metadata.createdAt) / 1000;
      if (age >= ttl) {
        shouldInvalidate = true;
      }

      // Check hit rate
      if (this.config.smart?.analyzeHitRate && entry.metadata.accessCount > 0) {
        const accessRate = entry.metadata.accessCount / Math.max(age / 3600, 1); // Per hour
        if (accessRate < minHitRate) {
          shouldInvalidate = true;
        }
      }

      if (shouldInvalidate) {
        const deleted = await this.store.delete(key);
        if (deleted) {
          invalidatedKeys.push(key);
          bytesFreed += this.estimateEntrySize(entry);
        }
      }
    }

    this.stats.totalInvalidations++;
    this.stats.smartRemovals += invalidatedKeys.length;
    this.stats.totalBytesFreed += bytesFreed;
    this.stats.lastInvalidationAt = now();

    const result: InvalidationResult = {
      invalidatedKeys,
      entriesRemoved: invalidatedKeys.length,
      bytesFreed,
      durationMs: performance.now() - startTime,
    };

    this.emitEvent('smart', invalidatedKeys, bytesFreed);
    return result;
  }

  /**
   * Manually invalidate specific keys
   */
  async invalidateKeys(keys: string[]): Promise<InvalidationResult> {
    const startTime = performance.now();
    const invalidatedKeys: string[] = [];
    let bytesFreed = 0;

    for (const key of keys) {
      const entry = await this.store.get(key);
      if (entry) {
        const size = this.estimateEntrySize(entry);
        const deleted = await this.store.delete(key);
        if (deleted) {
          invalidatedKeys.push(key);
          bytesFreed += size;
        }
      }
    }

    this.stats.totalInvalidations++;
    this.stats.manualRemovals += invalidatedKeys.length;
    this.stats.totalBytesFreed += bytesFreed;
    this.stats.lastInvalidationAt = now();

    const result: InvalidationResult = {
      invalidatedKeys,
      entriesRemoved: invalidatedKeys.length,
      bytesFreed,
      durationMs: performance.now() - startTime,
    };

    this.emitEvent('manual', invalidatedKeys, bytesFreed);
    return result;
  }

  /**
   * Invalidate by pattern (e.g., namespace or model)
   */
  async invalidateByPattern(options: {
    namespace?: string;
    model?: string;
    olderThan?: number;
  }): Promise<InvalidationResult> {
    const startTime = performance.now();
    const invalidatedKeys: string[] = [];
    let bytesFreed = 0;
    const currentTime = now();

    const keys = await this.store.keys();

    for (const key of keys) {
      const entry = await this.store.get(key);
      if (!entry) continue;

      let matches = true;

      if (options.namespace && entry.metadata.namespace !== options.namespace) {
        matches = false;
      }

      if (options.model && entry.request.model !== options.model) {
        matches = false;
      }

      if (options.olderThan) {
        const age = (currentTime - entry.metadata.createdAt) / 1000;
        if (age < options.olderThan) {
          matches = false;
        }
      }

      if (matches) {
        const size = this.estimateEntrySize(entry);
        const deleted = await this.store.delete(key);
        if (deleted) {
          invalidatedKeys.push(key);
          bytesFreed += size;
        }
      }
    }

    this.stats.totalInvalidations++;
    this.stats.manualRemovals += invalidatedKeys.length;
    this.stats.totalBytesFreed += bytesFreed;
    this.stats.lastInvalidationAt = now();

    const result: InvalidationResult = {
      invalidatedKeys,
      entriesRemoved: invalidatedKeys.length,
      bytesFreed,
      durationMs: performance.now() - startTime,
    };

    this.emitEvent('manual', invalidatedKeys, bytesFreed);
    return result;
  }

  /**
   * Start automatic invalidation
   */
  startAuto(intervalMs = 60000): void {
    if (this.autoInterval) {
      this.stopAuto();
    }

    this.autoInterval = setInterval(() => {
      void (async () => {
        try {
          await this.run();
        } catch (error) {
          this.emit('error', error as Error);
        }
      })();
    }, intervalMs);
  }

  /**
   * Stop automatic invalidation
   */
  stopAuto(): void {
    if (this.autoInterval) {
      clearInterval(this.autoInterval);
      this.autoInterval = null;
    }
  }

  /**
   * Get invalidation statistics
   */
  getStats(): InvalidationStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalInvalidations: 0,
      ttlRemovals: 0,
      lruRemovals: 0,
      eventRemovals: 0,
      smartRemovals: 0,
      manualRemovals: 0,
      totalBytesFreed: 0,
    };
  }

  /**
   * Destroy the manager
   */
  destroy(): void {
    this.stopAuto();
    this.removeAllListeners();
    this.accessTimes.clear();
  }

  private getTTL(model: string, namespace?: string): number {
    // Check model-specific TTL
    if (this.config.ttl?.modelTtls?.[model]) {
      return this.config.ttl.modelTtls[model];
    }

    // Check namespace-specific TTL
    if (namespace && this.config.ttl?.namespaceTtls?.[namespace]) {
      return this.config.ttl.namespaceTtls[namespace];
    }

    // Return default TTL
    return this.config.ttl?.defaultTtl ?? 3600;
  }

  private estimateEntrySize(entry: { response: { content: string } }): number {
    return entry.response.content.length * 2 + 200; // Rough estimate
  }

  private emitEvent(
    reason: 'ttl' | 'lru' | 'event' | 'smart' | 'manual',
    keys: string[],
    bytesFreed: number,
  ): void {
    if (this.config.emitEvents && keys.length > 0) {
      const event: InvalidationEvent = {
        timestamp: now(),
        keys,
        reason,
        entriesRemoved: keys.length,
        bytesFreed,
      };
      this.emit('invalidate', event);
      this.config.onInvalidate?.(event);
    }
  }
}

/**
 * Create an InvalidationManager instance
 */
export function createInvalidationManager(
  store: BaseCacheStore,
  config?: InvalidationManagerConfig,
): InvalidationManager {
  return new InvalidationManager(store, config);
}
