/**
 * Surf tools exports
 */

import { DesktopBackend } from '../types';

// Tool creators
export {
  createScreenshotTool,
  screenshotToolDefinition,
} from './screenshot.tool';
export { createClickTool, clickToolDefinition } from './click.tool';
export { createTypeTextTool, typeTextToolDefinition } from './type-text.tool';
export { createScrollTool, scrollToolDefinition } from './scroll.tool';
export { createDragTool, dragToolDefinition } from './drag.tool';
export { createKeyPressTool, keyPressToolDefinition } from './key-press.tool';
export {
  createCursorMoveTool,
  cursorMoveToolDefinition,
} from './cursor-move.tool';
export { createWaitTool, waitToolDefinition } from './wait.tool';

// Import tool creators for the factory function
import { createScreenshotTool } from './screenshot.tool';
import { createClickTool } from './click.tool';
import { createTypeTextTool } from './type-text.tool';
import { createScrollTool } from './scroll.tool';
import { createDragTool } from './drag.tool';
import { createKeyPressTool } from './key-press.tool';
import { createCursorMoveTool } from './cursor-move.tool';
import { createWaitTool } from './wait.tool';

/**
 * Create all Surf tools bound to a backend
 */
export function createSurfTools(backend: DesktopBackend) {
  return {
    screenshot: createScreenshotTool(backend),
    click: createClickTool(backend),
    typeText: createTypeTextTool(backend),
    scroll: createScrollTool(backend),
    drag: createDragTool(backend),
    keyPress: createKeyPressTool(backend),
    cursorMove: createCursorMoveTool(backend),
    wait: createWaitTool(backend),
  };
}

/**
 * Create an array of all Surf tools bound to a backend
 * Useful for registering with ToolRegistry
 */
export function createSurfToolsArray(backend: DesktopBackend) {
  return [
    createScreenshotTool(backend),
    createClickTool(backend),
    createTypeTextTool(backend),
    createScrollTool(backend),
    createDragTool(backend),
    createKeyPressTool(backend),
    createCursorMoveTool(backend),
    createWaitTool(backend),
  ];
}

/**
 * Tool names for reference
 */
export const SURF_TOOL_NAMES = [
  'computer_screenshot',
  'computer_click',
  'computer_type',
  'computer_scroll',
  'computer_drag',
  'computer_key',
  'computer_cursor_move',
  'computer_wait',
] as const;

export type SurfToolName = (typeof SURF_TOOL_NAMES)[number];
