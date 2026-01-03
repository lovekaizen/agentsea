/**
 * MemoryCache
 *
 * In-memory LRU cache for embeddings.
 */

import { LRUCache } from 'lru-cache';
import { BaseCache } from './BaseCache.js';
import type {
  CachedEmbedding,
  MemoryCacheOptions,
  CacheBackendType,
} from '../types/index.js';

/**
 * In-memory LRU cache
 */
export class MemoryCache extends BaseCache {
  readonly backendType: CacheBackendType = 'memory';

  private cache: LRUCache<string, CachedEmbedding>;

  constructor(options: MemoryCacheOptions = {}) {
    super(options);

    this.cache = new LRUCache({
      max: options.maxEntries ?? 100000,
      maxSize: options.maxSizeBytes ?? 1024 * 1024 * 1024,
      sizeCalculation: (entry) => this.estimateEntrySize(entry),
      ttl: options.maxAge ?? 0,
      updateAgeOnGet: options.updateAgeOnGet ?? true,
      allowStale: options.staleWhileRevalidate ? true : false,
    });
  }

  async get(key: string): Promise<CachedEmbedding | undefined> {
    const entry = this.cache.get(key);

    if (entry) {
      // Update access info
      entry.accessedAt = Date.now();
      entry.accessCount++;
    }

    return Promise.resolve(entry);
  }

  set(key: string, entry: CachedEmbedding): Promise<void> {
    const ttl = entry.ttl > 0 ? entry.ttl * 1000 : undefined;
    this.cache.set(key, entry, { ttl });
    this.stats.entries = this.cache.size;
    return Promise.resolve();
  }

  has(key: string): Promise<boolean> {
    return Promise.resolve(this.cache.has(key));
  }

  async delete(key: string): Promise<boolean> {
    const existed = this.cache.has(key);
    this.cache.delete(key);
    this.stats.deletes++;
    this.stats.entries = this.cache.size;
    return Promise.resolve(existed);
  }

  clear(): Promise<void> {
    this.cache.clear();
    this.stats.entries = 0;
    return Promise.resolve();
  }

  size(): Promise<number> {
    return Promise.resolve(this.cache.size);
  }

  keys(): Promise<string[]> {
    return Promise.resolve(Array.from(this.cache.keys()));
  }

  async close(): Promise<void> {
    this.cache.clear();
    return Promise.resolve();
  }

  /**
   * Get memory usage info
   */
  getMemoryInfo(): {
    entries: number;
    calculatedSize: number;
    maxSize: number;
  } {
    return {
      entries: this.cache.size,
      calculatedSize: this.cache.calculatedSize,
      maxSize: this.cache.max,
    };
  }

  /**
   * Prune stale entries
   */
  prune(): void {
    this.cache.purgeStale();
    this.stats.entries = this.cache.size;
  }
}

/**
 * Create a memory cache
 */
export function createMemoryCache(options?: MemoryCacheOptions): MemoryCache {
  return new MemoryCache(options);
}
