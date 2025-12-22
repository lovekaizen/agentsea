/**
 * @lov3kaizen/agentsea-embeddings
 *
 * Vector embedding lifecycle management toolkit for Node.js.
 * Versioning, caching, chunking, drift detection, and migration.
 */

// Core exports
export {
  EmbeddingModel,
  ModelRegistry,
  modelRegistry,
} from './core/EmbeddingModel.js';

export {
  EmbeddingManager,
  createEmbeddingManager,
  type EmbeddingManagerConfig,
  type EmbeddingManagerEvents,
  type EmbeddingCache,
  type EmbeddingChunker,
  type EmbeddingStore,
} from './core/EmbeddingManager.js';

export * from './core/utils.js';

// Provider exports
export {
  BaseProvider,
  OpenAIProvider,
  createOpenAIProvider,
  CohereProvider,
  createCohereProvider,
  VoyageProvider,
  createVoyageProvider,
  LocalProvider,
  createLocalProvider,
  createMockProvider,
  createRandomProvider,
  HuggingFaceProvider,
  createHuggingFaceProvider,
  type LocalEmbeddingFn,
  type LocalProviderOptions,
} from './providers/index.js';

// Chunking exports
export {
  BaseChunker,
  defaultTokenCounter,
  mergeSmallChunks,
  splitLargeChunks,
  FixedChunker,
  createFixedChunker,
  RecursiveChunker,
  createRecursiveChunker,
  MarkdownChunker,
  createMarkdownChunker,
  CodeChunker,
  createCodeChunker,
  SemanticChunker,
  createSemanticChunker,
  createChunker,
  chunk,
} from './chunking/index.js';

// Caching exports
export {
  BaseCache,
  MemoryCache,
  createMemoryCache,
  RedisCache,
  createRedisCache,
  SQLiteCache,
  createSQLiteCache,
  TieredCache,
  createTieredCache,
  createStandardTieredCache,
  createCache,
} from './caching/index.js';

// Store exports
export {
  BaseStore,
  MemoryStore,
  createMemoryStore,
  PineconeStore,
  createPineconeStore,
  ChromaStore,
  createChromaStore,
  QdrantStore,
  createQdrantStore,
  createStore,
  type StoreFactoryOptions,
} from './stores/index.js';

// Versioning exports
export { VersionRegistry, createVersionRegistry } from './versioning/index.js';

// Quality exports
export { DriftDetector, createDriftDetector } from './quality/index.js';

// Type exports
export type {
  // Embedding types
  EmbeddingVector,
  EmbeddingResult,
  BatchEmbeddingResult,
  EmbeddedChunk,
  ChunkMetadata,
  EmbeddingModelInfo,
  EmbeddingOptions,
  BatchEmbeddingOptions,
  BatchProgress,
  DocumentEmbeddingOptions,
  SearchResult,
  SearchOptions,
  SimilarityMetric,
  EmbeddingStats,

  // Chunking types
  ChunkingStrategyType,
  Chunk,
  ChunkingMetadata,
  ChunkingOptions,
  FixedChunkingOptions,
  SemanticChunkingOptions,
  RecursiveChunkingOptions,
  MarkdownChunkingOptions,
  CodeChunkingOptions,
  SentenceChunkingOptions,
  ParagraphChunkingOptions,
  ChunkingResult,
  ChunkingStats,
  ChunkingStrategyConfig,
  CustomChunkingFn,
  TokenCounterFn,
  TextSplitterFn,

  // Caching types
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

  // Provider types
  EmbeddingProviderType,
  ProviderConfig,
  OpenAIProviderConfig,
  CohereProviderConfig,
  VoyageProviderConfig,
  LocalProviderConfig,
  HuggingFaceProviderConfig,
  EmbeddingRequest,
  BatchEmbeddingRequest,
  ProviderResponse,
  TokenUsage,
  ProviderError,
  ProviderHealth,
  RateLimitInfo,
  ProviderMetrics,
  ModelInfo,
  ProviderCapabilities,
  ProviderFactoryOptions,
  CustomProviderConfig,

  // Store types
  VectorStoreType,
  StoreConfig,
  DistanceMetric,
  VectorRecord,
  StoredVector,
  PineconeStoreConfig,
  WeaviateStoreConfig,
  ChromaStoreConfig,
  QdrantStoreConfig,
  MilvusStoreConfig,
  PgVectorStoreConfig,
  MemoryStoreConfig,
  UpsertOptions,
  UpsertResult,
  DeleteOptions,
  DeleteResult,
  StoreQueryOptions,
  StoreQueryResult,
  StoreStats,
  StoreHealth,
  IndexInfo,
  CollectionInfo,

  // Versioning types
  EmbeddingVersion,
  VersionRegistryEntry,
  VersionComparisonResult,
  MigrationPlan,
  MigrationPlanStatus,
  MigrationStep,
  MigrationStepType,
  MigrationStepStatus,
  MigrationValidation,
  MigrationProgress,
  MigrationResult,
  MigrationError,
  MigrationOptions,
  RollbackOptions,
  VersionUpgradePath,
  VersionRegistryOptions,
  VersionChangeEvent,

  // Quality types
  QualityMetricType,
  QualityScore,
  QualityReport,
  DriftDetectionResult,
  DistributionComparison,
  DimensionStats,
  ReferenceDistribution,
  DriftMonitorConfig,
  QualityEvaluationOptions,
  GroundTruthData,
  CoherenceDetails,
  DiversityDetails,
  RetrievalAccuracyDetails,
  ClusterQualityDetails,
  QualityAlert,
  QualityMonitoringOptions,
  BenchmarkResult,

  // Pipeline types
  PipelineType,
  PipelineStatus,
  PipelineConfig,
  ChunkingPipelineConfig,
  RetryConfig,
  PipelineInput,
  PipelineOutput,
  BatchPipelineOptions,
  StreamPipelineOptions,
  DocumentPipelineOptions,
  PipelineProgress,
  PipelineError,
  PipelineResult,
  PipelineMetrics,
  PipelineEvent,
  PipelineEventType,
  PipelineCheckpoint,
  StreamItem,
  StreamResult,
  PipelineBuilderOptions,
} from './types/index.js';
