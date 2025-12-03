import { promises as fs } from 'fs';
import { join } from 'path';

import { z } from 'zod';

import { Tool } from '../../types';

/**
 * File read tool for reading file contents
 */
export const fileReadTool: Tool = {
  name: 'file_read',
  description: 'Read contents of a file from the file system',
  parameters: z.object({
    path: z.string().describe('Path to the file to read'),
    encoding: z
      .enum(['utf8', 'binary', 'base64'])
      .default('utf8')
      .describe('File encoding'),
  }),
  execute: async (params: {
    path: string;
    encoding: 'utf8' | 'binary' | 'base64';
  }) => {
    try {
      const content = await fs.readFile(
        params.path,
        params.encoding as BufferEncoding,
      );
      const stats = await fs.stat(params.path);

      return {
        content,
        size: stats.size,
        modified: stats.mtime,
        created: stats.birthtime,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to read file: ${error.message}`);
      }
      throw error;
    }
  },
};

/**
 * File write tool for writing content to files
 */
export const fileWriteTool: Tool = {
  name: 'file_write',
  description: 'Write content to a file on the file system',
  parameters: z.object({
    path: z.string().describe('Path where the file should be written'),
    content: z.string().describe('Content to write to the file'),
    encoding: z
      .enum(['utf8', 'binary', 'base64'])
      .default('utf8')
      .describe('File encoding'),
    append: z
      .boolean()
      .default(false)
      .describe('Whether to append to existing file'),
  }),
  execute: async (params: {
    path: string;
    content: string;
    encoding: 'utf8' | 'binary' | 'base64';
    append: boolean;
  }) => {
    try {
      if (params.append) {
        await fs.appendFile(
          params.path,
          params.content,
          params.encoding as BufferEncoding,
        );
      } else {
        await fs.writeFile(
          params.path,
          params.content,
          params.encoding as BufferEncoding,
        );
      }

      const stats = await fs.stat(params.path);

      return {
        success: true,
        path: params.path,
        size: stats.size,
        modified: stats.mtime,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to write file: ${error.message}`);
      }
      throw error;
    }
  },
};

/**
 * File list tool for listing directory contents
 */
export const fileListTool: Tool = {
  name: 'file_list',
  description: 'List files and directories in a given path',
  parameters: z.object({
    path: z.string().describe('Directory path to list'),
    recursive: z
      .boolean()
      .default(false)
      .describe('Whether to list recursively'),
  }),
  execute: async (params: { path: string; recursive: boolean }) => {
    try {
      const items = await fs.readdir(params.path, { withFileTypes: true });
      const results = [];

      for (const item of items) {
        const fullPath = join(params.path, item.name);
        const stats = await fs.stat(fullPath);

        results.push({
          name: item.name,
          path: fullPath,
          type: item.isDirectory() ? 'directory' : 'file',
          size: stats.size,
          modified: stats.mtime,
        });

        // Recurse if needed
        if (params.recursive && item.isDirectory()) {
          const subItems = await fileListTool.execute(
            { path: fullPath, recursive: true },
            { agentName: '', conversationId: '', metadata: {} },
          );
          if (Array.isArray(subItems.items)) {
            results.push(...subItems.items);
          }
        }
      }

      return {
        path: params.path,
        items: results,
        count: results.length,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to list directory: ${error.message}`);
      }
      throw error;
    }
  },
};
