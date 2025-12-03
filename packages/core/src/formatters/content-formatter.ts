import { marked } from 'marked';
import { OutputFormat, FormattedContent, FormatOptions } from '../types';

/**
 * Content formatter for converting raw text to various formats
 */
export class ContentFormatter {
  /**
   * Format content based on the specified output format
   */
  static format(
    content: string,
    format: OutputFormat,
    options: FormatOptions = {},
  ): FormattedContent {
    switch (format) {
      case 'text':
        return this.formatText(content, options);
      case 'markdown':
        return this.formatMarkdown(content, options);
      case 'html':
        return this.formatHtml(content, options);
      case 'react':
        return this.formatReact(content, options);
      default:
        return this.formatText(content, options);
    }
  }

  /**
   * Format as plain text (no processing)
   */
  private static formatText(
    content: string,
    options: FormatOptions,
  ): FormattedContent {
    return {
      raw: content,
      format: 'text',
      rendered: content,
      metadata: options.includeMetadata
        ? this.extractMetadata(content)
        : undefined,
    };
  }

  /**
   * Format as markdown (validate and optionally enhance)
   */
  private static formatMarkdown(
    content: string,
    options: FormatOptions,
  ): FormattedContent {
    return {
      raw: content,
      format: 'markdown',
      rendered: content,
      metadata: options.includeMetadata
        ? this.extractMetadata(content)
        : undefined,
    };
  }

  /**
   * Format as HTML using marked
   */
  private static formatHtml(
    content: string,
    options: FormatOptions,
  ): FormattedContent {
    // Configure marked with options
    marked.setOptions({
      gfm: true,
      breaks: true,
    });

    let html = marked.parse(content) as string;

    // Sanitize HTML if requested
    if (options.sanitizeHtml) {
      html = this.sanitizeHtml(html);
    }

    // Add syntax highlighting classes if requested
    if (options.highlightCode) {
      html = this.addCodeHighlighting(html);
    }

    // Wrap in themed container if theme is specified
    if (options.theme) {
      html = this.wrapWithTheme(html, options.theme);
    }

    return {
      raw: content,
      format: 'html',
      rendered: html,
      metadata: options.includeMetadata
        ? this.extractMetadata(content)
        : undefined,
    };
  }

  /**
   * Format for React (returns HTML with data attributes for React hydration)
   */
  private static formatReact(
    content: string,
    options: FormatOptions,
  ): FormattedContent {
    // Parse markdown to HTML
    const html = marked.parse(content) as string;

    // Add React-friendly data attributes
    const reactHtml = this.addReactAttributes(html);

    return {
      raw: content,
      format: 'react',
      rendered: reactHtml,
      metadata: options.includeMetadata
        ? this.extractMetadata(content)
        : undefined,
    };
  }

  /**
   * Extract metadata from content
   */
  private static extractMetadata(content: string) {
    const metadata: FormattedContent['metadata'] = {
      hasCodeBlocks: false,
      hasTables: false,
      hasLists: false,
      links: [],
    };

    // Detect code blocks
    metadata.hasCodeBlocks = /```[\s\S]*?```|`[^`]+`/.test(content);

    // Detect tables
    metadata.hasTables = /\|.*\|/.test(content);

    // Detect lists
    metadata.hasLists = /^[\s]*[-*+]\s|^[\s]*\d+\.\s/m.test(content);

    // Extract links
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    while ((match = linkRegex.exec(content)) !== null) {
      metadata.links?.push({
        text: match[1],
        url: match[2],
      });
    }

    return metadata;
  }

  /**
   * Basic HTML sanitization (removes potentially dangerous tags)
   */
  private static sanitizeHtml(html: string): string {
    // Remove script tags
    html = html.replace(
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      '',
    );

    // Remove event handlers
    html = html.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '');

    // Remove javascript: protocol
    html = html.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, '');

    return html;
  }

  /**
   * Add syntax highlighting classes to code blocks
   */
  private static addCodeHighlighting(html: string): string {
    // Add language class to code blocks for syntax highlighting
    return html.replace(
      /<pre><code class="language-(\w+)">/g,
      '<pre><code class="language-$1 hljs">',
    );
  }

  /**
   * Wrap HTML with theme container
   */
  private static wrapWithTheme(html: string, theme: string): string {
    return `<div class="agentsea-content" data-theme="${theme}">${html}</div>`;
  }

  /**
   * Add React-friendly data attributes
   */
  private static addReactAttributes(html: string): string {
    // Add data-component attributes for React hydration
    html = html.replace(/<pre>/g, '<pre data-component="code-block">');
    html = html.replace(/<table>/g, '<table data-component="table">');
    html = html.replace(/<a /g, '<a data-component="link" ');

    return html;
  }

  /**
   * Detect the likely format of content
   */
  static detectFormat(content: string): OutputFormat {
    // Check for HTML tags
    if (/<[a-z][\s\S]*>/i.test(content)) {
      return 'html';
    }

    // Check for markdown patterns
    if (/^#{1,6}\s|```|\[.+\]\(.+\)|\*\*.+\*\*|__.+__/.test(content)) {
      return 'markdown';
    }

    // Default to text
    return 'text';
  }
}
