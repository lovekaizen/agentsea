/**
 * Caching Types
 *
 * Types for embedding cache systems.
 */

import type { EmbeddingVector } from './embedding.types.js';

/**
 * Cache backend type
 */
export type CacheBackendType =
  | 'memory'
  | 'redis'
  | 'sqlite'
  | 'file'
  | 'tiered';

/**
 * Cached embedding entry
 */
export interface CachedEmbedding {
  /** Cache key (content hash) */
  key: string;
  /** Embedding vector */
  vector: EmbeddingVector;
  /** Original text */
  text: string;
  /** Model used */
  model: string;
  /** Embedding dimensions */
  dimensions: number;
  /** Token count */
  tokenCount: number;
  /** Creation timestamp */
  createdAt: number;
  /** Last accessed timestamp */
  accessedAt: number;
  /** Access count */
  accessCount: number;
  /** TTL in seconds (0 = no expiry) */
  ttl: number;
  /** Version tag */
  version?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Cache entry info (without vector)
 */
export interface CacheEntryInfo {
  /** Cache key */
  key: string;
  /** Model used */
  model: string;
  /** Dimensions */
  dimensions: number;
  /** Token count */
  tokenCount: number;
  /** Created timestamp */
  createdAt: number;
  /** Last accessed */
  accessedAt: number;
  /** Access count */
  accessCount: number;
  /** Size in bytes (estimated) */
  sizeBytes: number;
}

/**
 * Base cache options
 */
export interface CacheOptions {
  /** Default TTL in seconds (0 = no expiry) */
  defaultTTL?: number;
  /** Maximum entries */
  maxEntries?: number;
  /** Maximum size in bytes */
  maxSizeBytes?: number;
  /** Key prefix */
  keyPrefix?: string;
  /** Enable compression */
  compression?: boolean;
  /** Compression threshold in bytes */
  compressionThreshold?: number;
}

/**
 * Memory cache options
 */
export interface MemoryCacheOptions extends CacheOptions {
  /** LRU cache max age (ms) */
  maxAge?: number;
  /** Update age on get */
  updateAgeOnGet?: boolean;
  /** Stale-while-revalidate time (ms) */
  staleWhileRevalidate?: number;
}

/**
 * Redis cache options
 */
export interface RedisCacheOptions extends CacheOptions {
  /** Redis host */
  host?: string;
  /** Redis port */
  port?: number;
  /** Redis password */
  password?: string;
  /** Redis database number */
  db?: number;
  /** Connection URL (overrides host/port) */
  url?: string;
  /** Connection timeout (ms) */
  connectTimeout?: number;
  /** Command timeout (ms) */
  commandTimeout?: number;
  /** Enable cluster mode */
  cluster?: boolean;
  /** Cluster nodes */
  clusterNodes?: Array<{ host: string; port: number }>;
  /** Sentinel configuration */
  sentinel?: {
    master: string;
    sentinels: Array<{ host: string; port: number }>;
  };
}

/**
 * SQLite cache options
 */
export interface SQLiteCacheOptions extends CacheOptions {
  /** Database file path */
  dbPath?: string;
  /** In-memory database */
  inMemory?: boolean;
  /** WAL mode */
  walMode?: boolean;
  /** Busy timeout (ms) */
  busyTimeout?: number;
  /** Auto vacuum */
  autoVacuum?: boolean;
  /** Vacuum interval (entries) */
  vacuumInterval?: number;
}

/**
 * File cache options
 */
export interface FileCacheOptions extends CacheOptions {
  /** Cache directory */
  cacheDir?: string;
  /** File extension */
  fileExtension?: string;
  /** Directory depth for sharding */
  directoryDepth?: number;
}

/**
 * Tiered cache options
 */
export interface TieredCacheOptions extends CacheOptions {
  /** Cache tier configurations */
  tiers: TierConfig[];
  /** Write-through to all tiers */
  writeThrough?: boolean;
  /** Promote on hit */
  promoteOnHit?: boolean;
}

/**
 * Cache tier configuration
 */
export interface TierConfig {
  /** Tier name */
  name: string;
  /** Backend type */
  type: CacheBackendType;
  /** Tier-specific options */
  options: CacheOptions;
  /** Priority (lower = faster/preferred) */
  priority: number;
}

/**
 * Cache lookup result
 */
export interface CacheLookupResult {
  /** Whether entry was found */
  hit: boolean;
  /** Cached embedding (if found) */
  entry?: CachedEmbedding;
  /** Cache tier hit occurred at */
  tier?: string;
  /** Lookup latency (ms) */
  latencyMs: number;
}

/**
 * Batch cache lookup result
 */
export interface BatchCacheLookupResult {
  /** Cache hits */
  hits: Map<string, CachedEmbedding>;
  /** Cache misses (keys not found) */
  misses: string[];
  /** Hit rate */
  hitRate: number;
  /** Total lookup time (ms) */
  latencyMs: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  /** Total entries */
  entries: number;
  /** Total size in bytes */
  sizeBytes: number;
  /** Total hits */
  hits: number;
  /** Total misses */
  misses: number;
  /** Hit rate (0-1) */
  hitRate: number;
  /** Total gets */
  gets: number;
  /** Total sets */
  sets: number;
  /** Total deletes */
  deletes: number;
  /** Evictions */
  evictions: number;
  /** Average get latency (ms) */
  avgGetLatencyMs: number;
  /** Average set latency (ms) */
  avgSetLatencyMs: number;
  /** Memory usage (if applicable) */
  memoryUsageBytes?: number;
  /** Per-tier stats (for tiered cache) */
  tierStats?: Record<string, CacheStats>;
}

/**
 * Cache eviction policy
 */
export type CacheEvictionPolicy = 'lru' | 'lfu' | 'fifo' | 'ttl' | 'random';

/**
 * Cache key generator options
 */
export interface CacheKeyOptions {
  /** Include model in key */
  includeModel?: boolean;
  /** Include version in key */
  includeVersion?: boolean;
  /** Custom key prefix */
  prefix?: string;
  /** Hash algorithm */
  hashAlgorithm?: 'md5' | 'sha1' | 'sha256' | 'xxhash';
}

/**
 * Cache warmup options
 */
export interface CacheWarmupOptions {
  /** Texts to pre-cache */
  texts: string[];
  /** Concurrency */
  concurrency?: number;
  /** Progress callback */
  onProgress?: (progress: { completed: number; total: number }) => void;
}

/**
 * Cache export format
 */
export interface CacheExportFormat {
  /** Format version */
  version: string;
  /** Export timestamp */
  exportedAt: number;
  /** Total entries */
  totalEntries: number;
  /** Entries */
  entries: CachedEmbedding[];
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Cache import options
 */
export interface CacheImportOptions {
  /** Skip existing entries */
  skipExisting?: boolean;
  /** Update existing entries */
  updateExisting?: boolean;
  /** Validate entries */
  validate?: boolean;
  /** Progress callback */
  onProgress?: (progress: { imported: number; total: number }) => void;
}

/**
 * Cache cleanup options
 */
export interface CacheCleanupOptions {
  /** Remove expired entries */
  removeExpired?: boolean;
  /** Remove entries older than (seconds) */
  olderThan?: number;
  /** Remove entries not accessed since (seconds) */
  notAccessedSince?: number;
  /** Remove entries for specific model */
  model?: string;
  /** Remove entries for specific version */
  version?: string;
  /** Dry run (don't actually delete) */
  dryRun?: boolean;
}

/**
 * Cache cleanup result
 */
export interface CacheCleanupResult {
  /** Entries removed */
  removed: number;
  /** Space freed (bytes) */
  freedBytes: number;
  /** Time taken (ms) */
  durationMs: number;
  /** Was dry run */
  dryRun: boolean;
}
