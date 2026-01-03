/**
 * HTML Parser
 *
 * Parser for HTML documents using cheerio.
 */

import type {
  ParserCapabilities,
  ParseResult,
  HTMLParserOptions,
  Element,
  TableData,
  ImageData,
  DocumentMetadata,
} from '../types/index.js';
import { BaseParser } from './BaseParser.js';

// Use type alias for cheerio's complex types
type CheerioAPI = ReturnType<typeof import('cheerio').load>;

/**
 * HTML document parser
 */
export class HTMLParser extends BaseParser {
  readonly name = 'html-parser';
  readonly supportedMimeTypes = ['text/html', 'application/xhtml+xml'];
  readonly supportedExtensions = ['html', 'htm', 'xhtml'];
  readonly capabilities: ParserCapabilities = {
    text: true,
    structure: true,
    tables: true,
    images: true,
    metadata: true,
    streaming: false,
  };

  /**
   * Parse HTML document
   */
  async parse(
    buffer: Buffer,
    options?: HTMLParserOptions,
  ): Promise<ParseResult> {
    const result = this.createEmptyResult('html');
    const html = buffer.toString('utf-8');

    try {
      // Dynamic import of cheerio
      const cheerio = await import('cheerio');
      const $ = cheerio.load(html);

      // Remove excluded elements
      if (options?.excludeSelectors) {
        for (const selector of options.excludeSelectors) {
          $(selector).remove();
        }
      }

      // Get content container
      const contentSelector = options?.contentSelector ?? 'body';
      const $content = $(contentSelector);

      // Extract metadata
      result.metadata = this.extractMetadata($);

      // Extract elements
      result.elements = this.extractElements($, $content, options);

      // Extract tables
      if (options?.extractTables !== false) {
        result.tables = this.extractTables($, $content);
      }

      // Extract images
      if (options?.extractImages !== false) {
        result.images = this.extractImages($, $content, options?.baseUrl);
      }

      // Extract text
      result.text = this.extractText($content);
    } catch (error) {
      throw new Error(
        `Failed to parse HTML: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return result;
  }

  /**
   * Extract metadata from HTML
   */
  private extractMetadata($: CheerioAPI): DocumentMetadata {
    const metadata: DocumentMetadata = {};

    // Title
    metadata.title = $('title').text().trim() || $('h1').first().text().trim();

    // Meta tags
    $('meta').each(function () {
      const $el = $(this);
      const name = $el.attr('name') ?? $el.attr('property');
      const content = $el.attr('content');

      if (name && content) {
        switch (name.toLowerCase()) {
          case 'author':
          case 'article:author':
            metadata.author = content;
            break;
          case 'description':
          case 'og:description':
            metadata.custom = { ...metadata.custom, description: content };
            break;
          case 'keywords':
            metadata.custom = { ...metadata.custom, keywords: content };
            break;
          case 'language':
            metadata.language = content;
            break;
        }
      }
    });

    // HTML lang attribute
    if (!metadata.language) {
      const lang = $('html').attr('lang');
      if (lang) {
        metadata.language = lang;
      }
    }

    return metadata;
  }

  /**
   * Extract elements from HTML
   */
  private extractElements(
    $: CheerioAPI,
    $content: ReturnType<CheerioAPI>,
    options?: HTMLParserOptions,
  ): Element[] {
    const elements: Element[] = [];

    // Process headings
    $content.find('h1, h2, h3, h4, h5, h6').each(function () {
      const $el = $(this);
      const tagName =
        (this as unknown as { tagName: string }).tagName?.toLowerCase() ?? 'h1';
      const level = parseInt(tagName.charAt(1));
      const text = $el.text().trim();
      if (text) {
        elements.push({
          type: level === 1 ? 'title' : 'heading',
          text,
          metadata: { level },
        });
      }
    });

    // Process paragraphs
    $content.find('p').each(function () {
      const text = $(this).text().trim();
      if (text) {
        elements.push({ type: 'paragraph', text });
      }
    });

    // Process lists
    $content.find('ul, ol').each(function () {
      const $list = $(this);
      const tagName =
        (this as unknown as { tagName: string }).tagName?.toLowerCase() ?? 'ul';
      const isOrdered = tagName === 'ol';
      const items: Element[] = [];

      $list.children('li').each(function (i: number) {
        const text = $(this).text().trim();
        if (text) {
          items.push({ type: 'list_item', text, metadata: { index: i } });
        }
      });

      if (items.length > 0) {
        const listElement: Element = {
          type: 'list',
          text: items.map((i) => i.text).join('\n'),
          metadata: { ordered: isOrdered },
          children: items,
        };
        elements.push(listElement);
      }
    });

    // Process blockquotes
    $content.find('blockquote').each(function () {
      const text = $(this).text().trim();
      if (text) {
        elements.push({ type: 'quote', text });
      }
    });

    // Process code blocks
    $content.find('pre code, pre').each(function () {
      const $el = $(this);
      const text = $el.text().trim();
      const language = $el.attr('class')?.match(/language-(\w+)/)?.[1];
      if (text) {
        elements.push({ type: 'code', text, metadata: { language } });
      }
    });

    // Process links if requested
    if (options?.extractLinks) {
      $content.find('a[href]').each(function () {
        const $el = $(this);
        const href = $el.attr('href');
        const text = $el.text().trim();
        if (href && text) {
          let url = href;
          if (options.baseUrl && !href.startsWith('http')) {
            url = new URL(href, options.baseUrl).toString();
          }
          elements.push({ type: 'link', text, metadata: { url } });
        }
      });
    }

    return elements;
  }

  /**
   * Extract tables from HTML
   */
  private extractTables(
    $: CheerioAPI,
    $content: ReturnType<CheerioAPI>,
  ): TableData[] {
    const tables: TableData[] = [];

    $content.find('table').each(function () {
      const $table = $(this);
      const headers: string[] = [];
      const rows: string[][] = [];

      // Get caption
      const caption = $table.find('caption').text().trim();

      // Get headers
      $table.find('thead th, thead td').each(function () {
        headers.push($(this).text().trim());
      });

      // If no thead, use first row
      if (headers.length === 0) {
        $table.find('tr:first-child th, tr:first-child td').each(function () {
          headers.push($(this).text().trim());
        });
      }

      // Get rows - look in tbody if it exists, otherwise use tr outside thead
      const hasThead = $table.find('thead').length > 0;
      const $rows = hasThead ? $table.find('tbody tr') : $table.find('tr');
      const skipFirst = headers.length > 0 && !hasThead;
      $rows.each(function (i: number) {
        if (skipFirst && i === 0) return;

        const row: string[] = [];
        $(this)
          .find('td')
          .each(function () {
            row.push($(this).text().trim());
          });

        if (row.length > 0) {
          rows.push(row);
        }
      });

      if (headers.length > 0 || rows.length > 0) {
        tables.push({
          id: `table-${tables.length}`,
          headers,
          rows,
          caption: caption || undefined,
        });
      }
    });

    return tables;
  }

  /**
   * Extract images from HTML
   */
  private extractImages(
    $: CheerioAPI,
    $content: ReturnType<CheerioAPI>,
    baseUrl?: string,
  ): ImageData[] {
    const images: ImageData[] = [];

    $content.find('img').each(function () {
      const $img = $(this);
      const src = $img.attr('src');
      const alt = $img.attr('alt');
      const width = parseInt($img.attr('width') ?? '0');
      const height = parseInt($img.attr('height') ?? '0');

      if (src) {
        let url = src;
        let base64: string | undefined;
        let format = 'unknown';

        // Handle base64 images
        if (src.startsWith('data:image')) {
          const match = src.match(/data:image\/(\w+);base64,(.+)/);
          if (match) {
            format = match[1];
            base64 = match[2];
          }
        } else {
          // Resolve relative URLs
          if (baseUrl && !src.startsWith('http')) {
            url = new URL(src, baseUrl).toString();
          }
          // Detect format from extension
          const extMatch = src.match(/\.(\w+)(?:\?|$)/);
          if (extMatch) {
            format = extMatch[1].toLowerCase();
          }
        }

        images.push({
          id: `img-${images.length}`,
          width,
          height,
          format,
          url: base64 ? undefined : url,
          base64,
          altText: alt ?? undefined,
        });
      }
    });

    return images;
  }

  /**
   * Extract clean text from HTML
   */
  private extractText($content: ReturnType<CheerioAPI>): string {
    // Remove script and style tags
    $content.find('script, style, noscript').remove();

    // Get text with spacing
    return $content
      .text()
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  }
}

/**
 * Create HTML parser instance
 */
export function createHTMLParser(): HTMLParser {
  return new HTMLParser();
}
