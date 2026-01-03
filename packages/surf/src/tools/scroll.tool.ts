/**
 * Scroll tool - Scroll the screen in a specified direction
 */

import { serverTool } from '@lov3kaizen/agentsea-core';

import {
  scrollInputSchema,
  scrollOutputSchema,
  DesktopBackend,
  ScrollDirection,
} from '../types';

/**
 * Create a scroll tool bound to a specific backend
 */
export function createScrollTool(backend: DesktopBackend) {
  return serverTool({
    name: 'computer_scroll',
    description:
      'Scroll the screen in a specified direction (up, down, left, right) at given coordinates. Use this to navigate through long pages, lists, or documents.',
    inputSchema: scrollInputSchema,
    outputSchema: scrollOutputSchema,
    execute: async (input) => {
      const startTime = Date.now();
      const point = { x: input.x, y: input.y };

      try {
        const result = await backend.scroll(
          input.direction as ScrollDirection,
          point,
          {
            amount: input.amount,
            smooth: input.smooth,
          },
        );

        return {
          success: result.success,
          direction: input.direction,
          amount: input.amount,
          duration: Date.now() - startTime,
          error: result.error,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        return {
          success: false,
          direction: input.direction,
          amount: input.amount,
          duration: Date.now() - startTime,
          error: `Scroll failed: ${errorMessage}`,
        };
      }
    },
  });
}

/**
 * Scroll tool definition (requires backend injection)
 */
export const scrollToolDefinition = {
  name: 'computer_scroll',
  description:
    'Scroll the screen in a specified direction at given coordinates.',
  inputSchema: scrollInputSchema,
  outputSchema: scrollOutputSchema,
};
