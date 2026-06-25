/**
 * MilvusStore
 *
 * Milvus / Zilliz adapter. As with the Weaviate store, the translation logic
 * talks to a small high-level {@link MilvusBackend}; the real backend wraps
 * `@zilliz/milvus2-sdk-node` and is built lazily, while tests inject a mock.
 */

import { BaseStore } from './BaseStore.js';
import type {
  VectorRecord,
  VectorStoreType,
  MilvusStoreConfig,
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
import { importOptional } from '../core/optional-import.js';

/** High-level operations the store needs from a Milvus backend. */
export interface MilvusBackend {
  ensureCollection(
    collection: string,
    dimensions: number,
    metric: string,
  ): Promise<void>;
  upsert(
    collection: string,
    rows: Array<{
      id: string;
      vector: number[];
      text: string;
      metadata: Record<string, unknown>;
    }>,
  ): Promise<void>;
  search(
    collection: string,
    vector: number[],
    limit: number,
    filter?: string,
  ): Promise<
    Array<{
      id: string;
      score: number;
      text: string;
      metadata: Record<string, unknown>;
    }>
  >;
  deleteByIds(collection: string, ids: string[]): Promise<number>;
  deleteAll(collection: string): Promise<number>;
  count(collection: string): Promise<number>;
  ping(): Promise<void>;
}

export interface MilvusStoreOptions extends MilvusStoreConfig {
  /** Inject a backend (real adapter or mock) instead of building from the SDK. */
  backend?: MilvusBackend;
}

export class MilvusStore extends BaseStore {
  readonly storeType: VectorStoreType = 'milvus';

  private backend?: MilvusBackend;
  private readonly injectedBackend?: MilvusBackend;
  private readonly collection: string;
  private readonly milvusConfig: MilvusStoreConfig;
  private initialized = false;

  constructor(config: MilvusStoreOptions) {
    super(config);
    if (!config.url) throw new Error('Milvus store requires a `url`');
    if (!config.collectionName) {
      throw new Error('Milvus store requires a `collectionName`');
    }
    if (!config.dimensions) {
      throw new Error('Milvus store requires `dimensions`');
    }
    this.milvusConfig = config;
    this.collection = config.collectionName;
    this.injectedBackend = config.backend;
  }

  /** Milvus metric type string for the configured distance metric. */
  private get metricType(): string {
    switch (this.metric) {
      case 'euclidean':
        return 'L2';
      case 'dot_product':
        return 'IP';
      case 'cosine':
      default:
        return 'COSINE';
    }
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    this.backend = this.injectedBackend ?? (await this.buildSdkBackend());
    await this.backend.ensureCollection(
      this.collection,
      this.dimensions!,
      this.metricType,
    );
    this.initialized = true;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) await this.init();
  }

  private async buildSdkBackend(): Promise<MilvusBackend> {
    let mod: unknown;
    try {
      mod = await importOptional('@zilliz/milvus2-sdk-node');
    } catch {
      throw new Error(
        'Milvus store requires the "@zilliz/milvus2-sdk-node" package. ' +
          'Install it, or pass a custom `backend`.',
      );
    }
    const sdk = mod as {
      MilvusClient: new (cfg: unknown) => MilvusSdkClient;
    };
    const client = new sdk.MilvusClient({
      address: this.milvusConfig.url,
      username: this.milvusConfig.username,
      password: this.milvusConfig.password,
    });
    return new MilvusSdkBackend(client);
  }

  async upsert(
    records: VectorRecord[],
    options?: UpsertOptions,
  ): Promise<UpsertResult> {
    await this.ensureInitialized();
    const start = performance.now();
    const batchSize = options?.batchSize ?? 100;
    const upsertedIds: string[] = [];
    const errors: Array<{ id: string; error: string }> = [];
    let completed = 0;

    for (const group of batch(records, batchSize)) {
      try {
        await this.backend!.upsert(
          this.collection,
          group.map((r) => ({
            id: r.id,
            vector: Array.from(r.vector),
            text: r.text ?? '',
            metadata: r.metadata ?? {},
          })),
        );
        upsertedIds.push(...group.map((r) => r.id));
      } catch (e) {
        for (const r of group)
          errors.push({ id: r.id, error: (e as Error).message });
      }
      completed += group.length;
      options?.onProgress?.({ completed, total: records.length });
    }

    return {
      upsertedIds,
      upsertedCount: upsertedIds.length,
      errors,
      durationMs: performance.now() - start,
    };
  }

  async query(
    vector: EmbeddingVector,
    options?: StoreQueryOptions,
  ): Promise<StoreQueryResult> {
    await this.ensureInitialized();
    const start = performance.now();
    const topK = options?.topK ?? 10;
    const hits = await this.backend!.search(
      this.collection,
      Array.from(vector),
      topK,
      options?.filter ? this.toExpr(options.filter) : undefined,
    );

    const matches = hits
      .map((h) => ({
        id: h.id,
        text: h.text,
        score: h.score,
        metadata: h.metadata,
      }))
      .filter(
        (m) => options?.minScore === undefined || m.score >= options.minScore,
      );

    return {
      matches,
      namespace: this.collection,
      durationMs: performance.now() - start,
    };
  }

  async delete(ids: string[], _options?: DeleteOptions): Promise<DeleteResult> {
    await this.ensureInitialized();
    const start = performance.now();
    const deleted = await this.backend!.deleteByIds(this.collection, ids);
    return {
      deletedCount: deleted,
      requestedCount: ids.length,
      countExact: true,
      durationMs: performance.now() - start,
    };
  }

  async deleteAll(_options?: DeleteOptions): Promise<DeleteResult> {
    await this.ensureInitialized();
    const start = performance.now();
    const deleted = await this.backend!.deleteAll(this.collection);
    return {
      deletedCount: deleted,
      requestedCount: deleted,
      countExact: true,
      durationMs: performance.now() - start,
    };
  }

  async getStats(): Promise<StoreStats> {
    await this.ensureInitialized();
    return {
      type: this.storeType,
      vectorCount: await this.backend!.count(this.collection),
      namespaceCount: 1,
      dimensions: this.dimensions ?? 0,
      metric: this.metric,
      lastUpdated: Date.now(),
    };
  }

  async checkHealth(): Promise<StoreHealth> {
    const start = performance.now();
    try {
      await this.ensureInitialized();
      await this.backend!.ping();
      return {
        healthy: true,
        latencyMs: performance.now() - start,
        lastCheck: Date.now(),
      };
    } catch (e) {
      return {
        healthy: false,
        latencyMs: performance.now() - start,
        lastCheck: Date.now(),
        error: (e as Error).message,
      };
    }
  }

  close(): Promise<void> {
    this.initialized = false;
    return Promise.resolve();
  }

  /** Translate a flat equality filter to a Milvus boolean expression. */
  private toExpr(filter: Record<string, unknown>): string {
    return Object.entries(filter)
      .map(([k, v]) =>
        typeof v === 'number'
          ? `metadata["${k}"] == ${v}`
          : `metadata["${k}"] == "${String(v)}"`,
      )
      .join(' && ');
  }
}

/** Minimal shape of the milvus2-sdk-node client used by the SDK backend. */
interface MilvusSdkClient {
  hasCollection(p: { collection_name: string }): Promise<{ value: boolean }>;
  createCollection(p: unknown): Promise<unknown>;
  createIndex(p: unknown): Promise<unknown>;
  loadCollectionSync(p: { collection_name: string }): Promise<unknown>;
  insert(p: { collection_name: string; data: unknown[] }): Promise<unknown>;
  search(p: unknown): Promise<{ results: Array<Record<string, unknown>> }>;
  deleteEntities(p: {
    collection_name: string;
    expr: string;
  }): Promise<unknown>;
  getCollectionStatistics(p: {
    collection_name: string;
  }): Promise<{ data?: { row_count?: string | number } }>;
}

/** Thin {@link MilvusBackend} over the real milvus2-sdk-node client. */
export class MilvusSdkBackend implements MilvusBackend {
  constructor(private readonly client: MilvusSdkClient) {}

  async ensureCollection(
    collection: string,
    dimensions: number,
    metric: string,
  ): Promise<void> {
    const has = await this.client.hasCollection({
      collection_name: collection,
    });
    if (!has.value) {
      await this.client.createCollection({
        collection_name: collection,
        fields: [
          {
            name: 'id',
            data_type: 'VarChar',
            is_primary_key: true,
            max_length: 512,
          },
          { name: 'vector', data_type: 'FloatVector', dim: dimensions },
          { name: 'text', data_type: 'VarChar', max_length: 65535 },
          { name: 'metadata', data_type: 'JSON' },
        ],
      });
      await this.client.createIndex({
        collection_name: collection,
        field_name: 'vector',
        index_type: 'HNSW',
        metric_type: metric,
        params: { M: 16, efConstruction: 200 },
      });
    }
    await this.client.loadCollectionSync({ collection_name: collection });
  }

  async upsert(
    collection: string,
    rows: Array<{
      id: string;
      vector: number[];
      text: string;
      metadata: Record<string, unknown>;
    }>,
  ): Promise<void> {
    await this.client.insert({
      collection_name: collection,
      data: rows.map((r) => ({
        id: r.id,
        vector: r.vector,
        text: r.text,
        metadata: r.metadata,
      })),
    });
  }

  async search(
    collection: string,
    vector: number[],
    limit: number,
    filter?: string,
  ): Promise<
    Array<{
      id: string;
      score: number;
      text: string;
      metadata: Record<string, unknown>;
    }>
  > {
    const res = await this.client.search({
      collection_name: collection,
      data: [vector],
      limit,
      filter,
      output_fields: ['text', 'metadata'],
    });
    return res.results.map((r) => ({
      id: String(r.id),
      score: Number(r.score),
      text: (r.text as string) ?? '',
      metadata: (r.metadata as Record<string, unknown>) ?? {},
    }));
  }

  async deleteByIds(collection: string, ids: string[]): Promise<number> {
    const list = ids.map((id) => `"${id}"`).join(', ');
    await this.client.deleteEntities({
      collection_name: collection,
      expr: `id in [${list}]`,
    });
    return ids.length;
  }

  async deleteAll(collection: string): Promise<number> {
    const count = await this.count(collection);
    await this.client.deleteEntities({
      collection_name: collection,
      expr: 'id != ""',
    });
    return count;
  }

  async count(collection: string): Promise<number> {
    const stats = await this.client.getCollectionStatistics({
      collection_name: collection,
    });
    return Number(stats.data?.row_count ?? 0);
  }

  async ping(): Promise<void> {
    await this.client.hasCollection({ collection_name: '__ping__' });
  }
}

export function createMilvusStore(config: MilvusStoreOptions): MilvusStore {
  return new MilvusStore(config);
}
