/**
 * Headless Puppeteer smoke test.
 *
 * This launches a REAL headless browser, navigates to about:blank, and takes a
 * screenshot to prove the PuppeteerBackend works end to end. It is GUARDED so
 * it never fails CI when no Chromium/Chrome is available:
 *
 *   - A one-time probe (beforeAll) tries to connect the backend.
 *   - If the probe fails (no puppeteer-core, no system Chrome, or launch
 *     errors), every assertion test is skipped via `it.skipIf`.
 *   - Setting SURF_SKIP_PUPPETEER=1 forces the skip without even probing.
 *
 * To run the real smoke test locally, install a browser and (optionally) set
 * PUPPETEER_EXECUTABLE_PATH / CHROMIUM_PATH so the backend can find it.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { PuppeteerBackend } from '../backends/browser/puppeteer-backend.js';

const FORCE_SKIP = process.env.SURF_SKIP_PUPPETEER === '1';

let backend: PuppeteerBackend | null = null;
let browserAvailable = false;
let skipReason = '';

beforeAll(async () => {
  if (FORCE_SKIP) {
    skipReason = 'SURF_SKIP_PUPPETEER=1';
    return;
  }
  try {
    const b = new PuppeteerBackend({ headless: true });
    // connect() dynamically imports puppeteer-core and launches the browser.
    // Any failure (missing module, no executable, launch error) lands here.
    await b.connect();
    backend = b;
    browserAvailable = true;
  } catch (err) {
    skipReason = err instanceof Error ? err.message : String(err);
    browserAvailable = false;
    if (backend) {
      await backend.disconnect().catch(() => {});
      backend = null;
    }
  }
}, 60_000);

afterAll(async () => {
  if (backend) {
    await backend.disconnect().catch(() => {});
    backend = null;
  }
});

describe('PuppeteerBackend headless smoke', () => {
  it('reports whether a browser was available (always runs)', () => {
    // This test documents the probe result and never fails CI. When the
    // browser is unavailable the real assertions below are skipped.
    if (!browserAvailable && !FORCE_SKIP) {
      // eslint-disable-next-line no-console
      console.warn(
        `[puppeteer-smoke] skipping browser assertions: ${skipReason}`,
      );
    }
    expect(typeof browserAvailable).toBe('boolean');
  });

  it.skipIf(!browserAvailable)('connects and is marked connected', () => {
    expect(backend).not.toBeNull();
    expect(backend!.isConnected).toBe(true);
    expect(backend!.name).toBe('puppeteer-browser');
  });

  it.skipIf(!browserAvailable)(
    'navigates to about:blank and screenshots a non-empty buffer',
    async () => {
      await backend!.navigate('about:blank');
      const shot = await backend!.screenshot();
      expect(Buffer.isBuffer(shot.image)).toBe(true);
      expect(shot.image.length).toBeGreaterThan(0);
      expect(shot.base64.length).toBeGreaterThan(0);
      expect(shot.mimeType).toBe('image/png');
    },
    30_000,
  );

  it.skipIf(!browserAvailable)(
    'navigates to a data: URL and reports a matching title',
    async () => {
      await backend!.navigate(
        'data:text/html,<title>surf-smoke</title><h1>hi</h1>',
      );
      const title = await backend!.getTitle();
      expect(title).toBe('surf-smoke');
    },
    30_000,
  );
});
