/**
 * Namespaces
 *
 * Namespace management for memory isolation and organization.
 */

import { EventEmitter } from 'eventemitter3';
import type {
  MemoryEntry,
  NamespaceConfig,
  MemoryStoreInterface,
} from '../types/index.js';

/**
 * Namespace metadata
 */
export interface NamespaceMetadata {
  name: string;
  description?: string;
  owner?: string;
  createdAt: number;
  updatedAt: number;
  entryCount: number;
  tags?: string[];
  settings: NamespaceSettings;
}

/**
 * Namespace settings
 */
export interface NamespaceSettings {
  maxEntries?: number;
  ttl?: number;
  accessLevel: 'public' | 'private' | 'restricted';
  allowedAgents?: string[];
  readOnly?: boolean;
}

/**
 * Namespace events
 */
export interface NamespaceEvents {
  created: (namespace: NamespaceMetadata) => void;
  deleted: (name: string) => void;
  updated: (namespace: NamespaceMetadata) => void;
  entryAdded: (namespace: string, entry: MemoryEntry) => void;
  accessDenied: (namespace: string, agentId: string, action: string) => void;
}

/**
 * Namespace manager
 */
export class NamespaceManager extends EventEmitter<NamespaceEvents> {
  private store: MemoryStoreInterface;
  private namespaces: Map<string, NamespaceMetadata> = new Map();
  private defaultNamespace: string = 'default';

  constructor(store: MemoryStoreInterface, _config?: NamespaceConfig) {
    super();
    this.store = store;

    // Create default namespace
    this.createNamespace('default', {
      description: 'Default namespace',
      settings: { accessLevel: 'public' },
    });
  }

  /**
   * Create a new namespace
   */
  createNamespace(
    name: string,
    options: {
      description?: string;
      owner?: string;
      tags?: string[];
      settings?: Partial<NamespaceSettings>;
    } = {},
  ): NamespaceMetadata {
    if (this.namespaces.has(name)) {
      throw new Error(`Namespace "${name}" already exists`);
    }

    const metadata: NamespaceMetadata = {
      name,
      description: options.description,
      owner: options.owner,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      entryCount: 0,
      tags: options.tags,
      settings: {
        accessLevel: 'private',
        ...options.settings,
      },
    };

    this.namespaces.set(name, metadata);
    this.emit('created', metadata);

    return metadata;
  }

  /**
   * Delete a namespace
   */
  async deleteNamespace(
    name: string,
    deleteEntries: boolean = false,
  ): Promise<boolean> {
    if (name === 'default') {
      throw new Error('Cannot delete default namespace');
    }

    if (!this.namespaces.has(name)) {
      return false;
    }

    if (deleteEntries) {
      await this.store.clear({ namespace: name });
    }

    this.namespaces.delete(name);
    this.emit('deleted', name);

    return true;
  }

  /**
   * Get namespace metadata
   */
  getNamespace(name: string): NamespaceMetadata | undefined {
    return this.namespaces.get(name);
  }

  /**
   * List all namespaces
   */
  listNamespaces(): NamespaceMetadata[] {
    return Array.from(this.namespaces.values());
  }

  /**
   * Update namespace settings
   */
  updateNamespace(
    name: string,
    updates: Partial<Omit<NamespaceMetadata, 'name' | 'createdAt'>>,
  ): NamespaceMetadata | null {
    const existing = this.namespaces.get(name);
    if (!existing) return null;

    const updated: NamespaceMetadata = {
      ...existing,
      ...updates,
      settings: {
        ...existing.settings,
        ...updates.settings,
      },
      updatedAt: Date.now(),
    };

    this.namespaces.set(name, updated);
    this.emit('updated', updated);

    return updated;
  }

  /**
   * Check if agent can access namespace
   */
  canAccess(
    name: string,
    agentId: string,
    action: 'read' | 'write' = 'read',
  ): boolean {
    const namespace = this.namespaces.get(name);
    if (!namespace) return false;

    const { settings } = namespace;

    // Public access
    if (settings.accessLevel === 'public') {
      return action === 'read' || !settings.readOnly;
    }

    // Private - owner only
    if (settings.accessLevel === 'private') {
      return namespace.owner === agentId;
    }

    // Restricted - allowed agents only
    if (settings.accessLevel === 'restricted') {
      const isAllowed = settings.allowedAgents?.includes(agentId) ?? false;
      if (!isAllowed) {
        this.emit('accessDenied', name, agentId, action);
        return false;
      }
      return action === 'read' || !settings.readOnly;
    }

    return false;
  }

  /**
   * Add entry to namespace
   */
  async addEntry(
    namespace: string,
    entry: Omit<MemoryEntry, 'metadata'> & {
      metadata?: Record<string, unknown>;
    },
    agentId: string,
  ): Promise<string | null> {
    if (!this.canAccess(namespace, agentId, 'write')) {
      return null;
    }

    const ns = this.namespaces.get(namespace);
    if (!ns) return null;

    // Check max entries
    if (ns.settings.maxEntries && ns.entryCount >= ns.settings.maxEntries) {
      return null;
    }

    const fullEntry: MemoryEntry = {
      ...entry,
      metadata: {
        source: (entry.metadata?.source ??
          'explicit') as MemoryEntry['metadata']['source'],
        confidence: (entry.metadata?.confidence ?? 1.0) as number,
        ...entry.metadata,
        namespace,
      },
      expiresAt: ns.settings.ttl
        ? Date.now() + ns.settings.ttl
        : entry.expiresAt,
    };

    await this.store.add(fullEntry);

    // Update entry count
    ns.entryCount++;
    ns.updatedAt = Date.now();

    this.emit('entryAdded', namespace, fullEntry);
    return fullEntry.id;
  }

  /**
   * Query entries in namespace
   */
  async queryEntries(
    namespace: string,
    agentId: string,
    options?: { query?: string; limit?: number; types?: string[] },
  ): Promise<MemoryEntry[]> {
    if (!this.canAccess(namespace, agentId, 'read')) {
      return [];
    }

    const { entries } = await this.store.query({
      namespace,
      query: options?.query,
      limit: options?.limit,
      types: options?.types as MemoryEntry['type'][],
    });

    return entries;
  }

  /**
   * Delete entry from namespace
   */
  async deleteEntry(
    namespace: string,
    entryId: string,
    agentId: string,
  ): Promise<boolean> {
    if (!this.canAccess(namespace, agentId, 'write')) {
      return false;
    }

    const result = await this.store.delete(entryId);

    if (result) {
      const ns = this.namespaces.get(namespace);
      if (ns) {
        ns.entryCount = Math.max(0, ns.entryCount - 1);
        ns.updatedAt = Date.now();
      }
    }

    return result;
  }

  /**
   * Move entries between namespaces
   */
  async moveEntries(
    fromNamespace: string,
    toNamespace: string,
    entryIds: string[],
    agentId: string,
  ): Promise<number> {
    if (!this.canAccess(fromNamespace, agentId, 'write')) return 0;
    if (!this.canAccess(toNamespace, agentId, 'write')) return 0;

    let moved = 0;

    for (const id of entryIds) {
      const entry = await this.store.get(id);
      if (entry && entry.metadata.namespace === fromNamespace) {
        await this.store.update(id, {
          metadata: { ...entry.metadata, namespace: toNamespace },
        });
        moved++;
      }
    }

    // Update counts
    const fromNs = this.namespaces.get(fromNamespace);
    const toNs = this.namespaces.get(toNamespace);
    if (fromNs) fromNs.entryCount -= moved;
    if (toNs) toNs.entryCount += moved;

    return moved;
  }

  /**
   * Copy entries between namespaces
   */
  async copyEntries(
    fromNamespace: string,
    toNamespace: string,
    entryIds: string[],
    agentId: string,
  ): Promise<number> {
    if (!this.canAccess(fromNamespace, agentId, 'read')) return 0;
    if (!this.canAccess(toNamespace, agentId, 'write')) return 0;

    let copied = 0;

    for (const id of entryIds) {
      const entry = await this.store.get(id);
      if (entry && entry.metadata.namespace === fromNamespace) {
        const newEntry: MemoryEntry = {
          ...entry,
          id: `${entry.id}-copy-${Date.now()}`,
          metadata: { ...entry.metadata, namespace: toNamespace },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await this.store.add(newEntry);
        copied++;
      }
    }

    // Update count
    const toNs = this.namespaces.get(toNamespace);
    if (toNs) toNs.entryCount += copied;

    return copied;
  }

  /**
   * Grant access to namespace
   */
  grantAccess(namespace: string, agentId: string): boolean {
    const ns = this.namespaces.get(namespace);
    if (!ns) return false;

    if (!ns.settings.allowedAgents) {
      ns.settings.allowedAgents = [];
    }

    if (!ns.settings.allowedAgents.includes(agentId)) {
      ns.settings.allowedAgents.push(agentId);
    }

    return true;
  }

  /**
   * Revoke access from namespace
   */
  revokeAccess(namespace: string, agentId: string): boolean {
    const ns = this.namespaces.get(namespace);
    if (!ns || !ns.settings.allowedAgents) return false;

    const index = ns.settings.allowedAgents.indexOf(agentId);
    if (index !== -1) {
      ns.settings.allowedAgents.splice(index, 1);
      return true;
    }

    return false;
  }

  /**
   * Set default namespace
   */
  setDefaultNamespace(name: string): boolean {
    if (!this.namespaces.has(name)) return false;
    this.defaultNamespace = name;
    return true;
  }

  /**
   * Get default namespace
   */
  getDefaultNamespace(): string {
    return this.defaultNamespace;
  }

  /**
   * Get namespace statistics
   */
  async getNamespaceStats(name: string): Promise<{
    entryCount: number;
    totalSize: number;
    oldestEntry: number | null;
    newestEntry: number | null;
    typeDistribution: Record<string, number>;
  } | null> {
    if (!this.namespaces.has(name)) return null;

    const { entries, total } = await this.store.query({
      namespace: name,
      limit: 10000,
    });

    const typeDistribution: Record<string, number> = {};
    let oldestEntry: number | null = null;
    let newestEntry: number | null = null;
    let totalSize = 0;

    for (const entry of entries) {
      typeDistribution[entry.type] = (typeDistribution[entry.type] ?? 0) + 1;
      totalSize += entry.content.length;

      if (oldestEntry === null || entry.timestamp < oldestEntry) {
        oldestEntry = entry.timestamp;
      }
      if (newestEntry === null || entry.timestamp > newestEntry) {
        newestEntry = entry.timestamp;
      }
    }

    return {
      entryCount: total,
      totalSize,
      oldestEntry,
      newestEntry,
      typeDistribution,
    };
  }
}

/**
 * Create namespace manager
 */
export function createNamespaceManager(
  store: MemoryStoreInterface,
  config?: NamespaceConfig,
): NamespaceManager {
  return new NamespaceManager(store, config);
}
