/**
 * Document Types
 *
 * Core type definitions for documents and their elements.
 */

/**
 * Supported document types
 */
export type DocumentType =
  | 'pdf'
  | 'docx'
  | 'html'
  | 'markdown'
  | 'txt'
  | 'csv'
  | 'xlsx'
  | 'pptx'
  | 'email'
  | 'epub'
  | 'json'
  | 'unknown';

/**
 * Element type within a document
 */
export type ElementType =
  | 'text'
  | 'title'
  | 'heading'
  | 'paragraph'
  | 'list'
  | 'list_item'
  | 'table'
  | 'image'
  | 'code'
  | 'quote'
  | 'link'
  | 'footnote'
  | 'header'
  | 'footer'
  | 'page_break'
  | 'unknown';

/**
 * Document metadata
 */
export interface DocumentMetadata {
  /** Original filename */
  filename?: string;
  /** MIME type */
  mimeType?: string;
  /** Document title */
  title?: string;
  /** Document author */
  author?: string;
  /** Creation date */
  createdAt?: Date;
  /** Modification date */
  modifiedAt?: Date;
  /** Number of pages */
  pageCount?: number;
  /** Word count */
  wordCount?: number;
  /** Character count */
  characterCount?: number;
  /** Detected language */
  language?: string;
  /** File size in bytes */
  fileSize?: number;
  /** Source URL if loaded from web */
  sourceUrl?: string;
  /** Custom metadata */
  custom?: Record<string, unknown>;
}

/**
 * Chunk metadata
 */
export interface ChunkMetadata {
  /** Chunk index within document */
  index: number;
  /** Page number (if applicable) */
  pageNumber?: number;
  /** Section/heading path */
  sectionPath?: string[];
  /** Start character offset */
  startOffset?: number;
  /** End character offset */
  endOffset?: number;
  /** Element type */
  elementType?: ElementType;
  /** Parent chunk ID (for hierarchical) */
  parentId?: string;
  /** Child chunk IDs */
  childIds?: string[];
  /** Custom metadata */
  custom?: Record<string, unknown>;
}

/**
 * Document chunk
 */
export interface Chunk {
  /** Unique chunk ID */
  id: string;
  /** Document ID this chunk belongs to */
  documentId: string;
  /** Chunk text content */
  text: string;
  /** Estimated token count */
  tokenCount: number;
  /** Chunk metadata */
  metadata: ChunkMetadata;
  /** Embedding vector (if computed) */
  embedding?: number[];
}

/**
 * Document element (structural unit)
 */
export interface Element {
  /** Element type */
  type: ElementType;
  /** Element text content */
  text: string;
  /** Page number */
  pageNumber?: number;
  /** Bounding box */
  bbox?: BoundingBox;
  /** Element metadata */
  metadata?: Record<string, unknown>;
  /** Child elements */
  children?: Element[];
}

/**
 * Bounding box coordinates
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Table data
 */
export interface TableData {
  /** Unique table ID */
  id: string;
  /** Page number where table appears */
  pageNumber?: number;
  /** Table headers */
  headers: string[];
  /** Table rows */
  rows: string[][];
  /** Raw table data */
  raw?: unknown;
  /** Bounding box */
  bbox?: BoundingBox;
  /** Table caption */
  caption?: string;
}

/**
 * Image data
 */
export interface ImageData {
  /** Unique image ID */
  id: string;
  /** Page number where image appears */
  pageNumber?: number;
  /** Image width */
  width: number;
  /** Image height */
  height: number;
  /** Image format */
  format: string;
  /** Image URL or path */
  url?: string;
  /** Base64 encoded image */
  base64?: string;
  /** OCR extracted text */
  ocrText?: string;
  /** Generated caption */
  caption?: string;
  /** Alt text */
  altText?: string;
  /** Bounding box */
  bbox?: BoundingBox;
}

/**
 * Enrichment data
 */
export interface EnrichmentData {
  /** Extracted entities */
  entities?: Entity[];
  /** Extracted keywords */
  keywords?: string[];
  /** Generated summary */
  summary?: string;
  /** Sentiment analysis */
  sentiment?: SentimentResult;
  /** Topics */
  topics?: string[];
  /** Custom enrichments */
  custom?: Record<string, unknown>;
}

/**
 * Named entity
 */
export interface Entity {
  /** Entity type */
  type: string;
  /** Entity value */
  value: string;
  /** Occurrence count */
  count: number;
  /** Positions in text */
  positions?: Array<{ start: number; end: number }>;
}

/**
 * Sentiment result
 */
export interface SentimentResult {
  /** Overall sentiment */
  label: 'positive' | 'negative' | 'neutral' | 'mixed';
  /** Sentiment score (-1 to 1) */
  score: number;
  /** Confidence */
  confidence?: number;
}

/**
 * Processed document
 */
export interface ProcessedDocument {
  /** Unique document ID */
  id: string;
  /** Document type */
  type: DocumentType;
  /** Full text content */
  text: string;
  /** Document metadata */
  metadata: DocumentMetadata;
  /** Document elements */
  elements: Element[];
  /** Document chunks */
  chunks: Chunk[];
  /** Extracted tables */
  tables: TableData[];
  /** Extracted images */
  images: ImageData[];
  /** Enrichment data */
  enrichment?: EnrichmentData;
  /** Processing timestamp */
  processedAt: Date;
  /** Processing errors */
  errors?: ProcessingError[];
}

/**
 * Processing error
 */
export interface ProcessingError {
  /** Error stage */
  stage: string;
  /** Error message */
  message: string;
  /** Error details */
  details?: unknown;
}

/**
 * Document input options
 */
export interface DocumentInput {
  /** File path */
  path?: string;
  /** Buffer content */
  buffer?: Buffer;
  /** URL to fetch */
  url?: string;
  /** Filename hint */
  filename?: string;
  /** MIME type hint */
  mimeType?: string;
}
