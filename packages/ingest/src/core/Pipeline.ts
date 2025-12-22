/**
 * Pipeline
 *
 * Document processing pipeline implementation.
 */

import { nanoid } from 'nanoid';
import type {
  Pipeline as IPipeline,
  PipelineConfig,
  PipelineStage,
  PipelineResult,
  PipelineValidationResult,
  PipelineContext,
  PipelineError,
  CustomStageHandler,
  ProcessedDocument,
  DocumentInput,
  DocumentMetadata,
  Chunk,
  ProcessingError,
} from '../types/index.js';
import { IngestEventEmitter } from './EventEmitter.js';
import { ParserRegistry } from './ParserRegistry.js';
import { ChunkerRegistry } from './ChunkerRegistry.js';

/**
 * Default pipeline stages in order
 */
const DEFAULT_STAGES: PipelineStage[] = [
  'load',
  'parse',
  'extract',
  'clean',
  'chunk',
  'enrich',
  'embed',
  'store',
];

/**
 * Document processing pipeline
 */
export class Pipeline implements IPipeline {
  readonly name: string;
  readonly config: PipelineConfig;

  private parserRegistry: ParserRegistry;
  private chunkerRegistry: ChunkerRegistry;
  private eventEmitter: IngestEventEmitter;
  private customStages: Map<string, CustomStageHandler> = new Map();
  private stageOrder: string[] = [];
  private aborted = false;

  constructor(config: PipelineConfig = {}) {
    this.name = config.name ?? 'default-pipeline';
    this.config = config;
    this.parserRegistry = new ParserRegistry();
    this.chunkerRegistry = new ChunkerRegistry();
    this.eventEmitter = new IngestEventEmitter();

    // Set up stage order
    this.stageOrder = config.stages ?? [...DEFAULT_STAGES];

    // Register custom stages
    if (config.customStages) {
      for (const [name, handler] of Object.entries(config.customStages)) {
        this.customStages.set(name, handler);
      }
    }
  }

  /**
   * Process a single document
   */
  async process(input: DocumentInput): Promise<ProcessedDocument> {
    const documentId = nanoid();
    const errors: ProcessingError[] = [];

    // Create initial document
    let document: ProcessedDocument = {
      id: documentId,
      type: 'unknown',
      text: '',
      metadata: {},
      elements: [],
      chunks: [],
      tables: [],
      images: [],
      processedAt: new Date(),
    };

    // Create pipeline context
    const context: PipelineContext = {
      config: this.config,
      currentStage: 'load',
      stageResults: new Map(),
      sharedData: new Map(),
      abortSignal: undefined,
    };

    // Notify document start
    this.config.callbacks?.onDocumentStart?.(documentId, input);

    try {
      // Execute each stage
      for (const stage of this.stageOrder) {
        if (this.aborted) {
          throw new Error('Pipeline aborted');
        }

        context.currentStage = stage as PipelineStage;
        this.config.callbacks?.onStageStart?.(
          stage as PipelineStage,
          documentId,
        );

        try {
          document = await this.executeStage(stage, document, input, context);
          context.stageResults.set(stage as PipelineStage, document);
          this.config.callbacks?.onStageComplete?.(
            stage as PipelineStage,
            documentId,
            document,
          );
        } catch (error) {
          const pipelineError = this.createPipelineError(
            stage as PipelineStage,
            documentId,
            error,
          );
          errors.push({
            stage,
            message: pipelineError.message,
            details: pipelineError.cause,
          });

          this.config.callbacks?.onStageError?.(
            stage as PipelineStage,
            documentId,
            error as Error,
          );

          if (!this.config.errorHandling?.continueOnError) {
            throw error;
          }
        }
      }

      document.errors = errors.length > 0 ? errors : undefined;
      document.processedAt = new Date();

      // Notify document complete
      this.config.callbacks?.onDocumentComplete?.(document);
      this.eventEmitter.emit({ type: 'document:completed', document });

      return document;
    } catch (error) {
      const pipelineError = this.createPipelineError(
        context.currentStage,
        documentId,
        error,
      );
      this.eventEmitter.emit({
        type: 'document:error',
        documentId,
        error: pipelineError,
      });
      throw error;
    }
  }

  /**
   * Process multiple documents
   */
  async processBatch(inputs: DocumentInput[]): Promise<PipelineResult> {
    const startTime = Date.now();
    const documents: ProcessedDocument[] = [];
    const errors: PipelineError[] = [];
    const stageTimings = new Map<PipelineStage, number>();
    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    let totalChunks = 0;

    for (let i = 0; i < inputs.length; i++) {
      if (this.aborted) {
        skippedCount = inputs.length - i;
        break;
      }

      const input = inputs[i];

      try {
        const document = await this.process(input);
        documents.push(document);
        totalChunks += document.chunks.length;
        successCount++;
      } catch (error) {
        failedCount++;
        const pipelineError = this.createPipelineError(
          'parse',
          undefined,
          error,
        );
        errors.push(pipelineError);

        if (!this.config.errorHandling?.skipFailing) {
          throw error;
        }
      }

      // Report progress
      this.config.callbacks?.onProgress?.({
        documentIndex: i + 1,
        totalDocuments: inputs.length,
        currentStage: 'parse',
        stageProgress: 1,
        overallProgress: (i + 1) / inputs.length,
        elapsedTime: Date.now() - startTime,
      });
    }

    return {
      documents,
      successCount,
      failedCount,
      skippedCount,
      totalChunks,
      errors,
      processingTime: Date.now() - startTime,
      stageTimings,
    };
  }

  /**
   * Process stream of documents
   */
  async *processStream(
    inputs: AsyncIterable<DocumentInput>,
  ): AsyncIterable<ProcessedDocument> {
    for await (const input of inputs) {
      if (this.aborted) {
        break;
      }

      try {
        const document = await this.process(input);
        yield document;
      } catch (error) {
        if (!this.config.errorHandling?.skipFailing) {
          throw error;
        }
      }
    }
  }

  /**
   * Add custom stage
   */
  addStage(
    name: string,
    handler: CustomStageHandler,
    after?: PipelineStage,
  ): void {
    this.customStages.set(name, handler);

    if (after) {
      const index = this.stageOrder.indexOf(after);
      if (index !== -1) {
        this.stageOrder.splice(index + 1, 0, name);
      } else {
        this.stageOrder.push(name);
      }
    } else {
      this.stageOrder.push(name);
    }
  }

  /**
   * Remove stage
   */
  removeStage(stage: string): void {
    const index = this.stageOrder.indexOf(stage);
    if (index !== -1) {
      this.stageOrder.splice(index, 1);
    }
    this.customStages.delete(stage);
  }

  /**
   * Get stage handler
   */
  getStageHandler(stage: string): CustomStageHandler | undefined {
    return this.customStages.get(stage);
  }

  /**
   * Validate configuration
   */
  validate(): PipelineValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check chunking configuration
    if (this.config.chunking) {
      if (!this.config.chunking.strategy) {
        errors.push(
          'Chunking strategy is required when chunking is configured',
        );
      }
      if (
        this.config.chunking.maxTokens &&
        this.config.chunking.overlap &&
        this.config.chunking.overlap >= this.config.chunking.maxTokens
      ) {
        errors.push('Chunk overlap must be less than maxTokens');
      }
    }

    // Check storage configuration
    if (this.stageOrder.includes('store') && !this.config.storage) {
      warnings.push(
        'Store stage is enabled but no storage configuration provided',
      );
    }

    // Check embedding configuration
    if (this.stageOrder.includes('embed') && !this.config.embedding) {
      warnings.push(
        'Embed stage is enabled but no embedding configuration provided',
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Abort processing
   */
  abort(): void {
    this.aborted = true;
  }

  /**
   * Get event emitter
   */
  getEventEmitter(): IngestEventEmitter {
    return this.eventEmitter;
  }

  /**
   * Get parser registry
   */
  getParserRegistry(): ParserRegistry {
    return this.parserRegistry;
  }

  /**
   * Get chunker registry
   */
  getChunkerRegistry(): ChunkerRegistry {
    return this.chunkerRegistry;
  }

  /**
   * Execute a pipeline stage
   */
  private async executeStage(
    stage: string,
    document: ProcessedDocument,
    input: DocumentInput,
    context: PipelineContext,
  ): Promise<ProcessedDocument> {
    // Check for custom stage handler
    const customHandler = this.customStages.get(stage);
    if (customHandler) {
      return customHandler(document, context);
    }

    // Execute built-in stages
    switch (stage) {
      case 'load':
        return this.executeLoad(document, input);
      case 'parse':
        return this.executeParse(document, input);
      case 'extract':
        return this.executeExtract(document);
      case 'clean':
        return this.executeClean(document);
      case 'chunk':
        return this.executeChunk(document);
      case 'enrich':
        return this.executeEnrich(document);
      case 'embed':
        return this.executeEmbed(document);
      case 'store':
        return this.executeStore(document);
      default:
        // Unknown stage - return document unchanged
        return document;
    }
  }

  /**
   * Load stage - load document content
   */
  private async executeLoad(
    document: ProcessedDocument,
    input: DocumentInput,
  ): Promise<ProcessedDocument> {
    const metadata: DocumentMetadata = {
      filename: input.filename,
      mimeType: input.mimeType,
    };

    // Load from path
    if (input.path) {
      const fs = await import('node:fs/promises');
      const stats = await fs.stat(input.path);
      metadata.fileSize = stats.size;
      metadata.filename = input.filename ?? input.path.split('/').pop();

      this.eventEmitter.emit({
        type: 'document:loaded',
        documentId: document.id,
        metadata,
      });

      return {
        ...document,
        metadata,
      };
    }

    // Load from URL
    if (input.url) {
      const response = await fetch(input.url);
      const buffer = Buffer.from(await response.arrayBuffer());
      metadata.sourceUrl = input.url;
      metadata.fileSize = buffer.length;
      metadata.mimeType =
        response.headers.get('content-type') ?? input.mimeType;

      this.eventEmitter.emit({
        type: 'document:loaded',
        documentId: document.id,
        metadata,
      });

      return {
        ...document,
        metadata,
      };
    }

    // Use provided buffer
    if (input.buffer) {
      metadata.fileSize = input.buffer.length;

      this.eventEmitter.emit({
        type: 'document:loaded',
        documentId: document.id,
        metadata,
      });

      return {
        ...document,
        metadata,
      };
    }

    throw new Error('No input source provided (path, url, or buffer)');
  }

  /**
   * Parse stage - parse document content
   */
  private async executeParse(
    document: ProcessedDocument,
    input: DocumentInput,
  ): Promise<ProcessedDocument> {
    // Get buffer
    let buffer: Buffer;
    if (input.buffer) {
      buffer = input.buffer;
    } else if (input.path) {
      const fs = await import('node:fs/promises');
      buffer = await fs.readFile(input.path);
    } else if (input.url) {
      const response = await fetch(input.url);
      buffer = Buffer.from(await response.arrayBuffer());
    } else {
      throw new Error('No input source for parsing');
    }

    // Detect extension
    const extension = input.filename
      ? ParserRegistry.getExtension(input.filename)
      : undefined;

    // Parse document
    const result = await this.parserRegistry.parse(
      buffer,
      input.mimeType,
      extension,
      this.config.parser,
    );

    this.eventEmitter.emit({
      type: 'document:parsed',
      documentId: document.id,
      elementCount: result.elements.length,
    });

    return {
      ...document,
      type: result.type,
      text: result.text,
      elements: result.elements,
      tables: result.tables,
      images: result.images,
      metadata: {
        ...document.metadata,
        ...result.metadata,
      },
    };
  }

  /**
   * Extract stage - extract tables, images, metadata
   */
  private executeExtract(
    document: ProcessedDocument,
  ): Promise<ProcessedDocument> {
    // Extraction happens during parsing for most formats
    // This stage can be used for additional extraction or post-processing

    this.eventEmitter.emit({
      type: 'document:extracted',
      documentId: document.id,
      tables: document.tables.length,
      images: document.images.length,
    });

    return Promise.resolve(document);
  }

  /**
   * Clean stage - clean and normalize text
   */
  private executeClean(
    document: ProcessedDocument,
  ): Promise<ProcessedDocument> {
    if (!this.config.cleaning) {
      return Promise.resolve(document);
    }

    const originalLength = document.text.length;
    let cleanedText = document.text;

    // Apply cleaning operations
    for (const operation of this.config.cleaning.operations) {
      cleanedText = this.applyCleaningOperation(cleanedText, operation);
    }

    this.eventEmitter.emit({
      type: 'document:cleaned',
      documentId: document.id,
      originalLength,
      cleanedLength: cleanedText.length,
    });

    return Promise.resolve({
      ...document,
      text: cleanedText,
    });
  }

  /**
   * Apply a cleaning operation
   */
  private applyCleaningOperation(text: string, operation: string): string {
    switch (operation) {
      case 'normalize_whitespace':
        return text.replace(/\s+/g, ' ');
      case 'trim':
        return text.trim();
      case 'remove_extra_whitespace':
        return text.replace(/  +/g, ' ').replace(/\n\n+/g, '\n\n');
      case 'lowercase':
        return text.toLowerCase();
      case 'uppercase':
        return text.toUpperCase();
      case 'remove_urls':
        return text.replace(/https?:\/\/[^\s]+/g, '');
      case 'remove_emails':
        return text.replace(
          /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
          '',
        );
      default:
        return text;
    }
  }

  /**
   * Chunk stage - split document into chunks
   */
  private async executeChunk(
    document: ProcessedDocument,
  ): Promise<ProcessedDocument> {
    if (!this.config.chunking) {
      // Default chunking if not configured
      const chunks: Chunk[] = [
        {
          id: nanoid(),
          documentId: document.id,
          text: document.text,
          tokenCount: this.estimateTokens(document.text),
          metadata: { index: 0 },
        },
      ];

      this.eventEmitter.emit({
        type: 'document:chunked',
        documentId: document.id,
        chunkCount: chunks.length,
      });

      return { ...document, chunks };
    }

    // Use chunker registry
    const strategy = this.config.chunking.strategy;
    let chunks: Chunk[];

    if (this.chunkerRegistry.isSupported(strategy)) {
      const result = this.chunkerRegistry.chunk(
        document.text,
        strategy,
        this.config.chunking,
      );
      // Handle both sync and async chunkers
      chunks = Array.isArray(result) ? result : await result;
      // Set document ID on chunks
      chunks = chunks.map((chunk) => ({ ...chunk, documentId: document.id }));
    } else {
      // Fallback to simple chunking
      chunks = this.simpleChunk(document);
    }

    this.eventEmitter.emit({
      type: 'document:chunked',
      documentId: document.id,
      chunkCount: chunks.length,
    });

    return { ...document, chunks };
  }

  /**
   * Simple chunking fallback
   */
  private simpleChunk(document: ProcessedDocument): Chunk[] {
    const maxTokens = this.config.chunking?.maxTokens ?? 512;
    const overlap = this.config.chunking?.overlap ?? 50;
    const text = document.text;
    const chunks: Chunk[] = [];

    let start = 0;
    let index = 0;

    while (start < text.length) {
      // Estimate end position based on tokens
      const estimatedChars = maxTokens * 4; // Rough estimate: 4 chars per token
      let end = Math.min(start + estimatedChars, text.length);

      // Try to break at sentence boundary
      if (end < text.length) {
        const searchStart = Math.max(start + estimatedChars - 200, start);
        const searchText = text.slice(searchStart, end + 100);
        const sentenceEnd = searchText.search(/[.!?]\s/);
        if (sentenceEnd !== -1) {
          end = searchStart + sentenceEnd + 2;
        }
      }

      const chunkText = text.slice(start, end).trim();
      if (chunkText.length > 0) {
        chunks.push({
          id: nanoid(),
          documentId: document.id,
          text: chunkText,
          tokenCount: this.estimateTokens(chunkText),
          metadata: {
            index,
            startOffset: start,
            endOffset: end,
          },
        });
        index++;
      }

      // Move start position with overlap
      const overlapChars = overlap * 4;
      start = end - overlapChars;
      const lastChunkStart = chunks[chunks.length - 1]?.metadata.startOffset;
      if (start <= (lastChunkStart ?? 0)) {
        start = end; // Prevent infinite loop
      }
    }

    return chunks;
  }

  /**
   * Estimate token count
   */
  private estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Enrich stage - extract entities, keywords, etc.
   */
  private executeEnrich(
    document: ProcessedDocument,
  ): Promise<ProcessedDocument> {
    if (!this.config.enrichment) {
      return Promise.resolve(document);
    }

    const enrichments: string[] = [];

    // Placeholder for enrichment logic
    // In production, this would use NLP/LLM services

    this.eventEmitter.emit({
      type: 'document:enriched',
      documentId: document.id,
      enrichments,
    });

    return Promise.resolve(document);
  }

  /**
   * Embed stage - generate embeddings
   */
  private executeEmbed(
    document: ProcessedDocument,
  ): Promise<ProcessedDocument> {
    if (!this.config.embedding) {
      return Promise.resolve(document);
    }

    // Placeholder for embedding logic
    // In production, this would use embedding providers

    this.eventEmitter.emit({
      type: 'document:embedded',
      documentId: document.id,
      embeddingCount: document.chunks.length,
    });

    return Promise.resolve(document);
  }

  /**
   * Store stage - persist document and chunks
   */
  private executeStore(
    document: ProcessedDocument,
  ): Promise<ProcessedDocument> {
    if (!this.config.storage) {
      return Promise.resolve(document);
    }

    // Placeholder for storage logic
    // In production, this would use storage adapters

    this.eventEmitter.emit({
      type: 'document:stored',
      documentId: document.id,
      storageId: document.id,
    });

    return Promise.resolve(document);
  }

  /**
   * Create pipeline error
   */
  private createPipelineError(
    stage: PipelineStage,
    documentId: string | undefined,
    error: unknown,
  ): PipelineError {
    return {
      stage,
      documentId,
      message: error instanceof Error ? error.message : String(error),
      cause: error instanceof Error ? error : undefined,
      recoverable: this.config.errorHandling?.continueOnError ?? false,
    };
  }
}

/**
 * Create a new pipeline
 */
export function createPipeline(config?: PipelineConfig): Pipeline {
  return new Pipeline(config);
}
