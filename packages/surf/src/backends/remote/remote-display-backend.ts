/**
 * Remote-display backend base
 *
 * VNC (RFB) and RDP are both "remote framebuffer + input event" protocols:
 * you capture frames and send pointer/key events. This base maps the
 * high-level BaseBackend operations (click/type/scroll/screenshot/…) onto a
 * minimal {@link RemoteDisplayClient}, so the VNC and RDP backends only differ
 * in how they obtain that client (which real library they wrap).
 *
 * The client is injectable, so the operation→event translation is fully
 * unit-testable without a live server or protocol library.
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
} from '../../types';

/** Minimal remote framebuffer/input contract shared by VNC and RDP. */
export interface RemoteDisplayClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  /** Current framebuffer size. */
  dimensions(): { width: number; height: number };
  /** Capture the current framebuffer as a PNG buffer. */
  capture(): Promise<Buffer>;
  /** Move/press the pointer. `buttonMask` bit0=left, bit1=middle, bit2=right. */
  pointer(x: number, y: number, buttonMask: number): Promise<void>;
  /** Press (down=true) or release a key, identified by X11 keysym. */
  key(keysym: number, down: boolean): Promise<void>;
}

const BUTTON_BIT: Record<string, number> = { left: 1, middle: 2, right: 4 };

// X11 keysyms for the non-printable keys we map by name.
const SPECIAL_KEYSYM: Record<string, number> = {
  enter: 0xff0d,
  return: 0xff0d,
  tab: 0xff09,
  escape: 0xff1b,
  esc: 0xff1b,
  backspace: 0xff08,
  delete: 0xffff,
  space: 0x20,
  home: 0xff50,
  end: 0xff57,
  pageup: 0xff55,
  pagedown: 0xff56,
  up: 0xff52,
  down: 0xff54,
  left: 0xff51,
  right: 0xff53,
};

const MODIFIER_KEYSYM: Record<ModifierKey, number> = {
  ctrl: 0xffe3,
  alt: 0xffe9,
  shift: 0xffe1,
  meta: 0xffeb,
  command: 0xffeb,
  win: 0xffeb,
};

export abstract class RemoteDisplayBackend extends BaseBackend {
  protected client: RemoteDisplayClient | null = null;
  private readonly injectedClient?: RemoteDisplayClient;

  constructor(injectedClient?: RemoteDisplayClient) {
    super();
    this.injectedClient = injectedClient;
  }

  /** Build the protocol-specific client (overridden by VNC/RDP). */
  protected abstract buildClient(): Promise<RemoteDisplayClient>;

  async connect(): Promise<void> {
    this.client = this.injectedClient ?? (await this.buildClient());
    await this.client.connect();
    this._isConnected = true;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect().catch(() => undefined);
      this.client = null;
    }
    this._isConnected = false;
  }

  getScreenDimensions(): Promise<ScreenDimensions> {
    this.ensureConnected();
    const { width, height } = this.client!.dimensions();
    return Promise.resolve({ width, height, scaleFactor: 1 });
  }

  async screenshot(_options?: ScreenshotOptions): Promise<ScreenshotResult> {
    this.ensureConnected();
    try {
      const image = await this.client!.capture();
      const { width, height } = this.client!.dimensions();
      return {
        image,
        base64: image.toString('base64'),
        mimeType: 'image/png',
        dimensions: { width, height, scaleFactor: 1 },
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
      const mask = BUTTON_BIT[options?.button || 'left'] ?? 1;
      await this.client!.pointer(point.x, point.y, mask);
      await this.client!.pointer(point.x, point.y, 0);
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
      const mask = BUTTON_BIT[options?.button || 'left'] ?? 1;
      for (let i = 0; i < 2; i++) {
        await this.client!.pointer(point.x, point.y, mask);
        await this.client!.pointer(point.x, point.y, 0);
      }
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
        await this.click(options.point);
      }
      for (const ch of text) {
        // Printable ASCII keysyms equal their character code.
        const keysym = ch.charCodeAt(0);
        await this.client!.key(keysym, true);
        await this.client!.key(keysym, false);
        if (options?.delayMs) {
          await new Promise((resolve) => setTimeout(resolve, options.delayMs));
        }
      }
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
      // RFB encodes wheel as button 4 (up) / 5 (down) / 6 (left) / 7 (right).
      const bit = { up: 8, down: 16, left: 32, right: 64 }[direction];
      const repeats = options?.amount || 3;
      for (let i = 0; i < repeats; i++) {
        await this.client!.pointer(point.x, point.y, bit);
        await this.client!.pointer(point.x, point.y, 0);
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
    options?: DragOptions,
  ): Promise<ActionResult> {
    this.ensureConnected();
    const startTime = Date.now();
    try {
      const mask = BUTTON_BIT[options?.button || 'left'] ?? 1;
      const steps = options?.steps || 10;
      await this.client!.pointer(from.x, from.y, mask);
      for (let i = 1; i <= steps; i++) {
        const x = Math.round(from.x + ((to.x - from.x) * i) / steps);
        const y = Math.round(from.y + ((to.y - from.y) * i) / steps);
        await this.client!.pointer(x, y, mask);
      }
      await this.client!.pointer(to.x, to.y, 0);
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
      const mods = modifiers ?? [];
      for (const m of mods) {
        await this.client!.key(MODIFIER_KEYSYM[m], true);
      }
      const keysym = this.toKeysym(key);
      await this.client!.key(keysym, true);
      await this.client!.key(keysym, false);
      for (const m of [...mods].reverse()) {
        await this.client!.key(MODIFIER_KEYSYM[m], false);
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
      await this.client!.pointer(point.x, point.y, 0);
      return this.createSuccessResult('moveCursor', startTime);
    } catch (error) {
      return this.createErrorResult(
        'moveCursor',
        startTime,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  /** Map a key name to an X11 keysym (named special key or single character). */
  protected toKeysym(key: string): number {
    const lower = key.toLowerCase();
    if (lower in SPECIAL_KEYSYM) return SPECIAL_KEYSYM[lower];
    if (key.length === 1) return key.charCodeAt(0);
    // Unknown multi-char key: fall back to its first character.
    return key.charCodeAt(0);
  }
}
