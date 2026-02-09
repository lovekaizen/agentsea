import { promises as fs } from 'fs';
import { join } from 'path';
import os from 'os';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { grepTool } from '../grep.tool';

const ctx = {} as any;

describe('grepTool', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(join(os.tmpdir(), 'grep-test-'));

    await fs.mkdir(join(tmpDir, 'src'), { recursive: true });

    await fs.writeFile(
      join(tmpDir, 'src', 'index.ts'),
      `import { foo } from './foo';\nimport { bar } from './bar';\n\nconst result = foo() + bar();\nconsole.log(result);\n`,
    );
    await fs.writeFile(
      join(tmpDir, 'src', 'foo.ts'),
      `export function foo() {\n  return 42;\n}\n`,
    );
    await fs.writeFile(
      join(tmpDir, 'src', 'bar.ts'),
      `export function bar() {\n  return 100;\n}\n`,
    );
    await fs.writeFile(
      join(tmpDir, 'readme.md'),
      `# Test Project\n\nThis is a FOO bar project.\n`,
    );
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('metadata', () => {
    it('should have correct name', () => {
      expect(grepTool.name).toBe('grep');
    });
  });

  describe('regex search', () => {
    it('should find matches for a pattern', async () => {
      const result = (await grepTool.execute(
        {
          pattern: 'function',
          path: tmpDir,
          caseInsensitive: false,
          contextLines: 0,
          maxResults: 100,
        },
        ctx,
      )) as any;

      expect(result.count).toBe(2);
      expect(result.matches[0].content).toContain('function');
    });

    it('should find regex patterns', async () => {
      const result = (await grepTool.execute(
        {
          pattern: 'return \\d+',
          path: tmpDir,
          caseInsensitive: false,
          contextLines: 0,
          maxResults: 100,
        },
        ctx,
      )) as any;

      expect(result.count).toBe(2);
    });
  });

  describe('case-insensitive search', () => {
    it('should find case-insensitive matches', async () => {
      const result = (await grepTool.execute(
        {
          pattern: 'foo',
          path: tmpDir,
          caseInsensitive: true,
          contextLines: 0,
          maxResults: 100,
        },
        ctx,
      )) as any;

      // Should match "foo" in source files AND "FOO" in readme
      const allContent = result.matches.map((m: any) => m.content).join('\n');
      expect(allContent).toContain('FOO');
    });
  });

  describe('context lines', () => {
    it('should include context lines', async () => {
      const result = (await grepTool.execute(
        {
          pattern: 'return 42',
          path: tmpDir,
          caseInsensitive: false,
          contextLines: 1,
          maxResults: 100,
        },
        ctx,
      )) as any;

      expect(result.count).toBe(1);
      expect(result.matches[0].contextBefore).toBeDefined();
      expect(result.matches[0].contextAfter).toBeDefined();
      expect(result.matches[0].contextBefore!.length).toBeGreaterThan(0);
    });
  });

  describe('include filter', () => {
    it('should filter by file type', async () => {
      const result = (await grepTool.execute(
        {
          pattern: 'foo',
          path: tmpDir,
          include: '*.ts',
          caseInsensitive: false,
          contextLines: 0,
          maxResults: 100,
        },
        ctx,
      )) as any;

      // Should only match .ts files, not .md
      for (const match of result.matches) {
        expect(match.file).toMatch(/\.ts$/);
      }
    });
  });

  describe('single file search', () => {
    it('should search within a single file', async () => {
      const result = (await grepTool.execute(
        {
          pattern: 'import',
          path: join(tmpDir, 'src', 'index.ts'),
          caseInsensitive: false,
          contextLines: 0,
          maxResults: 100,
        },
        ctx,
      )) as any;

      expect(result.count).toBe(2);
    });
  });

  describe('maxResults', () => {
    it('should limit results', async () => {
      const result = (await grepTool.execute(
        {
          pattern: '.',
          path: tmpDir,
          caseInsensitive: false,
          contextLines: 0,
          maxResults: 3,
        },
        ctx,
      )) as any;

      expect(result.count).toBe(3);
      expect(result.truncated).toBe(true);
    });
  });
});
