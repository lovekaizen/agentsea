/**
 * @lov3kaizen/agentsea-memory
 *
 * Advanced memory management system for AI agents.
 */

// Types - export types explicitly to avoid conflicts
export type {
  // Core types
  MemoryEntry,
  MemoryType,
  MemoryMetadata,
  MemoryInput,
  MemoryUpdateInput,
  MemoryQueryOptions,
  MemoryQueryResult,
  ScoredMemory,
  MemoryManagerConfig,
  MemoryStoreInterface,
  VectorSearchOptions,
  RetrievalOptions,
  EmbeddingProviderInterface,
  RetrievalStrategyInterface,
  // Store configs
  InMemoryStoreConfig,
  SQLiteStoreConfig,
  PostgresStoreConfig,
  RedisStoreConfig,
  PineconeStoreConfig,
  // Retrieval configs
  SemanticRetrievalConfig,
  HybridRetrievalConfig,
  TemporalRetrievalConfig,
  RetrievalPipelineConfig,
  RetrievalResultWithDebug,
  // Structure configs
  WorkingMemoryConfig,
  EpisodicMemoryConfig,
  SemanticMemoryConfig,
  LongTermMemoryConfig,
  HierarchicalMemoryConfig,
  // Processing configs
  SummarizerConfig,
  CompressorConfig,
  ConsolidatorConfig,
  ForgetterConfig,
  ExtractorConfig,
  // Sharing configs
  SharedMemoryConfig,
  NamespaceConfig,
  AccessControlConfig,
  SyncManagerConfig,
  // Debug configs
  InspectorConfig,
  TimelineConfig,
  RetrievalDebugOptions,
  ExportOptions,
} from './types/index.js';

// Core
export { MemoryManager, createMemoryManager } from './core/index.js';

// Stores
export {
  InMemoryStore,
  createInMemoryStore,
  SQLiteStore,
  createSQLiteStore,
  PostgresStore,
  createPostgresStore,
  RedisStore,
  createRedisStore,
} from './stores/index.js';

// Retrieval strategies
export {
  SemanticRetrieval,
  createSemanticRetrieval,
  HybridRetrieval,
  createHybridRetrieval,
  TemporalRetrieval,
  createTemporalRetrieval,
  TimeWindows,
  RetrievalPipeline,
  PipelineBuilder,
  createRetrievalPipeline,
  createPipelineBuilder,
  type EmbeddingFunction,
  type SemanticRetrievalOptions,
  type HybridRetrievalOptions,
  type TemporalRetrievalOptions,
  type TimeWindow,
  type TemporalPattern,
  type PipelineStage,
  type StageConfig,
  type PipelineContext,
  type PipelineConfig,
  type BuiltInStage,
} from './retrieval/index.js';

// Memory structures
export {
  WorkingMemory,
  createWorkingMemory,
  EpisodicMemory,
  createEpisodicMemory,
  SemanticMemory,
  createSemanticMemory,
  LongTermMemory,
  createLongTermMemory,
  HierarchicalMemory,
  createHierarchicalMemory,
  type WorkingMemoryEvents,
  type AttentionScore,
  type Episode,
  type EpisodicMemoryEvents,
  type Concept,
  type Relationship,
  type SemanticMemoryEvents,
  type ConsolidatedMemory,
  type LongTermMemoryEvents,
  type MemoryLayer,
  type RoutingDecision,
  type HierarchicalMemoryEvents,
  type HierarchicalSearchResult,
} from './structures/index.js';

// Processing utilities
export {
  Summarizer,
  createSummarizer,
  Compressor,
  createCompressor,
  Consolidator,
  createConsolidator,
  Forgetter,
  createForgetter,
  Extractor,
  createExtractor,
  type SummaryResult,
  type SummaryFunction,
  type CompressionResult,
  type BatchCompressionResult,
  type ConsolidationGroup,
  type ConsolidationResult,
  type ForgettingCurve,
  type RetentionScore,
  type ForgettingResult,
  type ExtractedEntity,
  type ExtractedRelation,
  type ExtractionResult,
  type ExtractionFunction,
} from './processing/index.js';

// Multi-agent sharing
export {
  SharedMemory,
  createSharedMemory,
  NamespaceManager,
  createNamespaceManager,
  AccessControl,
  createAccessControl,
  type SharedMemoryEvents,
  type SharedValue,
  type SyncResult,
  type NamespaceMetadata,
  type NamespaceSettings,
  type NamespaceEvents,
  type Permission,
  type PermissionRule,
  type PermissionCondition,
  type AccessRequest,
  type AccessResult,
  type AccessLogEntry,
  type AccessControlEvents,
} from './sharing/index.js';

// Debug tools
export {
  Inspector,
  createInspector,
  Timeline,
  createTimeline,
  Debugger,
  createDebugger,
  Exporter,
  createExporter,
  type MemoryStats,
  type HealthReport,
  type HealthIssue,
  type InspectionResult,
  type TimelineEvent,
  type TimelineSegment,
  type TimelineMarker,
  type DebugTrace,
  type RetrievalDebugInfo,
  type Breakpoint,
  type DebuggerEvents,
  type ExportFormat,
  type ExportResult,
  type ImportResult,
} from './debug/index.js';

// AgentSea integrations
export {
  AgentMemory,
  createAgentMemory,
  type AgentMemoryConfig,
  type ConversationTurn,
  type AgentMemoryEvents,
} from './integrations/index.js';
