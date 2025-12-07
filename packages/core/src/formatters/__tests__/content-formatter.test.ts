import { describe, it, expect } from 'vitest';
import { ContentFormatter } from '../content-formatter';

describe('ContentFormatter', () => {
  describe('format', () => {
    describe('text format', () => {
      it('should return plain text as-is', () => {
        const result = ContentFormatter.format('Hello world', 'text');

        expect(result.raw).toBe('Hello world');
        expect(result.format).toBe('text');
        expect(result.rendered).toBe('Hello world');
      });

      it('should include metadata when requested', () => {
        const content = '# Title\n\n[link](http://example.com)';
        const result = ContentFormatter.format(content, 'text', {
          includeMetadata: true,
        });

        expect(result.metadata).toBeDefined();
        expect(result.metadata?.links).toHaveLength(1);
      });

      it('should not include metadata by default', () => {
        const result = ContentFormatter.format('Hello', 'text');
        expect(result.metadata).toBeUndefined();
      });
    });

    describe('markdown format', () => {
      it('should return markdown content', () => {
        const content = '# Hello\n\n**Bold** text';
        const result = ContentFormatter.format(content, 'markdown');

        expect(result.raw).toBe(content);
        expect(result.format).toBe('markdown');
        expect(result.rendered).toBe(content);
      });

      it('should include metadata when requested', () => {
        const content = '# Title\n\n- item 1\n- item 2';
        const result = ContentFormatter.format(content, 'markdown', {
          includeMetadata: true,
        });

        expect(result.metadata).toBeDefined();
        expect(result.metadata?.hasLists).toBe(true);
      });
    });

    describe('html format', () => {
      it('should convert markdown to HTML', () => {
        const content = '# Hello World';
        const result = ContentFormatter.format(content, 'html');

        expect(result.format).toBe('html');
        expect(result.rendered).toContain('<h1>');
        expect(result.rendered).toContain('Hello World');
      });

      it('should sanitize HTML when requested', () => {
        const content = '<script>alert("xss")</script>Hello';
        const result = ContentFormatter.format(content, 'html', {
          sanitizeHtml: true,
        });

        expect(result.rendered).not.toContain('<script>');
      });

      it('should add code highlighting classes when requested', () => {
        const content = '```javascript\nconst x = 1;\n```';
        const result = ContentFormatter.format(content, 'html', {
          highlightCode: true,
        });

        expect(result.rendered).toContain('hljs');
      });

      it('should wrap with theme when specified', () => {
        const content = 'Hello';
        const result = ContentFormatter.format(content, 'html', {
          theme: 'dark',
        });

        expect(result.rendered).toContain('data-theme="dark"');
        expect(result.rendered).toContain('agentsea-content');
      });
    });

    describe('react format', () => {
      it('should add React data attributes', () => {
        const content =
          '```js\ncode\n```\n\n| col1 | col2 |\n|------|------|\n| a | b |\n\n[link](http://example.com)';
        const result = ContentFormatter.format(content, 'react');

        expect(result.format).toBe('react');
        expect(result.rendered).toContain('data-component');
      });
    });

    describe('unknown format', () => {
      it('should default to text for unknown format', () => {
        const content = 'Hello';
        const result = ContentFormatter.format(content, 'unknown' as any);

        expect(result.format).toBe('text');
      });
    });
  });

  describe('metadata extraction', () => {
    it('should detect code blocks', () => {
      const content = '```javascript\nconst x = 1;\n```';
      const result = ContentFormatter.format(content, 'text', {
        includeMetadata: true,
      });

      expect(result.metadata?.hasCodeBlocks).toBe(true);
    });

    it('should detect inline code', () => {
      const content = 'Use `console.log()` for debugging';
      const result = ContentFormatter.format(content, 'text', {
        includeMetadata: true,
      });

      expect(result.metadata?.hasCodeBlocks).toBe(true);
    });

    it('should detect tables', () => {
      const content =
        '| Header | Header |\n|--------|--------|\n| Cell | Cell |';
      const result = ContentFormatter.format(content, 'text', {
        includeMetadata: true,
      });

      expect(result.metadata?.hasTables).toBe(true);
    });

    it('should detect unordered lists', () => {
      const content = '- item 1\n- item 2';
      const result = ContentFormatter.format(content, 'text', {
        includeMetadata: true,
      });

      expect(result.metadata?.hasLists).toBe(true);
    });

    it('should detect ordered lists', () => {
      const content = '1. first\n2. second';
      const result = ContentFormatter.format(content, 'text', {
        includeMetadata: true,
      });

      expect(result.metadata?.hasLists).toBe(true);
    });

    it('should extract links', () => {
      const content =
        '[Google](https://google.com) and [GitHub](https://github.com)';
      const result = ContentFormatter.format(content, 'text', {
        includeMetadata: true,
      });

      expect(result.metadata?.links).toHaveLength(2);
      expect(result.metadata?.links?.[0]).toEqual({
        text: 'Google',
        url: 'https://google.com',
      });
      expect(result.metadata?.links?.[1]).toEqual({
        text: 'GitHub',
        url: 'https://github.com',
      });
    });

    it('should return empty links array when no links', () => {
      const content = 'No links here';
      const result = ContentFormatter.format(content, 'text', {
        includeMetadata: true,
      });

      expect(result.metadata?.links).toEqual([]);
    });
  });

  describe('HTML sanitization', () => {
    it('should remove script tags', () => {
      const content = 'Before<script>alert("xss")</script>After';
      const result = ContentFormatter.format(content, 'html', {
        sanitizeHtml: true,
      });

      expect(result.rendered).not.toContain('<script>');
      expect(result.rendered).not.toContain('alert');
    });

    it('should remove event handlers', () => {
      const content = '<div onclick="alert(1)">Click</div>';
      const result = ContentFormatter.format(content, 'html', {
        sanitizeHtml: true,
      });

      expect(result.rendered).not.toContain('onclick');
    });

    it('should remove javascript: protocol', () => {
      const content = '<a href="javascript:alert(1)">Click</a>';
      const result = ContentFormatter.format(content, 'html', {
        sanitizeHtml: true,
      });

      expect(result.rendered).not.toContain('javascript:');
    });
  });

  describe('detectFormat', () => {
    it('should detect HTML content', () => {
      const content = '<div>Hello</div>';
      const format = ContentFormatter.detectFormat(content);

      expect(format).toBe('html');
    });

    it('should detect markdown headers', () => {
      const content = '# Hello World';
      const format = ContentFormatter.detectFormat(content);

      expect(format).toBe('markdown');
    });

    it('should detect markdown code blocks', () => {
      const content = '```javascript\ncode\n```';
      const format = ContentFormatter.detectFormat(content);

      expect(format).toBe('markdown');
    });

    it('should detect markdown links', () => {
      const content = '[link](http://example.com)';
      const format = ContentFormatter.detectFormat(content);

      expect(format).toBe('markdown');
    });

    it('should detect bold markdown', () => {
      const content = '**bold text**';
      const format = ContentFormatter.detectFormat(content);

      expect(format).toBe('markdown');
    });

    it('should detect underscore bold markdown', () => {
      const content = '__bold text__';
      const format = ContentFormatter.detectFormat(content);

      expect(format).toBe('markdown');
    });

    it('should default to text for plain content', () => {
      const content = 'Just plain text without any special formatting';
      const format = ContentFormatter.detectFormat(content);

      expect(format).toBe('text');
    });
  });
});
