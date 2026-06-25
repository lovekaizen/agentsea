/**
 * QdrantStore
 *
 * Qdrant vector database adapter.
 */

import { BaseStore } from './BaseStore.js';
import type {
  VectorRecord,
  VectorStoreType,
  QdrantStoreConfig,
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
 * Qdrant vector store
 */
export class QdrantStore extends BaseStore {
  readonly storeType: VectorStoreType = 'qdrant';

  private client: unknown;
  private collectionName: string;
  private url: string;
  private apiKey?: string;
  private initialized = false;

  constructor(config: QdrantStoreConfig) {
    super(config);

    if (!config.url) {
      throw new Error('Qdrant URL is required');
    }
    if (!config.collectionName) {
      throw new Error('Qdrant collection name is required');
    }

    this.url = config.url;
    this.collectionName = config.collectionName;
    this.apiKey = config.apiKey;
  }

  /**
   * Initialize Qdrant client
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      const { QdrantClient } = await import('@qdrant/js-client-rest');

      this.client = new QdrantClient({
        url: this.url,
        apiKey: this.apiKey,
      });

      // Check if collection exists, create if not
      const collections = await (
        this.client as {
          getCollections: () => Promise<{
            collections: Array<{ name: string }>;
          }>;
        }
      ).getCollections();

      const exists = collections.collections.some(
        (c: { name: string }) => c.name === this.collectionName,
      );

      if (!exists && this.dimensions) {
        await (
          this.client as {
            createCollection: (
              name: string,
              params: { vectors: { size: number; distance: string } },
            ) => Promise<void>;
          }
        ).createCollection(this.collectionName, {
          vectors: {
            size: this.dimensions,
            distance: this.metricToQdrant(this.metric),
          },
        });
      }

      this.initialized = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize Qdrant: ${(error as Error).message}`,
      );
    }
  }

  private metricToQdrant(metric: string): string {
    switch (metric) {
      case 'cosine':
        return 'Cosine';
      case 'euclidean':
        return 'Euclid';
      case 'dot_product':
        return 'Dot';
      default:
        return 'Cosine';
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
    const batchSize = options?.batchSize ?? 100;

    const upsertedIds: string[] = [];
    const errors: Array<{ id: string; error: string }> = [];

    // Convert to Qdrant format
    const points = records.map((record) => ({
      id: record.id,
      vector: record.vector,
      payload: {
        ...record.metadata,
        text: record.text,
      },
    }));

    // Batch upsert
    const batches = batch(points, batchSize);
    let completed = 0;

    for (const batchPoints of batches) {
      try {
        await (
          this.client as {
            upsert: (
              name: string,
              params: { points: unknown[] },
            ) => Promise<void>;
          }
        ).upsert(this.collectionName, {
          points: batchPoints,
        });

        upsertedIds.push(...batchPoints.map((p) => p.id));
      } catch (error) {
        for (const p of batchPoints) {
          errors.push({ id: p.id, error: (error as Error).message });
        }
      }

      completed += batchPoints.length;
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
    const topK = options?.topK ?? 10;

    interface QdrantSearchResult {
      id: string;
      score: number;
      payload?: Record<string, unknown>;
      vector?: number[];
    }

    const result = await (
      this.client as {
        search: (
          name: string,
          params: {
            vector: number[];
            limit: number;
            filter?: unknown;
            with_payload?: boolean;
            with_vector?: boolean;
            score_threshold?: number;
          },
        ) => Promise<QdrantSearchResult[]>;
      }
    ).search(this.collectionName, {
      vector,
      limit: topK,
      filter: options?.filter
        ? this.buildQdrantFilter(options.filter)
        : undefined,
      with_payload: options?.includeMetadata ?? true,
      with_vector: options?.includeVectors ?? false,
      score_threshold: options?.minScore,
    });

    const matches = result.map((point: QdrantSearchResult) => ({
      id: point.id.toString(),
      text: (point.payload?.text as string) ?? '',
      score: point.score,
      metadata: point.payload ?? {},
    }));

    return {
      matches,
      namespace: this.collectionName,
      durationMs: performance.now() - startTime,
    };
  }

  private buildQdrantFilter(filter: Record<string, unknown>): unknown {
    const must: unknown[] = [];

    for (const [key, value] of Object.entries(filter)) {
      must.push({
        key,
        match: { value },
      });
    }

    return { must };
  }

  async delete(ids: string[], _options?: DeleteOptions): Promise<DeleteResult> {
    await this.ensureInitialized();
    const startTime = performance.now();

    await (
      this.client as {
        delete: (name: string, params: { points: string[] }) => Promise<void>;
      }
    ).delete(this.collectionName, {
      points: ids,
    });

    // Qdrant's delete does not report how many points actually existed.
    return {
      deletedCount: ids.length,
      requestedCount: ids.length,
      countExact: false,
      durationMs: performance.now() - startTime,
    };
  }

  async deleteAll(_options?: DeleteOptions): Promise<DeleteResult> {
    await this.ensureInitialized();
    const startTime = performance.now();

    // Read the count before clearing so we can report an exact number.
    const before = await this.getStats().catch(() => undefined);

    // Delete collection and recreate
    await (
      this.client as {
        deleteCollection: (name: string) => Promise<void>;
      }
    ).deleteCollection(this.collectionName);

    if (this.dimensions) {
      await (
        this.client as {
          createCollection: (
            name: string,
            params: { vectors: { size: number; distance: string } },
          ) => Promise<void>;
        }
      ).createCollection(this.collectionName, {
        vectors: {
          size: this.dimensions,
          distance: this.metricToQdrant(this.metric),
        },
      });
    }

    return {
      deletedCount: before?.vectorCount ?? 0,
      requestedCount: before?.vectorCount,
      countExact: before !== undefined,
      durationMs: performance.now() - startTime,
    };
  }

  async getStats(): Promise<StoreStats> {
    await this.ensureInitialized();

    interface CollectionInfo {
      vectors_count: number;
      config: {
        params: {
          vectors: {
            size: number;
          };
        };
      };
    }

    const info = await (
      this.client as {
        getCollection: (name: string) => Promise<CollectionInfo>;
      }
    ).getCollection(this.collectionName);

    return {
      type: this.storeType,
      vectorCount: info.vectors_count,
      namespaceCount: 1,
      dimensions: info.config?.params?.vectors?.size,
      metric: this.metric,
      lastUpdated: Date.now(),
    };
  }

  async checkHealth(): Promise<StoreHealth> {
    const startTime = performance.now();

    try {
      await this.ensureInitialized();
      await (
        this.client as {
          getCollection: (name: string) => Promise<unknown>;
        }
      ).getCollection(this.collectionName);

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
    this.initialized = false;
    return Promise.resolve();
  }
}

/**
 * Create a Qdrant store
 */
export function createQdrantStore(config: QdrantStoreConfig): QdrantStore {
  return new QdrantStore(config);
}
