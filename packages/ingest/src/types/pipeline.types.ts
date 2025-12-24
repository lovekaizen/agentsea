/**
 * Pipeline Types
 *
 * Type definitions for document processing pipelines.
 */

import type {
  ProcessedDocument,
  DocumentInput,
  DocumentMetadata,
} from './document.types.js';
import type { ParserOptions } from './parser.types.js';
import type { ChunkingOptions, ChunkingStrategy } from './chunking.types.js';
import type { CleaningConfig } from './cleaning.types.js';
import type { EnrichmentConfig } from './enrichment.types.js';
import type { OCRConfig } from './ocr.types.js';
import type { StorageConfig } from './storage.types.js';
import type {
  TableExtractionOptions,
  ImageExtractionOptions,
  MetadataExtractionOptions,
} from './extraction.types.js';

/**
 * Pipeline stage types
 */
export type PipelineStage =
  | 'load'
  | 'parse'
  | 'extract'
  | 'clean'
  | 'chunk'
  | 'enrich'
  | 'embed'
  | 'store'
  | 'custom';

/**
 * Pipeline configuration
 */
export interface PipelineConfig {
  /** Pipeline name */
  name?: string;
  /** Stages to execute */
  stages?: PipelineStage[];
  /** Parser options */
  parser?: ParserOptions;
  /** Extraction options */
  extraction?: ExtractionConfig;
  /** Cleaning options */
  cleaning?: CleaningConfig;
  /** Chunking options */
  chunking?: ChunkingConfig;
  /** Enrichment options */
  enrichment?: EnrichmentConfig;
  /** Embedding options */
  embedding?: EmbeddingPipelineConfig;
  /** Storage options */
  storage?: StorageConfig;
  /** OCR options */
  ocr?: OCRConfig;
  /** Error handling */
  errorHandling?: ErrorHandlingConfig;
  /** Callbacks */
  callbacks?: PipelineCallbacks;
  /** Custom stage handlers */
  customStages?: Record<string, CustomStageHandler>;
}

/**
 * Extraction configuration (combined)
 */
export interface ExtractionConfig {
  /** Table extraction options */
  tables?: TableExtractionOptions;
  /** Image extraction options */
  images?: ImageExtractionOptions;
  /** Metadata extraction options */
  metadata?: MetadataExtractionOptions;
}

/**
 * Chunking configuration for pipeline
 */
export interface ChunkingConfig extends ChunkingOptions {
  /** Chunking strategy */
  strategy: ChunkingStrategy;
}

/**
 * Embedding configuration for pipeline
 */
export interface EmbeddingPipelineConfig {
  /** Embedding model */
  model: string;
  /** Embedding provider */
  provider?: string;
  /** Batch size */
  batchSize?: number;
  /** Embed chunks */
  embedChunks?: boolean;
  /** Embed document summary */
  embedSummary?: boolean;
}

/**
 * Error handling configuration
 */
export interface ErrorHandlingConfig {
  /** Continue on error */
  continueOnError?: boolean;
  /** Maximum retries */
  maxRetries?: number;
  /** Retry delay (ms) */
  retryDelay?: number;
  /** Error callback */
  onError?: (error: PipelineError) => void;
  /** Skip failing documents */
  skipFailing?: boolean;
}

/**
 * Pipeline callbacks
 */
export interface PipelineCallbacks {
  /** Called when stage starts */
  onStageStart?: (stage: PipelineStage, documentId: string) => void;
  /** Called when stage completes */
  onStageComplete?: (
    stage: PipelineStage,
    documentId: string,
    result: unknown,
  ) => void;
  /** Called when stage fails */
  onStageError?: (
    stage: PipelineStage,
    documentId: string,
    error: Error,
  ) => void;
  /** Called when document processing starts */
  onDocumentStart?: (documentId: string, input: DocumentInput) => void;
  /** Called when document processing completes */
  onDocumentComplete?: (document: ProcessedDocument) => void;
  /** Called for progress updates */
  onProgress?: (progress: PipelineProgress) => void;
}

/**
 * Custom stage handler
 */
export type CustomStageHandler = (
  document: ProcessedDocument,
  context: PipelineContext,
) => Promise<ProcessedDocument>;

/**
 * Pipeline context
 */
export interface PipelineContext {
  /** Pipeline configuration */
  config: PipelineConfig;
  /** Current stage */
  currentStage: PipelineStage;
  /** Stage results */
  stageResults: Map<PipelineStage, unknown>;
  /** Shared data between stages */
  sharedData: Map<string, unknown>;
  /** Abort signal */
  abortSignal?: AbortSignal;
  /** Logger */
  logger?: PipelineLogger;
}

/**
 * Pipeline logger interface
 */
export interface PipelineLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Pipeline progress
 */
export interface PipelineProgress {
  /** Current document index */
  documentIndex: number;
  /** Total documents */
  totalDocuments: number;
  /** Current stage */
  currentStage: PipelineStage;
  /** Stage progress (0-1) */
  stageProgress: number;
  /** Overall progress (0-1) */
  overallProgress: number;
  /** Elapsed time (ms) */
  elapsedTime: number;
  /** Estimated remaining time (ms) */
  estimatedRemaining?: number;
}

/**
 * Pipeline error
 */
export interface PipelineError {
  /** Error stage */
  stage: PipelineStage;
  /** Document ID */
  documentId?: string;
  /** Error message */
  message: string;
  /** Original error */
  cause?: Error;
  /** Recoverable */
  recoverable: boolean;
  /** Retry count */
  retryCount?: number;
}

/**
 * Pipeline result
 */
export interface PipelineResult {
  /** Processed documents */
  documents: ProcessedDocument[];
  /** Successfully processed count */
  successCount: number;
  /** Failed document count */
  failedCount: number;
  /** Skipped document count */
  skippedCount: number;
  /** Total chunks created */
  totalChunks: number;
  /** Processing errors */
  errors: PipelineError[];
  /** Processing time (ms) */
  processingTime: number;
  /** Stage timings */
  stageTimings: Map<PipelineStage, number>;
}

/**
 * Pipeline interface
 */
export interface Pipeline {
  /** Pipeline name */
  readonly name: string;
  /** Pipeline configuration */
  readonly config: PipelineConfig;

  /** Process single document */
  process(input: DocumentInput): Promise<ProcessedDocument>;

  /** Process multiple documents */
  processBatch(inputs: DocumentInput[]): Promise<PipelineResult>;

  /** Process stream of documents */
  processStream(
    inputs: AsyncIterable<DocumentInput>,
  ): AsyncIterable<ProcessedDocument>;

  /** Add custom stage */
  addStage(
    name: string,
    handler: CustomStageHandler,
    after?: PipelineStage,
  ): void;

  /** Remove stage */
  removeStage(stage: string): void;

  /** Get stage handler */
  getStageHandler(stage: string): CustomStageHandler | undefined;

  /** Validate configuration */
  validate(): PipelineValidationResult;

  /** Abort processing */
  abort(): void;
}

/**
 * Pipeline validation result
 */
export interface PipelineValidationResult {
  /** Is valid */
  valid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
}

/**
 * Ingester configuration
 */
export interface IngesterConfig extends PipelineConfig {
  /** Concurrency limit */
  concurrency?: number;
  /** Default document type */
  defaultType?: string;
  /** File size limit (bytes) */
  fileSizeLimit?: number;
  /** Supported MIME types */
  supportedMimeTypes?: string[];
  /** Watch mode for directories */
  watchMode?: WatchModeConfig;
}

/**
 * Watch mode configuration
 */
export interface WatchModeConfig {
  /** Enable watch mode */
  enabled: boolean;
  /** Directories to watch */
  paths: string[];
  /** File patterns to include */
  include?: string[];
  /** File patterns to exclude */
  exclude?: string[];
  /** Debounce delay (ms) */
  debounceDelay?: number;
  /** Process existing files */
  processExisting?: boolean;
}

/**
 * Ingester interface
 */
export interface Ingester extends Pipeline {
  /** Ingest from file path */
  ingestFile(path: string): Promise<ProcessedDocument>;

  /** Ingest from URL */
  ingestUrl(url: string): Promise<ProcessedDocument>;

  /** Ingest from buffer */
  ingestBuffer(buffer: Buffer, filename?: string): Promise<ProcessedDocument>;

  /** Ingest from directory */
  ingestDirectory(
    path: string,
    options?: DirectoryIngestOptions,
  ): Promise<PipelineResult>;

  /** Start watch mode */
  startWatching(): void;

  /** Stop watch mode */
  stopWatching(): void;

  /** Get ingestion status */
  getStatus(): IngesterStatus;
}

/**
 * Directory ingest options
 */
export interface DirectoryIngestOptions {
  /** Recursive */
  recursive?: boolean;
  /** File patterns to include */
  include?: string[];
  /** File patterns to exclude */
  exclude?: string[];
  /** Maximum files */
  maxFiles?: number;
  /** Sort order */
  sortBy?: 'name' | 'date' | 'size';
}

/**
 * Ingester status
 */
export interface IngesterStatus {
  /** Is processing */
  isProcessing: boolean;
  /** Is watching */
  isWatching: boolean;
  /** Documents processed */
  documentsProcessed: number;
  /** Documents pending */
  documentsPending: number;
  /** Current document */
  currentDocument?: string;
  /** Errors count */
  errorsCount: number;
  /** Uptime (ms) */
  uptime: number;
}

/**
 * Batch processing options
 */
export interface BatchOptions {
  /** Batch size */
  batchSize?: number;
  /** Concurrency */
  concurrency?: number;
  /** Progress callback */
  onProgress?: (processed: number, total: number) => void;
  /** Continue on error */
  continueOnError?: boolean;
}

/**
 * Stream processing options
 */
export interface StreamOptions {
  /** High watermark for backpressure */
  highWaterMark?: number;
  /** Buffer size */
  bufferSize?: number;
  /** Timeout per document (ms) */
  timeout?: number;
}

/**
 * Pipeline builder interface
 */
export interface PipelineBuilder {
  /** Set parser options */
  withParser(options: ParserOptions): this;

  /** Set extraction options */
  withExtraction(options: ExtractionConfig): this;

  /** Set cleaning options */
  withCleaning(config: CleaningConfig): this;

  /** Set chunking options */
  withChunking(config: ChunkingConfig): this;

  /** Set enrichment options */
  withEnrichment(config: EnrichmentConfig): this;

  /** Set embedding options */
  withEmbedding(config: EmbeddingPipelineConfig): this;

  /** Set storage options */
  withStorage(config: StorageConfig): this;

  /** Set OCR options */
  withOCR(config: OCRConfig): this;

  /** Add custom stage */
  addCustomStage(
    name: string,
    handler: CustomStageHandler,
    after?: PipelineStage,
  ): this;

  /** Set error handling */
  withErrorHandling(config: ErrorHandlingConfig): this;

  /** Set callbacks */
  withCallbacks(callbacks: PipelineCallbacks): this;

  /** Build the pipeline */
  build(): Pipeline;
}

/**
 * Document event types
 */
export type DocumentEvent =
  | { type: 'document:loaded'; documentId: string; metadata: DocumentMetadata }
  | { type: 'document:parsed'; documentId: string; elementCount: number }
  | {
      type: 'document:extracted';
      documentId: string;
      tables: number;
      images: number;
    }
  | {
      type: 'document:cleaned';
      documentId: string;
      originalLength: number;
      cleanedLength: number;
    }
  | { type: 'document:chunked'; documentId: string; chunkCount: number }
  | { type: 'document:enriched'; documentId: string; enrichments: string[] }
  | { type: 'document:embedded'; documentId: string; embeddingCount: number }
  | { type: 'document:stored'; documentId: string; storageId: string }
  | { type: 'document:completed'; document: ProcessedDocument }
  | { type: 'document:error'; documentId: string; error: PipelineError };

/**
 * Pipeline event emitter interface
 */
export interface PipelineEventEmitter {
  /** Subscribe to events */
  on(
    event: DocumentEvent['type'],
    handler: (event: DocumentEvent) => void,
  ): void;

  /** Unsubscribe from events */
  off(
    event: DocumentEvent['type'],
    handler: (event: DocumentEvent) => void,
  ): void;

  /** Subscribe to event once */
  once(
    event: DocumentEvent['type'],
    handler: (event: DocumentEvent) => void,
  ): void;

  /** Emit event */
  emit(event: DocumentEvent): void;
}
