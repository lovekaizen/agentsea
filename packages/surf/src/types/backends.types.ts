/**
 * Backend interfaces and configuration types
 */

import {
  Point,
  ScreenDimensions,
  ScreenshotResult,
  ActionResult,
  MouseButton,
  ScrollDirection,
  ModifierKey,
} from './surf.types';

/**
 * Screenshot capture options
 */
export interface ScreenshotOptions {
  /** Capture a specific region instead of full screen */
  region?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Image format */
  format?: 'png' | 'jpeg';
  /** JPEG quality (0-100) */
  quality?: number;
}

/**
 * Click action options
 */
export interface ClickOptions {
  /** Mouse button to use */
  button?: MouseButton;
  /** Duration to hold the click in ms */
  holdMs?: number;
  /** Modifier keys to hold during click */
  modifiers?: ModifierKey[];
}

/**
 * Type text action options
 */
export interface TypeOptions {
  /** Point to click before typing (optional) */
  point?: Point;
  /** Delay between keystrokes in ms */
  delayMs?: number;
  /** Clear existing text first (Ctrl+A, Delete) */
  clearFirst?: boolean;
}

/**
 * Scroll action options
 */
export interface ScrollOptions {
  /** Scroll amount (pixels or scroll units) */
  amount?: number;
  /** Use smooth scrolling animation */
  smooth?: boolean;
}

/**
 * Drag action options
 */
export interface DragOptions {
  /** Mouse button for drag */
  button?: MouseButton;
  /** Duration of drag in ms */
  durationMs?: number;
  /** Number of intermediate points for smooth drag */
  steps?: number;
}

/**
 * Abstract interface for desktop backends
 * All backends must implement these methods
 */
export interface DesktopBackend {
  /** Backend identifier name */
  readonly name: string;

  /** Whether the backend is currently connected */
  readonly isConnected: boolean;

  /**
   * Initialize and connect to the desktop
   */
  connect(): Promise<void>;

  /**
   * Disconnect and cleanup resources
   */
  disconnect(): Promise<void>;

  /**
   * Get current screen dimensions
   */
  getScreenDimensions(): Promise<ScreenDimensions>;

  /**
   * Take a screenshot of the current screen
   */
  screenshot(options?: ScreenshotOptions): Promise<ScreenshotResult>;

  /**
   * Single click at coordinates
   */
  click(point: Point, options?: ClickOptions): Promise<ActionResult>;

  /**
   * Double click at coordinates
   */
  doubleClick(point: Point, options?: ClickOptions): Promise<ActionResult>;

  /**
   * Type text (optionally at coordinates)
   */
  typeText(text: string, options?: TypeOptions): Promise<ActionResult>;

  /**
   * Scroll in a direction at coordinates
   */
  scroll(
    direction: ScrollDirection,
    point: Point,
    options?: ScrollOptions,
  ): Promise<ActionResult>;

  /**
   * Drag from one point to another
   */
  drag(from: Point, to: Point, options?: DragOptions): Promise<ActionResult>;

  /**
   * Press keyboard key or combination
   */
  keyPress(key: string, modifiers?: ModifierKey[]): Promise<ActionResult>;

  /**
   * Move cursor to coordinates without clicking
   */
  moveCursor(point: Point): Promise<ActionResult>;

  /**
   * Wait for specified duration
   */
  wait(ms: number): Promise<ActionResult>;
}

/**
 * Backend types
 */
export type BackendType =
  | 'native'
  | 'browser'
  | 'vnc'
  | 'rdp'
  | 'docker'
  | 'kubernetes';

/**
 * Native backend options
 */
export interface NativeBackendOptions {
  /** Display index for multi-monitor setups */
  displayIndex?: number;
}

/**
 * Browser (Puppeteer) backend options
 */
export interface BrowserBackendOptions {
  /** Run browser in headless mode */
  headless?: boolean;
  /** Viewport dimensions */
  viewport?: {
    width: number;
    height: number;
  };
  /** Custom user agent string */
  userAgent?: string;
  /** Browser type to use */
  browserType?: 'chromium' | 'firefox' | 'webkit';
  /** Initial URL to navigate to */
  initialUrl?: string;
  /** Executable path for browser */
  executablePath?: string;
  /** Additional browser launch arguments */
  args?: string[];
}

/**
 * VNC backend options
 */
export interface VNCBackendOptions {
  /** VNC server host */
  host: string;
  /** VNC server port */
  port: number;
  /** VNC password */
  password?: string;
  /** Connect in view-only mode */
  viewOnly?: boolean;
}

/**
 * RDP backend options
 */
export interface RDPBackendOptions {
  /** RDP server host */
  host: string;
  /** RDP server port */
  port?: number;
  /** Username for authentication */
  username: string;
  /** Password for authentication */
  password: string;
  /** Domain for authentication */
  domain?: string;
}

/**
 * Docker backend options
 */
export interface DockerBackendOptions {
  /** Docker image to use */
  image: string;
  /** Container name */
  containerName?: string;
  /** Display server type */
  displayServer?: 'xvfb' | 'xvnc';
  /** Screen resolution */
  resolution?: ScreenDimensions;
  /** Volume mounts */
  volumes?: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Remove container on disconnect */
  removeOnDisconnect?: boolean;
}

/**
 * Kubernetes backend options
 */
export interface KubernetesBackendOptions {
  /** Kubernetes namespace */
  namespace: string;
  /** Pod name (auto-generated if not provided) */
  podName?: string;
  /** Container image */
  image: string;
  /** Display server type */
  displayServer?: 'xvfb' | 'xvnc';
  /** Screen resolution */
  resolution?: ScreenDimensions;
  /** Resource requests and limits */
  resources?: {
    requests?: {
      cpu?: string;
      memory?: string;
    };
    limits?: {
      cpu?: string;
      memory?: string;
    };
  };
  /** Delete pod on disconnect */
  deleteOnDisconnect?: boolean;
}

/**
 * Backend configuration with type discrimination
 */
export type BackendConfig =
  | { type: 'native'; options?: NativeBackendOptions }
  | { type: 'browser'; options: BrowserBackendOptions }
  | { type: 'vnc'; options: VNCBackendOptions }
  | { type: 'rdp'; options: RDPBackendOptions }
  | { type: 'docker'; options: DockerBackendOptions }
  | { type: 'kubernetes'; options: KubernetesBackendOptions };

/**
 * Backend factory function type
 */
export type BackendFactory = (config: BackendConfig) => Promise<DesktopBackend>;
