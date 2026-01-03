/**
 * Store Types
 *
 * Type definitions for cache storage backends.
 */

import type { CacheBackendType, CacheEntry } from './cache.types.js';

/**
 * Base store configuration
 */
export interface StoreConfig {
  type: CacheBackendType;
  namespace?: string;
}

/**
 * Memory store configuration
 */
export interface MemoryStoreConfig extends StoreConfig {
  type: 'memory';
  /** Maximum number of entries */
  maxEntries?: number;
  /** Maximum size in bytes */
  maxSizeBytes?: number;
  /** Eviction policy */
  evictionPolicy?: 'lru' | 'lfu' | 'fifo';
}

/**
 * Redis store configuration
 */
export interface RedisStoreConfig extends StoreConfig {
  type: 'redis';
  /** Redis URL (e.g., redis://localhost:6379) */
  url?: string;
  /** Redis host */
  host?: string;
  /** Redis port */
  port?: number;
  /** Redis password */
  password?: string;
  /** Redis database number */
  db?: number;
  /** Key prefix */
  keyPrefix?: string;
  /** Connection timeout in ms */
  connectTimeout?: number;
  /** Enable TLS */
  tls?: boolean;
}

/**
 * SQLite store configuration
 */
export interface SQLiteStoreConfig extends StoreConfig {
  type: 'sqlite';
  /** Database file path */
  dbPath?: string;
  /** Use in-memory database */
  inMemory?: boolean;
  /** Enable vector extension (sqlite-vss) */
  enableVector?: boolean;
}

/**
 * Pinecone store configuration
 */
export interface PineconeStoreConfig extends StoreConfig {
  type: 'pinecone';
  /** Pinecone API key */
  apiKey: string;
  /** Pinecone index name */
  index: string;
  /** Pinecone namespace */
  namespace?: string;
  /** Pinecone host URL */
  host?: string;
}

/**
 * Tiered store configuration
 */
export interface TieredStoreConfig extends StoreConfig {
  type: 'tiered';
  /** Tier configurations */
  tiers: TierConfig[];
  /** Write to all tiers (vs write-back) */
  writeThrough?: boolean;
  /** Promote entries to higher tiers on hit */
  promoteOnHit?: boolean;
  /** Hit count before promotion */
  promotionThreshold?: number;
}

/**
 * Individual tier configuration
 */
export interface TierConfig {
  /** Tier name */
  name: string;
  /** Store type for this tier */
  type?: CacheBackendType;
  /** Store-specific config */
  config?: StoreConfig;
  /** Priority (lower = checked first) */
  priority: number;
  /** TTL for this tier (optional override) */
  ttl?: number;
  /** Maximum entries in this tier */
  maxSize?: number;
  /** Access count threshold for promotion to this tier */
  promotionThreshold?: number;
  /** Target capacity percentage after demotion (0-1) */
  demotionTarget?: number;
  /** Pre-instantiated store (alternative to type+config) */
  store?: import('../stores/BaseCacheStore.js').BaseCacheStore;
}

/**
 * Store health status
 */
export interface StoreHealth {
  /** Whether the store is healthy */
  healthy: boolean;
  /** Last operation latency */
  latencyMs: number;
  /** Last health check timestamp */
  lastCheck: number;
  /** Error message if unhealthy */
  error?: string;
}

/**
 * Result of an upsert operation
 */
export interface UpsertResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** ID of the upserted entry */
  id: string;
  /** Operation duration in ms */
  durationMs: number;
}

/**
 * Query options for vector search
 */
export interface StoreQueryOptions {
  /** Number of results to return */
  topK?: number;
  /** Minimum similarity threshold */
  minSimilarity?: number;
  /** Filter by namespace */
  namespace?: string;
  /** Additional filters */
  filter?: Record<string, unknown>;
  /** Include metadata in results */
  includeMetadata?: boolean;
  /** Include embedding vectors in results */
  includeEmbedding?: boolean;
}

/**
 * Result of a vector query
 */
export interface StoreQueryResult {
  /** Matching entries with scores */
  entries: Array<CacheEntry & { score: number }>;
  /** Query duration in ms */
  durationMs: number;
}

/**
 * Store metrics
 */
export interface StoreMetrics {
  /** Total get operations */
  gets: number;
  /** Total set operations */
  sets: number;
  /** Total delete operations */
  deletes: number;
  /** Cache hits */
  hits: number;
  /** Cache misses */
  misses: number;
  /** Average latency for get operations */
  avgGetLatencyMs?: number;
  /** Average latency for set operations */
  avgSetLatencyMs?: number;
}
