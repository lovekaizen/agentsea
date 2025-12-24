/**
 * Core types for Surf computer-use functionality
 */

/**
 * 2D point coordinates
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Screen dimensions with scale factor
 */
export interface ScreenDimensions {
  width: number;
  height: number;
  scaleFactor: number;
}

/**
 * Mouse button types
 */
export type MouseButton = 'left' | 'right' | 'middle';

/**
 * Scroll direction types
 */
export type ScrollDirection = 'up' | 'down' | 'left' | 'right';

/**
 * Modifier keys for keyboard combinations
 */
export type ModifierKey = 'ctrl' | 'alt' | 'shift' | 'meta' | 'command' | 'win';

/**
 * Screenshot result from backend
 */
export interface ScreenshotResult {
  /** Raw image buffer */
  image: Buffer;
  /** Base64 encoded image for API transmission */
  base64: string;
  /** MIME type of the image */
  mimeType: 'image/png' | 'image/jpeg';
  /** Dimensions of the captured screenshot */
  dimensions: ScreenDimensions;
  /** Timestamp when screenshot was taken */
  timestamp: Date;
}

/**
 * Sandbox configuration for security constraints
 */
export interface SandboxConfig {
  /** Enable sandbox mode */
  enabled: boolean;
  /** Allowed file system paths (if set, only these paths are accessible) */
  allowedPaths?: string[];
  /** Blocked file system paths */
  blockedPaths?: string[];
  /** Allowed domains for browser navigation */
  allowedDomains?: string[];
  /** Blocked domains */
  blockedDomains?: string[];
  /** Allowed shell commands */
  allowedCommands?: string[];
  /** Blocked shell commands/patterns */
  blockedCommands?: string[];
  /** Maximum actions per minute (rate limiting) */
  maxActionsPerMinute?: number;
}

/**
 * Vision analyzer configuration
 */
export interface VisionConfig {
  /** Model to use for vision analysis (e.g., 'claude-3-5-sonnet-20241022') */
  model: string;
  /** Maximum tokens for vision response */
  maxTokens: number;
  /** Include screenshot in agent response */
  includeScreenshotInResponse: boolean;
}

/**
 * Surf agent configuration
 */
export interface SurfConfig {
  /** Maximum steps/iterations before stopping */
  maxSteps: number;
  /** Delay in ms after action before taking screenshot */
  screenshotDelay: number;
  /** Default timeout for actions in ms */
  defaultTimeout: number;
  /** Coordinate scaling mode */
  scalingMode: 'native' | 'scaled' | 'auto';
  /** Target resolution for scaled mode */
  targetResolution?: ScreenDimensions;
  /** Sandbox security configuration */
  sandbox: SandboxConfig;
  /** Vision analyzer configuration */
  vision: VisionConfig;
}

/**
 * Surf agent execution state
 */
export interface SurfState {
  /** Current step number */
  currentStep: number;
  /** Maximum steps allowed */
  maxSteps: number;
  /** Last screenshot taken */
  lastScreenshot?: ScreenshotResult;
  /** History of actions taken */
  actionHistory: ActionHistoryEntry[];
  /** Current execution status */
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  /** Execution start time */
  startTime?: Date;
  /** Execution end time */
  endTime?: Date;
  /** Error message if status is 'error' */
  error?: string;
}

/**
 * Entry in action history
 */
export interface ActionHistoryEntry {
  /** Step number */
  step: number;
  /** Action name */
  action: string;
  /** Action parameters */
  params: Record<string, unknown>;
  /** Whether the action succeeded */
  success: boolean;
  /** Duration in ms */
  duration: number;
  /** Error message if failed */
  error?: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Streaming event types for executeStream
 */
export type StreamEventType =
  | 'screenshot'
  | 'analysis'
  | 'action'
  | 'action_result'
  | 'thinking'
  | 'complete'
  | 'error';

/**
 * Base stream event
 */
export interface BaseStreamEvent {
  type: StreamEventType;
  step: number;
  timestamp: Date;
}

/**
 * Screenshot taken event
 */
export interface ScreenshotStreamEvent extends BaseStreamEvent {
  type: 'screenshot';
  screenshot: ScreenshotResult;
}

/**
 * Screen analysis event
 */
export interface AnalysisStreamEvent extends BaseStreamEvent {
  type: 'analysis';
  analysis: ScreenAnalysis;
}

/**
 * Action about to execute event
 */
export interface ActionStreamEvent extends BaseStreamEvent {
  type: 'action';
  action: SuggestedAction;
}

/**
 * Action result event
 */
export interface ActionResultStreamEvent extends BaseStreamEvent {
  type: 'action_result';
  result: ActionResult;
}

/**
 * Agent thinking/reasoning event
 */
export interface ThinkingStreamEvent extends BaseStreamEvent {
  type: 'thinking';
  content: string;
}

/**
 * Task complete event
 */
export interface CompleteStreamEvent extends BaseStreamEvent {
  type: 'complete';
  response: string;
  state: SurfState;
}

/**
 * Error event
 */
export interface ErrorStreamEvent extends BaseStreamEvent {
  type: 'error';
  error: string;
}

/**
 * Union of all stream events
 */
export type StreamEvent =
  | ScreenshotStreamEvent
  | AnalysisStreamEvent
  | ActionStreamEvent
  | ActionResultStreamEvent
  | ThinkingStreamEvent
  | CompleteStreamEvent
  | ErrorStreamEvent;

/**
 * Screen analysis result from vision analyzer
 */
export interface ScreenAnalysis {
  /** Description of current screen state */
  description: string;
  /** Detected UI elements */
  elements: UIElement[];
  /** Suggested actions to take */
  suggestedActions: SuggestedAction[];
  /** Current application/window state */
  currentState: string;
}

/**
 * Detected UI element
 */
export interface UIElement {
  /** Type of UI element */
  type:
    | 'button'
    | 'input'
    | 'link'
    | 'text'
    | 'image'
    | 'menu'
    | 'window'
    | 'checkbox'
    | 'dropdown'
    | 'other';
  /** Label/text of the element */
  label?: string;
  /** Bounding box coordinates */
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Center point for clicking */
  clickPoint?: Point;
  /** Confidence score (0-1) */
  confidence: number;
}

/**
 * Suggested action from vision analyzer
 */
export interface SuggestedAction {
  /** Action type */
  action:
    | 'click'
    | 'type'
    | 'scroll'
    | 'keyPress'
    | 'drag'
    | 'wait'
    | 'doubleClick'
    | 'moveCursor';
  /** Human-readable description */
  description: string;
  /** Action parameters */
  params: Record<string, unknown>;
  /** Confidence score (0-1) */
  confidence: number;
}

/**
 * Result of executing an action
 */
export interface ActionResult {
  /** Whether the action succeeded */
  success: boolean;
  /** Action name */
  action: string;
  /** Timestamp */
  timestamp: Date;
  /** Duration in ms */
  duration: number;
  /** Error message if failed */
  error?: string;
  /** Screenshot taken after action (if configured) */
  screenshot?: ScreenshotResult;
}

/**
 * Default configuration values
 */
export const DEFAULT_SURF_CONFIG: SurfConfig = {
  maxSteps: 50,
  screenshotDelay: 500,
  defaultTimeout: 30000,
  scalingMode: 'auto',
  sandbox: {
    enabled: true,
    maxActionsPerMinute: 60,
  },
  vision: {
    model: 'claude-sonnet-4-20250514',
    maxTokens: 4096,
    includeScreenshotInResponse: true,
  },
};
