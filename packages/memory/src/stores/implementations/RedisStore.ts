/**
 * RedisStore
 *
 * Redis-based memory store with vector support.
 */

import type {
  MemoryEntry,
  MemoryUpdateInput,
  MemoryQueryOptions,
  MemoryQueryResult,
  MemoryStoreInterface,
  ScoredMemory,
  VectorSearchOptions,
  RedisStoreConfig,
} from '../../types/index.js';

// Dynamic import for ioredis
type Redis = import('ioredis').default;

/**
 * Redis store implementation
 */
export class RedisStore implements MemoryStoreInterface {
  private redis: Redis | null = null;
  private config: RedisStoreConfig;
  private keyPrefix: string;
  private ttl?: number;
  private initialized = false;

  constructor(config: RedisStoreConfig) {
    this.config = config;
    this.keyPrefix = config.keyPrefix ?? 'memory:';
    this.ttl = config.ttl;
  }

  /**
   * Initialize Redis connection
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const Redis = (await import('ioredis')).default;

    if (this.config.url) {
      this.redis = new Redis(this.config.url);
    } else {
      this.redis = new Redis({
        host: this.config.host ?? 'localhost',
        port: this.config.port ?? 6379,
        password: this.config.password,
        db: this.config.db ?? 0,
      });
    }

    this.initialized = true;
  }

  /**
   * Ensure Redis is initialized
   */
  private async ensureInitialized(): Promise<Redis> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.redis!;
  }

  /**
   * Get key for memory entry
   */
  private getKey(id: string): string {
    return `${this.keyPrefix}${id}`;
  }

  /**
   * Get index key
   */
  private getIndexKey(index: string): string {
    return `${this.keyPrefix}index:${index}`;
  }

  /**
   * Add a memory entry
   */
  async add(entry: MemoryEntry): Promise<string> {
    const redis = await this.ensureInitialized();
    const key = this.getKey(entry.id);

    // Store entry as JSON
    const data = JSON.stringify(entry);

    if (this.ttl || entry.expiresAt) {
      const ttlMs = entry.expiresAt
        ? entry.expiresAt - Date.now()
        : this.ttl! * 1000;

      if (ttlMs > 0) {
        await redis.setex(key, Math.ceil(ttlMs / 1000), data);
      } else {
        await redis.set(key, data);
      }
    } else {
      await redis.set(key, data);
    }

    // Add to indexes
    await this.addToIndexes(entry);

    return entry.id;
  }

  /**
   * Add entry to indexes
   */
  private async addToIndexes(entry: MemoryEntry): Promise<void> {
    const redis = await this.ensureInitialized();
    const score = entry.timestamp;

    // Add to main index
    await redis.zadd(this.getIndexKey('all'), score, entry.id);

    // Add to type index
    await redis.zadd(this.getIndexKey(`type:${entry.type}`), score, entry.id);

    // Add to namespace index
    const namespace = entry.metadata.namespace ?? 'default';
    await redis.zadd(
      this.getIndexKey(`namespace:${namespace}`),
      score,
      entry.id,
    );

    // Add to user index if applicable
    if (entry.metadata.userId) {
      await redis.zadd(
        this.getIndexKey(`user:${entry.metadata.userId}`),
        score,
        entry.id,
      );
    }

    // Add to conversation index if applicable
    if (entry.metadata.conversationId) {
      await redis.zadd(
        this.getIndexKey(`conversation:${entry.metadata.conversationId}`),
        score,
        entry.id,
      );
    }
  }

  /**
   * Remove entry from indexes
   */
  private async removeFromIndexes(entry: MemoryEntry): Promise<void> {
    const redis = await this.ensureInitialized();

    await redis.zrem(this.getIndexKey('all'), entry.id);
    await redis.zrem(this.getIndexKey(`type:${entry.type}`), entry.id);

    const namespace = entry.metadata.namespace ?? 'default';
    await redis.zrem(this.getIndexKey(`namespace:${namespace}`), entry.id);

    if (entry.metadata.userId) {
      await redis.zrem(
        this.getIndexKey(`user:${entry.metadata.userId}`),
        entry.id,
      );
    }

    if (entry.metadata.conversationId) {
      await redis.zrem(
        this.getIndexKey(`conversation:${entry.metadata.conversationId}`),
        entry.id,
      );
    }
  }

  /**
   * Get a memory entry by ID
   */
  async get(id: string): Promise<MemoryEntry | null> {
    const redis = await this.ensureInitialized();
    const key = this.getKey(id);

    const data = await redis.get(key);
    if (!data) {
      return null;
    }

    const entry = JSON.parse(data) as MemoryEntry;

    // Update access count
    entry.accessCount++;
    entry.lastAccessedAt = Date.now();
    await redis.set(key, JSON.stringify(entry));

    return entry;
  }

  /**
   * Update a memory entry
   */
  async update(id: string, updates: MemoryUpdateInput): Promise<boolean> {
    const redis = await this.ensureInitialized();
    const existing = await this.get(id);

    if (!existing) {
      return false;
    }

    // Remove from old indexes
    await this.removeFromIndexes(existing);

    const updated: MemoryEntry = {
      ...existing,
      ...updates,
      metadata: {
        ...existing.metadata,
        ...updates.metadata,
      },
      updatedAt: Date.now(),
    };

    const key = this.getKey(id);
    await redis.set(key, JSON.stringify(updated));

    // Add to new indexes
    await this.addToIndexes(updated);

    return true;
  }

  /**
   * Delete a memory entry
   */
  async delete(id: string): Promise<boolean> {
    const redis = await this.ensureInitialized();
    const existing = await this.get(id);

    if (!existing) {
      return false;
    }

    // Remove from indexes
    await this.removeFromIndexes(existing);

    // Delete entry
    const result = await redis.del(this.getKey(id));
    return result > 0;
  }

  /**
   * Query memory entries
   */
  async query(options: MemoryQueryOptions): Promise<MemoryQueryResult> {
    const redis = await this.ensureInitialized();

    // Determine which index to use
    let indexKey = this.getIndexKey('all');

    if (options.conversationId) {
      indexKey = this.getIndexKey(`conversation:${options.conversationId}`);
    } else if (options.userId) {
      indexKey = this.getIndexKey(`user:${options.userId}`);
    } else if (options.namespace) {
      indexKey = this.getIndexKey(`namespace:${options.namespace}`);
    } else if (options.types && options.types.length === 1) {
      indexKey = this.getIndexKey(`type:${options.types[0]}`);
    }

    // Get IDs from index
    const minScore = options.startTime ?? '-inf';
    const maxScore = options.endTime ?? '+inf';

    const ids = await redis.zrevrangebyscore(
      indexKey,
      maxScore,
      minScore,
      'LIMIT',
      0,
      1000, // Get more than needed for filtering
    );

    // Fetch entries
    const entries: MemoryEntry[] = [];
    const pipeline = redis.pipeline();

    for (const id of ids) {
      pipeline.get(this.getKey(id));
    }

    const results = await pipeline.exec();

    if (results) {
      for (const [err, data] of results) {
        if (!err && data) {
          const entry = JSON.parse(data as string) as MemoryEntry;
          if (this.matchesQuery(entry, options)) {
            entries.push(entry);
          }
        }
      }
    }

    // Apply pagination
    const limit = options.limit ?? 100;
    const offset = options.offset ?? 0;
    const paginated = entries.slice(offset, offset + limit);

    return {
      entries: paginated,
      total: entries.length,
      hasMore: offset + limit < entries.length,
    };
  }

  /**
   * Check if entry matches query
   */
  private matchesQuery(
    entry: MemoryEntry,
    options: MemoryQueryOptions,
  ): boolean {
    if (options.query) {
      if (!entry.content.toLowerCase().includes(options.query.toLowerCase())) {
        return false;
      }
    }

    if (options.userId && entry.metadata.userId !== options.userId) {
      return false;
    }

    if (options.agentId && entry.metadata.agentId !== options.agentId) {
      return false;
    }

    if (
      options.conversationId &&
      entry.metadata.conversationId !== options.conversationId
    ) {
      return false;
    }

    if (options.namespace && entry.metadata.namespace !== options.namespace) {
      return false;
    }

    if (
      options.types &&
      options.types.length > 0 &&
      !options.types.includes(entry.type)
    ) {
      return false;
    }

    if (
      options.minImportance !== undefined &&
      entry.importance < options.minImportance
    ) {
      return false;
    }

    if (options.tags && options.tags.length > 0) {
      const entryTags = entry.metadata.tags ?? [];
      if (!options.tags.every((tag) => entryTags.includes(tag))) {
        return false;
      }
    }

    if (
      !options.includeExpired &&
      entry.expiresAt &&
      entry.expiresAt < Date.now()
    ) {
      return false;
    }

    return true;
  }

  /**
   * Search by vector similarity
   */
  async search(
    embedding: number[],
    options: VectorSearchOptions,
  ): Promise<ScoredMemory[]> {
    // Redis doesn't have native vector support without RediSearch
    // Fall back to brute-force search
    const { entries } = await this.query({
      limit: 10000,
      namespace: options.namespace,
    });

    const results: ScoredMemory[] = [];

    for (const entry of entries) {
      if (!entry.embedding) continue;

      // Apply filters
      if (options.filter) {
        let matches = true;
        for (const [key, value] of Object.entries(options.filter)) {
          if (value !== undefined) {
            const metaValue = entry.metadata[key];
            if (Array.isArray(value)) {
              if (!value.includes(metaValue)) {
                matches = false;
                break;
              }
            } else if (metaValue !== value) {
              matches = false;
              break;
            }
          }
        }
        if (!matches) continue;
      }

      const score = this.cosineSimilarity(embedding, entry.embedding);

      if (options.minScore === undefined || score >= options.minScore) {
        results.push({ entry, score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return Promise.resolve(results.slice(0, options.topK));
  }

  /**
   * Calculate cosine similarity
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

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Clear entries
   */
  async clear(options?: {
    namespace?: string;
    userId?: string;
  }): Promise<number> {
    const redis = await this.ensureInitialized();

    if (!options) {
      // Get all memory keys
      const keys = await redis.keys(`${this.keyPrefix}*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      return keys.length;
    }

    // Get entries matching filter and delete them
    const { entries } = await this.query({
      namespace: options.namespace,
      userId: options.userId,
      limit: 100000,
    });

    for (const entry of entries) {
      await this.delete(entry.id);
    }

    return entries.length;
  }

  /**
   * Count entries
   */
  async count(options?: MemoryQueryOptions): Promise<number> {
    const redis = await this.ensureInitialized();

    if (!options) {
      return Promise.resolve(redis.zcard(this.getIndexKey('all')));
    }

    const { total } = await this.query({ ...options, limit: 0 });
    return total;
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
      this.initialized = false;
    }
  }
}

/**
 * Create a Redis store
 */
export async function createRedisStore(
  config: RedisStoreConfig,
): Promise<RedisStore> {
  const store = new RedisStore(config);
  await store.initialize();
  return store;
}
