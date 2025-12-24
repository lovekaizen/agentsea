/**
 * Click tool - Single or double click at screen coordinates
 */

import { serverTool } from '@lov3kaizen/agentsea-core';

import {
  clickInputSchema,
  clickOutputSchema,
  DesktopBackend,
  ModifierKey,
} from '../types';

/**
 * Create a click tool bound to a specific backend
 */
export function createClickTool(backend: DesktopBackend) {
  return serverTool({
    name: 'computer_click',
    description:
      'Click at specified screen coordinates. Supports single/double click, different mouse buttons (left, right, middle), and modifier keys (ctrl, alt, shift, meta). Use this to interact with buttons, links, and other clickable elements.',
    inputSchema: clickInputSchema,
    outputSchema: clickOutputSchema,
    execute: async (input) => {
      const startTime = Date.now();
      const point = { x: input.x, y: input.y };

      try {
        const options = {
          button: input.button,
          holdMs: input.holdMs,
          modifiers: input.modifiers as ModifierKey[] | undefined,
        };

        let result;
        if (input.clickType === 'double') {
          result = await backend.doubleClick(point, options);
        } else {
          result = await backend.click(point, options);
        }

        return {
          success: result.success,
          x: input.x,
          y: input.y,
          action: input.clickType === 'double' ? 'doubleClick' : 'click',
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
          action: input.clickType === 'double' ? 'doubleClick' : 'click',
          duration: Date.now() - startTime,
          error: `Click failed: ${errorMessage}`,
        };
      }
    },
  });
}

/**
 * Click tool definition (requires backend injection)
 */
export const clickToolDefinition = {
  name: 'computer_click',
  description:
    'Click at specified screen coordinates. Supports single/double click, different mouse buttons, and modifier keys.',
  inputSchema: clickInputSchema,
  outputSchema: clickOutputSchema,
};
