/**
 * CSV Parser
 *
 * Parser for CSV (Comma-Separated Values) documents.
 */

import type {
  ParserCapabilities,
  ParseResult,
  CSVParserOptions,
  Element,
} from '../types/index.js';
import { BaseParser } from './BaseParser.js';

/**
 * CSV document parser
 */
export class CSVParser extends BaseParser {
  readonly name = 'csv-parser';
  readonly supportedMimeTypes = ['text/csv', 'application/csv'];
  readonly supportedExtensions = ['csv', 'tsv'];
  readonly capabilities: ParserCapabilities = {
    text: true,
    structure: true,
    tables: true,
    images: false,
    metadata: true,
    streaming: true,
  };

  /**
   * Parse CSV document
   */
  parse(buffer: Buffer, options?: CSVParserOptions): Promise<ParseResult> {
    const result = this.createEmptyResult('csv');
    const encoding = options?.encoding ?? 'utf-8';
    const content = buffer.toString(encoding);

    // Detect delimiter if not specified
    const delimiter = options?.delimiter ?? this.detectDelimiter(content);
    const quote = options?.quote ?? '"';
    const hasHeader = options?.hasHeader ?? true;

    // Parse CSV content
    const rows = this.parseCSV(content, delimiter, quote);

    if (rows.length === 0) {
      return Promise.resolve(result);
    }

    // Extract headers
    const headers = hasHeader
      ? rows[0]
      : rows[0].map((_, i) => `Column ${i + 1}`);
    const dataRows = hasHeader ? rows.slice(1) : rows;

    // Create table
    const table = this.createTable(headers, dataRows);
    result.tables = [table];

    // Create text representation
    result.text = this.createTextRepresentation(headers, dataRows);

    // Create elements
    result.elements = this.createElements(headers, dataRows);

    // Metadata
    result.metadata = {
      wordCount: this.estimateWordCount(result.text),
      characterCount: result.text.length,
      custom: {
        rowCount: dataRows.length,
        columnCount: headers.length,
        delimiter,
        hasHeader,
      },
    };

    return Promise.resolve(result);
  }

  /**
   * Parse CSV stream
   */
  async *parseStream(
    stream: NodeJS.ReadableStream,
    options?: CSVParserOptions,
  ): AsyncIterableIterator<Element> {
    let buffer = '';
    let isFirstRow = true;
    let headers: string[] = [];
    let rowIndex = 0;

    const delimiter = options?.delimiter ?? ',';
    const quote = options?.quote ?? '"';
    const hasHeader = options?.hasHeader ?? true;

    for await (const chunk of stream) {
      buffer += chunk.toString();

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;

        const row = this.parseRow(line, delimiter, quote);

        if (isFirstRow) {
          isFirstRow = false;
          if (hasHeader) {
            headers = row;
            continue;
          } else {
            headers = row.map((_, i) => `Column ${i + 1}`);
          }
        }

        // Create element for this row
        const rowText = headers
          .map((h, i) => `${h}: ${row[i] ?? ''}`)
          .join(', ');
        yield this.createElement('paragraph', rowText, undefined, {
          rowIndex: rowIndex++,
          rowData: Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ''])),
        });
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      const row = this.parseRow(buffer, delimiter, quote);
      const rowText = headers.map((h, i) => `${h}: ${row[i] ?? ''}`).join(', ');
      yield this.createElement('paragraph', rowText, undefined, {
        rowIndex: rowIndex++,
        rowData: Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ''])),
      });
    }
  }

  /**
   * Detect delimiter from content
   */
  private detectDelimiter(content: string): string {
    const firstLine = content.split('\n')[0];
    const delimiters = [',', '\t', ';', '|'];
    let maxCount = 0;
    let detected = ',';

    for (const delimiter of delimiters) {
      const count = (firstLine.match(new RegExp(delimiter, 'g')) ?? []).length;
      if (count > maxCount) {
        maxCount = count;
        detected = delimiter;
      }
    }

    return detected;
  }

  /**
   * Parse CSV content into rows
   */
  private parseCSV(
    content: string,
    delimiter: string,
    quote: string,
  ): string[][] {
    const rows: string[][] = [];
    const lines = content.split('\n');

    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (const line of lines) {
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (inQuotes) {
          if (char === quote) {
            if (nextChar === quote) {
              // Escaped quote
              currentField += quote;
              i++;
            } else {
              // End of quoted field
              inQuotes = false;
            }
          } else {
            currentField += char;
          }
        } else {
          if (char === quote) {
            inQuotes = true;
          } else if (char === delimiter) {
            currentRow.push(currentField.trim());
            currentField = '';
          } else {
            currentField += char;
          }
        }
      }

      if (!inQuotes) {
        currentRow.push(currentField.trim());
        if (currentRow.some((cell) => cell.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        // Multiline field
        currentField += '\n';
      }
    }

    return rows;
  }

  /**
   * Parse a single CSV row
   */
  private parseRow(line: string, delimiter: string, quote: string): string[] {
    const fields: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (inQuotes) {
        if (char === quote) {
          if (nextChar === quote) {
            currentField += quote;
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          currentField += char;
        }
      } else {
        if (char === quote) {
          inQuotes = true;
        } else if (char === delimiter) {
          fields.push(currentField.trim());
          currentField = '';
        } else {
          currentField += char;
        }
      }
    }

    fields.push(currentField.trim());
    return fields;
  }

  /**
   * Create text representation of CSV
   */
  private createTextRepresentation(
    headers: string[],
    rows: string[][],
  ): string {
    const lines: string[] = [];

    // Header line
    lines.push(headers.join(' | '));
    lines.push('-'.repeat(lines[0].length));

    // Data rows
    for (const row of rows) {
      lines.push(row.join(' | '));
    }

    return lines.join('\n');
  }

  /**
   * Create elements from CSV data
   */
  private createElements(headers: string[], rows: string[][]): Element[] {
    const elements: Element[] = [];

    // Table element
    const tableElement = this.createElement(
      'table',
      `Table with ${headers.length} columns and ${rows.length} rows`,
      undefined,
      { headers, rowCount: rows.length },
    );

    // Row elements as children
    tableElement.children = rows.map((row, i) =>
      this.createElement(
        'paragraph',
        headers.map((h, j) => `${h}: ${row[j] ?? ''}`).join(', '),
        undefined,
        { rowIndex: i },
      ),
    );

    elements.push(tableElement);

    return elements;
  }
}

/**
 * Create CSV parser instance
 */
export function createCSVParser(): CSVParser {
  return new CSVParser();
}
