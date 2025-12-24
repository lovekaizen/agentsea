/**
 * Base Chunker
 *
 * Abstract base class for chunking strategies.
 */

import { nanoid } from 'nanoid';
import type {
  Chunker,
  ChunkingStrategy,
  ChunkingOptions,
  Chunk,
  ChunkMetadata,
  Element,
  TokenCounter,
} from '../types/index.js';

/**
 * Default token counter (rough estimate: ~4 characters per token)
 */
const DEFAULT_TOKEN_COUNTER: TokenCounter = (text: string) =>
  Math.ceil(text.length / 4);

/**
 * Abstract base chunker class
 */
export abstract class BaseChunker implements Chunker {
  abstract readonly name: string;
  abstract readonly strategy: ChunkingStrategy;

  protected tokenCounter: TokenCounter;

  constructor(tokenCounter?: TokenCounter) {
    this.tokenCounter = tokenCounter ?? DEFAULT_TOKEN_COUNTER;
  }

  /**
   * Chunk text content
   */
  abstract chunk(
    text: string,
    options?: ChunkingOptions,
  ): Chunk[] | Promise<Chunk[]>;

  /**
   * Chunk document elements
   */
  chunkElements(
    elements: Element[],
    options?: ChunkingOptions,
  ): Chunk[] | Promise<Chunk[]> {
    // Default implementation: extract text from elements and chunk
    const text = this.extractTextFromElements(elements);
    const result = this.chunk(text, options);

    // Helper to enrich chunks with element metadata
    const enrichChunks = (chunks: Chunk[]): Chunk[] =>
      chunks.map((chunk) => ({
        ...chunk,
        metadata: {
          ...chunk.metadata,
          elementType: this.findElementTypeForChunk(chunk, elements),
        },
      }));

    // Handle both sync and async chunk results
    if (Array.isArray(result)) {
      return enrichChunks(result);
    }
    return result.then(enrichChunks);
  }

  /**
   * Estimate chunk count
   */
  estimateChunks(text: string, options?: ChunkingOptions): number {
    const maxTokens = options?.maxTokens ?? 512;
    const overlap = options?.overlap ?? 0;
    const totalTokens = this.tokenCounter(text);
    const effectiveChunkSize = maxTokens - overlap;

    if (effectiveChunkSize <= 0) return 1;
    return Math.ceil(totalTokens / effectiveChunkSize);
  }

  /**
   * Create a chunk
   */
  protected createChunk(
    text: string,
    documentId: string,
    index: number,
    metadata: Partial<ChunkMetadata> = {},
  ): Chunk {
    return {
      id: nanoid(),
      documentId,
      text,
      tokenCount: this.tokenCounter(text),
      metadata: {
        index,
        ...metadata,
      },
    };
  }

  /**
   * Extract text from elements
   */
  protected extractTextFromElements(elements: Element[]): string {
    return elements
      .map((el) => {
        if (el.children && el.children.length > 0) {
          return this.extractTextFromElements(el.children);
        }
        return el.text;
      })
      .join('\n\n');
  }

  /**
   * Find element type for a chunk based on text overlap
   */
  protected findElementTypeForChunk(
    chunk: Chunk,
    elements: Element[],
  ): Element['type'] | undefined {
    const chunkText = chunk.text.slice(0, 100).toLowerCase();

    for (const element of elements) {
      if (element.text.toLowerCase().includes(chunkText)) {
        return element.type;
      }
    }

    return undefined;
  }

  /**
   * Split text at sentence boundaries
   */
  protected splitAtSentenceBoundaries(text: string): string[] {
    // Split on sentence-ending punctuation followed by whitespace
    const sentences = text.split(/(?<=[.!?])\s+/);
    return sentences.filter((s) => s.trim().length > 0);
  }

  /**
   * Split text at paragraph boundaries
   */
  protected splitAtParagraphBoundaries(text: string): string[] {
    return text.split(/\n\n+/).filter((p) => p.trim().length > 0);
  }

  /**
   * Merge chunks to target size
   */
  protected mergeToTargetSize(
    texts: string[],
    maxTokens: number,
    separator = '\n\n',
  ): string[] {
    const merged: string[] = [];
    let current = '';

    for (const text of texts) {
      const combined = current ? `${current}${separator}${text}` : text;
      const combinedTokens = this.tokenCounter(combined);

      if (combinedTokens <= maxTokens) {
        current = combined;
      } else {
        if (current) {
          merged.push(current);
        }
        current = text;
      }
    }

    if (current) {
      merged.push(current);
    }

    return merged;
  }

  /**
   * Apply overlap between chunks
   */
  protected applyOverlap(chunks: string[], overlapTokens: number): string[] {
    if (overlapTokens <= 0 || chunks.length <= 1) {
      return chunks;
    }

    const result: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      let chunk = chunks[i];

      // Add overlap from previous chunk
      if (i > 0) {
        const prevChunk = chunks[i - 1];
        const prevWords = prevChunk.split(/\s+/);
        const overlapChars = overlapTokens * 4; // Rough estimate
        let overlapText = '';

        for (let j = prevWords.length - 1; j >= 0; j--) {
          const word = prevWords[j];
          if ((overlapText + word).length <= overlapChars) {
            overlapText = word + (overlapText ? ' ' + overlapText : '');
          } else {
            break;
          }
        }

        if (overlapText) {
          chunk = overlapText + '\n\n' + chunk;
        }
      }

      result.push(chunk);
    }

    return result;
  }
}
