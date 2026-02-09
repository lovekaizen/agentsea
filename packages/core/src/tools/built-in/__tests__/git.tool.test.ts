import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import os from 'os';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  gitStatusTool,
  gitDiffTool,
  gitLogTool,
  gitBranchTool,
} from '../git.tool';

const ctx = {} as any;

describe('git tools', { timeout: 60_000 }, () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(join(os.tmpdir(), 'git-test-'));

    // Initialize a git repo with an initial commit
    execSync('git init', { cwd: tmpDir });
    execSync('git config user.email "test@test.com"', { cwd: tmpDir });
    execSync('git config user.name "Test"', { cwd: tmpDir });

    await fs.writeFile(join(tmpDir, 'readme.md'), '# Test\n');
    execSync('git add .', { cwd: tmpDir });
    execSync('git commit -m "initial commit"', { cwd: tmpDir });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('gitStatusTool', () => {
    it('should show clean status', async () => {
      const result = (await gitStatusTool.execute({ cwd: tmpDir }, ctx)) as any;

      expect(result.clean).toBe(true);
      expect(result.staged).toHaveLength(0);
      expect(result.unstaged).toHaveLength(0);
      expect(result.untracked).toHaveLength(0);
    });

    it('should detect untracked files', async () => {
      await fs.writeFile(join(tmpDir, 'new-file.ts'), 'export {};');

      const result = (await gitStatusTool.execute({ cwd: tmpDir }, ctx)) as any;

      expect(result.clean).toBe(false);
      expect(result.untracked).toContain('new-file.ts');
    });

    it('should detect staged files', async () => {
      await fs.writeFile(join(tmpDir, 'staged.ts'), 'export {};');
      execSync('git add staged.ts', { cwd: tmpDir });

      const result = (await gitStatusTool.execute({ cwd: tmpDir }, ctx)) as any;

      expect(result.staged).toContain('staged.ts');
    });

    it('should show the current branch', async () => {
      const result = (await gitStatusTool.execute({ cwd: tmpDir }, ctx)) as any;

      expect(result.branch).toBeTruthy();
    });
  });

  describe('gitDiffTool', () => {
    it('should show no changes on clean repo', async () => {
      const result = (await gitDiffTool.execute(
        { staged: false, cwd: tmpDir },
        ctx,
      )) as any;

      expect(result.hasChanges).toBe(false);
    });

    it('should show unstaged changes', async () => {
      await fs.writeFile(join(tmpDir, 'readme.md'), '# Test\n\nModified.\n');

      const result = (await gitDiffTool.execute(
        { staged: false, cwd: tmpDir },
        ctx,
      )) as any;

      expect(result.hasChanges).toBe(true);
      expect(result.diff).toContain('Modified');
    });

    it('should show staged changes', async () => {
      await fs.writeFile(
        join(tmpDir, 'readme.md'),
        '# Test\n\nStaged change.\n',
      );
      execSync('git add readme.md', { cwd: tmpDir });

      const result = (await gitDiffTool.execute(
        { staged: true, cwd: tmpDir },
        ctx,
      )) as any;

      expect(result.hasChanges).toBe(true);
      expect(result.diff).toContain('Staged change');
    });
  });

  describe('gitLogTool', () => {
    it('should show commit history', async () => {
      const result = (await gitLogTool.execute(
        { maxCount: 10, oneline: true, cwd: tmpDir },
        ctx,
      )) as any;

      expect(result.commits).toHaveLength(1);
      expect(result.commits[0].message).toBe('initial commit');
    });

    it('should limit results with maxCount', async () => {
      // Add more commits
      await fs.writeFile(join(tmpDir, 'file1.ts'), '1');
      execSync('git add . && git commit -m "second"', { cwd: tmpDir });
      await fs.writeFile(join(tmpDir, 'file2.ts'), '2');
      execSync('git add . && git commit -m "third"', { cwd: tmpDir });

      const result = (await gitLogTool.execute(
        { maxCount: 2, oneline: true, cwd: tmpDir },
        ctx,
      )) as any;

      expect(result.commits).toHaveLength(2);
    });
  });

  describe('gitBranchTool', () => {
    it('should list branches', async () => {
      const result = (await gitBranchTool.execute(
        { action: 'list', cwd: tmpDir },
        ctx,
      )) as any;

      expect(result.branches.length).toBeGreaterThan(0);
      expect(result.current).toBeTruthy();
    });

    it('should create a new branch', async () => {
      const result = (await gitBranchTool.execute(
        { action: 'create', name: 'feature-test', cwd: tmpDir },
        ctx,
      )) as any;

      expect(result.success).toBe(true);
      expect(result.created).toBe('feature-test');

      // Verify branch exists
      const listResult = (await gitBranchTool.execute(
        { action: 'list', cwd: tmpDir },
        ctx,
      )) as any;
      expect(listResult.branches).toContain('feature-test');
    });

    it('should switch branches', async () => {
      execSync('git branch feature-switch', { cwd: tmpDir });

      const result = (await gitBranchTool.execute(
        { action: 'switch', name: 'feature-switch', cwd: tmpDir },
        ctx,
      )) as any;

      expect(result.success).toBe(true);
      expect(result.switched).toBe('feature-switch');
    });

    it('should throw when name is missing for create', () => {
      expect(() =>
        gitBranchTool.execute({ action: 'create', cwd: tmpDir }, ctx),
      ).toThrow('Branch name is required');
    });
  });
});
