/**
 * Text Parser
 *
 * Parser for plain text documents.
 */

import type {
  ParserCapabilities,
  ParserOptions,
  ParseResult,
  Element,
} from '../types/index.js';
import { BaseParser } from './BaseParser.js';

/**
 * Plain text document parser
 */
export class TextParser extends BaseParser {
  readonly name = 'text-parser';
  readonly supportedMimeTypes = ['text/plain'];
  readonly supportedExtensions = ['txt', 'text', 'log'];
  readonly capabilities: ParserCapabilities = {
    text: true,
    structure: true,
    tables: false,
    images: false,
    metadata: false,
    streaming: true,
  };

  /**
   * Parse text document
   */
  parse(buffer: Buffer, options?: ParserOptions): Promise<ParseResult> {
    const result = this.createEmptyResult('txt');

    // Detect encoding (simplified - always use utf-8 for now)
    const encoding = (options?.custom?.encoding as string) || 'utf-8';
    const text = buffer.toString(encoding as BufferEncoding);

    result.text = text;
    result.elements = this.extractElements(text);
    result.metadata = {
      wordCount: this.estimateWordCount(text),
      characterCount: text.length,
      custom: {
        lineCount: text.split('\n').length,
        encoding,
      },
    };

    return Promise.resolve(result);
  }

  /**
   * Parse text stream
   */
  async *parseStream(
    stream: NodeJS.ReadableStream,
    _options?: ParserOptions,
  ): AsyncIterableIterator<Element> {
    let buffer = '';
    let paragraphIndex = 0;

    for await (const chunk of stream) {
      buffer += chunk.toString();

      // Look for paragraph breaks
      const paragraphs = buffer.split(/\n\n+/);

      // Yield complete paragraphs, keep the last one (may be incomplete)
      while (paragraphs.length > 1) {
        const para = paragraphs.shift()!.trim();
        if (para) {
          yield this.createElement('paragraph', para, undefined, {
            index: paragraphIndex++,
          });
        }
      }

      buffer = paragraphs[0];
    }

    // Yield remaining content
    if (buffer.trim()) {
      yield this.createElement('paragraph', buffer.trim(), undefined, {
        index: paragraphIndex,
      });
    }
  }

  /**
   * Extract elements from text
   */
  private extractElements(text: string): Element[] {
    const elements: Element[] = [];
    const paragraphs = text.split(/\n\n+/);

    for (let i = 0; i < paragraphs.length; i++) {
      const para = paragraphs[i].trim();
      if (!para) continue;

      const type = this.detectElementType(para);
      elements.push(this.createElement(type, para, undefined, { index: i }));
    }

    return elements;
  }

  /**
   * Detect element type from text content
   */
  private detectElementType(text: string): Element['type'] {
    // Check for list items
    const lines = text.split('\n');
    const listPatterns = [/^[-*•]\s/, /^\d+[.)]\s/, /^[a-z][.)]\s/i];

    if (lines.every((line) => listPatterns.some((p) => p.test(line.trim())))) {
      return 'list';
    }

    // Check for code-like content
    if (
      text.includes('function ') ||
      text.includes('const ') ||
      text.includes('class ') ||
      /^[\s]*[{[(]/.test(text)
    ) {
      return 'code';
    }

    // Check for heading-like content
    if (text.length < 100 && !text.includes('.') && /^[A-Z0-9]/.test(text)) {
      return 'heading';
    }

    return 'paragraph';
  }
}

/**
 * Create text parser instance
 */
export function createTextParser(): TextParser {
  return new TextParser();
}
