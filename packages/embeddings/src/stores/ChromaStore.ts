/**
 * ChromaStore
 *
 * ChromaDB vector database adapter.
 */

import { BaseStore } from './BaseStore.js';
import type {
  VectorRecord,
  VectorStoreType,
  ChromaStoreConfig,
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

/**
 * ChromaDB vector store
 */
export class ChromaStore extends BaseStore {
  readonly storeType: VectorStoreType = 'chroma';

  private client: unknown;
  private collection: unknown;
  private collectionName: string;
  private url?: string;
  private initialized = false;

  constructor(config: ChromaStoreConfig) {
    super(config);

    if (!config.collectionName) {
      throw new Error('Chroma collection name is required');
    }

    this.collectionName = config.collectionName;
    this.url = config.url;
  }

  /**
   * Initialize ChromaDB client
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      const { ChromaClient } = await import('chromadb');

      this.client = this.url
        ? new ChromaClient({ path: this.url })
        : new ChromaClient();

      // Get or create collection
      this.collection = await (
        this.client as {
          getOrCreateCollection: (params: {
            name: string;
            metadata?: Record<string, unknown>;
          }) => Promise<unknown>;
        }
      ).getOrCreateCollection({
        name: this.collectionName,
        metadata: {
          'hnsw:space': this.metricToChroma(this.metric),
        },
      });

      this.initialized = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize ChromaDB: ${(error as Error).message}`,
      );
    }
  }

  private metricToChroma(metric: string): string {
    switch (metric) {
      case 'cosine':
        return 'cosine';
      case 'euclidean':
        return 'l2';
      case 'dot_product':
        return 'ip';
      default:
        return 'cosine';
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
  }

  async upsert(
    records: VectorRecord[],
    _options?: UpsertOptions,
  ): Promise<UpsertResult> {
    await this.ensureInitialized();
    const startTime = performance.now();

    const ids = records.map((r) => r.id);
    const embeddings = records.map((r) => r.vector);
    const documents = records.map((r) => r.text ?? '');
    const metadatas = records.map((r) => r.metadata ?? {});

    const upsertedIds: string[] = [];
    const errors: Array<{ id: string; error: string }> = [];

    try {
      await (
        this.collection as {
          upsert: (params: {
            ids: string[];
            embeddings: number[][];
            documents?: string[];
            metadatas?: Record<string, unknown>[];
          }) => Promise<void>;
        }
      ).upsert({
        ids,
        embeddings,
        documents,
        metadatas,
      });

      upsertedIds.push(...ids);
    } catch (error) {
      for (const id of ids) {
        errors.push({ id, error: (error as Error).message });
      }
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

    interface ChromaQueryResult {
      ids: string[][];
      distances?: number[][];
      documents?: (string | null)[][];
      metadatas?: (Record<string, unknown> | null)[][];
    }

    const result = await (
      this.collection as {
        query: (params: {
          queryEmbeddings: number[][];
          nResults?: number;
          where?: Record<string, unknown>;
          include?: string[];
        }) => Promise<ChromaQueryResult>;
      }
    ).query({
      queryEmbeddings: [vector],
      nResults: topK,
      where: options?.filter,
      include: ['documents', 'metadatas', 'distances'],
    });

    const matches = (result.ids[0] ?? []).map((id: string, i: number) => {
      const distance = result.distances?.[0]?.[i] ?? 0;
      // Convert distance to similarity score
      const score = 1 / (1 + distance);

      return {
        id,
        text: result.documents?.[0]?.[i] ?? '',
        score,
        metadata: result.metadatas?.[0]?.[i] ?? {},
        distance,
      };
    });

    // Apply minScore filter
    const filtered = options?.minScore
      ? matches.filter((m) => m.score >= options.minScore!)
      : matches;

    return {
      matches: filtered,
      namespace: this.collectionName,
      durationMs: performance.now() - startTime,
    };
  }

  async delete(ids: string[], _options?: DeleteOptions): Promise<DeleteResult> {
    await this.ensureInitialized();
    const startTime = performance.now();

    await (
      this.collection as {
        delete: (params: { ids: string[] }) => Promise<void>;
      }
    ).delete({ ids });

    return {
      deletedCount: ids.length,
      durationMs: performance.now() - startTime,
    };
  }

  async deleteAll(_options?: DeleteOptions): Promise<DeleteResult> {
    await this.ensureInitialized();
    const startTime = performance.now();

    // Delete and recreate collection
    await (
      this.client as {
        deleteCollection: (params: { name: string }) => Promise<void>;
      }
    ).deleteCollection({ name: this.collectionName });

    this.collection = await (
      this.client as {
        createCollection: (params: {
          name: string;
          metadata?: Record<string, unknown>;
        }) => Promise<unknown>;
      }
    ).createCollection({
      name: this.collectionName,
      metadata: {
        'hnsw:space': this.metricToChroma(this.metric),
      },
    });

    return {
      deletedCount: -1,
      durationMs: performance.now() - startTime,
    };
  }

  async getStats(): Promise<StoreStats> {
    await this.ensureInitialized();

    const count = await (
      this.collection as {
        count: () => Promise<number>;
      }
    ).count();

    return {
      type: this.storeType,
      vectorCount: count,
      namespaceCount: 1,
      dimensions: this.dimensions ?? 0,
      metric: this.metric,
      lastUpdated: Date.now(),
    };
  }

  async checkHealth(): Promise<StoreHealth> {
    const startTime = performance.now();

    try {
      await this.ensureInitialized();
      await (this.collection as { count: () => Promise<number> }).count();

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
 * Create a Chroma store
 */
export function createChromaStore(config: ChromaStoreConfig): ChromaStore {
  return new ChromaStore(config);
}
