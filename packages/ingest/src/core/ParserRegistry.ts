/**
 * Parser Registry
 *
 * Registry for document parsers with automatic detection.
 */

import type {
  Parser,
  ParserOptions,
  ParserRegistryConfig,
  ParseResult,
} from '../types/index.js';
import { getBuiltInParsers } from '../parsers/index.js';

/**
 * MIME type to extension mapping
 */
const MIME_TO_EXTENSION: Record<string, string[]> = {
  'application/pdf': ['pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    'docx',
  ],
  'application/msword': ['doc'],
  'text/html': ['html', 'htm'],
  'text/markdown': ['md', 'markdown'],
  'text/plain': ['txt'],
  'text/csv': ['csv'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'application/vnd.ms-excel': ['xls'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': [
    'pptx',
  ],
  'message/rfc822': ['eml'],
  'application/epub+zip': ['epub'],
  'application/json': ['json'],
};

/**
 * Extension to MIME type mapping
 */
const EXTENSION_TO_MIME: Record<string, string> = {};
for (const [mime, exts] of Object.entries(MIME_TO_EXTENSION)) {
  for (const ext of exts) {
    EXTENSION_TO_MIME[ext] = mime;
  }
}

/**
 * Parser registry for managing document parsers
 */
export class ParserRegistry {
  private parsers: Map<string, Parser> = new Map();
  private mimeTypeOverrides: Map<string, Parser> = new Map();
  private defaultOptions: ParserOptions;

  constructor(config: ParserRegistryConfig = {}) {
    this.defaultOptions = config.defaultOptions ?? {};

    // Register built-in parsers by default unless explicitly disabled
    if (config.registerBuiltIns !== false) {
      for (const parser of getBuiltInParsers()) {
        this.register(parser);
      }
    }

    // Register custom parsers
    if (config.customParsers) {
      for (const parser of config.customParsers) {
        this.register(parser);
      }
    }

    // Register MIME type overrides
    if (config.mimeTypeOverrides) {
      for (const [mimeType, parser] of Object.entries(
        config.mimeTypeOverrides,
      )) {
        this.mimeTypeOverrides.set(mimeType, parser);
      }
    }
  }

  /**
   * Register a parser
   */
  register(parser: Parser): void {
    this.parsers.set(parser.name, parser);
  }

  /**
   * Unregister a parser
   */
  unregister(name: string): void {
    this.parsers.delete(name);
  }

  /**
   * Get parser by name
   */
  get(name: string): Parser | undefined {
    return this.parsers.get(name);
  }

  /**
   * Find parser for MIME type and/or extension
   */
  findParser(mimeType?: string, extension?: string): Parser | undefined {
    // Check MIME type overrides first
    if (mimeType && this.mimeTypeOverrides.has(mimeType)) {
      return this.mimeTypeOverrides.get(mimeType);
    }

    // Try to find parser that can handle this content
    for (const parser of this.parsers.values()) {
      if (parser.canParse(mimeType ?? '', extension)) {
        return parser;
      }
    }

    return undefined;
  }

  /**
   * Parse document with automatic parser detection
   */
  async parse(
    buffer: Buffer,
    mimeType?: string,
    extension?: string,
    options?: ParserOptions,
  ): Promise<ParseResult> {
    let parser = this.findParser(mimeType, extension);

    // If no parser found and no MIME type or extension provided, try text parser as fallback
    if (!parser && !mimeType && !extension) {
      parser = this.findParser('text/plain', 'txt');
    }

    if (!parser) {
      throw new Error(
        `No parser found for MIME type "${mimeType}" or extension "${extension}"`,
      );
    }

    const mergedOptions = { ...this.defaultOptions, ...options };
    return parser.parse(buffer, mergedOptions);
  }

  /**
   * Check if a MIME type or extension is supported
   */
  isSupported(mimeType?: string, extension?: string): boolean {
    return this.findParser(mimeType, extension) !== undefined;
  }

  /**
   * Get all registered parsers
   */
  getAll(): Parser[] {
    return Array.from(this.parsers.values());
  }

  /**
   * Get all supported MIME types
   */
  getSupportedMimeTypes(): string[] {
    const mimeTypes = new Set<string>();
    for (const parser of this.parsers.values()) {
      for (const mimeType of parser.supportedMimeTypes) {
        mimeTypes.add(mimeType);
      }
    }
    return Array.from(mimeTypes);
  }

  /**
   * Get all supported extensions
   */
  getSupportedExtensions(): string[] {
    const extensions = new Set<string>();
    for (const parser of this.parsers.values()) {
      for (const ext of parser.supportedExtensions) {
        extensions.add(ext);
      }
    }
    return Array.from(extensions);
  }

  /**
   * Detect MIME type from extension
   */
  static detectMimeType(extension: string): string | undefined {
    const ext = extension.toLowerCase().replace(/^\./, '');
    return EXTENSION_TO_MIME[ext];
  }

  /**
   * Detect extension from MIME type
   */
  static detectExtension(mimeType: string): string | undefined {
    const extensions = MIME_TO_EXTENSION[mimeType];
    return extensions?.[0];
  }

  /**
   * Extract extension from filename
   */
  static getExtension(filename: string): string {
    const match = filename.match(/\.([^.]+)$/);
    return match ? match[1].toLowerCase() : '';
  }
}

/**
 * Create a new parser registry
 */
export function createParserRegistry(
  config?: ParserRegistryConfig,
): ParserRegistry {
  return new ParserRegistry(config);
}
