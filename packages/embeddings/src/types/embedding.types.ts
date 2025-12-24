/**
 * Embedding Types
 *
 * Core types for embedding operations.
 */

/**
 * A single embedding vector
 */
export type EmbeddingVector = number[];

/**
 * Embedding result
 */
export interface EmbeddingResult {
  /** The embedding vector */
  vector: EmbeddingVector;
  /** Original text that was embedded */
  text: string;
  /** Number of tokens in the text */
  tokenCount: number;
  /** Whether this result came from cache */
  cached: boolean;
  /** Model used to generate the embedding */
  model: string;
  /** Embedding dimensions */
  dimensions: number;
  /** Time taken to generate (ms) */
  latencyMs: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Batch embedding result
 */
export interface BatchEmbeddingResult {
  /** Individual embedding results */
  results: EmbeddingResult[];
  /** Total tokens processed */
  totalTokens: number;
  /** Total time taken (ms) */
  totalLatencyMs: number;
  /** Number of cache hits */
  cacheHits: number;
  /** Number of cache misses */
  cacheMisses: number;
  /** Number of failed embeddings */
  failures: number;
}

/**
 * Document chunk with embedding
 */
export interface EmbeddedChunk {
  /** Unique chunk ID */
  id: string;
  /** Chunk text */
  text: string;
  /** Embedding vector */
  vector: EmbeddingVector;
  /** Chunk index in original document */
  index: number;
  /** Start position in original document */
  startPosition: number;
  /** End position in original document */
  endPosition: number;
  /** Token count */
  tokenCount: number;
  /** Chunk metadata */
  metadata: ChunkMetadata;
}

/**
 * Chunk metadata
 */
export interface ChunkMetadata {
  /** Source document ID */
  documentId?: string;
  /** Source document path */
  source?: string;
  /** Document type */
  type?: string;
  /** Page number (if applicable) */
  page?: number;
  /** Section/heading */
  section?: string;
  /** Custom metadata */
  [key: string]: unknown;
}

/**
 * Embedding model info
 */
export interface EmbeddingModelInfo {
  /** Model name */
  name: string;
  /** Provider name */
  provider: string;
  /** Embedding dimensions */
  dimensions: number;
  /** Maximum tokens per request */
  maxTokens: number;
  /** Maximum batch size */
  maxBatchSize: number;
  /** Cost per 1K tokens (USD) */
  costPer1K?: number;
  /** Model description */
  description?: string;
}

/**
 * Embedding options
 */
export interface EmbeddingOptions {
  /** Custom metadata to include */
  metadata?: Record<string, unknown>;
  /** User identifier for tracking */
  user?: string;
  /** Override model */
  model?: string;
  /** Skip cache lookup */
  skipCache?: boolean;
  /** Force cache even on failure */
  forceCache?: boolean;
  /** Timeout in ms */
  timeout?: number;
}

/**
 * Batch embedding options
 */
export interface BatchEmbeddingOptions extends EmbeddingOptions {
  /** Maximum concurrent requests */
  concurrency?: number;
  /** Progress callback */
  onProgress?: (progress: BatchProgress) => void;
  /** Continue on individual failures */
  continueOnError?: boolean;
  /** Retry failed items */
  retryFailed?: boolean;
  /** Maximum retries per item */
  maxRetries?: number;
}

/**
 * Batch progress info
 */
export interface BatchProgress {
  /** Percentage complete (0-100) */
  percent: number;
  /** Items processed */
  processed: number;
  /** Total items */
  total: number;
  /** Current item being processed */
  current?: string;
  /** Elapsed time (ms) */
  elapsedMs: number;
  /** Estimated remaining time (ms) */
  estimatedRemainingMs?: number;
}

/**
 * Document embedding options
 */
export interface DocumentEmbeddingOptions extends BatchEmbeddingOptions {
  /** Document ID */
  documentId?: string;
  /** Document source */
  source?: string;
  /** Document type */
  type?: string;
  /** Additional metadata for all chunks */
  chunkMetadata?: Record<string, unknown>;
}

/**
 * Search result
 */
export interface SearchResult {
  /** Chunk ID */
  id: string;
  /** Chunk text */
  text: string;
  /** Similarity score (0-1) */
  score: number;
  /** Chunk metadata */
  metadata: ChunkMetadata;
  /** Distance (if using distance metric) */
  distance?: number;
}

/**
 * Search options
 */
export interface SearchOptions {
  /** Number of results to return */
  topK?: number;
  /** Minimum score threshold */
  minScore?: number;
  /** Metadata filter */
  filter?: Record<string, unknown>;
  /** Include vectors in results */
  includeVectors?: boolean;
  /** Include metadata in results */
  includeMetadata?: boolean;
  /** Namespace to search */
  namespace?: string;
}

/**
 * Similarity metric
 */
export type SimilarityMetric = 'cosine' | 'euclidean' | 'dot_product';

/**
 * Embedding statistics
 */
export interface EmbeddingStats {
  /** Total embeddings generated */
  totalEmbeddings: number;
  /** Total tokens processed */
  totalTokens: number;
  /** Average latency (ms) */
  avgLatencyMs: number;
  /** Cache hit rate (0-1) */
  cacheHitRate: number;
  /** Total API calls */
  apiCalls: number;
  /** Total errors */
  errors: number;
  /** Estimated cost (USD) */
  estimatedCostUSD: number;
}
