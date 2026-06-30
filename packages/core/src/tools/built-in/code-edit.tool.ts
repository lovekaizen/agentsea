import { promises as fs } from 'fs';

import { z } from 'zod';

import { Tool } from '../../types';
import { resolveWithinRoot } from './path-guard';

/**
 * Code edit tool using exact string search-and-replace.
 * Uses literal string matching (not regex) to minimize LLM mistakes.
 */
export const codeEditTool: Tool = {
  name: 'code_edit',
  description:
    'Edit a file by replacing an exact string match with new content. ' +
    'Uses literal string matching (not regex). ' +
    'Set oldString to empty and newString to content to insert at the beginning of the file. ' +
    'Set newString to empty to delete the matched text.',
  parameters: z.object({
    path: z.string().describe('Path to the file to edit'),
    oldString: z
      .string()
      .describe(
        'The exact string to find and replace. Must match file content exactly including whitespace and indentation.',
      ),
    newString: z
      .string()
      .describe(
        'The replacement string. Use empty string to delete the matched text.',
      ),
    expectedReplacements: z
      .number()
      .int()
      .min(1)
      .default(1)
      .describe(
        'Expected number of occurrences to replace. Fails if actual count differs. Defaults to 1.',
      ),
  }),
  execute: async (params: {
    path: string;
    oldString: string;
    newString: string;
    expectedReplacements: number;
  }) => {
    try {
      const safePath = resolveWithinRoot(params.path);
      const content = await fs.readFile(safePath, 'utf8');

      // Handle insert-at-beginning case
      if (params.oldString === '') {
        const newContent = params.newString + content;
        await fs.writeFile(safePath, newContent, 'utf8');
        return {
          success: true,
          path: safePath,
          replacements: 1,
          message: 'Content inserted at beginning of file',
        };
      }

      // Count occurrences
      let count = 0;
      let searchFrom = 0;
      let idx = content.indexOf(params.oldString, searchFrom);
      while (idx !== -1) {
        count++;
        searchFrom = idx + params.oldString.length;
        idx = content.indexOf(params.oldString, searchFrom);
      }

      if (count === 0) {
        throw new Error(
          `String not found in ${params.path}. Make sure the oldString matches exactly, ` +
            `including whitespace and indentation.`,
        );
      }

      if (count !== params.expectedReplacements) {
        throw new Error(
          `Expected ${params.expectedReplacements} occurrence(s) of the string, ` +
            `but found ${count} in ${params.path}. ` +
            `Provide more context in oldString to make the match unique, ` +
            `or set expectedReplacements to ${count}.`,
        );
      }

      // Perform replacement
      const newContent = content.split(params.oldString).join(params.newString);
      await fs.writeFile(safePath, newContent, 'utf8');

      return {
        success: true,
        path: safePath,
        replacements: count,
        message: `Replaced ${count} occurrence(s)`,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Code edit failed: ${error.message}`);
      }
      throw error;
    }
  },
};
