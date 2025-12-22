/**
 * Caching Module Exports
 */

export { BaseCache } from './BaseCache.js';
export { MemoryCache, createMemoryCache } from './MemoryCache.js';
export { RedisCache, createRedisCache } from './RedisCache.js';
export { SQLiteCache, createSQLiteCache } from './SQLiteCache.js';
export {
  TieredCache,
  createTieredCache,
  createStandardTieredCache,
} from './TieredCache.js';

// Re-export cache types
export type {
  CacheBackendType,
  CachedEmbedding,
  CacheEntryInfo,
  CacheOptions,
  MemoryCacheOptions,
  RedisCacheOptions,
  SQLiteCacheOptions,
  TieredCacheOptions,
  TierConfig,
  CacheLookupResult,
  BatchCacheLookupResult,
  CacheStats,
  CacheEvictionPolicy,
  CacheKeyOptions,
  CacheWarmupOptions,
  CacheExportFormat,
  CacheImportOptions,
  CacheCleanupOptions,
  CacheCleanupResult,
} from '../types/index.js';

import type {
  CacheBackendType,
  CacheOptions,
  MemoryCacheOptions,
  RedisCacheOptions,
  SQLiteCacheOptions,
  TieredCacheOptions,
} from '../types/index.js';
import { MemoryCache } from './MemoryCache.js';
import { RedisCache } from './RedisCache.js';
import { SQLiteCache } from './SQLiteCache.js';
import { TieredCache } from './TieredCache.js';
import { BaseCache } from './BaseCache.js';

/**
 * Cache factory
 */
export function createCache(
  type: CacheBackendType,
  options?: CacheOptions,
): BaseCache {
  switch (type) {
    case 'memory':
      return new MemoryCache(options as MemoryCacheOptions);
    case 'redis':
      return new RedisCache(options as RedisCacheOptions);
    case 'sqlite':
      return new SQLiteCache(options as SQLiteCacheOptions);
    case 'tiered':
      return new TieredCache(options as TieredCacheOptions);
    default:
      return new MemoryCache(options as MemoryCacheOptions);
  }
}
