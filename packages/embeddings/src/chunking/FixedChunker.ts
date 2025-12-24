/**
 * FixedChunker
 *
 * Fixed-size text chunking with overlap.
 */

import { BaseChunker, defaultTokenCounter } from './BaseChunker.js';
import type {
  Chunk,
  ChunkingStrategyType,
  FixedChunkingOptions,
} from '../types/index.js';

/**
 * Fixed-size chunker
 */
export class FixedChunker extends BaseChunker {
  readonly strategyType: ChunkingStrategyType = 'fixed';

  async chunk(text: string, options?: FixedChunkingOptions): Promise<Chunk[]> {
    const opts = this.getOptions(options) as Required<FixedChunkingOptions>;
    const splitByChars = options?.splitByChars ?? false;
    const separator = options?.separator ?? '\n';
    const keepSeparator = options?.keepSeparator ?? false;
    const tokenCounter = opts.tokenCounter ?? defaultTokenCounter;

    const chunks: Chunk[] = [];
    let position = 0;

    if (splitByChars) {
      // Simple character-based splitting
      const chunkSize = opts.chunkSize * 4; // Convert token estimate to chars
      const overlap = opts.chunkOverlap * 4;

      let start = 0;
      while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        const chunkText = text.slice(start, end).trim();

        if (chunkText.length > 0) {
          chunks.push(this.createChunk(chunkText, chunks.length, start, opts));
        }

        start = end - overlap;
        if (start >= text.length) break;
      }
    } else {
      // Split by separator first, then combine
      const parts = text.split(separator);
      let currentChunk = '';
      let chunkStart = 0;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const partWithSep =
          keepSeparator && i < parts.length - 1 ? part + separator : part;

        const testChunk = currentChunk
          ? currentChunk + (keepSeparator ? '' : separator) + partWithSep
          : partWithSep;
        const testTokens = tokenCounter(testChunk);

        if (testTokens > opts.chunkSize && currentChunk) {
          // Save current chunk
          chunks.push(
            this.createChunk(
              currentChunk.trim(),
              chunks.length,
              chunkStart,
              opts,
            ),
          );

          // Start new chunk with overlap
          const overlapText = this.getOverlapText(
            currentChunk,
            opts.chunkOverlap,
            tokenCounter,
          );
          currentChunk =
            overlapText + (overlapText ? separator : '') + partWithSep;
          chunkStart = position - (overlapText?.length ?? 0);
        } else {
          currentChunk = testChunk;
        }

        position += part.length + separator.length;
      }

      // Don't forget the last chunk
      if (currentChunk.trim()) {
        chunks.push(
          this.createChunk(
            currentChunk.trim(),
            chunks.length,
            chunkStart,
            opts,
          ),
        );
      }
    }

    // Set overlap info
    this.setOverlapInfo(chunks, opts.chunkOverlap * 4);

    return Promise.resolve(chunks);
  }

  /**
   * Get text for overlap from the end of a chunk
   */
  private getOverlapText(
    text: string,
    overlapTokens: number,
    tokenCounter: (text: string) => number,
  ): string {
    if (overlapTokens <= 0) return '';

    // Start from the end and work backwards
    const sentences = text.split(/(?<=[.!?])\s+/);
    let overlapText = '';

    for (let i = sentences.length - 1; i >= 0; i--) {
      const testText = sentences[i] + (overlapText ? ' ' + overlapText : '');
      const testTokens = tokenCounter(testText);

      if (testTokens > overlapTokens && overlapText) {
        break;
      }

      overlapText = testText;
    }

    return overlapText;
  }
}

/**
 * Create a fixed chunker
 */
export function createFixedChunker(): FixedChunker {
  return new FixedChunker();
}
