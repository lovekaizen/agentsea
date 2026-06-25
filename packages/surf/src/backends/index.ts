/**
 * Backend exports and factory
 */

// Base backend
export { BaseBackend } from './base-backend';

// Native backends
export {
  MacOSBackend,
  LinuxBackend,
  WindowsBackend,
  createNativeBackend,
} from './native';

// Browser backends
export { PuppeteerBackend, PlaywrightBackend } from './browser';

// Docker backend
export { DockerBackend } from './docker';

// Kubernetes backend
export { KubernetesBackend, createKubernetesBackend } from './kubernetes';

// Remote-display backends (VNC / RDP)
export {
  RemoteDisplayBackend,
  type RemoteDisplayClient,
  VNCBackend,
  createVNCBackend,
  RDPBackend,
  createRDPBackend,
} from './remote';

// Types
import type {
  DesktopBackend,
  BackendConfig,
  NativeBackendOptions,
  BrowserBackendOptions as _BrowserBackendOptions,
  DockerBackendOptions as _DockerBackendOptions,
} from '../types';

import { createNativeBackend } from './native';
import { PuppeteerBackend, PlaywrightBackend } from './browser';
import { DockerBackend } from './docker';
import { KubernetesBackend } from './kubernetes';
import { VNCBackend, RDPBackend } from './remote';

/**
 * Create a backend from configuration
 */
export function createBackend(config: BackendConfig): Promise<DesktopBackend> {
  switch (config.type) {
    case 'native':
      return Promise.resolve(
        createNativeBackend(config.options as NativeBackendOptions),
      );

    case 'browser':
      return Promise.resolve(
        config.options?.engine === 'playwright'
          ? new PlaywrightBackend(config.options)
          : new PuppeteerBackend(config.options),
      );

    case 'docker':
      return Promise.resolve(new DockerBackend(config.options));

    case 'vnc':
      return Promise.resolve(new VNCBackend(config.options));

    case 'rdp':
      return Promise.resolve(new RDPBackend(config.options));

    case 'kubernetes':
      return Promise.resolve(new KubernetesBackend(config.options));

    default:
      throw new Error(
        `Unknown backend type: ${String((config as Record<string, unknown>).type)}`,
      );
  }
}
