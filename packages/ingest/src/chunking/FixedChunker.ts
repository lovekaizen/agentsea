/**
 * Fixed Chunker
 *
 * Fixed-size chunking strategy.
 */

import type { Chunk, FixedChunkingOptions } from '../types/index.js';
import { BaseChunker } from './BaseChunker.js';

/**
 * Fixed-size chunker implementation
 */
export class FixedChunker extends BaseChunker {
  readonly name = 'fixed-chunker';
  readonly strategy = 'fixed' as const;

  /**
   * Chunk text into fixed-size chunks
   */
  chunk(text: string, options?: FixedChunkingOptions): Chunk[] {
    const maxTokens = options?.maxTokens ?? 512;
    const maxChars = options?.maxCharacters ?? maxTokens * 4;
    const overlap = options?.overlap ?? 0;
    const documentId = '';

    const chunks: Chunk[] = [];
    let position = 0;
    let index = 0;

    while (position < text.length) {
      // Calculate end position
      let endPos = Math.min(position + maxChars, text.length);

      // Adjust for word boundaries if requested
      if (options?.splitOnWords && endPos < text.length) {
        const searchStart = Math.max(endPos - 100, position);
        const searchText = text.slice(searchStart, endPos + 50);
        const lastSpace = searchText.lastIndexOf(' ');
        if (lastSpace > 0) {
          endPos = searchStart + lastSpace;
        }
      }

      // Adjust for sentence boundaries if requested
      if (options?.splitOnSentences && endPos < text.length) {
        const searchStart = Math.max(endPos - 200, position);
        const searchText = text.slice(searchStart, endPos + 100);
        const sentenceEnd = searchText.search(/[.!?]\s/);
        if (sentenceEnd > 0) {
          endPos = searchStart + sentenceEnd + 2;
        }
      }

      // Extract chunk text
      const chunkText = text.slice(position, endPos).trim();

      if (chunkText.length > 0) {
        chunks.push(
          this.createChunk(chunkText, documentId, index, {
            startOffset: position,
            endOffset: endPos,
          }),
        );
        index++;
      }

      // Calculate next position with overlap
      const overlapChars = overlap * 4;
      position = endPos - overlapChars;

      // Prevent infinite loop
      const lastChunkStart = chunks[chunks.length - 1]?.metadata.startOffset;
      if (position <= (lastChunkStart ?? 0)) {
        position = endPos;
      }
    }

    return chunks;
  }
}

/**
 * Create fixed chunker instance
 */
export function createFixedChunker(): FixedChunker {
  return new FixedChunker();
}
