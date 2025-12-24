/**
 * Wait tool - Wait for a specified duration
 */

import { serverTool } from '@lov3kaizen/agentsea-core';

import { waitInputSchema, waitOutputSchema, DesktopBackend } from '../types';

/**
 * Create a wait tool bound to a specific backend
 */
export function createWaitTool(backend: DesktopBackend) {
  return serverTool({
    name: 'computer_wait',
    description:
      'Wait for a specified duration in milliseconds. Use this to wait for page loads, animations, network requests, or UI updates to complete before taking the next action.',
    inputSchema: waitInputSchema,
    outputSchema: waitOutputSchema,
    execute: async (input) => {
      const startTime = Date.now();

      try {
        await backend.wait(input.ms);

        return {
          success: true,
          waitedMs: Date.now() - startTime,
          reason: input.reason,
        };
      } catch (error) {
        const _errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        return {
          success: false,
          waitedMs: Date.now() - startTime,
          reason: input.reason,
        };
      }
    },
  });
}

/**
 * Wait tool definition (requires backend injection)
 */
export const waitToolDefinition = {
  name: 'computer_wait',
  description:
    'Wait for a specified duration. Useful for waiting for page loads, animations, or UI updates.',
  inputSchema: waitInputSchema,
  outputSchema: waitOutputSchema,
};
