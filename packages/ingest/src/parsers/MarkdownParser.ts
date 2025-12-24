/**
 * Markdown Parser
 *
 * Parser for Markdown documents using marked.
 */

import type {
  ParserCapabilities,
  ParseResult,
  MarkdownParserOptions,
  Element,
  TableData,
  ImageData,
} from '../types/index.js';
import { BaseParser } from './BaseParser.js';

// Type for marked tokens
interface MarkedToken {
  type: string;
  text?: string;
  raw?: string;
  depth?: number;
  items?: Array<{ text: string }>;
  ordered?: boolean;
  lang?: string;
  header?: Array<{ text: string }>;
  rows?: Array<Array<{ text: string }>>;
  href?: string;
  title?: string;
  tokens?: MarkedToken[];
}

/**
 * Markdown document parser
 */
export class MarkdownParser extends BaseParser {
  readonly name = 'markdown-parser';
  readonly supportedMimeTypes = ['text/markdown', 'text/x-markdown'];
  readonly supportedExtensions = ['md', 'markdown', 'mdown', 'mkd'];
  readonly capabilities: ParserCapabilities = {
    text: true,
    structure: true,
    tables: true,
    images: true,
    metadata: true,
    streaming: false,
  };

  /**
   * Parse Markdown document
   */
  async parse(
    buffer: Buffer,
    options?: MarkdownParserOptions,
  ): Promise<ParseResult> {
    const result = this.createEmptyResult('markdown');
    let content = buffer.toString('utf-8');

    // Extract frontmatter if enabled
    if (options?.extractFrontmatter !== false) {
      const { frontmatter, body } = this.extractFrontmatter(content);
      if (frontmatter) {
        result.metadata = { ...result.metadata, custom: frontmatter };
      }
      content = body;
    }

    try {
      // Dynamic import of marked
      const { marked } = await import('marked');

      // Configure marked
      marked.setOptions({
        gfm: options?.gfm ?? true,
        breaks: true,
      });

      // Get tokens for structure analysis
      const tokens = marked.lexer(content) as MarkedToken[];

      // Extract elements from tokens
      result.elements = this.extractElements(tokens, options);

      // Extract tables
      if (options?.extractTables !== false) {
        result.tables = this.extractTables(tokens);
      }

      // Extract images
      if (options?.extractImages !== false) {
        result.images = this.extractImages(tokens);
      }

      // Extract plain text
      result.text = this.extractText(tokens, options);

      // Update metadata
      result.metadata = {
        ...result.metadata,
        wordCount: this.estimateWordCount(result.text),
        characterCount: result.text.length,
      };
    } catch (error) {
      throw new Error(
        `Failed to parse Markdown: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return result;
  }

  /**
   * Extract frontmatter from Markdown
   */
  private extractFrontmatter(content: string): {
    frontmatter: Record<string, unknown> | null;
    body: string;
  } {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      return { frontmatter: null, body: content };
    }

    const frontmatterStr = match[1];
    const body = content.slice(match[0].length);

    try {
      // Simple YAML-like parsing
      const frontmatter: Record<string, unknown> = {};
      const lines = frontmatterStr.split('\n');

      for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.slice(0, colonIndex).trim();
          let value: unknown = line.slice(colonIndex + 1).trim();

          // Parse common types
          if (value === 'true') value = true;
          else if (value === 'false') value = false;
          else if (/^\d+$/.test(value as string))
            value = parseInt(value as string);
          else if (/^\d+\.\d+$/.test(value as string))
            value = parseFloat(value as string);
          else if (
            (value as string).startsWith('[') &&
            (value as string).endsWith(']')
          ) {
            value = (value as string)
              .slice(1, -1)
              .split(',')
              .map((v) => v.trim().replace(/^['"]|['"]$/g, ''));
          } else {
            value = (value as string).replace(/^['"]|['"]$/g, '');
          }

          frontmatter[key] = value;
        }
      }

      return { frontmatter, body };
    } catch {
      return { frontmatter: null, body: content };
    }
  }

  /**
   * Extract elements from tokens
   */
  private extractElements(
    tokens: MarkedToken[],
    options?: MarkdownParserOptions,
  ): Element[] {
    const elements: Element[] = [];

    for (const token of tokens) {
      switch (token.type) {
        case 'heading': {
          const depth = token.depth ?? 1;
          elements.push(
            this.createElement(
              depth === 1 ? 'title' : 'heading',
              token.text ?? '',
              undefined,
              { level: depth },
            ),
          );
          break;
        }

        case 'paragraph': {
          elements.push(this.createElement('paragraph', token.text ?? ''));
          break;
        }

        case 'list': {
          const items: Element[] = (token.items ?? []).map((item, i) =>
            this.createElement('list_item', item.text, undefined, { index: i }),
          );

          const listElement = this.createElement(
            'list',
            items.map((i) => i.text).join('\n'),
            undefined,
            { ordered: token.ordered ?? false },
          );
          listElement.children = items;
          elements.push(listElement);
          break;
        }

        case 'blockquote': {
          elements.push(this.createElement('quote', token.text ?? ''));
          break;
        }

        case 'code': {
          if (options?.preserveCodeBlocks) {
            elements.push(
              this.createElement('code', token.text ?? '', undefined, {
                language: token.lang,
                raw: true,
              }),
            );
          } else {
            elements.push(
              this.createElement('code', token.text ?? '', undefined, {
                language: token.lang,
              }),
            );
          }
          break;
        }

        case 'hr': {
          elements.push(this.createElement('page_break', '---'));
          break;
        }
      }
    }

    return elements;
  }

  /**
   * Extract tables from tokens
   */
  private extractTables(tokens: MarkedToken[]): TableData[] {
    const tables: TableData[] = [];

    for (const token of tokens) {
      if (token.type === 'table') {
        const headers = (token.header ?? []).map((h) => h.text);
        const rows = (token.rows ?? []).map((row) =>
          row.map((cell) => cell.text),
        );

        tables.push(this.createTable(headers, rows));
      }
    }

    return tables;
  }

  /**
   * Extract images from tokens
   */
  private extractImages(tokens: MarkedToken[]): ImageData[] {
    const images: ImageData[] = [];

    const extractFromTokens = (toks: MarkedToken[]) => {
      for (const token of toks) {
        if (token.type === 'image') {
          images.push(
            this.createImage(0, 0, this.getImageFormat(token.href ?? ''), {
              url: token.href,
              altText: token.text,
              caption: token.title ?? undefined,
            }),
          );
        }

        // Check for images in paragraph inline tokens
        if (token.tokens && Array.isArray(token.tokens)) {
          extractFromTokens(token.tokens);
        }
      }
    };

    extractFromTokens(tokens);
    return images;
  }

  /**
   * Get image format from URL
   */
  private getImageFormat(url: string): string {
    const match = url.match(/\.(\w+)(?:\?|$)/);
    return match ? match[1].toLowerCase() : 'unknown';
  }

  /**
   * Extract plain text from tokens
   */
  private extractText(
    tokens: MarkedToken[],
    options?: MarkdownParserOptions,
  ): string {
    const textParts: string[] = [];

    const extractText = (toks: MarkedToken[]) => {
      for (const token of toks) {
        switch (token.type) {
          case 'heading':
          case 'paragraph':
          case 'text':
            if (token.text) textParts.push(token.text);
            break;

          case 'list': {
            for (const item of token.items ?? []) {
              textParts.push(item.text);
            }
            break;
          }

          case 'blockquote': {
            if (token.text) textParts.push(token.text);
            break;
          }

          case 'code': {
            if (!options?.preserveCodeBlocks && token.text) {
              textParts.push(token.text);
            }
            break;
          }

          case 'table': {
            textParts.push((token.header ?? []).map((h) => h.text).join(' | '));
            for (const row of token.rows ?? []) {
              textParts.push(row.map((cell) => cell.text).join(' | '));
            }
            break;
          }
        }

        if (token.tokens && Array.isArray(token.tokens)) {
          extractText(token.tokens);
        }
      }
    };

    extractText(tokens);
    return textParts.join('\n\n').trim();
  }
}

/**
 * Create Markdown parser instance
 */
export function createMarkdownParser(): MarkdownParser {
  return new MarkdownParser();
}
