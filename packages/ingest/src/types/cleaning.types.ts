/**
 * Cleaning Types
 *
 * Type definitions for text and document cleaning.
 */

/**
 * Cleaning operations
 */
export type CleaningOperation =
  | 'normalize_whitespace'
  | 'remove_extra_whitespace'
  | 'normalize_unicode'
  | 'remove_control_chars'
  | 'fix_encoding'
  | 'remove_html_tags'
  | 'decode_html_entities'
  | 'remove_urls'
  | 'remove_emails'
  | 'remove_phone_numbers'
  | 'remove_special_chars'
  | 'lowercase'
  | 'uppercase'
  | 'trim'
  | 'remove_punctuation'
  | 'remove_numbers'
  | 'remove_stopwords'
  | 'stem'
  | 'lemmatize'
  | 'fix_hyphenation'
  | 'merge_lines'
  | 'remove_headers_footers'
  | 'remove_page_numbers'
  | 'deduplicate_lines'
  | 'custom';

/**
 * Cleaning configuration
 */
export interface CleaningConfig {
  /** Operations to apply in order */
  operations: CleaningOperation[];
  /** Custom operation handlers */
  customOperations?: Record<string, CleaningHandler>;
  /** Preserve patterns (regex) */
  preservePatterns?: RegExp[];
  /** Language for language-specific operations */
  language?: string;
  /** Stopwords to remove */
  stopwords?: string[];
}

/**
 * Cleaning handler function
 */
export type CleaningHandler = (
  text: string,
  options?: CleaningOptions,
) => string;

/**
 * Cleaning options
 */
export interface CleaningOptions {
  /** Preserve newlines */
  preserveNewlines?: boolean;
  /** Preserve case */
  preserveCase?: boolean;
  /** Minimum word length */
  minWordLength?: number;
  /** Maximum consecutive newlines */
  maxNewlines?: number;
  /** Remove patterns */
  removePatterns?: RegExp[];
  /** Replace patterns */
  replacePatterns?: Array<{ pattern: RegExp; replacement: string }>;
  /** Encoding to fix */
  encoding?: BufferEncoding;
  /** Custom replacements */
  replacements?: Record<string, string>;
}

/**
 * Cleaning result
 */
export interface CleaningResult {
  /** Cleaned text */
  text: string;
  /** Original text length */
  originalLength: number;
  /** Cleaned text length */
  cleanedLength: number;
  /** Operations applied */
  operationsApplied: CleaningOperation[];
  /** Changes made */
  changes: CleaningChange[];
  /** Processing time (ms) */
  processingTime: number;
}

/**
 * Cleaning change record
 */
export interface CleaningChange {
  /** Operation that made the change */
  operation: CleaningOperation;
  /** Number of changes */
  count: number;
  /** Sample of removed/changed content */
  samples?: string[];
}

/**
 * Text normalizer interface
 */
export interface TextNormalizer {
  /** Normalizer name */
  readonly name: string;

  /** Normalize text */
  normalize(text: string, options?: NormalizationOptions): string;

  /** Check if normalization needed */
  needsNormalization(text: string): boolean;
}

/**
 * Normalization options
 */
export interface NormalizationOptions {
  /** Unicode normalization form */
  unicodeForm?: 'NFC' | 'NFD' | 'NFKC' | 'NFKD';
  /** Normalize quotes */
  normalizeQuotes?: boolean;
  /** Normalize dashes */
  normalizeDashes?: boolean;
  /** Normalize ellipsis */
  normalizeEllipsis?: boolean;
  /** Remove accents/diacritics */
  removeAccents?: boolean;
  /** ASCII transliteration */
  toAscii?: boolean;
}

/**
 * Deduplication options
 */
export interface DeduplicationOptions {
  /** Similarity threshold (0-1) */
  threshold?: number;
  /** Deduplication scope */
  scope?: 'exact' | 'fuzzy' | 'semantic';
  /** Hash algorithm for exact matching */
  hashAlgorithm?: 'md5' | 'sha256' | 'simhash' | 'minhash';
  /** N-gram size for fuzzy matching */
  ngramSize?: number;
  /** Keep first or last occurrence */
  keep?: 'first' | 'last';
  /** Compare fields */
  compareFields?: string[];
}

/**
 * Deduplication result
 */
export interface DeduplicationResult<T> {
  /** Unique items */
  unique: T[];
  /** Duplicate items removed */
  duplicates: DuplicateGroup<T>[];
  /** Total duplicates removed */
  duplicateCount: number;
  /** Processing time (ms) */
  processingTime: number;
}

/**
 * Duplicate group
 */
export interface DuplicateGroup<T> {
  /** Kept item */
  kept: T;
  /** Removed duplicates */
  removed: T[];
  /** Similarity scores */
  similarities?: number[];
}

/**
 * Content filter interface
 */
export interface ContentFilter {
  /** Filter name */
  readonly name: string;

  /** Check if content should be filtered */
  shouldFilter(content: string): boolean;

  /** Filter content */
  filter(content: string): string;

  /** Get filter reason */
  getFilterReason(content: string): string | null;
}

/**
 * Content filter options
 */
export interface ContentFilterOptions {
  /** Filter profanity */
  filterProfanity?: boolean;
  /** Filter PII (personally identifiable information) */
  filterPII?: boolean;
  /** Custom filter patterns */
  customPatterns?: RegExp[];
  /** Replacement character/string */
  replacement?: string;
  /** Mask instead of remove */
  mask?: boolean;
  /** PII types to filter */
  piiTypes?: PIIType[];
}

/**
 * PII types
 */
export type PIIType =
  | 'email'
  | 'phone'
  | 'ssn'
  | 'credit_card'
  | 'address'
  | 'name'
  | 'date_of_birth'
  | 'ip_address'
  | 'passport'
  | 'drivers_license';

/**
 * PII detection result
 */
export interface PIIDetectionResult {
  /** Detected PII instances */
  instances: PIIInstance[];
  /** Total PII found */
  totalFound: number;
  /** Risk level */
  riskLevel: 'none' | 'low' | 'medium' | 'high';
}

/**
 * PII instance
 */
export interface PIIInstance {
  /** PII type */
  type: PIIType;
  /** Original value */
  value: string;
  /** Position in text */
  position: { start: number; end: number };
  /** Confidence (0-1) */
  confidence: number;
}

/**
 * Header/Footer detection options
 */
export interface HeaderFooterOptions {
  /** Detection method */
  method: 'pattern' | 'position' | 'similarity';
  /** Patterns to match */
  patterns?: RegExp[];
  /** Position threshold (lines from top/bottom) */
  positionThreshold?: number;
  /** Similarity threshold for repeated content */
  similarityThreshold?: number;
  /** Minimum occurrences to consider header/footer */
  minOccurrences?: number;
}

/**
 * Detected header/footer
 */
export interface DetectedHeaderFooter {
  /** Type */
  type: 'header' | 'footer';
  /** Content */
  content: string;
  /** Pages where detected */
  pages: number[];
  /** Detection confidence */
  confidence: number;
}

/**
 * Text cleaner interface
 */
export interface TextCleaner {
  /** Cleaner name */
  readonly name: string;

  /** Clean text with configuration */
  clean(text: string, config: CleaningConfig): CleaningResult;

  /** Apply single operation */
  applyOperation(
    text: string,
    operation: CleaningOperation,
    options?: CleaningOptions,
  ): string;

  /** Get available operations */
  getAvailableOperations(): CleaningOperation[];
}
