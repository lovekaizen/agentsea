/**
 * Cursor move tool - Move the cursor to coordinates without clicking
 */

import { serverTool } from '@lov3kaizen/agentsea-core';

import {
  cursorMoveInputSchema,
  cursorMoveOutputSchema,
  DesktopBackend,
} from '../types';

/**
 * Create a cursor move tool bound to a specific backend
 */
export function createCursorMoveTool(backend: DesktopBackend) {
  return serverTool({
    name: 'computer_cursor_move',
    description:
      'Move the cursor to specified coordinates without clicking. Useful for hover effects, tooltip activation, or positioning before other actions.',
    inputSchema: cursorMoveInputSchema,
    outputSchema: cursorMoveOutputSchema,
    execute: async (input) => {
      const startTime = Date.now();
      const point = { x: input.x, y: input.y };

      try {
        // For smooth movement, we might need to implement interpolation
        // For now, delegate to backend which may or may not support smooth
        const result = await backend.moveCursor(point);

        // If smooth movement with duration is requested, add delay
        if (input.smooth && input.durationMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, input.durationMs));
        }

        return {
          success: result.success,
          x: input.x,
          y: input.y,
          duration: Date.now() - startTime,
          error: result.error,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        return {
          success: false,
          x: input.x,
          y: input.y,
          duration: Date.now() - startTime,
          error: `Cursor move failed: ${errorMessage}`,
        };
      }
    },
  });
}

/**
 * Cursor move tool definition (requires backend injection)
 */
export const cursorMoveToolDefinition = {
  name: 'computer_cursor_move',
  description:
    'Move the cursor to specified coordinates without clicking. Useful for hover effects or positioning.',
  inputSchema: cursorMoveInputSchema,
  outputSchema: cursorMoveOutputSchema,
};
