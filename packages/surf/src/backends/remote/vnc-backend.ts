/**
 * VNC backend
 *
 * Controls a remote desktop over the RFB (VNC) protocol. The operation→event
 * translation lives in {@link RemoteDisplayBackend}; this class supplies a
 * {@link RemoteDisplayClient} backed by the optional `rfb2` package (lazily
 * imported). For tests, inject a client directly.
 */

import {
  RemoteDisplayBackend,
  type RemoteDisplayClient,
} from './remote-display-backend';
import type { VNCBackendOptions } from '../../types';

export interface VNCBackendDeps {
  /** Inject a remote-display client instead of building one from `rfb2`. */
  client?: RemoteDisplayClient;
}

export class VNCBackend extends RemoteDisplayBackend {
  readonly name = 'vnc-remote';

  private options: VNCBackendOptions;

  constructor(options: VNCBackendOptions, deps: VNCBackendDeps = {}) {
    super(deps.client);
    if (!options.host) throw new Error('VNC backend requires a `host`');
    if (!options.port) throw new Error('VNC backend requires a `port`');
    this.options = options;
  }

  protected async buildClient(): Promise<RemoteDisplayClient> {
    // `rfb2` is an optional dependency; resolve via a variable specifier so the
    // package builds without it installed.
    const moduleName = 'rfb2';
    let rfb: unknown;
    try {
      rfb = await import(/* @vite-ignore */ moduleName);
    } catch {
      throw new Error(
        'VNC backend requires the optional "rfb2" package. Install it, or pass ' +
          'a custom `client`.',
      );
    }
    return createRfb2Client(rfb, this.options);
  }
}

/**
 * Adapt the `rfb2` client into a {@link RemoteDisplayClient}. Kept thin and
 * isolated; the surrounding backend logic is what carries unit-test coverage.
 */
function createRfb2Client(
  rfbModule: unknown,
  options: VNCBackendOptions,
): RemoteDisplayClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rfb = rfbModule as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let conn: any = null;
  let width = 0;
  let height = 0;

  return {
    connect() {
      return new Promise<void>((resolve, reject) => {
        conn = rfb.createConnection({
          host: options.host,
          port: options.port,
          password: options.password,
        });
        conn.on('connect', () => {
          width = conn.width;
          height = conn.height;
          resolve();
        });
        conn.on('error', reject);
      });
    },
    disconnect() {
      conn?.end?.();
      conn = null;
      return Promise.resolve();
    },
    dimensions() {
      return { width, height };
    },
    capture() {
      // rfb2 surfaces framebuffer rectangles via 'rect' events; capturing a
      // full PNG requires assembling them. Delegated to the caller's client in
      // practice (or a higher-level helper); not exercised by unit tests.
      return Promise.reject(
        new Error(
          'rfb2 frame capture requires a framebuffer assembler; provide a ' +
            'custom client for screenshot support',
        ),
      );
    },
    pointer(x: number, y: number, buttonMask: number) {
      conn?.pointerEvent?.(x, y, buttonMask);
      return Promise.resolve();
    },
    key(keysym: number, down: boolean) {
      if (options.viewOnly) return Promise.resolve();
      conn?.keyEvent?.(keysym, down ? 1 : 0);
      return Promise.resolve();
    },
  };
}

export function createVNCBackend(
  options: VNCBackendOptions,
  deps?: VNCBackendDeps,
): VNCBackend {
  return new VNCBackend(options, deps);
}
