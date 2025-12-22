/**
 * Excel Parser
 *
 * Parser for Excel documents using xlsx.
 */

import type {
  ParserCapabilities,
  ParseResult,
  ExcelParserOptions,
  Element,
  TableData,
} from '../types/index.js';
import { BaseParser } from './BaseParser.js';

/**
 * Excel document parser
 */
export class ExcelParser extends BaseParser {
  readonly name = 'excel-parser';
  readonly supportedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ];
  readonly supportedExtensions = ['xlsx', 'xls'];
  readonly capabilities: ParserCapabilities = {
    text: true,
    structure: true,
    tables: true,
    images: false,
    metadata: true,
    streaming: false,
  };

  /**
   * Parse Excel document
   */
  async parse(
    buffer: Buffer,
    options?: ExcelParserOptions,
  ): Promise<ParseResult> {
    const result = this.createEmptyResult('xlsx');

    try {
      // Dynamic import of xlsx
      const XLSX = await import('xlsx');

      // Read workbook
      const workbook = XLSX.read(buffer, {
        type: 'buffer',
        cellFormula: options?.includeFormulas ?? false,
        cellStyles: options?.includeStyles ?? false,
      });

      // Get sheets to process
      let sheetNames = workbook.SheetNames;
      if (options?.sheets) {
        if (typeof options.sheets[0] === 'number') {
          sheetNames = (options.sheets as number[])
            .filter((i) => i >= 0 && i < workbook.SheetNames.length)
            .map((i) => workbook.SheetNames[i]);
        } else {
          sheetNames = (options.sheets as string[]).filter((name) =>
            workbook.SheetNames.includes(name),
          );
        }
      }

      const textParts: string[] = [];
      const elements: Element[] = [];
      const tables: TableData[] = [];

      // Process each sheet
      for (const sheetName of sheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;

        // Convert to JSON
        const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
          header: 1,
          defval: '',
        });

        if (rows.length === 0) continue;

        // Extract headers (first row)
        const headers = rows[0].map((cell) => String(cell ?? ''));
        const dataRows = rows
          .slice(1)
          .map((row) => row.map((cell) => String(cell ?? '')));

        // Create table
        const table = this.createTable(headers, dataRows, undefined, sheetName);
        tables.push(table);

        // Create element for this sheet
        const sheetElement = this.createElement(
          'table',
          `Sheet: ${sheetName} (${headers.length} columns, ${dataRows.length} rows)`,
          undefined,
          { sheetName, headers, rowCount: dataRows.length },
        );
        elements.push(sheetElement);

        // Add to text representation
        textParts.push(`## ${sheetName}\n`);
        textParts.push(headers.join(' | '));
        textParts.push('-'.repeat(50));
        for (const row of dataRows.slice(0, 100)) {
          // Limit rows in text
          textParts.push(row.join(' | '));
        }
        if (dataRows.length > 100) {
          textParts.push(`... and ${dataRows.length - 100} more rows`);
        }
        textParts.push('');
      }

      result.text = textParts.join('\n');
      result.elements = elements;
      result.tables = tables;

      // Metadata
      result.metadata = {
        wordCount: this.estimateWordCount(result.text),
        characterCount: result.text.length,
        custom: {
          sheetCount: sheetNames.length,
          sheetNames,
          totalTables: tables.length,
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to parse Excel: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return result;
  }
}

/**
 * Create Excel parser instance
 */
export function createExcelParser(): ExcelParser {
  return new ExcelParser();
}
