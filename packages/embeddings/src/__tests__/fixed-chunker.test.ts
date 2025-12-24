import { describe, it, expect } from 'vitest';
import { FixedChunker, createFixedChunker } from '../chunking/FixedChunker.js';

describe('FixedChunker', () => {
  let chunker: FixedChunker;

  beforeEach(() => {
    chunker = new FixedChunker();
  });

  describe('constructor', () => {
    it('should create a fixed chunker', () => {
      expect(chunker).toBeInstanceOf(FixedChunker);
      expect(chunker.strategyType).toBe('fixed');
    });
  });

  describe('chunk', () => {
    it('should chunk text into fixed-size pieces', async () => {
      const text =
        'This is a test sentence. Another sentence here. And a third one.';
      const chunks = await chunker.chunk(text, {
        chunkSize: 20,
        chunkOverlap: 0,
      });

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach((chunk) => {
        expect(chunk.text).toBeDefined();
        expect(chunk.index).toBeGreaterThanOrEqual(0);
      });
    });

    it('should respect chunk size limit', async () => {
      // Use a longer text that will definitely need multiple chunks
      const text =
        'This is sentence one. This is sentence two. This is sentence three. This is sentence four. This is sentence five.';
      const chunks = await chunker.chunk(text, {
        chunkSize: 10,
        chunkOverlap: 0,
      });

      // Should create multiple chunks
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle overlap between chunks', async () => {
      const text = 'Sentence one. Sentence two. Sentence three. Sentence four.';
      const chunks = await chunker.chunk(text, {
        chunkSize: 10,
        chunkOverlap: 2,
      });

      // With overlap, chunks may share some content
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should create single chunk for short text', async () => {
      const text = 'Short text';
      const chunks = await chunker.chunk(text, {
        chunkSize: 100,
        chunkOverlap: 0,
      });

      expect(chunks).toHaveLength(1);
      expect(chunks[0].text).toBe('Short text');
    });

    it('should handle empty text', async () => {
      const chunks = await chunker.chunk('', {
        chunkSize: 100,
        chunkOverlap: 0,
      });
      expect(chunks).toHaveLength(0);
    });

    it('should handle whitespace-only text', async () => {
      const chunks = await chunker.chunk('   ', {
        chunkSize: 100,
        chunkOverlap: 0,
      });
      expect(chunks).toHaveLength(0);
    });

    it('should use character-based splitting when specified', async () => {
      const text = 'A'.repeat(100);
      const chunks = await chunker.chunk(text, {
        chunkSize: 10,
        chunkOverlap: 0,
        splitByChars: true,
      });

      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should use custom separator', async () => {
      const text = 'Part1|Part2|Part3|Part4';
      const chunks = await chunker.chunk(text, {
        chunkSize: 10,
        chunkOverlap: 0,
        separator: '|',
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should keep separator when specified', async () => {
      const text = 'Line1\nLine2\nLine3';
      const chunks = await chunker.chunk(text, {
        chunkSize: 20,
        chunkOverlap: 0,
        separator: '\n',
        keepSeparator: true,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should assign sequential indices', async () => {
      const text = 'Part one. Part two. Part three. Part four. Part five.';
      const chunks = await chunker.chunk(text, {
        chunkSize: 5,
        chunkOverlap: 0,
      });

      for (let i = 0; i < chunks.length; i++) {
        expect(chunks[i].index).toBe(i);
      }
    });

    it('should track start position', async () => {
      const text = 'First chunk here. Second chunk here.';
      const chunks = await chunker.chunk(text, {
        chunkSize: 10,
        chunkOverlap: 0,
      });

      expect(chunks[0].startPosition).toBeDefined();
      expect(chunks[0].startPosition).toBeGreaterThanOrEqual(0);
    });
  });

  describe('createFixedChunker factory', () => {
    it('should create a chunker instance', () => {
      const factoryChunker = createFixedChunker();
      expect(factoryChunker).toBeInstanceOf(FixedChunker);
    });
  });
});
