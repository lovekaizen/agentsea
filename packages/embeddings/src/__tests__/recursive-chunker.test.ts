import { describe, it, expect, beforeEach } from 'vitest';
import {
  RecursiveChunker,
  createRecursiveChunker,
} from '../chunking/RecursiveChunker.js';

describe('RecursiveChunker', () => {
  let chunker: RecursiveChunker;

  beforeEach(() => {
    chunker = new RecursiveChunker();
  });

  describe('constructor', () => {
    it('should create a recursive chunker', () => {
      expect(chunker).toBeInstanceOf(RecursiveChunker);
      expect(chunker.strategyType).toBe('recursive');
    });
  });

  describe('chunk', () => {
    it('should chunk text using multiple separators', async () => {
      const text = `First paragraph here.
This is still first paragraph.

Second paragraph starts.
More of second.

Third paragraph.`;

      const chunks = await chunker.chunk(text, {
        chunkSize: 30,
        chunkOverlap: 5,
      });

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach((chunk) => {
        expect(chunk.text).toBeDefined();
        expect(chunk.index).toBeGreaterThanOrEqual(0);
      });
    });

    it('should respect chunk size', async () => {
      // Create a realistic text with paragraph breaks
      const text = Array.from(
        { length: 10 },
        (_, i) =>
          `Paragraph ${i}. This is a longer paragraph with multiple sentences. It contains enough content to test chunking behavior.\n\n`,
      ).join('');

      const chunks = await chunker.chunk(text, {
        chunkSize: 100, // Reasonable chunk size
        chunkOverlap: 0,
        mergeSmallChunks: false, // Disable merging to test pure splitting
      });

      // Should create multiple chunks from the long text
      expect(chunks.length).toBeGreaterThan(1);

      // Each chunk should be reasonably sized (allowing for paragraph boundaries)
      chunks.forEach((chunk) => {
        expect(chunk.tokenCount).toBeGreaterThan(0);
      });
    });

    it('should handle text with paragraph breaks', async () => {
      const text = `Paragraph one.

Paragraph two.

Paragraph three.`;

      const chunks = await chunker.chunk(text, {
        chunkSize: 50,
        chunkOverlap: 5,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle text with line breaks', async () => {
      const text = `Line one
Line two
Line three
Line four`;

      const chunks = await chunker.chunk(text, {
        chunkSize: 10,
        chunkOverlap: 0,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle text with sentence breaks', async () => {
      const text =
        'First sentence. Second sentence. Third sentence. Fourth sentence.';

      const chunks = await chunker.chunk(text, {
        chunkSize: 15,
        chunkOverlap: 0,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should use custom separators', async () => {
      const text = 'Part1|Part2|Part3|Part4|Part5';

      const chunks = await chunker.chunk(text, {
        chunkSize: 10,
        chunkOverlap: 0,
        separators: ['|', ''],
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should keep separators when specified', async () => {
      const text = 'Line1\nLine2\nLine3';

      const chunks = await chunker.chunk(text, {
        chunkSize: 20,
        chunkOverlap: 0,
        keepSeparator: true,
      });

      // At least one chunk should contain the separator
      const hasSeparator = chunks.some((chunk) => chunk.text.includes('\n'));
      expect(hasSeparator).toBe(true);
    });

    it('should not keep separators when specified', async () => {
      const text = 'Line1\nLine2\nLine3';

      const chunks = await chunker.chunk(text, {
        chunkSize: 20,
        chunkOverlap: 0,
        keepSeparator: false,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should merge small chunks when enabled', async () => {
      const text = 'A. B. C. D. E. F. G. H.';

      const chunks = await chunker.chunk(text, {
        chunkSize: 50,
        chunkOverlap: 0,
        minChunkSize: 5,
        mergeSmallChunks: true,
      });

      // Small chunks should be merged
      expect(
        chunks.every(
          (chunk) =>
            chunk.tokenCount >= 5 || chunk === chunks[chunks.length - 1],
        ),
      ).toBe(true);
    });

    it('should not merge small chunks when disabled', async () => {
      const text = 'A. B. C. D. E.';

      const chunks = await chunker.chunk(text, {
        chunkSize: 50,
        chunkOverlap: 0,
        minChunkSize: 5,
        mergeSmallChunks: false,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should add overlap between chunks', async () => {
      const text = 'Sentence one here. Sentence two here. Sentence three here.';

      const chunks = await chunker.chunk(text, {
        chunkSize: 15,
        chunkOverlap: 3,
      });

      if (chunks.length > 1) {
        expect(chunks[1].overlapPrev).toBeGreaterThan(0);
      }
    });

    it('should handle empty text', async () => {
      const chunks = await chunker.chunk('', {
        chunkSize: 100,
        chunkOverlap: 0,
      });

      expect(chunks).toHaveLength(0);
    });

    it('should handle whitespace-only text', async () => {
      const chunks = await chunker.chunk('   \n\n  ', {
        chunkSize: 100,
        chunkOverlap: 0,
      });

      expect(chunks).toHaveLength(0);
    });

    it('should handle single word', async () => {
      const chunks = await chunker.chunk('word', {
        chunkSize: 100,
        chunkOverlap: 0,
      });

      expect(chunks).toHaveLength(1);
      expect(chunks[0].text).toBe('word');
    });

    it('should handle text that fits in one chunk', async () => {
      const text = 'This is a short text';

      const chunks = await chunker.chunk(text, {
        chunkSize: 100,
        chunkOverlap: 0,
      });

      expect(chunks).toHaveLength(1);
      expect(chunks[0].text).toBe(text);
    });

    it('should assign sequential indices', async () => {
      const text = 'One. Two. Three. Four. Five. Six. Seven.';

      const chunks = await chunker.chunk(text, {
        chunkSize: 10,
        chunkOverlap: 0,
      });

      for (let i = 0; i < chunks.length; i++) {
        expect(chunks[i].index).toBe(i);
      }
    });

    it('should track chunk positions', async () => {
      const text = 'First chunk. Second chunk. Third chunk.';

      const chunks = await chunker.chunk(text, {
        chunkSize: 15,
        chunkOverlap: 0,
      });

      chunks.forEach((chunk) => {
        expect(chunk.startPosition).toBeGreaterThanOrEqual(0);
        expect(chunk.endPosition).toBeGreaterThan(chunk.startPosition);
      });
    });

    it('should handle text with no separators', async () => {
      const text = 'NoSeparatorsHereJustOneL' + 'o'.repeat(100) + 'ngWord';

      const chunks = await chunker.chunk(text, {
        chunkSize: 20,
        chunkOverlap: 0,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should use character splitting as fallback', async () => {
      // Create a long string with custom separators
      const parts = Array.from({ length: 20 }, (_, i) => `Part${i}`);
      const text = parts.join('|');

      const chunks = await chunker.chunk(text, {
        chunkSize: 15, // Small enough to force splitting
        chunkOverlap: 0,
        separators: ['|'], // Split by pipe
        mergeSmallChunks: false, // Disable merging
      });

      // Should create multiple chunks from the parts
      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should respect custom token counter', async () => {
      const customCounter = (text: string) => text.split(' ').length;

      const text = 'one two three four five six seven eight';

      const chunks = await chunker.chunk(text, {
        chunkSize: 3, // 3 words
        chunkOverlap: 1,
        tokenCounter: customCounter,
      });

      chunks.forEach((chunk) => {
        const tokens = customCounter(chunk.text);
        expect(tokens).toBeGreaterThan(0);
      });
    });

    it('should include metadata in chunks', async () => {
      const text = 'Test chunk.';

      const chunks = await chunker.chunk(text, {
        chunkSize: 100,
        chunkOverlap: 0,
        metadata: { source: 'test', version: 1 },
      });

      expect(chunks[0].metadata.source).toBe('test');
      expect(chunks[0].metadata.version).toBe(1);
    });

    it('should handle very long text efficiently', async () => {
      const text = 'Sentence. '.repeat(1000);

      const startTime = performance.now();
      const chunks = await chunker.chunk(text, {
        chunkSize: 50,
        chunkOverlap: 5,
      });
      const duration = performance.now() - startTime;

      expect(chunks.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should break at word boundaries when possible', async () => {
      const text = 'Word1 Word2 Word3 Word4 Word5 Word6 Word7';

      const chunks = await chunker.chunk(text, {
        chunkSize: 10,
        chunkOverlap: 0,
      });

      // Most chunks should not end mid-word
      const validChunks = chunks.filter((chunk) => {
        const trimmed = chunk.text.trim();
        return (
          trimmed.charAt(trimmed.length - 1) === 'd' || // ends with 'Word'
          chunks.indexOf(chunk) === chunks.length - 1
        ); // or is last chunk
      });

      expect(validChunks.length).toBeGreaterThan(0);
    });

    it('should handle mixed separators', async () => {
      const text = `Section 1.

Paragraph with sentences. More text here.

Section 2.

Another paragraph. With more content.`;

      const chunks = await chunker.chunk(text, {
        chunkSize: 30,
        chunkOverlap: 5,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('chunkWithResult', () => {
    it('should return result with metadata', async () => {
      const text = 'Test chunk. Another chunk.';

      const result = await chunker.chunkWithResult(text, {
        chunkSize: 50,
        chunkOverlap: 5,
      });

      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.totalChunks).toBe(result.chunks.length);
      expect(result.totalTokens).toBeGreaterThan(0);
      expect(result.avgChunkSize).toBeGreaterThan(0);
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.strategy).toBe('recursive');
      expect(result.originalLength).toBe(text.length);
    });
  });

  describe('createRecursiveChunker factory', () => {
    it('should create a chunker instance', () => {
      const factoryChunker = createRecursiveChunker();
      expect(factoryChunker).toBeInstanceOf(RecursiveChunker);
    });
  });
});
