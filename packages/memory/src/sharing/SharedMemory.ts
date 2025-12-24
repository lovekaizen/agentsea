/**
 * SharedMemory
 *
 * Shared memory system for multi-agent coordination.
 */

import { EventEmitter } from 'eventemitter3';
import type {
  MemoryEntry,
  SharedMemoryConfig,
  MemoryStoreInterface,
} from '../types/index.js';

/**
 * Shared memory events
 */
export interface SharedMemoryEvents {
  write: (agentId: string, key: string, value: unknown) => void;
  read: (agentId: string, key: string) => void;
  delete: (agentId: string, key: string) => void;
  sync: (agentId: string, entries: MemoryEntry[]) => void;
  conflict: (key: string, agents: string[]) => void;
}

/**
 * Shared value with metadata
 */
export interface SharedValue<T = unknown> {
  value: T;
  writtenBy: string;
  writtenAt: number;
  version: number;
  readers: Set<string>;
}

/**
 * Sync result
 */
export interface SyncResult {
  added: number;
  updated: number;
  conflicts: number;
  timestamp: number;
}

/**
 * Shared memory for multi-agent systems
 */
export class SharedMemory extends EventEmitter<SharedMemoryEvents> {
  private store: MemoryStoreInterface;
  private config: Required<SharedMemoryConfig>;
  private sharedState: Map<string, SharedValue> = new Map();
  private agentStates: Map<string, Map<string, unknown>> = new Map();
  private subscriptions: Map<string, Set<string>> = new Map(); // key -> agent IDs
  private lockManager: Map<string, { agentId: string; expiresAt: number }> =
    new Map();

  constructor(store: MemoryStoreInterface, config: SharedMemoryConfig = {}) {
    super();
    this.store = store;
    this.config = {
      conflictResolution: config.conflictResolution ?? 'last-write-wins',
      syncInterval: config.syncInterval ?? 5000,
      enableLocking: config.enableLocking ?? true,
      lockTimeout: config.lockTimeout ?? 30000,
      maxSharedEntries: config.maxSharedEntries ?? 1000,
    };
  }

  /**
   * Set a shared value
   */
  async set(agentId: string, key: string, value: unknown): Promise<boolean> {
    // Check lock
    if (
      this.config.enableLocking &&
      this.isLocked(key) &&
      !this.hasLock(key, agentId)
    ) {
      return false;
    }

    const existing = this.sharedState.get(key);

    // Handle conflict
    if (existing && existing.writtenBy !== agentId) {
      const resolved = this.resolveConflict(key, existing, { agentId, value });
      if (!resolved) {
        this.emit('conflict', key, [existing.writtenBy, agentId]);
        return false;
      }
    }

    const sharedValue: SharedValue = {
      value,
      writtenBy: agentId,
      writtenAt: Date.now(),
      version: (existing?.version ?? 0) + 1,
      readers: existing?.readers ?? new Set(),
    };

    this.sharedState.set(key, sharedValue);

    // Persist to store
    await this.persistSharedValue(key, sharedValue);

    this.emit('write', agentId, key, value);
    this.notifySubscribers(key, agentId, value);

    return true;
  }

  /**
   * Get a shared value
   */
  async get<T = unknown>(agentId: string, key: string): Promise<T | undefined> {
    const shared = this.sharedState.get(key);
    if (!shared) {
      // Try to load from store
      const loaded = await this.loadSharedValue(key);
      if (!loaded) return undefined;
      this.sharedState.set(key, loaded);
      return loaded.value as T;
    }

    // Track reader
    shared.readers.add(agentId);
    this.emit('read', agentId, key);

    return shared.value as T;
  }

  /**
   * Delete a shared value
   */
  async delete(agentId: string, key: string): Promise<boolean> {
    // Check lock
    if (
      this.config.enableLocking &&
      this.isLocked(key) &&
      !this.hasLock(key, agentId)
    ) {
      return false;
    }

    const existed = this.sharedState.delete(key);
    if (existed) {
      await this.store.delete(`shared:${key}`);
      this.emit('delete', agentId, key);
    }

    return existed;
  }

  /**
   * Set agent-specific state (not shared)
   */
  setAgentState(agentId: string, key: string, value: unknown): void {
    if (!this.agentStates.has(agentId)) {
      this.agentStates.set(agentId, new Map());
    }
    this.agentStates.get(agentId)!.set(key, value);
  }

  /**
   * Get agent-specific state
   */
  getAgentState<T = unknown>(agentId: string, key: string): T | undefined {
    return this.agentStates.get(agentId)?.get(key) as T | undefined;
  }

  /**
   * Get all agent state
   */
  getAllAgentState(agentId: string): Map<string, unknown> {
    return new Map(this.agentStates.get(agentId) ?? []);
  }

  /**
   * Subscribe to changes on a key
   */
  subscribe(agentId: string, key: string): void {
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
    }
    this.subscriptions.get(key)!.add(agentId);
  }

  /**
   * Unsubscribe from changes
   */
  unsubscribe(agentId: string, key: string): void {
    this.subscriptions.get(key)?.delete(agentId);
  }

  /**
   * Acquire a lock on a key
   */
  acquireLock(agentId: string, key: string): boolean {
    if (!this.config.enableLocking) return true;

    const lock = this.lockManager.get(key);
    if (lock && lock.expiresAt > Date.now() && lock.agentId !== agentId) {
      return false;
    }

    this.lockManager.set(key, {
      agentId,
      expiresAt: Date.now() + this.config.lockTimeout,
    });

    return true;
  }

  /**
   * Release a lock
   */
  releaseLock(agentId: string, key: string): boolean {
    const lock = this.lockManager.get(key);
    if (lock?.agentId === agentId) {
      this.lockManager.delete(key);
      return true;
    }
    return false;
  }

  /**
   * Check if key is locked
   */
  isLocked(key: string): boolean {
    const lock = this.lockManager.get(key);
    return lock !== undefined && lock.expiresAt > Date.now();
  }

  /**
   * Check if agent has lock
   */
  hasLock(key: string, agentId: string): boolean {
    const lock = this.lockManager.get(key);
    return lock?.agentId === agentId && lock.expiresAt > Date.now();
  }

  /**
   * Share memories from one agent to shared space
   */
  async shareMemories(
    agentId: string,
    entries: MemoryEntry[],
  ): Promise<SyncResult> {
    let added = 0;
    let updated = 0;
    let conflicts = 0;

    for (const entry of entries) {
      const key = `memory:${entry.id}`;
      const existing = this.sharedState.get(key);

      if (existing) {
        if (existing.writtenBy !== agentId) {
          // Handle conflict
          if (this.config.conflictResolution === 'last-write-wins') {
            await this.set(agentId, key, entry);
            updated++;
          } else {
            conflicts++;
          }
        } else {
          await this.set(agentId, key, entry);
          updated++;
        }
      } else {
        await this.set(agentId, key, entry);
        added++;
      }
    }

    this.emit('sync', agentId, entries);

    return {
      added,
      updated,
      conflicts,
      timestamp: Date.now(),
    };
  }

  /**
   * Get shared memories
   */
  getSharedMemories(_agentId: string): MemoryEntry[] {
    const memories: MemoryEntry[] = [];

    for (const [key, shared] of this.sharedState) {
      if (key.startsWith('memory:')) {
        const entry = shared.value as MemoryEntry;
        memories.push(entry);
      }
    }

    return memories;
  }

  /**
   * Sync with store
   */
  async sync(): Promise<void> {
    // Persist all shared state
    for (const [key, value] of this.sharedState) {
      await this.persistSharedValue(key, value);
    }
  }

  /**
   * Get all shared keys
   */
  getSharedKeys(): string[] {
    return Array.from(this.sharedState.keys());
  }

  /**
   * Get metadata for a shared value
   */
  getMetadata(key: string): Omit<SharedValue, 'value'> | undefined {
    const shared = this.sharedState.get(key);
    if (!shared) return undefined;

    return {
      writtenBy: shared.writtenBy,
      writtenAt: shared.writtenAt,
      version: shared.version,
      readers: shared.readers,
    };
  }

  /**
   * Resolve conflict between values
   */
  private resolveConflict(
    key: string,
    existing: SharedValue,
    incoming: { agentId: string; value: unknown },
  ): boolean {
    switch (this.config.conflictResolution) {
      case 'last-write-wins':
        return true;

      case 'first-write-wins':
        return false;

      case 'merge':
        // Simple merge for objects
        if (
          typeof existing.value === 'object' &&
          typeof incoming.value === 'object'
        ) {
          this.sharedState.set(key, {
            ...existing,
            value: {
              ...(existing.value as object),
              ...(incoming.value as object),
            },
            writtenBy: incoming.agentId,
            writtenAt: Date.now(),
            version: existing.version + 1,
          });
          return true;
        }
        return true; // Fall back to last-write-wins for non-objects

      default:
        return true;
    }
  }

  /**
   * Notify subscribers of changes
   */
  private notifySubscribers(
    key: string,
    writerId: string,
    value: unknown,
  ): void {
    const subscribers = this.subscriptions.get(key);
    if (!subscribers) return;

    // Emit event for each subscriber except the writer
    for (const agentId of subscribers) {
      if (agentId !== writerId) {
        this.emit('write', writerId, key, value);
      }
    }
  }

  /**
   * Persist shared value to store
   */
  private async persistSharedValue(
    key: string,
    value: SharedValue,
  ): Promise<void> {
    await this.store.add({
      id: `shared:${key}`,
      content: JSON.stringify(value),
      type: 'context',
      importance: 0.5,
      metadata: {
        source: 'agent',
        confidence: 1.0,
        sharedKey: key,
        writtenBy: value.writtenBy,
        version: value.version,
      },
      timestamp: value.writtenAt,
      accessCount: 0,
      createdAt: value.writtenAt,
      updatedAt: value.writtenAt,
    });
  }

  /**
   * Load shared value from store
   */
  private async loadSharedValue(key: string): Promise<SharedValue | null> {
    const entry = await this.store.get(`shared:${key}`);
    if (!entry) return null;

    try {
      const data = JSON.parse(entry.content);
      return {
        ...data,
        readers: new Set(data.readers ?? []),
      };
    } catch {
      return null;
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    sharedEntries: number;
    agentCount: number;
    activeLocks: number;
    totalSubscriptions: number;
  } {
    let totalSubscriptions = 0;
    for (const subs of this.subscriptions.values()) {
      totalSubscriptions += subs.size;
    }

    return {
      sharedEntries: this.sharedState.size,
      agentCount: this.agentStates.size,
      activeLocks: Array.from(this.lockManager.values()).filter(
        (l) => l.expiresAt > Date.now(),
      ).length,
      totalSubscriptions,
    };
  }
}

/**
 * Create shared memory instance
 */
export function createSharedMemory(
  store: MemoryStoreInterface,
  config?: SharedMemoryConfig,
): SharedMemory {
  return new SharedMemory(store, config);
}
