/**
 * Storage Types
 *
 * Type definitions for document and chunk storage adapters.
 */

import type { ProcessedDocument, Chunk } from './document.types.js';

/**
 * Storage adapter types
 */
export type StorageAdapterType =
  | 'memory'
  | 'file'
  | 'sqlite'
  | 'postgres'
  | 'mongodb'
  | 'redis'
  | 'pinecone'
  | 'weaviate'
  | 'qdrant'
  | 'chroma'
  | 'custom';

/**
 * Storage configuration
 */
export interface StorageConfig {
  /** Storage adapter type */
  adapter: StorageAdapterType;
  /** Connection string or path */
  connectionString?: string;
  /** Database/collection name */
  database?: string;
  /** Table/collection name for documents */
  documentsCollection?: string;
  /** Table/collection name for chunks */
  chunksCollection?: string;
  /** Adapter-specific options */
  options?: Record<string, unknown>;
}

/**
 * Document storage adapter interface
 */
export interface DocumentStorage {
  /** Storage adapter name */
  readonly name: string;
  /** Adapter type */
  readonly type: StorageAdapterType;

  /** Initialize storage */
  initialize(): Promise<void>;

  /** Store a document */
  store(document: ProcessedDocument): Promise<string>;

  /** Store multiple documents */
  storeBatch(documents: ProcessedDocument[]): Promise<string[]>;

  /** Get document by ID */
  get(id: string): Promise<ProcessedDocument | null>;

  /** Get multiple documents by IDs */
  getBatch(ids: string[]): Promise<(ProcessedDocument | null)[]>;

  /** Update document */
  update(id: string, updates: Partial<ProcessedDocument>): Promise<void>;

  /** Delete document */
  delete(id: string): Promise<void>;

  /** Delete multiple documents */
  deleteBatch(ids: string[]): Promise<void>;

  /** List documents with pagination */
  list(options?: ListOptions): Promise<ListResult<ProcessedDocument>>;

  /** Search documents by metadata */
  search(query: DocumentQuery): Promise<ProcessedDocument[]>;

  /** Count documents */
  count(query?: DocumentQuery): Promise<number>;

  /** Check if document exists */
  exists(id: string): Promise<boolean>;

  /** Close connection */
  close(): Promise<void>;
}

/**
 * Chunk storage adapter interface
 */
export interface ChunkStorage {
  /** Storage adapter name */
  readonly name: string;
  /** Adapter type */
  readonly type: StorageAdapterType;

  /** Initialize storage */
  initialize(): Promise<void>;

  /** Store a chunk */
  store(chunk: Chunk): Promise<string>;

  /** Store multiple chunks */
  storeBatch(chunks: Chunk[]): Promise<string[]>;

  /** Get chunk by ID */
  get(id: string): Promise<Chunk | null>;

  /** Get multiple chunks by IDs */
  getBatch(ids: string[]): Promise<(Chunk | null)[]>;

  /** Get chunks by document ID */
  getByDocumentId(documentId: string): Promise<Chunk[]>;

  /** Update chunk */
  update(id: string, updates: Partial<Chunk>): Promise<void>;

  /** Delete chunk */
  delete(id: string): Promise<void>;

  /** Delete chunks by document ID */
  deleteByDocumentId(documentId: string): Promise<void>;

  /** List chunks with pagination */
  list(options?: ListOptions): Promise<ListResult<Chunk>>;

  /** Count chunks */
  count(documentId?: string): Promise<number>;

  /** Close connection */
  close(): Promise<void>;
}

/**
 * Vector storage adapter interface
 */
export interface VectorStorage {
  /** Storage adapter name */
  readonly name: string;
  /** Adapter type */
  readonly type: StorageAdapterType;
  /** Vector dimensions */
  readonly dimensions: number;

  /** Initialize storage */
  initialize(): Promise<void>;

  /** Store chunk with embedding */
  store(chunk: Chunk): Promise<string>;

  /** Store multiple chunks with embeddings */
  storeBatch(chunks: Chunk[]): Promise<string[]>;

  /** Search by vector similarity */
  search(
    vector: number[],
    options?: VectorSearchOptions,
  ): Promise<VectorSearchResult[]>;

  /** Search by text (using internal embedding) */
  searchByText?(
    text: string,
    options?: VectorSearchOptions,
  ): Promise<VectorSearchResult[]>;

  /** Update chunk embedding */
  updateEmbedding(id: string, embedding: number[]): Promise<void>;

  /** Delete by ID */
  delete(id: string): Promise<void>;

  /** Delete by document ID */
  deleteByDocumentId(documentId: string): Promise<void>;

  /** Get index statistics */
  getStats(): Promise<VectorIndexStats>;

  /** Close connection */
  close(): Promise<void>;
}

/**
 * List options
 */
export interface ListOptions {
  /** Number of items to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Cursor for cursor-based pagination */
  cursor?: string;
  /** Sort field */
  sortBy?: string;
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
  /** Filter criteria */
  filter?: Record<string, unknown>;
}

/**
 * List result
 */
export interface ListResult<T> {
  /** Items */
  items: T[];
  /** Total count */
  total: number;
  /** Has more items */
  hasMore: boolean;
  /** Next cursor (for cursor-based pagination) */
  nextCursor?: string;
}

/**
 * Document query
 */
export interface DocumentQuery {
  /** Text search */
  text?: string;
  /** Document type filter */
  type?: string | string[];
  /** Metadata filters */
  metadata?: Record<string, unknown>;
  /** Date range */
  dateRange?: {
    field: 'createdAt' | 'modifiedAt' | 'processedAt';
    start?: Date;
    end?: Date;
  };
  /** Maximum results */
  limit?: number;
  /** Offset */
  offset?: number;
}

/**
 * Vector search options
 */
export interface VectorSearchOptions {
  /** Number of results */
  topK?: number;
  /** Minimum similarity score (0-1) */
  minScore?: number;
  /** Metadata filters */
  filter?: Record<string, unknown>;
  /** Include embeddings in results */
  includeEmbeddings?: boolean;
  /** Include metadata in results */
  includeMetadata?: boolean;
  /** Namespace/collection to search */
  namespace?: string;
}

/**
 * Vector search result
 */
export interface VectorSearchResult {
  /** Chunk ID */
  id: string;
  /** Similarity score (0-1) */
  score: number;
  /** Chunk data */
  chunk: Chunk;
  /** Distance metric value */
  distance?: number;
}

/**
 * Vector index statistics
 */
export interface VectorIndexStats {
  /** Total vectors stored */
  totalVectors: number;
  /** Index dimensions */
  dimensions: number;
  /** Index type/algorithm */
  indexType?: string;
  /** Memory usage (bytes) */
  memoryUsage?: number;
  /** Namespaces/collections */
  namespaces?: string[];
}

/**
 * Memory storage options
 */
export interface MemoryStorageOptions {
  /** Maximum items to store */
  maxItems?: number;
  /** TTL for items (ms) */
  ttl?: number;
}

/**
 * File storage options
 */
export interface FileStorageOptions {
  /** Base directory */
  baseDir: string;
  /** File format */
  format?: 'json' | 'msgpack';
  /** Create directories */
  createDirs?: boolean;
  /** Compression */
  compression?: 'gzip' | 'none';
}

/**
 * SQLite storage options
 */
export interface SQLiteStorageOptions {
  /** Database file path */
  path: string;
  /** Enable WAL mode */
  walMode?: boolean;
  /** Busy timeout (ms) */
  busyTimeout?: number;
}

/**
 * PostgreSQL storage options
 */
export interface PostgresStorageOptions {
  /** Connection string */
  connectionString: string;
  /** Schema name */
  schema?: string;
  /** Pool size */
  poolSize?: number;
  /** Enable SSL */
  ssl?: boolean;
  /** Enable pgvector extension */
  enablePgvector?: boolean;
}

/**
 * MongoDB storage options
 */
export interface MongoDBStorageOptions {
  /** Connection string */
  connectionString: string;
  /** Database name */
  database: string;
  /** Write concern */
  writeConcern?: 'majority' | number;
  /** Read preference */
  readPreference?: 'primary' | 'secondary' | 'nearest';
}

/**
 * Redis storage options
 */
export interface RedisStorageOptions {
  /** Redis URL */
  url: string;
  /** Key prefix */
  prefix?: string;
  /** TTL for entries (seconds) */
  ttl?: number;
  /** Enable cluster mode */
  cluster?: boolean;
}

/**
 * Pinecone storage options
 */
export interface PineconeStorageOptions {
  /** API key */
  apiKey: string;
  /** Environment */
  environment: string;
  /** Index name */
  indexName: string;
  /** Namespace */
  namespace?: string;
  /** Metric type */
  metric?: 'cosine' | 'euclidean' | 'dotproduct';
}

/**
 * Weaviate storage options
 */
export interface WeaviateStorageOptions {
  /** Weaviate URL */
  url: string;
  /** API key */
  apiKey?: string;
  /** Class name */
  className: string;
  /** Schema definition */
  schema?: Record<string, unknown>;
}

/**
 * Qdrant storage options
 */
export interface QdrantStorageOptions {
  /** Qdrant URL */
  url: string;
  /** API key */
  apiKey?: string;
  /** Collection name */
  collectionName: string;
  /** Vector dimensions */
  dimensions: number;
  /** Distance metric */
  distance?: 'Cosine' | 'Euclid' | 'Dot';
}

/**
 * Chroma storage options
 */
export interface ChromaStorageOptions {
  /** Chroma URL or path */
  path: string;
  /** Collection name */
  collectionName: string;
  /** Embedding function */
  embeddingFunction?: (texts: string[]) => Promise<number[][]>;
}

/**
 * Storage factory configuration
 */
export interface StorageFactoryConfig {
  /** Default adapter type */
  defaultAdapter: StorageAdapterType;
  /** Adapter configurations */
  adapters?: {
    memory?: MemoryStorageOptions;
    file?: FileStorageOptions;
    sqlite?: SQLiteStorageOptions;
    postgres?: PostgresStorageOptions;
    mongodb?: MongoDBStorageOptions;
    redis?: RedisStorageOptions;
    pinecone?: PineconeStorageOptions;
    weaviate?: WeaviateStorageOptions;
    qdrant?: QdrantStorageOptions;
    chroma?: ChromaStorageOptions;
  };
}
