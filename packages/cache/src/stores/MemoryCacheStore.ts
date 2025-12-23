/**
 * MemoryCacheStore
 *
 * In-memory LRU cache store with vector search support.
 */

import { LRUCache } from 'lru-cache';
import { BaseCacheStore } from './BaseCacheStore.js';
import type {
  CacheEntry,
  CacheBackendType,
  MemoryStoreConfig,
  StoreHealth,
  StoreQueryOptions,
  StoreQueryResult,
  UpsertResult,
} from '../types/index.js';
import { estimateEntrySize, now } from '../core/utils.js';

/**
 * Default memory store configuration
 */
const DEFAULT_CONFIG: Partial<MemoryStoreConfig> = {
  maxEntries: 10000,
  maxSizeBytes: 1024 * 1024 * 1024, // 1GB
  evictionPolicy: 'lru',
};

/**
 * MemoryCacheStore
 *
 * In-memory cache store using LRU eviction.
 * Supports vector similarity search for semantic matching.
 *
 * @example
 * ```typescript
 * const store = new MemoryCacheStore({
 *   type: 'memory',
 *   maxEntries: 10000,
 *   evictionPolicy: 'lru'
 * });
 *
 * await store.set('key', entry);
 * const result = await store.get('key');
 * ```
 */
export class MemoryCacheStore extends BaseCacheStore {
  readonly storeType: CacheBackendType = 'memory';

  private cache: LRUCache<string, CacheEntry>;
  private vectors: Map<string, { id: string; vector: number[] }> = new Map();
  private memoryConfig: MemoryStoreConfig;
  private closed = false;

  constructor(config: MemoryStoreConfig = { type: 'memory' }) {
    super(config);
    this.memoryConfig = { ...DEFAULT_CONFIG, ...config };

    this.cache = new LRUCache({
      max: this.memoryConfig.maxEntries ?? 10000,
      maxSize: this.memoryConfig.maxSizeBytes ?? 1024 * 1024 * 1024,
      sizeCalculation: (entry) => estimateEntrySize(entry),
      ttl: 0, // TTL handled per-entry
      updateAgeOnGet: true,
      allowStale: false,
    });
  }

  get(key: string): Promise<CacheEntry | undefined> {
    this.incrementMetric('gets');
    const entry = this.cache.get(key);

    if (entry) {
      this.incrementMetric('hits');
      // Update access metadata
      entry.metadata.accessedAt = now();
      entry.metadata.accessCount++;
      return Promise.resolve(entry);
    }

    this.incrementMetric('misses');
    return Promise.resolve(undefined);
  }

  set(key: string, entry: CacheEntry): Promise<UpsertResult> {
    const startTime = performance.now();
    this.incrementMetric('sets');

    // Set TTL if specified
    const ttlMs =
      entry.metadata.ttl > 0 ? entry.metadata.ttl * 1000 : undefined;

    this.cache.set(key, entry, { ttl: ttlMs });

    // Store vector for similarity search
    if (entry.embedding && entry.embedding.length > 0) {
      this.vectors.set(key, {
        id: entry.id,
        vector: entry.embedding,
      });
    }

    return Promise.resolve({
      success: true,
      id: entry.id,
      durationMs: performance.now() - startTime,
    });
  }

  has(key: string): Promise<boolean> {
    return Promise.resolve(this.cache.has(key));
  }

  delete(key: string): Promise<boolean> {
    this.incrementMetric('deletes');
    const existed = this.cache.has(key);
    this.cache.delete(key);
    this.vectors.delete(key);
    return Promise.resolve(existed);
  }

  clear(): Promise<void> {
    this.cache.clear();
    this.vectors.clear();
    return Promise.resolve();
  }

  size(): Promise<number> {
    return Promise.resolve(this.cache.size);
  }

  keys(): Promise<string[]> {
    return Promise.resolve(Array.from(this.cache.keys()));
  }

  query(
    vector: number[],
    options?: StoreQueryOptions,
  ): Promise<StoreQueryResult> {
    const startTime = performance.now();
    const topK = options?.topK ?? 10;
    const minSimilarity = options?.minSimilarity ?? 0;

    const results: Array<CacheEntry & { score: number }> = [];

    // Compute similarity for all vectors
    for (const [key, stored] of this.vectors) {
      // Filter by namespace if specified
      const entry = this.cache.get(key);
      if (!entry) continue;

      if (
        options?.namespace &&
        entry.metadata.namespace !== options.namespace
      ) {
        continue;
      }

      const similarity = this.cosineSimilarity(vector, stored.vector);

      if (similarity >= minSimilarity) {
        results.push({ ...entry, score: similarity });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return Promise.resolve({
      entries: results.slice(0, topK),
      durationMs: performance.now() - startTime,
    });
  }

  checkHealth(): Promise<StoreHealth> {
    return Promise.resolve({
      healthy: !this.closed,
      latencyMs: 0,
      lastCheck: now(),
      error: this.closed ? 'Store is closed' : undefined,
    });
  }

  close(): Promise<void> {
    this.closed = true;
    this.cache.clear();
    this.vectors.clear();
    return Promise.resolve();
  }

  /**
   * Compute cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    return dotProduct / denominator;
  }

  /**
   * Get memory usage information
   */
  getMemoryInfo(): {
    entries: number;
    calculatedSize: number;
    maxSize: number;
    vectorCount: number;
  } {
    return {
      entries: this.cache.size,
      calculatedSize: this.cache.calculatedSize ?? 0,
      maxSize: this.memoryConfig.maxSizeBytes ?? 0,
      vectorCount: this.vectors.size,
    };
  }

  /**
   * Prune expired entries
   */
  prune(): Promise<number> {
    // LRUCache handles TTL automatically, but we can force a purge
    this.cache.purgeStale();

    // Clean up orphaned vectors
    let pruned = 0;
    for (const key of this.vectors.keys()) {
      if (!this.cache.has(key)) {
        this.vectors.delete(key);
        pruned++;
      }
    }

    return Promise.resolve(pruned);
  }
}

/**
 * Create a MemoryCacheStore instance
 */
export function createMemoryCacheStore(
  config?: Partial<MemoryStoreConfig>,
): MemoryCacheStore {
  return new MemoryCacheStore({ type: 'memory', ...config });
}
