/**
 * Action-specific types and schemas
 */

import { z } from 'zod';

// Types imported for schema validation - prefixed to avoid unused warnings
import type {
  MouseButton as _MouseButton,
  ScrollDirection as _ScrollDirection,
  ModifierKey as _ModifierKey,
} from './surf.types';

/**
 * Screenshot action input schema
 */
export const screenshotInputSchema = z.object({
  region: z
    .object({
      x: z.number().describe('X coordinate of region start'),
      y: z.number().describe('Y coordinate of region start'),
      width: z.number().positive().describe('Width of region'),
      height: z.number().positive().describe('Height of region'),
    })
    .optional()
    .describe(
      'Optional region to capture. If not provided, captures full screen',
    ),
  format: z
    .enum(['png', 'jpeg'])
    .default('png')
    .describe('Image format for the screenshot'),
  quality: z
    .number()
    .min(0)
    .max(100)
    .default(90)
    .describe('JPEG quality (0-100), only applicable for jpeg format'),
});

/**
 * Screenshot action output schema
 */
export const screenshotOutputSchema = z.object({
  success: z
    .boolean()
    .describe('Whether the screenshot was taken successfully'),
  base64: z.string().describe('Base64 encoded screenshot image'),
  mimeType: z.string().describe('MIME type of the image'),
  width: z.number().describe('Width of the screenshot in pixels'),
  height: z.number().describe('Height of the screenshot in pixels'),
  scaleFactor: z.number().describe('Display scale factor'),
});

/**
 * Click action input schema
 */
export const clickInputSchema = z.object({
  x: z.number().describe('X coordinate to click'),
  y: z.number().describe('Y coordinate to click'),
  button: z
    .enum(['left', 'right', 'middle'] as const)
    .default('left')
    .describe('Mouse button to click'),
  clickType: z
    .enum(['single', 'double'] as const)
    .default('single')
    .describe('Single or double click'),
  modifiers: z
    .array(z.enum(['ctrl', 'alt', 'shift', 'meta', 'command'] as const))
    .optional()
    .describe('Modifier keys to hold during click'),
  holdMs: z
    .number()
    .min(0)
    .max(5000)
    .optional()
    .describe('Duration to hold the click in milliseconds'),
});

/**
 * Click action output schema
 */
export const clickOutputSchema = z.object({
  success: z.boolean().describe('Whether the click was executed successfully'),
  x: z.number().describe('X coordinate where clicked'),
  y: z.number().describe('Y coordinate where clicked'),
  action: z.string().describe('Action performed (click or doubleClick)'),
  duration: z.number().describe('Duration of the action in milliseconds'),
  error: z.string().optional().describe('Error message if the action failed'),
});

/**
 * Type text action input schema
 */
export const typeTextInputSchema = z.object({
  text: z.string().max(10000).describe('Text to type'),
  x: z
    .number()
    .optional()
    .describe('X coordinate to click before typing (optional)'),
  y: z
    .number()
    .optional()
    .describe('Y coordinate to click before typing (optional)'),
  delayMs: z
    .number()
    .min(0)
    .max(500)
    .default(0)
    .describe('Delay between keystrokes in milliseconds'),
  clearFirst: z
    .boolean()
    .default(false)
    .describe('Clear existing text before typing (Ctrl+A, Delete)'),
});

/**
 * Type text action output schema
 */
export const typeTextOutputSchema = z.object({
  success: z.boolean().describe('Whether the text was typed successfully'),
  textLength: z.number().describe('Number of characters typed'),
  duration: z.number().describe('Duration of the action in milliseconds'),
  error: z.string().optional().describe('Error message if the action failed'),
});

/**
 * Scroll action input schema
 */
export const scrollInputSchema = z.object({
  direction: z
    .enum(['up', 'down', 'left', 'right'] as const)
    .describe('Direction to scroll'),
  x: z.number().describe('X coordinate for scroll position'),
  y: z.number().describe('Y coordinate for scroll position'),
  amount: z
    .number()
    .min(1)
    .max(1000)
    .default(3)
    .describe('Scroll amount (number of scroll units/clicks)'),
  smooth: z.boolean().default(false).describe('Use smooth scrolling animation'),
});

/**
 * Scroll action output schema
 */
export const scrollOutputSchema = z.object({
  success: z.boolean().describe('Whether the scroll was executed successfully'),
  direction: z.string().describe('Direction scrolled'),
  amount: z.number().describe('Amount scrolled'),
  duration: z.number().describe('Duration of the action in milliseconds'),
  error: z.string().optional().describe('Error message if the action failed'),
});

/**
 * Drag action input schema
 */
export const dragInputSchema = z.object({
  fromX: z.number().describe('Starting X coordinate'),
  fromY: z.number().describe('Starting Y coordinate'),
  toX: z.number().describe('Ending X coordinate'),
  toY: z.number().describe('Ending Y coordinate'),
  button: z
    .enum(['left', 'right', 'middle'] as const)
    .default('left')
    .describe('Mouse button for drag'),
  durationMs: z
    .number()
    .min(100)
    .max(5000)
    .default(500)
    .describe('Duration of drag in milliseconds'),
});

/**
 * Drag action output schema
 */
export const dragOutputSchema = z.object({
  success: z.boolean().describe('Whether the drag was executed successfully'),
  fromX: z.number().describe('Starting X coordinate'),
  fromY: z.number().describe('Starting Y coordinate'),
  toX: z.number().describe('Ending X coordinate'),
  toY: z.number().describe('Ending Y coordinate'),
  duration: z.number().describe('Duration of the action in milliseconds'),
  error: z.string().optional().describe('Error message if the action failed'),
});

/**
 * Key press action input schema
 */
export const keyPressInputSchema = z.object({
  key: z
    .string()
    .describe(
      'Key to press (e.g., "enter", "escape", "tab", "a", "f1", "backspace", "delete")',
    ),
  modifiers: z
    .array(z.enum(['ctrl', 'alt', 'shift', 'meta', 'command', 'win'] as const))
    .optional()
    .describe(
      'Modifier keys to hold (e.g., ["ctrl", "shift"] for Ctrl+Shift+Key)',
    ),
  repeat: z
    .number()
    .min(1)
    .max(100)
    .default(1)
    .describe('Number of times to repeat the key press'),
  holdMs: z
    .number()
    .min(0)
    .max(5000)
    .optional()
    .describe('Duration to hold the key in milliseconds'),
});

/**
 * Key press action output schema
 */
export const keyPressOutputSchema = z.object({
  success: z
    .boolean()
    .describe('Whether the key press was executed successfully'),
  key: z.string().describe('Key that was pressed'),
  modifiers: z.array(z.string()).optional().describe('Modifier keys used'),
  repeat: z.number().describe('Number of times the key was pressed'),
  duration: z.number().describe('Duration of the action in milliseconds'),
  error: z.string().optional().describe('Error message if the action failed'),
});

/**
 * Cursor move action input schema
 */
export const cursorMoveInputSchema = z.object({
  x: z.number().describe('Target X coordinate'),
  y: z.number().describe('Target Y coordinate'),
  smooth: z
    .boolean()
    .default(false)
    .describe('Use smooth cursor movement animation'),
  durationMs: z
    .number()
    .min(0)
    .max(2000)
    .default(0)
    .describe('Duration of movement in milliseconds (for smooth mode)'),
});

/**
 * Cursor move action output schema
 */
export const cursorMoveOutputSchema = z.object({
  success: z.boolean().describe('Whether the cursor was moved successfully'),
  x: z.number().describe('Final X coordinate'),
  y: z.number().describe('Final Y coordinate'),
  duration: z.number().describe('Duration of the action in milliseconds'),
  error: z.string().optional().describe('Error message if the action failed'),
});

/**
 * Wait action input schema
 */
export const waitInputSchema = z.object({
  ms: z
    .number()
    .min(100)
    .max(30000)
    .describe('Duration to wait in milliseconds'),
  reason: z
    .string()
    .optional()
    .describe('Reason for waiting (for logging/debugging)'),
});

/**
 * Wait action output schema
 */
export const waitOutputSchema = z.object({
  success: z.boolean().describe('Whether the wait completed successfully'),
  waitedMs: z.number().describe('Actual time waited in milliseconds'),
  reason: z.string().optional().describe('Reason for waiting'),
});

/**
 * Inferred types from schemas
 */
export type ScreenshotInput = z.infer<typeof screenshotInputSchema>;
export type ScreenshotOutput = z.infer<typeof screenshotOutputSchema>;
export type ClickInput = z.infer<typeof clickInputSchema>;
export type ClickOutput = z.infer<typeof clickOutputSchema>;
export type TypeTextInput = z.infer<typeof typeTextInputSchema>;
export type TypeTextOutput = z.infer<typeof typeTextOutputSchema>;
export type ScrollInput = z.infer<typeof scrollInputSchema>;
export type ScrollOutput = z.infer<typeof scrollOutputSchema>;
export type DragInput = z.infer<typeof dragInputSchema>;
export type DragOutput = z.infer<typeof dragOutputSchema>;
export type KeyPressInput = z.infer<typeof keyPressInputSchema>;
export type KeyPressOutput = z.infer<typeof keyPressOutputSchema>;
export type CursorMoveInput = z.infer<typeof cursorMoveInputSchema>;
export type CursorMoveOutput = z.infer<typeof cursorMoveOutputSchema>;
export type WaitInput = z.infer<typeof waitInputSchema>;
export type WaitOutput = z.infer<typeof waitOutputSchema>;
