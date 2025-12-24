/**
 * Sharing Types
 *
 * Types for multi-agent shared memory.
 */

import type { MemoryEntry, ScoredMemory } from './core.types.js';

/**
 * Memory visibility
 */
export type MemoryVisibility = 'public' | 'team' | 'private';

/**
 * Access permission
 */
export type AccessPermission = 'read' | 'write' | 'delete' | 'admin';

/**
 * Sync strategy
 */
export type SyncStrategy = 'strong' | 'eventual' | 'manual';

/**
 * Conflict resolution strategy
 */
export type ConflictResolution =
  | 'last-write-wins'
  | 'first-write-wins'
  | 'merge'
  | 'manual';

/**
 * Shared memory input
 */
export interface SharedMemoryInput {
  content: string;
  namespace: string;
  visibility?: MemoryVisibility;
  author: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Shared memory entry (extends base entry)
 */
export interface SharedMemoryEntry extends MemoryEntry {
  namespace: string;
  visibility: MemoryVisibility;
  author: string;
  tags: string[];
  version: number;
  lastModifiedBy?: string;
}

/**
 * Shared memory configuration
 */
export interface SharedMemoryConfig {
  conflictResolution?: ConflictResolution;
  syncInterval?: number;
  enableLocking?: boolean;
  lockTimeout?: number;
  maxSharedEntries?: number;
}

/**
 * Sync manager configuration
 */
export interface SyncManagerConfig {
  strategy: SyncStrategy;
  conflictResolution: ConflictResolution;
  syncInterval?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

/**
 * Sync status
 */
export interface SyncStatus {
  lastSync: number;
  pendingChanges: number;
  conflicts: SyncConflict[];
  isHealthy: boolean;
}

/**
 * Sync conflict
 */
export interface SyncConflict {
  memoryId: string;
  localVersion: SharedMemoryEntry;
  remoteVersion: SharedMemoryEntry;
  detectedAt: number;
  resolved: boolean;
  resolution?: SharedMemoryEntry;
}

/**
 * Role definition
 */
export interface RoleDefinition {
  name: string;
  permissions: AccessPermission[];
  inherits?: string[];
}

/**
 * Access control configuration
 */
export interface AccessControlConfig {
  roles?: Record<string, AccessPermission[]>;
  defaultRole?: string;
  adminUsers?: string[];
  defaultPermission?: AccessPermission;
  enableAuditLog?: boolean;
  strictMode?: boolean;
  maxRulesPerAgent?: number;
}

/**
 * Access check result
 */
export interface AccessCheckResult {
  allowed: boolean;
  reason?: string;
  requiredPermission: AccessPermission;
  userPermissions: AccessPermission[];
}

/**
 * Namespace configuration
 */
export interface NamespaceConfig {
  name: string;
  description?: string;
  visibility?: MemoryVisibility;
  allowedAgents?: string[];
  maxSize?: number;
  retentionDays?: number;
}

/**
 * Namespace info
 */
export interface NamespaceInfo extends NamespaceConfig {
  createdAt: number;
  updatedAt: number;
  memoryCount: number;
  totalSize: number;
}

/**
 * Shared memory query options
 */
export interface SharedMemoryQueryOptions {
  query: string;
  namespace: string;
  agents?: string[];
  visibility?: MemoryVisibility[];
  tags?: string[];
  limit?: number;
}

/**
 * Memory subscription
 */
export interface MemorySubscription {
  id: string;
  namespace: string;
  filter?: {
    tags?: string[];
    authors?: string[];
    visibility?: MemoryVisibility[];
  };
  callback: (event: SharedMemoryEvent) => void;
}

/**
 * Shared memory event type
 */
export type SharedMemoryEventType =
  | 'memory:added'
  | 'memory:updated'
  | 'memory:deleted'
  | 'namespace:created'
  | 'namespace:deleted'
  | 'sync:completed'
  | 'sync:conflict';

/**
 * Shared memory event
 */
export interface SharedMemoryEvent {
  type: SharedMemoryEventType;
  namespace: string;
  memoryId?: string;
  memory?: SharedMemoryEntry;
  author?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * Shared memory interface
 */
export interface SharedMemoryInterface {
  add(input: SharedMemoryInput): Promise<string>;
  retrieve(options: SharedMemoryQueryOptions): Promise<ScoredMemory[]>;
  namespace(name: string): NamespaceInterface;
  setAccessControl(acl: AccessControlConfig): void;
  on(
    event: SharedMemoryEventType,
    callback: (event: SharedMemoryEvent) => void,
  ): void;
  off(
    event: SharedMemoryEventType,
    callback: (event: SharedMemoryEvent) => void,
  ): void;
}

/**
 * Namespace interface
 */
export interface NamespaceInterface {
  readonly name: string;
  add(entry: Omit<SharedMemoryInput, 'namespace'>): Promise<string>;
  query(
    query: string,
    options?: Omit<SharedMemoryQueryOptions, 'namespace'>,
  ): Promise<ScoredMemory[]>;
  getInfo(): Promise<NamespaceInfo>;
  clear(): Promise<void>;
}
