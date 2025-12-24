/**
 * Abstract base class for desktop backends
 */

import {
  DesktopBackend,
  Point,
  ScreenDimensions,
  ScreenshotResult,
  ActionResult,
  ScrollDirection,
  ModifierKey,
  ScreenshotOptions,
  ClickOptions,
  TypeOptions,
  ScrollOptions,
  DragOptions,
} from '../types';

/**
 * Abstract base class for desktop backends
 * Provides common functionality and enforces interface implementation
 */
export abstract class BaseBackend implements DesktopBackend {
  abstract readonly name: string;

  protected _isConnected = false;

  get isConnected(): boolean {
    return this._isConnected;
  }

  /**
   * Initialize and connect to the desktop
   */
  abstract connect(): Promise<void>;

  /**
   * Disconnect and cleanup resources
   */
  abstract disconnect(): Promise<void>;

  /**
   * Get current screen dimensions
   */
  abstract getScreenDimensions(): Promise<ScreenDimensions>;

  /**
   * Take a screenshot of the current screen
   */
  abstract screenshot(options?: ScreenshotOptions): Promise<ScreenshotResult>;

  /**
   * Single click at coordinates
   */
  abstract click(point: Point, options?: ClickOptions): Promise<ActionResult>;

  /**
   * Double click at coordinates
   */
  abstract doubleClick(
    point: Point,
    options?: ClickOptions,
  ): Promise<ActionResult>;

  /**
   * Type text (optionally at coordinates)
   */
  abstract typeText(text: string, options?: TypeOptions): Promise<ActionResult>;

  /**
   * Scroll in a direction at coordinates
   */
  abstract scroll(
    direction: ScrollDirection,
    point: Point,
    options?: ScrollOptions,
  ): Promise<ActionResult>;

  /**
   * Drag from one point to another
   */
  abstract drag(
    from: Point,
    to: Point,
    options?: DragOptions,
  ): Promise<ActionResult>;

  /**
   * Press keyboard key or combination
   */
  abstract keyPress(
    key: string,
    modifiers?: ModifierKey[],
  ): Promise<ActionResult>;

  /**
   * Move cursor to coordinates without clicking
   */
  abstract moveCursor(point: Point): Promise<ActionResult>;

  /**
   * Wait for specified duration
   */
  async wait(ms: number): Promise<ActionResult> {
    const startTime = Date.now();
    await new Promise((resolve) => setTimeout(resolve, ms));
    return {
      success: true,
      action: 'wait',
      timestamp: new Date(),
      duration: Date.now() - startTime,
    };
  }

  /**
   * Helper to ensure backend is connected before operation
   */
  protected ensureConnected(): void {
    if (!this._isConnected) {
      throw new Error(
        `Backend ${this.name} is not connected. Call connect() first.`,
      );
    }
  }

  /**
   * Helper to create a successful action result
   */
  protected createSuccessResult(
    action: string,
    startTime: number,
  ): ActionResult {
    return {
      success: true,
      action,
      timestamp: new Date(),
      duration: Date.now() - startTime,
    };
  }

  /**
   * Helper to create a failed action result
   */
  protected createErrorResult(
    action: string,
    startTime: number,
    error: string,
  ): ActionResult {
    return {
      success: false,
      action,
      timestamp: new Date(),
      duration: Date.now() - startTime,
      error,
    };
  }
}
