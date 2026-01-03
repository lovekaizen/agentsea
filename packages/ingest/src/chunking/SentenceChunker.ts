/**
 * Sentence Chunker
 *
 * Sentence-based chunking strategy.
 */

import type { Chunk, SentenceChunkingOptions } from '../types/index.js';
import { BaseChunker } from './BaseChunker.js';

/**
 * Default sentence delimiters
 */
const DEFAULT_DELIMITERS = ['.', '!', '?', '。', '！', '？'];

/**
 * Sentence chunker implementation
 */
export class SentenceChunker extends BaseChunker {
  readonly name = 'sentence-chunker';
  readonly strategy = 'sentence' as const;

  /**
   * Chunk text by sentences
   */
  chunk(text: string, options?: SentenceChunkingOptions): Chunk[] {
    const maxTokens = options?.maxTokens ?? 512;
    const minSentences = options?.minSentences ?? 1;
    const maxSentences = options?.maxSentences ?? 10;
    const overlap = options?.overlap ?? 0;
    const delimiters = options?.delimiters ?? DEFAULT_DELIMITERS;
    const documentId = '';

    // Split into sentences
    const sentences = this.splitIntoSentences(text, delimiters);

    // Group sentences into chunks
    const groups = this.groupSentences(
      sentences,
      maxTokens,
      minSentences,
      maxSentences,
    );

    // Apply overlap
    const withOverlap = this.applyOverlapSentences(groups, overlap, sentences);

    // Create chunk objects
    return withOverlap.map((group, index) => {
      const chunkText = group.join(' ');
      return this.createChunk(chunkText, documentId, index, {
        custom: { sentenceCount: group.length },
      });
    });
  }

  /**
   * Split text into sentences
   */
  private splitIntoSentences(text: string, delimiters: string[]): string[] {
    const sentences: string[] = [];
    let current = '';

    // Build regex pattern for sentence endings
    const delimPattern = delimiters
      .map((d) => d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    const pattern = new RegExp(`(${delimPattern})(?=\\s|$)`, 'g');

    const parts = text.split(pattern);

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      if (delimiters.includes(part)) {
        current += part;
        if (current.trim()) {
          sentences.push(current.trim());
        }
        current = '';
      } else {
        current += part;
      }
    }

    // Add remaining text
    if (current.trim()) {
      sentences.push(current.trim());
    }

    return sentences;
  }

  /**
   * Group sentences into chunks respecting token limits
   */
  private groupSentences(
    sentences: string[],
    maxTokens: number,
    minSentences: number,
    maxSentences: number,
  ): string[][] {
    const groups: string[][] = [];
    let currentGroup: string[] = [];
    let currentTokens = 0;

    for (const sentence of sentences) {
      const sentenceTokens = this.tokenCounter(sentence);

      // Check if adding this sentence would exceed limits
      const wouldExceedTokens = currentTokens + sentenceTokens > maxTokens;
      const wouldExceedSentences = currentGroup.length >= maxSentences;

      if (
        (wouldExceedTokens || wouldExceedSentences) &&
        currentGroup.length >= minSentences
      ) {
        // Start new group
        groups.push(currentGroup);
        currentGroup = [sentence];
        currentTokens = sentenceTokens;
      } else {
        currentGroup.push(sentence);
        currentTokens += sentenceTokens;
      }
    }

    // Add final group
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    return groups;
  }

  /**
   * Apply sentence-level overlap between chunks
   */
  private applyOverlapSentences(
    groups: string[][],
    overlapSentences: number,
    _allSentences: string[],
  ): string[][] {
    if (overlapSentences <= 0 || groups.length <= 1) {
      return groups;
    }

    const result: string[][] = [];

    for (let i = 0; i < groups.length; i++) {
      const currentGroup = [...groups[i]];

      // Add overlap from previous group
      if (i > 0) {
        const prevGroup = groups[i - 1];
        const overlapCount = Math.min(overlapSentences, prevGroup.length);
        const overlapItems = prevGroup.slice(-overlapCount);
        currentGroup.unshift(...overlapItems);
      }

      result.push(currentGroup);
    }

    return result;
  }
}

/**
 * Create sentence chunker instance
 */
export function createSentenceChunker(): SentenceChunker {
  return new SentenceChunker();
}
