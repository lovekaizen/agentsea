/**
 * SQLiteCache
 *
 * SQLite-based persistent cache for embeddings.
 */

import { BaseCache } from './BaseCache.js';
import type {
  CachedEmbedding,
  SQLiteCacheOptions,
  CacheBackendType,
} from '../types/index.js';

/**
 * SQLite database interface
 */
interface SQLiteDatabase {
  exec(sql: string): void;
  prepare(sql: string): SQLiteStatement;
  close(): void;
}

interface SQLiteStatement {
  run(...params: unknown[]): { changes: number };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

/**
 * SQLite cache implementation
 */
export class SQLiteCache extends BaseCache {
  readonly backendType: CacheBackendType = 'sqlite';

  private db: SQLiteDatabase | null = null;
  private config: SQLiteCacheOptions;
  private initialized = false;
  private vacuumCounter = 0;

  constructor(options: SQLiteCacheOptions = {}) {
    super(options);
    this.config = {
      dbPath: options.dbPath ?? './embeddings_cache.db',
      inMemory: options.inMemory ?? false,
      walMode: options.walMode ?? true,
      busyTimeout: options.busyTimeout ?? 5000,
      autoVacuum: options.autoVacuum ?? true,
      vacuumInterval: options.vacuumInterval ?? 1000,
      ...options,
    };
  }

  /**
   * Initialize database
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      // Dynamic import for optional dependency
      const Database = (await import('better-sqlite3')).default;

      const dbPath = this.config.inMemory ? ':memory:' : this.config.dbPath;
      this.db = new Database(dbPath) as unknown as SQLiteDatabase;

      // Configure database
      if (this.config.walMode) {
        this.db.exec('PRAGMA journal_mode = WAL');
      }
      if (this.config.busyTimeout) {
        this.db.exec(`PRAGMA busy_timeout = ${this.config.busyTimeout}`);
      }

      // Create table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS embeddings (
          key TEXT PRIMARY KEY,
          vector BLOB NOT NULL,
          text TEXT,
          model TEXT NOT NULL,
          dimensions INTEGER NOT NULL,
          token_count INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          accessed_at INTEGER NOT NULL,
          access_count INTEGER DEFAULT 0,
          ttl INTEGER DEFAULT 0,
          version TEXT,
          metadata TEXT
        )
      `);

      // Create indexes
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_model ON embeddings(model);
        CREATE INDEX IF NOT EXISTS idx_created_at ON embeddings(created_at);
        CREATE INDEX IF NOT EXISTS idx_accessed_at ON embeddings(accessed_at);
      `);

      this.initialized = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize SQLite: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Ensure initialized
   */
  private async ensureInitialized(): Promise<SQLiteDatabase> {
    if (!this.initialized || !this.db) {
      await this.init();
    }
    if (!this.db) {
      throw new Error('SQLite database not initialized');
    }
    return this.db;
  }

  async get(key: string): Promise<CachedEmbedding | undefined> {
    const db = await this.ensureInitialized();

    const stmt = db.prepare(`
      SELECT * FROM embeddings WHERE key = ?
    `);
    const row = stmt.get(key) as Record<string, unknown> | undefined;

    if (!row) return undefined;

    // Check TTL
    const ttl = row.ttl as number;
    if (ttl > 0) {
      const createdAt = row.created_at as number;
      if (Date.now() > createdAt + ttl * 1000) {
        // Entry expired
        await this.delete(key);
        return undefined;
      }
    }

    // Update access info
    const updateStmt = db.prepare(`
      UPDATE embeddings
      SET accessed_at = ?, access_count = access_count + 1
      WHERE key = ?
    `);
    updateStmt.run(Date.now(), key);

    // Parse vector from blob. Honor the Buffer's byteOffset/byteLength: Node may
    // back a small Buffer with a slice of a shared pool ArrayBuffer, so reading
    // `vectorBuffer.buffer` directly would read the wrong (or too many) bytes.
    const vectorBuffer = row.vector as Buffer;
    const vector = Array.from(
      new Float32Array(
        vectorBuffer.buffer,
        vectorBuffer.byteOffset,
        vectorBuffer.byteLength / Float32Array.BYTES_PER_ELEMENT,
      ),
    );

    return {
      key: row.key as string,
      vector,
      text: row.text as string,
      model: row.model as string,
      dimensions: row.dimensions as number,
      tokenCount: row.token_count as number,
      createdAt: row.created_at as number,
      accessedAt: Date.now(),
      accessCount: (row.access_count as number) + 1,
      ttl,
      version: row.version as string | undefined,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined,
    };
  }

  async set(key: string, entry: CachedEmbedding): Promise<void> {
    const db = await this.ensureInitialized();

    // Convert vector to blob
    const vectorBuffer = Buffer.from(new Float32Array(entry.vector).buffer);

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO embeddings
      (key, vector, text, model, dimensions, token_count, created_at, accessed_at, access_count, ttl, version, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      entry.key,
      vectorBuffer,
      entry.text,
      entry.model,
      entry.dimensions,
      entry.tokenCount,
      entry.createdAt,
      entry.accessedAt,
      entry.accessCount,
      entry.ttl,
      entry.version,
      entry.metadata ? JSON.stringify(entry.metadata) : null,
    );

    this.stats.entries++;
    this.maybeVacuum();
  }

  async has(key: string): Promise<boolean> {
    const db = await this.ensureInitialized();
    const stmt = db.prepare('SELECT 1 FROM embeddings WHERE key = ?');
    return !!stmt.get(key);
  }

  async delete(key: string): Promise<boolean> {
    const db = await this.ensureInitialized();
    const stmt = db.prepare('DELETE FROM embeddings WHERE key = ?');
    const result = stmt.run(key);
    if (result.changes > 0) {
      this.stats.deletes++;
      this.stats.entries = Math.max(0, this.stats.entries - 1);
    }
    return result.changes > 0;
  }

  async clear(): Promise<void> {
    const db = await this.ensureInitialized();
    db.exec('DELETE FROM embeddings');
    this.stats.entries = 0;
  }

  async size(): Promise<number> {
    const db = await this.ensureInitialized();
    const stmt = db.prepare('SELECT COUNT(*) as count FROM embeddings');
    const row = stmt.get() as { count: number };
    return row.count;
  }

  async keys(): Promise<string[]> {
    const db = await this.ensureInitialized();
    const stmt = db.prepare('SELECT key FROM embeddings');
    const rows = stmt.all() as Array<{ key: string }>;
    return rows.map((r) => r.key);
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initialized = false;
    }
    return Promise.resolve();
  }

  /**
   * Maybe run vacuum
   */
  private maybeVacuum(): void {
    if (!this.config.autoVacuum) return;

    this.vacuumCounter++;
    if (this.vacuumCounter >= (this.config.vacuumInterval ?? 1000)) {
      this.vacuumCounter = 0;
      // Run in background
      this.vacuum().catch(() => {});
    }
  }

  /**
   * Run vacuum
   */
  async vacuum(): Promise<void> {
    const db = await this.ensureInitialized();
    db.exec('VACUUM');
  }

  /**
   * Remove expired entries
   */
  async removeExpired(): Promise<number> {
    const db = await this.ensureInitialized();
    const now = Date.now();

    const stmt = db.prepare(`
      DELETE FROM embeddings
      WHERE ttl > 0 AND (created_at + ttl * 1000) < ?
    `);
    const result = stmt.run(now);
    return result.changes;
  }
}

/**
 * Create a SQLite cache
 */
export function createSQLiteCache(options?: SQLiteCacheOptions): SQLiteCache {
  return new SQLiteCache(options);
}
