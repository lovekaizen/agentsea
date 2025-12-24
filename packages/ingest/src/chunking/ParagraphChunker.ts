/**
 * Paragraph Chunker
 *
 * Paragraph-based chunking strategy.
 */

import type { Chunk, ParagraphChunkingOptions } from '../types/index.js';
import { BaseChunker } from './BaseChunker.js';

/**
 * Paragraph chunker implementation
 */
export class ParagraphChunker extends BaseChunker {
  readonly name = 'paragraph-chunker';
  readonly strategy = 'paragraph' as const;

  /**
   * Chunk text by paragraphs
   */
  chunk(text: string, options?: ParagraphChunkingOptions): Chunk[] {
    const maxTokens = options?.maxTokens ?? 512;
    const minParagraphs = options?.minParagraphs ?? 1;
    const maxParagraphs = options?.maxParagraphs ?? 5;
    const overlap = options?.overlap ?? 0;
    const separatorPattern = options?.separatorPattern ?? /\n\n+/;
    const documentId = '';

    // Split into paragraphs
    const paragraphs = text
      .split(separatorPattern)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    // Group paragraphs into chunks
    const groups = this.groupParagraphs(
      paragraphs,
      maxTokens,
      minParagraphs,
      maxParagraphs,
    );

    // Apply overlap
    const withOverlap = this.applyOverlapParagraphs(groups, overlap);

    // Create chunk objects
    return withOverlap.map((group, index) => {
      const chunkText = group.join('\n\n');
      return this.createChunk(chunkText, documentId, index, {
        custom: { paragraphCount: group.length },
      });
    });
  }

  /**
   * Group paragraphs into chunks respecting token limits
   */
  private groupParagraphs(
    paragraphs: string[],
    maxTokens: number,
    minParagraphs: number,
    maxParagraphs: number,
  ): string[][] {
    const groups: string[][] = [];
    let currentGroup: string[] = [];
    let currentTokens = 0;

    for (const paragraph of paragraphs) {
      const paragraphTokens = this.tokenCounter(paragraph);

      // Check if adding this paragraph would exceed limits
      const wouldExceedTokens = currentTokens + paragraphTokens > maxTokens;
      const wouldExceedParagraphs = currentGroup.length >= maxParagraphs;

      if (
        (wouldExceedTokens || wouldExceedParagraphs) &&
        currentGroup.length >= minParagraphs
      ) {
        // Start new group
        groups.push(currentGroup);
        currentGroup = [paragraph];
        currentTokens = paragraphTokens;
      } else {
        currentGroup.push(paragraph);
        currentTokens += paragraphTokens;
      }
    }

    // Add final group
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    return groups;
  }

  /**
   * Apply paragraph-level overlap between chunks
   */
  private applyOverlapParagraphs(
    groups: string[][],
    overlapParagraphs: number,
  ): string[][] {
    if (overlapParagraphs <= 0 || groups.length <= 1) {
      return groups;
    }

    const result: string[][] = [];

    for (let i = 0; i < groups.length; i++) {
      const currentGroup = [...groups[i]];

      // Add overlap from previous group
      if (i > 0) {
        const prevGroup = groups[i - 1];
        const overlapCount = Math.min(overlapParagraphs, prevGroup.length);
        const overlapItems = prevGroup.slice(-overlapCount);
        currentGroup.unshift(...overlapItems);
      }

      result.push(currentGroup);
    }

    return result;
  }
}

/**
 * Create paragraph chunker instance
 */
export function createParagraphChunker(): ParagraphChunker {
  return new ParagraphChunker();
}
