/**
 * Docker container backend
 * Runs desktop environment in a Docker container
 */

import { exec } from 'child_process';
import { promisify } from 'util';

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
  DockerBackendOptions,
} from '../../types';

const execAsync = promisify(exec);

/**
 * Docker container backend implementation
 * Runs a desktop environment in Docker and connects via VNC or X11
 */
export class DockerBackend extends BaseBackend {
  readonly name = 'docker-container';

  private containerId: string | null = null;
  private options: DockerBackendOptions;
  private vncPort: number = 5900;

  constructor(options: DockerBackendOptions) {
    super();
    this.options = {
      displayServer: 'xvfb',
      resolution: { width: 1920, height: 1080, scaleFactor: 1 },
      removeOnDisconnect: true,
      ...options,
    };
  }

  async connect(): Promise<void> {
    // Check if Docker is available
    try {
      await execAsync('docker --version');
    } catch {
      throw new Error('Docker is required but not installed or not running');
    }

    // Build container run command
    const containerName =
      this.options.containerName || `agentsea-desktop-${Date.now()}`;
    const resolution = this.options.resolution!;

    const envVars = [
      `-e DISPLAY=:99`,
      `-e RESOLUTION=${resolution.width}x${resolution.height}`,
      ...(this.options.env
        ? Object.entries(this.options.env).map(([k, v]) => `-e ${k}=${v}`)
        : []),
    ].join(' ');

    const volumes = this.options.volumes
      ? this.options.volumes.map((v) => `-v ${v}`).join(' ')
      : '';

    // Start the container
    const runCmd = `docker run -d --name ${containerName} ${envVars} ${volumes} -p ${this.vncPort}:5900 ${this.options.image}`;

    try {
      const { stdout } = await execAsync(runCmd);
      this.containerId = stdout.trim();

      // Wait for container to be ready
      await this.waitForContainer();

      this._isConnected = true;
    } catch (error) {
      throw new Error(
        `Failed to start Docker container: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async disconnect(): Promise<void> {
    if (this.containerId) {
      try {
        // Stop the container
        await execAsync(`docker stop ${this.containerId}`);

        // Remove if configured
        if (this.options.removeOnDisconnect) {
          await execAsync(`docker rm ${this.containerId}`);
        }
      } catch {
        // Ignore errors during cleanup
      }

      this.containerId = null;
    }

    this._isConnected = false;
  }

  getScreenDimensions(): Promise<ScreenDimensions> {
    return Promise.resolve(this.options.resolution!);
  }

  async screenshot(options?: ScreenshotOptions): Promise<ScreenshotResult> {
    this.ensureConnected();

    try {
      // Use scrot or import inside the container
      const filename = `/tmp/screenshot-${Date.now()}.png`;
      let cmd: string;

      if (options?.region) {
        const { x, y, width, height } = options.region;
        cmd = `docker exec ${this.containerId} scrot -a ${x},${y},${width},${height} ${filename}`;
      } else {
        cmd = `docker exec ${this.containerId} scrot ${filename}`;
      }

      await execAsync(cmd);

      // Copy file from container
      const localPath = `/tmp/screenshot-docker-${Date.now()}.png`;
      await execAsync(`docker cp ${this.containerId}:${filename} ${localPath}`);

      // Read the file
      const fs = await import('fs');
      const imageBuffer = fs.readFileSync(localPath);
      const base64 = imageBuffer.toString('base64');

      // Clean up
      fs.unlinkSync(localPath);
      await execAsync(`docker exec ${this.containerId} rm ${filename}`);

      const dimensions = await this.getScreenDimensions();

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
      const button = this.mapButton(options?.button || 'left');

      // Use xdotool inside container
      await this.execInContainer(
        `xdotool mousemove ${point.x} ${point.y} click ${button}`,
      );

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

      await this.execInContainer(
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
        await this.execInContainer('xdotool key ctrl+a Delete');
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // Escape text for shell
      const escapedText = text.replace(/'/g, "'\\''");
      const delay = options?.delayMs || 0;

      await this.execInContainer(
        `xdotool type --delay ${delay} '${escapedText}'`,
      );

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

      // Move to position
      await this.execInContainer(`xdotool mousemove ${point.x} ${point.y}`);

      // Map direction to button
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

      await this.execInContainer(`xdotool click --repeat ${amount} ${button}`);

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

      // Simple drag using xdotool
      await this.execInContainer(`xdotool mousemove ${from.x} ${from.y}`);
      await this.execInContainer(`xdotool mousedown ${button}`);
      await this.execInContainer(`xdotool mousemove ${to.x} ${to.y}`);
      await this.execInContainer(`xdotool mouseup ${button}`);

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

      await this.execInContainer(`xdotool key ${modifierStr}${mappedKey}`);

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
      await this.execInContainer(`xdotool mousemove ${point.x} ${point.y}`);

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
   * Execute a command inside the container
   */
  private async execInContainer(command: string): Promise<string> {
    const { stdout } = await execAsync(
      `docker exec ${this.containerId} bash -c "DISPLAY=:99 ${command}"`,
    );
    return stdout;
  }

  /**
   * Wait for container to be ready
   */
  private async waitForContainer(
    maxAttempts = 30,
    delayMs = 1000,
  ): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        // Try to run a simple command
        await this.execInContainer('xdotool getactivewindow');
        return;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    throw new Error('Container failed to become ready');
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
   * Map key to xdotool key name
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
