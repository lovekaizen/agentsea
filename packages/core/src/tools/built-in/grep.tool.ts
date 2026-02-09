import { promises as fs } from 'fs';
import { join, relative } from 'path';

import { z } from 'zod';

import { Tool } from '../../types';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_IGNORE_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  '.next',
  'coverage',
  '.cache',
  'build',
  '__pycache__',
  '.venv',
]);

interface GrepMatch {
  file: string;
  line: number;
  content: string;
  contextBefore?: string[];
  contextAfter?: string[];
}

async function walkDir(
  dir: string,
  includePattern: RegExp | null,
): Promise<string[]> {
  const results: string[] = [];

  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (DEFAULT_IGNORE_DIRS.has(entry.name)) continue;
    if (entry.name.startsWith('.') && entry.name !== '.env.example') continue;

    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      const subResults = await walkDir(fullPath, includePattern);
      results.push(...subResults);
    } else if (entry.isFile()) {
      if (includePattern && !includePattern.test(entry.name)) continue;
      results.push(fullPath);
    }
  }

  return results;
}

async function searchFile(
  filePath: string,
  regex: RegExp,
  contextLines: number,
): Promise<GrepMatch[]> {
  const stats = await fs.stat(filePath);
  if (stats.size > MAX_FILE_SIZE) return [];

  const content = await fs.readFile(filePath, 'utf8');
  const lines = content.split('\n');
  const matches: GrepMatch[] = [];

  for (let i = 0; i < lines.length; i++) {
    // Reset lastIndex for regexes with `g` flag
    regex.lastIndex = 0;
    if (regex.test(lines[i])) {
      const match: GrepMatch = {
        file: filePath,
        line: i + 1,
        content: lines[i],
      };

      if (contextLines > 0) {
        const beforeStart = Math.max(0, i - contextLines);
        match.contextBefore = lines.slice(beforeStart, i);

        const afterEnd = Math.min(lines.length, i + 1 + contextLines);
        match.contextAfter = lines.slice(i + 1, afterEnd);
      }

      matches.push(match);
    }
  }

  return matches;
}

/**
 * Grep tool for recursive regex search in files
 */
export const grepTool: Tool = {
  name: 'grep',
  description:
    'Search for a regex pattern across files recursively. ' +
    'Skips files larger than 5MB and ignores common non-source directories. ' +
    'Returns matching lines with optional context.',
  parameters: z.object({
    pattern: z.string().describe('Regex pattern to search for'),
    path: z
      .string()
      .optional()
      .describe('Directory or file to search in (defaults to process.cwd())'),
    include: z
      .string()
      .optional()
      .describe('File name pattern to include (e.g., "*.ts", "*.{js,jsx}")'),
    caseInsensitive: z
      .boolean()
      .default(false)
      .describe('Whether to perform case-insensitive matching'),
    contextLines: z
      .number()
      .int()
      .min(0)
      .max(10)
      .default(0)
      .describe('Number of context lines before and after each match'),
    maxResults: z
      .number()
      .int()
      .min(1)
      .max(1000)
      .default(100)
      .describe('Maximum number of matches to return'),
  }),
  execute: async (params: {
    pattern: string;
    path?: string;
    include?: string;
    caseInsensitive: boolean;
    contextLines: number;
    maxResults: number;
  }) => {
    try {
      const searchPath = params.path || process.cwd();
      const flags = params.caseInsensitive ? 'gi' : 'g';

      // Build include filter regex from glob-like pattern
      let includePattern: RegExp | null = null;
      if (params.include) {
        const escaped = params.include
          .replace(/\./g, '\\.')
          .replace(/\*/g, '.*')
          .replace(/\{([^}]+)\}/g, (_match, group: string) => {
            return `(${group.split(',').join('|')})`;
          });
        includePattern = new RegExp(`^${escaped}$`);
      }

      // Determine if searching a file or directory
      const stat = await fs.stat(searchPath);
      let files: string[];

      if (stat.isFile()) {
        files = [searchPath];
      } else {
        files = await walkDir(searchPath, includePattern);
      }

      const allMatches: GrepMatch[] = [];

      for (const file of files) {
        if (allMatches.length >= params.maxResults) break;

        try {
          const matches = await searchFile(
            file,
            new RegExp(params.pattern, flags),
            params.contextLines,
          );

          for (const match of matches) {
            if (allMatches.length >= params.maxResults) break;
            // Make paths relative to search path for readability
            match.file = stat.isFile()
              ? match.file
              : relative(searchPath, match.file);
            allMatches.push(match);
          }
        } catch {
          // Skip files we can't read
        }
      }

      return {
        matches: allMatches,
        count: allMatches.length,
        filesSearched: files.length,
        truncated: allMatches.length >= params.maxResults,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Grep failed: ${error.message}`);
      }
      throw error;
    }
  },
};
