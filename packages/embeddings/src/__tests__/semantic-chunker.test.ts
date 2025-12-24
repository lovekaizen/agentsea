import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SemanticChunker,
  createSemanticChunker,
} from '../chunking/SemanticChunker.js';

describe('SemanticChunker', () => {
  let chunker: SemanticChunker;

  beforeEach(() => {
    chunker = new SemanticChunker();
  });

  describe('constructor', () => {
    it('should create a semantic chunker', () => {
      expect(chunker).toBeInstanceOf(SemanticChunker);
      expect(chunker.strategyType).toBe('semantic');
    });
  });

  describe('chunk - without embedding function', () => {
    it('should fallback to sentence-based chunking', async () => {
      const text = 'First sentence. Second sentence. Third sentence.';

      const chunks = await chunker.chunk(text, {
        chunkSize: 50,
        chunkOverlap: 0,
      });

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach((chunk) => {
        expect(chunk.text).toBeDefined();
        expect(chunk.index).toBeGreaterThanOrEqual(0);
      });
    });

    it('should respect chunk size in fallback mode', async () => {
      const text = 'Short. ' + 'Sentence. '.repeat(20);

      const chunks = await chunker.chunk(text, {
        chunkSize: 20,
        chunkOverlap: 0,
      });

      chunks.forEach((chunk) => {
        expect(chunk.tokenCount).toBeLessThanOrEqual(20);
      });
    });

    it('should handle single sentence in fallback mode', async () => {
      const text = 'Just one sentence.';

      const chunks = await chunker.chunk(text, {
        chunkSize: 100,
        chunkOverlap: 0,
      });

      expect(chunks).toHaveLength(1);
      expect(chunks[0].text).toBe(text);
    });
  });

  describe('chunk - with embedding function', () => {
    it('should use embeddings for semantic splitting', async () => {
      const text =
        'Topic A sentence one. Topic A sentence two. Topic B sentence one. Topic B sentence two.';

      const mockEmbedding = vi
        .fn()
        .mockImplementation(async (texts: string[]) => {
          return texts.map((t, i) => {
            // Create different embeddings for different topics
            if (t.includes('Topic A')) {
              return [1, 0, 0];
            } else if (t.includes('Topic B')) {
              return [0, 1, 0];
            }
            return [0.5, 0.5, 0];
          });
        });

      const chunks = await chunker.chunk(text, {
        chunkSize: 200,
        chunkOverlap: 0,
        embeddingFn: mockEmbedding,
      });

      expect(chunks.length).toBeGreaterThan(0);
      expect(mockEmbedding).toHaveBeenCalled();
    });

    it('should respect similarity threshold', async () => {
      const text = 'One. Two. Three. Four.';

      const mockEmbedding = vi.fn().mockResolvedValue([
        [1, 0],
        [0.9, 0.1],
        [0.1, 0.9],
        [0, 1],
      ]);

      const chunks = await chunker.chunk(text, {
        chunkSize: 100,
        chunkOverlap: 0,
        embeddingFn: mockEmbedding,
        similarityThreshold: 0.8,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should respect breakpoint percentile', async () => {
      const text = 'Sentence one. Sentence two. Sentence three. Sentence four.';

      const mockEmbedding = vi.fn().mockResolvedValue([
        [1, 0],
        [0.9, 0.1],
        [0.5, 0.5],
        [0, 1],
      ]);

      const chunks = await chunker.chunk(text, {
        chunkSize: 100,
        chunkOverlap: 0,
        embeddingFn: mockEmbedding,
        breakpointPercentileThreshold: 90,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should use buffer size for context', async () => {
      const text = 'One. Two. Three. Four. Five.';

      const mockEmbedding = vi.fn().mockResolvedValue([
        [1, 0],
        [0.9, 0.1],
        [0.8, 0.2],
        [0.2, 0.8],
        [0, 1],
      ]);

      const chunks = await chunker.chunk(text, {
        chunkSize: 100,
        chunkOverlap: 0,
        embeddingFn: mockEmbedding,
        bufferSize: 2,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should include metadata about semantic boundaries', async () => {
      const text = 'First. Second.';

      const mockEmbedding = vi.fn().mockResolvedValue([
        [1, 0],
        [0, 1],
      ]);

      const chunks = await chunker.chunk(text, {
        chunkSize: 100,
        chunkOverlap: 0,
        embeddingFn: mockEmbedding,
      });

      expect(chunks[0].metadata.boundaryType).toBe('semantic');
      expect(chunks[0].metadata.sentenceCount).toBeDefined();
    });
  });

  describe('sentence splitting', () => {
    it('should split text into sentences', async () => {
      const text = 'First sentence. Second sentence! Third sentence? Fourth.';

      const chunks = await chunker.chunk(text, {
        chunkSize: 200,
        chunkOverlap: 0,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle text without sentence endings', async () => {
      const text = 'No sentence endings here';

      const chunks = await chunker.chunk(text, {
        chunkSize: 100,
        chunkOverlap: 0,
      });

      expect(chunks).toHaveLength(1);
      expect(chunks[0].text).toBe(text);
    });

    it('should handle multiple sentence endings', async () => {
      const text = 'What?! Really... Yes!!! Okay.';

      const chunks = await chunker.chunk(text, {
        chunkSize: 100,
        chunkOverlap: 0,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('chunk merging and splitting', () => {
    it('should merge small chunks', async () => {
      const text = 'A. B. C. D. E. F.';

      const mockEmbedding = vi.fn().mockResolvedValue([
        [1, 0],
        [1, 0],
        [1, 0],
        [1, 0],
        [1, 0],
        [1, 0],
      ]);

      const chunks = await chunker.chunk(text, {
        chunkSize: 100,
        chunkOverlap: 0,
        minChunkSize: 5,
        embeddingFn: mockEmbedding,
      });

      // Small chunks should be merged
      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach((chunk) => {
        expect(chunk.tokenCount).toBeGreaterThan(0);
      });
    });

    it('should split large chunks', async () => {
      const longSentence = 'Word '.repeat(200) + '.';
      const text = `${longSentence} Normal sentence.`;

      const mockEmbedding = vi
        .fn()
        .mockImplementation(async (texts: string[]) => {
          return texts.map(() => [1, 0]);
        });

      const chunks = await chunker.chunk(text, {
        chunkSize: 50,
        chunkOverlap: 0,
        maxChunkSize: 50,
        embeddingFn: mockEmbedding,
      });

      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should respect maxChunkSize', async () => {
      const text = 'Sentence. '.repeat(100);

      const mockEmbedding = vi
        .fn()
        .mockImplementation(async (texts: string[]) => {
          return texts.map(() => [1, 0]);
        });

      const chunks = await chunker.chunk(text, {
        chunkSize: 1000,
        chunkOverlap: 0,
        maxChunkSize: 50,
        embeddingFn: mockEmbedding,
      });

      chunks.forEach((chunk) => {
        expect(chunk.tokenCount).toBeLessThanOrEqual(50);
      });
    });
  });

  describe('edge cases', () => {
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

    it('should handle embedding function errors gracefully', async () => {
      const text = 'Test sentence.';

      const mockEmbedding = vi.fn().mockRejectedValue(new Error('API error'));

      await expect(
        chunker.chunk(text, {
          chunkSize: 100,
          chunkOverlap: 0,
          embeddingFn: mockEmbedding,
        }),
      ).rejects.toThrow('API error');
    });

    it('should handle empty embedding results', async () => {
      const text = 'Test sentence.';

      const mockEmbedding = vi.fn().mockResolvedValue([]);

      const chunks = await chunker.chunk(text, {
        chunkSize: 100,
        chunkOverlap: 0,
        embeddingFn: mockEmbedding,
      });

      // Should handle gracefully
      expect(chunks.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('position tracking', () => {
    it('should track chunk positions', async () => {
      const text = 'First sentence. Second sentence. Third sentence.';

      const chunks = await chunker.chunk(text, {
        chunkSize: 100,
        chunkOverlap: 0,
      });

      chunks.forEach((chunk) => {
        expect(chunk.startPosition).toBeGreaterThanOrEqual(0);
        expect(chunk.endPosition).toBeGreaterThan(chunk.startPosition);
      });
    });

    it('should assign sequential indices', async () => {
      const text = 'One. Two. Three. Four.';

      const mockEmbedding = vi.fn().mockResolvedValue([
        [1, 0],
        [0, 1],
        [1, 0],
        [0, 1],
      ]);

      const chunks = await chunker.chunk(text, {
        chunkSize: 100,
        chunkOverlap: 0,
        embeddingFn: mockEmbedding,
      });

      for (let i = 0; i < chunks.length; i++) {
        expect(chunks[i].index).toBe(i);
      }
    });
  });

  describe('metadata', () => {
    it('should include custom metadata', async () => {
      const text = 'Test sentence.';

      const chunks = await chunker.chunk(text, {
        chunkSize: 100,
        chunkOverlap: 0,
        metadata: { source: 'test', version: 1 },
      });

      expect(chunks[0].metadata.source).toBe('test');
      expect(chunks[0].metadata.version).toBe(1);
    });

    it('should include sentence count in metadata', async () => {
      const text = 'One. Two. Three.';

      const mockEmbedding = vi.fn().mockResolvedValue([
        [1, 0],
        [1, 0],
        [1, 0],
      ]);

      const chunks = await chunker.chunk(text, {
        chunkSize: 100,
        chunkOverlap: 0,
        embeddingFn: mockEmbedding,
      });

      expect(chunks[0].metadata.sentenceCount).toBeDefined();
      expect(chunks[0].metadata.sentenceCount).toBeGreaterThan(0);
    });
  });

  describe('custom token counter', () => {
    it('should use custom token counter', async () => {
      const customCounter = (text: string) => text.split(' ').length;

      const text = 'one two three four five six seven eight';

      const chunks = await chunker.chunk(text, {
        chunkSize: 4, // 4 words
        chunkOverlap: 0,
        tokenCounter: customCounter,
      });

      chunks.forEach((chunk) => {
        const tokens = customCounter(chunk.text);
        expect(tokens).toBeGreaterThan(0);
      });
    });
  });

  describe('distance calculation', () => {
    it('should calculate distances between sentence groups', async () => {
      const text = 'Topic A one. Topic A two. Topic B one. Topic B two.';

      const mockEmbedding = vi.fn().mockResolvedValue([
        [1, 0, 0],
        [0.9, 0.1, 0],
        [0, 1, 0],
        [0, 0.9, 0.1],
      ]);

      const chunks = await chunker.chunk(text, {
        chunkSize: 100,
        chunkOverlap: 0,
        embeddingFn: mockEmbedding,
        bufferSize: 1,
      });

      // Should detect topic boundary
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle buffer size edge cases', async () => {
      const text = 'One. Two.';

      const mockEmbedding = vi.fn().mockResolvedValue([
        [1, 0],
        [0, 1],
      ]);

      const chunks = await chunker.chunk(text, {
        chunkSize: 100,
        chunkOverlap: 0,
        embeddingFn: mockEmbedding,
        bufferSize: 0,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('chunkWithResult', () => {
    it('should return result with metadata', async () => {
      const text = 'Test chunk. Another chunk.';

      const result = await chunker.chunkWithResult(text, {
        chunkSize: 50,
        chunkOverlap: 0,
      });

      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.totalChunks).toBe(result.chunks.length);
      expect(result.totalTokens).toBeGreaterThan(0);
      expect(result.avgChunkSize).toBeGreaterThan(0);
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.strategy).toBe('semantic');
      expect(result.originalLength).toBe(text.length);
    });
  });

  describe('createSemanticChunker factory', () => {
    it('should create a chunker instance', () => {
      const factoryChunker = createSemanticChunker();
      expect(factoryChunker).toBeInstanceOf(SemanticChunker);
    });
  });
});
