/**
 * Windows native desktop backend
 * Uses PowerShell and .NET for input and screenshots
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
 * Windows native backend implementation using PowerShell
 */
export class WindowsBackend extends BaseBackend {
  readonly name = 'windows-native';

  private displayIndex: number;
  private tempDir: string;

  constructor(options?: NativeBackendOptions) {
    super();
    this.displayIndex = options?.displayIndex ?? 0;
    this.tempDir = path.join(os.tmpdir(), 'agentsea-computer-use');
  }

  async connect(): Promise<void> {
    // Verify we're on Windows
    if (process.platform !== 'win32') {
      throw new Error('WindowsBackend can only run on Windows');
    }

    // Create temp directory
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }

    // Verify PowerShell is available
    try {
      await execAsync('powershell -Command "echo test"');
    } catch {
      throw new Error('PowerShell is required but not available');
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
      const script = `
        Add-Type -AssemblyName System.Windows.Forms
        $screen = [System.Windows.Forms.Screen]::PrimaryScreen
        Write-Output "$($screen.Bounds.Width)x$($screen.Bounds.Height)"
      `;

      const { stdout } = await this.runPowerShell(script);
      const match = stdout.trim().match(/(\d+)x(\d+)/);
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

    return Promise.resolve({ width: 1920, height: 1080, scaleFactor: 1 });
  }

  async screenshot(options?: ScreenshotOptions): Promise<ScreenshotResult> {
    this.ensureConnected();

    const timestamp = Date.now();
    const filename = `screenshot-${timestamp}.png`;
    const filepath = path.join(this.tempDir, filename).replace(/\\/g, '/');

    try {
      let script: string;

      if (options?.region) {
        const { x, y, width, height } = options.region;
        script = `
          Add-Type -AssemblyName System.Windows.Forms
          Add-Type -AssemblyName System.Drawing

          $bitmap = New-Object System.Drawing.Bitmap(${width}, ${height})
          $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
          $graphics.CopyFromScreen(${x}, ${y}, 0, 0, [System.Drawing.Size]::new(${width}, ${height}))
          $bitmap.Save("${filepath}")
          $graphics.Dispose()
          $bitmap.Dispose()
        `;
      } else {
        script = `
          Add-Type -AssemblyName System.Windows.Forms
          Add-Type -AssemblyName System.Drawing

          $screen = [System.Windows.Forms.Screen]::PrimaryScreen
          $bitmap = New-Object System.Drawing.Bitmap($screen.Bounds.Width, $screen.Bounds.Height)
          $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
          $graphics.CopyFromScreen($screen.Bounds.Location, [System.Drawing.Point]::Empty, $screen.Bounds.Size)
          $bitmap.Save("${filepath}")
          $graphics.Dispose()
          $bitmap.Dispose()
        `;
      }

      await this.runPowerShell(script);

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
        mimeType: 'image/png',
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

      // Press modifiers
      for (const mod of modifiers) {
        await this.sendKey(this.mapModifier(mod), true);
      }

      // Move and click
      const clickScript = `
        Add-Type -TypeDefinition @"
        using System;
        using System.Runtime.InteropServices;
        public class Mouse {
          [DllImport("user32.dll")]
          public static extern bool SetCursorPos(int X, int Y);
          [DllImport("user32.dll")]
          public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);
        }
"@
        [Mouse]::SetCursorPos(${point.x}, ${point.y})
        Start-Sleep -Milliseconds 50
        ${this.getClickScript(button)}
      `;

      await this.runPowerShell(clickScript);

      // Release modifiers
      for (const mod of modifiers) {
        await this.sendKey(this.mapModifier(mod), false);
      }

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
      const clickScript = `
        Add-Type -TypeDefinition @"
        using System;
        using System.Runtime.InteropServices;
        public class Mouse {
          [DllImport("user32.dll")]
          public static extern bool SetCursorPos(int X, int Y);
          [DllImport("user32.dll")]
          public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);
        }
"@
        [Mouse]::SetCursorPos(${point.x}, ${point.y})
        Start-Sleep -Milliseconds 50
        [Mouse]::mouse_event(0x0002, 0, 0, 0, 0)  # Left down
        [Mouse]::mouse_event(0x0004, 0, 0, 0, 0)  # Left up
        Start-Sleep -Milliseconds 100
        [Mouse]::mouse_event(0x0002, 0, 0, 0, 0)  # Left down
        [Mouse]::mouse_event(0x0004, 0, 0, 0, 0)  # Left up
      `;

      await this.runPowerShell(clickScript);

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
        await this.keyPress('a', ['ctrl']);
        await this.keyPress('delete');
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // Type the text using SendKeys. Every SendKeys metacharacter must be
      // wrapped in braces, including the braces themselves ({ -> {{}, } -> {}}).
      // This MUST be a single pass: escaping sequentially would re-escape the
      // braces introduced by earlier replacements (e.g. "+" -> "{+}" then the
      // brace pass turns it into "{{{}}+{}}"). Match each special char once.
      const escapedText = text.replace(/[+^%~(){}[\]]/g, (ch) => `{${ch}}`);

      const script = `
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.SendKeys]::SendWait("${escapedText.replace(/"/g, '`"')}")
      `;

      await this.runPowerShell(script);

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
      await this.moveCursor(point);

      // Calculate scroll delta
      let wheelDelta: number;
      switch (direction) {
        case 'up':
          wheelDelta = 120 * amount;
          break;
        case 'down':
          wheelDelta = -120 * amount;
          break;
        case 'left':
        case 'right': {
          // Horizontal scroll
          const hDelta = direction === 'left' ? 120 * amount : -120 * amount;
          const hScript = `
            Add-Type -TypeDefinition @"
            using System;
            using System.Runtime.InteropServices;
            public class Mouse {
              [DllImport("user32.dll")]
              public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);
            }
"@
            [Mouse]::mouse_event(0x01000, 0, 0, ${hDelta}, 0)  # Horizontal wheel
          `;
          await this.runPowerShell(hScript);
          return this.createSuccessResult('scroll', startTime);
        }
        default:
          wheelDelta = -120 * amount;
      }

      const script = `
        Add-Type -TypeDefinition @"
        using System;
        using System.Runtime.InteropServices;
        public class Mouse {
          [DllImport("user32.dll")]
          public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);
        }
"@
        [Mouse]::mouse_event(0x0800, 0, 0, ${wheelDelta}, 0)  # Wheel
      `;

      await this.runPowerShell(script);

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
      const durationMs = options?.durationMs || 500;
      const steps = 10;
      const stepDelay = durationMs / steps;

      const script = `
        Add-Type -TypeDefinition @"
        using System;
        using System.Runtime.InteropServices;
        public class Mouse {
          [DllImport("user32.dll")]
          public static extern bool SetCursorPos(int X, int Y);
          [DllImport("user32.dll")]
          public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);
        }
"@
        [Mouse]::SetCursorPos(${from.x}, ${from.y})
        Start-Sleep -Milliseconds 50
        [Mouse]::mouse_event(0x0002, 0, 0, 0, 0)  # Left down

        ${Array.from({ length: steps }, (_, i) => {
          const x = Math.round(from.x + ((to.x - from.x) * (i + 1)) / steps);
          const y = Math.round(from.y + ((to.y - from.y) * (i + 1)) / steps);
          return `
        Start-Sleep -Milliseconds ${stepDelay}
        [Mouse]::SetCursorPos(${x}, ${y})`;
        }).join('')}

        [Mouse]::mouse_event(0x0004, 0, 0, 0, 0)  # Left up
      `;

      await this.runPowerShell(script);

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
        ? modifiers.map((m) => this.mapModifierForSendKeys(m)).join('')
        : '';

      const script = `
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.SendKeys]::SendWait("${modifierStr}${mappedKey}")
      `;

      await this.runPowerShell(script);

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
      const script = `
        Add-Type -TypeDefinition @"
        using System;
        using System.Runtime.InteropServices;
        public class Mouse {
          [DllImport("user32.dll")]
          public static extern bool SetCursorPos(int X, int Y);
        }
"@
        [Mouse]::SetCursorPos(${point.x}, ${point.y})
      `;

      await this.runPowerShell(script);

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
   * Run a PowerShell script
   */
  private async runPowerShell(
    script: string,
  ): Promise<{ stdout: string; stderr: string }> {
    const base64Script = Buffer.from(script, 'utf16le').toString('base64');
    return execAsync(`powershell -EncodedCommand ${base64Script}`);
  }

  /**
   * Get click script for a button
   */
  private getClickScript(button: string): string {
    switch (button) {
      case 'left':
        return `
          [Mouse]::mouse_event(0x0002, 0, 0, 0, 0)  # Left down
          [Mouse]::mouse_event(0x0004, 0, 0, 0, 0)  # Left up
        `;
      case 'right':
        return `
          [Mouse]::mouse_event(0x0008, 0, 0, 0, 0)  # Right down
          [Mouse]::mouse_event(0x0010, 0, 0, 0, 0)  # Right up
        `;
      case 'middle':
        return `
          [Mouse]::mouse_event(0x0020, 0, 0, 0, 0)  # Middle down
          [Mouse]::mouse_event(0x0040, 0, 0, 0, 0)  # Middle up
        `;
      default:
        return `
          [Mouse]::mouse_event(0x0002, 0, 0, 0, 0)
          [Mouse]::mouse_event(0x0004, 0, 0, 0, 0)
        `;
    }
  }

  /**
   * Send a key press (down) or release (up) for a single key using the Win32
   * keybd_event API. Used to hold/release modifier keys around a click.
   */
  private async sendKey(key: string, down: boolean): Promise<void> {
    const vk = this.virtualKeyCode(key);
    if (vk === undefined) {
      throw new Error(
        `Windows backend: cannot send unsupported key "${key}". ` +
          'Supported modifier keys: CTRL, ALT, SHIFT, WIN.',
      );
    }

    // KEYEVENTF_KEYUP = 0x0002; 0 = key down.
    const flags = down ? 0 : 0x0002;
    const script = `
      Add-Type -TypeDefinition @"
      using System;
      using System.Runtime.InteropServices;
      public class Keyboard {
        [DllImport("user32.dll")]
        public static extern void keybd_event(byte bVk, byte bScan, int dwFlags, int dwExtraInfo);
      }
"@
      [Keyboard]::keybd_event(${vk}, 0, ${flags}, 0)
    `;

    await this.runPowerShell(script);
  }

  /**
   * Map a key name to a Win32 virtual-key code. Currently covers the modifier
   * keys used by click(); returns undefined for anything else.
   */
  private virtualKeyCode(key: string): number | undefined {
    const map: Record<string, number> = {
      CTRL: 0x11, // VK_CONTROL
      CONTROL: 0x11,
      ALT: 0x12, // VK_MENU
      SHIFT: 0x10, // VK_SHIFT
      WIN: 0x5b, // VK_LWIN
      META: 0x5b,
      COMMAND: 0x5b,
    };
    return map[key.toUpperCase()];
  }

  /**
   * Map key to SendKeys format
   */
  private mapKey(key: string): string {
    const keyMap: Record<string, string> = {
      enter: '{ENTER}',
      return: '{ENTER}',
      escape: '{ESC}',
      esc: '{ESC}',
      tab: '{TAB}',
      space: ' ',
      delete: '{DELETE}',
      backspace: '{BACKSPACE}',
      home: '{HOME}',
      end: '{END}',
      pageup: '{PGUP}',
      'page up': '{PGUP}',
      pagedown: '{PGDN}',
      'page down': '{PGDN}',
      up: '{UP}',
      down: '{DOWN}',
      left: '{LEFT}',
      right: '{RIGHT}',
      f1: '{F1}',
      f2: '{F2}',
      f3: '{F3}',
      f4: '{F4}',
      f5: '{F5}',
      f6: '{F6}',
      f7: '{F7}',
      f8: '{F8}',
      f9: '{F9}',
      f10: '{F10}',
      f11: '{F11}',
      f12: '{F12}',
    };

    const lowerKey = key.toLowerCase();
    return keyMap[lowerKey] || key;
  }

  /**
   * Map modifier key to SendKeys format
   */
  private mapModifierForSendKeys(modifier: ModifierKey): string {
    // SendKeys only represents Ctrl (^), Alt (%) and Shift (+). The Windows key
    // has no SendKeys encoding, so meta/command/win cannot be expressed here —
    // mapping them to Ctrl would silently send the wrong combination. Fail
    // loudly instead; callers wanting the Windows key should use a keybd_event
    // based path.
    const modifierMap: Partial<Record<ModifierKey, string>> = {
      ctrl: '^',
      alt: '%',
      shift: '+',
    };
    const mapped = modifierMap[modifier];
    if (!mapped) {
      throw new Error(
        `Windows backend: modifier "${modifier}" cannot be sent via SendKeys ` +
          '(no encoding for the Windows key). Supported: ctrl, alt, shift.',
      );
    }
    return mapped;
  }

  /**
   * Map modifier key to virtual key code name
   */
  private mapModifier(modifier: ModifierKey): string {
    const modifierMap: Record<ModifierKey, string> = {
      ctrl: 'CTRL',
      alt: 'ALT',
      shift: 'SHIFT',
      meta: 'WIN',
      command: 'WIN',
      win: 'WIN',
    };
    return modifierMap[modifier] || 'CTRL';
  }
}
