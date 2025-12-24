/**
 * Sharing Module
 *
 * Export multi-agent sharing components.
 */

export {
  SharedMemory,
  createSharedMemory,
  type SharedMemoryEvents,
  type SharedValue,
  type SyncResult,
} from './SharedMemory.js';

export {
  NamespaceManager,
  createNamespaceManager,
  type NamespaceMetadata,
  type NamespaceSettings,
  type NamespaceEvents,
} from './Namespaces.js';

export {
  AccessControl,
  createAccessControl,
  type Permission,
  type PermissionRule,
  type PermissionCondition,
  type AccessRequest,
  type AccessResult,
  type AccessLogEntry,
  type AccessControlEvents,
} from './AccessControl.js';
