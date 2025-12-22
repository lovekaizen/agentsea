/**
 * BaseChunker
 *
 * Abstract base class for text chunking strategies.
 */

import { nanoid } from 'nanoid';
import type {
  Chunk,
  ChunkingOptions,
  ChunkingResult,
  ChunkingStrategyType,
  TokenCounterFn,
} from '../types/index.js';

/**
 * Default token counter (rough approximation)
 */
export const defaultTokenCounter: TokenCounterFn = (text: string): number => {
  // Rough estimate: ~4 characters per token for English
  return Math.ceil(text.length / 4);
};

/**
 * Abstract base class for chunkers
 */
export abstract class BaseChunker {
  /** Strategy type */
  abstract readonly strategyType: ChunkingStrategyType;

  /** Default options */
  protected defaultOptions: ChunkingOptions = {
    chunkSize: 512,
    chunkOverlap: 50,
    minChunkSize: 100,
    maxChunkSize: 2000,
    tokenCounter: defaultTokenCounter,
  };

  /**
   * Chunk text into smaller pieces
   */
  abstract chunk(text: string, options?: ChunkingOptions): Promise<Chunk[]>;

  /**
   * Get merged options with defaults
   */
  protected getOptions(options?: ChunkingOptions): ChunkingOptions & {
    chunkSize: number;
    chunkOverlap: number;
    minChunkSize: number;
    maxChunkSize: number;
    tokenCounter: (text: string) => number;
    metadata: Record<string, unknown>;
  } {
    return {
      chunkSize: options?.chunkSize ?? this.defaultOptions.chunkSize!,
      chunkOverlap: options?.chunkOverlap ?? this.defaultOptions.chunkOverlap!,
      minChunkSize: options?.minChunkSize ?? this.defaultOptions.minChunkSize!,
      maxChunkSize: options?.maxChunkSize ?? this.defaultOptions.maxChunkSize!,
      tokenCounter: options?.tokenCounter ?? this.defaultOptions.tokenCounter!,
      documentId: options?.documentId,
      source: options?.source,
      type: options?.type,
      metadata: options?.metadata ?? {},
    };
  }

  /**
   * Create a chunk object
   */
  protected createChunk(
    text: string,
    index: number,
    startPosition: number,
    options: ChunkingOptions,
    additionalMetadata?: Record<string, unknown>,
  ): Chunk {
    const tokenCounter = options.tokenCounter ?? defaultTokenCounter;

    const metadata: Record<string, unknown> = {
      ...options.metadata,
      ...additionalMetadata,
    };

    if (options.documentId) metadata.documentId = options.documentId;
    if (options.source) metadata.source = options.source;
    if (options.type) metadata.type = options.type;

    return {
      id: nanoid(),
      text,
      index,
      startPosition,
      endPosition: startPosition + text.length,
      tokenCount: tokenCounter(text),
      charCount: text.length,
      overlapPrev: 0,
      overlapNext: 0,
      metadata,
    };
  }

  /**
   * Process chunks and set overlap information
   */
  protected setOverlapInfo(chunks: Chunk[], overlapChars: number): void {
    for (let i = 1; i < chunks.length; i++) {
      chunks[i].overlapPrev = overlapChars;
      chunks[i - 1].overlapNext = overlapChars;
    }
  }

  /**
   * Split text with overlap
   */
  protected splitWithOverlap(
    text: string,
    chunkSize: number,
    overlap: number,
    tokenCounter: TokenCounterFn,
  ): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      // Find the end position
      let end = start;
      let tokens = 0;

      // Expand until we hit the chunk size
      while (end < text.length && tokens < chunkSize) {
        end++;
        // Recount tokens for the current chunk
        tokens = tokenCounter(text.slice(start, end));
      }

      // Try to break at a word boundary
      if (end < text.length) {
        const lastSpace = text.lastIndexOf(' ', end);
        if (lastSpace > start) {
          end = lastSpace + 1;
        }
      }

      chunks.push(text.slice(start, end).trim());

      // Calculate overlap in characters
      const overlapChars = Math.floor(overlap * 4); // Approximate
      start = Math.max(start + 1, end - overlapChars);

      if (start >= text.length) break;
    }

    return chunks.filter((c) => c.length > 0);
  }

  /**
   * Chunk text and return a result object
   */
  async chunkWithResult(
    text: string,
    options?: ChunkingOptions,
  ): Promise<ChunkingResult> {
    const startTime = performance.now();
    const chunks = await this.chunk(text, options);
    const processingTimeMs = performance.now() - startTime;

    const totalTokens = chunks.reduce((sum, c) => sum + c.tokenCount, 0);

    return {
      chunks,
      totalChunks: chunks.length,
      totalTokens,
      avgChunkSize: chunks.length > 0 ? totalTokens / chunks.length : 0,
      processingTimeMs,
      strategy: this.strategyType,
      originalLength: text.length,
    };
  }
}

/**
 * Merge small chunks together
 */
export function mergeSmallChunks(
  chunks: Chunk[],
  minTokens: number,
  tokenCounter: TokenCounterFn,
): Chunk[] {
  if (chunks.length <= 1) return chunks;

  const merged: Chunk[] = [];
  let current: Chunk | null = null;

  for (const chunk of chunks) {
    if (!current) {
      current = { ...chunk };
      continue;
    }

    const combinedText = current.text + '\n' + chunk.text;
    const combinedTokens = tokenCounter(combinedText);

    // If current chunk is too small, merge with next
    if (current.tokenCount < minTokens) {
      current.text = combinedText;
      current.tokenCount = combinedTokens;
      current.charCount = combinedText.length;
      current.endPosition = chunk.endPosition;
    } else {
      merged.push(current);
      current = { ...chunk };
    }
  }

  if (current) {
    merged.push(current);
  }

  // Re-index
  return merged.map((c, i) => ({ ...c, index: i }));
}

/**
 * Split chunk if too large
 */
export function splitLargeChunks(
  chunks: Chunk[],
  maxTokens: number,
  tokenCounter: TokenCounterFn,
): Chunk[] {
  const result: Chunk[] = [];

  for (const chunk of chunks) {
    if (chunk.tokenCount <= maxTokens) {
      result.push(chunk);
      continue;
    }

    // Need to split this chunk
    const sentences = chunk.text.split(/(?<=[.!?])\s+/);
    let currentText = '';
    let currentStart = chunk.startPosition;

    for (const sentence of sentences) {
      const testText = currentText ? currentText + ' ' + sentence : sentence;
      const testTokens = tokenCounter(testText);

      if (testTokens > maxTokens && currentText) {
        result.push({
          ...chunk,
          id: nanoid(),
          text: currentText,
          startPosition: currentStart,
          endPosition: currentStart + currentText.length,
          tokenCount: tokenCounter(currentText),
          charCount: currentText.length,
        });
        currentText = sentence;
        currentStart = currentStart + currentText.length + 1;
      } else {
        currentText = testText;
      }
    }

    if (currentText) {
      result.push({
        ...chunk,
        id: nanoid(),
        text: currentText,
        startPosition: currentStart,
        endPosition: currentStart + currentText.length,
        tokenCount: tokenCounter(currentText),
        charCount: currentText.length,
      });
    }
  }

  // Re-index
  return result.map((c, i) => ({ ...c, index: i }));
}
