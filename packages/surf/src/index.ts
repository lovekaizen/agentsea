/**
 * @lov3kaizen/agentsea-surf
 *
 * Surf - Computer-use agent for AgentSea. Control desktop environments through
 * screen capture, mouse, and keyboard actions using Claude's vision capabilities.
 */

// Types
export * from './types';

// Tools
export {
  createSurfTools,
  createSurfToolsArray,
  createScreenshotTool,
  createClickTool,
  createTypeTextTool,
  createScrollTool,
  createDragTool,
  createKeyPressTool,
  createCursorMoveTool,
  createWaitTool,
  screenshotToolDefinition,
  clickToolDefinition,
  typeTextToolDefinition,
  scrollToolDefinition,
  dragToolDefinition,
  keyPressToolDefinition,
  cursorMoveToolDefinition,
  waitToolDefinition,
  SURF_TOOL_NAMES,
  type SurfToolName,
} from './tools';

// Backends
export {
  BaseBackend,
  MacOSBackend,
  LinuxBackend,
  WindowsBackend,
  createNativeBackend,
  PuppeteerBackend,
  DockerBackend,
  createBackend,
} from './backends';

// Agent
export { SurfAgent, VisionAnalyzer, CoordinateScaler } from './agent';

// Utilities
export {
  SecurityValidator,
  type ValidationResult,
  resizeImage,
  imageToBase64,
  base64ToImage,
  getImageDimensions,
  cropImage,
  convertImageFormat,
  calculateImageHash,
  compareImageHashes,
} from './utils';

// Re-export core types from agentsea-core
export type {
  AgentContext,
  ToolContext,
  Tool,
} from '@lov3kaizen/agentsea-core';
