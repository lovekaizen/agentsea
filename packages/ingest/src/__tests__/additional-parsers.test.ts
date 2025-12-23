/**
 * Additional Parsers Tests (DOCX, Excel, Text)
 */

import { describe, it, expect } from 'vitest';
import { DOCXParser } from '../parsers/DOCXParser.js';
import { ExcelParser } from '../parsers/ExcelParser.js';
import { TextParser } from '../parsers/TextParser.js';
import { BaseParser } from '../parsers/BaseParser.js';

describe('DOCXParser', () => {
  const parser = new DOCXParser();

  it('should have correct metadata', () => {
    expect(parser.name).toBe('docx-parser');
    expect(parser.supportedMimeTypes).toContain(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(parser.supportedExtensions).toContain('docx');
  });

  it('should check if can parse DOCX', () => {
    expect(
      parser.canParse(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ),
    ).toBe(true);
    expect(parser.canParse('', 'docx')).toBe(true);
  });

  it('should have correct capabilities', () => {
    expect(parser.capabilities.text).toBe(true);
    expect(parser.capabilities.structure).toBe(true);
    expect(parser.capabilities.tables).toBe(true);
    expect(parser.capabilities.images).toBe(true);
  });
});

describe('ExcelParser', () => {
  const parser = new ExcelParser();

  it('should have correct metadata', () => {
    expect(parser.name).toBe('excel-parser');
    expect(parser.supportedMimeTypes).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(parser.supportedExtensions).toContain('xlsx');
    expect(parser.supportedExtensions).toContain('xls');
  });

  it('should check if can parse Excel', () => {
    expect(
      parser.canParse(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ),
    ).toBe(true);
    expect(parser.canParse('', 'xlsx')).toBe(true);
    expect(parser.canParse('', 'xls')).toBe(true);
  });

  it('should have correct capabilities', () => {
    expect(parser.capabilities.text).toBe(true);
    expect(parser.capabilities.structure).toBe(true);
    expect(parser.capabilities.tables).toBe(true);
    expect(parser.capabilities.images).toBe(false);
  });
});

describe('TextParser', () => {
  const parser = new TextParser();

  it('should have correct metadata', () => {
    expect(parser.name).toBe('text-parser');
    expect(parser.supportedMimeTypes).toContain('text/plain');
    expect(parser.supportedExtensions).toContain('txt');
  });

  it('should parse simple text', async () => {
    const text =
      'This is a simple text file.\nWith multiple lines.\nAnd paragraphs.';
    const buffer = Buffer.from(text);

    const result = await parser.parse(buffer);

    expect(result.type).toBe('txt');
    expect(result.text).toBe(text);
  });

  it('should detect encoding', async () => {
    const text = 'Text content';
    const buffer = Buffer.from(text, 'utf-8');

    const result = await parser.parse(buffer);

    expect(result.metadata.custom?.encoding).toBeDefined();
  });

  it('should detect language', async () => {
    const text =
      'This is English text with enough content for language detection.';
    const buffer = Buffer.from(text);

    const result = await parser.parse(buffer, {
      detectLanguage: true,
    });

    expect(result).toBeDefined();
  });

  it('should split into paragraphs', async () => {
    const text = `First paragraph.

Second paragraph.

Third paragraph.`;
    const buffer = Buffer.from(text);

    const result = await parser.parse(buffer);

    expect(result.elements.length).toBeGreaterThan(0);
  });

  it('should handle different encodings', async () => {
    const text = 'Test content';
    const buffer = Buffer.from(text, 'latin1');

    const result = await parser.parse(buffer, {
      encoding: 'latin1',
    });

    expect(result.text).toBeDefined();
  });

  it('should create metadata', async () => {
    const text = 'Test document content';
    const buffer = Buffer.from(text);

    const result = await parser.parse(buffer);

    expect(result.metadata.wordCount).toBeGreaterThan(0);
    expect(result.metadata.characterCount).toBe(text.length);
  });
});

describe('BaseParser functionality', () => {
  // Create a minimal concrete parser for testing
  class TestParser extends BaseParser {
    name = 'test-parser';
    supportedMimeTypes = ['test/test'];
    supportedExtensions = ['test'];
    capabilities = {
      text: true,
      structure: false,
      tables: false,
      images: false,
      metadata: false,
      streaming: false,
    };

    async parse(buffer: Buffer) {
      return this.createEmptyResult('text');
    }
  }

  const parser = new TestParser();

  it('should create empty result', () => {
    const result = parser['createEmptyResult']('text');

    expect(result.type).toBe('text');
    expect(result.text).toBe('');
    expect(result.elements).toHaveLength(0);
    expect(result.tables).toHaveLength(0);
    expect(result.images).toHaveLength(0);
  });

  it('should create text element', () => {
    const element = parser['createElement']('paragraph', 'Test text');

    expect(element.type).toBe('paragraph');
    expect(element.text).toBe('Test text');
  });

  it('should create element with metadata', () => {
    const element = parser['createElement']('heading', 'Title', 1, {
      level: 1,
    });

    expect(element.type).toBe('heading');
    expect(element.text).toBe('Title');
    expect(element.pageNumber).toBe(1);
    expect(element.metadata?.level).toBe(1);
  });

  it('should create table data', () => {
    const table = parser['createTable'](
      ['Col1', 'Col2'],
      [
        ['A', 'B'],
        ['C', 'D'],
      ],
    );

    expect(table.headers).toEqual(['Col1', 'Col2']);
    expect(table.rows).toHaveLength(2);
    expect(table.id).toBeDefined();
  });

  it('should create table with page and caption', () => {
    const table = parser['createTable'](
      ['Name', 'Age'],
      [['John', '30']],
      1,
      'User Table',
    );

    expect(table.pageNumber).toBe(1);
    expect(table.caption).toBe('User Table');
  });

  it('should create image data', () => {
    const image = parser['createImage'](800, 600, 'png');

    expect(image.width).toBe(800);
    expect(image.height).toBe(600);
    expect(image.format).toBe('png');
    expect(image.id).toBeDefined();
  });

  it('should create image with options', () => {
    const image = parser['createImage'](100, 100, 'jpg', {
      url: 'test.jpg',
      altText: 'Test image',
    });

    expect(image.url).toBe('test.jpg');
    expect(image.altText).toBe('Test image');
  });

  it('should estimate word count', () => {
    const count = parser['estimateWordCount']('Hello world this is a test');

    expect(count).toBe(6);
  });

  it('should handle empty text for word count', () => {
    const count = parser['estimateWordCount']('');

    expect(count).toBe(0);
  });

  it('should estimate character count', () => {
    const count = parser['estimateCharacterCount']('test');

    expect(count).toBe(4);
  });

  it('should extract text from elements', () => {
    const elements = [
      { type: 'paragraph' as const, text: 'First' },
      { type: 'paragraph' as const, text: 'Second' },
    ];

    const text = parser['extractTextFromElements'](elements);

    expect(text).toContain('First');
    expect(text).toContain('Second');
  });

  it('should extract text from nested elements', () => {
    const elements = [
      {
        type: 'list' as const,
        text: 'List',
        children: [
          { type: 'list_item' as const, text: 'Item 1' },
          { type: 'list_item' as const, text: 'Item 2' },
        ],
      },
    ];

    const text = parser['extractTextFromElements'](elements);

    expect(text).toContain('Item 1');
    expect(text).toContain('Item 2');
  });

  it('should merge metadata with defaults', () => {
    const metadata = parser['mergeMetadata'](
      { title: 'Test' },
      'This is test text',
    );

    expect(metadata.title).toBe('Test');
    expect(metadata.wordCount).toBeGreaterThan(0);
    expect(metadata.characterCount).toBeGreaterThan(0);
  });

  it('should preserve existing counts in metadata', () => {
    const metadata = parser['mergeMetadata'](
      { wordCount: 100, characterCount: 500 },
      'test',
    );

    expect(metadata.wordCount).toBe(100);
    expect(metadata.characterCount).toBe(500);
  });

  it('should check canParse with mimeType', () => {
    expect(parser.canParse('test/test')).toBe(true);
    expect(parser.canParse('other/type')).toBe(false);
  });

  it('should check canParse with extension', () => {
    expect(parser.canParse('', 'test')).toBe(true);
    expect(parser.canParse('', 'txt')).toBe(false);
  });

  it('should check canParse with case insensitive extension', () => {
    expect(parser.canParse('', 'TEST')).toBe(true);
    expect(parser.canParse('', 'TeSt')).toBe(true);
  });

  it('should check canParse with both mimeType and extension', () => {
    expect(parser.canParse('test/test', 'test')).toBe(true);
    expect(parser.canParse('wrong/type', 'test')).toBe(true); // Extension matches
    expect(parser.canParse('test/test', 'wrong')).toBe(true); // MimeType matches
  });
});
