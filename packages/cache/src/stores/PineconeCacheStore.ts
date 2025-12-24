/**
 * PineconeCacheStore
 *
 * Pinecone vector database store for scalable semantic caching.
 * Native vector search for high-performance similarity matching.
 */

import { BaseCacheStore } from './BaseCacheStore.js';
import type {
  CacheEntry,
  CacheBackendType,
  PineconeStoreConfig,
  StoreHealth,
  StoreQueryOptions,
  StoreQueryResult,
  UpsertResult,
} from '../types/index.js';
import { now } from '../core/utils.js';

/**
 * Pinecone client interface
 */
interface PineconeClient {
  Index(name: string): PineconeIndex;
}

interface PineconeIndex {
  namespace(name: string): PineconeNamespace;
  describeIndexStats(): Promise<{
    namespaces: Record<string, { recordCount: number }>;
  }>;
}

interface PineconeNamespace {
  upsert(vectors: PineconeVector[]): Promise<void>;
  query(options: PineconeQueryOptions): Promise<PineconeQueryResponse>;
  deleteOne(id: string): Promise<void>;
  deleteMany(ids: string[]): Promise<void>;
  deleteAll(): Promise<void>;
  fetch(ids: string[]): Promise<{ records: Record<string, PineconeRecord> }>;
  listPaginated(options?: {
    prefix?: string;
    limit?: number;
  }): Promise<{ vectors: Array<{ id: string }> }>;
}

interface PineconeVector {
  id: string;
  values: number[];
  metadata?: Record<string, unknown>;
}

interface PineconeQueryOptions {
  vector: number[];
  topK: number;
  includeMetadata?: boolean;
  includeValues?: boolean;
  filter?: Record<string, unknown>;
}

interface PineconeQueryResponse {
  matches: Array<{
    id: string;
    score: number;
    values?: number[];
    metadata?: Record<string, unknown>;
  }>;
}

interface PineconeRecord {
  id: string;
  values: number[];
  metadata?: Record<string, unknown>;
}

/**
 * Pinecone metadata structure for cache entries
 */
interface CacheMetadata {
  key: string;
  model: string;
  content: string;
  createdAt: number;
  accessedAt: number;
  accessCount: number;
  hitCount: number;
  ttl: number;
  namespace: string;
  tags: string[];
  entryData: string; // JSON stringified full entry
}

/**
 * PineconeCacheStore
 *
 * Vector database store for scalable semantic caching.
 * Uses Pinecone for native vector similarity search.
 *
 * @example
 * ```typescript
 * const store = new PineconeCacheStore({
 *   type: 'pinecone',
 *   apiKey: process.env.PINECONE_API_KEY!,
 *   index: 'llm-cache',
 *   namespace: 'production'
 * });
 *
 * await store.set('key', entry);
 * const results = await store.query(embedding, { topK: 5 });
 * ```
 */
export class PineconeCacheStore extends BaseCacheStore {
  readonly storeType: CacheBackendType = 'pinecone';

  private client: PineconeClient | null = null;
  private index: PineconeIndex | null = null;
  private ns: PineconeNamespace | null = null;
  private pineconeConfig: PineconeStoreConfig;
  private connected = false;

  constructor(config: PineconeStoreConfig) {
    super(config);
    this.pineconeConfig = config;
  }

  /**
   * Connect to Pinecone
   */
  async connect(): Promise<void> {
    if (this.connected) return;

    try {
      const { Pinecone } = await import('@pinecone-database/pinecone');

      this.client = new Pinecone({
        apiKey: this.pineconeConfig.apiKey,
      }) as unknown as PineconeClient;

      this.index = this.client.Index(this.pineconeConfig.index);
      this.ns = this.index.namespace(this.namespace);
      this.connected = true;
    } catch (error) {
      throw new Error(
        `Failed to connect to Pinecone: ${(error as Error).message}`,
      );
    }
  }

  private async ensureConnected(): Promise<PineconeNamespace> {
    if (!this.connected || !this.ns) {
      await this.connect();
    }
    if (!this.ns) {
      throw new Error('Pinecone namespace not initialized');
    }
    return this.ns;
  }

  async get(key: string): Promise<CacheEntry | undefined> {
    this.incrementMetric('gets');
    const ns = await this.ensureConnected();

    try {
      // Fetch by ID (key is used as vector ID)
      const result = await ns.fetch([key]);

      if (!result.records[key]) {
        this.incrementMetric('misses');
        return undefined;
      }

      this.incrementMetric('hits');
      const record = result.records[key];
      const metadata = record.metadata as unknown as CacheMetadata;

      // Parse the full entry from metadata
      const entry = JSON.parse(metadata.entryData) as CacheEntry;
      entry.metadata.accessedAt = now();
      entry.metadata.accessCount++;

      // Update access metadata (fire and forget)
      this.updateAccessMetadata(key, record.values, metadata).catch(() => {});

      return entry;
    } catch {
      this.incrementMetric('misses');
      return undefined;
    }
  }

  private async updateAccessMetadata(
    key: string,
    values: number[],
    metadata: CacheMetadata,
  ): Promise<void> {
    const ns = await this.ensureConnected();
    const updatedEntry = JSON.parse(metadata.entryData) as CacheEntry;
    updatedEntry.metadata.accessedAt = now();
    updatedEntry.metadata.accessCount++;

    await ns.upsert([
      {
        id: key,
        values,
        metadata: {
          ...metadata,
          accessedAt: now(),
          accessCount: metadata.accessCount + 1,
          entryData: JSON.stringify(updatedEntry),
        },
      },
    ]);
  }

  async set(key: string, entry: CacheEntry): Promise<UpsertResult> {
    const startTime = performance.now();
    this.incrementMetric('sets');
    const ns = await this.ensureConnected();

    // Ensure entry has an embedding
    if (!entry.embedding || entry.embedding.length === 0) {
      return {
        success: false,
        id: entry.id,
        durationMs: performance.now() - startTime,
      };
    }

    const metadata: CacheMetadata = {
      key,
      model: entry.request.model,
      content: entry.response.content.substring(0, 30000), // Pinecone metadata limit
      createdAt: entry.metadata.createdAt,
      accessedAt: entry.metadata.accessedAt,
      accessCount: entry.metadata.accessCount,
      hitCount: entry.metadata.hitCount,
      ttl: entry.metadata.ttl,
      namespace: entry.metadata.namespace ?? this.namespace,
      tags: entry.metadata.tags ?? [],
      entryData: JSON.stringify(entry),
    };

    try {
      await ns.upsert([
        {
          id: key,
          values: entry.embedding,
          metadata: metadata as unknown as Record<string, unknown>,
        },
      ]);

      return {
        success: true,
        id: entry.id,
        durationMs: performance.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        id: entry.id,
        durationMs: performance.now() - startTime,
      };
    }
  }

  async has(key: string): Promise<boolean> {
    const ns = await this.ensureConnected();
    try {
      const result = await ns.fetch([key]);
      return !!result.records[key];
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    this.incrementMetric('deletes');
    const ns = await this.ensureConnected();

    try {
      await ns.deleteOne(key);
      return true;
    } catch {
      return false;
    }
  }

  async clear(): Promise<void> {
    const ns = await this.ensureConnected();
    await ns.deleteAll();
  }

  async size(): Promise<number> {
    if (!this.index) {
      await this.connect();
    }

    try {
      const stats = await this.index!.describeIndexStats();
      return stats.namespaces[this.namespace]?.recordCount ?? 0;
    } catch {
      return 0;
    }
  }

  async keys(): Promise<string[]> {
    const ns = await this.ensureConnected();

    try {
      // Note: Pinecone doesn't support listing all keys efficiently
      // This uses pagination but may be limited
      const result = await ns.listPaginated({ limit: 10000 });
      return result.vectors.map((v) => v.id);
    } catch {
      return [];
    }
  }

  async query(
    vector: number[],
    options?: StoreQueryOptions,
  ): Promise<StoreQueryResult> {
    const startTime = performance.now();
    const ns = await this.ensureConnected();

    const queryOptions: PineconeQueryOptions = {
      vector,
      topK: options?.topK ?? 10,
      includeMetadata: true,
      includeValues: options?.includeEmbedding ?? false,
    };

    // Add namespace filter if specified
    if (options?.filter) {
      queryOptions.filter = options.filter;
    }

    try {
      const result = await ns.query(queryOptions);

      const entries: Array<CacheEntry & { score: number }> = [];

      for (const match of result.matches) {
        // Skip if below similarity threshold
        if (options?.minSimilarity && match.score < options.minSimilarity) {
          continue;
        }

        const metadata = match.metadata as unknown as CacheMetadata;

        if (metadata?.entryData) {
          try {
            const entry = JSON.parse(metadata.entryData) as CacheEntry;

            // Include embedding if requested
            if (options?.includeEmbedding && match.values) {
              entry.embedding = match.values;
            }

            entries.push({
              ...entry,
              score: match.score,
            });
          } catch {
            // Skip malformed entries
          }
        }
      }

      return {
        entries,
        durationMs: performance.now() - startTime,
      };
    } catch (error) {
      return {
        entries: [],
        durationMs: performance.now() - startTime,
      };
    }
  }

  async checkHealth(): Promise<StoreHealth> {
    const startTime = performance.now();

    try {
      if (!this.index) {
        await this.connect();
      }

      await this.index!.describeIndexStats();

      return {
        healthy: true,
        latencyMs: performance.now() - startTime,
        lastCheck: now(),
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: performance.now() - startTime,
        lastCheck: now(),
        error: (error as Error).message,
      };
    }
  }

  close(): Promise<void> {
    // Pinecone client doesn't require explicit cleanup
    this.client = null;
    this.index = null;
    this.ns = null;
    this.connected = false;
    return Promise.resolve();
  }

  /**
   * Check if connected to Pinecone
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get index stats
   */
  async getIndexStats(): Promise<{
    namespaces: Record<string, { recordCount: number }>;
  } | null> {
    if (!this.index) {
      await this.connect();
    }

    try {
      return await this.index!.describeIndexStats();
    } catch {
      return null;
    }
  }
}

/**
 * Create a PineconeCacheStore instance
 */
export function createPineconeCacheStore(
  config: PineconeStoreConfig,
): PineconeCacheStore {
  return new PineconeCacheStore(config);
}
