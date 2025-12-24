/**
 * RedisCacheStore
 *
 * Redis-based cache store for distributed caching.
 */

import { BaseCacheStore } from './BaseCacheStore.js';
import type {
  CacheEntry,
  CacheBackendType,
  RedisStoreConfig,
  StoreHealth,
  StoreQueryOptions,
  StoreQueryResult,
  UpsertResult,
} from '../types/index.js';
import { now } from '../core/utils.js';
import { cosineSimilarity } from '../similarity/metrics/SimilarityMetrics.js';

/**
 * Redis client interface (compatible with ioredis)
 */
interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: unknown[]): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  exists(...keys: string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  quit(): Promise<unknown>;
  ping(): Promise<string>;
  expire(key: string, seconds: number): Promise<number>;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Partial<RedisStoreConfig> = {
  host: 'localhost',
  port: 6379,
  db: 0,
  keyPrefix: 'llm-cache',
  connectTimeout: 10000,
};

/**
 * RedisCacheStore
 *
 * Redis-based cache store for distributed caching scenarios.
 *
 * @example
 * ```typescript
 * const store = new RedisCacheStore({
 *   type: 'redis',
 *   url: 'redis://localhost:6379',
 *   keyPrefix: 'my-app-cache'
 * });
 *
 * await store.connect();
 * await store.set('key', entry);
 * ```
 */
export class RedisCacheStore extends BaseCacheStore {
  readonly storeType: CacheBackendType = 'redis';

  private client: RedisClient | null = null;
  private redisConfig: RedisStoreConfig;
  private connected = false;

  constructor(config: RedisStoreConfig) {
    super(config);
    this.redisConfig = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    if (this.connected) return;

    try {
      const { Redis } = await import('ioredis');

      if (this.redisConfig.url) {
        this.client = new Redis(this.redisConfig.url, {
          connectTimeout: this.redisConfig.connectTimeout ?? 10000,
          lazyConnect: false,
          tls: this.redisConfig.tls ? {} : undefined,
        }) as unknown as RedisClient;
      } else {
        this.client = new Redis({
          host: this.redisConfig.host ?? 'localhost',
          port: this.redisConfig.port ?? 6379,
          password: this.redisConfig.password,
          db: this.redisConfig.db ?? 0,
          connectTimeout: this.redisConfig.connectTimeout ?? 10000,
          tls: this.redisConfig.tls ? {} : undefined,
        }) as unknown as RedisClient;
      }

      await this.client.ping();
      this.connected = true;
    } catch (error) {
      throw new Error(
        `Failed to connect to Redis: ${(error as Error).message}`,
      );
    }
  }

  private async ensureConnected(): Promise<RedisClient> {
    if (!this.connected || !this.client) {
      await this.connect();
    }
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }
    return this.client;
  }

  private prefixKey(key: string): string {
    const prefix = this.redisConfig.keyPrefix ?? 'llm-cache';
    return `${prefix}:${this.namespace}:${key}`;
  }

  async get(key: string): Promise<CacheEntry | undefined> {
    this.incrementMetric('gets');
    const client = await this.ensureConnected();
    const data = await client.get(this.prefixKey(key));

    if (!data) {
      this.incrementMetric('misses');
      return undefined;
    }

    this.incrementMetric('hits');
    try {
      const entry = JSON.parse(data) as CacheEntry;
      entry.metadata.accessedAt = now();
      entry.metadata.accessCount++;
      // Fire and forget update
      client.set(this.prefixKey(key), JSON.stringify(entry)).catch(() => {});
      return entry;
    } catch {
      return undefined;
    }
  }

  async set(key: string, entry: CacheEntry): Promise<UpsertResult> {
    const startTime = performance.now();
    this.incrementMetric('sets');
    const client = await this.ensureConnected();

    await client.set(this.prefixKey(key), JSON.stringify(entry));

    // Set TTL if specified
    if (entry.metadata.ttl > 0) {
      await client.expire(this.prefixKey(key), entry.metadata.ttl);
    }

    return {
      success: true,
      id: entry.id,
      durationMs: performance.now() - startTime,
    };
  }

  async has(key: string): Promise<boolean> {
    const client = await this.ensureConnected();
    return (await client.exists(this.prefixKey(key))) > 0;
  }

  async delete(key: string): Promise<boolean> {
    this.incrementMetric('deletes');
    const client = await this.ensureConnected();
    return (await client.del(this.prefixKey(key))) > 0;
  }

  async clear(): Promise<void> {
    const client = await this.ensureConnected();
    const pattern = this.prefixKey('*');
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  }

  async size(): Promise<number> {
    const client = await this.ensureConnected();
    const keys = await client.keys(this.prefixKey('*'));
    return keys.length;
  }

  async keys(): Promise<string[]> {
    const client = await this.ensureConnected();
    const keys = await client.keys(this.prefixKey('*'));
    const prefix = this.prefixKey('');
    return keys.map((k) => k.slice(prefix.length));
  }

  async query(
    vector: number[],
    options?: StoreQueryOptions,
  ): Promise<StoreQueryResult> {
    const startTime = performance.now();

    // Basic Redis doesn't support vector search natively.
    // For production, use Redis Stack with vector search.
    // This fallback loads entries and computes similarity client-side.

    const allKeys = await this.keys();
    const entries: Array<CacheEntry & { score: number }> = [];

    // Limit keys to process for performance
    const keysToProcess = allKeys.slice(0, 1000);

    for (const key of keysToProcess) {
      const entry = await this.get(key);
      if (entry?.embedding) {
        const score = cosineSimilarity(vector, entry.embedding);
        if (score >= (options?.minSimilarity ?? 0)) {
          // Filter by namespace if specified
          if (
            options?.namespace &&
            entry.metadata.namespace !== options.namespace
          ) {
            continue;
          }
          entries.push({ ...entry, score });
        }
      }
    }

    entries.sort((a, b) => b.score - a.score);

    return {
      entries: entries.slice(0, options?.topK ?? 10),
      durationMs: performance.now() - startTime,
    };
  }

  async checkHealth(): Promise<StoreHealth> {
    const startTime = performance.now();
    try {
      const client = await this.ensureConnected();
      await client.ping();
      return {
        healthy: true,
        latencyMs: performance.now() - startTime,
        lastCheck: now(),
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: performance.now() - startTime,
        lastCheck: now(),
        error: (error as Error).message,
      };
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.connected = false;
    }
  }

  /**
   * Check if connected to Redis
   */
  isConnected(): boolean {
    return this.connected;
  }
}

/**
 * Create a RedisCacheStore instance
 */
export function createRedisCacheStore(
  config: RedisStoreConfig,
): RedisCacheStore {
  return new RedisCacheStore(config);
}
