/**
 * Linux native desktop backend
 * Uses xdotool for input and scrot/gnome-screenshot for screenshots
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { BaseBackend } from '../base-backend';
import {
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
  NativeBackendOptions,
} from '../../types';

const execAsync = promisify(exec);

/**
 * Linux native backend implementation using xdotool
 */
export class LinuxBackend extends BaseBackend {
  readonly name = 'linux-native';

  private displayIndex: number;
  private tempDir: string;
  private hasXdotool = false;
  private hasScrot = false;

  constructor(options?: NativeBackendOptions) {
    super();
    this.displayIndex = options?.displayIndex ?? 0;
    this.tempDir = path.join(os.tmpdir(), 'agentsea-computer-use');
  }

  async connect(): Promise<void> {
    // Verify we're on Linux
    if (process.platform !== 'linux') {
      throw new Error('LinuxBackend can only run on Linux');
    }

    // Create temp directory
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }

    // Check for required tools
    try {
      await execAsync('which xdotool');
      this.hasXdotool = true;
    } catch {
      throw new Error(
        'xdotool is required but not installed. Install with: sudo apt-get install xdotool',
      );
    }

    try {
      await execAsync('which scrot');
      this.hasScrot = true;
    } catch {
      console.warn(
        'scrot not found, will try gnome-screenshot or import instead',
      );
    }

    this._isConnected = true;
  }

  disconnect(): Promise<void> {
    // Clean up temp files
    try {
      const files = fs.readdirSync(this.tempDir);
      for (const file of files) {
        if (file.startsWith('screenshot-')) {
          fs.unlinkSync(path.join(this.tempDir, file));
        }
      }
    } catch {
      // Ignore cleanup errors
    }

    this._isConnected = false;
    return Promise.resolve();
  }

  async getScreenDimensions(): Promise<ScreenDimensions> {
    this.ensureConnected();

    try {
      const { stdout } = await execAsync('xdpyinfo | grep dimensions');
      const match = stdout.match(/(\d+)x(\d+)/);
      if (match) {
        return {
          width: parseInt(match[1], 10),
          height: parseInt(match[2], 10),
          scaleFactor: 1,
        };
      }
    } catch {
      // Fallback
    }

    // Try xrandr as fallback
    try {
      const { stdout } = await execAsync('xrandr | grep "\\*"');
      const match = stdout.match(/(\d+)x(\d+)/);
      if (match) {
        return {
          width: parseInt(match[1], 10),
          height: parseInt(match[2], 10),
          scaleFactor: 1,
        };
      }
    } catch {
      // Ignore
    }

    return Promise.resolve({ width: 1920, height: 1080, scaleFactor: 1 });
  }

  async screenshot(options?: ScreenshotOptions): Promise<ScreenshotResult> {
    this.ensureConnected();

    const timestamp = Date.now();
    const format = options?.format || 'png';
    const filename = `screenshot-${timestamp}.${format}`;
    const filepath = path.join(this.tempDir, filename);

    try {
      let cmd: string;

      if (this.hasScrot) {
        cmd = 'scrot';
        if (options?.region) {
          const { x, y, width, height } = options.region;
          cmd += ` -a ${x},${y},${width},${height}`;
        }
        cmd += ` "${filepath}"`;
      } else {
        // Try gnome-screenshot
        cmd = `gnome-screenshot -f "${filepath}"`;
      }

      await execAsync(cmd);

      // Read the file
      const imageBuffer = fs.readFileSync(filepath);
      const base64 = imageBuffer.toString('base64');

      // Get dimensions
      const dimensions = await this.getScreenDimensions();

      // Clean up
      fs.unlinkSync(filepath);

      return {
        image: imageBuffer,
        base64,
        mimeType: format === 'png' ? 'image/png' : 'image/jpeg',
        dimensions,
        timestamp: new Date(),
      };
    } catch (error) {
      throw new Error(
        `Screenshot failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async click(point: Point, options?: ClickOptions): Promise<ActionResult> {
    this.ensureConnected();
    const startTime = Date.now();

    try {
      const button = this.mapButton(options?.button || 'left');

      // Move to position first
      await execAsync(`xdotool mousemove ${point.x} ${point.y}`);

      // Build click command with modifiers
      let cmd = 'xdotool';
      const modifiers = options?.modifiers || [];

      for (const mod of modifiers) {
        cmd += ` keydown ${this.mapModifier(mod)}`;
      }

      cmd += ` click ${button}`;

      for (const mod of modifiers) {
        cmd += ` keyup ${this.mapModifier(mod)}`;
      }

      await execAsync(cmd);

      // Handle hold duration
      if (options?.holdMs && options.holdMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, options.holdMs));
      }

      return this.createSuccessResult('click', startTime);
    } catch (error) {
      return this.createErrorResult(
        'click',
        startTime,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  async doubleClick(
    point: Point,
    options?: ClickOptions,
  ): Promise<ActionResult> {
    this.ensureConnected();
    const startTime = Date.now();

    try {
      const button = this.mapButton(options?.button || 'left');

      await execAsync(
        `xdotool mousemove ${point.x} ${point.y} click --repeat 2 --delay 100 ${button}`,
      );

      return this.createSuccessResult('doubleClick', startTime);
    } catch (error) {
      return this.createErrorResult(
        'doubleClick',
        startTime,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  async typeText(text: string, options?: TypeOptions): Promise<ActionResult> {
    this.ensureConnected();
    const startTime = Date.now();

    try {
      // Click at position first if specified
      if (options?.point) {
        await this.click(options.point);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Clear existing text if requested
      if (options?.clearFirst) {
        await execAsync('xdotool key ctrl+a Delete');
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // Type the text - escape special characters for shell
      const escapedText = text.replace(/'/g, "'\\''");
      const delay = options?.delayMs || 0;

      await execAsync(`xdotool type --delay ${delay} '${escapedText}'`);

      return this.createSuccessResult('typeText', startTime);
    } catch (error) {
      return this.createErrorResult(
        'typeText',
        startTime,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  async scroll(
    direction: ScrollDirection,
    point: Point,
    options?: ScrollOptions,
  ): Promise<ActionResult> {
    this.ensureConnected();
    const startTime = Date.now();

    try {
      const amount = options?.amount || 3;

      // Move to position first
      await execAsync(`xdotool mousemove ${point.x} ${point.y}`);

      // Map direction to xdotool button
      let button: number;
      switch (direction) {
        case 'up':
          button = 4;
          break;
        case 'down':
          button = 5;
          break;
        case 'left':
          button = 6;
          break;
        case 'right':
          button = 7;
          break;
      }

      // Execute scroll
      await execAsync(`xdotool click --repeat ${amount} ${button}`);

      return this.createSuccessResult('scroll', startTime);
    } catch (error) {
      return this.createErrorResult(
        'scroll',
        startTime,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  async drag(
    from: Point,
    to: Point,
    options?: DragOptions,
  ): Promise<ActionResult> {
    this.ensureConnected();
    const startTime = Date.now();

    try {
      const button = this.mapButton(options?.button || 'left');

      // Move to start, press, move to end, release
      await execAsync(`xdotool mousemove ${from.x} ${from.y}`);
      await execAsync(`xdotool mousedown ${button}`);

      // Smooth drag if duration specified
      const durationMs = options?.durationMs || 500;
      const steps = options?.steps || 10;
      const stepDelay = durationMs / steps;

      for (let i = 1; i <= steps; i++) {
        const x = from.x + ((to.x - from.x) * i) / steps;
        const y = from.y + ((to.y - from.y) * i) / steps;
        await execAsync(`xdotool mousemove ${Math.round(x)} ${Math.round(y)}`);
        await new Promise((resolve) => setTimeout(resolve, stepDelay));
      }

      await execAsync(`xdotool mouseup ${button}`);

      return this.createSuccessResult('drag', startTime);
    } catch (error) {
      return this.createErrorResult(
        'drag',
        startTime,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  async keyPress(
    key: string,
    modifiers?: ModifierKey[],
  ): Promise<ActionResult> {
    this.ensureConnected();
    const startTime = Date.now();

    try {
      const mappedKey = this.mapKey(key);
      const modifierStr = modifiers?.length
        ? modifiers.map((m) => this.mapModifier(m)).join('+') + '+'
        : '';

      await execAsync(`xdotool key ${modifierStr}${mappedKey}`);

      return this.createSuccessResult('keyPress', startTime);
    } catch (error) {
      return this.createErrorResult(
        'keyPress',
        startTime,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  async moveCursor(point: Point): Promise<ActionResult> {
    this.ensureConnected();
    const startTime = Date.now();

    try {
      await execAsync(`xdotool mousemove ${point.x} ${point.y}`);

      return this.createSuccessResult('moveCursor', startTime);
    } catch (error) {
      return this.createErrorResult(
        'moveCursor',
        startTime,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  /**
   * Map mouse button to xdotool button number
   */
  private mapButton(button: string): number {
    const buttonMap: Record<string, number> = {
      left: 1,
      middle: 2,
      right: 3,
    };
    return buttonMap[button] || 1;
  }

  /**
   * Map key name to xdotool key name
   */
  private mapKey(key: string): string {
    const keyMap: Record<string, string> = {
      enter: 'Return',
      return: 'Return',
      escape: 'Escape',
      esc: 'Escape',
      tab: 'Tab',
      space: 'space',
      delete: 'Delete',
      backspace: 'BackSpace',
      home: 'Home',
      end: 'End',
      pageup: 'Page_Up',
      'page up': 'Page_Up',
      pagedown: 'Page_Down',
      'page down': 'Page_Down',
      up: 'Up',
      down: 'Down',
      left: 'Left',
      right: 'Right',
      f1: 'F1',
      f2: 'F2',
      f3: 'F3',
      f4: 'F4',
      f5: 'F5',
      f6: 'F6',
      f7: 'F7',
      f8: 'F8',
      f9: 'F9',
      f10: 'F10',
      f11: 'F11',
      f12: 'F12',
    };

    const lowerKey = key.toLowerCase();
    return keyMap[lowerKey] || key;
  }

  /**
   * Map modifier key to xdotool modifier
   */
  private mapModifier(modifier: ModifierKey): string {
    const modifierMap: Record<ModifierKey, string> = {
      ctrl: 'ctrl',
      alt: 'alt',
      shift: 'shift',
      meta: 'super',
      command: 'super',
      win: 'super',
    };
    return modifierMap[modifier] || 'ctrl';
  }
}
