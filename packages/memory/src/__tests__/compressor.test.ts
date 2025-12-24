import { describe, it, expect, beforeEach } from 'vitest';
import { Compressor } from '../processing/Compressor.js';
import type { MemoryEntry } from '../types/index.js';

function createEntry(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
  return {
    id: `entry-${Date.now()}-${Math.random()}`,
    type: 'context',
    content: 'This is a test memory entry with some content.',
    timestamp: Date.now(),
    importance: 0.5,
    accessCount: 0,
    metadata: {
      source: 'explicit',
      confidence: 1.0,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe('Compressor', () => {
  let compressor: Compressor;

  beforeEach(() => {
    compressor = new Compressor({
      targetRatio: 0.5,
      preserveImportant: true,
      minImportance: 0.3,
      minContentLength: 50,
    });
  });

  describe('compress', () => {
    it('should compress a memory entry', () => {
      const entry = createEntry({
        content:
          'This is a very long content that should be compressed to save space. It contains lots of information that may not be critical for future retrieval.',
      });

      const result = compressor.compress(entry);

      expect(result.compressed.content.length).toBeLessThan(
        entry.content.length,
      );
      expect(result.ratio).toBeLessThan(1);
      expect(result.preservedFields).toBeDefined();
    });

    it('should preserve short content', () => {
      const entry = createEntry({
        content: 'Short',
      });

      const result = compressor.compress(entry);

      expect(result.compressed.content).toBe('Short');
    });

    it('should truncate based on importance', () => {
      const highImportance = createEntry({
        importance: 0.9,
        content: 'A'.repeat(500),
      });
      const lowImportance = createEntry({
        importance: 0.2,
        content: 'B'.repeat(500),
      });

      const highResult = compressor.compress(highImportance);
      const lowResult = compressor.compress(lowImportance);

      expect(highResult.compressed.content.length).toBeGreaterThan(
        lowResult.compressed.content.length,
      );
    });

    it('should remove embeddings if configured', () => {
      const compressorNoEmbed = new Compressor({ removeEmbeddings: true });
      const entry = createEntry({
        embedding: [1, 2, 3, 4, 5],
      });

      const result = compressorNoEmbed.compress(entry);

      expect(result.compressed.embedding).toBeUndefined();
    });

    it('should preserve embeddings by default', () => {
      const entry = createEntry({
        embedding: [1, 2, 3, 4, 5],
      });

      const result = compressor.compress(entry);

      expect(result.compressed.embedding).toEqual([1, 2, 3, 4, 5]);
    });

    it('should truncate metadata', () => {
      const entry = createEntry({
        metadata: {
          source: 'explicit',
          confidence: 1.0,
          customField1: 'value1',
          customField2: 'value2',
          tags: ['tag1', 'tag2'],
        },
      });

      const result = compressor.compress(entry);

      expect(result.compressed.metadata.source).toBeDefined();
      expect(result.compressed.metadata.confidence).toBeDefined();
    });

    it('should calculate compression ratio', () => {
      const entry = createEntry({
        content: 'X'.repeat(200),
        embedding: Array(128).fill(1),
      });

      const result = compressor.compress(entry);

      expect(result.originalSize).toBeGreaterThan(0);
      expect(result.compressedSize).toBeGreaterThan(0);
      expect(result.ratio).toBe(result.compressedSize / result.originalSize);
    });
  });

  describe('compressBatch', () => {
    it('should compress multiple entries', () => {
      const entries = [
        createEntry({ content: 'First entry with content' }),
        createEntry({ content: 'Second entry with more content' }),
        createEntry({ content: 'Third entry with even more content' }),
      ];

      const result = compressor.compressBatch(entries);

      expect(result.entries.length).toBeLessThanOrEqual(entries.length);
      expect(result.totalCompressedSize).toBeLessThanOrEqual(
        result.totalOriginalSize,
      );
      expect(result.avgRatio).toBeLessThanOrEqual(1);
    });

    it('should remove low-importance entries', () => {
      const entries = [
        createEntry({ importance: 0.9, content: 'Important' }),
        createEntry({ importance: 0.1, content: 'Unimportant' }),
        createEntry({ importance: 0.05, content: 'Very unimportant' }),
      ];

      const result = compressor.compressBatch(entries);

      expect(result.removedCount).toBeGreaterThan(0);
      expect(result.entries.length).toBeLessThan(entries.length);
    });

    it('should calculate average compression ratio', () => {
      const entries = Array(10)
        .fill(null)
        .map(() => createEntry({ content: 'X'.repeat(100) }));

      const result = compressor.compressBatch(entries);

      expect(result.avgRatio).toBeGreaterThan(0);
      expect(result.avgRatio).toBeLessThanOrEqual(1);
    });
  });

  describe('compressToSize', () => {
    it('should compress to target size', () => {
      const entries = Array(20)
        .fill(null)
        .map((_, i) =>
          createEntry({
            content: 'Content '.repeat(50),
            importance: i / 20,
          }),
        );

      const targetSize = 10000;
      const result = compressor.compressToSize(entries, targetSize);

      expect(result.totalCompressedSize).toBeLessThanOrEqual(targetSize);
    });

    it('should prioritize important entries', () => {
      const entries = [
        createEntry({
          id: 'important',
          importance: 0.95,
          content: 'X'.repeat(100),
        }),
        createEntry({ id: 'less', importance: 0.3, content: 'Y'.repeat(100) }),
      ];

      const targetSize = 500;
      const result = compressor.compressToSize(entries, targetSize);

      const hasImportant = result.entries.some((e) => e.id === 'important');
      expect(hasImportant).toBe(true);
    });

    it('should use aggressive compression when needed', () => {
      const entries = Array(10)
        .fill(null)
        .map(() =>
          createEntry({
            content: 'Very long content '.repeat(100),
            importance: 0.5,
          }),
        );

      const targetSize = 1000;
      const result = compressor.compressToSize(entries, targetSize);

      expect(result.totalCompressedSize).toBeLessThanOrEqual(targetSize);
      expect(result.removedCount).toBeGreaterThan(0);
    });
  });

  describe('deduplicateAndCompress', () => {
    it('should remove duplicate entries', () => {
      const entries = [
        createEntry({ content: 'Hello world', type: 'fact' }),
        createEntry({ content: 'Hello world', type: 'fact' }),
        createEntry({ content: 'Different content', type: 'fact' }),
      ];

      const result = compressor.deduplicateAndCompress(entries);

      expect(result.removedCount).toBeGreaterThan(0);
      expect(result.entries.length).toBeLessThan(entries.length);
    });

    it('should keep more important duplicates', () => {
      const entries = [
        createEntry({
          id: 'low',
          content: 'Same content',
          importance: 0.3,
          timestamp: 1000,
        }),
        createEntry({
          id: 'high',
          content: 'Same content',
          importance: 0.9,
          timestamp: 2000,
        }),
      ];

      const result = compressor.deduplicateAndCompress(entries);

      expect(result.entries.length).toBe(1);
      expect(result.entries[0].id).toBe('high');
    });

    it('should keep more recent duplicates when importance is equal', () => {
      const entries = [
        createEntry({
          id: 'old',
          content: 'Same content',
          importance: 0.5,
          timestamp: 1000,
        }),
        createEntry({
          id: 'new',
          content: 'Same content',
          importance: 0.5,
          timestamp: 2000,
        }),
      ];

      const result = compressor.deduplicateAndCompress(entries);

      expect(result.entries.length).toBe(1);
      expect(result.entries[0].id).toBe('new');
    });
  });

  describe('content truncation', () => {
    it('should cut at sentence boundary', () => {
      const entry = createEntry({
        content:
          'First sentence. Second sentence. Third sentence. Fourth sentence.',
        importance: 0.5,
      });

      const result = compressor.compress(entry);

      expect(result.compressed.content.endsWith('.')).toBe(true);
    });

    it('should fall back to word boundary', () => {
      const entry = createEntry({
        content: 'This has no sentence endings just words and more words',
        importance: 0.3,
      });

      const result = compressor.compress(entry);

      // Should not cut mid-word
      expect(result.compressed.content.endsWith('...')).toBe(true);
    });

    it('should respect minContentLength', () => {
      const compressorMin = new Compressor({ minContentLength: 30 });
      const entry = createEntry({
        content: 'This is a test',
        importance: 0.1,
      });

      const result = compressorMin.compress(entry);

      expect(result.compressed.content.length).toBeGreaterThanOrEqual(14); // Original length
    });
  });

  describe('configure', () => {
    it('should update configuration', () => {
      compressor.configure({
        targetRatio: 0.3,
        removeEmbeddings: true,
      });

      const entry = createEntry({
        content: 'Test',
        embedding: [1, 2, 3],
      });

      const result = compressor.compress(entry);
      expect(result.compressed.embedding).toBeUndefined();
    });
  });
});
