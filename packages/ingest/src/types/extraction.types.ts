/**
 * Extraction Types
 *
 * Type definitions for table, image, and metadata extraction.
 */

import type {
  TableData,
  ImageData,
  BoundingBox,
  DocumentMetadata,
} from './document.types.js';

/**
 * Table extraction options
 */
export interface TableExtractionOptions {
  /** Detect merged cells */
  detectMergedCells?: boolean;
  /** Preserve formatting */
  preserveFormatting?: boolean;
  /** Include header detection */
  detectHeaders?: boolean;
  /** Minimum rows to consider a table */
  minRows?: number;
  /** Minimum columns to consider a table */
  minColumns?: number;
  /** Extract to format */
  outputFormat?: TableOutputFormat;
}

/**
 * Table output formats
 */
export type TableOutputFormat = 'array' | 'csv' | 'json' | 'markdown' | 'html';

/**
 * Extracted table result
 */
export interface ExtractedTable extends TableData {
  /** Extraction confidence (0-1) */
  confidence: number;
  /** Table type detected */
  tableType?: 'data' | 'layout' | 'form';
  /** Detected structure */
  structure?: TableStructure;
}

/**
 * Table structure analysis
 */
export interface TableStructure {
  /** Number of header rows */
  headerRows: number;
  /** Number of header columns */
  headerColumns: number;
  /** Merged cell regions */
  mergedCells?: MergedCellRegion[];
  /** Detected column types */
  columnTypes?: ColumnType[];
}

/**
 * Merged cell region
 */
export interface MergedCellRegion {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

/**
 * Column type detection
 */
export interface ColumnType {
  index: number;
  type: 'text' | 'number' | 'date' | 'currency' | 'percentage' | 'mixed';
  format?: string;
}

/**
 * Image extraction options
 */
export interface ImageExtractionOptions {
  /** Minimum width to extract */
  minWidth?: number;
  /** Minimum height to extract */
  minHeight?: number;
  /** Output format */
  outputFormat?: ImageOutputFormat;
  /** Quality (0-100) */
  quality?: number;
  /** Extract embedded images only */
  embeddedOnly?: boolean;
  /** Include image data (base64) */
  includeData?: boolean;
  /** Run OCR on images */
  runOcr?: boolean;
  /** Generate captions */
  generateCaptions?: boolean;
}

/**
 * Image output formats
 */
export type ImageOutputFormat = 'png' | 'jpeg' | 'webp' | 'original';

/**
 * Extracted image result
 */
export interface ExtractedImage extends ImageData {
  /** Extraction confidence (0-1) */
  confidence: number;
  /** Image type detected */
  imageType?: ImageType;
  /** Color analysis */
  colorAnalysis?: ColorAnalysis;
  /** Detected objects/labels */
  labels?: string[];
}

/**
 * Image type classification
 */
export type ImageType =
  | 'photo'
  | 'diagram'
  | 'chart'
  | 'screenshot'
  | 'logo'
  | 'icon'
  | 'illustration'
  | 'unknown';

/**
 * Color analysis result
 */
export interface ColorAnalysis {
  /** Dominant colors */
  dominantColors: string[];
  /** Is grayscale */
  isGrayscale: boolean;
  /** Average brightness (0-255) */
  brightness: number;
}

/**
 * Metadata extraction options
 */
export interface MetadataExtractionOptions {
  /** Extract standard metadata */
  standard?: boolean;
  /** Extract custom/extended metadata */
  custom?: boolean;
  /** Extract document statistics */
  statistics?: boolean;
  /** Parse dates */
  parseDates?: boolean;
}

/**
 * Extended document metadata
 */
export interface ExtendedMetadata extends DocumentMetadata {
  /** Document keywords */
  keywords?: string[];
  /** Document subject */
  subject?: string;
  /** Document category */
  category?: string;
  /** Document version */
  version?: string;
  /** Document status */
  status?: string;
  /** Contributors */
  contributors?: string[];
  /** Publisher */
  publisher?: string;
  /** Copyright */
  copyright?: string;
  /** Custom properties */
  customProperties?: Record<string, string | number | boolean | Date>;
}

/**
 * Document statistics
 */
export interface DocumentStatistics {
  /** Total pages */
  pageCount: number;
  /** Total words */
  wordCount: number;
  /** Total characters */
  characterCount: number;
  /** Total characters without spaces */
  characterCountNoSpaces: number;
  /** Total paragraphs */
  paragraphCount: number;
  /** Total sentences */
  sentenceCount: number;
  /** Total lines */
  lineCount: number;
  /** Total tables */
  tableCount: number;
  /** Total images */
  imageCount: number;
  /** Estimated reading time (minutes) */
  readingTime: number;
}

/**
 * Link extraction options
 */
export interface LinkExtractionOptions {
  /** Include internal links */
  internal?: boolean;
  /** Include external links */
  external?: boolean;
  /** Include anchors */
  anchors?: boolean;
  /** Resolve relative URLs */
  resolveRelative?: boolean;
  /** Base URL for resolution */
  baseUrl?: string;
}

/**
 * Extracted link
 */
export interface ExtractedLink {
  /** Link URL */
  url: string;
  /** Link text */
  text?: string;
  /** Link title attribute */
  title?: string;
  /** Link type */
  type: 'internal' | 'external' | 'anchor' | 'mailto' | 'tel';
  /** Page/position where found */
  position?: LinkPosition;
}

/**
 * Link position in document
 */
export interface LinkPosition {
  pageNumber?: number;
  elementIndex?: number;
  startOffset?: number;
  endOffset?: number;
}

/**
 * Form field extraction
 */
export interface FormField {
  /** Field name */
  name: string;
  /** Field type */
  type:
    | 'text'
    | 'checkbox'
    | 'radio'
    | 'select'
    | 'textarea'
    | 'date'
    | 'number';
  /** Field value */
  value?: string | boolean | number;
  /** Field label */
  label?: string;
  /** Is required */
  required?: boolean;
  /** Field options (for select/radio) */
  options?: string[];
  /** Bounding box */
  bbox?: BoundingBox;
}

/**
 * Annotation extraction
 */
export interface Annotation {
  /** Annotation ID */
  id: string;
  /** Annotation type */
  type: 'highlight' | 'underline' | 'strikeout' | 'comment' | 'sticky_note';
  /** Annotated text */
  text?: string;
  /** Annotation content/comment */
  content?: string;
  /** Author */
  author?: string;
  /** Creation date */
  createdAt?: Date;
  /** Page number */
  pageNumber?: number;
  /** Bounding box */
  bbox?: BoundingBox;
}

/**
 * Extractor interface
 */
export interface Extractor<T, O = unknown> {
  /** Extractor name */
  readonly name: string;
  /** Extract from buffer */
  extract(buffer: Buffer, options?: O): Promise<T[]>;
  /** Check if extraction is supported */
  isSupported(mimeType: string): boolean;
}

/**
 * Table extractor interface
 */
export interface TableExtractor
  extends Extractor<ExtractedTable, TableExtractionOptions> {
  /** Convert table to format */
  convertTo(table: ExtractedTable, format: TableOutputFormat): string;
}

/**
 * Image extractor interface
 */
export interface ImageExtractor
  extends Extractor<ExtractedImage, ImageExtractionOptions> {
  /** Get image data as buffer */
  getImageBuffer(image: ExtractedImage): Promise<Buffer>;
}

/**
 * Metadata extractor interface
 */
export interface MetadataExtractor
  extends Extractor<ExtendedMetadata, MetadataExtractionOptions> {
  /** Get document statistics */
  getStatistics(buffer: Buffer): Promise<DocumentStatistics>;
}
