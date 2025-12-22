/**
 * SQLiteCacheStore
 *
 * SQLite-based cache store with optional vector search support.
 */

import { BaseCacheStore } from './BaseCacheStore.js';
import type {
  CacheEntry,
  CacheBackendType,
  SQLiteStoreConfig,
  StoreHealth,
  StoreQueryOptions,
  StoreQueryResult,
  UpsertResult,
} from '../types/index.js';
import { now } from '../core/utils.js';
import { cosineSimilarity } from '../similarity/metrics/SimilarityMetrics.js';

/**
 * SQLite database interface (compatible with better-sqlite3)
 */
interface Database {
  prepare(sql: string): Statement;
  exec(sql: string): void;
  close(): void;
}

interface Statement {
  run(...params: unknown[]): { changes: number };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Partial<SQLiteStoreConfig> = {
  dbPath: 'cache.db',
  inMemory: false,
  enableVector: false,
};

/**
 * SQLiteCacheStore
 *
 * SQLite-based cache store for persistent local caching.
 * Supports optional vector search for semantic matching.
 *
 * @example
 * ```typescript
 * const store = new SQLiteCacheStore({
 *   type: 'sqlite',
 *   dbPath: './cache.db'
 * });
 *
 * await store.init();
 * await store.set('key', entry);
 * ```
 */
export class SQLiteCacheStore extends BaseCacheStore {
  readonly storeType: CacheBackendType = 'sqlite';

  private db: Database | null = null;
  private sqliteConfig: SQLiteStoreConfig;
  private initialized = false;

  constructor(config: SQLiteStoreConfig) {
    super(config);
    this.sqliteConfig = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the database
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      const BetterSqlite3 = (await import('better-sqlite3')).default;

      const db = new BetterSqlite3(
        this.sqliteConfig.inMemory
          ? ':memory:'
          : (this.sqliteConfig.dbPath ?? 'cache.db'),
      );
      this.db = db;

      // Create tables
      db.exec(`
        CREATE TABLE IF NOT EXISTS cache_entries (
          key TEXT PRIMARY KEY,
          id TEXT NOT NULL,
          data TEXT NOT NULL,
          embedding BLOB,
          model TEXT NOT NULL,
          namespace TEXT,
          created_at INTEGER NOT NULL,
          accessed_at INTEGER NOT NULL,
          ttl INTEGER DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_namespace ON cache_entries(namespace);
        CREATE INDEX IF NOT EXISTS idx_model ON cache_entries(model);
        CREATE INDEX IF NOT EXISTS idx_created_at ON cache_entries(created_at);
        CREATE INDEX IF NOT EXISTS idx_accessed_at ON cache_entries(accessed_at);
      `);

      this.initialized = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize SQLite database: ${(error as Error).message}`,
      );
    }
  }

  private ensureInitialized(): Database {
    if (!this.initialized || !this.db) {
      throw new Error('SQLite store not initialized. Call init() first.');
    }
    return this.db;
  }

  get(key: string): Promise<CacheEntry | undefined> {
    this.incrementMetric('gets');
    const db = this.ensureInitialized();

    const row = db
      .prepare('SELECT data FROM cache_entries WHERE key = ?')
      .get(key) as { data: string } | undefined;

    if (!row) {
      this.incrementMetric('misses');
      return Promise.resolve(undefined);
    }

    this.incrementMetric('hits');
    try {
      const entry = JSON.parse(row.data) as CacheEntry;

      // Update access metadata
      entry.metadata.accessedAt = now();
      entry.metadata.accessCount++;
      db.prepare(
        'UPDATE cache_entries SET accessed_at = ?, data = ? WHERE key = ?',
      ).run(now(), JSON.stringify(entry), key);

      return Promise.resolve(entry);
    } catch {
      return Promise.resolve(undefined);
    }
  }

  set(key: string, entry: CacheEntry): Promise<UpsertResult> {
    const startTime = performance.now();
    this.incrementMetric('sets');
    const db = this.ensureInitialized();

    // Convert embedding to buffer if present
    const embedding = entry.embedding
      ? Buffer.from(new Float32Array(entry.embedding).buffer)
      : null;

    db.prepare(
      `
      INSERT OR REPLACE INTO cache_entries
      (key, id, data, embedding, model, namespace, created_at, accessed_at, ttl)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(
      key,
      entry.id,
      JSON.stringify(entry),
      embedding,
      entry.request.model,
      entry.metadata.namespace ?? null,
      entry.metadata.createdAt,
      entry.metadata.accessedAt,
      entry.metadata.ttl,
    );

    return Promise.resolve({
      success: true,
      id: entry.id,
      durationMs: performance.now() - startTime,
    });
  }

  has(key: string): Promise<boolean> {
    const db = this.ensureInitialized();
    const row = db
      .prepare('SELECT 1 FROM cache_entries WHERE key = ?')
      .get(key);
    return Promise.resolve(!!row);
  }

  delete(key: string): Promise<boolean> {
    this.incrementMetric('deletes');
    const db = this.ensureInitialized();
    const result = db
      .prepare('DELETE FROM cache_entries WHERE key = ?')
      .run(key);
    return Promise.resolve(result.changes > 0);
  }

  clear(): Promise<void> {
    const db = this.ensureInitialized();
    if (this.namespace === 'default') {
      db.prepare('DELETE FROM cache_entries').run();
    } else {
      db.prepare('DELETE FROM cache_entries WHERE namespace = ?').run(
        this.namespace,
      );
    }
    return Promise.resolve();
  }

  size(): Promise<number> {
    const db = this.ensureInitialized();
    const row = db
      .prepare('SELECT COUNT(*) as count FROM cache_entries')
      .get() as { count: number };
    return Promise.resolve(row.count);
  }

  keys(): Promise<string[]> {
    const db = this.ensureInitialized();
    const rows = db.prepare('SELECT key FROM cache_entries').all() as Array<{
      key: string;
    }>;
    return Promise.resolve(rows.map((r) => r.key));
  }

  query(
    vector: number[],
    options?: StoreQueryOptions,
  ): Promise<StoreQueryResult> {
    const startTime = performance.now();
    const db = this.ensureInitialized();

    // Build query with optional namespace filter
    let sql = `
      SELECT key, data, embedding FROM cache_entries
      WHERE embedding IS NOT NULL
    `;
    const params: unknown[] = [];

    if (options?.namespace) {
      sql += ' AND namespace = ?';
      params.push(options.namespace);
    }

    const rows = db.prepare(sql).all(...params) as Array<{
      key: string;
      data: string;
      embedding: Buffer;
    }>;

    // Compute similarities
    const results: Array<CacheEntry & { score: number }> = [];

    for (const row of rows) {
      const stored = new Float32Array(
        row.embedding.buffer,
        row.embedding.byteOffset,
        row.embedding.length / 4,
      );
      const similarity = cosineSimilarity(vector, Array.from(stored));

      if (similarity >= (options?.minSimilarity ?? 0)) {
        try {
          const entry = JSON.parse(row.data) as CacheEntry;
          results.push({ ...entry, score: similarity });
        } catch {
          // Skip invalid entries
        }
      }
    }

    results.sort((a, b) => b.score - a.score);

    return Promise.resolve({
      entries: results.slice(0, options?.topK ?? 10),
      durationMs: performance.now() - startTime,
    });
  }

  checkHealth(): Promise<StoreHealth> {
    const startTime = performance.now();
    try {
      this.ensureInitialized();
      return Promise.resolve({
        healthy: true,
        latencyMs: performance.now() - startTime,
        lastCheck: now(),
      });
    } catch (error) {
      return Promise.resolve({
        healthy: false,
        latencyMs: performance.now() - startTime,
        lastCheck: now(),
        error: (error as Error).message,
      });
    }
  }

  close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initialized = false;
    }
    return Promise.resolve();
  }

  /**
   * Prune expired entries
   */
  pruneExpired(): Promise<number> {
    const db = this.ensureInitialized();
    const currentTime = now();

    const result = db
      .prepare(
        `
      DELETE FROM cache_entries
      WHERE ttl > 0 AND (created_at + (ttl * 1000)) < ?
    `,
      )
      .run(currentTime);

    return Promise.resolve(result.changes);
  }

  /**
   * Get database file size (for non-memory databases)
   */
  async getDbSize(): Promise<number | null> {
    if (this.sqliteConfig.inMemory) return null;

    try {
      const { statSync } = await import('fs');
      const stats = statSync(this.sqliteConfig.dbPath ?? 'cache.db');
      return stats.size;
    } catch {
      return null;
    }
  }

  /**
   * Check if database is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

/**
 * Create a SQLiteCacheStore instance
 */
export function createSQLiteCacheStore(
  config: SQLiteStoreConfig,
): SQLiteCacheStore {
  return new SQLiteCacheStore(config);
}
