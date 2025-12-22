/**
 * Chunking Index
 *
 * Chunking strategy exports.
 */

export { BaseChunker } from './BaseChunker.js';
export { FixedChunker, createFixedChunker } from './FixedChunker.js';
export {
  RecursiveChunker,
  createRecursiveChunker,
} from './RecursiveChunker.js';
export { SentenceChunker, createSentenceChunker } from './SentenceChunker.js';
export {
  ParagraphChunker,
  createParagraphChunker,
} from './ParagraphChunker.js';
export { SemanticChunker, createSemanticChunker } from './SemanticChunker.js';
export {
  HierarchicalChunker,
  createHierarchicalChunker,
} from './HierarchicalChunker.js';

import type { Chunker, ChunkingStrategy } from '../types/index.js';
import { FixedChunker } from './FixedChunker.js';
import { RecursiveChunker } from './RecursiveChunker.js';
import { SentenceChunker } from './SentenceChunker.js';
import { ParagraphChunker } from './ParagraphChunker.js';
import { SemanticChunker } from './SemanticChunker.js';
import { HierarchicalChunker } from './HierarchicalChunker.js';

/**
 * Get all built-in chunkers
 */
export function getBuiltInChunkers(): Chunker[] {
  return [
    new FixedChunker(),
    new RecursiveChunker(),
    new SentenceChunker(),
    new ParagraphChunker(),
    new SemanticChunker(),
    new HierarchicalChunker(),
  ];
}

/**
 * Create chunker by strategy name
 */
export function createChunker(strategy: ChunkingStrategy): Chunker {
  switch (strategy) {
    case 'fixed':
      return new FixedChunker();
    case 'recursive':
      return new RecursiveChunker();
    case 'sentence':
      return new SentenceChunker();
    case 'paragraph':
      return new ParagraphChunker();
    case 'semantic':
      return new SemanticChunker();
    case 'hierarchical':
      return new HierarchicalChunker();
    case 'sliding_window':
      // Use fixed chunker with overlap for sliding window
      return new FixedChunker();
    case 'custom':
      throw new Error('Custom chunker must be provided');
  }
}

/**
 * Register all built-in chunkers with a chunker registry
 */
export function registerBuiltInChunkers(
  register: (chunker: Chunker) => void,
): void {
  for (const chunker of getBuiltInChunkers()) {
    register(chunker);
  }
}
