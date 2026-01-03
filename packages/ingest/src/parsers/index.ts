/**
 * Parsers Index
 *
 * Document parser exports.
 */

export { BaseParser } from './BaseParser.js';
export { PDFParser, createPDFParser } from './PDFParser.js';
export { DOCXParser, createDOCXParser } from './DOCXParser.js';
export { HTMLParser, createHTMLParser } from './HTMLParser.js';
export { MarkdownParser, createMarkdownParser } from './MarkdownParser.js';
export { TextParser, createTextParser } from './TextParser.js';
export { CSVParser, createCSVParser } from './CSVParser.js';
export { ExcelParser, createExcelParser } from './ExcelParser.js';
export { JSONParser, createJSONParser } from './JSONParser.js';

import type { Parser } from '../types/index.js';
import { PDFParser } from './PDFParser.js';
import { DOCXParser } from './DOCXParser.js';
import { HTMLParser } from './HTMLParser.js';
import { MarkdownParser } from './MarkdownParser.js';
import { TextParser } from './TextParser.js';
import { CSVParser } from './CSVParser.js';
import { ExcelParser } from './ExcelParser.js';
import { JSONParser } from './JSONParser.js';

/**
 * Get all built-in parsers
 */
export function getBuiltInParsers(): Parser[] {
  return [
    new PDFParser(),
    new DOCXParser(),
    new HTMLParser(),
    new MarkdownParser(),
    new TextParser(),
    new CSVParser(),
    new ExcelParser(),
    new JSONParser(),
  ];
}

/**
 * Register all built-in parsers with a parser registry
 */
export function registerBuiltInParsers(
  register: (parser: Parser) => void,
): void {
  for (const parser of getBuiltInParsers()) {
    register(parser);
  }
}
