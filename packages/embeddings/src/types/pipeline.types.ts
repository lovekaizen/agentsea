/**
 * Pipeline Types
 *
 * Types for embedding pipelines (batch, stream, retry).
 */

import type { EmbeddingResult, EmbeddingOptions } from './embedding.types.js';
import type {
  Chunk,
  ChunkingOptions,
  ChunkingStrategyType,
} from './chunking.types.js';

/**
 * Pipeline type
 */
export type PipelineType = 'batch' | 'stream' | 'document' | 'custom';

/**
 * Pipeline status
 */
export type PipelineStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Pipeline configuration
 */
export interface PipelineConfig {
  /** Pipeline name */
  name: string;
  /** Pipeline type */
  type: PipelineType;
  /** Batch size */
  batchSize?: number;
  /** Concurrency */
  concurrency?: number;
  /** Retry configuration */
  retry?: RetryConfig;
  /** Chunking configuration */
  chunking?: ChunkingPipelineConfig;
  /** Caching enabled */
  caching?: boolean;
  /** Quality checks enabled */
  qualityChecks?: boolean;
  /** Progress reporting interval (ms) */
  progressInterval?: number;
  /** Pipeline metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Chunking pipeline configuration
 */
export interface ChunkingPipelineConfig {
  /** Chunking strategy */
  strategy: ChunkingStrategyType;
  /** Chunking options */
  options: ChunkingOptions;
  /** Pre-process function */
  preProcess?: (text: string) => string;
  /** Post-process function */
  postProcess?: (chunks: Chunk[]) => Chunk[];
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Max retries */
  maxRetries?: number;
  /** Initial delay (ms) */
  initialDelay?: number;
  /** Max delay (ms) */
  maxDelay?: number;
  /** Backoff multiplier */
  backoffMultiplier?: number;
  /** Jitter */
  jitter?: boolean;
  /** Retry on codes */
  retryOnCodes?: number[];
  /** Retry condition */
  retryCondition?: (error: Error) => boolean;
}

/**
 * Pipeline input
 */
export interface PipelineInput {
  /** Input ID */
  id?: string;
  /** Text content */
  text: string;
  /** Input metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Pipeline output
 */
export interface PipelineOutput {
  /** Output ID */
  id: string;
  /** Input ID */
  inputId: string;
  /** Embedding result */
  result: EmbeddingResult;
  /** Chunks (if chunking enabled) */
  chunks?: Chunk[];
  /** Processing time (ms) */
  processingTimeMs: number;
  /** Output metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Batch pipeline options
 */
export interface BatchPipelineOptions extends EmbeddingOptions {
  /** Batch size */
  batchSize?: number;
  /** Concurrency */
  concurrency?: number;
  /** Continue on error */
  continueOnError?: boolean;
  /** Progress callback */
  onProgress?: (progress: PipelineProgress) => void;
  /** Item callback */
  onItem?: (output: PipelineOutput) => void;
  /** Error callback */
  onError?: (error: PipelineError) => void;
}

/**
 * Stream pipeline options
 */
export interface StreamPipelineOptions extends EmbeddingOptions {
  /** Buffer size */
  bufferSize?: number;
  /** Flush interval (ms) */
  flushInterval?: number;
  /** High water mark */
  highWaterMark?: number;
  /** Backpressure strategy */
  backpressureStrategy?: 'pause' | 'drop' | 'buffer';
  /** Max buffer size */
  maxBufferSize?: number;
}

/**
 * Document pipeline options
 */
export interface DocumentPipelineOptions extends BatchPipelineOptions {
  /** Document ID */
  documentId?: string;
  /** Document source */
  source?: string;
  /** Document type */
  type?: string;
  /** Chunking strategy */
  chunkingStrategy?: ChunkingStrategyType;
  /** Chunking options */
  chunkingOptions?: ChunkingOptions;
  /** Store results */
  store?: boolean;
  /** Store namespace */
  storeNamespace?: string;
}

/**
 * Pipeline progress
 */
export interface PipelineProgress {
  /** Pipeline ID */
  pipelineId: string;
  /** Status */
  status: PipelineStatus;
  /** Total items */
  totalItems: number;
  /** Processed items */
  processedItems: number;
  /** Failed items */
  failedItems: number;
  /** Progress percentage (0-100) */
  progressPercent: number;
  /** Items per second */
  itemsPerSecond: number;
  /** Elapsed time (ms) */
  elapsedMs: number;
  /** Estimated remaining (ms) */
  estimatedRemainingMs: number;
  /** Current batch */
  currentBatch?: number;
  /** Total batches */
  totalBatches?: number;
}

/**
 * Pipeline error
 */
export interface PipelineError {
  /** Error ID */
  id: string;
  /** Input ID */
  inputId?: string;
  /** Error message */
  message: string;
  /** Error code */
  code?: string;
  /** Retry count */
  retryCount: number;
  /** Will retry */
  willRetry: boolean;
  /** Timestamp */
  timestamp: number;
  /** Stack trace */
  stack?: string;
}

/**
 * Pipeline result
 */
export interface PipelineResult {
  /** Pipeline ID */
  pipelineId: string;
  /** Status */
  status: PipelineStatus;
  /** Outputs */
  outputs: PipelineOutput[];
  /** Total processed */
  totalProcessed: number;
  /** Total failed */
  totalFailed: number;
  /** Total tokens */
  totalTokens: number;
  /** Duration (ms) */
  durationMs: number;
  /** Errors */
  errors: PipelineError[];
  /** Metrics */
  metrics: PipelineMetrics;
}

/**
 * Pipeline metrics
 */
export interface PipelineMetrics {
  /** Total items */
  totalItems: number;
  /** Successful items */
  successfulItems: number;
  /** Failed items */
  failedItems: number;
  /** Retried items */
  retriedItems: number;
  /** Total tokens */
  totalTokens: number;
  /** Cache hits */
  cacheHits: number;
  /** Cache misses */
  cacheMisses: number;
  /** Average latency (ms) */
  avgLatencyMs: number;
  /** P50 latency (ms) */
  p50LatencyMs: number;
  /** P95 latency (ms) */
  p95LatencyMs: number;
  /** P99 latency (ms) */
  p99LatencyMs: number;
  /** Throughput (items/sec) */
  throughput: number;
  /** Estimated cost (USD) */
  estimatedCostUSD: number;
}

/**
 * Pipeline event
 */
export interface PipelineEvent {
  /** Event type */
  type: PipelineEventType;
  /** Pipeline ID */
  pipelineId: string;
  /** Timestamp */
  timestamp: number;
  /** Event data */
  data?: Record<string, unknown>;
}

/**
 * Pipeline event type
 */
export type PipelineEventType =
  | 'started'
  | 'progress'
  | 'batch_completed'
  | 'item_completed'
  | 'item_failed'
  | 'paused'
  | 'resumed'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Pipeline checkpoint
 */
export interface PipelineCheckpoint {
  /** Checkpoint ID */
  id: string;
  /** Pipeline ID */
  pipelineId: string;
  /** Processed item IDs */
  processedIds: string[];
  /** Failed item IDs */
  failedIds: string[];
  /** Last processed index */
  lastProcessedIndex: number;
  /** Progress */
  progress: PipelineProgress;
  /** Created at */
  createdAt: number;
  /** Checkpoint data */
  data?: Record<string, unknown>;
}

/**
 * Stream item
 */
export interface StreamItem<T = unknown> {
  /** Item ID */
  id: string;
  /** Item data */
  data: T;
  /** Timestamp */
  timestamp: number;
  /** Item metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Stream result
 */
export interface StreamResult {
  /** Stream ID */
  streamId: string;
  /** Items processed */
  itemsProcessed: number;
  /** Items failed */
  itemsFailed: number;
  /** Duration (ms) */
  durationMs: number;
  /** Throughput (items/sec) */
  throughput: number;
}

/**
 * Pipeline builder options
 */
export interface PipelineBuilderOptions {
  /** Default batch size */
  defaultBatchSize?: number;
  /** Default concurrency */
  defaultConcurrency?: number;
  /** Default retry config */
  defaultRetry?: RetryConfig;
  /** Enable checkpointing */
  checkpointing?: boolean;
  /** Checkpoint interval */
  checkpointInterval?: number;
}
