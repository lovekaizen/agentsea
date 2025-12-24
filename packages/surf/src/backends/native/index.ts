/**
 * Native backend exports
 */

export { MacOSBackend } from './macos-backend';
export { LinuxBackend } from './linux-backend';
export { WindowsBackend } from './windows-backend';

import { MacOSBackend } from './macos-backend';
import { LinuxBackend } from './linux-backend';
import { WindowsBackend } from './windows-backend';
import { DesktopBackend, NativeBackendOptions } from '../../types';

/**
 * Create a native backend for the current platform
 */
export function createNativeBackend(
  options?: NativeBackendOptions,
): DesktopBackend {
  switch (process.platform) {
    case 'darwin':
      return new MacOSBackend(options);
    case 'linux':
      return new LinuxBackend(options);
    case 'win32':
      return new WindowsBackend(options);
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
}
