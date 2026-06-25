import { describe, it, expect, vi, afterEach } from 'vitest';

import { createBackend } from '../backends/index.js';
import { createNativeBackend } from '../backends/native/index.js';
import { MacOSBackend } from '../backends/native/macos-backend.js';
import { LinuxBackend } from '../backends/native/linux-backend.js';
import { WindowsBackend } from '../backends/native/windows-backend.js';
import { PuppeteerBackend } from '../backends/browser/puppeteer-backend.js';
import { PlaywrightBackend } from '../backends/browser/playwright-backend.js';
import { DockerBackend } from '../backends/docker/docker-backend.js';

/**
 * Helper to run a function with process.platform temporarily overridden.
 * process.platform is read-only so it must be redefined.
 */
function withPlatform<T>(platform: NodeJS.Platform, fn: () => T): T {
  const original = Object.getOwnPropertyDescriptor(process, 'platform');
  Object.defineProperty(process, 'platform', {
    value: platform,
    configurable: true,
  });
  try {
    return fn();
  } finally {
    if (original) {
      Object.defineProperty(process, 'platform', original);
    }
  }
}

describe('createNativeBackend (platform selection)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a MacOSBackend on darwin', () => {
    const backend = withPlatform('darwin', () => createNativeBackend());
    expect(backend).toBeInstanceOf(MacOSBackend);
    expect(backend.name).toBe('macos-native');
  });

  it('returns a LinuxBackend on linux', () => {
    const backend = withPlatform('linux', () => createNativeBackend());
    expect(backend).toBeInstanceOf(LinuxBackend);
    expect(backend.name).toBe('linux-native');
  });

  it('returns a WindowsBackend on win32', () => {
    const backend = withPlatform('win32', () => createNativeBackend());
    expect(backend).toBeInstanceOf(WindowsBackend);
    expect(backend.name).toBe('windows-native');
  });

  it('throws a clear error on an unsupported platform', () => {
    expect(() =>
      withPlatform('freebsd' as NodeJS.Platform, () => createNativeBackend()),
    ).toThrow(/Unsupported platform: freebsd/);
  });

  it('forwards options to the constructed backend', () => {
    // displayIndex is stored privately; constructing without throwing on a
    // supported platform is the observable behavior we can assert here.
    const backend = withPlatform('linux', () =>
      createNativeBackend({ displayIndex: 2 }),
    );
    expect(backend).toBeInstanceOf(LinuxBackend);
  });
});

describe('createBackend (type discrimination)', () => {
  it('creates a native backend for type "native"', async () => {
    const backend = await withPlatform('darwin', () =>
      createBackend({ type: 'native', options: {} }),
    );
    expect(backend).toBeInstanceOf(MacOSBackend);
  });

  it('creates a PuppeteerBackend for type "browser" (default engine)', async () => {
    const backend = await createBackend({
      type: 'browser',
      options: { headless: true },
    });
    expect(backend).toBeInstanceOf(PuppeteerBackend);
    expect(backend.name).toBe('puppeteer-browser');
  });

  it('creates a PlaywrightBackend when engine is "playwright"', async () => {
    const backend = await createBackend({
      type: 'browser',
      options: { headless: true, engine: 'playwright' },
    });
    expect(backend).toBeInstanceOf(PlaywrightBackend);
    expect(backend.name).toBe('playwright-browser');
  });

  it('creates a DockerBackend for type "docker"', async () => {
    const backend = await createBackend({
      type: 'docker',
      options: { image: 'agentsea/desktop:latest' },
    });
    expect(backend).toBeInstanceOf(DockerBackend);
    expect(backend.name).toBe('docker-container');
  });

  // NOTE: createBackend throws SYNCHRONOUSLY for the unimplemented/unknown
  // branches (the throw happens before any Promise is constructed), so these
  // are tested with a synchronous expect(...).toThrow rather than .rejects.
  it('throws "not yet implemented" for the vnc backend', () => {
    expect(() =>
      createBackend({
        type: 'vnc',
        options: { host: 'localhost', port: 5900 },
      }),
    ).toThrow(/VNC backend not yet implemented/);
  });

  it('throws "not yet implemented" for the rdp backend', () => {
    expect(() =>
      createBackend({
        type: 'rdp',
        options: { host: 'localhost', username: 'u', password: 'p' },
      }),
    ).toThrow(/RDP backend not yet implemented/);
  });

  it('throws "not yet implemented" for the kubernetes backend', () => {
    expect(() =>
      createBackend({
        type: 'kubernetes',
        options: { namespace: 'default', image: 'x' },
      }),
    ).toThrow(/Kubernetes backend not yet implemented/);
  });

  it('throws a clear error for an unknown backend type', () => {
    expect(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createBackend({ type: 'quantum' } as any),
    ).toThrow(/Unknown backend type: quantum/);
  });
});
