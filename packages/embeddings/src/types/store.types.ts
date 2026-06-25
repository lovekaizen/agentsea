/**
 * Store Types
 *
 * Types for vector store adapters.
 */

import type {
  EmbeddingVector,
  SearchResult,
  SearchOptions,
  ChunkMetadata,
} from './embedding.types.js';

/**
 * Vector store type
 */
export type VectorStoreType =
  | 'pinecone'
  | 'weaviate'
  | 'chroma'
  | 'qdrant'
  | 'milvus'
  | 'pgvector'
  | 'memory'
  | 'custom';

/**
 * Base store configuration
 */
export interface StoreConfig {
  /** Store type */
  type: VectorStoreType;
  /** Namespace/collection */
  namespace?: string;
  /** Embedding dimensions */
  dimensions?: number;
  /** Distance metric */
  metric?: DistanceMetric;
}

/**
 * Distance metric
 */
export type DistanceMetric =
  | 'cosine'
  | 'euclidean'
  | 'dot_product'
  | 'manhattan';

/**
 * Vector record to store
 */
export interface VectorRecord {
  /** Unique ID */
  id: string;
  /** Embedding vector */
  vector: EmbeddingVector;
  /** Original text */
  text?: string;
  /** Metadata */
  metadata?: ChunkMetadata;
}

/**
 * Stored vector info
 */
export interface StoredVector {
  /** Vector ID */
  id: string;
  /** Namespace */
  namespace?: string;
  /** Dimensions */
  dimensions: number;
  /** Has text stored */
  hasText: boolean;
  /** Metadata keys */
  metadataKeys: string[];
  /** Created at */
  createdAt?: number;
  /** Updated at */
  updatedAt?: number;
}

/**
 * Pinecone store configuration
 */
export interface PineconeStoreConfig extends StoreConfig {
  type: 'pinecone';
  /** API key */
  apiKey: string;
  /** Environment */
  environment?: string;
  /** Index name */
  indexName: string;
  /** Pod type */
  podType?: string;
  /** Replicas */
  replicas?: number;
  /** Metric */
  metric?: DistanceMetric;
}

/**
 * Weaviate store configuration
 */
export interface WeaviateStoreConfig extends StoreConfig {
  type: 'weaviate';
  /** Weaviate URL */
  url: string;
  /** API key */
  apiKey?: string;
  /** Class name */
  className: string;
  /** Schema */
  schema?: WeaviateSchema;
}

/**
 * Weaviate schema
 */
export interface WeaviateSchema {
  /** Class name */
  class: string;
  /** Description */
  description?: string;
  /** Properties */
  properties: WeaviateProperty[];
  /** Vectorizer */
  vectorizer?: string;
  /** Module config */
  moduleConfig?: Record<string, unknown>;
}

/**
 * Weaviate property
 */
export interface WeaviateProperty {
  /** Property name */
  name: string;
  /** Data type */
  dataType: string[];
  /** Description */
  description?: string;
  /** Index filterable */
  indexFilterable?: boolean;
  /** Index searchable */
  indexSearchable?: boolean;
}

/**
 * Chroma store configuration
 */
export interface ChromaStoreConfig extends StoreConfig {
  type: 'chroma';
  /** Chroma URL */
  url?: string;
  /** Collection name */
  collectionName: string;
  /** Authentication */
  auth?: {
    token?: string;
    credentials?: string;
  };
  /** Tenant */
  tenant?: string;
  /** Database */
  database?: string;
}

/**
 * Qdrant store configuration
 */
export interface QdrantStoreConfig extends StoreConfig {
  type: 'qdrant';
  /** Qdrant URL */
  url: string;
  /** API key */
  apiKey?: string;
  /** Collection name */
  collectionName: string;
  /** Vector config */
  vectorConfig?: QdrantVectorConfig;
}

/**
 * Qdrant vector configuration
 */
export interface QdrantVectorConfig {
  /** Vector size */
  size: number;
  /** Distance metric */
  distance: 'Cosine' | 'Euclid' | 'Dot';
  /** HNSW config */
  hnswConfig?: {
    m?: number;
    efConstruct?: number;
    fullScanThreshold?: number;
  };
}

/**
 * Milvus store configuration
 */
export interface MilvusStoreConfig extends StoreConfig {
  type: 'milvus';
  /** Milvus URL */
  url: string;
  /** Username */
  username?: string;
  /** Password */
  password?: string;
  /** Collection name */
  collectionName: string;
  /** Index type */
  indexType?: 'IVF_FLAT' | 'IVF_SQ8' | 'IVF_PQ' | 'HNSW' | 'ANNOY';
  /** Index params */
  indexParams?: Record<string, unknown>;
}

/**
 * PgVector store configuration
 */
export interface PgVectorStoreConfig extends StoreConfig {
  type: 'pgvector';
  /** Connection string */
  connectionString?: string;
  /** Host */
  host?: string;
  /** Port */
  port?: number;
  /** Database */
  database?: string;
  /** User */
  user?: string;
  /** Password */
  password?: string;
  /** Table name */
  tableName: string;
  /** Vector column name */
  vectorColumn?: string;
  /** Content column name */
  contentColumn?: string;
  /** Metadata column name */
  metadataColumn?: string;
  /** Index type */
  indexType?: 'ivfflat' | 'hnsw';
  /** Index params */
  indexParams?: {
    lists?: number;
    m?: number;
    efConstruction?: number;
  };
}

/**
 * Memory store configuration
 */
export interface MemoryStoreConfig extends StoreConfig {
  type: 'memory';
  /** Max vectors */
  maxVectors?: number;
  /** Persist to file */
  persistPath?: string;
  /** Auto-persist interval (ms) */
  persistInterval?: number;
}

/**
 * Upsert options
 */
export interface UpsertOptions {
  /** Namespace override */
  namespace?: string;
  /** Batch size */
  batchSize?: number;
  /** Progress callback */
  onProgress?: (progress: { completed: number; total: number }) => void;
}

/**
 * Upsert result
 */
export interface UpsertResult {
  /** IDs upserted */
  upsertedIds: string[];
  /** Count */
  upsertedCount: number;
  /** Errors */
  errors: Array<{ id: string; error: string }>;
  /** Duration (ms) */
  durationMs: number;
}

/**
 * Delete options
 */
export interface DeleteOptions {
  /** Namespace */
  namespace?: string;
  /** Delete all */
  deleteAll?: boolean;
  /** Filter */
  filter?: Record<string, unknown>;
}

/**
 * Delete result
 */
export interface DeleteResult {
  /**
   * Number of vectors deleted. When `countExact` is false this is a best-effort
   * estimate (e.g. the number of ids requested) because the backend does not
   * report how many vectors actually existed and were removed.
   */
  deletedCount: number;
  /**
   * Whether `deletedCount` is an exact, backend-confirmed figure. False for
   * backends whose delete APIs do not return a count.
   */
  countExact: boolean;
  /** Number of deletions requested (ids passed, or all for deleteAll). */
  requestedCount?: number;
  /** Duration (ms) */
  durationMs: number;
}

/**
 * Store query options (extends SearchOptions)
 */
export interface StoreQueryOptions extends SearchOptions {
  /** Include vectors in results */
  includeVectors?: boolean;
  /** Include text in results */
  includeText?: boolean;
  /** Score threshold */
  scoreThreshold?: number;
}

/**
 * Store query result
 */
export interface StoreQueryResult {
  /** Matches */
  matches: SearchResult[];
  /** Namespace */
  namespace?: string;
  /** Query duration (ms) */
  durationMs: number;
}

/**
 * Store statistics
 */
export interface StoreStats {
  /** Store type */
  type: VectorStoreType;
  /** Vector count */
  vectorCount: number;
  /** Namespace count */
  namespaceCount: number;
  /** Index size (bytes) */
  indexSizeBytes?: number;
  /** Dimensions */
  dimensions: number;
  /** Metric */
  metric: DistanceMetric;
  /** Last updated */
  lastUpdated?: number;
}

/**
 * Store health
 */
export interface StoreHealth {
  /** Is healthy */
  healthy: boolean;
  /** Latency (ms) */
  latencyMs: number;
  /** Error message */
  error?: string;
  /** Last check */
  lastCheck: number;
}

/**
 * Index info
 */
export interface IndexInfo {
  /** Index name */
  name: string;
  /** Dimensions */
  dimensions: number;
  /** Metric */
  metric: DistanceMetric;
  /** Vector count */
  vectorCount: number;
  /** Index type */
  indexType?: string;
  /** Created at */
  createdAt?: number;
  /** Status */
  status: 'ready' | 'initializing' | 'scaling' | 'error';
}

/**
 * Collection/namespace info
 */
export interface CollectionInfo {
  /** Collection name */
  name: string;
  /** Vector count */
  vectorCount: number;
  /** Dimensions */
  dimensions: number;
  /** Metric */
  metric: DistanceMetric;
  /** Created at */
  createdAt?: number;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Custom store interface
 */
export interface CustomStoreConfig extends StoreConfig {
  type: 'custom';
  /** Upsert function */
  upsertFn: (
    records: VectorRecord[],
    options?: UpsertOptions,
  ) => Promise<UpsertResult>;
  /** Query function */
  queryFn: (
    vector: EmbeddingVector,
    options?: StoreQueryOptions,
  ) => Promise<StoreQueryResult>;
  /** Delete function */
  deleteFn: (ids: string[], options?: DeleteOptions) => Promise<DeleteResult>;
  /** Stats function */
  statsFn?: () => Promise<StoreStats>;
}
