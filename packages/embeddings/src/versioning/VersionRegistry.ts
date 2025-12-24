/**
 * VersionRegistry
 *
 * Manages embedding model versions and tracks usage.
 */

import { nanoid } from 'nanoid';
import EventEmitter from 'eventemitter3';
import type {
  EmbeddingVersion,
  VersionRegistryEntry,
  VersionComparisonResult,
  VersionUpgradePath,
  VersionRegistryOptions,
  VersionChangeEvent,
  EmbeddingProviderType,
} from '../types/index.js';

/**
 * Version registry events
 */
interface VersionRegistryEvents {
  'version:created': [version: EmbeddingVersion];
  'version:activated': [version: EmbeddingVersion, previous?: EmbeddingVersion];
  'version:deprecated': [version: EmbeddingVersion, reason: string];
  'version:deleted': [versionId: string];
  change: [event: VersionChangeEvent];
}

/**
 * Version registry for managing embedding versions
 */
export class VersionRegistry extends EventEmitter<VersionRegistryEvents> {
  private versions: Map<string, VersionRegistryEntry> = new Map();
  private activeVersion: string | null = null;
  private options: VersionRegistryOptions;

  constructor(options: VersionRegistryOptions = {}) {
    super();
    this.options = {
      autoRegister: options.autoRegister ?? true,
      trackUsage: options.trackUsage ?? true,
      maxVersions: options.maxVersions ?? 100,
      ...options,
    };
  }

  /**
   * Register a new version
   */
  register(
    version: Omit<EmbeddingVersion, 'id' | 'createdAt'>,
  ): EmbeddingVersion {
    const newVersion: EmbeddingVersion = {
      ...version,
      id: nanoid(),
      createdAt: Date.now(),
      active: false,
      deprecated: false,
    };

    const entry: VersionRegistryEntry = {
      version: newVersion,
      documentCount: 0,
      chunkCount: 0,
      firstUsed: 0,
      lastUsed: 0,
    };

    this.versions.set(newVersion.id, entry);

    // Set as active if first version
    if (this.versions.size === 1) {
      this.activate(newVersion.id);
    }

    // Enforce max versions
    if (this.versions.size > (this.options.maxVersions ?? 100)) {
      this.pruneOldVersions();
    }

    this.emit('version:created', newVersion);
    this.emitChange('created', newVersion.id);

    return newVersion;
  }

  /**
   * Get a version by ID
   */
  get(id: string): EmbeddingVersion | undefined {
    return this.versions.get(id)?.version;
  }

  /**
   * Get the active version
   */
  getActive(): EmbeddingVersion | undefined {
    if (!this.activeVersion) return undefined;
    return this.versions.get(this.activeVersion)?.version;
  }

  /**
   * Activate a version
   */
  activate(id: string): void {
    const entry = this.versions.get(id);
    if (!entry) {
      throw new Error(`Version ${id} not found`);
    }

    const previousVersion = this.activeVersion
      ? this.versions.get(this.activeVersion)?.version
      : undefined;

    // Deactivate previous
    if (this.activeVersion && this.activeVersion !== id) {
      const prev = this.versions.get(this.activeVersion);
      if (prev) {
        prev.version.active = false;
      }
    }

    entry.version.active = true;
    this.activeVersion = id;

    this.emit('version:activated', entry.version, previousVersion);
    this.emitChange('activated', id, previousVersion?.id);
  }

  /**
   * Deprecate a version
   */
  deprecate(id: string, reason: string, replacement?: string): void {
    const entry = this.versions.get(id);
    if (!entry) {
      throw new Error(`Version ${id} not found`);
    }

    entry.version.deprecated = true;
    entry.version.deprecationReason = reason;
    entry.version.replacement = replacement;

    this.emit('version:deprecated', entry.version, reason);
    this.emitChange('deprecated', id);
  }

  /**
   * Delete a version
   */
  delete(id: string): boolean {
    if (this.activeVersion === id) {
      throw new Error('Cannot delete active version');
    }

    const deleted = this.versions.delete(id);
    if (deleted) {
      this.emit('version:deleted', id);
      this.emitChange('deleted', id);
    }
    return deleted;
  }

  /**
   * List all versions
   */
  list(): EmbeddingVersion[] {
    return Array.from(this.versions.values()).map((e) => e.version);
  }

  /**
   * Find versions by provider
   */
  findByProvider(provider: EmbeddingProviderType): EmbeddingVersion[] {
    return this.list().filter((v) => v.provider === provider);
  }

  /**
   * Find versions by model
   */
  findByModel(model: string): EmbeddingVersion[] {
    return this.list().filter((v) => v.model === model);
  }

  /**
   * Compare two versions
   */
  compare(sourceId: string, targetId: string): VersionComparisonResult {
    const source = this.get(sourceId);
    const target = this.get(targetId);

    if (!source || !target) {
      throw new Error('One or both versions not found');
    }

    const dimensionChange = target.dimensions - source.dimensions;
    const providerChanged = source.provider !== target.provider;

    const migrationRequired =
      dimensionChange !== 0 || providerChanged || source.model !== target.model;

    let migrationComplexity: 'low' | 'medium' | 'high' = 'low';
    if (dimensionChange !== 0) {
      migrationComplexity = 'high';
    } else if (providerChanged) {
      migrationComplexity = 'medium';
    }

    const notes: string[] = [];
    if (dimensionChange > 0) {
      notes.push(`Dimensions increase by ${dimensionChange}`);
    } else if (dimensionChange < 0) {
      notes.push(`Dimensions decrease by ${Math.abs(dimensionChange)}`);
    }
    if (providerChanged) {
      notes.push(
        `Provider changes from ${source.provider} to ${target.provider}`,
      );
    }
    if (source.model !== target.model) {
      notes.push(`Model changes from ${source.model} to ${target.model}`);
    }

    return {
      source,
      target,
      compatible: dimensionChange === 0,
      dimensionChange,
      providerChanged,
      migrationRequired,
      migrationComplexity,
      notes,
    };
  }

  /**
   * Get upgrade path between versions
   */
  getUpgradePath(fromId: string, toId: string): VersionUpgradePath {
    const comparison = this.compare(fromId, toId);

    return {
      from: fromId,
      to: toId,
      steps: comparison.migrationRequired
        ? ['backup', 're-embed', 'verify', 'switch']
        : ['switch'],
      direct: !comparison.migrationRequired,
      complexity: comparison.migrationComplexity,
      breakingChanges:
        comparison.dimensionChange !== 0
          ? [`Dimension change: ${comparison.dimensionChange}`]
          : [],
    };
  }

  /**
   * Track usage of a version
   */
  trackUsage(id: string, documents = 0, chunks = 0): void {
    if (!this.options.trackUsage) return;

    const entry = this.versions.get(id);
    if (!entry) return;

    const now = Date.now();
    if (entry.firstUsed === 0) {
      entry.firstUsed = now;
    }
    entry.lastUsed = now;
    entry.documentCount += documents;
    entry.chunkCount += chunks;
  }

  /**
   * Get usage stats for a version
   */
  getUsageStats(id: string): VersionRegistryEntry | undefined {
    return this.versions.get(id);
  }

  /**
   * Prune old inactive versions
   */
  private pruneOldVersions(): void {
    const entries = Array.from(this.versions.entries())
      .filter(([id]) => id !== this.activeVersion)
      .sort((a, b) => a[1].lastUsed - b[1].lastUsed);

    const toRemove = entries.slice(
      0,
      entries.length - (this.options.maxVersions ?? 100) + 1,
    );
    for (const [id] of toRemove) {
      this.versions.delete(id);
      this.emitChange('deleted', id);
    }
  }

  /**
   * Emit change event
   */
  private emitChange(
    type: 'created' | 'activated' | 'deprecated' | 'deleted',
    versionId: string,
    previousVersion?: string,
  ): void {
    this.emit('change', {
      type,
      versionId,
      previousVersion,
      timestamp: Date.now(),
    });
  }

  /**
   * Export registry state
   */
  export(): {
    versions: VersionRegistryEntry[];
    activeVersion: string | null;
  } {
    return {
      versions: Array.from(this.versions.values()),
      activeVersion: this.activeVersion,
    };
  }

  /**
   * Import registry state
   */
  import(data: {
    versions: VersionRegistryEntry[];
    activeVersion: string | null;
  }): void {
    this.versions.clear();
    for (const entry of data.versions) {
      this.versions.set(entry.version.id, entry);
    }
    this.activeVersion = data.activeVersion;
  }
}

/**
 * Create a version registry
 */
export function createVersionRegistry(
  options?: VersionRegistryOptions,
): VersionRegistry {
  return new VersionRegistry(options);
}
