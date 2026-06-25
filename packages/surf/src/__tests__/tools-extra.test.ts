/**
 * Coverage for the previously-untested tools: drag, key-press, cursor-move,
 * screenshot, and wait. Uses the established MockBackend pattern from the
 * existing tool test suite (see click.tool.test.ts / scroll.tool.test.ts).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createDragTool } from '../tools/drag.tool.js';
import { createKeyPressTool } from '../tools/key-press.tool.js';
import { createCursorMoveTool } from '../tools/cursor-move.tool.js';
import { createScreenshotTool } from '../tools/screenshot.tool.js';
import { createWaitTool } from '../tools/wait.tool.js';
import type {
  DesktopBackend,
  Point,
  ActionResult,
  ScreenshotResult,
  ScreenshotOptions,
  DragOptions,
  ModifierKey,
} from '../types/index.js';

function ok(action: string): ActionResult {
  return { success: true, action, timestamp: new Date(), duration: 5 };
}

class MockBackend implements Partial<DesktopBackend> {
  readonly name = 'mock';
  isConnected = true;

  async drag(
    _from: Point,
    _to: Point,
    _o?: DragOptions,
  ): Promise<ActionResult> {
    return ok('drag');
  }
  async keyPress(_key: string, _m?: ModifierKey[]): Promise<ActionResult> {
    return ok('keyPress');
  }
  async moveCursor(_point: Point): Promise<ActionResult> {
    return ok('moveCursor');
  }
  async wait(_ms: number): Promise<ActionResult> {
    return ok('wait');
  }
  async screenshot(_o?: ScreenshotOptions): Promise<ScreenshotResult> {
    return {
      image: Buffer.from([1, 2, 3]),
      base64: 'AQID',
      mimeType: 'image/png',
      dimensions: { width: 1920, height: 1080, scaleFactor: 2 },
      timestamp: new Date(),
    };
  }
}

// ---------------------------------------------------------------------------
describe('createDragTool', () => {
  let backend: MockBackend;
  let tool: ReturnType<typeof createDragTool>;

  beforeEach(() => {
    backend = new MockBackend();
    tool = createDragTool(backend as unknown as DesktopBackend);
  });

  it('has the correct metadata', () => {
    expect(tool.name).toBe('computer_drag');
    expect(tool.description).toBeTruthy();
    expect(tool.inputSchema).toBeDefined();
    expect(tool.outputSchema).toBeDefined();
  });

  it('passes from/to points and options to backend.drag', async () => {
    const spy = vi.spyOn(backend, 'drag');
    const res = await tool.execute({
      fromX: 10,
      fromY: 20,
      toX: 30,
      toY: 40,
      button: 'left',
      durationMs: 500,
    });
    expect(spy).toHaveBeenCalledWith(
      { x: 10, y: 20 },
      { x: 30, y: 40 },
      expect.objectContaining({ button: 'left', durationMs: 500 }),
    );
    expect(res.success).toBe(true);
    expect(res.fromX).toBe(10);
    expect(res.toY).toBe(40);
  });

  it('reports failure when the backend drag fails', async () => {
    vi.spyOn(backend, 'drag').mockResolvedValue({
      success: false,
      action: 'drag',
      timestamp: new Date(),
      duration: 1,
      error: 'no display',
    });
    const res = await tool.execute({
      fromX: 0,
      fromY: 0,
      toX: 1,
      toY: 1,
      button: 'left',
      durationMs: 500,
    });
    expect(res.success).toBe(false);
    expect(res.error).toBe('no display');
  });

  it('wraps a thrown backend error', async () => {
    vi.spyOn(backend, 'drag').mockRejectedValue(new Error('boom'));
    const res = await tool.execute({
      fromX: 0,
      fromY: 0,
      toX: 1,
      toY: 1,
      button: 'left',
      durationMs: 500,
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain('Drag failed');
    expect(res.error).toContain('boom');
  });
});

// ---------------------------------------------------------------------------
describe('createKeyPressTool', () => {
  let backend: MockBackend;
  let tool: ReturnType<typeof createKeyPressTool>;

  beforeEach(() => {
    backend = new MockBackend();
    tool = createKeyPressTool(backend as unknown as DesktopBackend);
  });

  it('has the correct metadata', () => {
    expect(tool.name).toBe('computer_key');
    expect(tool.inputSchema).toBeDefined();
  });

  it('passes key and modifiers to backend.keyPress', async () => {
    const spy = vi.spyOn(backend, 'keyPress');
    const res = await tool.execute({
      key: 'a',
      modifiers: ['ctrl', 'shift'],
      repeat: 1,
    });
    expect(spy).toHaveBeenCalledWith('a', ['ctrl', 'shift']);
    expect(res.success).toBe(true);
    expect(res.key).toBe('a');
  });

  it('repeats the key press N times', async () => {
    const spy = vi.spyOn(backend, 'keyPress');
    const res = await tool.execute({ key: 'Tab', repeat: 3 });
    expect(spy).toHaveBeenCalledTimes(3);
    expect(res.repeat).toBe(3);
  });

  it('stops and reports the failing repeat index on backend failure', async () => {
    const spy = vi
      .spyOn(backend, 'keyPress')
      .mockResolvedValueOnce(ok('keyPress'))
      .mockResolvedValueOnce({
        success: false,
        action: 'keyPress',
        timestamp: new Date(),
        duration: 1,
        error: 'key failed',
      });
    const res = await tool.execute({ key: 'x', repeat: 5 });
    expect(res.success).toBe(false);
    expect(res.error).toBe('key failed');
    expect(res.repeat).toBe(2); // failed on the 2nd press
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('wraps a thrown backend error', async () => {
    vi.spyOn(backend, 'keyPress').mockRejectedValue(new Error('nope'));
    const res = await tool.execute({ key: 'x', repeat: 1 });
    expect(res.success).toBe(false);
    expect(res.error).toContain('Key press failed');
    expect(res.error).toContain('nope');
  });
});

// ---------------------------------------------------------------------------
describe('createCursorMoveTool', () => {
  let backend: MockBackend;
  let tool: ReturnType<typeof createCursorMoveTool>;

  beforeEach(() => {
    backend = new MockBackend();
    tool = createCursorMoveTool(backend as unknown as DesktopBackend);
  });

  it('has the correct metadata', () => {
    expect(tool.name).toBe('computer_cursor_move');
  });

  it('passes the target point to backend.moveCursor', async () => {
    const spy = vi.spyOn(backend, 'moveCursor');
    const res = await tool.execute({
      x: 55,
      y: 66,
      smooth: false,
      durationMs: 0,
    });
    expect(spy).toHaveBeenCalledWith({ x: 55, y: 66 });
    expect(res.success).toBe(true);
    expect(res.x).toBe(55);
    expect(res.y).toBe(66);
  });

  it('honors smooth movement delay without error', async () => {
    const res = await tool.execute({
      x: 1,
      y: 2,
      smooth: true,
      durationMs: 10,
    });
    expect(res.success).toBe(true);
  });

  it('wraps a thrown backend error', async () => {
    vi.spyOn(backend, 'moveCursor').mockRejectedValue(new Error('eek'));
    const res = await tool.execute({
      x: 0,
      y: 0,
      smooth: false,
      durationMs: 0,
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain('Cursor move failed');
    expect(res.error).toContain('eek');
  });
});

// ---------------------------------------------------------------------------
describe('createScreenshotTool', () => {
  let backend: MockBackend;
  let tool: ReturnType<typeof createScreenshotTool>;

  beforeEach(() => {
    backend = new MockBackend();
    tool = createScreenshotTool(backend as unknown as DesktopBackend);
  });

  it('has the correct metadata', () => {
    expect(tool.name).toBe('computer_screenshot');
  });

  it('returns base64 image and dimensions from the backend', async () => {
    const res = await tool.execute({ format: 'png', quality: 90 });
    expect(res.success).toBe(true);
    expect(res.base64).toBe('AQID');
    expect(res.mimeType).toBe('image/png');
    expect(res.width).toBe(1920);
    expect(res.height).toBe(1080);
    expect(res.scaleFactor).toBe(2);
  });

  it('forwards region/format/quality to backend.screenshot', async () => {
    const spy = vi.spyOn(backend, 'screenshot');
    await tool.execute({
      region: { x: 1, y: 2, width: 3, height: 4 },
      format: 'jpeg',
      quality: 80,
    });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        region: { x: 1, y: 2, width: 3, height: 4 },
        format: 'jpeg',
        quality: 80,
      }),
    );
  });

  it('throws a wrapped error when the backend screenshot fails', async () => {
    vi.spyOn(backend, 'screenshot').mockRejectedValue(new Error('no screen'));
    await expect(tool.execute({ format: 'png', quality: 90 })).rejects.toThrow(
      /Screenshot failed: no screen/,
    );
  });
});

// ---------------------------------------------------------------------------
describe('createWaitTool', () => {
  let backend: MockBackend;
  let tool: ReturnType<typeof createWaitTool>;

  beforeEach(() => {
    backend = new MockBackend();
    tool = createWaitTool(backend as unknown as DesktopBackend);
  });

  it('has the correct metadata', () => {
    expect(tool.name).toBe('computer_wait');
  });

  it('calls backend.wait and returns the elapsed time + reason', async () => {
    const spy = vi.spyOn(backend, 'wait');
    const res = await tool.execute({ ms: 100, reason: 'page load' });
    expect(spy).toHaveBeenCalledWith(100);
    expect(res.success).toBe(true);
    expect(res.reason).toBe('page load');
    expect(res.waitedMs).toBeGreaterThanOrEqual(0);
  });

  it('returns success=false when backend.wait throws', async () => {
    vi.spyOn(backend, 'wait').mockRejectedValue(new Error('interrupted'));
    const res = await tool.execute({ ms: 100 });
    expect(res.success).toBe(false);
  });
});
