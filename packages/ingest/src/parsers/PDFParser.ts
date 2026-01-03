/**
 * PDF Parser
 *
 * Parser for PDF documents using pdf-parse.
 */

import type {
  ParserCapabilities,
  ParseResult,
  PDFParserOptions,
  Element,
} from '../types/index.js';
import { BaseParser } from './BaseParser.js';

/**
 * PDF document parser
 */
export class PDFParser extends BaseParser {
  readonly name = 'pdf-parser';
  readonly supportedMimeTypes = ['application/pdf'];
  readonly supportedExtensions = ['pdf'];
  readonly capabilities: ParserCapabilities = {
    text: true,
    structure: true,
    tables: false, // Limited table support
    images: false, // Images require additional processing
    metadata: true,
    streaming: false,
  };

  /**
   * Parse PDF document
   */
  async parse(
    buffer: Buffer,
    options?: PDFParserOptions,
  ): Promise<ParseResult> {
    const result = this.createEmptyResult('pdf');
    const warnings: string[] = [];

    try {
      // Dynamic import of pdf-parse
      const pdfParse = await import('pdf-parse');
      const pdf = await pdfParse.default(buffer, {
        max: options?.maxPages ?? 0, // 0 means all pages
        pagerender: options?.preserveFormatting
          ? (pageData: unknown) => this.renderPage(pageData)
          : undefined,
      });

      // Extract text
      result.text = pdf.text;

      // Extract metadata
      result.metadata = {
        title: pdf.info?.Title,
        author: pdf.info?.Author,
        createdAt: pdf.info?.CreationDate
          ? this.parsePDFDate(pdf.info.CreationDate)
          : undefined,
        modifiedAt: pdf.info?.ModDate
          ? this.parsePDFDate(pdf.info.ModDate)
          : undefined,
        pageCount: pdf.numpages,
        wordCount: this.estimateWordCount(pdf.text),
        characterCount: pdf.text.length,
        custom: {
          producer: pdf.info?.Producer,
          creator: pdf.info?.Creator,
          pdfVersion: pdf.version,
        },
      };

      // Create elements from text
      result.elements = this.createElements(pdf.text, pdf.numpages);

      // Handle page range
      if (options?.pageRange) {
        const { start, end } = options.pageRange;
        result.elements = result.elements.filter(
          (el) =>
            el.pageNumber && el.pageNumber >= start && el.pageNumber <= end,
        );
        result.text = result.elements.map((el) => el.text).join('\n\n');
      }
    } catch (error) {
      // Handle password-protected PDFs
      if (
        error instanceof Error &&
        error.message.includes('encrypted') &&
        !options?.password
      ) {
        throw new Error(
          'PDF is password protected. Please provide a password.',
        );
      }
      throw error;
    }

    if (warnings.length > 0) {
      result.warnings = warnings;
    }

    return result;
  }

  /**
   * Create elements from PDF text
   */
  private createElements(text: string, pageCount: number): Element[] {
    const elements: Element[] = [];

    // Split by page breaks or double newlines
    const paragraphs = text.split(/\n\n+/);

    for (let i = 0; i < paragraphs.length; i++) {
      const para = paragraphs[i].trim();
      if (!para) continue;

      // Estimate page number (rough approximation)
      const estimatedPage = Math.min(
        Math.ceil(((i + 1) / paragraphs.length) * pageCount),
        pageCount,
      );

      // Detect element type
      const type = this.detectElementType(para);

      elements.push(this.createElement(type, para, estimatedPage));
    }

    return elements;
  }

  /**
   * Detect element type from text
   */
  private detectElementType(text: string): Element['type'] {
    // Check for heading patterns
    if (text.length < 100 && /^[A-Z0-9]/.test(text) && !text.endsWith('.')) {
      if (/^\d+\.?\s+[A-Z]/.test(text)) {
        return 'heading';
      }
      if (text === text.toUpperCase()) {
        return 'title';
      }
    }

    // Check for list items
    if (/^[-*•]\s/.test(text) || /^\d+[.)]\s/.test(text)) {
      return 'list_item';
    }

    return 'paragraph';
  }

  /**
   * Parse PDF date format
   */
  private parsePDFDate(dateStr: string): Date | undefined {
    try {
      // PDF date format: D:YYYYMMDDHHmmSSOHH'mm
      const match = dateStr.match(
        /D:(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/,
      );
      if (match) {
        const [, year, month, day, hour = '00', min = '00', sec = '00'] = match;
        return new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          parseInt(hour),
          parseInt(min),
          parseInt(sec),
        );
      }
      return new Date(dateStr);
    } catch {
      return undefined;
    }
  }

  /**
   * Custom page renderer for preserving formatting
   */
  private renderPage(_pageData: unknown): string {
    // This is a placeholder - actual implementation would use pdf.js for better formatting
    return '';
  }
}

/**
 * Create PDF parser instance
 */
export function createPDFParser(): PDFParser {
  return new PDFParser();
}
