/**
 * PineconeStore
 *
 * Pinecone vector database adapter.
 */

import { BaseStore } from './BaseStore.js';
import type {
  VectorRecord,
  VectorStoreType,
  PineconeStoreConfig,
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
import { batch } from '../core/utils.js';

/**
 * Pinecone vector store
 */
export class PineconeStore extends BaseStore {
  readonly storeType: VectorStoreType = 'pinecone';

  private client: unknown;
  private index: unknown;
  private apiKey: string;
  private indexName: string;
  private initialized = false;

  constructor(config: PineconeStoreConfig) {
    super(config);

    if (!config.apiKey) {
      throw new Error('Pinecone API key is required');
    }
    if (!config.indexName) {
      throw new Error('Pinecone index name is required');
    }

    this.apiKey = config.apiKey;
    this.indexName = config.indexName;
  }

  /**
   * Initialize Pinecone client
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      const { Pinecone } = await import('@pinecone-database/pinecone');
      this.client = new Pinecone({ apiKey: this.apiKey });
      this.index = (this.client as { index: (name: string) => unknown }).index(
        this.indexName,
      );
      this.initialized = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize Pinecone: ${(error as Error).message}`,
      );
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
  }

  async upsert(
    records: VectorRecord[],
    options?: UpsertOptions,
  ): Promise<UpsertResult> {
    await this.ensureInitialized();
    const startTime = performance.now();
    const namespace = options?.namespace ?? this.namespace;
    const batchSize = options?.batchSize ?? 100;

    const upsertedIds: string[] = [];
    const errors: Array<{ id: string; error: string }> = [];

    // Convert to Pinecone format
    const vectors = records.map((record) => ({
      id: record.id,
      values: record.vector,
      metadata: {
        ...record.metadata,
        text: record.text,
      },
    }));

    // Batch upsert
    const batches = batch(vectors, batchSize);
    let completed = 0;

    for (const batchVectors of batches) {
      try {
        const ns = (
          this.index as { namespace: (ns: string) => unknown }
        ).namespace(namespace);
        await (ns as { upsert: (vectors: unknown[]) => Promise<void> }).upsert(
          batchVectors,
        );
        upsertedIds.push(...batchVectors.map((v) => v.id));
      } catch (error) {
        for (const v of batchVectors) {
          errors.push({ id: v.id, error: (error as Error).message });
        }
      }

      completed += batchVectors.length;
      options?.onProgress?.({ completed, total: records.length });
    }

    return {
      upsertedIds,
      upsertedCount: upsertedIds.length,
      errors,
      durationMs: performance.now() - startTime,
    };
  }

  async query(
    vector: EmbeddingVector,
    options?: StoreQueryOptions,
  ): Promise<StoreQueryResult> {
    await this.ensureInitialized();
    const startTime = performance.now();
    const namespace = options?.namespace ?? this.namespace;
    const topK = options?.topK ?? 10;

    const ns = (this.index as { namespace: (ns: string) => unknown }).namespace(
      namespace,
    );

    interface PineconeMatch {
      id: string;
      score: number;
      values?: number[];
      metadata?: Record<string, unknown>;
    }

    interface PineconeQueryResult {
      matches: PineconeMatch[];
    }

    const result = await (
      ns as {
        query: (params: {
          vector: number[];
          topK: number;
          filter?: Record<string, unknown>;
          includeValues?: boolean;
          includeMetadata?: boolean;
        }) => Promise<PineconeQueryResult>;
      }
    ).query({
      vector,
      topK,
      filter: options?.filter,
      includeValues: options?.includeVectors ?? false,
      includeMetadata: options?.includeMetadata ?? true,
    });

    const matches = result.matches.map((match: PineconeMatch) => ({
      id: match.id,
      text: (match.metadata?.text as string) ?? '',
      score: match.score,
      metadata: match.metadata ?? {},
    }));

    // Apply minScore filter
    const filtered = options?.minScore
      ? matches.filter((m) => m.score >= options.minScore!)
      : matches;

    return {
      matches: filtered,
      namespace,
      durationMs: performance.now() - startTime,
    };
  }

  async delete(ids: string[], options?: DeleteOptions): Promise<DeleteResult> {
    await this.ensureInitialized();
    const startTime = performance.now();
    const namespace = options?.namespace ?? this.namespace;

    const ns = (this.index as { namespace: (ns: string) => unknown }).namespace(
      namespace,
    );
    await (ns as { deleteMany: (ids: string[]) => Promise<void> }).deleteMany(
      ids,
    );

    return {
      deletedCount: ids.length,
      durationMs: performance.now() - startTime,
    };
  }

  async deleteAll(options?: DeleteOptions): Promise<DeleteResult> {
    await this.ensureInitialized();
    const startTime = performance.now();
    const namespace = options?.namespace ?? this.namespace;

    const ns = (this.index as { namespace: (ns: string) => unknown }).namespace(
      namespace,
    );
    await (ns as { deleteAll: () => Promise<void> }).deleteAll();

    return {
      deletedCount: -1, // Unknown count
      durationMs: performance.now() - startTime,
    };
  }

  async getStats(): Promise<StoreStats> {
    await this.ensureInitialized();

    interface IndexStats {
      namespaces: Record<string, { vectorCount: number }>;
      dimension: number;
      totalVectorCount: number;
    }

    const stats = await (
      this.index as { describeIndexStats: () => Promise<IndexStats> }
    ).describeIndexStats();

    return {
      type: this.storeType,
      vectorCount: stats.totalVectorCount ?? 0,
      namespaceCount: Object.keys(stats.namespaces ?? {}).length,
      dimensions: stats.dimension,
      metric: this.metric,
      lastUpdated: Date.now(),
    };
  }

  async checkHealth(): Promise<StoreHealth> {
    const startTime = performance.now();

    try {
      await this.ensureInitialized();
      await (
        this.index as { describeIndexStats: () => Promise<unknown> }
      ).describeIndexStats();

      return {
        healthy: true,
        latencyMs: performance.now() - startTime,
        lastCheck: Date.now(),
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: performance.now() - startTime,
        lastCheck: Date.now(),
        error: (error as Error).message,
      };
    }
  }

  async close(): Promise<void> {
    // Pinecone client doesn't require explicit closing
    this.initialized = false;
    return Promise.resolve();
  }
}

/**
 * Create a Pinecone store
 */
export function createPineconeStore(
  config: PineconeStoreConfig,
): PineconeStore {
  return new PineconeStore(config);
}
