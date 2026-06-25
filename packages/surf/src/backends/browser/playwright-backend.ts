/**
 * Playwright browser backend
 * Uses Playwright for browser automation (chromium/firefox/webkit).
 *
 * Mirrors the Puppeteer backend's behavior; the small API differences
 * (viewport sizing, launch via a per-engine browser type, `networkidle`
 * lifecycle name) are handled here so the two backends are interchangeable.
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

// Playwright types (optional peer dependency)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Browser = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BrowserContext = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Page = any;

/**
 * Playwright browser backend implementation
 */
export class PlaywrightBackend extends BaseBackend {
  readonly name = 'playwright-browser';

  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  private browser: Browser | null = null;
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  private context: BrowserContext | null = null;
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  private page: Page | null = null;
  private options: BrowserBackendOptions;

  constructor(options: BrowserBackendOptions = {}) {
    super();
    this.options = {
      headless: true,
      viewport: { width: 1920, height: 1080 },
      browserType: 'chromium',
      ...options,
    };
  }

  async connect(): Promise<void> {
    // Dynamic import - prefer playwright-core (no bundled browsers), fallback to
    // playwright. Variable specifiers prevent TS from resolving the optional dep.
    const playwrightCore = 'playwright-core';
    const playwrightFull = 'playwright';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let playwright: any;
    try {
      try {
        playwright = await import(playwrightCore);
      } catch {
        playwright = await import(playwrightFull);
      }
    } catch {
      throw new Error(
        'Playwright is required but not installed. Install with: npm install playwright',
      );
    }

    const engine = this.options.browserType || 'chromium';
    const browserType = playwright[engine] ?? playwright.default?.[engine];
    if (!browserType) {
      throw new Error(`Playwright engine "${engine}" is not available`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const launchOptions: any = {
      headless: this.options.headless ?? true,
      args: this.options.args,
    };
    if (this.options.executablePath) {
      launchOptions.executablePath = this.options.executablePath;
    }

    this.browser = await browserType.launch(launchOptions);
    this.context = await this.browser.newContext({
      viewport: this.options.viewport ?? { width: 1920, height: 1080 },
      userAgent: this.options.userAgent,
    });
    this.page = await this.context.newPage();

    if (this.options.initialUrl) {
      await this.page.goto(this.options.initialUrl, {
        waitUntil: 'networkidle',
      });
    }

    this._isConnected = true;
  }

  async disconnect(): Promise<void> {
    if (this.page) {
      await this.page.close().catch(() => {});
      this.page = null;
    }
    if (this.context) {
      await this.context.close().catch(() => {});
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
    this._isConnected = false;
  }

  getScreenDimensions(): Promise<ScreenDimensions> {
    this.ensureConnected();
    const viewport = this.page.viewportSize();
    return Promise.resolve({
      width: viewport?.width || 1920,
      height: viewport?.height || 1080,
      scaleFactor: 1,
    });
  }

  async screenshot(options?: ScreenshotOptions): Promise<ScreenshotResult> {
    this.ensureConnected();

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const screenshotOptions: any = {
        type: options?.format || 'png',
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

      const imageBuffer: Buffer = await this.page.screenshot(screenshotOptions);
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
      const modifiers = options?.modifiers || [];
      for (const mod of modifiers) {
        await this.page.keyboard.down(this.mapModifier(mod));
      }
      await this.page.mouse.click(point.x, point.y, {
        button,
        delay: options?.holdMs || 0,
      });
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
      if (options?.point) {
        await this.page.mouse.click(options.point.x, options.point.y);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (options?.clearFirst) {
        await this.page.keyboard.down('Control');
        await this.page.keyboard.press('a');
        await this.page.keyboard.up('Control');
        await this.page.keyboard.press('Backspace');
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      await this.page.keyboard.type(text, { delay: options?.delayMs || 0 });
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
      const amount = (options?.amount || 3) * 100;
      await this.page.mouse.move(point.x, point.y);

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
      await this.page.mouse.wheel(deltaX, deltaY);
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

      await this.page.mouse.move(from.x, from.y);
      await this.page.mouse.down({
        button: this.mapButton(options?.button || 'left'),
      });
      for (let i = 1; i <= steps; i++) {
        const x = from.x + ((to.x - from.x) * i) / steps;
        const y = from.y + ((to.y - from.y) * i) / steps;
        await this.page.mouse.move(x, y);
        await new Promise((resolve) => setTimeout(resolve, durationMs / steps));
      }
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
      for (const mod of modifiers || []) {
        await this.page.keyboard.down(this.mapModifier(mod));
      }
      await this.page.keyboard.press(this.mapKey(key));
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

  /** Navigate to a URL (browser-specific) */
  async navigate(url: string): Promise<void> {
    this.ensureConnected();
    await this.page.goto(url, { waitUntil: 'networkidle' });
  }

  /** Get the current URL (browser-specific) */
  getCurrentUrl(): Promise<string> {
    this.ensureConnected();
    return Promise.resolve(this.page.url());
  }

  /** Get the page title (browser-specific) */
  getTitle(): Promise<string> {
    this.ensureConnected();
    return this.page.title();
  }

  /** Map mouse button to Playwright format */
  private mapButton(button: string): 'left' | 'right' | 'middle' {
    const buttonMap: Record<string, 'left' | 'right' | 'middle'> = {
      left: 'left',
      right: 'right',
      middle: 'middle',
    };
    return buttonMap[button] || 'left';
  }

  /** Map key to Playwright key name */
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

  /** Map modifier key to Playwright modifier */
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
