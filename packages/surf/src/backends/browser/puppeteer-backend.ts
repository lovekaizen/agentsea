/**
 * Puppeteer browser backend
 * Uses Puppeteer for browser automation
 */

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
  BrowserBackendOptions,
} from '../../types';

// Puppeteer types (optional peer dependency)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Browser = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Page = any;

/**
 * Puppeteer browser backend implementation
 */
export class PuppeteerBackend extends BaseBackend {
  readonly name = 'puppeteer-browser';

  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  private browser: Browser | null = null;
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  private page: Page | null = null;
  private options: BrowserBackendOptions;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private puppeteer: any;

  constructor(options: BrowserBackendOptions = {}) {
    super();
    this.options = {
      headless: true,
      viewport: { width: 1920, height: 1080 },
      ...options,
    };
  }

  async connect(): Promise<void> {
    // Dynamic import - prefer puppeteer-core (no bundled Chrome), fallback to puppeteer
    // Use variable to prevent TypeScript from resolving types for optional peer deps
    const puppeteerCore = 'puppeteer-core';
    const puppeteerFull = 'puppeteer';

    try {
      try {
        this.puppeteer = await import(puppeteerCore);
      } catch {
        this.puppeteer = await import(puppeteerFull);
      }
    } catch {
      throw new Error(
        'Puppeteer is required but not installed. Install with: npm install puppeteer-core',
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const launchOptions: any = {
      headless: this.options.headless ? 'new' : false,
      args: this.options.args || [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    };

    // Set executable path - required for puppeteer-core
    if (this.options.executablePath) {
      launchOptions.executablePath = this.options.executablePath;
    } else {
      // Try to find system Chromium for puppeteer-core
      const chromiumPath = this.findChromiumPath();
      if (chromiumPath) {
        launchOptions.executablePath = chromiumPath;
      }
    }

    this.browser = await this.puppeteer.default.launch(launchOptions);
    this.page = await this.browser.newPage();

    // Set viewport
    if (this.options.viewport) {
      await this.page.setViewport(this.options.viewport);
    }

    // Set user agent
    if (this.options.userAgent) {
      await this.page.setUserAgent(this.options.userAgent);
    }

    // Navigate to initial URL if provided
    if (this.options.initialUrl) {
      await this.page.goto(this.options.initialUrl, {
        waitUntil: 'networkidle0',
      });
    }

    this._isConnected = true;
  }

  async disconnect(): Promise<void> {
    if (this.page) {
      await this.page.close().catch(() => {});
      this.page = null;
    }

    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }

    this._isConnected = false;
  }

  getScreenDimensions(): Promise<ScreenDimensions> {
    this.ensureConnected();

    const viewport = this.page.viewport();
    return Promise.resolve({
      width: viewport?.width || 1920,
      height: viewport?.height || 1080,
      scaleFactor: viewport?.deviceScaleFactor || 1,
    });
  }

  async screenshot(options?: ScreenshotOptions): Promise<ScreenshotResult> {
    this.ensureConnected();

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const screenshotOptions: any = {
        type: options?.format || 'png',
        encoding: 'binary',
      };

      if (options?.format === 'jpeg' && options?.quality) {
        screenshotOptions.quality = options.quality;
      }

      if (options?.region) {
        screenshotOptions.clip = {
          x: options.region.x,
          y: options.region.y,
          width: options.region.width,
          height: options.region.height,
        };
      } else {
        screenshotOptions.fullPage = false;
      }

      const imageBuffer = await this.page.screenshot(screenshotOptions);
      const base64 = imageBuffer.toString('base64');
      const dimensions = await this.getScreenDimensions();

      return {
        image: imageBuffer,
        base64,
        mimeType: options?.format === 'jpeg' ? 'image/jpeg' : 'image/png',
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

      // Handle modifiers
      const modifiers = options?.modifiers || [];
      for (const mod of modifiers) {
        await this.page.keyboard.down(this.mapModifier(mod));
      }

      await this.page.mouse.click(point.x, point.y, {
        button,
        delay: options?.holdMs || 0,
      });

      // Release modifiers
      for (const mod of modifiers) {
        await this.page.keyboard.up(this.mapModifier(mod));
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
      await this.page.mouse.click(point.x, point.y, {
        button: this.mapButton(options?.button || 'left'),
        clickCount: 2,
      });

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
        await this.page.mouse.click(options.point.x, options.point.y);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Clear existing text if requested
      if (options?.clearFirst) {
        await this.page.keyboard.down('Control');
        await this.page.keyboard.press('a');
        await this.page.keyboard.up('Control');
        await this.page.keyboard.press('Backspace');
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // Type the text
      await this.page.keyboard.type(text, {
        delay: options?.delayMs || 0,
      });

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
      const amount = (options?.amount || 3) * 100; // Convert to pixels

      // Move to position first
      await this.page.mouse.move(point.x, point.y);

      // Calculate delta
      let deltaX = 0;
      let deltaY = 0;

      switch (direction) {
        case 'up':
          deltaY = -amount;
          break;
        case 'down':
          deltaY = amount;
          break;
        case 'left':
          deltaX = -amount;
          break;
        case 'right':
          deltaX = amount;
          break;
      }

      await this.page.mouse.wheel({ deltaX, deltaY });

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
      const steps = options?.steps || 10;

      // Move to start position
      await this.page.mouse.move(from.x, from.y);

      // Press mouse button
      await this.page.mouse.down({
        button: this.mapButton(options?.button || 'left'),
      });

      // Move to end position with steps
      for (let i = 1; i <= steps; i++) {
        const x = from.x + ((to.x - from.x) * i) / steps;
        const y = from.y + ((to.y - from.y) * i) / steps;
        await this.page.mouse.move(x, y);
        await new Promise((resolve) => setTimeout(resolve, durationMs / steps));
      }

      // Release mouse button
      await this.page.mouse.up({
        button: this.mapButton(options?.button || 'left'),
      });

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
      // Press modifier keys
      for (const mod of modifiers || []) {
        await this.page.keyboard.down(this.mapModifier(mod));
      }

      // Press the key
      await this.page.keyboard.press(this.mapKey(key));

      // Release modifier keys
      for (const mod of modifiers || []) {
        await this.page.keyboard.up(this.mapModifier(mod));
      }

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
      await this.page.mouse.move(point.x, point.y);

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
   * Navigate to a URL (browser-specific)
   */
  async navigate(url: string): Promise<void> {
    this.ensureConnected();
    await this.page.goto(url, { waitUntil: 'networkidle0' });
  }

  /**
   * Get the current URL (browser-specific)
   */
  getCurrentUrl(): Promise<string> {
    this.ensureConnected();
    return this.page.url();
  }

  /**
   * Get the page title (browser-specific)
   */
  getTitle(): Promise<string> {
    this.ensureConnected();
    return this.page.title();
  }

  /**
   * Find system Chromium executable path
   */
  private findChromiumPath(): string | undefined {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs') as typeof import('fs');
    const possiblePaths = [
      // Environment variable (preferred for CI)
      process.env.PUPPETEER_EXECUTABLE_PATH,
      process.env.CHROMIUM_PATH,
      // Linux
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      // macOS
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      // Windows
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ];

    for (const chromePath of possiblePaths) {
      if (chromePath && fs.existsSync(chromePath)) {
        return chromePath;
      }
    }

    return undefined;
  }

  /**
   * Map mouse button to Puppeteer format
   */
  private mapButton(button: string): 'left' | 'right' | 'middle' {
    const buttonMap: Record<string, 'left' | 'right' | 'middle'> = {
      left: 'left',
      right: 'right',
      middle: 'middle',
    };
    return buttonMap[button] || 'left';
  }

  /**
   * Map key to Puppeteer key name
   */
  private mapKey(key: string): string {
    const keyMap: Record<string, string> = {
      enter: 'Enter',
      return: 'Enter',
      escape: 'Escape',
      esc: 'Escape',
      tab: 'Tab',
      space: 'Space',
      delete: 'Delete',
      backspace: 'Backspace',
      home: 'Home',
      end: 'End',
      pageup: 'PageUp',
      'page up': 'PageUp',
      pagedown: 'PageDown',
      'page down': 'PageDown',
      up: 'ArrowUp',
      down: 'ArrowDown',
      left: 'ArrowLeft',
      right: 'ArrowRight',
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
   * Map modifier key to Puppeteer modifier
   */
  private mapModifier(modifier: ModifierKey): string {
    const modifierMap: Record<ModifierKey, string> = {
      ctrl: 'Control',
      alt: 'Alt',
      shift: 'Shift',
      meta: 'Meta',
      command: 'Meta',
      win: 'Meta',
    };
    return modifierMap[modifier] || 'Control';
  }
}
