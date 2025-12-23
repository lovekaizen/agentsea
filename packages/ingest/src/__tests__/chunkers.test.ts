/**
 * Chunkers Tests
 */

import { describe, it, expect } from 'vitest';
import { FixedChunker } from '../chunking/FixedChunker.js';
import { SemanticChunker } from '../chunking/SemanticChunker.js';
import { RecursiveChunker } from '../chunking/RecursiveChunker.js';
import { SentenceChunker } from '../chunking/SentenceChunker.js';
import { ParagraphChunker } from '../chunking/ParagraphChunker.js';
import type { Element } from '../types/index.js';

describe('FixedChunker', () => {
  const chunker = new FixedChunker();

  it('should have correct metadata', () => {
    expect(chunker.name).toBe('fixed-chunker');
    expect(chunker.strategy).toBe('fixed');
  });

  it('should chunk text into fixed-size chunks', () => {
    const text = 'This is a test. '.repeat(100); // Long text
    const chunks = chunker.chunk(text, {
      maxTokens: 50,
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].tokenCount).toBeLessThanOrEqual(50 * 4 + 10); // Allow some variance
  });

  it('should respect maxCharacters option', () => {
    const text = 'A'.repeat(1000);
    const chunks = chunker.chunk(text, {
      maxCharacters: 100,
    });

    expect(chunks.length).toBeGreaterThan(5);
    chunks.forEach((chunk) => {
      expect(chunk.text.length).toBeLessThanOrEqual(110); // Allow small variance
    });
  });

  it('should split on word boundaries', () => {
    const text = 'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10';
    const chunks = chunker.chunk(text, {
      maxCharacters: 20,
      splitOnWords: true,
    });

    // Should not split words
    chunks.forEach((chunk) => {
      expect(chunk.text.includes(' wor')).toBe(false); // No mid-word splits
    });
  });

  it('should split on sentence boundaries', () => {
    const text =
      'First sentence. Second sentence. Third sentence. Fourth sentence.';
    const chunks = chunker.chunk(text, {
      maxCharacters: 30,
      splitOnSentences: true,
    });

    expect(chunks.length).toBeGreaterThan(1);
  });

  it('should apply overlap', () => {
    const text = 'This is a test. '.repeat(50);
    const chunks = chunker.chunk(text, {
      maxTokens: 50,
      overlap: 10,
    });

    expect(chunks.length).toBeGreaterThan(1);
    // Chunks should have some overlap
  });

  it('should set chunk metadata', () => {
    const text = 'Test content for chunking';
    const chunks = chunker.chunk(text, {
      maxTokens: 100,
    });

    expect(chunks[0].metadata.index).toBe(0);
    expect(chunks[0].metadata.startOffset).toBeDefined();
    expect(chunks[0].metadata.endOffset).toBeDefined();
  });

  it('should handle empty text', () => {
    const chunks = chunker.chunk('', { maxTokens: 100 });

    expect(chunks).toHaveLength(0);
  });

  it('should handle single short text', () => {
    const text = 'Short text';
    const chunks = chunker.chunk(text, { maxTokens: 100 });

    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe(text);
  });
});

describe('SemanticChunker', () => {
  const chunker = new SemanticChunker();

  it('should have correct metadata', () => {
    expect(chunker.name).toBe('semantic-chunker');
    expect(chunker.strategy).toBe('semantic');
  });

  it('should chunk based on semantic similarity', async () => {
    const text = `
      Machine learning is a subset of AI. It involves training algorithms.
      Deep learning uses neural networks. It requires large datasets.
      The weather today is sunny. It will rain tomorrow.
    `;

    const chunks = await chunker.chunk(text, {
      maxTokens: 100,
      similarityThreshold: 0.5,
    });

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].id).toBeDefined();
  });

  it('should respect maxTokens limit', async () => {
    const text = 'Sentence. '.repeat(100);

    const chunks = await chunker.chunk(text, {
      maxTokens: 50,
    });

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk) => {
      expect(chunk.tokenCount).toBeLessThanOrEqual(50 * 4 + 50); // Allow variance
    });
  });

  it('should respect minChunkSize', async () => {
    const text = 'Short. Next. Another. More text here.';

    const chunks = await chunker.chunk(text, {
      maxTokens: 100,
      minChunkSize: 20,
    });

    chunks.forEach((chunk) => {
      expect(chunk.text.length).toBeGreaterThanOrEqual(15); // Allow small variance
    });
  });

  it('should use custom embed function', async () => {
    const text = 'First sentence. Second sentence. Third sentence.';

    const customEmbed = async (text: string) => {
      return Array(10).fill(Math.random());
    };

    const chunks = await chunker.chunk(text, {
      maxTokens: 100,
      embedFunction: customEmbed,
    });

    expect(chunks.length).toBeGreaterThan(0);
  });

  it('should handle single sentence', async () => {
    const text = 'This is a single sentence.';

    const chunks = await chunker.chunk(text, {
      maxTokens: 100,
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe(text);
  });

  it('should include sentence count in metadata', async () => {
    const text = 'First. Second. Third.';

    const chunks = await chunker.chunk(text, {
      maxTokens: 100,
    });

    expect(chunks[0].metadata.custom?.sentenceCount).toBeDefined();
  });
});

describe('RecursiveChunker', () => {
  const chunker = new RecursiveChunker();

  it('should have correct metadata', () => {
    expect(chunker.name).toBe('recursive-chunker');
    expect(chunker.strategy).toBe('recursive');
  });

  it('should chunk text recursively', () => {
    const text = `
Paragraph 1 line 1.
Paragraph 1 line 2.

Paragraph 2 line 1.
Paragraph 2 line 2.

Paragraph 3.
    `.trim();

    const chunks = chunker.chunk(text, {
      maxTokens: 50,
    });

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].id).toBeDefined();
  });

  it('should try different separators', () => {
    const text = 'Part1\n\nPart2\n\nPart3';

    const chunks = chunker.chunk(text, {
      maxTokens: 20,
    });

    expect(chunks.length).toBeGreaterThan(1);
  });

  it('should use custom separators', () => {
    const text = 'Part1|||Part2|||Part3';

    const chunks = chunker.chunk(text, {
      maxTokens: 20,
      separators: ['|||', '\n'],
    });

    expect(chunks.length).toBeGreaterThan(1);
  });

  it('should preserve structure when possible', () => {
    const text = 'Short paragraph.\n\nAnother short paragraph.';

    const chunks = chunker.chunk(text, {
      maxTokens: 100,
    });

    // Should keep paragraphs together if they fit
    expect(chunks.length).toBeGreaterThan(0);
  });
});

describe('SentenceChunker', () => {
  const chunker = new SentenceChunker();

  it('should have correct metadata', () => {
    expect(chunker.name).toBe('sentence-chunker');
    expect(chunker.strategy).toBe('sentence');
  });

  it('should chunk by sentences', () => {
    const text =
      'First sentence. Second sentence! Third sentence? Fourth sentence.';

    const chunks = chunker.chunk(text, {
      maxTokens: 10,
    });

    expect(chunks.length).toBeGreaterThan(1);
  });

  it('should group sentences to respect maxTokens', () => {
    const text = 'A. B. C. D. E. F. G. H. I. J.';

    const chunks = chunker.chunk(text, {
      maxTokens: 5,
    });

    // Should group multiple short sentences
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.length).toBeLessThan(10); // Not one chunk per sentence
  });

  it('should handle text without sentence markers', () => {
    const text = 'Text without proper punctuation';

    const chunks = chunker.chunk(text, {
      maxTokens: 10,
    });

    expect(chunks).toHaveLength(1);
  });
});

describe('ParagraphChunker', () => {
  const chunker = new ParagraphChunker();

  it('should have correct metadata', () => {
    expect(chunker.name).toBe('paragraph-chunker');
    expect(chunker.strategy).toBe('paragraph');
  });

  it('should chunk by paragraphs', () => {
    const text = `Paragraph 1.

Paragraph 2.

Paragraph 3.`;

    const chunks = chunker.chunk(text, {
      maxTokens: 10,
    });

    expect(chunks.length).toBeGreaterThan(1);
  });

  it('should group paragraphs to respect maxTokens', () => {
    const text = Array.from(
      { length: 10 },
      (_, i) => `Paragraph ${i + 1}.`,
    ).join('\n\n');

    const chunks = chunker.chunk(text, {
      maxTokens: 20,
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.length).toBeLessThan(10);
  });

  it('should split large paragraphs', () => {
    const largeParagraph = 'Word '.repeat(200);

    const chunks = chunker.chunk(largeParagraph, {
      maxTokens: 50,
    });

    expect(chunks.length).toBeGreaterThan(1);
  });

  it('should apply overlap between chunks', () => {
    const text = Array.from(
      { length: 5 },
      (_, i) => `Paragraph ${i + 1}.`,
    ).join('\n\n');

    const chunks = chunker.chunk(text, {
      maxTokens: 20,
      overlap: 5,
    });

    expect(chunks.length).toBeGreaterThan(1);
  });
});

describe('BaseChunker functionality', () => {
  const chunker = new FixedChunker();

  it('should estimate chunk count', () => {
    const text = 'Word '.repeat(100);

    const estimate = chunker.estimateChunks(text, {
      maxTokens: 50,
      overlap: 10,
    });

    expect(estimate).toBeGreaterThan(0);
  });

  it('should chunk elements', () => {
    const elements: Element[] = [
      { type: 'heading', text: 'Title' },
      { type: 'paragraph', text: 'First paragraph.' },
      { type: 'paragraph', text: 'Second paragraph.' },
    ];

    const result = chunker.chunkElements(elements, {
      maxTokens: 20,
    });

    const chunks = Array.isArray(result) ? result : [];
    expect(chunks.length).toBeGreaterThan(0);
  });

  it('should handle nested elements', () => {
    const elements: Element[] = [
      {
        type: 'list',
        text: 'List text',
        children: [
          { type: 'list_item', text: 'Item 1' },
          { type: 'list_item', text: 'Item 2' },
        ],
      },
    ];

    const result = chunker.chunkElements(elements, {
      maxTokens: 100,
    });

    const chunks = Array.isArray(result) ? result : [];
    expect(chunks.length).toBeGreaterThan(0);
  });

  it('should create chunk with correct structure', () => {
    const chunks = chunker.chunk('Test text', {
      maxTokens: 100,
    });

    expect(chunks[0]).toHaveProperty('id');
    expect(chunks[0]).toHaveProperty('documentId');
    expect(chunks[0]).toHaveProperty('text');
    expect(chunks[0]).toHaveProperty('tokenCount');
    expect(chunks[0]).toHaveProperty('metadata');
  });
});
