/**
 * Semantic Chunker
 *
 * Semantic-based chunking strategy using embeddings for similarity.
 */

import type { Chunk, SemanticChunkingOptions } from '../types/index.js';
import { BaseChunker } from './BaseChunker.js';

/**
 * Default embedding function (fallback - uses simple word overlap)
 */
const defaultEmbedFunction = (text: string): Promise<number[]> => {
  // Simple word-based "embedding" for fallback
  const words = text.toLowerCase().split(/\s+/);
  const wordSet = new Set(words);
  const vocab = Array.from(wordSet).slice(0, 100);

  const embedding = vocab.map((word) => {
    const count = words.filter((w) => w === word).length;
    return count / words.length;
  });

  return Promise.resolve(embedding);
};

/**
 * Semantic chunker implementation
 */
export class SemanticChunker extends BaseChunker {
  readonly name = 'semantic-chunker';
  readonly strategy = 'semantic' as const;

  /**
   * Chunk text based on semantic similarity
   */
  async chunk(
    text: string,
    options?: SemanticChunkingOptions,
  ): Promise<Chunk[]> {
    const maxTokens = options?.maxTokens ?? 512;
    const similarityThreshold = options?.similarityThreshold ?? 0.5;
    const minChunkSize = options?.minChunkSize ?? 50;
    const embedFunction = options?.embedFunction ?? defaultEmbedFunction;
    const documentId = '';

    // Split into sentences first
    const sentences = this.splitIntoSentences(text);

    if (sentences.length === 0) {
      return [];
    }

    if (sentences.length === 1) {
      return [this.createChunk(sentences[0], documentId, 0)];
    }

    // Get embeddings for each sentence
    const embeddings = await Promise.all(
      sentences.map((s) => embedFunction(s)),
    );

    // Find breakpoints based on semantic similarity
    const breakpoints = this.findSemanticBreakpoints(
      sentences,
      embeddings,
      similarityThreshold,
      maxTokens,
      minChunkSize,
    );

    // Create chunks from breakpoints
    const chunks: Chunk[] = [];
    let start = 0;

    for (let i = 0; i < breakpoints.length; i++) {
      const end = breakpoints[i];
      const chunkSentences = sentences.slice(start, end + 1);
      const chunkText = chunkSentences.join(' ');

      if (chunkText.trim()) {
        chunks.push(
          this.createChunk(chunkText, documentId, chunks.length, {
            custom: { sentenceCount: chunkSentences.length },
          }),
        );
      }

      start = end + 1;
    }

    // Add remaining sentences
    if (start < sentences.length) {
      const chunkSentences = sentences.slice(start);
      const chunkText = chunkSentences.join(' ');

      if (chunkText.trim()) {
        chunks.push(
          this.createChunk(chunkText, documentId, chunks.length, {
            custom: { sentenceCount: chunkSentences.length },
          }),
        );
      }
    }

    return chunks;
  }

  /**
   * Split text into sentences
   */
  private splitIntoSentences(text: string): string[] {
    return text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  /**
   * Find semantic breakpoints based on embedding similarity
   */
  private findSemanticBreakpoints(
    sentences: string[],
    embeddings: number[][],
    threshold: number,
    maxTokens: number,
    minChunkSize: number,
  ): number[] {
    const breakpoints: number[] = [];
    let currentTokens = 0;
    let chunkStart = 0;

    for (let i = 0; i < sentences.length - 1; i++) {
      const sentenceTokens = this.tokenCounter(sentences[i]);
      currentTokens += sentenceTokens;

      // Check if we need to break due to size
      if (currentTokens >= maxTokens) {
        breakpoints.push(i);
        currentTokens = 0;
        chunkStart = i + 1;
        continue;
      }

      // Check semantic similarity with next sentence
      const similarity = this.cosineSimilarity(
        embeddings[i],
        embeddings[i + 1],
      );

      // Check if current chunk is large enough for semantic break
      const currentChunkSize = sentences
        .slice(chunkStart, i + 1)
        .join(' ').length;

      if (similarity < threshold && currentChunkSize >= minChunkSize) {
        breakpoints.push(i);
        currentTokens = 0;
        chunkStart = i + 1;
      }
    }

    return breakpoints;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length === 0 || b.length === 0) {
      return 0;
    }

    // Pad shorter vector with zeros
    const maxLen = Math.max(a.length, b.length);
    const paddedA = [...a, ...Array(maxLen - a.length).fill(0)];
    const paddedB = [...b, ...Array(maxLen - b.length).fill(0)];

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < maxLen; i++) {
      dotProduct += paddedA[i] * paddedB[i];
      normA += paddedA[i] * paddedA[i];
      normB += paddedB[i] * paddedB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }
}

/**
 * Create semantic chunker instance
 */
export function createSemanticChunker(): SemanticChunker {
  return new SemanticChunker();
}
