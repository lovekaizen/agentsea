/**
 * BaseCache
 *
 * Abstract base class for embedding caches.
 */

import type {
  CachedEmbedding,
  CacheOptions,
  CacheStats,
  CacheLookupResult,
  BatchCacheLookupResult,
  CacheCleanupOptions,
  CacheCleanupResult,
  CacheExportFormat,
  CacheImportOptions,
  EmbeddingResult,
  CacheBackendType,
} from '../types/index.js';
import { contentHash } from '../core/utils.js';

/**
 * Abstract base class for caches
 */
export abstract class BaseCache {
  /** Cache backend type */
  abstract readonly backendType: CacheBackendType;

  /** Cache options */
  protected options: CacheOptions;

  /** Cache statistics */
  protected stats: CacheStats;

  constructor(options: CacheOptions = {}) {
    this.options = {
      defaultTTL: options.defaultTTL ?? 0,
      maxEntries: options.maxEntries ?? 100000,
      maxSizeBytes: options.maxSizeBytes ?? 1024 * 1024 * 1024, // 1GB
      keyPrefix: options.keyPrefix ?? 'emb',
      compression: options.compression ?? false,
      compressionThreshold: options.compressionThreshold ?? 1024,
    };

    this.stats = this.createInitialStats();
  }

  private createInitialStats(): CacheStats {
    return {
      entries: 0,
      sizeBytes: 0,
      hits: 0,
      misses: 0,
      hitRate: 0,
      gets: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      avgGetLatencyMs: 0,
      avgSetLatencyMs: 0,
    };
  }

  /**
   * Generate cache key from text and model
   */
  generateKey(text: string, model: string): string {
    const hash = contentHash(`${model}:${text}`);
    return `${this.options.keyPrefix}:${model}:${hash}`;
  }

  /**
   * Get an entry from cache
   */
  abstract get(key: string): Promise<CachedEmbedding | undefined>;

  /**
   * Set an entry in cache
   */
  abstract set(key: string, entry: CachedEmbedding): Promise<void>;

  /**
   * Check if key exists
   */
  abstract has(key: string): Promise<boolean>;

  /**
   * Delete an entry
   */
  abstract delete(key: string): Promise<boolean>;

  /**
   * Clear all entries
   */
  abstract clear(): Promise<void>;

  /**
   * Get cache size (entry count)
   */
  abstract size(): Promise<number>;

  /**
   * Get all keys
   */
  abstract keys(): Promise<string[]>;

  /**
   * Close/cleanup the cache
   */
  abstract close(): Promise<void>;

  /**
   * Lookup with timing and stats
   */
  async lookup(key: string): Promise<CacheLookupResult> {
    const startTime = performance.now();
    this.stats.gets++;

    const entry = await this.get(key);
    const latencyMs = performance.now() - startTime;

    // Update latency stats
    this.stats.avgGetLatencyMs =
      (this.stats.avgGetLatencyMs * (this.stats.gets - 1) + latencyMs) /
      this.stats.gets;

    if (entry) {
      this.stats.hits++;
      this.updateHitRate();
      return { hit: true, entry, latencyMs };
    } else {
      this.stats.misses++;
      this.updateHitRate();
      return { hit: false, latencyMs };
    }
  }

  /**
   * Batch lookup
   */
  async lookupBatch(keys: string[]): Promise<BatchCacheLookupResult> {
    const startTime = performance.now();
    const hits = new Map<string, CachedEmbedding>();
    const misses: string[] = [];

    for (const key of keys) {
      const result = await this.lookup(key);
      if (result.hit && result.entry) {
        hits.set(key, result.entry);
      } else {
        misses.push(key);
      }
    }

    return {
      hits,
      misses,
      hitRate: keys.length > 0 ? hits.size / keys.length : 0,
      latencyMs: performance.now() - startTime,
    };
  }

  /**
   * Store with timing and stats
   */
  async store(
    key: string,
    result: EmbeddingResult,
    model: string,
    ttl?: number,
  ): Promise<void> {
    const startTime = performance.now();
    this.stats.sets++;

    const entry: CachedEmbedding = {
      key,
      vector: result.vector,
      text: result.text,
      model,
      dimensions: result.dimensions,
      tokenCount: result.tokenCount,
      createdAt: Date.now(),
      accessedAt: Date.now(),
      accessCount: 0,
      ttl: ttl ?? this.options.defaultTTL ?? 0,
    };

    await this.set(key, entry);

    const latencyMs = performance.now() - startTime;
    this.stats.avgSetLatencyMs =
      (this.stats.avgSetLatencyMs * (this.stats.sets - 1) + latencyMs) /
      this.stats.sets;
  }

  /**
   * Store batch of results
   */
  async storeBatch(
    entries: Array<{ key: string; result: EmbeddingResult; model: string }>,
    ttl?: number,
  ): Promise<void> {
    for (const entry of entries) {
      await this.store(entry.key, entry.result, entry.model, ttl);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = this.createInitialStats();
  }

  /**
   * Update hit rate
   */
  protected updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Cleanup expired/old entries
   */
  async cleanup(options?: CacheCleanupOptions): Promise<CacheCleanupResult> {
    const startTime = performance.now();
    const dryRun = options?.dryRun ?? false;
    const now = Date.now();
    let removed = 0;
    let freedBytes = 0;

    const keys = await this.keys();

    for (const key of keys) {
      const entry = await this.get(key);
      if (!entry) continue;

      let shouldRemove = false;

      // Check expiration
      if (options?.removeExpired && entry.ttl > 0) {
        if (entry.createdAt + entry.ttl * 1000 < now) {
          shouldRemove = true;
        }
      }

      // Check age
      if (options?.olderThan) {
        if (entry.createdAt < now - options.olderThan * 1000) {
          shouldRemove = true;
        }
      }

      // Check access time
      if (options?.notAccessedSince) {
        if (entry.accessedAt < now - options.notAccessedSince * 1000) {
          shouldRemove = true;
        }
      }

      // Check model filter
      if (options?.model && entry.model !== options.model) {
        shouldRemove = false;
      }

      // Check version filter
      if (options?.version && entry.version !== options.version) {
        shouldRemove = false;
      }

      if (shouldRemove && !dryRun) {
        const size = this.estimateEntrySize(entry);
        await this.delete(key);
        removed++;
        freedBytes += size;
        this.stats.evictions++;
      } else if (shouldRemove) {
        removed++;
        freedBytes += this.estimateEntrySize(entry);
      }
    }

    return {
      removed,
      freedBytes,
      durationMs: performance.now() - startTime,
      dryRun,
    };
  }

  /**
   * Export cache contents
   */
  async export(): Promise<CacheExportFormat> {
    const keys = await this.keys();
    const entries: CachedEmbedding[] = [];

    for (const key of keys) {
      const entry = await this.get(key);
      if (entry) {
        entries.push(entry);
      }
    }

    return {
      version: '1.0',
      exportedAt: Date.now(),
      totalEntries: entries.length,
      entries,
    };
  }

  /**
   * Import cache contents
   */
  async import(
    data: CacheExportFormat,
    options?: CacheImportOptions,
  ): Promise<{ imported: number; skipped: number }> {
    let imported = 0;
    let skipped = 0;

    for (let i = 0; i < data.entries.length; i++) {
      const entry = data.entries[i];

      if (options?.validate) {
        // Basic validation
        if (!entry.key || !entry.vector || !entry.model) {
          skipped++;
          continue;
        }
      }

      const exists = await this.has(entry.key);

      if (exists) {
        if (options?.skipExisting) {
          skipped++;
          continue;
        }
        if (!options?.updateExisting) {
          skipped++;
          continue;
        }
      }

      await this.set(entry.key, entry);
      imported++;

      if (options?.onProgress) {
        options.onProgress({ imported, total: data.entries.length });
      }
    }

    return { imported, skipped };
  }

  /**
   * Estimate entry size in bytes
   */
  protected estimateEntrySize(entry: CachedEmbedding): number {
    // Vector: 4 bytes per float
    const vectorSize = entry.vector.length * 4;
    // Text: roughly 2 bytes per character (UTF-16)
    const textSize = (entry.text?.length ?? 0) * 2;
    // Metadata overhead
    const overheadSize = 200;

    return vectorSize + textSize + overheadSize;
  }
}
