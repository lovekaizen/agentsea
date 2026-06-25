/**
 * RDP backend
 *
 * Controls a remote desktop over RDP. Like the VNC backend, the
 * operation→event translation lives in {@link RemoteDisplayBackend}; this class
 * supplies a {@link RemoteDisplayClient}.
 *
 * NOTE: there is no broadly-maintained pure-Node RDP stack, so the real
 * transport is **experimental** and provided through an optional `node-rdpjs`
 * compatible client (lazily imported). The recommended production path is to
 * inject your own `client` (e.g. an RDP→framebuffer bridge), which the backend
 * fully supports. The backend's input/coordinate translation is unit-tested via
 * an injected client regardless of the transport.
 */

import {
  RemoteDisplayBackend,
  type RemoteDisplayClient,
} from './remote-display-backend';
import type { RDPBackendOptions } from '../../types';

export interface RDPBackendDeps {
  /** Inject a remote-display client instead of building one from `node-rdpjs`. */
  client?: RemoteDisplayClient;
}

export class RDPBackend extends RemoteDisplayBackend {
  readonly name = 'rdp-remote';

  private options: RDPBackendOptions;

  constructor(options: RDPBackendOptions, deps: RDPBackendDeps = {}) {
    super(deps.client);
    if (!options.host) throw new Error('RDP backend requires a `host`');
    if (!options.username) throw new Error('RDP backend requires a `username`');
    this.options = options;
  }

  protected async buildClient(): Promise<RemoteDisplayClient> {
    const moduleName = 'node-rdpjs';
    let rdp: unknown;
    try {
      rdp = await import(/* @vite-ignore */ moduleName);
    } catch {
      throw new Error(
        'RDP backend requires an optional RDP client ("node-rdpjs"). Install ' +
          'it, or pass a custom `client` (recommended — e.g. an RDP→framebuffer ' +
          'bridge).',
      );
    }
    return createRdpClient(rdp, this.options);
  }
}

/** Thin adapter over an optional node-rdpjs-style client (experimental). */
function createRdpClient(
  rdpModule: unknown,
  options: RDPBackendOptions,
): RemoteDisplayClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rdp = rdpModule as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let client: any = null;
  let width = 1024;
  let height = 768;

  return {
    connect() {
      return new Promise<void>((resolve, reject) => {
        client = rdp.createClient({
          domain: options.domain ?? '',
          userName: options.username,
          password: options.password,
          enablePerf: true,
          autoLogin: true,
          screen: { width, height },
        });
        client.on('connect', () => resolve());
        client.on('error', reject);
        client.connect(options.host, options.port ?? 3389);
      });
    },
    disconnect() {
      client?.close?.();
      client = null;
      return Promise.resolve();
    },
    dimensions() {
      if (client?.screen) {
        width = client.screen.width ?? width;
        height = client.screen.height ?? height;
      }
      return { width, height };
    },
    capture() {
      return Promise.reject(
        new Error(
          'node-rdpjs frame capture requires a bitmap assembler; provide a ' +
            'custom client for screenshot support',
        ),
      );
    },
    pointer(x: number, y: number, buttonMask: number) {
      // node-rdpjs sendPointerEvent(x, y, button, isPressed)
      const isPressed = buttonMask !== 0;
      const button = buttonMask & 1 ? 1 : buttonMask & 4 ? 2 : 3;
      client?.sendPointerEvent?.(x, y, button, isPressed);
      return Promise.resolve();
    },
    key(keysym: number, down: boolean) {
      client?.sendKeyEventScancode?.(keysym, down);
      return Promise.resolve();
    },
  };
}

export function createRDPBackend(
  options: RDPBackendOptions,
  deps?: RDPBackendDeps,
): RDPBackend {
  return new RDPBackend(options, deps);
}
