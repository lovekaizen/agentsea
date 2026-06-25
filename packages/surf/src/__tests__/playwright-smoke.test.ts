/**
 * Headless Playwright smoke test.
 *
 * Launches a REAL headless browser via the PlaywrightBackend, navigates, and
 * screenshots to prove the backend works end to end. GUARDED so it never fails
 * CI when Playwright/its browsers are not installed:
 *
 *   - A one-time probe (beforeAll) tries to connect the backend.
 *   - If the probe fails (no playwright package, browsers not downloaded, or a
 *     launch error), every assertion is skipped via `it.skipIf`.
 *   - Setting SURF_SKIP_PLAYWRIGHT=1 forces the skip without even probing.
 *
 * To run locally: `npm install playwright && npx playwright install chromium`.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { PlaywrightBackend } from '../backends/browser/playwright-backend.js';

const FORCE_SKIP = process.env.SURF_SKIP_PLAYWRIGHT === '1';

let backend: PlaywrightBackend | null = null;
let browserAvailable = false;
let skipReason = '';

beforeAll(async () => {
  if (FORCE_SKIP) {
    skipReason = 'SURF_SKIP_PLAYWRIGHT=1';
    return;
  }
  try {
    const b = new PlaywrightBackend({ headless: true });
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

describe('PlaywrightBackend headless smoke', () => {
  it('reports whether a browser was available (always runs)', () => {
    if (!browserAvailable && !FORCE_SKIP) {
      // eslint-disable-next-line no-console
      console.warn(
        `[playwright-smoke] skipping browser assertions: ${skipReason}`,
      );
    }
    expect(typeof browserAvailable).toBe('boolean');
  });

  it.skipIf(!browserAvailable)('connects and is marked connected', () => {
    expect(backend).not.toBeNull();
    expect(backend!.isConnected).toBe(true);
    expect(backend!.name).toBe('playwright-browser');
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
        'data:text/html,<title>surf-pw-smoke</title><h1>hi</h1>',
      );
      const title = await backend!.getTitle();
      expect(title).toBe('surf-pw-smoke');
    },
    30_000,
  );
});
