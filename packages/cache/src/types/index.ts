/**
 * @lov3kaizen/agentsea-cache Types
 *
 * Re-exports all type definitions for the semantic cache package.
 */

// Cache types
export type {
  CacheBackendType,
  CacheMessage,
  CacheEntry,
  CacheRequest,
  CacheResponse,
  TokenUsage,
  CacheEntryMetadata,
  SemanticCacheConfig,
  CacheLookupResult,
  CacheStats,
  WrapOptions,
  CacheKeyOptions,
} from './cache.types.js';

// Store types
export type {
  StoreConfig,
  MemoryStoreConfig,
  RedisStoreConfig,
  SQLiteStoreConfig,
  PineconeStoreConfig,
  TieredStoreConfig,
  TierConfig,
  StoreHealth,
  UpsertResult,
  StoreQueryOptions,
  StoreQueryResult,
  StoreMetrics,
} from './store.types.js';

// Strategy types
export type {
  MatchStrategyType,
  MatchOptions,
  MatchRequest,
  MatchResult,
  ExactMatchConfig,
  SemanticMatchConfig,
  HybridMatchConfig,
  FuzzyMatchConfig,
  ThresholdConfig,
  ContextType,
  ContextDetector,
} from './strategy.types.js';

// Analytics types
export type {
  AnalyticsData,
  CostSavingsReport,
  ModelPricing,
  PerformanceMetrics,
  HitEvent,
  MissEvent,
  AnalyticsQueryOptions,
  AnalyticsExportFormat,
  AnalyticsConfig,
} from './analytics.types.js';

// Streaming types
export type {
  StreamChunkType,
  StreamChunk,
  RecordedStream,
  ChunkBufferConfig,
  StreamRecorderConfig,
  StreamReplayerConfig,
  StreamCacheConfig,
  StreamCacheLookupResult,
  StreamCacheStats,
} from './streaming.types.js';

// Invalidation types
export type {
  InvalidationStrategyType,
  BaseInvalidationConfig,
  TTLInvalidationConfig,
  LRUInvalidationConfig,
  EventInvalidationConfig,
  InvalidationPattern,
  SmartInvalidationConfig,
  InvalidationEvent,
  InvalidationResult,
  InvalidationManagerConfig,
  InvalidationStats,
} from './invalidation.types.js';
