/**
 * RedisCache
 *
 * Redis-based cache for embeddings.
 */

import { BaseCache } from './BaseCache.js';
import type {
  CachedEmbedding,
  RedisCacheOptions,
  CacheBackendType,
} from '../types/index.js';

/**
 * Redis client interface (minimal for compatibility)
 */
interface RedisClient {
  get(key: string): Promise<string | null>;
  // ioredis-style variadic set, e.g. set(key, value, 'EX', seconds).
  set(
    key: string,
    value: string,
    ...args: (string | number)[]
  ): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  exists(...keys: string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  dbsize(): Promise<number>;
  flushdb(): Promise<unknown>;
  quit(): Promise<unknown>;
  ping(): Promise<string>;
}

/**
 * Redis cache implementation
 */
export class RedisCache extends BaseCache {
  readonly backendType: CacheBackendType = 'redis';

  private client: RedisClient | null = null;
  private config: RedisCacheOptions;
  private connected = false;

  constructor(options: RedisCacheOptions) {
    super(options);
    this.config = options;
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    if (this.connected) return;

    try {
      // Dynamic import for optional dependency
      const { Redis } = await import('ioredis');

      if (this.config.url) {
        this.client = new Redis(this.config.url, {
          connectTimeout: this.config.connectTimeout ?? 10000,
          commandTimeout: this.config.commandTimeout ?? 5000,
          lazyConnect: false,
        }) as unknown as RedisClient;
      } else if (this.config.cluster && this.config.clusterNodes) {
        const { Cluster } = await import('ioredis');
        this.client = new Cluster(this.config.clusterNodes, {
          redisOptions: {
            password: this.config.password,
          },
        }) as unknown as RedisClient;
      } else if (this.config.sentinel) {
        this.client = new Redis({
          sentinels: this.config.sentinel.sentinels,
          name: this.config.sentinel.master,
          password: this.config.password,
        }) as unknown as RedisClient;
      } else {
        this.client = new Redis({
          host: this.config.host ?? 'localhost',
          port: this.config.port ?? 6379,
          password: this.config.password,
          db: this.config.db ?? 0,
          connectTimeout: this.config.connectTimeout ?? 10000,
          commandTimeout: this.config.commandTimeout ?? 5000,
        }) as unknown as RedisClient;
      }

      // Test connection
      await this.client.ping();
      this.connected = true;
    } catch (error) {
      throw new Error(
        `Failed to connect to Redis: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Ensure connected
   */
  private async ensureConnected(): Promise<RedisClient> {
    if (!this.connected || !this.client) {
      await this.connect();
    }
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }
    return this.client;
  }

  async get(key: string): Promise<CachedEmbedding | undefined> {
    const client = await this.ensureConnected();
    const data = await client.get(this.prefixKey(key));

    if (!data) return undefined;

    try {
      const entry = JSON.parse(data) as CachedEmbedding;

      // Update access info (fire and forget)
      entry.accessedAt = Date.now();
      entry.accessCount++;
      client.set(this.prefixKey(key), JSON.stringify(entry)).catch(() => {});

      return entry;
    } catch {
      return undefined;
    }
  }

  async set(key: string, entry: CachedEmbedding): Promise<void> {
    const client = await this.ensureConnected();
    const data = JSON.stringify(entry);

    let ttl = 0;
    if (entry.ttl > 0) {
      ttl = entry.ttl;
    } else if (this.config.defaultTTL && this.config.defaultTTL > 0) {
      ttl = this.config.defaultTTL;
    }

    // ioredis expects expiry as positional args, not a node-redis options
    // object: set(key, value, 'EX', seconds).
    if (ttl > 0) {
      await client.set(this.prefixKey(key), data, 'EX', ttl);
    } else {
      await client.set(this.prefixKey(key), data);
    }
    this.stats.entries++;
  }

  async has(key: string): Promise<boolean> {
    const client = await this.ensureConnected();
    const exists = await client.exists(this.prefixKey(key));
    return exists > 0;
  }

  async delete(key: string): Promise<boolean> {
    const client = await this.ensureConnected();
    const deleted = await client.del(this.prefixKey(key));
    if (deleted > 0) {
      this.stats.deletes++;
      this.stats.entries = Math.max(0, this.stats.entries - 1);
    }
    return deleted > 0;
  }

  async clear(): Promise<void> {
    const client = await this.ensureConnected();
    const keys = await client.keys(this.prefixKey('*'));
    if (keys.length > 0) {
      await client.del(...keys);
    }
    this.stats.entries = 0;
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

  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.connected = false;
    }
  }

  /**
   * Add prefix to key
   */
  private prefixKey(key: string): string {
    const prefix = this.config.keyPrefix ?? this.options.keyPrefix ?? 'emb';
    return `${prefix}:${key}`;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}

/**
 * Create a Redis cache
 */
export function createRedisCache(options: RedisCacheOptions): RedisCache {
  return new RedisCache(options);
}
