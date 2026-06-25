/**
 * PgVectorStore
 *
 * PostgreSQL + pgvector adapter. Stores each vector as a row with a `vector`
 * column and a JSONB metadata column, and performs nearest-neighbour search
 * with pgvector's distance operators (`<=>` cosine, `<->` L2, `<#>` inner
 * product). The `pg` driver is an optional dependency, imported lazily.
 */

import { BaseStore } from './BaseStore.js';
import type {
  VectorRecord,
  VectorStoreType,
  PgVectorStoreConfig,
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

/** Minimal structural contract for the `pg` Pool used by this store. */
export interface PgPoolLike {
  query(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: Array<Record<string, unknown>>; rowCount: number | null }>;
  end(): Promise<void>;
}

/** Config plus an optional pre-built pool for DI / testing. */
export interface PgVectorStoreOptions extends PgVectorStoreConfig {
  /** Inject a pre-built `pg` Pool (or compatible) instead of constructing one. */
  pool?: PgPoolLike;
}

export class PgVectorStore extends BaseStore {
  readonly storeType: VectorStoreType = 'pgvector';

  private pool?: PgPoolLike;
  private readonly injectedPool?: PgPoolLike;
  private readonly table: string;
  private readonly vectorColumn: string;
  private readonly contentColumn: string;
  private readonly metadataColumn: string;
  private readonly pgConfig: PgVectorStoreConfig;
  private initialized = false;

  constructor(config: PgVectorStoreOptions) {
    super(config);
    if (!config.tableName) {
      throw new Error('pgvector store requires a `tableName`');
    }
    this.pgConfig = config;
    this.injectedPool = config.pool;
    this.table = config.tableName;
    this.vectorColumn = config.vectorColumn ?? 'embedding';
    this.contentColumn = config.contentColumn ?? 'content';
    this.metadataColumn = config.metadataColumn ?? 'metadata';
  }

  /** The pgvector distance operator for the configured metric. */
  private get distanceOperator(): string {
    switch (this.metric) {
      case 'euclidean':
        return '<->';
      case 'dot_product':
        return '<#>';
      case 'cosine':
      default:
        return '<=>';
    }
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    if (this.injectedPool) {
      this.pool = this.injectedPool;
    } else {
      let mod: unknown;
      try {
        mod = await importOptional('pg');
      } catch {
        throw new Error(
          'pgvector store requires the "pg" package. Install it, or pass a ' +
            'pre-built `pool` to the store.',
        );
      }
      const pg = (mod as { default?: unknown }).default ?? mod;
      const Pool = (pg as { Pool: new (cfg: unknown) => PgPoolLike }).Pool;
      this.pool = new Pool(
        this.pgConfig.connectionString
          ? { connectionString: this.pgConfig.connectionString }
          : {
              host: this.pgConfig.host,
              port: this.pgConfig.port,
              database: this.pgConfig.database,
              user: this.pgConfig.user,
              password: this.pgConfig.password,
            },
      );
    }

    // Ensure the extension, table, and an ANN index exist.
    await this.pool.query('CREATE EXTENSION IF NOT EXISTS vector');
    const dims = this.dimensions;
    const vectorType = dims ? `vector(${dims})` : 'vector';
    await this.pool.query(
      `CREATE TABLE IF NOT EXISTS ${this.ident(this.table)} (
        id text PRIMARY KEY,
        ${this.ident(this.contentColumn)} text,
        ${this.ident(this.metadataColumn)} jsonb,
        ${this.ident(this.vectorColumn)} ${vectorType}
      )`,
    );

    this.initialized = true;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) await this.init();
  }

  /** Quote an SQL identifier to guard against injection via config names. */
  private ident(name: string): string {
    return `"${name.replace(/"/g, '""')}"`;
  }

  private toVectorLiteral(vector: EmbeddingVector): string {
    return `[${Array.from(vector).join(',')}]`;
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
      for (const record of group) {
        try {
          await this.pool!.query(
            `INSERT INTO ${this.ident(this.table)} (id, ${this.ident(this.contentColumn)}, ${this.ident(this.metadataColumn)}, ${this.ident(this.vectorColumn)})
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (id) DO UPDATE SET
               ${this.ident(this.contentColumn)} = EXCLUDED.${this.ident(this.contentColumn)},
               ${this.ident(this.metadataColumn)} = EXCLUDED.${this.ident(this.metadataColumn)},
               ${this.ident(this.vectorColumn)} = EXCLUDED.${this.ident(this.vectorColumn)}`,
            [
              record.id,
              record.text ?? null,
              JSON.stringify(record.metadata ?? {}),
              this.toVectorLiteral(record.vector),
            ],
          );
          upsertedIds.push(record.id);
        } catch (e) {
          errors.push({ id: record.id, error: (e as Error).message });
        }
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
    const params: unknown[] = [this.toVectorLiteral(vector)];

    // Optional exact-match metadata filtering via JSONB containment.
    let where = '';
    if (options?.filter && Object.keys(options.filter).length > 0) {
      params.push(JSON.stringify(options.filter));
      where = `WHERE ${this.ident(this.metadataColumn)} @> $${params.length}::jsonb`;
    }
    params.push(topK);

    const op = this.distanceOperator;
    const sql =
      `SELECT id, ${this.ident(this.contentColumn)} AS content, ${this.ident(this.metadataColumn)} AS metadata, ` +
      `${this.ident(this.vectorColumn)} ${op} $1 AS distance ` +
      `FROM ${this.ident(this.table)} ${where} ` +
      `ORDER BY ${this.ident(this.vectorColumn)} ${op} $1 ASC LIMIT $${params.length}`;

    const result = await this.pool!.query(sql, params);

    const matches = result.rows
      .map((row) => {
        const distance = Number(row.distance);
        // For cosine distance, similarity = 1 - distance.
        const score =
          this.metric === 'cosine' ? 1 - distance : 1 / (1 + distance);
        return {
          id: String(row.id),
          text: (row.content as string) ?? '',
          score,
          distance,
          metadata: (row.metadata as Record<string, unknown>) ?? {},
        };
      })
      .filter(
        (m) => options?.minScore === undefined || m.score >= options.minScore,
      );

    return {
      matches,
      namespace: this.namespace,
      durationMs: performance.now() - start,
    };
  }

  async delete(ids: string[], _options?: DeleteOptions): Promise<DeleteResult> {
    await this.ensureInitialized();
    const start = performance.now();
    const result = await this.pool!.query(
      `DELETE FROM ${this.ident(this.table)} WHERE id = ANY($1)`,
      [ids],
    );
    const deleted = result.rowCount ?? ids.length;
    return {
      deletedCount: deleted,
      requestedCount: ids.length,
      countExact: result.rowCount !== null,
      durationMs: performance.now() - start,
    };
  }

  async deleteAll(_options?: DeleteOptions): Promise<DeleteResult> {
    await this.ensureInitialized();
    const start = performance.now();
    const result = await this.pool!.query(
      `DELETE FROM ${this.ident(this.table)}`,
    );
    return {
      deletedCount: result.rowCount ?? 0,
      requestedCount: result.rowCount ?? undefined,
      countExact: result.rowCount !== null,
      durationMs: performance.now() - start,
    };
  }

  async getStats(): Promise<StoreStats> {
    await this.ensureInitialized();
    const result = await this.pool!.query(
      `SELECT COUNT(*)::int AS count FROM ${this.ident(this.table)}`,
    );
    const vectorCount = Number(result.rows[0]?.count ?? 0);
    return {
      type: this.storeType,
      vectorCount,
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
      await this.pool!.query('SELECT 1');
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

  async close(): Promise<void> {
    // Only close pools we created ourselves; an injected pool is caller-owned.
    if (this.pool && !this.injectedPool) {
      await this.pool.end();
    }
    this.initialized = false;
  }
}

export function createPgVectorStore(
  config: PgVectorStoreOptions,
): PgVectorStore {
  return new PgVectorStore(config);
}
