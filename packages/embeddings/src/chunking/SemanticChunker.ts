/**
 * SemanticChunker
 *
 * Semantic-aware text chunking using embeddings for similarity.
 */

import {
  BaseChunker,
  defaultTokenCounter,
  mergeSmallChunks,
} from './BaseChunker.js';
import { EmbeddingModel } from '../core/EmbeddingModel.js';
import type {
  Chunk,
  ChunkingOptions,
  ChunkingStrategyType,
  SemanticChunkingOptions,
} from '../types/index.js';

/**
 * Sentence with embedding
 */
interface SentenceWithEmbedding {
  text: string;
  embedding?: number[];
  position: number;
}

/**
 * Semantic chunker
 */
export class SemanticChunker extends BaseChunker {
  readonly strategyType: ChunkingStrategyType = 'semantic';

  async chunk(
    text: string,
    options?: SemanticChunkingOptions,
  ): Promise<Chunk[]> {
    const opts = this.getOptions(options) as Required<SemanticChunkingOptions>;
    const similarityThreshold = options?.similarityThreshold ?? 0.5;
    const breakpointPercentile = options?.breakpointPercentileThreshold ?? 95;
    const bufferSize = options?.bufferSize ?? 1;
    const embeddingFn = options?.embeddingFn;
    const tokenCounter = opts.tokenCounter ?? defaultTokenCounter;

    // Split into sentences
    const sentences = this.splitSentences(text);

    if (sentences.length === 0) {
      return [];
    }

    // If no embedding function, fall back to simple splitting
    if (!embeddingFn) {
      return this.fallbackChunk(sentences, opts, tokenCounter);
    }

    // Get embeddings for sentences
    const sentenceTexts = sentences.map((s) => s.text);
    const embeddings = await embeddingFn(sentenceTexts);

    // Assign embeddings to sentences
    const sentencesWithEmbeddings: SentenceWithEmbedding[] = sentences.map(
      (s, i) => ({
        ...s,
        embedding: embeddings[i],
      }),
    );

    // Calculate distances between adjacent sentences
    const distances = this.calculateDistances(
      sentencesWithEmbeddings,
      bufferSize,
    );

    // Find breakpoints using percentile threshold
    const breakpoints = this.findBreakpoints(
      distances,
      breakpointPercentile,
      similarityThreshold,
    );

    // Create chunks based on breakpoints
    let chunks: Chunk[] = [];
    let chunkStart = 0;
    let chunkText = '';
    let chunkPosition = sentences[0]?.position ?? 0;

    for (let i = 0; i < sentences.length; i++) {
      chunkText += (chunkText ? ' ' : '') + sentences[i].text;

      if (breakpoints.includes(i) || i === sentences.length - 1) {
        if (chunkText.trim()) {
          chunks.push(
            this.createChunk(
              chunkText.trim(),
              chunks.length,
              chunkPosition,
              opts,
              {
                boundaryType: 'semantic',
                sentenceCount: i - chunkStart + 1,
              },
            ),
          );
        }

        if (i < sentences.length - 1) {
          chunkStart = i + 1;
          chunkText = '';
          chunkPosition = sentences[i + 1].position;
        }
      }
    }

    // Merge small chunks
    chunks = mergeSmallChunks(chunks, opts.minChunkSize, tokenCounter);

    // Split large chunks
    chunks = this.splitLargeChunks(chunks, opts.maxChunkSize, tokenCounter);

    return chunks;
  }

  /**
   * Split text into sentences
   */
  private splitSentences(text: string): SentenceWithEmbedding[] {
    const sentenceRegex = /[^.!?]+[.!?]+/g;
    const sentences: SentenceWithEmbedding[] = [];
    let match;

    while ((match = sentenceRegex.exec(text)) !== null) {
      const sentence = match[0].trim();
      if (sentence) {
        sentences.push({
          text: sentence,
          position: match.index,
        });
      }
    }

    // Handle text without sentence endings
    if (sentences.length === 0 && text.trim()) {
      sentences.push({
        text: text.trim(),
        position: 0,
      });
    }

    return sentences;
  }

  /**
   * Calculate distances between adjacent sentences
   */
  private calculateDistances(
    sentences: SentenceWithEmbedding[],
    bufferSize: number,
  ): number[] {
    const distances: number[] = [];

    for (let i = 0; i < sentences.length - 1; i++) {
      // Get combined embeddings for buffer
      const leftStart = Math.max(0, i - bufferSize + 1);
      const rightEnd = Math.min(sentences.length, i + bufferSize + 1);

      const leftEmbeddings = sentences
        .slice(leftStart, i + 1)
        .map((s) => s.embedding)
        .filter((e): e is number[] => e !== undefined);

      const rightEmbeddings = sentences
        .slice(i + 1, rightEnd)
        .map((s) => s.embedding)
        .filter((e): e is number[] => e !== undefined);

      if (leftEmbeddings.length > 0 && rightEmbeddings.length > 0) {
        const leftAvg = EmbeddingModel.average(leftEmbeddings);
        const rightAvg = EmbeddingModel.average(rightEmbeddings);
        const similarity = EmbeddingModel.cosineSimilarity(leftAvg, rightAvg);
        distances.push(1 - similarity); // Convert to distance
      } else {
        distances.push(0);
      }
    }

    return distances;
  }

  /**
   * Find breakpoints based on distance threshold
   */
  private findBreakpoints(
    distances: number[],
    percentile: number,
    minThreshold: number,
  ): number[] {
    if (distances.length === 0) return [];

    // Calculate threshold from percentile
    const sortedDistances = [...distances].sort((a, b) => a - b);
    const percentileIndex = Math.floor(
      (percentile / 100) * sortedDistances.length,
    );
    const percentileThreshold =
      sortedDistances[percentileIndex] ??
      sortedDistances[sortedDistances.length - 1];

    // Use the higher of percentile threshold and min threshold
    const threshold = Math.max(percentileThreshold, 1 - minThreshold);

    // Find breakpoints where distance exceeds threshold
    const breakpoints: number[] = [];
    for (let i = 0; i < distances.length; i++) {
      if (distances[i] >= threshold) {
        breakpoints.push(i);
      }
    }

    return breakpoints;
  }

  /**
   * Fallback chunking when no embedding function available
   */
  private fallbackChunk(
    sentences: SentenceWithEmbedding[],
    options: Required<ChunkingOptions>,
    tokenCounter: (text: string) => number,
  ): Chunk[] {
    const chunks: Chunk[] = [];
    let currentText = '';
    let chunkPosition = sentences[0]?.position ?? 0;

    for (const sentence of sentences) {
      const testText = currentText
        ? currentText + ' ' + sentence.text
        : sentence.text;

      if (tokenCounter(testText) > options.chunkSize && currentText) {
        chunks.push(
          this.createChunk(
            currentText.trim(),
            chunks.length,
            chunkPosition,
            options,
            { boundaryType: 'sentence' },
          ),
        );

        currentText = sentence.text;
        chunkPosition = sentence.position;
      } else {
        currentText = testText;
      }
    }

    if (currentText.trim()) {
      chunks.push(
        this.createChunk(
          currentText.trim(),
          chunks.length,
          chunkPosition,
          options,
          { boundaryType: 'sentence' },
        ),
      );
    }

    return chunks;
  }

  /**
   * Split chunks that are too large
   */
  private splitLargeChunks(
    chunks: Chunk[],
    maxTokens: number,
    tokenCounter: (text: string) => number,
  ): Chunk[] {
    const result: Chunk[] = [];

    for (const chunk of chunks) {
      if (chunk.tokenCount <= maxTokens) {
        result.push(chunk);
        continue;
      }

      // Split by sentences
      const sentences = this.splitSentences(chunk.text);
      let currentText = '';
      let currentStart = chunk.startPosition;

      for (const sentence of sentences) {
        const testText = currentText
          ? currentText + ' ' + sentence.text
          : sentence.text;

        if (tokenCounter(testText) > maxTokens && currentText) {
          result.push({
            ...chunk,
            id: chunk.id + '_' + result.length,
            text: currentText.trim(),
            startPosition: currentStart,
            endPosition: currentStart + currentText.length,
            tokenCount: tokenCounter(currentText),
            charCount: currentText.length,
            index: result.length,
          });

          currentText = sentence.text;
          currentStart = chunk.startPosition + sentence.position;
        } else {
          currentText = testText;
        }
      }

      if (currentText.trim()) {
        result.push({
          ...chunk,
          id: chunk.id + '_' + result.length,
          text: currentText.trim(),
          startPosition: currentStart,
          endPosition: currentStart + currentText.length,
          tokenCount: tokenCounter(currentText),
          charCount: currentText.length,
          index: result.length,
        });
      }
    }

    return result;
  }
}

/**
 * Create a semantic chunker
 */
export function createSemanticChunker(): SemanticChunker {
  return new SemanticChunker();
}
