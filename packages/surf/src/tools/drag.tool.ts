/**
 * Drag tool - Drag from one point to another
 */

import { serverTool } from '@lov3kaizen/agentsea-core';

import {
  dragInputSchema,
  dragOutputSchema,
  DesktopBackend,
  MouseButton,
} from '../types';

/**
 * Create a drag tool bound to a specific backend
 */
export function createDragTool(backend: DesktopBackend) {
  return serverTool({
    name: 'computer_drag',
    description:
      'Drag from one point to another. Useful for drag-and-drop operations, selecting text, moving windows, resizing elements, or drawing.',
    inputSchema: dragInputSchema,
    outputSchema: dragOutputSchema,
    execute: async (input) => {
      const startTime = Date.now();
      const from = { x: input.fromX, y: input.fromY };
      const to = { x: input.toX, y: input.toY };

      try {
        const result = await backend.drag(from, to, {
          button: input.button as MouseButton,
          durationMs: input.durationMs,
        });

        return {
          success: result.success,
          fromX: input.fromX,
          fromY: input.fromY,
          toX: input.toX,
          toY: input.toY,
          duration: Date.now() - startTime,
          error: result.error,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        return {
          success: false,
          fromX: input.fromX,
          fromY: input.fromY,
          toX: input.toX,
          toY: input.toY,
          duration: Date.now() - startTime,
          error: `Drag failed: ${errorMessage}`,
        };
      }
    },
  });
}

/**
 * Drag tool definition (requires backend injection)
 */
export const dragToolDefinition = {
  name: 'computer_drag',
  description:
    'Drag from one point to another. Useful for drag-and-drop operations, selecting text, or moving windows.',
  inputSchema: dragInputSchema,
  outputSchema: dragOutputSchema,
};
