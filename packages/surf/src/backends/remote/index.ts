/**
 * Remote-display backend exports (VNC / RDP)
 */

export {
  RemoteDisplayBackend,
  type RemoteDisplayClient,
} from './remote-display-backend';
export {
  VNCBackend,
  createVNCBackend,
  type VNCBackendDeps,
} from './vnc-backend';
export {
  RDPBackend,
  createRDPBackend,
  type RDPBackendDeps,
} from './rdp-backend';
