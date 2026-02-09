import { execSync } from 'child_process';

import { z } from 'zod';

import { Tool } from '../../types';

const GIT_TIMEOUT_MS = 15_000;

function gitExec(args: string, cwd?: string): string {
  return execSync(`git ${args}`, {
    cwd: cwd || process.cwd(),
    timeout: GIT_TIMEOUT_MS,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

/**
 * Git status tool
 */
export const gitStatusTool: Tool = {
  name: 'git_status',
  description:
    'Show the working tree status. Returns staged, unstaged, and untracked files.',
  parameters: z.object({
    cwd: z.string().optional().describe('Repository directory'),
  }),
  execute: (params: { cwd?: string }) => {
    try {
      const output = gitExec('status --porcelain', params.cwd);
      const branch = gitExec('branch --show-current', params.cwd);

      const staged: string[] = [];
      const unstaged: string[] = [];
      const untracked: string[] = [];

      for (const line of output.split('\n')) {
        if (!line.trim()) continue;
        const index = line[0];
        const worktree = line[1];
        const file = line.slice(3);

        if (index === '?') {
          untracked.push(file);
        } else {
          if (index !== ' ' && index !== '?') staged.push(file);
          if (worktree !== ' ' && worktree !== '?') unstaged.push(file);
        }
      }

      return Promise.resolve({
        branch,
        staged,
        unstaged,
        untracked,
        clean:
          staged.length === 0 &&
          unstaged.length === 0 &&
          untracked.length === 0,
        raw: output,
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Git status failed: ${error.message}`);
      }
      throw error;
    }
  },
};

/**
 * Git diff tool
 */
export const gitDiffTool: Tool = {
  name: 'git_diff',
  description: 'Show changes between commits, commit and working tree, etc.',
  parameters: z.object({
    staged: z
      .boolean()
      .default(false)
      .describe('Show staged changes (--cached)'),
    path: z.string().optional().describe('Limit diff to specific path'),
    cwd: z.string().optional().describe('Repository directory'),
  }),
  execute: (params: { staged: boolean; path?: string; cwd?: string }) => {
    try {
      let args = 'diff';
      if (params.staged) args += ' --cached';
      if (params.path) args += ` -- ${params.path}`;

      const output = gitExec(args, params.cwd);

      return Promise.resolve({
        diff: output,
        hasChanges: output.length > 0,
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Git diff failed: ${error.message}`);
      }
      throw error;
    }
  },
};

/**
 * Git add tool
 */
export const gitAddTool: Tool = {
  name: 'git_add',
  description: 'Add file contents to the staging area.',
  parameters: z.object({
    paths: z.array(z.string()).min(1).describe('Files to add to staging'),
    cwd: z.string().optional().describe('Repository directory'),
  }),
  execute: (params: { paths: string[]; cwd?: string }) => {
    try {
      const escapedPaths = params.paths.map((p) => `"${p}"`).join(' ');
      gitExec(`add ${escapedPaths}`, params.cwd);

      return Promise.resolve({
        success: true,
        added: params.paths,
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Git add failed: ${error.message}`);
      }
      throw error;
    }
  },
};

/**
 * Git commit tool
 */
export const gitCommitTool: Tool = {
  name: 'git_commit',
  description: 'Record changes to the repository.',
  parameters: z.object({
    message: z.string().min(1).describe('Commit message'),
    cwd: z.string().optional().describe('Repository directory'),
  }),
  execute: (params: { message: string; cwd?: string }) => {
    try {
      // Escape the message for shell safety
      const safeMessage = params.message.replace(/'/g, "'\\''");
      const output = gitExec(`commit -m '${safeMessage}'`, params.cwd);

      return Promise.resolve({
        success: true,
        output,
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Git commit failed: ${error.message}`);
      }
      throw error;
    }
  },
};

/**
 * Git log tool
 */
export const gitLogTool: Tool = {
  name: 'git_log',
  description: 'Show commit logs.',
  parameters: z.object({
    maxCount: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(10)
      .describe('Maximum number of commits to show'),
    oneline: z
      .boolean()
      .default(true)
      .describe('Show each commit on a single line'),
    path: z
      .string()
      .optional()
      .describe('Limit to commits affecting this path'),
    cwd: z.string().optional().describe('Repository directory'),
  }),
  execute: (params: {
    maxCount: number;
    oneline: boolean;
    path?: string;
    cwd?: string;
  }) => {
    try {
      let args = `log -${params.maxCount}`;
      if (params.oneline) {
        args += ' --oneline';
      } else {
        args += ' --format=%H%n%an%n%ae%n%ai%n%s%n---';
      }
      if (params.path) args += ` -- ${params.path}`;

      const output = gitExec(args, params.cwd);

      if (params.oneline) {
        const commits = output
          .split('\n')
          .filter(Boolean)
          .map((line) => {
            const spaceIdx = line.indexOf(' ');
            return {
              hash: line.slice(0, spaceIdx),
              message: line.slice(spaceIdx + 1),
            };
          });
        return Promise.resolve({ commits, count: commits.length });
      }

      return Promise.resolve({ log: output });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Git log failed: ${error.message}`);
      }
      throw error;
    }
  },
};

/**
 * Git branch tool
 */
export const gitBranchTool: Tool = {
  name: 'git_branch',
  description: 'List, create, or switch branches.',
  parameters: z.object({
    action: z
      .enum(['list', 'create', 'switch'])
      .default('list')
      .describe('Action to perform'),
    name: z
      .string()
      .optional()
      .describe('Branch name (required for create/switch)'),
    cwd: z.string().optional().describe('Repository directory'),
  }),
  execute: (params: {
    action: 'list' | 'create' | 'switch';
    name?: string;
    cwd?: string;
  }) => {
    try {
      switch (params.action) {
        case 'list': {
          const output = gitExec('branch -a', params.cwd);
          const current = gitExec('branch --show-current', params.cwd);
          const branches = output
            .split('\n')
            .filter(Boolean)
            .map((b) => b.replace(/^\*?\s+/, '').trim());
          return Promise.resolve({ branches, current });
        }
        case 'create': {
          if (!params.name) {
            throw new Error('Branch name is required for create action');
          }
          gitExec(`branch ${params.name}`, params.cwd);
          return Promise.resolve({ success: true, created: params.name });
        }
        case 'switch': {
          if (!params.name) {
            throw new Error('Branch name is required for switch action');
          }
          gitExec(`checkout ${params.name}`, params.cwd);
          return Promise.resolve({ success: true, switched: params.name });
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Git branch failed: ${error.message}`);
      }
      throw error;
    }
  },
};
