/**
 * Key press tool - Press keyboard keys or combinations
 */

import { serverTool } from '@lov3kaizen/agentsea-core';

import {
  keyPressInputSchema,
  keyPressOutputSchema,
  DesktopBackend,
  ModifierKey,
} from '../types';

/**
 * Create a key press tool bound to a specific backend
 */
export function createKeyPressTool(backend: DesktopBackend) {
  return serverTool({
    name: 'computer_key',
    description:
      'Press a keyboard key or key combination. Supports all standard keys (enter, escape, tab, backspace, delete, arrows, function keys, etc.) and modifier combinations (ctrl, alt, shift, meta/command). Use this for keyboard shortcuts, navigation, and special key inputs.',
    inputSchema: keyPressInputSchema,
    outputSchema: keyPressOutputSchema,
    execute: async (input) => {
      const startTime = Date.now();

      try {
        // Execute key press with optional repeats
        for (let i = 0; i < input.repeat; i++) {
          const result = await backend.keyPress(
            input.key,
            input.modifiers as ModifierKey[] | undefined,
          );

          if (!result.success) {
            return {
              success: false,
              key: input.key,
              modifiers: input.modifiers,
              repeat: i + 1,
              duration: Date.now() - startTime,
              error: result.error,
            };
          }

          // Add hold delay if specified
          if (input.holdMs && input.holdMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, input.holdMs));
          }
        }

        return {
          success: true,
          key: input.key,
          modifiers: input.modifiers,
          repeat: input.repeat,
          duration: Date.now() - startTime,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        return {
          success: false,
          key: input.key,
          modifiers: input.modifiers,
          repeat: input.repeat,
          duration: Date.now() - startTime,
          error: `Key press failed: ${errorMessage}`,
        };
      }
    },
  });
}

/**
 * Key press tool definition (requires backend injection)
 */
export const keyPressToolDefinition = {
  name: 'computer_key',
  description:
    'Press a keyboard key or key combination. Supports all standard keys and modifier combinations.',
  inputSchema: keyPressInputSchema,
  outputSchema: keyPressOutputSchema,
};
