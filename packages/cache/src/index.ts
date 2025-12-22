/**
 * @lov3kaizen/agentsea-cache
 *
 * Semantic caching layer for LLM responses.
 * Reduces LLM costs by 30-50% through intelligent caching.
 *
 * @packageDocumentation
 */

// Core exports
export {
  SemanticCache,
  createSemanticCache,
  type SemanticCacheEvents,
  type CacheRequest,
  type CacheResponseInput,
} from './core/SemanticCache.js';

export {
  generateCacheKey,
  generateSemanticKey,
  generateConversationFingerprint,
  normalizeWhitespace,
  extractUserMessage,
  extractSystemPrompt,
} from './core/CacheKey.js';

export { generateId, now, isExpired, estimateEntrySize } from './core/utils.js';

// Store exports
export { BaseCacheStore } from './stores/BaseCacheStore.js';
export {
  MemoryCacheStore,
  createMemoryCacheStore,
} from './stores/MemoryCacheStore.js';
export {
  RedisCacheStore,
  createRedisCacheStore,
} from './stores/RedisCacheStore.js';
export {
  SQLiteCacheStore,
  createSQLiteCacheStore,
} from './stores/SQLiteCacheStore.js';
export {
  TieredCacheStore,
  createTieredCacheStore,
} from './stores/TieredCacheStore.js';
export {
  PineconeCacheStore,
  createPineconeCacheStore,
} from './stores/PineconeCacheStore.js';

// Strategy exports
export { BaseMatchStrategy } from './strategies/BaseMatchStrategy.js';
export {
  ExactMatchStrategy,
  createExactMatchStrategy,
} from './strategies/ExactMatchStrategy.js';
export {
  SemanticMatchStrategy,
  createSemanticMatchStrategy,
} from './strategies/SemanticMatchStrategy.js';
export {
  HybridMatchStrategy,
  createHybridMatchStrategy,
} from './strategies/HybridMatchStrategy.js';

// Similarity exports
export {
  SimilarityEngine,
  createSimilarityEngine,
  type EmbeddingProvider,
  type SimilarityMetric,
  type SimilarityEngineConfig,
} from './similarity/SimilarityEngine.js';

export {
  cosineSimilarity,
  euclideanDistance,
  dotProduct,
  manhattanDistance,
  distanceToSimilarity,
  normalize,
  magnitude,
} from './similarity/metrics/SimilarityMetrics.js';

// Analytics exports
export {
  CacheAnalytics,
  createCacheAnalytics,
} from './analytics/CacheAnalytics.js';

// Streaming exports
export { ChunkBuffer, createChunkBuffer } from './streaming/ChunkBuffer.js';
export {
  StreamRecorder,
  createStreamRecorder,
} from './streaming/StreamRecorder.js';
export {
  StreamReplayer,
  createStreamReplayer,
} from './streaming/StreamReplayer.js';
export {
  StreamCache,
  createStreamCache,
  type StreamCacheEvents,
} from './streaming/StreamCache.js';

// Invalidation exports
export {
  InvalidationManager,
  createInvalidationManager,
  type InvalidationManagerEvents,
} from './invalidation/InvalidationManager.js';

// Type exports
export type {
  // Cache types
  CacheBackendType,
  CacheMessage,
  CacheEntry,
  CacheResponse,
  TokenUsage,
  CacheEntryMetadata,
  SemanticCacheConfig,
  CacheLookupResult,
  CacheStats,
  WrapOptions,
  CacheKeyOptions,
  // Store types
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
  // Strategy types
  MatchStrategyType,
  MatchOptions,
  MatchRequest,
  MatchResult,
  ExactMatchConfig,
  SemanticMatchConfig,
  HybridMatchConfig,
  // Analytics types
  AnalyticsData,
  CostSavingsReport,
  ModelPricing,
  PerformanceMetrics,
  AnalyticsConfig,
  // Streaming types
  StreamChunkType,
  StreamChunk,
  RecordedStream,
  ChunkBufferConfig,
  StreamRecorderConfig,
  StreamReplayerConfig,
  StreamCacheConfig,
  StreamCacheLookupResult,
  StreamCacheStats,
  // Invalidation types
  InvalidationStrategyType,
  InvalidationEvent,
  InvalidationResult,
  InvalidationManagerConfig,
  InvalidationStats,
} from './types/index.js';
