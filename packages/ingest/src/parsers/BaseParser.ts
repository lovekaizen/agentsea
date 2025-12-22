/**
 * Base Parser
 *
 * Abstract base class for document parsers.
 */

import { nanoid } from 'nanoid';
import type {
  Parser,
  ParserCapabilities,
  ParserOptions,
  ParseResult,
  DocumentType,
  Element,
  TableData,
  ImageData,
  DocumentMetadata,
} from '../types/index.js';

/**
 * Abstract base parser class
 */
export abstract class BaseParser implements Parser {
  abstract readonly name: string;
  abstract readonly supportedMimeTypes: string[];
  abstract readonly supportedExtensions: string[];
  abstract readonly capabilities: ParserCapabilities;

  /**
   * Check if parser can handle this content
   */
  canParse(mimeType: string, extension?: string): boolean {
    if (mimeType && this.supportedMimeTypes.includes(mimeType)) {
      return true;
    }
    if (
      extension &&
      this.supportedExtensions.includes(extension.toLowerCase())
    ) {
      return true;
    }
    return false;
  }

  /**
   * Parse document from buffer
   */
  abstract parse(buffer: Buffer, options?: ParserOptions): Promise<ParseResult>;

  /**
   * Parse document stream (optional)
   */
  parseStream?(
    stream: NodeJS.ReadableStream,
    options?: ParserOptions,
  ): AsyncIterableIterator<Element>;

  /**
   * Create empty parse result
   */
  protected createEmptyResult(type: DocumentType): ParseResult {
    return {
      type,
      text: '',
      elements: [],
      tables: [],
      images: [],
      metadata: {},
    };
  }

  /**
   * Create text element
   */
  protected createElement(
    type: Element['type'],
    text: string,
    pageNumber?: number,
    metadata?: Record<string, unknown>,
  ): Element {
    return {
      type,
      text,
      pageNumber,
      metadata,
    };
  }

  /**
   * Create table data
   */
  protected createTable(
    headers: string[],
    rows: string[][],
    pageNumber?: number,
    caption?: string,
  ): TableData {
    return {
      id: nanoid(),
      headers,
      rows,
      pageNumber,
      caption,
    };
  }

  /**
   * Create image data
   */
  protected createImage(
    width: number,
    height: number,
    format: string,
    options: Partial<ImageData> = {},
  ): ImageData {
    return {
      id: nanoid(),
      width,
      height,
      format,
      ...options,
    };
  }

  /**
   * Estimate word count
   */
  protected estimateWordCount(text: string): number {
    return text.split(/\s+/).filter((w) => w.length > 0).length;
  }

  /**
   * Estimate character count
   */
  protected estimateCharacterCount(text: string): number {
    return text.length;
  }

  /**
   * Extract text from elements
   */
  protected extractTextFromElements(elements: Element[]): string {
    return elements
      .map((el) => {
        if (el.children && el.children.length > 0) {
          return this.extractTextFromElements(el.children);
        }
        return el.text;
      })
      .join('\n\n');
  }

  /**
   * Merge metadata with defaults
   */
  protected mergeMetadata(
    extracted: Partial<DocumentMetadata>,
    text: string,
  ): DocumentMetadata {
    return {
      ...extracted,
      wordCount: extracted.wordCount ?? this.estimateWordCount(text),
      characterCount:
        extracted.characterCount ?? this.estimateCharacterCount(text),
    };
  }
}
