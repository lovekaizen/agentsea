import { promises as fs } from 'fs';
import { join } from 'path';
import os from 'os';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { codeEditTool } from '../code-edit.tool';

const ctx = {} as any;

describe('codeEditTool', () => {
  let tmpDir: string;
  let testFile: string;
  let prevRoot: string | undefined;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(join(os.tmpdir(), 'code-edit-test-'));
    // Confine the path guard to the test's temp dir for this run.
    prevRoot = process.env.AGENTSEA_FILE_ROOT;
    process.env.AGENTSEA_FILE_ROOT = tmpDir;
    testFile = join(tmpDir, 'test.ts');
    await fs.writeFile(
      testFile,
      `function hello() {\n  console.log("hello");\n}\n\nfunction world() {\n  console.log("world");\n}\n`,
      'utf8',
    );
  });

  afterEach(async () => {
    if (prevRoot === undefined) delete process.env.AGENTSEA_FILE_ROOT;
    else process.env.AGENTSEA_FILE_ROOT = prevRoot;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('metadata', () => {
    it('should have correct name', () => {
      expect(codeEditTool.name).toBe('code_edit');
    });

    it('should have valid parameters schema', () => {
      const result = codeEditTool.parameters.safeParse({
        path: '/tmp/test.ts',
        oldString: 'hello',
        newString: 'world',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('replacement', () => {
    it('should replace a unique string', async () => {
      const result = (await codeEditTool.execute(
        {
          path: testFile,
          oldString: 'console.log("hello")',
          newString: 'console.log("hi")',
          expectedReplacements: 1,
        },
        ctx,
      )) as any;

      expect(result.success).toBe(true);
      expect(result.replacements).toBe(1);

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toContain('console.log("hi")');
      expect(content).not.toContain('console.log("hello")');
    });

    it('should replace multiple occurrences when expectedReplacements matches', async () => {
      await fs.writeFile(testFile, 'foo bar foo bar foo', 'utf8');

      const result = (await codeEditTool.execute(
        {
          path: testFile,
          oldString: 'foo',
          newString: 'baz',
          expectedReplacements: 3,
        },
        ctx,
      )) as any;

      expect(result.success).toBe(true);
      expect(result.replacements).toBe(3);

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toBe('baz bar baz bar baz');
    });
  });

  describe('deletion', () => {
    it('should delete text when newString is empty', async () => {
      const result = (await codeEditTool.execute(
        {
          path: testFile,
          oldString: '\nfunction world() {\n  console.log("world");\n}\n',
          newString: '\n',
          expectedReplacements: 1,
        },
        ctx,
      )) as any;

      expect(result.success).toBe(true);
      const content = await fs.readFile(testFile, 'utf8');
      expect(content).not.toContain('world');
    });
  });

  describe('insert at beginning', () => {
    it('should insert content when oldString is empty', async () => {
      const result = (await codeEditTool.execute(
        {
          path: testFile,
          oldString: '',
          newString: '// Header comment\n',
          expectedReplacements: 1,
        },
        ctx,
      )) as any;

      expect(result.success).toBe(true);
      const content = await fs.readFile(testFile, 'utf8');
      expect(content.startsWith('// Header comment\n')).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should throw when string is not found', async () => {
      await expect(
        codeEditTool.execute(
          {
            path: testFile,
            oldString: 'this does not exist',
            newString: 'replacement',
            expectedReplacements: 1,
          },
          ctx,
        ),
      ).rejects.toThrow('String not found');
    });

    it('should throw when occurrence count mismatches', async () => {
      await fs.writeFile(testFile, 'foo bar foo', 'utf8');

      await expect(
        codeEditTool.execute(
          {
            path: testFile,
            oldString: 'foo',
            newString: 'baz',
            expectedReplacements: 1,
          },
          ctx,
        ),
      ).rejects.toThrow('Expected 1 occurrence(s)');
    });

    it('should throw when file does not exist', async () => {
      await expect(
        codeEditTool.execute(
          {
            path: join(tmpDir, 'nonexistent.ts'),
            oldString: 'hello',
            newString: 'world',
            expectedReplacements: 1,
          },
          ctx,
        ),
      ).rejects.toThrow();
    });
  });
});
