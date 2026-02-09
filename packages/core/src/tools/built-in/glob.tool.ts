import { promises as fs } from 'fs';

import fg from 'fast-glob';
import { z } from 'zod';

import { Tool } from '../../types';

const DEFAULT_IGNORE = [
  '**/node_modules/**',
  '**/dist/**',
  '**/.git/**',
  '**/.next/**',
  '**/coverage/**',
  '**/.cache/**',
  '**/build/**',
];

/**
 * Glob tool for file pattern matching
 */
export const globTool: Tool = {
  name: 'glob',
  description:
    'Find files matching a glob pattern. Returns file paths sorted by modification time (newest first). ' +
    'Ignores node_modules, dist, .git, .next, coverage, .cache, and build directories by default.',
  parameters: z.object({
    pattern: z
      .string()
      .describe(
        'Glob pattern to match (e.g., "**/*.ts", "src/**/*.{ts,tsx}", "*.json")',
      ),
    cwd: z
      .string()
      .optional()
      .describe('Directory to search in (defaults to process.cwd())'),
    ignore: z
      .array(z.string())
      .optional()
      .describe('Additional patterns to ignore'),
    maxResults: z
      .number()
      .int()
      .min(1)
      .max(10000)
      .default(1000)
      .describe('Maximum number of results to return (default 1000)'),
  }),
  execute: async (params: {
    pattern: string;
    cwd?: string;
    ignore?: string[];
    maxResults: number;
  }) => {
    try {
      const cwd = params.cwd || process.cwd();
      const ignorePatterns = [...DEFAULT_IGNORE, ...(params.ignore || [])];

      const files = await fg(params.pattern, {
        cwd,
        ignore: ignorePatterns,
        absolute: true,
        dot: false,
        onlyFiles: true,
      });

      // Sort by modification time (newest first)
      const withStats = await Promise.all(
        files.map(async (filePath) => {
          try {
            const stats = await fs.stat(filePath);
            return { path: filePath, mtime: stats.mtimeMs };
          } catch {
            return { path: filePath, mtime: 0 };
          }
        }),
      );

      withStats.sort((a, b) => b.mtime - a.mtime);
      const limited = withStats.slice(0, params.maxResults);

      return {
        files: limited.map((f) => f.path),
        count: limited.length,
        totalMatches: files.length,
        truncated: files.length > params.maxResults,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Glob failed: ${error.message}`);
      }
      throw error;
    }
  },
};
