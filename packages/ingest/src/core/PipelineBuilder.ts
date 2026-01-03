/**
 * Pipeline Builder
 *
 * Fluent API for building document processing pipelines.
 */

import type {
  PipelineBuilder as IPipelineBuilder,
  PipelineConfig,
  PipelineStage,
  CustomStageHandler,
  ParserOptions,
  ExtractionConfig,
  CleaningConfig,
  ChunkingConfig,
  EnrichmentConfig,
  EmbeddingPipelineConfig,
  StorageConfig,
  OCRConfig,
  ErrorHandlingConfig,
  PipelineCallbacks,
  Pipeline as IPipeline,
} from '../types/index.js';
import { Pipeline } from './Pipeline.js';

/**
 * Fluent builder for document processing pipelines
 */
export class PipelineBuilder implements IPipelineBuilder {
  private config: PipelineConfig = {
    stages: [],
  };
  private customStages: Map<
    string,
    { handler: CustomStageHandler; after?: PipelineStage }
  > = new Map();

  /**
   * Set pipeline name
   */
  withName(name: string): this {
    this.config.name = name;
    return this;
  }

  /**
   * Set stages to execute
   */
  withStages(stages: PipelineStage[]): this {
    this.config.stages = stages;
    return this;
  }

  /**
   * Set parser options
   */
  withParser(options: ParserOptions): this {
    this.config.parser = options;
    return this;
  }

  /**
   * Set extraction options
   */
  withExtraction(options: ExtractionConfig): this {
    this.config.extraction = options;
    return this;
  }

  /**
   * Set cleaning options
   */
  withCleaning(config: CleaningConfig): this {
    this.config.cleaning = config;
    return this;
  }

  /**
   * Set chunking options
   */
  withChunking(config: ChunkingConfig): this {
    this.config.chunking = config;
    return this;
  }

  /**
   * Set enrichment options
   */
  withEnrichment(config: EnrichmentConfig): this {
    this.config.enrichment = config;
    return this;
  }

  /**
   * Set embedding options
   */
  withEmbedding(config: EmbeddingPipelineConfig): this {
    this.config.embedding = config;
    return this;
  }

  /**
   * Set storage options
   */
  withStorage(config: StorageConfig): this {
    this.config.storage = config;
    return this;
  }

  /**
   * Set OCR options
   */
  withOCR(config: OCRConfig): this {
    this.config.ocr = config;
    return this;
  }

  /**
   * Add custom stage
   */
  addCustomStage(
    name: string,
    handler: CustomStageHandler,
    after?: PipelineStage,
  ): this {
    this.customStages.set(name, { handler, after });
    return this;
  }

  /**
   * Set error handling
   */
  withErrorHandling(config: ErrorHandlingConfig): this {
    this.config.errorHandling = config;
    return this;
  }

  /**
   * Set callbacks
   */
  withCallbacks(callbacks: PipelineCallbacks): this {
    this.config.callbacks = callbacks;
    return this;
  }

  /**
   * Build the pipeline
   */
  build(): IPipeline {
    // Add custom stages to config
    const customStagesConfig: Record<string, CustomStageHandler> = {};
    for (const [name, { handler }] of this.customStages) {
      customStagesConfig[name] = handler;
    }
    this.config.customStages = customStagesConfig;

    // Create pipeline
    const pipeline = new Pipeline(this.config);

    // Add custom stages in order
    for (const [name, { handler, after }] of this.customStages) {
      pipeline.addStage(name, handler, after);
    }

    return pipeline;
  }

  /**
   * Create a copy of this builder
   */
  clone(): PipelineBuilder {
    const builder = new PipelineBuilder();
    builder.config = JSON.parse(JSON.stringify(this.config));
    builder.customStages = new Map(this.customStages);
    return builder;
  }
}

/**
 * Create a new pipeline builder
 */
export function createPipelineBuilder(): PipelineBuilder {
  return new PipelineBuilder();
}

/**
 * Quick pipeline builders for common use cases
 */
export const pipelines = {
  /**
   * Simple text extraction pipeline
   */
  simple(): PipelineBuilder {
    return new PipelineBuilder()
      .withName('simple-extraction')
      .withStages(['load', 'parse', 'chunk']);
  },

  /**
   * Full processing pipeline with all stages
   */
  full(): PipelineBuilder {
    return new PipelineBuilder()
      .withName('full-processing')
      .withStages([
        'load',
        'parse',
        'extract',
        'clean',
        'chunk',
        'enrich',
        'embed',
        'store',
      ]);
  },

  /**
   * RAG-optimized pipeline
   */
  rag(): PipelineBuilder {
    return new PipelineBuilder()
      .withName('rag-pipeline')
      .withStages(['load', 'parse', 'clean', 'chunk', 'embed'])
      .withChunking({
        strategy: 'semantic',
        maxTokens: 512,
        overlap: 50,
      });
  },

  /**
   * Document analysis pipeline (no chunking/embedding)
   */
  analysis(): PipelineBuilder {
    return new PipelineBuilder()
      .withName('analysis-pipeline')
      .withStages(['load', 'parse', 'extract', 'enrich']);
  },

  /**
   * OCR pipeline for scanned documents
   */
  ocr(): PipelineBuilder {
    return new PipelineBuilder()
      .withName('ocr-pipeline')
      .withStages(['load', 'parse', 'clean', 'chunk'])
      .withOCR({
        engine: 'tesseract',
        languages: ['eng'],
      });
  },
};
