/**
 * BaseCacheStore
 *
 * Abstract base class for cache stores.
 * Follows the template method pattern.
 */

import type {
  CacheEntry,
  CacheBackendType,
  StoreConfig,
  StoreHealth,
  StoreQueryOptions,
  StoreQueryResult,
  UpsertResult,
  StoreMetrics,
} from '../types/index.js';

/**
 * Abstract base class for cache stores
 *
 * All store implementations must extend this class and implement
 * the abstract methods for their specific storage backend.
 */
export abstract class BaseCacheStore {
  /** Store type identifier */
  abstract readonly storeType: CacheBackendType;

  /** Store configuration */
  protected config: StoreConfig;

  /** Store metrics */
  protected metrics: StoreMetrics = {
    gets: 0,
    sets: 0,
    deletes: 0,
    hits: 0,
    misses: 0,
  };

  constructor(config: StoreConfig) {
    this.config = {
      namespace: config.namespace ?? 'default',
      ...config,
    };
  }

  /**
   * Get an entry by key (exact match)
   *
   * @param key - The cache key
   * @returns The cache entry or undefined if not found
   */
  abstract get(key: string): Promise<CacheEntry | undefined>;

  /**
   * Set an entry in the store
   *
   * @param key - The cache key
   * @param entry - The cache entry to store
   * @returns The result of the upsert operation
   */
  abstract set(key: string, entry: CacheEntry): Promise<UpsertResult>;

  /**
   * Check if a key exists in the store
   *
   * @param key - The cache key
   * @returns Whether the key exists
   */
  abstract has(key: string): Promise<boolean>;

  /**
   * Delete an entry from the store
   *
   * @param key - The cache key
   * @returns Whether the entry was deleted
   */
  abstract delete(key: string): Promise<boolean>;

  /**
   * Clear all entries from the store
   */
  abstract clear(): Promise<void>;

  /**
   * Get the number of entries in the store
   */
  abstract size(): Promise<number>;

  /**
   * Get all keys in the store
   */
  abstract keys(): Promise<string[]>;

  /**
   * Query by vector similarity (for semantic matching)
   *
   * @param vector - The query embedding vector
   * @param options - Query options
   * @returns Query results with similarity scores
   */
  abstract query(
    vector: number[],
    options?: StoreQueryOptions,
  ): Promise<StoreQueryResult>;

  /**
   * Check store health
   *
   * @returns Health status
   */
  abstract checkHealth(): Promise<StoreHealth>;

  /**
   * Close/cleanup the store
   */
  abstract close(): Promise<void>;

  /**
   * Get the store namespace
   */
  get namespace(): string {
    return this.config.namespace ?? 'default';
  }

  /**
   * Get store metrics
   */
  getMetrics(): StoreMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset store metrics
   */
  resetMetrics(): void {
    this.metrics = {
      gets: 0,
      sets: 0,
      deletes: 0,
      hits: 0,
      misses: 0,
    };
  }

  /**
   * Increment a metric counter
   */
  protected incrementMetric(metric: keyof StoreMetrics, amount = 1): void {
    if (typeof this.metrics[metric] === 'number') {
      this.metrics[metric] += amount;
    }
  }
}
