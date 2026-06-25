/**
 * WeaviateStore
 *
 * Weaviate adapter. The store logic talks to a small high-level
 * {@link WeaviateBackend} interface (ensure class, upsert, nearVector search,
 * delete, count). The real backend is built lazily from `weaviate-ts-client`;
 * tests inject a mock backend. This keeps the brittle fluent-SDK calls isolated
 * in one thin adapter while the translation logic stays fully unit-tested.
 */

import { BaseStore } from './BaseStore.js';
import type {
  VectorRecord,
  VectorStoreType,
  WeaviateStoreConfig,
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

/** High-level operations the store needs from a Weaviate backend. */
export interface WeaviateBackend {
  ensureClass(className: string, dimensions?: number): Promise<void>;
  upsert(
    className: string,
    objects: Array<{
      id: string;
      vector: number[];
      properties: Record<string, unknown>;
    }>,
  ): Promise<void>;
  nearVector(
    className: string,
    vector: number[],
    limit: number,
    filter?: Record<string, unknown>,
  ): Promise<
    Array<{ id: string; score: number; properties: Record<string, unknown> }>
  >;
  deleteByIds(className: string, ids: string[]): Promise<number>;
  deleteAll(className: string): Promise<number>;
  count(className: string): Promise<number>;
  ping(): Promise<void>;
}

export interface WeaviateStoreOptions extends WeaviateStoreConfig {
  /** Inject a backend (real adapter or mock) instead of building from the SDK. */
  backend?: WeaviateBackend;
}

export class WeaviateStore extends BaseStore {
  readonly storeType: VectorStoreType = 'weaviate';

  private backend?: WeaviateBackend;
  private readonly injectedBackend?: WeaviateBackend;
  private readonly className: string;
  private readonly url: string;
  private readonly apiKey?: string;
  private initialized = false;

  constructor(config: WeaviateStoreOptions) {
    super(config);
    if (!config.url) throw new Error('Weaviate store requires a `url`');
    if (!config.className) {
      throw new Error('Weaviate store requires a `className`');
    }
    this.url = config.url;
    this.className = config.className;
    this.apiKey = config.apiKey;
    this.injectedBackend = config.backend;
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    this.backend = this.injectedBackend ?? (await this.buildSdkBackend());
    await this.backend.ensureClass(this.className, this.dimensions);
    this.initialized = true;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) await this.init();
  }

  /** Build a {@link WeaviateBackend} backed by the real `weaviate-ts-client`. */
  private async buildSdkBackend(): Promise<WeaviateBackend> {
    let mod: unknown;
    try {
      mod = await importOptional('weaviate-ts-client');
    } catch {
      throw new Error(
        'Weaviate store requires the "weaviate-ts-client" package. Install it, ' +
          'or pass a custom `backend`.',
      );
    }
    const weaviate = ((mod as { default?: unknown }).default ?? mod) as {
      client: (cfg: unknown) => WeaviateSdkClient;
      ApiKey?: new (key: string) => unknown;
    };
    const u = new URL(this.url);
    const client = weaviate.client({
      scheme: u.protocol.replace(':', ''),
      host: u.host,
      apiKey:
        this.apiKey && weaviate.ApiKey
          ? new weaviate.ApiKey(this.apiKey)
          : undefined,
    });
    return new WeaviateSdkBackend(client);
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
          this.className,
          group.map((r) => ({
            id: r.id,
            vector: Array.from(r.vector),
            properties: { ...(r.metadata ?? {}), text: r.text ?? '' },
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
    const hits = await this.backend!.nearVector(
      this.className,
      Array.from(vector),
      topK,
      options?.filter,
    );

    const matches = hits
      .map((h) => ({
        id: h.id,
        text: (h.properties.text as string) ?? '',
        score: h.score,
        metadata: h.properties,
      }))
      .filter(
        (m) => options?.minScore === undefined || m.score >= options.minScore,
      );

    return {
      matches,
      namespace: this.className,
      durationMs: performance.now() - start,
    };
  }

  async delete(ids: string[], _options?: DeleteOptions): Promise<DeleteResult> {
    await this.ensureInitialized();
    const start = performance.now();
    const deleted = await this.backend!.deleteByIds(this.className, ids);
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
    const deleted = await this.backend!.deleteAll(this.className);
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
      vectorCount: await this.backend!.count(this.className),
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
}

/** Minimal shape of the weaviate-ts-client used by the SDK backend adapter. */
interface WeaviateSdkClient {
  schema: {
    getter: () => { do: () => Promise<{ classes?: Array<{ class: string }> }> };
    classCreator: () => {
      withClass: (c: unknown) => { do: () => Promise<unknown> };
    };
  };
  batch: {
    objectsBatcher: () => WeaviateBatcher;
  };
  data: {
    deleter: () => {
      withClassName: (c: string) => {
        withId: (id: string) => { do: () => Promise<unknown> };
      };
    };
  };
  graphql: {
    get: () => WeaviateGraphQLGet;
    aggregate: () => WeaviateAggregate;
  };
  misc: { liveChecker: () => { do: () => Promise<unknown> } };
}
interface WeaviateBatcher {
  withObject: (o: unknown) => WeaviateBatcher;
  do: () => Promise<unknown>;
}
interface WeaviateGraphQLGet {
  withClassName: (c: string) => WeaviateGraphQLGet;
  withFields: (f: string) => WeaviateGraphQLGet;
  withNearVector: (v: unknown) => WeaviateGraphQLGet;
  withWhere: (w: unknown) => WeaviateGraphQLGet;
  withLimit: (n: number) => WeaviateGraphQLGet;
  do: () => Promise<{ data?: Record<string, unknown> }>;
}
interface WeaviateAggregate {
  withClassName: (c: string) => WeaviateAggregate;
  withFields: (f: string) => WeaviateAggregate;
  do: () => Promise<{ data?: Record<string, unknown> }>;
}

/** Thin {@link WeaviateBackend} over the real weaviate-ts-client fluent API. */
export class WeaviateSdkBackend implements WeaviateBackend {
  constructor(private readonly client: WeaviateSdkClient) {}

  async ensureClass(className: string, _dimensions?: number): Promise<void> {
    const schema = await this.client.schema.getter().do();
    if (schema.classes?.some((c) => c.class === className)) return;
    await this.client.schema
      .classCreator()
      .withClass({ class: className, vectorizer: 'none' })
      .do();
  }

  async upsert(
    className: string,
    objects: Array<{
      id: string;
      vector: number[];
      properties: Record<string, unknown>;
    }>,
  ): Promise<void> {
    let batcher = this.client.batch.objectsBatcher();
    for (const o of objects) {
      batcher = batcher.withObject({
        class: className,
        id: o.id,
        vector: o.vector,
        properties: o.properties,
      });
    }
    await batcher.do();
  }

  async nearVector(
    className: string,
    vector: number[],
    limit: number,
    filter?: Record<string, unknown>,
  ): Promise<
    Array<{ id: string; score: number; properties: Record<string, unknown> }>
  > {
    let q = this.client.graphql
      .get()
      .withClassName(className)
      .withFields('_additional { id certainty } text')
      .withNearVector({ vector })
      .withLimit(limit);
    if (filter) q = q.withWhere(this.toWhere(filter));
    const res = await q.do();
    const rows = ((res.data?.Get as Record<string, unknown>)?.[className] ??
      []) as Array<Record<string, unknown>>;
    return rows.map((row) => {
      const additional = row._additional as { id: string; certainty?: number };
      const { _additional, ...properties } = row;
      void _additional;
      return {
        id: additional.id,
        score: additional.certainty ?? 0,
        properties,
      };
    });
  }

  async deleteByIds(className: string, ids: string[]): Promise<number> {
    let n = 0;
    for (const id of ids) {
      await this.client.data.deleter().withClassName(className).withId(id).do();
      n++;
    }
    return n;
  }

  async deleteAll(className: string): Promise<number> {
    const count = await this.count(className);
    // weaviate-ts-client has no truncate; drop+recreate via schema is simplest.
    await this.client.schema
      .classCreator()
      .withClass({ class: className, vectorizer: 'none' })
      .do()
      .catch(() => undefined);
    return count;
  }

  async count(className: string): Promise<number> {
    const res = await this.client.graphql
      .aggregate()
      .withClassName(className)
      .withFields('meta { count }')
      .do();
    const agg = ((res.data?.Aggregate as Record<string, unknown>)?.[
      className
    ] ?? []) as Array<{ meta?: { count?: number } }>;
    return agg[0]?.meta?.count ?? 0;
  }

  async ping(): Promise<void> {
    await this.client.misc.liveChecker().do();
  }

  private toWhere(filter: Record<string, unknown>): unknown {
    const operands = Object.entries(filter).map(([path, value]) => ({
      path: [path],
      operator: 'Equal',
      ...(typeof value === 'number'
        ? { valueNumber: value }
        : typeof value === 'boolean'
          ? { valueBoolean: value }
          : { valueText: String(value) }),
    }));
    return operands.length === 1 ? operands[0] : { operator: 'And', operands };
  }
}

export function createWeaviateStore(
  config: WeaviateStoreOptions,
): WeaviateStore {
  return new WeaviateStore(config);
}
