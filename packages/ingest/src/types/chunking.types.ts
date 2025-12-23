/**
 * Chunking Types
 *
 * Type definitions for document chunking strategies.
 */

import type { Chunk, ChunkMetadata, Element } from './document.types.js';

/**
 * Chunking strategy types
 */
export type ChunkingStrategy =
  | 'fixed'
  | 'semantic'
  | 'recursive'
  | 'hierarchical'
  | 'sentence'
  | 'paragraph'
  | 'sliding_window'
  | 'custom';

/**
 * Token counter function type
 */
export type TokenCounter = (text: string) => number;

/**
 * Base chunking options
 */
export interface ChunkingOptions {
  /** Maximum chunk size in tokens */
  maxTokens?: number;
  /** Maximum chunk size in characters */
  maxCharacters?: number;
  /** Overlap between chunks (tokens or characters) */
  overlap?: number;
  /** Overlap as percentage of chunk size */
  overlapPercent?: number;
  /** Preserve element boundaries */
  preserveElements?: boolean;
  /** Include metadata in chunks */
  includeMetadata?: boolean;
  /** Custom token counter */
  tokenCounter?: TokenCounter;
}

/**
 * Fixed size chunking options
 */
export interface FixedChunkingOptions extends ChunkingOptions {
  /** Split on word boundaries */
  splitOnWords?: boolean;
  /** Split on sentence boundaries */
  splitOnSentences?: boolean;
}

/**
 * Semantic chunking options
 */
export interface SemanticChunkingOptions extends ChunkingOptions {
  /** Similarity threshold for grouping (0-1) */
  similarityThreshold?: number;
  /** Embedding function for similarity */
  embedFunction?: (text: string) => Promise<number[]>;
  /** Minimum chunk size before considering split */
  minChunkSize?: number;
}

/**
 * Recursive chunking options
 */
export interface RecursiveChunkingOptions extends ChunkingOptions {
  /** Separators to try in order */
  separators?: string[];
  /** Keep separators in output */
  keepSeparator?: boolean;
  /** Minimum chunk size */
  minChunkSize?: number;
}

/**
 * Hierarchical chunking options
 */
export interface HierarchicalChunkingOptions extends ChunkingOptions {
  /** Heading levels to use as split points */
  headingLevels?: number[];
  /** Include parent context in child chunks */
  includeParentContext?: boolean;
  /** Maximum depth of hierarchy */
  maxDepth?: number;
}

/**
 * Sentence chunking options
 */
export interface SentenceChunkingOptions extends ChunkingOptions {
  /** Minimum sentences per chunk */
  minSentences?: number;
  /** Maximum sentences per chunk */
  maxSentences?: number;
  /** Sentence delimiters */
  delimiters?: string[];
}

/**
 * Paragraph chunking options
 */
export interface ParagraphChunkingOptions extends ChunkingOptions {
  /** Minimum paragraphs per chunk */
  minParagraphs?: number;
  /** Maximum paragraphs per chunk */
  maxParagraphs?: number;
  /** Paragraph separator pattern */
  separatorPattern?: RegExp;
}

/**
 * Sliding window chunking options
 */
export interface SlidingWindowChunkingOptions extends ChunkingOptions {
  /** Window size in tokens */
  windowSize: number;
  /** Step size (stride) in tokens */
  stepSize: number;
}

/**
 * Chunker interface
 */
export interface Chunker {
  /** Chunker name */
  readonly name: string;
  /** Strategy type */
  readonly strategy: ChunkingStrategy;

  /** Chunk text content */
  chunk(text: string, options?: ChunkingOptions): Chunk[] | Promise<Chunk[]>;

  /** Chunk document elements */
  chunkElements(
    elements: Element[],
    options?: ChunkingOptions,
  ): Chunk[] | Promise<Chunk[]>;

  /** Estimate chunk count */
  estimateChunks(text: string, options?: ChunkingOptions): number;
}

/**
 * Chunk result with additional metadata
 */
export interface ChunkResult {
  /** Generated chunks */
  chunks: Chunk[];
  /** Total chunk count */
  totalChunks: number;
  /** Average chunk size (tokens) */
  averageTokens: number;
  /** Overlap ratio */
  overlapRatio: number;
  /** Processing time (ms) */
  processingTime: number;
}

/**
 * Chunk overlap configuration
 */
export interface OverlapConfig {
  /** Overlap size */
  size: number;
  /** Unit (tokens or characters) */
  unit: 'tokens' | 'characters';
  /** Include overlap context */
  includeContext?: boolean;
}

/**
 * Chunk boundary detection
 */
export interface BoundaryDetector {
  /** Detect natural boundaries in text */
  detectBoundaries(text: string): number[];
  /** Get boundary type at position */
  getBoundaryType(text: string, position: number): BoundaryType;
}

/**
 * Boundary types
 */
export type BoundaryType =
  | 'sentence'
  | 'paragraph'
  | 'section'
  | 'page'
  | 'element'
  | 'word'
  | 'none';

/**
 * Chunk index for fast lookup
 */
export interface ChunkIndex {
  /** Add chunk to index */
  add(chunk: Chunk): void;
  /** Find chunks by text search */
  search(query: string, limit?: number): Chunk[];
  /** Find chunks by metadata */
  findByMetadata(filter: Partial<ChunkMetadata>): Chunk[];
  /** Get chunk by ID */
  get(id: string): Chunk | undefined;
  /** Get all chunks */
  getAll(): Chunk[];
}

/**
 * Chunker registry configuration
 */
export interface ChunkerRegistryConfig {
  /** Default chunking options */
  defaultOptions?: ChunkingOptions;
  /** Custom chunkers */
  customChunkers?: Chunker[];
  /** Strategy overrides */
  strategyOverrides?: Record<ChunkingStrategy, Chunker>;
  /** Register built-in chunkers automatically (default: true) */
  registerBuiltIns?: boolean;
}
