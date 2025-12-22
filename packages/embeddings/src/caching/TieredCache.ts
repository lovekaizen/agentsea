/**
 * TieredCache
 *
 * Multi-tier cache that combines multiple cache backends.
 */

import { BaseCache } from './BaseCache.js';
import { MemoryCache } from './MemoryCache.js';
import { RedisCache } from './RedisCache.js';
import { SQLiteCache } from './SQLiteCache.js';
import type {
  CachedEmbedding,
  TieredCacheOptions,
  TierConfig,
  CacheBackendType,
  CacheStats,
  CacheLookupResult,
  MemoryCacheOptions,
  RedisCacheOptions,
  SQLiteCacheOptions,
} from '../types/index.js';

/**
 * Tiered cache implementation
 */
export class TieredCache extends BaseCache {
  readonly backendType: CacheBackendType = 'tiered';

  private tiers: Array<{ name: string; cache: BaseCache; priority: number }> =
    [];
  private writeThrough: boolean;
  private promoteOnHit: boolean;

  constructor(options: TieredCacheOptions) {
    super(options);
    this.writeThrough = options.writeThrough ?? true;
    this.promoteOnHit = options.promoteOnHit ?? true;

    // Initialize tiers
    this.initializeTiers(options.tiers);
  }

  /**
   * Initialize cache tiers
   */
  private initializeTiers(tierConfigs: TierConfig[]): void {
    const sorted = [...tierConfigs].sort((a, b) => a.priority - b.priority);

    for (const config of sorted) {
      let cache: BaseCache;

      switch (config.type) {
        case 'memory':
          cache = new MemoryCache(config.options);
          break;
        case 'redis':
          cache = new RedisCache(config.options as never);
          break;
        case 'sqlite':
          cache = new SQLiteCache(config.options);
          break;
        default:
          continue;
      }

      this.tiers.push({
        name: config.name,
        cache,
        priority: config.priority,
      });
    }
  }

  /**
   * Initialize all tier connections
   */
  async init(): Promise<void> {
    for (const tier of this.tiers) {
      if (tier.cache instanceof RedisCache) {
        await tier.cache.connect();
      } else if (tier.cache instanceof SQLiteCache) {
        await tier.cache.init();
      }
    }
  }

  async get(key: string): Promise<CachedEmbedding | undefined> {
    let foundEntry: CachedEmbedding | undefined;
    let foundTierIndex = -1;

    // Search through tiers in priority order
    for (let i = 0; i < this.tiers.length; i++) {
      const entry = await this.tiers[i].cache.get(key);
      if (entry) {
        foundEntry = entry;
        foundTierIndex = i;
        break;
      }
    }

    // Promote to higher tiers if found in lower tier
    if (foundEntry && foundTierIndex > 0 && this.promoteOnHit) {
      for (let i = 0; i < foundTierIndex; i++) {
        await this.tiers[i].cache.set(key, foundEntry);
      }
    }

    return foundEntry;
  }

  async set(key: string, entry: CachedEmbedding): Promise<void> {
    if (this.writeThrough) {
      // Write to all tiers
      for (const tier of this.tiers) {
        await tier.cache.set(key, entry);
      }
    } else {
      // Write only to first tier
      if (this.tiers.length > 0) {
        await this.tiers[0].cache.set(key, entry);
      }
    }
    this.stats.entries++;
  }

  async has(key: string): Promise<boolean> {
    for (const tier of this.tiers) {
      if (await tier.cache.has(key)) {
        return true;
      }
    }
    return false;
  }

  async delete(key: string): Promise<boolean> {
    let deleted = false;
    for (const tier of this.tiers) {
      if (await tier.cache.delete(key)) {
        deleted = true;
      }
    }
    if (deleted) {
      this.stats.deletes++;
      this.stats.entries = Math.max(0, this.stats.entries - 1);
    }
    return deleted;
  }

  async clear(): Promise<void> {
    for (const tier of this.tiers) {
      await tier.cache.clear();
    }
    this.stats.entries = 0;
  }

  async size(): Promise<number> {
    // Return size from lowest tier (most complete)
    if (this.tiers.length === 0) return 0;
    return this.tiers[this.tiers.length - 1].cache.size();
  }

  async keys(): Promise<string[]> {
    // Collect unique keys from all tiers
    const allKeys = new Set<string>();
    for (const tier of this.tiers) {
      const keys = await tier.cache.keys();
      for (const key of keys) {
        allKeys.add(key);
      }
    }
    return Array.from(allKeys);
  }

  async close(): Promise<void> {
    for (const tier of this.tiers) {
      await tier.cache.close();
    }
    this.tiers = [];
  }

  /**
   * Override lookup to track tier hits
   */
  async lookup(key: string): Promise<CacheLookupResult> {
    const startTime = performance.now();
    this.stats.gets++;

    let foundEntry: CachedEmbedding | undefined;
    let foundTierName: string | undefined;
    let foundTierIndex = -1;

    // Search through tiers
    for (let i = 0; i < this.tiers.length; i++) {
      const entry = await this.tiers[i].cache.get(key);
      if (entry) {
        foundEntry = entry;
        foundTierName = this.tiers[i].name;
        foundTierIndex = i;
        break;
      }
    }

    const latencyMs = performance.now() - startTime;

    // Update stats
    this.stats.avgGetLatencyMs =
      (this.stats.avgGetLatencyMs * (this.stats.gets - 1) + latencyMs) /
      this.stats.gets;

    if (foundEntry) {
      this.stats.hits++;
      this.updateHitRate();

      // Promote to higher tiers
      if (foundTierIndex > 0 && this.promoteOnHit) {
        for (let i = 0; i < foundTierIndex; i++) {
          await this.tiers[i].cache.set(key, foundEntry);
        }
      }

      return { hit: true, entry: foundEntry, tier: foundTierName, latencyMs };
    } else {
      this.stats.misses++;
      this.updateHitRate();
      return { hit: false, latencyMs };
    }
  }

  /**
   * Get statistics for all tiers
   */
  getTierStats(): Record<string, CacheStats> {
    const tierStats: Record<string, CacheStats> = {};
    for (const tier of this.tiers) {
      tierStats[tier.name] = tier.cache.getStats();
    }
    return tierStats;
  }

  /**
   * Get cache from specific tier
   */
  getTier(name: string): BaseCache | undefined {
    return this.tiers.find((t) => t.name === name)?.cache;
  }

  /**
   * Get all tier names
   */
  getTierNames(): string[] {
    return this.tiers.map((t) => t.name);
  }

  /**
   * Override getStats to include tier stats
   */
  getStats(): CacheStats {
    const stats = super.getStats();
    return {
      ...stats,
      tierStats: this.getTierStats(),
    } as CacheStats;
  }
}

/**
 * Create a tiered cache
 */
export function createTieredCache(options: TieredCacheOptions): TieredCache {
  return new TieredCache(options);
}

/**
 * Create a standard two-tier cache (memory + persistent)
 */
export function createStandardTieredCache(options?: {
  memoryMaxEntries?: number;
  persistentPath?: string;
  useRedis?: boolean;
  redisUrl?: string;
}): TieredCache {
  const tiers: TierConfig[] = [
    {
      name: 'memory',
      type: 'memory',
      options: {
        maxEntries: options?.memoryMaxEntries ?? 10000,
      } as MemoryCacheOptions,
      priority: 1,
    },
  ];

  if (options?.useRedis && options.redisUrl) {
    tiers.push({
      name: 'redis',
      type: 'redis',
      options: {
        url: options.redisUrl,
      } as RedisCacheOptions,
      priority: 2,
    });
  } else {
    tiers.push({
      name: 'sqlite',
      type: 'sqlite',
      options: {
        dbPath: options?.persistentPath ?? './embeddings_cache.db',
      } as SQLiteCacheOptions,
      priority: 2,
    });
  }

  return new TieredCache({
    tiers,
    writeThrough: true,
    promoteOnHit: true,
  });
}
