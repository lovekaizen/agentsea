/**
 * macOS native desktop backend
 * Uses screencapture for screenshots and AppleScript/cliclick for input
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
 * macOS native backend implementation
 */
export class MacOSBackend extends BaseBackend {
  readonly name = 'macos-native';

  private displayIndex: number;
  private tempDir: string;

  constructor(options?: NativeBackendOptions) {
    super();
    this.displayIndex = options?.displayIndex ?? 0;
    this.tempDir = path.join(os.tmpdir(), 'agentsea-computer-use');
  }

  async connect(): Promise<void> {
    // Create temp directory for screenshots
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }

    // Verify we're on macOS
    if (process.platform !== 'darwin') {
      throw new Error('MacOSBackend can only run on macOS');
    }

    // Check if we have accessibility permissions
    try {
      await execAsync(
        'osascript -e "tell application \\"System Events\\" to get name"',
      );
    } catch {
      console.warn(
        'Warning: Accessibility permissions may not be granted. Some features may not work.',
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
      // Use system_profiler to get display info
      const { stdout } = await execAsync(
        'system_profiler SPDisplaysDataType -json',
      );
      const data = JSON.parse(stdout);
      const displays = data.SPDisplaysDataType?.[0]?.spdisplays_ndrvs || [];

      if (displays.length > this.displayIndex) {
        const display = displays[this.displayIndex];
        const resolution = display._spdisplays_resolution || '1920 x 1080';
        const [width, height] = resolution.split(' x ').map(Number);
        const scaleFactor =
          display.spdisplays_retina === 'spdisplays_yes' ? 2 : 1;

        return Promise.resolve({ width, height, scaleFactor });
      }

      // Fallback: use AppleScript
      const { stdout: asOutput } = await execAsync(`
        osascript -e 'tell application "Finder" to get bounds of window of desktop'
      `);
      const bounds = asOutput.trim().split(', ').map(Number);
      return {
        width: bounds[2] || 1920,
        height: bounds[3] || 1080,
        scaleFactor: 2, // Assume Retina
      };
    } catch {
      // Default fallback
      return Promise.resolve({ width: 1920, height: 1080, scaleFactor: 2 });
    }
  }

  async screenshot(options?: ScreenshotOptions): Promise<ScreenshotResult> {
    this.ensureConnected();

    const timestamp = Date.now();
    const format = options?.format || 'png';
    const filename = `screenshot-${timestamp}.${format}`;
    const filepath = path.join(this.tempDir, filename);

    try {
      let cmd = `screencapture -x`;

      // Add display selection
      if (this.displayIndex > 0) {
        cmd += ` -D ${this.displayIndex + 1}`;
      }

      // Add region if specified
      if (options?.region) {
        const { x, y, width, height } = options.region;
        cmd += ` -R ${x},${y},${width},${height}`;
      }

      // Add format
      cmd += ` -t ${format}`;

      // Add output file
      cmd += ` "${filepath}"`;

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
      const button = options?.button || 'left';
      const modifiers = options?.modifiers || [];

      // Build AppleScript for click
      let script = '';

      // Add modifier keys
      if (modifiers.length > 0) {
        const modifierKeys = modifiers
          .map((m) => this.mapModifier(m))
          .join(', ');
        script += `
          tell application "System Events"
            key down {${modifierKeys}}
          end tell
        `;
      }

      // Click
      script += `
        tell application "System Events"
          click at {${point.x}, ${point.y}}
        end tell
      `;

      // Release modifier keys
      if (modifiers.length > 0) {
        const modifierKeys = modifiers
          .map((m) => this.mapModifier(m))
          .join(', ');
        script += `
          tell application "System Events"
            key up {${modifierKeys}}
          end tell
        `;
      }

      // For right click, use different approach
      if (button === 'right') {
        script = `
          tell application "System Events"
            click at {${point.x}, ${point.y}} with control down
          end tell
        `;
      }

      await execAsync(`osascript -e '${script.replace(/'/g, "\\'")}'`);

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
    _options?: ClickOptions,
  ): Promise<ActionResult> {
    this.ensureConnected();
    const startTime = Date.now();

    try {
      const script = `
        tell application "System Events"
          click at {${point.x}, ${point.y}}
          delay 0.1
          click at {${point.x}, ${point.y}}
        end tell
      `;

      await execAsync(`osascript -e '${script}'`);

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
        await this.keyPress('a', ['command']);
        await this.keyPress('delete');
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // Type the text - escape special characters
      const escapedText = text
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n');

      const script = `
        tell application "System Events"
          keystroke "${escapedText}"
        end tell
      `;

      await execAsync(`osascript -e '${script}'`);

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

      // First move to position
      await this.moveCursor(point);

      // Map direction to scroll values
      let deltaX = 0;
      let deltaY = 0;

      switch (direction) {
        case 'up':
          deltaY = amount;
          break;
        case 'down':
          deltaY = -amount;
          break;
        case 'left':
          deltaX = amount;
          break;
        case 'right':
          deltaX = -amount;
          break;
      }

      // Use AppleScript scroll
      const script = `
        tell application "System Events"
          scroll area 1 of window 1 of application process (name of first application process whose frontmost is true) scroll {${deltaX}, ${deltaY}}
        end tell
      `;

      try {
        await execAsync(`osascript -e '${script}'`);
      } catch {
        // Fallback: use key-based scrolling
        const scrollKey =
          direction === 'up' || direction === 'left' ? 'page up' : 'page down';
        for (let i = 0; i < amount; i++) {
          await this.keyPress(scrollKey);
        }
      }

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
    _options?: DragOptions,
  ): Promise<ActionResult> {
    this.ensureConnected();
    const startTime = Date.now();

    try {
      const script = `
        tell application "System Events"
          set startPoint to {${from.x}, ${from.y}}
          set endPoint to {${to.x}, ${to.y}}

          -- Move to start
          click at startPoint
          delay 0.1

          -- Drag
          drag startPoint to endPoint
        end tell
      `;

      await execAsync(`osascript -e '${script}'`);

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
        ? ` using {${modifiers.map((m) => this.mapModifier(m)).join(', ')}}`
        : '';

      let script: string;

      if (this.isSpecialKey(key)) {
        script = `
          tell application "System Events"
            key code ${mappedKey}${modifierStr}
          end tell
        `;
      } else {
        script = `
          tell application "System Events"
            keystroke "${mappedKey}"${modifierStr}
          end tell
        `;
      }

      await execAsync(`osascript -e '${script}'`);

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
      // Use AppleScript to move cursor
      const script = `
        do shell script "
          /usr/bin/python3 -c \\"
import Quartz
Quartz.CGEventPost(Quartz.kCGHIDEventTap, Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventMouseMoved, (${point.x}, ${point.y}), Quartz.kCGMouseButtonLeft))
\\"
        "
      `;

      try {
        await execAsync(`osascript -e '${script}'`);
      } catch {
        // Fallback using cliclick if available
        await execAsync(`cliclick m:${point.x},${point.y}`).catch(() => {
          // If cliclick not available, use pure AppleScript approach
        });
      }

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
   * Map key name to AppleScript key code
   */
  private mapKey(key: string): string | number {
    const keyMap: Record<string, number> = {
      enter: 36,
      return: 36,
      escape: 53,
      esc: 53,
      tab: 48,
      space: 49,
      delete: 51,
      backspace: 51,
      'forward delete': 117,
      home: 115,
      end: 119,
      pageup: 116,
      'page up': 116,
      pagedown: 121,
      'page down': 121,
      up: 126,
      down: 125,
      left: 123,
      right: 124,
      f1: 122,
      f2: 120,
      f3: 99,
      f4: 118,
      f5: 96,
      f6: 97,
      f7: 98,
      f8: 100,
      f9: 101,
      f10: 109,
      f11: 103,
      f12: 111,
    };

    const lowerKey = key.toLowerCase();
    return keyMap[lowerKey] ?? key;
  }

  /**
   * Check if key is a special key (needs key code instead of keystroke)
   */
  private isSpecialKey(key: string): boolean {
    const specialKeys = [
      'enter',
      'return',
      'escape',
      'esc',
      'tab',
      'delete',
      'backspace',
      'home',
      'end',
      'pageup',
      'page up',
      'pagedown',
      'page down',
      'up',
      'down',
      'left',
      'right',
      'f1',
      'f2',
      'f3',
      'f4',
      'f5',
      'f6',
      'f7',
      'f8',
      'f9',
      'f10',
      'f11',
      'f12',
    ];
    return specialKeys.includes(key.toLowerCase());
  }

  /**
   * Map modifier key to AppleScript modifier
   */
  private mapModifier(modifier: ModifierKey): string {
    const modifierMap: Record<ModifierKey, string> = {
      ctrl: 'control down',
      alt: 'option down',
      shift: 'shift down',
      meta: 'command down',
      command: 'command down',
      win: 'command down',
    };
    return modifierMap[modifier] || 'command down';
  }
}
