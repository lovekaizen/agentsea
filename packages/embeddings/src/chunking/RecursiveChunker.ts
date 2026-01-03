/**
 * RecursiveChunker
 *
 * Recursively splits text using multiple separators.
 */

import {
  BaseChunker,
  defaultTokenCounter,
  mergeSmallChunks,
} from './BaseChunker.js';
import type {
  Chunk,
  ChunkingStrategyType,
  RecursiveChunkingOptions,
} from '../types/index.js';

/**
 * Default separators for recursive splitting
 */
const DEFAULT_SEPARATORS = [
  '\n\n', // Paragraphs
  '\n', // Lines
  '. ', // Sentences
  ', ', // Clauses
  ' ', // Words
  '', // Characters
];

/**
 * Recursive text chunker
 */
export class RecursiveChunker extends BaseChunker {
  readonly strategyType: ChunkingStrategyType = 'recursive';

  async chunk(
    text: string,
    options?: RecursiveChunkingOptions,
  ): Promise<Chunk[]> {
    const opts = this.getOptions(options) as Required<RecursiveChunkingOptions>;
    const separators = options?.separators ?? DEFAULT_SEPARATORS;
    const keepSeparator = options?.keepSeparator ?? true;
    const mergeSmall = options?.mergeSmallChunks ?? true;
    const tokenCounter = opts.tokenCounter ?? defaultTokenCounter;

    // Recursively split the text
    const texts = this.splitRecursively(
      text,
      separators,
      opts.chunkSize,
      keepSeparator,
      tokenCounter,
    );

    // Create chunks
    let position = 0;
    let chunks: Chunk[] = [];

    for (let i = 0; i < texts.length; i++) {
      const chunkText = texts[i].trim();
      if (chunkText) {
        chunks.push(this.createChunk(chunkText, i, position, opts));
        position += texts[i].length;
      }
    }

    // Merge small chunks if enabled
    if (mergeSmall) {
      chunks = mergeSmallChunks(chunks, opts.minChunkSize, tokenCounter);
    }

    // Add overlap between chunks
    chunks = this.addOverlap(chunks, opts.chunkOverlap, tokenCounter);

    return Promise.resolve(chunks);
  }

  /**
   * Recursively split text
   */
  private splitRecursively(
    text: string,
    separators: string[],
    chunkSize: number,
    keepSeparator: boolean,
    tokenCounter: (text: string) => number,
  ): string[] {
    // Base case: text fits in chunk size
    if (tokenCounter(text) <= chunkSize) {
      return [text];
    }

    // Try each separator in order
    for (let i = 0; i < separators.length; i++) {
      const separator = separators[i];

      if (separator === '') {
        // Character-level split as last resort
        return this.splitByChars(text, chunkSize, tokenCounter);
      }

      if (!text.includes(separator)) {
        continue;
      }

      const splits = this.splitBySeparator(text, separator, keepSeparator);
      const result: string[] = [];

      for (const split of splits) {
        if (tokenCounter(split) <= chunkSize) {
          result.push(split);
        } else {
          // Recursively split with remaining separators
          const subSplits = this.splitRecursively(
            split,
            separators.slice(i + 1),
            chunkSize,
            keepSeparator,
            tokenCounter,
          );
          result.push(...subSplits);
        }
      }

      return result;
    }

    // Fallback: character split
    return this.splitByChars(text, chunkSize, tokenCounter);
  }

  /**
   * Split by separator
   */
  private splitBySeparator(
    text: string,
    separator: string,
    keepSeparator: boolean,
  ): string[] {
    if (keepSeparator) {
      // Keep separator at end of each part
      const parts = text.split(separator);
      return parts
        .map((part, i) => (i < parts.length - 1 ? part + separator : part))
        .filter((p) => p.trim());
    } else {
      return text.split(separator).filter((p) => p.trim());
    }
  }

  /**
   * Split by characters (last resort)
   */
  private splitByChars(
    text: string,
    chunkSize: number,
    tokenCounter: (text: string) => number,
  ): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      let end = start;

      // Expand until we hit chunk size
      while (
        end < text.length &&
        tokenCounter(text.slice(start, end)) < chunkSize
      ) {
        end++;
      }

      // Try to break at word boundary
      if (end < text.length) {
        const lastSpace = text.lastIndexOf(' ', end);
        if (lastSpace > start) {
          end = lastSpace;
        }
      }

      chunks.push(text.slice(start, end));
      start = end;
    }

    return chunks.filter((c) => c.trim());
  }

  /**
   * Add overlap between chunks
   */
  private addOverlap(
    chunks: Chunk[],
    overlapTokens: number,
    tokenCounter: (text: string) => number,
  ): Chunk[] {
    if (overlapTokens <= 0 || chunks.length <= 1) {
      return chunks;
    }

    const result: Chunk[] = [];

    for (let i = 0; i < chunks.length; i++) {
      let chunkText = chunks[i].text;
      let startOffset = 0;

      // Add overlap from previous chunk
      if (i > 0) {
        const prevText = chunks[i - 1].text;
        const overlapText = this.getEndOverlap(
          prevText,
          overlapTokens,
          tokenCounter,
        );
        if (overlapText) {
          chunkText = overlapText + ' ' + chunkText;
          startOffset = -overlapText.length - 1;
        }
      }

      result.push({
        ...chunks[i],
        text: chunkText,
        startPosition: chunks[i].startPosition + startOffset,
        tokenCount: tokenCounter(chunkText),
        charCount: chunkText.length,
        overlapPrev: i > 0 ? overlapTokens : 0,
        overlapNext: i < chunks.length - 1 ? overlapTokens : 0,
      });
    }

    return result;
  }

  /**
   * Get overlap text from end of string
   */
  private getEndOverlap(
    text: string,
    overlapTokens: number,
    tokenCounter: (text: string) => number,
  ): string {
    const words = text.split(/\s+/);
    let overlap = '';
    let tokens = 0;

    for (let i = words.length - 1; i >= 0; i--) {
      const testOverlap = words[i] + (overlap ? ' ' + overlap : '');
      tokens = tokenCounter(testOverlap);

      if (tokens > overlapTokens) {
        break;
      }

      overlap = testOverlap;
    }

    return overlap;
  }
}

/**
 * Create a recursive chunker
 */
export function createRecursiveChunker(): RecursiveChunker {
  return new RecursiveChunker();
}
