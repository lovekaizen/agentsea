/**
 * TieredCacheStore
 *
 * Multi-tier cache store with automatic promotion and demotion.
 */

import { BaseCacheStore } from './BaseCacheStore.js';
import type {
  CacheEntry,
  CacheBackendType,
  TieredStoreConfig,
  TierConfig,
  StoreHealth,
  StoreQueryOptions,
  StoreQueryResult,
  UpsertResult,
} from '../types/index.js';
import { now } from '../core/utils.js';

/**
 * TieredCacheStore
 *
 * Multi-tier cache store that manages multiple cache backends
 * with automatic promotion and demotion based on access patterns.
 *
 * @example
 * ```typescript
 * const tieredStore = new TieredCacheStore({
 *   type: 'tiered',
 *   tiers: [
 *     {
 *       name: 'hot',
 *       store: memoryStore,
 *       priority: 1,
 *       maxSize: 1000,
 *       promotionThreshold: 3
 *     },
 *     {
 *       name: 'warm',
 *       store: redisStore,
 *       priority: 2,
 *       maxSize: 10000
 *     },
 *     {
 *       name: 'cold',
 *       store: sqliteStore,
 *       priority: 3
 *     }
 *   ]
 * });
 *
 * await tieredStore.set('key', entry);
 * const result = await tieredStore.get('key');
 * ```
 */
/**
 * Internal tier representation with guaranteed store
 */
interface InternalTier extends TierConfig {
  store: BaseCacheStore;
}

export class TieredCacheStore extends BaseCacheStore {
  readonly storeType: CacheBackendType = 'tiered';

  private tiers: InternalTier[];
  private accessCounts: Map<string, number> = new Map();

  constructor(config: TieredStoreConfig) {
    super(config);

    // Filter and validate tiers that have stores
    const validTiers = config.tiers.filter(
      (t): t is InternalTier => t.store !== undefined,
    );

    if (validTiers.length === 0) {
      throw new Error(
        'TieredCacheStore requires at least one tier with a store',
      );
    }

    // Sort tiers by priority (lower = higher priority)
    this.tiers = validTiers.sort((a, b) => a.priority - b.priority);
  }

  async get(key: string): Promise<CacheEntry | undefined> {
    this.incrementMetric('gets');

    // Search tiers from highest to lowest priority
    for (let i = 0; i < this.tiers.length; i++) {
      const tier = this.tiers[i];
      const entry = await tier.store.get(key);

      if (entry) {
        this.incrementMetric('hits');

        // Track access count
        const accessCount = (this.accessCounts.get(key) ?? 0) + 1;
        this.accessCounts.set(key, accessCount);

        // Check for promotion
        if (i > 0) {
          await this.checkPromotion(key, entry, i, accessCount);
        }

        return entry;
      }
    }

    this.incrementMetric('misses');
    return undefined;
  }

  async set(key: string, entry: CacheEntry): Promise<UpsertResult> {
    const startTime = performance.now();
    this.incrementMetric('sets');

    // Set in the primary (first) tier
    const result = await this.tiers[0].store.set(key, entry);

    // Initialize access count
    this.accessCounts.set(key, 0);

    // Check if we need to demote entries from the primary tier
    await this.checkDemotion(0);

    return {
      ...result,
      durationMs: performance.now() - startTime,
    };
  }

  async has(key: string): Promise<boolean> {
    for (const tier of this.tiers) {
      if (await tier.store.has(key)) {
        return true;
      }
    }
    return false;
  }

  async delete(key: string): Promise<boolean> {
    this.incrementMetric('deletes');
    let deleted = false;

    // Delete from all tiers
    for (const tier of this.tiers) {
      if (await tier.store.delete(key)) {
        deleted = true;
      }
    }

    this.accessCounts.delete(key);
    return deleted;
  }

  async clear(): Promise<void> {
    for (const tier of this.tiers) {
      await tier.store.clear();
    }
    this.accessCounts.clear();
  }

  async size(): Promise<number> {
    // Count unique keys across all tiers
    const allKeys = new Set<string>();
    for (const tier of this.tiers) {
      const keys = await tier.store.keys();
      keys.forEach((k) => allKeys.add(k));
    }
    return allKeys.size;
  }

  async keys(): Promise<string[]> {
    const allKeys = new Set<string>();
    for (const tier of this.tiers) {
      const keys = await tier.store.keys();
      keys.forEach((k) => allKeys.add(k));
    }
    return Array.from(allKeys);
  }

  async query(
    vector: number[],
    options?: StoreQueryOptions,
  ): Promise<StoreQueryResult> {
    const startTime = performance.now();
    const entriesMap = new Map<string, CacheEntry & { score: number }>();

    // Query all tiers and merge results
    for (const tier of this.tiers) {
      const result = await tier.store.query(vector, options);
      for (const entry of result.entries) {
        // Keep highest score if entry exists in multiple tiers
        const existing = entriesMap.get(entry.key);
        if (!existing || entry.score > existing.score) {
          entriesMap.set(entry.key, entry);
        }
      }
    }

    // Sort by score and limit
    const entries = Array.from(entriesMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, options?.topK ?? 10);

    return {
      entries,
      durationMs: performance.now() - startTime,
    };
  }

  async checkHealth(): Promise<StoreHealth> {
    const startTime = performance.now();
    const tierHealths: Array<{ name: string; healthy: boolean }> = [];

    for (const tier of this.tiers) {
      const health = await tier.store.checkHealth();
      tierHealths.push({ name: tier.name, healthy: health.healthy });
    }

    const allHealthy = tierHealths.every((t) => t.healthy);

    return {
      healthy: allHealthy,
      latencyMs: performance.now() - startTime,
      lastCheck: now(),
      error: allHealthy
        ? undefined
        : `Unhealthy tiers: ${tierHealths
            .filter((t) => !t.healthy)
            .map((t) => t.name)
            .join(', ')}`,
    };
  }

  async close(): Promise<void> {
    for (const tier of this.tiers) {
      await tier.store.close();
    }
  }

  /**
   * Get tier statistics
   */
  async getTierStats(): Promise<
    Array<{
      name: string;
      priority: number;
      size: number;
      maxSize?: number;
    }>
  > {
    const stats = [];
    for (const tier of this.tiers) {
      stats.push({
        name: tier.name,
        priority: tier.priority,
        size: await tier.store.size(),
        maxSize: tier.maxSize,
      });
    }
    return stats;
  }

  /**
   * Manually promote an entry to a higher tier
   */
  async promote(key: string, targetTierIndex = 0): Promise<boolean> {
    // Find the entry
    for (let i = targetTierIndex + 1; i < this.tiers.length; i++) {
      const entry = await this.tiers[i].store.get(key);
      if (entry) {
        // Set in target tier
        await this.tiers[targetTierIndex].store.set(key, entry);
        // Delete from source tier
        await this.tiers[i].store.delete(key);
        return true;
      }
    }
    return false;
  }

  /**
   * Manually demote an entry to a lower tier
   */
  async demote(key: string, targetTierIndex?: number): Promise<boolean> {
    // Find the entry
    for (let i = 0; i < this.tiers.length - 1; i++) {
      const entry = await this.tiers[i].store.get(key);
      if (entry) {
        const target = targetTierIndex ?? i + 1;
        if (target >= this.tiers.length) return false;

        // Set in target tier
        await this.tiers[target].store.set(key, entry);
        // Delete from source tier
        await this.tiers[i].store.delete(key);
        return true;
      }
    }
    return false;
  }

  private async checkPromotion(
    key: string,
    entry: CacheEntry,
    currentTierIndex: number,
    accessCount: number,
  ): Promise<void> {
    // Check if entry should be promoted to a higher tier
    for (let i = currentTierIndex - 1; i >= 0; i--) {
      const tier = this.tiers[i];
      const threshold = tier.promotionThreshold ?? 3;

      if (accessCount >= threshold) {
        // Promote to this tier
        await tier.store.set(key, entry);
        // Remove from current tier
        await this.tiers[currentTierIndex].store.delete(key);
        break;
      }
    }
  }

  private async checkDemotion(tierIndex: number): Promise<void> {
    const tier = this.tiers[tierIndex];
    if (!tier.maxSize) return;

    const size = await tier.store.size();
    if (size <= tier.maxSize) return;

    // Need to demote some entries
    const demotionTarget = tier.demotionTarget ?? 0.9; // Demote to 90% capacity
    const targetSize = Math.floor(tier.maxSize * demotionTarget);
    const toRemove = size - targetSize;

    if (toRemove <= 0) return;

    // Get keys sorted by access count (least accessed first)
    const keys = await tier.store.keys();
    const keysByAccess = keys
      .map((k) => ({ key: k, count: this.accessCounts.get(k) ?? 0 }))
      .sort((a, b) => a.count - b.count);

    // Demote the least accessed entries
    const nextTierIndex = tierIndex + 1;
    if (nextTierIndex >= this.tiers.length) {
      // No lower tier, just delete
      for (let i = 0; i < toRemove && i < keysByAccess.length; i++) {
        await tier.store.delete(keysByAccess[i].key);
        this.accessCounts.delete(keysByAccess[i].key);
      }
    } else {
      // Demote to next tier
      for (let i = 0; i < toRemove && i < keysByAccess.length; i++) {
        const key = keysByAccess[i].key;
        const entry = await tier.store.get(key);
        if (entry) {
          await this.tiers[nextTierIndex].store.set(key, entry);
          await tier.store.delete(key);
        }
      }
    }
  }
}

/**
 * Create a TieredCacheStore instance
 */
export function createTieredCacheStore(
  config: TieredStoreConfig,
): TieredCacheStore {
  return new TieredCacheStore(config);
}
