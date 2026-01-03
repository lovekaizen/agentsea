/**
 * Chunking Types
 *
 * Types for text chunking strategies.
 */

/**
 * Chunking strategy type
 */
export type ChunkingStrategyType =
  | 'fixed'
  | 'semantic'
  | 'recursive'
  | 'markdown'
  | 'code'
  | 'sentence'
  | 'paragraph'
  | 'custom';

/**
 * Base chunk
 */
export interface Chunk {
  /** Unique chunk ID */
  id: string;
  /** Chunk text content */
  text: string;
  /** Chunk index in document */
  index: number;
  /** Start position in original document */
  startPosition: number;
  /** End position in original document */
  endPosition: number;
  /** Token count */
  tokenCount: number;
  /** Character count */
  charCount: number;
  /** Overlap with previous chunk (characters) */
  overlapPrev: number;
  /** Overlap with next chunk (characters) */
  overlapNext: number;
  /** Chunk metadata */
  metadata: ChunkingMetadata;
}

/**
 * Chunking metadata
 */
export interface ChunkingMetadata {
  /** Source document ID */
  documentId?: string;
  /** Source file path */
  source?: string;
  /** Document type */
  type?: string;
  /** Page number (for PDFs) */
  page?: number;
  /** Section heading */
  section?: string;
  /** Language (for code) */
  language?: string;
  /** Semantic boundary type */
  boundaryType?: string;
  /** Custom metadata */
  [key: string]: unknown;
}

/**
 * Base chunking options
 */
export interface ChunkingOptions {
  /** Target chunk size in tokens */
  chunkSize?: number;
  /** Overlap between chunks in tokens */
  chunkOverlap?: number;
  /** Minimum chunk size in tokens */
  minChunkSize?: number;
  /** Maximum chunk size in tokens */
  maxChunkSize?: number;
  /** Token counter function */
  tokenCounter?: (text: string) => number;
  /** Document ID */
  documentId?: string;
  /** Source identifier */
  source?: string;
  /** Document type */
  type?: string;
  /** Additional metadata for all chunks */
  metadata?: Record<string, unknown>;
}

/**
 * Fixed-size chunking options
 */
export interface FixedChunkingOptions extends ChunkingOptions {
  /** Split by characters instead of tokens */
  splitByChars?: boolean;
  /** Separator to split on */
  separator?: string;
  /** Keep separator in chunks */
  keepSeparator?: boolean;
}

/**
 * Semantic chunking options
 */
export interface SemanticChunkingOptions extends ChunkingOptions {
  /** Similarity threshold for merging (0-1) */
  similarityThreshold?: number;
  /** Embedding function for semantic similarity */
  embeddingFn?: (texts: string[]) => Promise<number[][]>;
  /** Breakpoint percentile threshold */
  breakpointPercentileThreshold?: number;
  /** Buffer size for sentence comparison */
  bufferSize?: number;
}

/**
 * Recursive chunking options
 */
export interface RecursiveChunkingOptions extends ChunkingOptions {
  /** Separators in order of priority */
  separators?: string[];
  /** Keep separators in chunks */
  keepSeparator?: boolean;
  /** Merge small chunks */
  mergeSmallChunks?: boolean;
}

/**
 * Markdown chunking options
 */
export interface MarkdownChunkingOptions extends ChunkingOptions {
  /** Preserve headers in chunks */
  preserveHeaders?: boolean;
  /** Include header hierarchy as metadata */
  includeHeaderHierarchy?: boolean;
  /** Split by heading levels */
  headingLevels?: number[];
  /** Split code blocks separately */
  splitCodeBlocks?: boolean;
  /** Preserve link references */
  preserveLinks?: boolean;
}

/**
 * Code chunking options
 */
export interface CodeChunkingOptions extends ChunkingOptions {
  /** Programming language */
  language?: string;
  /** Auto-detect language */
  autoDetectLanguage?: boolean;
  /** Split by function/class/module */
  splitBy?: 'function' | 'class' | 'module' | 'auto';
  /** Include comments in chunks */
  includeComments?: boolean;
  /** Include imports in each chunk */
  includeImports?: boolean;
  /** Include type definitions in each chunk */
  includeTypeDefinitions?: boolean;
}

/**
 * Sentence chunking options
 */
export interface SentenceChunkingOptions extends ChunkingOptions {
  /** Combine sentences to reach target size */
  combineSentences?: boolean;
  /** Sentence boundary regex */
  sentenceBoundary?: RegExp;
  /** Minimum sentences per chunk */
  minSentences?: number;
}

/**
 * Paragraph chunking options
 */
export interface ParagraphChunkingOptions extends ChunkingOptions {
  /** Combine paragraphs to reach target size */
  combineParagraphs?: boolean;
  /** Paragraph boundary regex */
  paragraphBoundary?: RegExp;
  /** Minimum paragraphs per chunk */
  minParagraphs?: number;
}

/**
 * Chunking result
 */
export interface ChunkingResult {
  /** Generated chunks */
  chunks: Chunk[];
  /** Total chunks created */
  totalChunks: number;
  /** Total tokens across all chunks */
  totalTokens: number;
  /** Average chunk size in tokens */
  avgChunkSize: number;
  /** Time taken to chunk (ms) */
  processingTimeMs: number;
  /** Strategy used */
  strategy: ChunkingStrategyType;
  /** Original document length (chars) */
  originalLength: number;
}

/**
 * Chunking statistics
 */
export interface ChunkingStats {
  /** Total documents chunked */
  documentsProcessed: number;
  /** Total chunks created */
  chunksCreated: number;
  /** Total tokens processed */
  tokensProcessed: number;
  /** Average chunks per document */
  avgChunksPerDocument: number;
  /** Average tokens per chunk */
  avgTokensPerChunk: number;
  /** Strategy distribution */
  strategyDistribution: Record<ChunkingStrategyType, number>;
}

/**
 * Chunking strategy configuration
 */
export interface ChunkingStrategyConfig {
  /** Strategy type */
  type: ChunkingStrategyType;
  /** Strategy-specific options */
  options: ChunkingOptions;
  /** Description */
  description?: string;
}

/**
 * Custom chunking function type
 */
export type CustomChunkingFn = (
  text: string,
  options: ChunkingOptions,
) => Promise<Chunk[]> | Chunk[];

/**
 * Token counter function type
 */
export type TokenCounterFn = (text: string) => number;

/**
 * Text splitter function type
 */
export type TextSplitterFn = (text: string, separator: string) => string[];
