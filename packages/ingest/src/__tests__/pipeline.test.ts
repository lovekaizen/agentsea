/**
 * Pipeline Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Pipeline } from '../core/Pipeline.js';
import type { DocumentInput, PipelineConfig } from '../types/index.js';

describe('Pipeline', () => {
  let pipeline: Pipeline;

  beforeEach(() => {
    pipeline = new Pipeline({
      name: 'test-pipeline',
      stages: ['load', 'parse', 'chunk'],
    });
  });

  describe('constructor', () => {
    it('should create pipeline with default config', () => {
      const defaultPipeline = new Pipeline();
      expect(defaultPipeline).toBeDefined();
      expect(defaultPipeline.name).toBe('default-pipeline');
    });

    it('should create pipeline with custom config', () => {
      expect(pipeline.name).toBe('test-pipeline');
      expect(pipeline.config).toBeDefined();
    });

    it('should use default stages if not specified', () => {
      const defaultPipeline = new Pipeline({});
      expect(defaultPipeline).toBeDefined();
    });
  });

  describe('process', () => {
    it('should process document from buffer', async () => {
      const input: DocumentInput = {
        buffer: Buffer.from('test content'),
        filename: 'test.txt',
        mimeType: 'text/plain',
      };

      const result = await pipeline.process(input);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.processedAt).toBeInstanceOf(Date);
    });

    it('should throw error when no input source provided', async () => {
      const input: DocumentInput = {
        filename: 'test.txt',
      };

      await expect(pipeline.process(input)).rejects.toThrow(
        'No input source provided',
      );
    });

    it('should execute stages in order', async () => {
      const stages: string[] = [];
      const trackedPipeline = new Pipeline({
        stages: ['load', 'parse'],
        callbacks: {
          onStageStart: (stage) => stages.push(stage),
        },
      });

      const input: DocumentInput = {
        buffer: Buffer.from('test'),
        mimeType: 'text/plain',
      };

      await trackedPipeline.process(input);

      expect(stages).toEqual(['load', 'parse']);
    });

    it('should call callbacks during processing', async () => {
      const callbacks = {
        onDocumentStart: vi.fn(),
        onStageStart: vi.fn(),
        onStageComplete: vi.fn(),
        onDocumentComplete: vi.fn(),
      };

      const callbackPipeline = new Pipeline({
        stages: ['load'],
        callbacks,
      });

      const input: DocumentInput = {
        buffer: Buffer.from('test'),
      };

      await callbackPipeline.process(input);

      expect(callbacks.onDocumentStart).toHaveBeenCalled();
      expect(callbacks.onStageStart).toHaveBeenCalled();
      expect(callbacks.onStageComplete).toHaveBeenCalled();
      expect(callbacks.onDocumentComplete).toHaveBeenCalled();
    });

    it('should continue on error when configured', async () => {
      const errorPipeline = new Pipeline({
        stages: ['load', 'parse', 'chunk'],
        errorHandling: {
          continueOnError: true,
        },
      });

      // Add a custom stage that throws
      errorPipeline.addStage(
        'fail',
        async () => {
          throw new Error('Test error');
        },
        'load',
      );

      const input: DocumentInput = {
        buffer: Buffer.from('test'),
      };

      const result = await errorPipeline.process(input);

      expect(result).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should throw error when continueOnError is false', async () => {
      const strictPipeline = new Pipeline({
        stages: ['load'],
        errorHandling: {
          continueOnError: false,
        },
      });

      strictPipeline.addStage(
        'fail',
        async () => {
          throw new Error('Test error');
        },
        'load',
      );

      const input: DocumentInput = {
        buffer: Buffer.from('test'),
      };

      await expect(strictPipeline.process(input)).rejects.toThrow('Test error');
    });
  });

  describe('processBatch', () => {
    it('should process multiple documents', async () => {
      const inputs: DocumentInput[] = [
        { buffer: Buffer.from('doc1'), filename: 'doc1.txt' },
        { buffer: Buffer.from('doc2'), filename: 'doc2.txt' },
        { buffer: Buffer.from('doc3'), filename: 'doc3.txt' },
      ];

      const result = await pipeline.processBatch(inputs);

      expect(result.documents).toHaveLength(3);
      expect(result.successCount).toBe(3);
      expect(result.failedCount).toBe(0);
    });

    it('should skip failing documents when configured', async () => {
      const errorPipeline = new Pipeline({
        stages: ['load', 'parse'],
        errorHandling: {
          skipFailing: true,
        },
      });

      const inputs: DocumentInput[] = [
        { buffer: Buffer.from('doc1') },
        { filename: 'invalid.txt' }, // No buffer - will fail
        { buffer: Buffer.from('doc3') },
      ];

      const result = await errorPipeline.processBatch(inputs);

      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(1);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should report progress during batch processing', async () => {
      const progressUpdates: number[] = [];
      const progressPipeline = new Pipeline({
        stages: ['load'],
        callbacks: {
          onProgress: (progress) =>
            progressUpdates.push(progress.documentIndex),
        },
      });

      const inputs: DocumentInput[] = Array.from({ length: 5 }, (_, i) => ({
        buffer: Buffer.from(`doc${i}`),
      }));

      await progressPipeline.processBatch(inputs);

      expect(progressUpdates.length).toBe(5);
    });

    it('should calculate processing time', async () => {
      const inputs: DocumentInput[] = [{ buffer: Buffer.from('doc1') }];

      const result = await pipeline.processBatch(inputs);

      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('processStream', () => {
    it('should process async iterable of documents', async () => {
      async function* generateInputs() {
        yield { buffer: Buffer.from('doc1') };
        yield { buffer: Buffer.from('doc2') };
        yield { buffer: Buffer.from('doc3') };
      }

      const results = [];
      for await (const doc of pipeline.processStream(generateInputs())) {
        results.push(doc);
      }

      expect(results).toHaveLength(3);
    });

    it('should skip failing documents in stream', async () => {
      const errorPipeline = new Pipeline({
        stages: ['load'],
        errorHandling: {
          skipFailing: true,
        },
      });

      async function* generateInputs() {
        yield { buffer: Buffer.from('doc1') };
        yield { filename: 'invalid' }; // Will fail
        yield { buffer: Buffer.from('doc3') };
      }

      const results = [];
      for await (const doc of errorPipeline.processStream(generateInputs())) {
        results.push(doc);
      }

      expect(results).toHaveLength(2);
    });
  });

  describe('stage management', () => {
    it('should add custom stage', () => {
      const handler = vi.fn(async (doc) => doc);

      pipeline.addStage('custom', handler);

      expect(pipeline.getStageHandler('custom')).toBe(handler);
    });

    it('should add stage after specific stage', async () => {
      const stages: string[] = [];
      const trackedPipeline = new Pipeline({
        stages: ['load', 'chunk'],
        callbacks: {
          onStageStart: (stage) => stages.push(stage),
        },
      });

      trackedPipeline.addStage('custom', async (doc) => doc, 'load');

      const input: DocumentInput = { buffer: Buffer.from('test') };
      await trackedPipeline.process(input);

      expect(stages).toContain('custom');
      const customIndex = stages.indexOf('custom');
      const loadIndex = stages.indexOf('load');
      expect(customIndex).toBeGreaterThan(loadIndex);
    });

    it('should remove stage', () => {
      const handler = async (doc: any) => doc;

      pipeline.addStage('custom', handler);
      expect(pipeline.getStageHandler('custom')).toBeDefined();

      pipeline.removeStage('custom');
      expect(pipeline.getStageHandler('custom')).toBeUndefined();
    });

    it('should execute custom stage handler', async () => {
      const customHandler = vi.fn(async (doc) => ({
        ...doc,
        metadata: { ...doc.metadata, custom: true },
      }));

      const customPipeline = new Pipeline({ stages: ['load'] });
      customPipeline.addStage('custom', customHandler);

      const input: DocumentInput = { buffer: Buffer.from('test') };
      const result = await customPipeline.process(input);

      expect(customHandler).toHaveBeenCalled();
    });
  });

  describe('validation', () => {
    it('should validate chunking config', () => {
      const invalidPipeline = new Pipeline({
        chunking: {
          strategy: 'fixed',
          maxTokens: 100,
          overlap: 150, // Invalid: overlap >= maxTokens
        },
      });

      const validation = invalidPipeline.validate();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain(
        'Chunk overlap must be less than maxTokens',
      );
    });

    it('should warn about missing storage config', () => {
      const storagePipeline = new Pipeline({
        stages: ['load', 'parse', 'store'],
      });

      const validation = storagePipeline.validate();

      expect(validation.warnings).toContain(
        'Store stage is enabled but no storage configuration provided',
      );
    });

    it('should warn about missing embedding config', () => {
      const embeddingPipeline = new Pipeline({
        stages: ['load', 'parse', 'embed'],
      });

      const validation = embeddingPipeline.validate();

      expect(validation.warnings).toContain(
        'Embed stage is enabled but no embedding configuration provided',
      );
    });

    it('should validate successfully with correct config', () => {
      const validPipeline = new Pipeline({
        stages: ['load', 'parse'],
        chunking: {
          strategy: 'fixed',
          maxTokens: 512,
          overlap: 50,
        },
      });

      const validation = validPipeline.validate();

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('abort', () => {
    it('should abort processing', async () => {
      const abortPipeline = new Pipeline({ stages: ['load'] });

      abortPipeline.abort();

      const input: DocumentInput = { buffer: Buffer.from('test') };

      await expect(abortPipeline.process(input)).rejects.toThrow(
        'Pipeline aborted',
      );
    });

    it('should abort batch processing', async () => {
      const abortPipeline = new Pipeline({ stages: ['load'] });

      const inputs: DocumentInput[] = Array.from({ length: 10 }, () => ({
        buffer: Buffer.from('test'),
      }));

      // Abort immediately before processing starts
      // This ensures the abort is registered before any processing happens
      abortPipeline.abort();

      const result = await abortPipeline.processBatch(inputs);

      // All items should be skipped when aborted before start
      expect(result.skippedCount).toBe(10);
    });
  });

  describe('cleaning stage', () => {
    it('should apply cleaning operations', async () => {
      const cleanPipeline = new Pipeline({
        stages: ['load', 'parse', 'clean'],
        cleaning: {
          operations: ['trim', 'normalize_whitespace'],
        },
      });

      const input: DocumentInput = {
        buffer: Buffer.from('  test   content   '),
      };

      const result = await cleanPipeline.process(input);

      expect(result.text).not.toContain('  ');
    });

    it('should skip cleaning when not configured', async () => {
      const noCleanPipeline = new Pipeline({
        stages: ['load', 'parse', 'clean'],
      });

      const input: DocumentInput = {
        buffer: Buffer.from('test'),
      };

      const result = await noCleanPipeline.process(input);

      expect(result).toBeDefined();
    });
  });

  describe('chunking stage', () => {
    it('should create default chunk when chunking not configured', async () => {
      const chunkPipeline = new Pipeline({
        stages: ['load', 'parse', 'chunk'],
      });

      const input: DocumentInput = {
        buffer: Buffer.from('This is test content for chunking.'),
      };

      const result = await chunkPipeline.process(input);

      expect(result.chunks).toHaveLength(1);
      expect(result.chunks[0].text).toBe('This is test content for chunking.');
    });

    it('should chunk with configured strategy', async () => {
      const chunkPipeline = new Pipeline({
        stages: ['load', 'parse', 'chunk'],
        chunking: {
          strategy: 'fixed',
          maxTokens: 10,
        },
      });

      const input: DocumentInput = {
        buffer: Buffer.from(
          'This is a long piece of content that should be split into multiple chunks because it exceeds the token limit.',
        ),
      };

      const result = await chunkPipeline.process(input);

      expect(result.chunks.length).toBeGreaterThan(1);
    });
  });

  describe('getters', () => {
    it('should get event emitter', () => {
      const emitter = pipeline.getEventEmitter();
      expect(emitter).toBeDefined();
    });

    it('should get parser registry', () => {
      const registry = pipeline.getParserRegistry();
      expect(registry).toBeDefined();
    });

    it('should get chunker registry', () => {
      const registry = pipeline.getChunkerRegistry();
      expect(registry).toBeDefined();
    });
  });
});
