/**
 * Recursive Chunker
 *
 * Recursive text splitting chunking strategy (similar to LangChain's RecursiveCharacterTextSplitter).
 */

import type { Chunk, RecursiveChunkingOptions } from '../types/index.js';
import { BaseChunker } from './BaseChunker.js';

/**
 * Default separators in order of preference
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
 * Recursive chunker implementation
 */
export class RecursiveChunker extends BaseChunker {
  readonly name = 'recursive-chunker';
  readonly strategy = 'recursive' as const;

  /**
   * Chunk text recursively with multiple separators
   */
  chunk(text: string, options?: RecursiveChunkingOptions): Chunk[] {
    const maxTokens = options?.maxTokens ?? 512;
    const maxChars = options?.maxCharacters ?? maxTokens * 4;
    const overlap = options?.overlap ?? 0;
    const separators = options?.separators ?? DEFAULT_SEPARATORS;
    const keepSeparator = options?.keepSeparator ?? true;
    const minChunkSize = options?.minChunkSize ?? 10;
    const documentId = '';

    // Recursively split text
    const splits = this.recursiveSplit(
      text,
      separators,
      maxChars,
      keepSeparator,
    );

    // Merge small chunks
    const merged = this.mergeSplits(splits, maxChars, minChunkSize);

    // Apply overlap
    const withOverlap =
      overlap > 0 ? this.applyOverlap(merged, overlap) : merged;

    // Create chunk objects
    return withOverlap.map((chunkText, index) =>
      this.createChunk(chunkText, documentId, index),
    );
  }

  /**
   * Recursively split text using separators
   */
  private recursiveSplit(
    text: string,
    separators: string[],
    maxChars: number,
    keepSeparator: boolean,
  ): string[] {
    // Base case: text is small enough
    if (text.length <= maxChars) {
      return [text];
    }

    // Try each separator in order
    for (let i = 0; i < separators.length; i++) {
      const separator = separators[i];

      // Check if separator exists in text
      if (separator === '' || text.includes(separator)) {
        const splits = this.splitBySeparator(text, separator, keepSeparator);

        const result: string[] = [];
        for (const split of splits) {
          if (split.length <= maxChars) {
            result.push(split);
          } else {
            // Recursively split with remaining separators
            const subSplits = this.recursiveSplit(
              split,
              separators.slice(i + 1),
              maxChars,
              keepSeparator,
            );
            result.push(...subSplits);
          }
        }

        return result;
      }
    }

    // Fallback: split by characters
    return this.splitByCharacters(text, maxChars);
  }

  /**
   * Split text by separator
   */
  private splitBySeparator(
    text: string,
    separator: string,
    keepSeparator: boolean,
  ): string[] {
    if (separator === '') {
      return [text];
    }

    const parts = text.split(separator);
    const result: string[] = [];

    for (let i = 0; i < parts.length; i++) {
      let part = parts[i];

      // Add separator back if requested
      if (keepSeparator && i < parts.length - 1) {
        part = part + separator;
      }

      if (part.trim()) {
        result.push(part);
      }
    }

    return result;
  }

  /**
   * Split by characters (last resort)
   */
  private splitByCharacters(text: string, maxChars: number): string[] {
    const splits: string[] = [];

    for (let i = 0; i < text.length; i += maxChars) {
      splits.push(text.slice(i, i + maxChars));
    }

    return splits;
  }

  /**
   * Merge small splits into larger chunks
   */
  private mergeSplits(
    splits: string[],
    maxChars: number,
    minChunkSize: number,
  ): string[] {
    const merged: string[] = [];
    let current = '';

    for (const split of splits) {
      const combined = current ? current + split : split;

      if (combined.length <= maxChars) {
        current = combined;
      } else {
        if (current) {
          merged.push(current);
        }
        current = split;
      }
    }

    if (current) {
      merged.push(current);
    }

    // Handle very small final chunk
    if (merged.length > 1 && merged[merged.length - 1].length < minChunkSize) {
      const last = merged.pop()!;
      const prev = merged.pop()!;
      if ((prev + last).length <= maxChars) {
        merged.push(prev + last);
      } else {
        merged.push(prev);
        merged.push(last);
      }
    }

    return merged;
  }
}

/**
 * Create recursive chunker instance
 */
export function createRecursiveChunker(): RecursiveChunker {
  return new RecursiveChunker();
}
