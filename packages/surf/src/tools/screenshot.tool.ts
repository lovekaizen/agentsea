/**
 * Screenshot tool - Capture the current screen or a specific region
 */

import { serverTool } from '@lov3kaizen/agentsea-core';

import {
  screenshotInputSchema,
  screenshotOutputSchema,
  DesktopBackend,
} from '../types';

/**
 * Create a screenshot tool bound to a specific backend
 */
export function createScreenshotTool(backend: DesktopBackend) {
  return serverTool({
    name: 'computer_screenshot',
    description:
      'Take a screenshot of the current screen or a specific region. Returns the image as base64 for vision analysis. Use this to see what is currently displayed on the screen.',
    inputSchema: screenshotInputSchema,
    outputSchema: screenshotOutputSchema,
    execute: async (input) => {
      const _startTime = Date.now();

      try {
        const result = await backend.screenshot({
          region: input.region,
          format: input.format,
          quality: input.quality,
        });

        return {
          success: true,
          base64: result.base64,
          mimeType: result.mimeType,
          width: result.dimensions.width,
          height: result.dimensions.height,
          scaleFactor: result.dimensions.scaleFactor,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Screenshot failed: ${errorMessage}`);
      }
    },
  });
}

/**
 * Screenshot tool definition (requires backend injection)
 */
export const screenshotToolDefinition = {
  name: 'computer_screenshot',
  description:
    'Take a screenshot of the current screen or a specific region. Returns the image as base64 for vision analysis.',
  inputSchema: screenshotInputSchema,
  outputSchema: screenshotOutputSchema,
};
