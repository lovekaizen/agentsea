/**
 * PipelineBuilder Tests
 */

import { describe, it, expect } from 'vitest';
import { PipelineBuilder, pipelines } from '../core/PipelineBuilder.js';

describe('PipelineBuilder', () => {
  describe('constructor', () => {
    it('should create builder instance', () => {
      const builder = new PipelineBuilder();
      expect(builder).toBeDefined();
    });
  });

  describe('configuration methods', () => {
    it('should set pipeline name', () => {
      const builder = new PipelineBuilder().withName('custom-pipeline');
      const pipeline = builder.build();

      expect(pipeline.name).toBe('custom-pipeline');
    });

    it('should set stages', () => {
      const builder = new PipelineBuilder().withStages(['load', 'parse']);
      const pipeline = builder.build();

      expect(pipeline.config.stages).toEqual(['load', 'parse']);
    });

    it('should set parser options', () => {
      const builder = new PipelineBuilder().withParser({
        encoding: 'utf-8',
      });
      const pipeline = builder.build();

      expect(pipeline.config.parser).toBeDefined();
      expect(pipeline.config.parser?.encoding).toBe('utf-8');
    });

    it('should set extraction options', () => {
      const builder = new PipelineBuilder().withExtraction({
        tables: { enabled: true },
        images: { enabled: true },
      });
      const pipeline = builder.build();

      expect(pipeline.config.extraction).toBeDefined();
      expect(pipeline.config.extraction?.tables).toBeDefined();
    });

    it('should set cleaning options', () => {
      const builder = new PipelineBuilder().withCleaning({
        operations: ['trim', 'normalize_whitespace'],
      });
      const pipeline = builder.build();

      expect(pipeline.config.cleaning).toBeDefined();
      expect(pipeline.config.cleaning?.operations).toHaveLength(2);
    });

    it('should set chunking options', () => {
      const builder = new PipelineBuilder().withChunking({
        strategy: 'fixed',
        maxTokens: 512,
        overlap: 50,
      });
      const pipeline = builder.build();

      expect(pipeline.config.chunking).toBeDefined();
      expect(pipeline.config.chunking?.strategy).toBe('fixed');
      expect(pipeline.config.chunking?.maxTokens).toBe(512);
    });

    it('should set enrichment options', () => {
      const builder = new PipelineBuilder().withEnrichment({
        extractKeywords: true,
      });
      const pipeline = builder.build();

      expect(pipeline.config.enrichment).toBeDefined();
    });

    it('should set embedding options', () => {
      const builder = new PipelineBuilder().withEmbedding({
        model: 'text-embedding-3-small',
        provider: 'openai',
        batchSize: 100,
      });
      const pipeline = builder.build();

      expect(pipeline.config.embedding).toBeDefined();
      expect(pipeline.config.embedding?.model).toBe('text-embedding-3-small');
    });

    it('should set storage options', () => {
      const builder = new PipelineBuilder().withStorage({
        type: 'memory',
      });
      const pipeline = builder.build();

      expect(pipeline.config.storage).toBeDefined();
      expect(pipeline.config.storage?.type).toBe('memory');
    });

    it('should set OCR options', () => {
      const builder = new PipelineBuilder().withOCR({
        engine: 'tesseract',
        languages: ['eng'],
      });
      const pipeline = builder.build();

      expect(pipeline.config.ocr).toBeDefined();
      expect(pipeline.config.ocr?.engine).toBe('tesseract');
    });

    it('should set error handling options', () => {
      const builder = new PipelineBuilder().withErrorHandling({
        continueOnError: true,
        maxRetries: 3,
      });
      const pipeline = builder.build();

      expect(pipeline.config.errorHandling).toBeDefined();
      expect(pipeline.config.errorHandling?.continueOnError).toBe(true);
    });

    it('should set callbacks', () => {
      const callbacks = {
        onDocumentStart: () => {},
        onDocumentComplete: () => {},
      };

      const builder = new PipelineBuilder().withCallbacks(callbacks);
      const pipeline = builder.build();

      expect(pipeline.config.callbacks).toBeDefined();
      expect(pipeline.config.callbacks?.onDocumentStart).toBe(
        callbacks.onDocumentStart,
      );
    });
  });

  describe('custom stages', () => {
    it('should add custom stage', () => {
      const handler = async (doc: any) => doc;
      const builder = new PipelineBuilder().addCustomStage('custom', handler);
      const pipeline = builder.build();

      expect(pipeline.getStageHandler('custom')).toBe(handler);
    });

    it('should add custom stage after specific stage', () => {
      const handler = async (doc: any) => doc;
      const builder = new PipelineBuilder()
        .withStages(['load', 'parse'])
        .addCustomStage('custom', handler, 'load');

      const pipeline = builder.build();

      expect(pipeline.getStageHandler('custom')).toBe(handler);
    });

    it('should add multiple custom stages', () => {
      const handler1 = async (doc: any) => doc;
      const handler2 = async (doc: any) => doc;

      const builder = new PipelineBuilder()
        .addCustomStage('custom1', handler1)
        .addCustomStage('custom2', handler2);

      const pipeline = builder.build();

      expect(pipeline.getStageHandler('custom1')).toBe(handler1);
      expect(pipeline.getStageHandler('custom2')).toBe(handler2);
    });
  });

  describe('method chaining', () => {
    it('should support fluent API', () => {
      const builder = new PipelineBuilder()
        .withName('chained-pipeline')
        .withStages(['load', 'parse', 'chunk'])
        .withChunking({
          strategy: 'fixed',
          maxTokens: 512,
        })
        .withCleaning({
          operations: ['trim'],
        });

      const pipeline = builder.build();

      expect(pipeline.name).toBe('chained-pipeline');
      expect(pipeline.config.stages).toHaveLength(3);
      expect(pipeline.config.chunking).toBeDefined();
      expect(pipeline.config.cleaning).toBeDefined();
    });
  });

  describe('clone', () => {
    it('should create a copy of builder', () => {
      const original = new PipelineBuilder()
        .withName('original')
        .withStages(['load', 'parse']);

      const cloned = original.clone();
      cloned.withName('cloned');

      const originalPipeline = original.build();
      const clonedPipeline = cloned.build();

      expect(originalPipeline.name).toBe('original');
      expect(clonedPipeline.name).toBe('cloned');
    });

    it('should copy custom stages', () => {
      const handler = async (doc: any) => doc;
      const original = new PipelineBuilder().addCustomStage('custom', handler);

      const cloned = original.clone();
      const pipeline = cloned.build();

      expect(pipeline.getStageHandler('custom')).toBeDefined();
    });
  });

  describe('pre-built pipelines', () => {
    it('should create simple pipeline', () => {
      const builder = pipelines.simple();
      const pipeline = builder.build();

      expect(pipeline.name).toBe('simple-extraction');
      expect(pipeline.config.stages).toEqual(['load', 'parse', 'chunk']);
    });

    it('should create full pipeline', () => {
      const builder = pipelines.full();
      const pipeline = builder.build();

      expect(pipeline.name).toBe('full-processing');
      expect(pipeline.config.stages).toContain('load');
      expect(pipeline.config.stages).toContain('parse');
      expect(pipeline.config.stages).toContain('store');
    });

    it('should create RAG pipeline', () => {
      const builder = pipelines.rag();
      const pipeline = builder.build();

      expect(pipeline.name).toBe('rag-pipeline');
      expect(pipeline.config.chunking).toBeDefined();
      expect(pipeline.config.chunking?.strategy).toBe('semantic');
    });

    it('should create analysis pipeline', () => {
      const builder = pipelines.analysis();
      const pipeline = builder.build();

      expect(pipeline.name).toBe('analysis-pipeline');
      expect(pipeline.config.stages).not.toContain('chunk');
      expect(pipeline.config.stages).not.toContain('embed');
    });

    it('should create OCR pipeline', () => {
      const builder = pipelines.ocr();
      const pipeline = builder.build();

      expect(pipeline.name).toBe('ocr-pipeline');
      expect(pipeline.config.ocr).toBeDefined();
      expect(pipeline.config.ocr?.engine).toBe('tesseract');
    });
  });

  describe('build', () => {
    it('should build pipeline with all configurations', () => {
      const builder = new PipelineBuilder()
        .withName('complete-pipeline')
        .withStages(['load', 'parse', 'chunk'])
        .withParser({ encoding: 'utf-8' })
        .withChunking({ strategy: 'fixed', maxTokens: 512 })
        .withErrorHandling({ continueOnError: true });

      const pipeline = builder.build();

      expect(pipeline).toBeDefined();
      expect(pipeline.name).toBe('complete-pipeline');
      expect(pipeline.config.parser).toBeDefined();
      expect(pipeline.config.chunking).toBeDefined();
      expect(pipeline.config.errorHandling).toBeDefined();
    });
  });
});
