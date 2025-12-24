/**
 * InMemoryStore
 *
 * In-memory implementation for development and testing.
 */

import { LRUCache } from 'lru-cache';
import type {
  MemoryEntry,
  MemoryUpdateInput,
  MemoryQueryOptions,
  MemoryQueryResult,
  MemoryStoreInterface,
  ScoredMemory,
  VectorSearchOptions,
  InMemoryStoreConfig,
} from '../../types/index.js';

/**
 * In-memory store implementation
 */
export class InMemoryStore implements MemoryStoreInterface {
  private cache: LRUCache<string, MemoryEntry>;

  constructor(config: InMemoryStoreConfig = {}) {
    this.cache = new LRUCache<string, MemoryEntry>({
      max: config.maxSize ?? 10000,
      ttl: config.ttl,
      updateAgeOnGet: true,
    });
  }

  /**
   * Add a memory entry
   */
  async add(entry: MemoryEntry): Promise<string> {
    this.cache.set(entry.id, entry);
    return Promise.resolve(entry.id);
  }

  /**
   * Get a memory entry by ID
   */
  async get(id: string): Promise<MemoryEntry | null> {
    const entry = this.cache.get(id);
    if (entry) {
      // Update access count
      entry.accessCount++;
      entry.lastAccessedAt = Date.now();
      this.cache.set(id, entry);
    }
    return Promise.resolve(entry ?? null);
  }

  /**
   * Update a memory entry
   */
  async update(id: string, updates: MemoryUpdateInput): Promise<boolean> {
    const entry = this.cache.get(id);
    if (!entry) {
      return Promise.resolve(false);
    }

    const updated: MemoryEntry = {
      ...entry,
      ...updates,
      metadata: {
        ...entry.metadata,
        ...updates.metadata,
      },
      updatedAt: Date.now(),
    };

    this.cache.set(id, updated);
    return Promise.resolve(true);
  }

  /**
   * Delete a memory entry
   */
  async delete(id: string): Promise<boolean> {
    return Promise.resolve(this.cache.delete(id));
  }

  /**
   * Query memory entries
   */
  async query(options: MemoryQueryOptions): Promise<MemoryQueryResult> {
    const entries: MemoryEntry[] = [];
    const limit = options.limit ?? 100;
    const offset = options.offset ?? 0;

    // Iterate through all entries
    for (const entry of this.cache.values()) {
      if (this.matchesQuery(entry, options)) {
        entries.push(entry);
      }
    }

    // Sort by timestamp (newest first)
    entries.sort((a, b) => b.timestamp - a.timestamp);

    // Apply pagination
    const paginated = entries.slice(offset, offset + limit);

    return Promise.resolve({
      entries: paginated,
      total: entries.length,
      hasMore: offset + limit < entries.length,
    });
  }

  /**
   * Search by vector similarity
   */
  async search(
    embedding: number[],
    options: VectorSearchOptions,
  ): Promise<ScoredMemory[]> {
    const results: ScoredMemory[] = [];

    for (const entry of this.cache.values()) {
      // Skip entries without embeddings
      if (!entry.embedding) {
        continue;
      }

      // Apply filters
      if (options.filter) {
        if (!this.matchesFilter(entry, options.filter)) {
          continue;
        }
      }

      if (options.namespace && entry.metadata.namespace !== options.namespace) {
        continue;
      }

      // Calculate cosine similarity
      const score = this.cosineSimilarity(embedding, entry.embedding);

      // Apply minimum score filter
      if (options.minScore !== undefined && score < options.minScore) {
        continue;
      }

      results.push({ entry, score });
    }

    // Sort by score (highest first)
    results.sort((a, b) => b.score - a.score);

    // Return top-K
    return Promise.resolve(results.slice(0, options.topK));
  }

  /**
   * Clear entries
   */
  async clear(options?: {
    namespace?: string;
    userId?: string;
  }): Promise<number> {
    if (!options) {
      const size = this.cache.size;
      this.cache.clear();
      return Promise.resolve(size);
    }

    let deleted = 0;
    const toDelete: string[] = [];

    for (const [id, entry] of this.cache.entries()) {
      let shouldDelete = true;

      if (options.namespace && entry.metadata.namespace !== options.namespace) {
        shouldDelete = false;
      }

      if (options.userId && entry.metadata.userId !== options.userId) {
        shouldDelete = false;
      }

      if (shouldDelete) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      this.cache.delete(id);
      deleted++;
    }

    return Promise.resolve(deleted);
  }

  /**
   * Count entries
   */
  async count(options?: MemoryQueryOptions): Promise<number> {
    if (!options) {
      return Promise.resolve(this.cache.size);
    }

    let count = 0;
    for (const entry of this.cache.values()) {
      if (this.matchesQuery(entry, options)) {
        count++;
      }
    }
    return Promise.resolve(count);
  }

  /**
   * Close the store (no-op for in-memory)
   */
  async close(): Promise<void> {
    // No-op for in-memory store
  }

  /**
   * Check if entry matches query
   */
  private matchesQuery(
    entry: MemoryEntry,
    options: MemoryQueryOptions,
  ): boolean {
    // Check text query (simple contains)
    if (options.query) {
      const queryLower = options.query.toLowerCase();
      if (!entry.content.toLowerCase().includes(queryLower)) {
        return false;
      }
    }

    // Check filters
    if (options.userId && entry.metadata.userId !== options.userId) {
      return false;
    }

    if (options.agentId && entry.metadata.agentId !== options.agentId) {
      return false;
    }

    if (
      options.conversationId &&
      entry.metadata.conversationId !== options.conversationId
    ) {
      return false;
    }

    if (options.sessionId && entry.metadata.sessionId !== options.sessionId) {
      return false;
    }

    if (options.namespace && entry.metadata.namespace !== options.namespace) {
      return false;
    }

    if (options.types && options.types.length > 0) {
      if (!options.types.includes(entry.type)) {
        return false;
      }
    }

    if (options.tags && options.tags.length > 0) {
      const entryTags = entry.metadata.tags ?? [];
      const hasAllTags = options.tags.every((tag) => entryTags.includes(tag));
      if (!hasAllTags) {
        return false;
      }
    }

    if (
      options.minImportance !== undefined &&
      entry.importance < options.minImportance
    ) {
      return false;
    }

    if (
      options.startTime !== undefined &&
      entry.timestamp < options.startTime
    ) {
      return false;
    }

    if (options.endTime !== undefined && entry.timestamp > options.endTime) {
      return false;
    }

    // Check expiration
    if (!options.includeExpired && entry.expiresAt) {
      if (entry.expiresAt < Date.now()) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if entry matches filter
   */
  private matchesFilter(
    entry: MemoryEntry,
    filter: Record<string, unknown>,
  ): boolean {
    for (const [key, value] of Object.entries(filter)) {
      if (value === undefined) continue;

      // Check metadata
      if (key in entry.metadata) {
        if (Array.isArray(value)) {
          if (!value.includes(entry.metadata[key])) {
            return false;
          }
        } else if (entry.metadata[key] !== value) {
          return false;
        }
      } else if (key in entry) {
        const entryValue = (entry as unknown as Record<string, unknown>)[key];
        if (Array.isArray(value)) {
          if (!value.includes(entryValue)) {
            return false;
          }
        } else if (entryValue !== value) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Calculate cosine similarity
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    if (magnitude === 0) {
      return 0;
    }

    return dotProduct / magnitude;
  }

  /**
   * Get all entries (for debugging)
   */
  getAllEntries(): MemoryEntry[] {
    return Array.from(this.cache.values());
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.cache.size;
  }
}

/**
 * Create an in-memory store
 */
export function createInMemoryStore(
  config?: InMemoryStoreConfig,
): InMemoryStore {
  return new InMemoryStore(config);
}
