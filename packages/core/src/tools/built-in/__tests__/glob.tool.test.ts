import { promises as fs } from 'fs';
import { join } from 'path';
import os from 'os';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { globTool } from '../glob.tool';

const ctx = {} as any;

describe('globTool', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(join(os.tmpdir(), 'glob-test-'));

    // Create test file structure
    await fs.mkdir(join(tmpDir, 'src'), { recursive: true });
    await fs.mkdir(join(tmpDir, 'src', 'utils'), { recursive: true });
    await fs.mkdir(join(tmpDir, 'node_modules', 'pkg'), { recursive: true });

    await fs.writeFile(join(tmpDir, 'src', 'index.ts'), 'export {};');
    await fs.writeFile(join(tmpDir, 'src', 'app.ts'), 'const app = 1;');
    await fs.writeFile(
      join(tmpDir, 'src', 'utils', 'helper.ts'),
      'export const h = 1;',
    );
    await fs.writeFile(join(tmpDir, 'src', 'style.css'), 'body {}');
    await fs.writeFile(join(tmpDir, 'package.json'), '{}');
    await fs.writeFile(
      join(tmpDir, 'node_modules', 'pkg', 'index.js'),
      'module.exports = {};',
    );
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('metadata', () => {
    it('should have correct name', () => {
      expect(globTool.name).toBe('glob');
    });
  });

  describe('pattern matching', () => {
    it('should find TypeScript files', async () => {
      const result = (await globTool.execute(
        { pattern: '**/*.ts', cwd: tmpDir, maxResults: 1000 },
        ctx,
      )) as any;

      expect(result.count).toBe(3);
      const filenames = result.files.map((f: string) => f.split('/').pop());
      expect(filenames).toContain('index.ts');
      expect(filenames).toContain('app.ts');
      expect(filenames).toContain('helper.ts');
    });

    it('should find specific file types', async () => {
      const result = (await globTool.execute(
        { pattern: '**/*.css', cwd: tmpDir, maxResults: 1000 },
        ctx,
      )) as any;

      expect(result.count).toBe(1);
      expect(result.files[0]).toContain('style.css');
    });

    it('should find root-level files', async () => {
      const result = (await globTool.execute(
        { pattern: '*.json', cwd: tmpDir, maxResults: 1000 },
        ctx,
      )) as any;

      expect(result.count).toBe(1);
      expect(result.files[0]).toContain('package.json');
    });
  });

  describe('ignore patterns', () => {
    it('should ignore node_modules by default', async () => {
      const result = (await globTool.execute(
        { pattern: '**/*.js', cwd: tmpDir, maxResults: 1000 },
        ctx,
      )) as any;

      expect(result.count).toBe(0);
    });

    it('should support custom ignore patterns', async () => {
      const result = (await globTool.execute(
        {
          pattern: '**/*.ts',
          cwd: tmpDir,
          ignore: ['**/utils/**'],
          maxResults: 1000,
        },
        ctx,
      )) as any;

      expect(result.count).toBe(2);
      const filenames = result.files.map((f: string) => f.split('/').pop());
      expect(filenames).not.toContain('helper.ts');
    });
  });

  describe('maxResults', () => {
    it('should limit results', async () => {
      const result = (await globTool.execute(
        { pattern: '**/*.ts', cwd: tmpDir, maxResults: 2 },
        ctx,
      )) as any;

      expect(result.count).toBe(2);
      expect(result.truncated).toBe(true);
      expect(result.totalMatches).toBe(3);
    });
  });
});
