/**
 * Type text tool - Type text at the current cursor position or coordinates
 */

import { serverTool } from '@lov3kaizen/agentsea-core';

import {
  typeTextInputSchema,
  typeTextOutputSchema,
  DesktopBackend,
} from '../types';

/**
 * Create a type text tool bound to a specific backend
 */
export function createTypeTextTool(backend: DesktopBackend) {
  return serverTool({
    name: 'computer_type',
    description:
      'Type text at the current cursor position or at specified coordinates. Can optionally clear existing text first (useful for text fields). Use this to enter text into input fields, search boxes, editors, etc.',
    inputSchema: typeTextInputSchema,
    outputSchema: typeTextOutputSchema,
    execute: async (input) => {
      const startTime = Date.now();

      try {
        const options = {
          point:
            input.x !== undefined && input.y !== undefined
              ? { x: input.x, y: input.y }
              : undefined,
          delayMs: input.delayMs,
          clearFirst: input.clearFirst,
        };

        const result = await backend.typeText(input.text, options);

        return {
          success: result.success,
          textLength: input.text.length,
          duration: Date.now() - startTime,
          error: result.error,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        return {
          success: false,
          textLength: input.text.length,
          duration: Date.now() - startTime,
          error: `Type text failed: ${errorMessage}`,
        };
      }
    },
  });
}

/**
 * Type text tool definition (requires backend injection)
 */
export const typeTextToolDefinition = {
  name: 'computer_type',
  description:
    'Type text at the current cursor position or at specified coordinates. Can optionally clear existing text first.',
  inputSchema: typeTextInputSchema,
  outputSchema: typeTextOutputSchema,
};
