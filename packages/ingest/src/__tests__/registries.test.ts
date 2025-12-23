/**
 * Registry Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ParserRegistry } from '../core/ParserRegistry.js';
import { ChunkerRegistry } from '../core/ChunkerRegistry.js';
import { TextParser } from '../parsers/TextParser.js';
import { FixedChunker } from '../chunking/FixedChunker.js';
import type { Parser, Chunker } from '../types/index.js';

describe('ParserRegistry', () => {
  let registry: ParserRegistry;

  beforeEach(() => {
    registry = new ParserRegistry({ registerBuiltIns: false });
  });

  describe('registration', () => {
    it('should register a parser', () => {
      const parser = new TextParser();
      registry.register(parser);

      const retrieved = registry.get('text-parser');
      expect(retrieved).toBe(parser);
    });

    it('should unregister a parser', () => {
      const parser = new TextParser();
      registry.register(parser);

      expect(registry.get('text-parser')).toBeDefined();

      registry.unregister('text-parser');

      expect(registry.get('text-parser')).toBeUndefined();
    });

    it('should register multiple parsers', () => {
      const parser1 = new TextParser();
      const parser2 = new TextParser();
      parser2.name = 'custom-parser';

      registry.register(parser1);
      registry.register(parser2);

      expect(registry.get('text-parser')).toBeDefined();
      expect(registry.get('custom-parser')).toBeDefined();
    });
  });

  describe('finding parsers', () => {
    beforeEach(() => {
      registry.register(new TextParser());
    });

    it('should find parser by MIME type', () => {
      const parser = registry.findParser('text/plain');

      expect(parser).toBeDefined();
      expect(parser?.name).toBe('text-parser');
    });

    it('should find parser by extension', () => {
      const parser = registry.findParser(undefined, 'txt');

      expect(parser).toBeDefined();
      expect(parser?.name).toBe('text-parser');
    });

    it('should find parser by both MIME type and extension', () => {
      const parser = registry.findParser('text/plain', 'txt');

      expect(parser).toBeDefined();
    });

    it('should return undefined for unsupported MIME type', () => {
      const parser = registry.findParser('application/unknown');

      expect(parser).toBeUndefined();
    });

    it('should return undefined for unsupported extension', () => {
      const parser = registry.findParser(undefined, 'xyz');

      expect(parser).toBeUndefined();
    });
  });

  describe('parsing', () => {
    beforeEach(() => {
      registry.register(new TextParser());
    });

    it('should parse with automatic parser detection', async () => {
      const buffer = Buffer.from('Test content');

      const result = await registry.parse(buffer, 'text/plain');

      expect(result).toBeDefined();
      expect(result.type).toBe('text');
    });

    it('should parse with extension detection', async () => {
      const buffer = Buffer.from('Test content');

      const result = await registry.parse(buffer, undefined, 'txt');

      expect(result).toBeDefined();
    });

    it('should throw error when no parser found', async () => {
      const buffer = Buffer.from('Test');

      await expect(
        registry.parse(buffer, 'application/unknown'),
      ).rejects.toThrow('No parser found');
    });

    it('should merge default options', async () => {
      const registryWithDefaults = new ParserRegistry({
        defaultOptions: { encoding: 'utf-8' },
      });
      registryWithDefaults.register(new TextParser());

      const buffer = Buffer.from('Test');
      const result = await registryWithDefaults.parse(buffer, 'text/plain');

      expect(result).toBeDefined();
    });
  });

  describe('support checking', () => {
    beforeEach(() => {
      registry.register(new TextParser());
    });

    it('should check if MIME type is supported', () => {
      expect(registry.isSupported('text/plain')).toBe(true);
      expect(registry.isSupported('application/unknown')).toBe(false);
    });

    it('should check if extension is supported', () => {
      expect(registry.isSupported(undefined, 'txt')).toBe(true);
      expect(registry.isSupported(undefined, 'xyz')).toBe(false);
    });
  });

  describe('listing', () => {
    beforeEach(() => {
      registry.register(new TextParser());
    });

    it('should get all parsers', () => {
      const parsers = registry.getAll();

      expect(parsers).toHaveLength(1);
      expect(parsers[0].name).toBe('text-parser');
    });

    it('should get supported MIME types', () => {
      const mimeTypes = registry.getSupportedMimeTypes();

      expect(mimeTypes).toContain('text/plain');
    });

    it('should get supported extensions', () => {
      const extensions = registry.getSupportedExtensions();

      expect(extensions).toContain('txt');
      expect(extensions).toContain('text');
      expect(extensions).toContain('log');
    });
  });

  describe('static methods', () => {
    it('should detect MIME type from extension', () => {
      const mimeType = ParserRegistry.detectMimeType('txt');

      expect(mimeType).toBe('text/plain');
    });

    it('should handle extension with dot', () => {
      const mimeType = ParserRegistry.detectMimeType('.txt');

      expect(mimeType).toBe('text/plain');
    });

    it('should handle case-insensitive extensions', () => {
      const mimeType = ParserRegistry.detectMimeType('TXT');

      expect(mimeType).toBe('text/plain');
    });

    it('should detect extension from MIME type', () => {
      const extension = ParserRegistry.detectExtension('text/plain');

      expect(extension).toBe('txt');
    });

    it('should extract extension from filename', () => {
      expect(ParserRegistry.getExtension('document.txt')).toBe('txt');
      expect(ParserRegistry.getExtension('file.name.pdf')).toBe('pdf');
      expect(ParserRegistry.getExtension('README')).toBe('');
    });

    it('should handle case-insensitive filename extensions', () => {
      const extension = ParserRegistry.getExtension('Document.TXT');

      expect(extension).toBe('txt');
    });
  });

  describe('configuration', () => {
    it('should accept custom parsers in config', () => {
      const customParser = new TextParser();
      const registryWithCustom = new ParserRegistry({
        customParsers: [customParser],
      });

      expect(registryWithCustom.get('text-parser')).toBe(customParser);
    });

    it('should accept MIME type overrides', () => {
      const customParser = new TextParser();
      const registryWithOverride = new ParserRegistry({
        mimeTypeOverrides: {
          'text/plain': customParser,
        },
      });

      const found = registryWithOverride.findParser('text/plain');
      expect(found).toBe(customParser);
    });
  });
});

describe('ChunkerRegistry', () => {
  let registry: ChunkerRegistry;

  beforeEach(() => {
    registry = new ChunkerRegistry({ registerBuiltIns: false });
  });

  describe('registration', () => {
    it('should register a chunker', () => {
      const chunker = new FixedChunker();
      registry.register(chunker);

      const retrieved = registry.get('fixed');
      expect(retrieved).toBe(chunker);
    });

    it('should unregister a chunker', () => {
      const chunker = new FixedChunker();
      registry.register(chunker);

      expect(registry.get('fixed')).toBeDefined();

      registry.unregister('fixed');

      expect(registry.get('fixed')).toBeUndefined();
    });

    it('should register multiple chunkers', () => {
      const chunker1 = new FixedChunker();
      const chunker2 = new FixedChunker();
      chunker2.strategy = 'custom' as any;

      registry.register(chunker1);
      registry.register(chunker2);

      expect(registry.get('fixed')).toBeDefined();
      expect(registry.get('custom' as any)).toBeDefined();
    });
  });

  describe('chunking', () => {
    beforeEach(() => {
      registry.register(new FixedChunker());
    });

    it('should chunk text with specified strategy', () => {
      const text = 'This is test content for chunking.';

      const chunks = registry.chunk(text, 'fixed', { maxTokens: 10 });

      expect(Array.isArray(chunks)).toBe(true);
      expect((chunks as any[]).length).toBeGreaterThan(0);
    });

    it('should chunk elements with specified strategy', () => {
      const elements = [
        { type: 'paragraph' as const, text: 'Test paragraph 1' },
        { type: 'paragraph' as const, text: 'Test paragraph 2' },
      ];

      const result = registry.chunkElements(elements, 'fixed', {
        maxTokens: 100,
      });

      expect(result).toBeDefined();
    });

    it('should throw error for unsupported strategy', () => {
      const text = 'Test content';

      expect(() => registry.chunk(text, 'unknown' as any)).toThrow(
        'No chunker found',
      );
    });

    it('should merge default options', () => {
      const text = 'Test content';

      const chunks = registry.chunk(text, 'fixed');

      expect(Array.isArray(chunks)).toBe(true);
    });
  });

  describe('support checking', () => {
    beforeEach(() => {
      registry.register(new FixedChunker());
    });

    it('should check if strategy is supported', () => {
      expect(registry.isSupported('fixed')).toBe(true);
      expect(registry.isSupported('unknown' as any)).toBe(false);
    });
  });

  describe('listing', () => {
    beforeEach(() => {
      registry.register(new FixedChunker());
    });

    it('should get all chunkers', () => {
      const chunkers = registry.getAll();

      expect(chunkers).toHaveLength(1);
      expect(chunkers[0].strategy).toBe('fixed');
    });

    it('should get supported strategies', () => {
      const strategies = registry.getSupportedStrategies();

      expect(strategies).toContain('fixed');
    });
  });

  describe('default options', () => {
    it('should set default options', () => {
      registry.setDefaultOptions({ maxTokens: 1000, overlap: 100 });

      const options = registry.getDefaultOptions();

      expect(options.maxTokens).toBe(1000);
      expect(options.overlap).toBe(100);
    });

    it('should get default options', () => {
      const options = registry.getDefaultOptions();

      expect(options).toBeDefined();
      expect(options.maxTokens).toBe(512);
      expect(options.overlap).toBe(50);
    });

    it('should merge with existing defaults', () => {
      registry.setDefaultOptions({ maxTokens: 1000 });

      const options = registry.getDefaultOptions();

      expect(options.maxTokens).toBe(1000);
      expect(options.overlap).toBe(50); // Original default
    });
  });

  describe('configuration', () => {
    it('should accept custom chunkers in config', () => {
      const customChunker = new FixedChunker();
      const registryWithCustom = new ChunkerRegistry({
        customChunkers: [customChunker],
      });

      expect(registryWithCustom.get('fixed')).toBe(customChunker);
    });

    it('should accept strategy overrides', () => {
      const customChunker = new FixedChunker();
      const registryWithOverride = new ChunkerRegistry({
        strategyOverrides: {
          fixed: customChunker,
        },
      });

      const found = registryWithOverride.get('fixed');
      expect(found).toBe(customChunker);
    });

    it('should accept default options in config', () => {
      const registryWithDefaults = new ChunkerRegistry({
        defaultOptions: {
          maxTokens: 1000,
          overlap: 100,
        },
      });

      const options = registryWithDefaults.getDefaultOptions();

      expect(options.maxTokens).toBe(1000);
      expect(options.overlap).toBe(100);
    });
  });
});
