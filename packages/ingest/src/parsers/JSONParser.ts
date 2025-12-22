/**
 * JSON Parser
 *
 * Parser for JSON documents.
 */

import type {
  ParserCapabilities,
  ParserOptions,
  ParseResult,
  Element,
  TableData,
} from '../types/index.js';
import { BaseParser } from './BaseParser.js';

/**
 * JSON document parser
 */
export class JSONParser extends BaseParser {
  readonly name = 'json-parser';
  readonly supportedMimeTypes = ['application/json', 'text/json'];
  readonly supportedExtensions = ['json', 'jsonl'];
  readonly capabilities: ParserCapabilities = {
    text: true,
    structure: true,
    tables: true,
    images: false,
    metadata: true,
    streaming: false,
  };

  /**
   * Parse JSON document
   */
  parse(buffer: Buffer, options?: ParserOptions): Promise<ParseResult> {
    const result = this.createEmptyResult('json');
    const content = buffer.toString('utf-8');

    try {
      // Check if it's JSONL (JSON Lines)
      if (content.includes('\n') && this.isJSONLines(content)) {
        return this.parseJSONLines(content, options);
      }

      // Parse JSON
      const data = JSON.parse(content);

      // Extract structure
      result.elements = this.extractElements(data, '');

      // Create text representation
      result.text = this.createTextRepresentation(data);

      // Extract tables from arrays of objects
      result.tables = this.extractTables(data);

      // Metadata
      result.metadata = {
        wordCount: this.estimateWordCount(result.text),
        characterCount: result.text.length,
        custom: {
          type: Array.isArray(data) ? 'array' : typeof data,
          itemCount: Array.isArray(data)
            ? data.length
            : Object.keys(data).length,
        },
      };
    } catch (error) {
      return Promise.reject(
        new Error(
          `Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }

    return Promise.resolve(result);
  }

  /**
   * Check if content is JSON Lines format
   */
  private isJSONLines(content: string): boolean {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return false;

    try {
      // Try parsing first two lines as separate JSON objects
      JSON.parse(lines[0]);
      JSON.parse(lines[1]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Parse JSON Lines format
   */
  private parseJSONLines(
    content: string,
    _options?: ParserOptions,
  ): Promise<ParseResult> {
    const result = this.createEmptyResult('json');
    const lines = content.trim().split('\n');
    const items: unknown[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        items.push(JSON.parse(line));
      } catch {
        // Skip invalid lines
      }
    }

    // Create text representation
    result.text = items
      .map((item) => JSON.stringify(item, null, 2))
      .join('\n\n');

    // Create elements
    result.elements = items.map((item, i) =>
      this.createElement(
        'paragraph',
        JSON.stringify(item, null, 2),
        undefined,
        { index: i, type: 'json_object' },
      ),
    );

    // Extract tables if all items are objects with same keys
    if (
      items.length > 0 &&
      items.every((item) => typeof item === 'object' && item !== null)
    ) {
      const tables = this.extractTablesFromArray(
        items as Record<string, unknown>[],
      );
      result.tables = tables;
    }

    result.metadata = {
      wordCount: this.estimateWordCount(result.text),
      characterCount: result.text.length,
      custom: {
        type: 'jsonl',
        itemCount: items.length,
      },
    };

    return Promise.resolve(result);
  }

  /**
   * Extract elements from JSON data
   */
  private extractElements(data: unknown, path: string): Element[] {
    const elements: Element[] = [];

    if (data === null || data === undefined) {
      return elements;
    }

    if (Array.isArray(data)) {
      // Create element for array
      const arrayElement = this.createElement(
        'list',
        `Array with ${data.length} items`,
        undefined,
        { path, type: 'array', itemCount: data.length },
      );

      // Process array items
      const children: Element[] = [];
      for (let i = 0; i < data.length; i++) {
        const itemPath = `${path}[${i}]`;
        const item = data[i];

        if (typeof item === 'object' && item !== null) {
          children.push(...this.extractElements(item, itemPath));
        } else {
          children.push(
            this.createElement('list_item', String(item), undefined, {
              path: itemPath,
              index: i,
            }),
          );
        }
      }

      arrayElement.children = children;
      elements.push(arrayElement);
    } else if (typeof data === 'object') {
      // Process object properties
      for (const [key, value] of Object.entries(data)) {
        const propPath = path ? `${path}.${key}` : key;

        if (typeof value === 'object' && value !== null) {
          // Create heading for nested object/array
          elements.push(
            this.createElement('heading', key, undefined, {
              path: propPath,
              type: Array.isArray(value) ? 'array' : 'object',
            }),
          );
          elements.push(...this.extractElements(value, propPath));
        } else {
          // Create element for primitive value
          elements.push(
            this.createElement('paragraph', `${key}: ${value}`, undefined, {
              path: propPath,
              key,
              value,
            }),
          );
        }
      }
    }

    return elements;
  }

  /**
   * Create text representation of JSON data
   */
  private createTextRepresentation(data: unknown, indent = 0): string {
    const lines: string[] = [];
    const prefix = '  '.repeat(indent);

    if (data === null || data === undefined) {
      return '';
    }

    if (Array.isArray(data)) {
      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        if (typeof item === 'object' && item !== null) {
          lines.push(`${prefix}- Item ${i + 1}:`);
          lines.push(this.createTextRepresentation(item, indent + 1));
        } else {
          lines.push(`${prefix}- ${item}`);
        }
      }
    } else if (typeof data === 'object') {
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'object' && value !== null) {
          lines.push(`${prefix}${key}:`);
          lines.push(this.createTextRepresentation(value, indent + 1));
        } else {
          lines.push(`${prefix}${key}: ${value}`);
        }
      }
    } else {
      lines.push(`${prefix}${String(data)}`);
    }

    return lines.join('\n');
  }

  /**
   * Extract tables from JSON data
   */
  private extractTables(data: unknown): TableData[] {
    const tables: TableData[] = [];

    if (Array.isArray(data) && data.length > 0) {
      // Check if it's an array of objects with consistent keys
      const firstItem = data[0];
      if (typeof firstItem === 'object' && firstItem !== null) {
        tables.push(
          ...this.extractTablesFromArray(data as Record<string, unknown>[]),
        );
      }
    } else if (typeof data === 'object' && data !== null) {
      // Look for arrays in object properties
      for (const [key, value] of Object.entries(data)) {
        if (Array.isArray(value) && value.length > 0) {
          const firstItem = value[0];
          if (typeof firstItem === 'object' && firstItem !== null) {
            const extractedTables = this.extractTablesFromArray(
              value as Record<string, unknown>[],
            );
            // Add caption with property name
            for (const table of extractedTables) {
              table.caption = key;
            }
            tables.push(...extractedTables);
          }
        }
      }
    }

    return tables;
  }

  /**
   * Extract tables from array of objects
   */
  private extractTablesFromArray(
    items: Record<string, unknown>[],
  ): TableData[] {
    if (items.length === 0) return [];

    // Get all unique keys
    const allKeys = new Set<string>();
    for (const item of items) {
      for (const key of Object.keys(item)) {
        allKeys.add(key);
      }
    }

    const headers = Array.from(allKeys);
    const rows: string[][] = items.map((item) =>
      headers.map((key) => {
        const value = item[key];
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
      }),
    );

    return [this.createTable(headers, rows)];
  }
}

/**
 * Create JSON parser instance
 */
export function createJSONParser(): JSONParser {
  return new JSONParser();
}
