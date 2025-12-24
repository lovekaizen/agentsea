/**
 * DOCX Parser
 *
 * Parser for Microsoft Word documents using mammoth.
 */

import type {
  ParserCapabilities,
  ParseResult,
  DOCXParserOptions,
  Element,
  TableData,
  ImageData,
} from '../types/index.js';
import { BaseParser } from './BaseParser.js';

/**
 * DOCX document parser
 */
export class DOCXParser extends BaseParser {
  readonly name = 'docx-parser';
  readonly supportedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  readonly supportedExtensions = ['docx'];
  readonly capabilities: ParserCapabilities = {
    text: true,
    structure: true,
    tables: true,
    images: true,
    metadata: true,
    streaming: false,
  };

  /**
   * Parse DOCX document
   */
  async parse(
    buffer: Buffer,
    options?: DOCXParserOptions,
  ): Promise<ParseResult> {
    const result = this.createEmptyResult('docx');
    const warnings: string[] = [];

    try {
      // Dynamic import of mammoth
      const mammoth = await import('mammoth');

      // Extract raw text
      const textResult = await mammoth.extractRawText({ buffer });
      result.text = textResult.value;

      // Extract HTML for structure
      const htmlResult = await mammoth.convertToHtml({ buffer });

      if (htmlResult.messages.length > 0) {
        warnings.push(
          ...htmlResult.messages
            .filter((m) => m.type === 'warning')
            .map((m) => m.message),
        );
      }

      // Parse HTML to extract structure
      const { elements, tables, images } = await this.parseHtmlStructure(
        htmlResult.value,
        options,
      );

      result.elements = elements;
      result.tables = tables;
      result.images = images;

      // Extract metadata
      result.metadata = {
        wordCount: this.estimateWordCount(result.text),
        characterCount: result.text.length,
      };
    } catch (error) {
      throw new Error(
        `Failed to parse DOCX: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (warnings.length > 0) {
      result.warnings = warnings;
    }

    return result;
  }

  /**
   * Parse HTML structure from mammoth output
   */
  private async parseHtmlStructure(
    html: string,
    options?: DOCXParserOptions,
  ): Promise<{
    elements: Element[];
    tables: TableData[];
    images: ImageData[];
  }> {
    const elements: Element[] = [];
    const tables: TableData[] = [];
    const images: ImageData[] = [];

    try {
      // Dynamic import of cheerio
      const cheerio = await import('cheerio');
      const $ = cheerio.load(html);

      // Process headings
      $('h1, h2, h3, h4, h5, h6').each((_, el) => {
        const $el = $(el);
        const level = parseInt(el.tagName.charAt(1));
        elements.push(
          this.createElement(
            level === 1 ? 'title' : 'heading',
            $el.text().trim(),
            undefined,
            {
              level,
            },
          ),
        );
      });

      // Process paragraphs
      $('p').each((_, el) => {
        const text = $(el).text().trim();
        if (text) {
          elements.push(this.createElement('paragraph', text));
        }
      });

      // Process lists
      $('ul, ol').each((_, el) => {
        const $list = $(el);
        const isOrdered = el.tagName === 'ol';
        const listElement = this.createElement('list', '', undefined, {
          ordered: isOrdered,
        });

        const children: Element[] = [];
        $list.find('li').each((i, li) => {
          children.push(
            this.createElement('list_item', $(li).text().trim(), undefined, {
              index: i,
            }),
          );
        });

        listElement.children = children;
        listElement.text = children.map((c) => c.text).join('\n');
        elements.push(listElement);
      });

      // Process tables
      $('table').each((_, table) => {
        const $table = $(table);
        const headers: string[] = [];
        const rows: string[][] = [];

        // Get headers
        $table.find('thead tr th, thead tr td').each((_, th) => {
          headers.push($(th).text().trim());
        });

        // Get rows
        $table.find('tbody tr').each((_, tr) => {
          const row: string[] = [];
          $(tr)
            .find('td')
            .each((_, td) => {
              row.push($(td).text().trim());
            });
          if (row.length > 0) {
            rows.push(row);
          }
        });

        // If no thead, try first row as header
        if (headers.length === 0 && rows.length > 0) {
          $table.find('tr:first-child td, tr:first-child th').each((_, td) => {
            headers.push($(td).text().trim());
          });
          // Get remaining rows
          rows.length = 0;
          $table.find('tr:not(:first-child)').each((_, tr) => {
            const row: string[] = [];
            $(tr)
              .find('td')
              .each((_, td) => {
                row.push($(td).text().trim());
              });
            if (row.length > 0) {
              rows.push(row);
            }
          });
        }

        if (headers.length > 0 || rows.length > 0) {
          tables.push(this.createTable(headers, rows));
        }
      });

      // Process images
      if (options?.extractImages !== false) {
        $('img').each((_, img) => {
          const $img = $(img);
          const src = $img.attr('src') ?? '';
          const alt = $img.attr('alt') ?? '';

          // Handle base64 images
          if (src.startsWith('data:image')) {
            const match = src.match(/data:image\/(\w+);base64,(.+)/);
            if (match) {
              const [, format, base64] = match;
              images.push(
                this.createImage(0, 0, format, {
                  base64,
                  altText: alt,
                }),
              );
            }
          } else if (src) {
            images.push(
              this.createImage(0, 0, 'unknown', {
                url: src,
                altText: alt,
              }),
            );
          }
        });
      }
    } catch (error) {
      // Fallback: just extract text elements
      const paragraphs = html
        .replace(/<[^>]+>/g, '\n')
        .split(/\n+/)
        .filter((p) => p.trim());
      for (const para of paragraphs) {
        elements.push(this.createElement('paragraph', para.trim()));
      }
    }

    return { elements, tables, images };
  }
}

/**
 * Create DOCX parser instance
 */
export function createDOCXParser(): DOCXParser {
  return new DOCXParser();
}
