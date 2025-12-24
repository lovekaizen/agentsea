/**
 * Shared Memory
 *
 * Crew-wide shared state management.
 */

import { EventEmitter } from 'eventemitter3';

/**
 * Memory change event
 */
export interface MemoryChangeEvent {
  type: 'set' | 'delete' | 'clear';
  key?: string;
  value?: unknown;
  previousValue?: unknown;
  agent?: string;
  timestamp: Date;
}

/**
 * Memory namespace
 */
export interface MemoryNamespace {
  name: string;
  data: Map<string, unknown>;
  created: Date;
  lastAccessed: Date;
}

/**
 * Shared memory configuration
 */
export interface SharedMemoryConfig {
  /** Maximum entries per namespace */
  maxEntriesPerNamespace?: number;
  /** Enable change history */
  trackHistory?: boolean;
  /** Maximum history entries */
  maxHistoryEntries?: number;
  /** Enable persistence */
  persist?: boolean;
}

/**
 * Shared memory
 *
 * Provides crew-wide shared state with namespace isolation.
 */
export class SharedMemory extends EventEmitter<{
  change: (event: MemoryChangeEvent) => void;
  namespaceCreated: (name: string) => void;
  namespaceDeleted: (name: string) => void;
}> {
  private readonly namespaces: Map<string, MemoryNamespace> = new Map();
  private readonly agentNamespaces: Map<string, string> = new Map();
  private readonly history: MemoryChangeEvent[] = [];
  private readonly config: Required<SharedMemoryConfig>;

  constructor(config: SharedMemoryConfig = {}) {
    super();
    this.config = {
      maxEntriesPerNamespace: config.maxEntriesPerNamespace ?? 1000,
      trackHistory: config.trackHistory ?? true,
      maxHistoryEntries: config.maxHistoryEntries ?? 100,
      persist: config.persist ?? false,
    };

    // Create default shared namespace
    this.createNamespace('shared');
  }

  // ============ Shared Operations ============

  /**
   * Set a shared value
   */
  setShared(key: string, value: unknown, agent?: string): void {
    this.set('shared', key, value, agent);
  }

  /**
   * Get a shared value
   */
  getShared<T>(key: string): T | undefined {
    return this.get<T>('shared', key);
  }

  /**
   * Delete a shared value
   */
  deleteShared(key: string, agent?: string): boolean {
    return this.delete('shared', key, agent);
  }

  /**
   * Check if shared key exists
   */
  hasShared(key: string): boolean {
    return this.has('shared', key);
  }

  /**
   * Get all shared keys
   */
  getSharedKeys(): string[] {
    return this.getKeys('shared');
  }

  // ============ Agent-Specific Operations ============

  /**
   * Set a value for a specific agent
   */
  setForAgent(agentName: string, key: string, value: unknown): void {
    // Create agent namespace if needed
    if (!this.agentNamespaces.has(agentName)) {
      const namespace = `agent:${agentName}`;
      this.createNamespace(namespace);
      this.agentNamespaces.set(agentName, namespace);
    }

    const namespace = this.agentNamespaces.get(agentName)!;
    this.set(namespace, key, value, agentName);
  }

  /**
   * Get a value for a specific agent
   */
  getForAgent<T>(agentName: string, key: string): T | undefined {
    const namespace = this.agentNamespaces.get(agentName);
    if (!namespace) return undefined;
    return this.get<T>(namespace, key);
  }

  /**
   * Delete a value for a specific agent
   */
  deleteForAgent(agentName: string, key: string): boolean {
    const namespace = this.agentNamespaces.get(agentName);
    if (!namespace) return false;
    return this.delete(namespace, key, agentName);
  }

  /**
   * Get all keys for an agent
   */
  getAgentKeys(agentName: string): string[] {
    const namespace = this.agentNamespaces.get(agentName);
    if (!namespace) return [];
    return this.getKeys(namespace);
  }

  /**
   * Clear all agent data
   */
  clearAgent(agentName: string): void {
    const namespace = this.agentNamespaces.get(agentName);
    if (namespace) {
      this.clearNamespace(namespace, agentName);
    }
  }

  // ============ Broadcast Operations ============

  /**
   * Broadcast a value to all agents
   */
  broadcast(key: string, value: unknown, fromAgent?: string): void {
    // Set in shared namespace
    this.setShared(key, value, fromAgent);

    // Emit broadcast event
    this.emit('change', {
      type: 'set',
      key: `broadcast:${key}`,
      value,
      agent: fromAgent,
      timestamp: new Date(),
    });
  }

  // ============ Namespace Operations ============

  /**
   * Create a namespace
   */
  createNamespace(name: string): MemoryNamespace {
    if (this.namespaces.has(name)) {
      return this.namespaces.get(name)!;
    }

    const namespace: MemoryNamespace = {
      name,
      data: new Map(),
      created: new Date(),
      lastAccessed: new Date(),
    };

    this.namespaces.set(name, namespace);
    this.emit('namespaceCreated', name);

    return namespace;
  }

  /**
   * Delete a namespace
   */
  deleteNamespace(name: string): boolean {
    if (name === 'shared') {
      throw new Error('Cannot delete shared namespace');
    }

    if (!this.namespaces.has(name)) {
      return false;
    }

    this.namespaces.delete(name);
    this.emit('namespaceDeleted', name);

    return true;
  }

  /**
   * Clear a namespace
   */
  clearNamespace(name: string, agent?: string): void {
    const namespace = this.namespaces.get(name);
    if (namespace) {
      namespace.data.clear();
      namespace.lastAccessed = new Date();

      if (this.config.trackHistory) {
        this.addToHistory({
          type: 'clear',
          agent,
          timestamp: new Date(),
        });
      }
    }
  }

  /**
   * Get namespace names
   */
  getNamespaces(): string[] {
    return Array.from(this.namespaces.keys());
  }

  // ============ Low-Level Operations ============

  /**
   * Set a value in a namespace
   */
  set(namespace: string, key: string, value: unknown, agent?: string): void {
    const ns = this.namespaces.get(namespace);
    if (!ns) {
      throw new Error(`Namespace not found: ${namespace}`);
    }

    // Check limit
    if (
      ns.data.size >= this.config.maxEntriesPerNamespace &&
      !ns.data.has(key)
    ) {
      // Remove oldest entry
      const firstKey = ns.data.keys().next().value;
      if (firstKey !== undefined) {
        ns.data.delete(firstKey);
      }
    }

    const previousValue = ns.data.get(key);
    ns.data.set(key, value);
    ns.lastAccessed = new Date();

    // Track history
    if (this.config.trackHistory) {
      this.addToHistory({
        type: 'set',
        key: `${namespace}:${key}`,
        value,
        previousValue,
        agent,
        timestamp: new Date(),
      });
    }

    // Emit change event
    this.emit('change', {
      type: 'set',
      key: `${namespace}:${key}`,
      value,
      previousValue,
      agent,
      timestamp: new Date(),
    });
  }

  /**
   * Get a value from a namespace
   */
  get<T>(namespace: string, key: string): T | undefined {
    const ns = this.namespaces.get(namespace);
    if (!ns) return undefined;

    ns.lastAccessed = new Date();
    return ns.data.get(key) as T | undefined;
  }

  /**
   * Delete a value from a namespace
   */
  delete(namespace: string, key: string, agent?: string): boolean {
    const ns = this.namespaces.get(namespace);
    if (!ns) return false;

    const previousValue = ns.data.get(key);
    const deleted = ns.data.delete(key);
    ns.lastAccessed = new Date();

    if (deleted && this.config.trackHistory) {
      this.addToHistory({
        type: 'delete',
        key: `${namespace}:${key}`,
        previousValue,
        agent,
        timestamp: new Date(),
      });
    }

    if (deleted) {
      this.emit('change', {
        type: 'delete',
        key: `${namespace}:${key}`,
        previousValue,
        agent,
        timestamp: new Date(),
      });
    }

    return deleted;
  }

  /**
   * Check if key exists in namespace
   */
  has(namespace: string, key: string): boolean {
    const ns = this.namespaces.get(namespace);
    if (!ns) return false;
    return ns.data.has(key);
  }

  /**
   * Get all keys in a namespace
   */
  getKeys(namespace: string): string[] {
    const ns = this.namespaces.get(namespace);
    if (!ns) return [];
    return Array.from(ns.data.keys());
  }

  // ============ History ============

  /**
   * Add to history
   */
  private addToHistory(event: MemoryChangeEvent): void {
    this.history.push(event);

    // Trim history
    if (this.history.length > this.config.maxHistoryEntries) {
      this.history.shift();
    }
  }

  /**
   * Get change history
   */
  getHistory(filter?: {
    agent?: string;
    key?: string;
    type?: 'set' | 'delete' | 'clear';
    since?: Date;
  }): MemoryChangeEvent[] {
    let events = [...this.history];

    if (filter) {
      if (filter.agent) {
        events = events.filter((e) => e.agent === filter.agent);
      }
      if (filter.key) {
        events = events.filter((e) => e.key?.includes(filter.key!));
      }
      if (filter.type) {
        events = events.filter((e) => e.type === filter.type);
      }
      if (filter.since) {
        events = events.filter((e) => e.timestamp >= filter.since!);
      }
    }

    return events;
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history.length = 0;
  }

  // ============ Serialization ============

  /**
   * Export all data
   */
  export(): Record<string, Record<string, unknown>> {
    const data: Record<string, Record<string, unknown>> = {};

    for (const [name, namespace] of this.namespaces) {
      data[name] = Object.fromEntries(namespace.data);
    }

    return data;
  }

  /**
   * Import data
   */
  import(data: Record<string, Record<string, unknown>>): void {
    for (const [name, entries] of Object.entries(data)) {
      if (!this.namespaces.has(name)) {
        this.createNamespace(name);
      }

      const namespace = this.namespaces.get(name)!;
      for (const [key, value] of Object.entries(entries)) {
        namespace.data.set(key, value);
      }
    }
  }

  /**
   * Clear all data
   */
  clear(): void {
    for (const namespace of this.namespaces.values()) {
      namespace.data.clear();
    }
    this.history.length = 0;
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalNamespaces: number;
    totalEntries: number;
    entriesByNamespace: Record<string, number>;
    historyEntries: number;
  } {
    const entriesByNamespace: Record<string, number> = {};
    let totalEntries = 0;

    for (const [name, namespace] of this.namespaces) {
      entriesByNamespace[name] = namespace.data.size;
      totalEntries += namespace.data.size;
    }

    return {
      totalNamespaces: this.namespaces.size,
      totalEntries,
      entriesByNamespace,
      historyEntries: this.history.length,
    };
  }
}

/**
 * Factory function
 */
export function createSharedMemory(config?: SharedMemoryConfig): SharedMemory {
  return new SharedMemory(config);
}

export default SharedMemory;
