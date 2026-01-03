/**
 * Parsers Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { PDFParser } from '../parsers/PDFParser.js';
import { HTMLParser } from '../parsers/HTMLParser.js';
import { CSVParser } from '../parsers/CSVParser.js';
import { JSONParser } from '../parsers/JSONParser.js';
import { MarkdownParser } from '../parsers/MarkdownParser.js';

describe('PDFParser', () => {
  const parser = new PDFParser();

  it('should have correct metadata', () => {
    expect(parser.name).toBe('pdf-parser');
    expect(parser.supportedMimeTypes).toContain('application/pdf');
    expect(parser.supportedExtensions).toContain('pdf');
  });

  it('should check if can parse PDF', () => {
    expect(parser.canParse('application/pdf')).toBe(true);
    expect(parser.canParse('', 'pdf')).toBe(true);
    expect(parser.canParse('text/plain')).toBe(false);
  });

  it('should have correct capabilities', () => {
    expect(parser.capabilities.text).toBe(true);
    expect(parser.capabilities.structure).toBe(true);
    expect(parser.capabilities.metadata).toBe(true);
  });
});

describe('HTMLParser', () => {
  const parser = new HTMLParser();

  it('should have correct metadata', () => {
    expect(parser.name).toBe('html-parser');
    expect(parser.supportedMimeTypes).toContain('text/html');
    expect(parser.supportedExtensions).toContain('html');
  });

  it('should check if can parse HTML', () => {
    expect(parser.canParse('text/html')).toBe(true);
    expect(parser.canParse('', 'html')).toBe(true);
    expect(parser.canParse('', 'htm')).toBe(true);
  });

  it('should parse simple HTML', async () => {
    const html = `
      <html>
        <head>
          <title>Test Page</title>
        </head>
        <body>
          <h1>Heading</h1>
          <p>Paragraph text</p>
        </body>
      </html>
    `;

    const buffer = Buffer.from(html);
    const result = await parser.parse(buffer);

    expect(result.type).toBe('html');
    expect(result.metadata.title).toBe('Test Page');
    expect(result.elements.length).toBeGreaterThan(0);
  });

  it('should extract metadata from meta tags', async () => {
    const html = `
      <html>
        <head>
          <meta name="author" content="John Doe">
          <meta name="description" content="Test description">
        </head>
        <body>Test</body>
      </html>
    `;

    const buffer = Buffer.from(html);
    const result = await parser.parse(buffer);

    expect(result.metadata.author).toBe('John Doe');
  });

  it('should extract tables', async () => {
    const html = `
      <table>
        <thead>
          <tr><th>Name</th><th>Age</th></tr>
        </thead>
        <tbody>
          <tr><td>John</td><td>30</td></tr>
          <tr><td>Jane</td><td>25</td></tr>
        </tbody>
      </table>
    `;

    const buffer = Buffer.from(html);
    const result = await parser.parse(buffer);

    expect(result.tables).toHaveLength(1);
    expect(result.tables[0].headers).toEqual(['Name', 'Age']);
    expect(result.tables[0].rows).toHaveLength(2);
  });

  it('should extract images', async () => {
    const html = `
      <img src="test.jpg" alt="Test image" width="100" height="200">
    `;

    const buffer = Buffer.from(html);
    const result = await parser.parse(buffer);

    expect(result.images).toHaveLength(1);
    expect(result.images[0].url).toBe('test.jpg');
    expect(result.images[0].altText).toBe('Test image');
  });

  it('should exclude elements by selector', async () => {
    const html = `
      <body>
        <nav>Navigation</nav>
        <main>Main content</main>
      </body>
    `;

    const buffer = Buffer.from(html);
    const result = await parser.parse(buffer, {
      excludeSelectors: ['nav'],
    });

    expect(result.text).not.toContain('Navigation');
  });
});

describe('CSVParser', () => {
  const parser = new CSVParser();

  it('should have correct metadata', () => {
    expect(parser.name).toBe('csv-parser');
    expect(parser.supportedMimeTypes).toContain('text/csv');
    expect(parser.supportedExtensions).toContain('csv');
  });

  it('should parse simple CSV', async () => {
    const csv = `Name,Age,City
John,30,New York
Jane,25,Boston
Bob,35,Chicago`;

    const buffer = Buffer.from(csv);
    const result = await parser.parse(buffer);

    expect(result.type).toBe('csv');
    expect(result.tables).toHaveLength(1);
    expect(result.tables[0].headers).toEqual(['Name', 'Age', 'City']);
    expect(result.tables[0].rows).toHaveLength(3);
  });

  it('should detect delimiter', async () => {
    const tsv = `Name\tAge\tCity
John\t30\tNew York`;

    const buffer = Buffer.from(tsv);
    const result = await parser.parse(buffer);

    expect(result.type).toBe('csv');
    expect(result.tables[0].headers).toHaveLength(3);
  });

  it('should handle quoted fields', async () => {
    const csv = `Name,Description
John,"A person who lives in New York"
Jane,"A person who lives in Boston"`;

    const buffer = Buffer.from(csv);
    const result = await parser.parse(buffer);

    expect(result.tables[0].rows[0][1]).toBe('A person who lives in New York');
  });

  it('should handle CSV without headers', async () => {
    const csv = `John,30,New York
Jane,25,Boston`;

    const buffer = Buffer.from(csv);
    const result = await parser.parse(buffer, { hasHeader: false });

    expect(result.tables[0].headers[0]).toContain('Column');
    expect(result.tables[0].rows).toHaveLength(2);
  });

  it('should handle custom delimiter', async () => {
    const csv = `Name;Age;City
John;30;New York`;

    const buffer = Buffer.from(csv);
    const result = await parser.parse(buffer, { delimiter: ';' });

    expect(result.tables[0].headers).toEqual(['Name', 'Age', 'City']);
  });

  it('should create text representation', async () => {
    const csv = `Name,Age
John,30`;

    const buffer = Buffer.from(csv);
    const result = await parser.parse(buffer);

    expect(result.text).toContain('Name | Age');
    expect(result.text).toContain('John | 30');
  });
});

describe('JSONParser', () => {
  const parser = new JSONParser();

  it('should have correct metadata', () => {
    expect(parser.name).toBe('json-parser');
    expect(parser.supportedMimeTypes).toContain('application/json');
    expect(parser.supportedExtensions).toContain('json');
  });

  it('should parse simple JSON object', async () => {
    const json = {
      name: 'John',
      age: 30,
      city: 'New York',
    };

    const buffer = Buffer.from(JSON.stringify(json));
    const result = await parser.parse(buffer);

    expect(result.type).toBe('json');
    expect(result.elements.length).toBeGreaterThan(0);
  });

  it('should parse JSON array', async () => {
    const json = [
      { name: 'John', age: 30 },
      { name: 'Jane', age: 25 },
    ];

    const buffer = Buffer.from(JSON.stringify(json));
    const result = await parser.parse(buffer);

    expect(result.metadata.custom?.type).toBe('array');
    expect(result.metadata.custom?.itemCount).toBe(2);
  });

  it('should extract tables from array of objects', async () => {
    const json = [
      { name: 'John', age: 30, city: 'New York' },
      { name: 'Jane', age: 25, city: 'Boston' },
    ];

    const buffer = Buffer.from(JSON.stringify(json));
    const result = await parser.parse(buffer);

    expect(result.tables).toHaveLength(1);
    expect(result.tables[0].headers).toContain('name');
    expect(result.tables[0].headers).toContain('age');
    expect(result.tables[0].rows).toHaveLength(2);
  });

  it('should parse nested JSON', async () => {
    const json = {
      user: {
        name: 'John',
        address: {
          city: 'New York',
          zip: '10001',
        },
      },
    };

    const buffer = Buffer.from(JSON.stringify(json));
    const result = await parser.parse(buffer);

    expect(result.elements.length).toBeGreaterThan(0);
  });

  it('should parse JSON Lines format', async () => {
    const jsonl = `{"name": "John", "age": 30}
{"name": "Jane", "age": 25}
{"name": "Bob", "age": 35}`;

    const buffer = Buffer.from(jsonl);
    const result = await parser.parse(buffer);

    expect(result.metadata.custom?.type).toBe('jsonl');
    expect(result.metadata.custom?.itemCount).toBe(3);
  });

  it('should handle invalid JSON', async () => {
    const buffer = Buffer.from('{ invalid json }');

    await expect(parser.parse(buffer)).rejects.toThrow('Failed to parse JSON');
  });
});

describe('MarkdownParser', () => {
  const parser = new MarkdownParser();

  it('should have correct metadata', () => {
    expect(parser.name).toBe('markdown-parser');
    expect(parser.supportedMimeTypes).toContain('text/markdown');
    expect(parser.supportedExtensions).toContain('md');
  });

  it('should parse simple markdown', async () => {
    const markdown = `# Title

This is a paragraph.

## Heading 2

Another paragraph.`;

    const buffer = Buffer.from(markdown);
    const result = await parser.parse(buffer);

    expect(result.type).toBe('markdown');
    expect(result.elements.length).toBeGreaterThan(0);
  });

  it('should extract frontmatter', async () => {
    const markdown = `---
title: Test Document
author: John Doe
tags: [test, markdown]
---

# Content

This is the content.`;

    const buffer = Buffer.from(markdown);
    const result = await parser.parse(buffer);

    expect(result.metadata.custom?.title).toBe('Test Document');
    expect(result.metadata.custom?.author).toBe('John Doe');
  });

  it('should parse lists', async () => {
    const markdown = `- Item 1
- Item 2
- Item 3`;

    const buffer = Buffer.from(markdown);
    const result = await parser.parse(buffer);

    const listElement = result.elements.find((e) => e.type === 'list');
    expect(listElement).toBeDefined();
    expect(listElement?.children).toHaveLength(3);
  });

  it('should parse ordered lists', async () => {
    const markdown = `1. First
2. Second
3. Third`;

    const buffer = Buffer.from(markdown);
    const result = await parser.parse(buffer);

    const listElement = result.elements.find((e) => e.type === 'list');
    expect(listElement?.metadata?.ordered).toBe(true);
  });

  it('should parse code blocks', async () => {
    const markdown = `\`\`\`javascript
console.log('Hello');
\`\`\``;

    const buffer = Buffer.from(markdown);
    const result = await parser.parse(buffer);

    const codeElement = result.elements.find((e) => e.type === 'code');
    expect(codeElement).toBeDefined();
    expect(codeElement?.metadata?.language).toBe('javascript');
  });

  it('should parse tables', async () => {
    const markdown = `| Name | Age |
|------|-----|
| John | 30  |
| Jane | 25  |`;

    const buffer = Buffer.from(markdown);
    const result = await parser.parse(buffer);

    expect(result.tables).toHaveLength(1);
    expect(result.tables[0].headers).toEqual(['Name', 'Age']);
    expect(result.tables[0].rows).toHaveLength(2);
  });

  it('should extract images', async () => {
    const markdown = `![Alt text](image.jpg "Title")`;

    const buffer = Buffer.from(markdown);
    const result = await parser.parse(buffer);

    expect(result.images).toHaveLength(1);
    expect(result.images[0].url).toBe('image.jpg');
    expect(result.images[0].altText).toBe('Alt text');
  });

  it('should parse blockquotes', async () => {
    const markdown = `> This is a quote
> spanning multiple lines`;

    const buffer = Buffer.from(markdown);
    const result = await parser.parse(buffer);

    const quoteElement = result.elements.find((e) => e.type === 'quote');
    expect(quoteElement).toBeDefined();
  });
});
