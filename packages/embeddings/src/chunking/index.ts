/**
 * Chunking Module Exports
 */

export {
  BaseChunker,
  defaultTokenCounter,
  mergeSmallChunks,
  splitLargeChunks,
} from './BaseChunker.js';
export { FixedChunker, createFixedChunker } from './FixedChunker.js';
export {
  RecursiveChunker,
  createRecursiveChunker,
} from './RecursiveChunker.js';
export { MarkdownChunker, createMarkdownChunker } from './MarkdownChunker.js';
export { CodeChunker, createCodeChunker } from './CodeChunker.js';
export { SemanticChunker, createSemanticChunker } from './SemanticChunker.js';

// Re-export chunking types
export type {
  ChunkingStrategyType,
  Chunk,
  ChunkingMetadata,
  ChunkingOptions,
  FixedChunkingOptions,
  SemanticChunkingOptions,
  RecursiveChunkingOptions,
  MarkdownChunkingOptions,
  CodeChunkingOptions,
  ChunkingResult,
  ChunkingStats,
  ChunkingStrategyConfig,
  CustomChunkingFn,
  TokenCounterFn,
  TextSplitterFn,
} from '../types/index.js';

import type {
  ChunkingStrategyType,
  ChunkingOptions,
  Chunk,
} from '../types/index.js';
import { FixedChunker } from './FixedChunker.js';
import { RecursiveChunker } from './RecursiveChunker.js';
import { MarkdownChunker } from './MarkdownChunker.js';
import { CodeChunker } from './CodeChunker.js';
import { SemanticChunker } from './SemanticChunker.js';
import { BaseChunker } from './BaseChunker.js';

/**
 * Chunker factory
 */
export function createChunker(strategy: ChunkingStrategyType): BaseChunker {
  switch (strategy) {
    case 'fixed':
      return new FixedChunker();
    case 'recursive':
      return new RecursiveChunker();
    case 'markdown':
      return new MarkdownChunker();
    case 'code':
      return new CodeChunker();
    case 'semantic':
      return new SemanticChunker();
    case 'sentence':
      // Sentence uses fixed chunker with sentence separator
      return new FixedChunker();
    case 'paragraph':
      // Paragraph uses fixed chunker with paragraph separator
      return new FixedChunker();
    default:
      return new RecursiveChunker();
  }
}

/**
 * Simple chunk function
 */
export async function chunk(
  text: string,
  strategy: ChunkingStrategyType = 'recursive',
  options?: ChunkingOptions,
): Promise<Chunk[]> {
  const chunker = createChunker(strategy);
  return chunker.chunk(text, options);
}
