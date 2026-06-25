/**
 * MemoryStore
 *
 * In-memory vector store for testing and development.
 */

import { BaseStore } from './BaseStore.js';
import type {
  VectorRecord,
  VectorStoreType,
  MemoryStoreConfig,
  UpsertOptions,
  UpsertResult,
  DeleteOptions,
  DeleteResult,
  StoreQueryOptions,
  StoreQueryResult,
  StoreStats,
  StoreHealth,
  EmbeddingVector,
} from '../types/index.js';
import * as fs from 'fs/promises';

/**
 * In-memory vector store
 */
export class MemoryStore extends BaseStore {
  readonly storeType: VectorStoreType = 'memory';

  private vectors: Map<string, VectorRecord> = new Map();
  private namespaces: Map<string, Set<string>> = new Map();
  private persistPath?: string;
  private persistInterval?: NodeJS.Timeout;
  private maxVectors: number;

  constructor(config: MemoryStoreConfig = { type: 'memory' }) {
    super(config);
    this.maxVectors = config.maxVectors ?? 100000;
    this.persistPath = config.persistPath;

    if (config.persistInterval && config.persistPath) {
      this.persistInterval = setInterval(
        () => void this.persist().catch(() => {}),
        config.persistInterval,
      );
    }
  }

  async upsert(
    records: VectorRecord[],
    options?: UpsertOptions,
  ): Promise<UpsertResult> {
    const startTime = performance.now();
    const namespace = options?.namespace ?? this.namespace;
    const upsertedIds: string[] = [];
    const errors: Array<{ id: string; error: string }> = [];

    // Ensure namespace exists
    if (!this.namespaces.has(namespace)) {
      this.namespaces.set(namespace, new Set());
    }
    const nsIds = this.namespaces.get(namespace)!;

    for (const record of records) {
      try {
        // Check max vectors
        if (
          this.vectors.size >= this.maxVectors &&
          !this.vectors.has(record.id)
        ) {
          // Evict oldest entry
          const oldestId = this.vectors.keys().next().value;
          if (oldestId) {
            this.vectors.delete(oldestId);
            // Remove from all namespaces
            for (const ns of this.namespaces.values()) {
              ns.delete(oldestId);
            }
          }
        }

        this.vectors.set(record.id, record);
        nsIds.add(record.id);
        upsertedIds.push(record.id);
      } catch (error) {
        errors.push({ id: record.id, error: (error as Error).message });
      }
    }

    return Promise.resolve({
      upsertedIds,
      upsertedCount: upsertedIds.length,
      errors,
      durationMs: performance.now() - startTime,
    });
  }

  async query(
    vector: EmbeddingVector,
    options?: StoreQueryOptions,
  ): Promise<StoreQueryResult> {
    const startTime = performance.now();
    const namespace = options?.namespace ?? this.namespace;
    const topK = options?.topK ?? 10;
    const minScore = options?.minScore ?? 0;

    // Get vectors in namespace
    const nsIds = this.namespaces.get(namespace);
    if (!nsIds || nsIds.size === 0) {
      return {
        matches: [],
        namespace,
        durationMs: performance.now() - startTime,
      };
    }

    // Calculate scores for all vectors
    let scoredRecords: Array<VectorRecord & { score: number }> = [];

    for (const id of nsIds) {
      const record = this.vectors.get(id);
      if (!record) continue;

      const score = this.calculateScore(vector, record.vector);
      if (score >= minScore) {
        scoredRecords.push({ ...record, score });
      }
    }

    // Apply metadata filter
    if (options?.filter) {
      scoredRecords = this.filterByMetadata(
        scoredRecords,
        options.filter,
      ) as Array<VectorRecord & { score: number }>;
    }

    // Sort by score descending
    scoredRecords.sort((a, b) => b.score - a.score);

    // Take top K
    const topResults = scoredRecords.slice(0, topK);

    return Promise.resolve({
      matches: this.toSearchResults(topResults, options),
      namespace,
      durationMs: performance.now() - startTime,
    });
  }

  async delete(ids: string[], options?: DeleteOptions): Promise<DeleteResult> {
    const startTime = performance.now();
    const namespace = options?.namespace ?? this.namespace;
    let deletedCount = 0;

    const nsIds = this.namespaces.get(namespace);

    for (const id of ids) {
      if (this.vectors.has(id)) {
        this.vectors.delete(id);
        nsIds?.delete(id);
        deletedCount++;
      }
    }

    // In-memory store knows exactly which ids existed and were removed.
    return Promise.resolve({
      deletedCount,
      requestedCount: ids.length,
      countExact: true,
      durationMs: performance.now() - startTime,
    });
  }

  async deleteAll(options?: DeleteOptions): Promise<DeleteResult> {
    const startTime = performance.now();
    const namespace = options?.namespace ?? this.namespace;

    if (options?.deleteAll) {
      const count = this.vectors.size;
      this.vectors.clear();
      this.namespaces.clear();
      return Promise.resolve({
        deletedCount: count,
        requestedCount: count,
        countExact: true,
        durationMs: performance.now() - startTime,
      });
    }

    const nsIds = this.namespaces.get(namespace);
    if (!nsIds) {
      return Promise.resolve({
        deletedCount: 0,
        requestedCount: 0,
        countExact: true,
        durationMs: performance.now() - startTime,
      });
    }

    const count = nsIds.size;
    for (const id of nsIds) {
      this.vectors.delete(id);
    }
    this.namespaces.delete(namespace);

    return Promise.resolve({
      deletedCount: count,
      requestedCount: count,
      countExact: true,
      durationMs: performance.now() - startTime,
    });
  }

  getStats(): Promise<StoreStats> {
    return Promise.resolve({
      type: this.storeType,
      vectorCount: this.vectors.size,
      namespaceCount: this.namespaces.size,
      dimensions: this.dimensions ?? 0,
      metric: this.metric,
      lastUpdated: Date.now(),
    });
  }

  checkHealth(): Promise<StoreHealth> {
    return Promise.resolve({
      healthy: true,
      latencyMs: 0,
      lastCheck: Date.now(),
    });
  }

  async close(): Promise<void> {
    if (this.persistInterval) {
      clearInterval(this.persistInterval);
    }
    if (this.persistPath) {
      await this.persist();
    }
  }

  /**
   * Persist store to file
   */
  async persist(): Promise<void> {
    if (!this.persistPath) return;

    const data = {
      vectors: Array.from(this.vectors.entries()),
      namespaces: Array.from(this.namespaces.entries()).map(([k, v]) => [
        k,
        Array.from(v),
      ]),
    };

    await fs.writeFile(this.persistPath, JSON.stringify(data), 'utf-8');
  }

  /**
   * Load store from file
   */
  async load(): Promise<void> {
    if (!this.persistPath) return;

    try {
      const data = JSON.parse(await fs.readFile(this.persistPath, 'utf-8'));
      this.vectors = new Map(data.vectors);
      this.namespaces = new Map(
        data.namespaces.map(([k, v]: [string, string[]]) => [k, new Set(v)]),
      );
    } catch {
      // File doesn't exist or is invalid
    }
  }

  /**
   * Get all vectors
   */
  getAll(): VectorRecord[] {
    return Array.from(this.vectors.values());
  }

  /**
   * Get vector by ID
   */
  getById(id: string): VectorRecord | undefined {
    return this.vectors.get(id);
  }
}

/**
 * Create a memory store
 */
export function createMemoryStore(config?: MemoryStoreConfig): MemoryStore {
  return new MemoryStore(config);
}
