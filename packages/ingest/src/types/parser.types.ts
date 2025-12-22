/**
 * Parser Types
 *
 * Type definitions for document parsers.
 */

import type {
  DocumentType,
  Element,
  TableData,
  ImageData,
  DocumentMetadata,
} from './document.types.js';

/**
 * Parser capabilities
 */
export interface ParserCapabilities {
  /** Can extract text */
  text: boolean;
  /** Can extract structure/elements */
  structure: boolean;
  /** Can extract tables */
  tables: boolean;
  /** Can extract images */
  images: boolean;
  /** Can extract metadata */
  metadata: boolean;
  /** Can handle streams */
  streaming: boolean;
}

/**
 * Parser options
 */
export interface ParserOptions {
  /** Extract images */
  extractImages?: boolean;
  /** Extract tables */
  extractTables?: boolean;
  /** Extract metadata */
  extractMetadata?: boolean;
  /** OCR engine for images/scanned pages */
  ocrEngine?: OCREngineInterface;
  /** Password for encrypted documents */
  password?: string;
  /** Maximum pages to process */
  maxPages?: number;
  /** Page range to process */
  pageRange?: { start: number; end: number };
  /** Custom options */
  custom?: Record<string, unknown>;
}

/**
 * Parse result
 */
export interface ParseResult {
  /** Document type detected */
  type: DocumentType;
  /** Extracted text */
  text: string;
  /** Document elements */
  elements: Element[];
  /** Extracted tables */
  tables: TableData[];
  /** Extracted images */
  images: ImageData[];
  /** Document metadata */
  metadata: DocumentMetadata;
  /** Parse warnings */
  warnings?: string[];
}

/**
 * Parser interface
 */
export interface Parser {
  /** Parser name */
  readonly name: string;
  /** Supported MIME types */
  readonly supportedMimeTypes: string[];
  /** Supported extensions */
  readonly supportedExtensions: string[];
  /** Parser capabilities */
  readonly capabilities: ParserCapabilities;

  /** Check if parser can handle this content */
  canParse(mimeType: string, extension?: string): boolean;

  /** Parse document from buffer */
  parse(buffer: Buffer, options?: ParserOptions): Promise<ParseResult>;

  /** Parse document stream (if supported) */
  parseStream?(
    stream: NodeJS.ReadableStream,
    options?: ParserOptions,
  ): AsyncIterableIterator<Element>;
}

/**
 * OCR engine interface (simplified for parser dependency)
 */
export interface OCREngineInterface {
  /** Recognize text from image */
  recognize(image: Buffer): Promise<string>;
}

/**
 * PDF parser options
 */
export interface PDFParserOptions extends ParserOptions {
  /** Use native PDF text extraction */
  useNativeText?: boolean;
  /** Preserve text formatting */
  preserveFormatting?: boolean;
  /** Extract form fields */
  extractForms?: boolean;
  /** Extract annotations */
  extractAnnotations?: boolean;
}

/**
 * DOCX parser options
 */
export interface DOCXParserOptions extends ParserOptions {
  /** Include styles */
  includeStyles?: boolean;
  /** Preserve numbering */
  preserveNumbering?: boolean;
  /** Extract comments */
  extractComments?: boolean;
}

/**
 * HTML parser options
 */
export interface HTMLParserOptions extends ParserOptions {
  /** CSS selectors for main content */
  contentSelector?: string;
  /** Elements to exclude */
  excludeSelectors?: string[];
  /** Extract links */
  extractLinks?: boolean;
  /** Base URL for relative links */
  baseUrl?: string;
}

/**
 * Markdown parser options
 */
export interface MarkdownParserOptions extends ParserOptions {
  /** Enable GFM (GitHub Flavored Markdown) */
  gfm?: boolean;
  /** Extract frontmatter */
  extractFrontmatter?: boolean;
  /** Preserve raw code blocks */
  preserveCodeBlocks?: boolean;
}

/**
 * CSV parser options
 */
export interface CSVParserOptions extends ParserOptions {
  /** Delimiter character */
  delimiter?: string;
  /** Has header row */
  hasHeader?: boolean;
  /** Quote character */
  quote?: string;
  /** Encoding */
  encoding?: BufferEncoding;
}

/**
 * Excel parser options
 */
export interface ExcelParserOptions extends ParserOptions {
  /** Sheets to extract */
  sheets?: string[] | number[];
  /** Include formulas */
  includeFormulas?: boolean;
  /** Include cell styles */
  includeStyles?: boolean;
}

/**
 * Parser registry configuration
 */
export interface ParserRegistryConfig {
  /** Default parser options */
  defaultOptions?: ParserOptions;
  /** Custom parsers */
  customParsers?: Parser[];
  /** Parser overrides by MIME type */
  mimeTypeOverrides?: Record<string, Parser>;
}
