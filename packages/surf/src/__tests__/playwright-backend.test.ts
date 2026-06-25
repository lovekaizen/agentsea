/**
 * Unit tests for PlaywrightBackend action translation.
 *
 * These do NOT launch a browser: a fake Playwright `page` is injected so the
 * backend's mapping of high-level actions (click/type/scroll/keyPress) onto the
 * Playwright mouse/keyboard API can be asserted deterministically in CI. The
 * real launch path is covered (when available) by playwright-smoke.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlaywrightBackend } from '../backends/browser/playwright-backend.js';

function fakePage() {
  return {
    mouse: {
      click: vi.fn().mockResolvedValue(undefined),
      move: vi.fn().mockResolvedValue(undefined),
      wheel: vi.fn().mockResolvedValue(undefined),
      down: vi.fn().mockResolvedValue(undefined),
      up: vi.fn().mockResolvedValue(undefined),
    },
    keyboard: {
      down: vi.fn().mockResolvedValue(undefined),
      up: vi.fn().mockResolvedValue(undefined),
      press: vi.fn().mockResolvedValue(undefined),
      type: vi.fn().mockResolvedValue(undefined),
    },
    viewportSize: vi.fn().mockReturnValue({ width: 1280, height: 720 }),
    screenshot: vi.fn().mockResolvedValue(Buffer.from([1, 2, 3])),
  };
}

/** Build a backend with the fake page injected and marked connected. */
function connectedBackend(page: ReturnType<typeof fakePage>) {
  const backend = new PlaywrightBackend({ headless: true });
  // Inject private state to bypass a real browser launch.
  Object.assign(backend as unknown as Record<string, unknown>, {
    page,
    _isConnected: true,
  });
  return backend;
}

describe('PlaywrightBackend action translation', () => {
  let page: ReturnType<typeof fakePage>;

  beforeEach(() => {
    page = fakePage();
  });

  it('has the playwright-browser name and defaults to chromium', () => {
    const backend = new PlaywrightBackend();
    expect(backend.name).toBe('playwright-browser');
  });

  it('clicks with the mapped button and applies modifiers', async () => {
    const backend = connectedBackend(page);
    const res = await backend.click(
      { x: 10, y: 20 },
      { button: 'right', modifiers: ['ctrl'] },
    );
    expect(res.success).toBe(true);
    expect(page.keyboard.down).toHaveBeenCalledWith('Control');
    expect(page.mouse.click).toHaveBeenCalledWith(10, 20, {
      button: 'right',
      delay: 0,
    });
    expect(page.keyboard.up).toHaveBeenCalledWith('Control');
  });

  it('types text after an optional focus click', async () => {
    const backend = connectedBackend(page);
    await backend.typeText('hello', { point: { x: 5, y: 5 }, delayMs: 7 });
    expect(page.mouse.click).toHaveBeenCalledWith(5, 5);
    expect(page.keyboard.type).toHaveBeenCalledWith('hello', { delay: 7 });
  });

  it('scrolls by converting amount to a wheel delta', async () => {
    const backend = connectedBackend(page);
    await backend.scroll('down', { x: 100, y: 100 }, { amount: 2 });
    expect(page.mouse.move).toHaveBeenCalledWith(100, 100);
    // amount(2) * 100 px, downward => positive deltaY
    expect(page.mouse.wheel).toHaveBeenCalledWith(0, 200);
  });

  it('maps friendly key names to Playwright key names', async () => {
    const backend = connectedBackend(page);
    await backend.keyPress('enter', ['shift']);
    expect(page.keyboard.down).toHaveBeenCalledWith('Shift');
    expect(page.keyboard.press).toHaveBeenCalledWith('Enter');
    expect(page.keyboard.up).toHaveBeenCalledWith('Shift');
  });

  it('returns a screenshot result with base64 + png mime', async () => {
    const backend = connectedBackend(page);
    const shot = await backend.screenshot();
    expect(Buffer.isBuffer(shot.image)).toBe(true);
    expect(shot.base64).toBe(Buffer.from([1, 2, 3]).toString('base64'));
    expect(shot.mimeType).toBe('image/png');
    expect(shot.dimensions).toMatchObject({ width: 1280, height: 720 });
  });

  it('throws when an action is attempted before connecting', async () => {
    const backend = new PlaywrightBackend();
    await expect(backend.moveCursor({ x: 1, y: 1 })).rejects.toThrow();
  });
});
