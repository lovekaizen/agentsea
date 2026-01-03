/**
 * FeedbackStore
 *
 * Feedback persistence layer with multiple backend support.
 */

import type {
  FeedbackEntry,
  FeedbackStoreInterface,
  FeedbackQueryOptions,
  FeedbackQueryResult,
  FeedbackStoreConfig,
} from '../types/index.js';

/**
 * In-memory feedback store
 */
export class MemoryFeedbackStore implements FeedbackStoreInterface {
  private entries: Map<string, FeedbackEntry> = new Map();

  save(entry: FeedbackEntry): Promise<string> {
    this.entries.set(entry.id, entry);
    return Promise.resolve(entry.id);
  }

  saveBatch(entries: FeedbackEntry[]): Promise<string[]> {
    const ids: string[] = [];
    for (const entry of entries) {
      this.entries.set(entry.id, entry);
      ids.push(entry.id);
    }
    return Promise.resolve(ids);
  }

  get(id: string): Promise<FeedbackEntry | null> {
    return Promise.resolve(this.entries.get(id) ?? null);
  }

  query(options: FeedbackQueryOptions): Promise<FeedbackQueryResult> {
    let entries = Array.from(this.entries.values());

    // Apply filters
    if (options.type) {
      const types = Array.isArray(options.type) ? options.type : [options.type];
      entries = entries.filter((e) => types.includes(e.type));
    }

    if (options.userId) {
      entries = entries.filter((e) => e.userId === options.userId);
    }

    if (options.conversationId) {
      entries = entries.filter(
        (e) => e.conversationId === options.conversationId,
      );
    }

    if (options.responseId) {
      entries = entries.filter((e) => e.responseId === options.responseId);
    }

    if (options.startTime !== undefined) {
      entries = entries.filter((e) => e.timestamp >= options.startTime!);
    }

    if (options.endTime !== undefined) {
      entries = entries.filter((e) => e.timestamp <= options.endTime!);
    }

    // Apply metadata filters
    if (options.metadata) {
      entries = entries.filter((e) => {
        if (!e.metadata) return false;
        for (const [key, value] of Object.entries(options.metadata!)) {
          if (e.metadata[key] !== value) return false;
        }
        return true;
      });
    }

    const total = entries.length;

    // Apply ordering
    if (options.orderBy) {
      entries.sort((a, b) => {
        let aVal: number;
        let bVal: number;

        if (options.orderBy === 'timestamp') {
          aVal = a.timestamp;
          bVal = b.timestamp;
        } else if (options.orderBy === 'rating') {
          aVal = this.getRating(a);
          bVal = this.getRating(b);
        } else {
          return 0;
        }

        return options.orderDir === 'desc' ? bVal - aVal : aVal - bVal;
      });
    }

    // Apply pagination
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 100;
    entries = entries.slice(offset, offset + limit);

    return Promise.resolve({
      entries,
      total,
      hasMore: offset + entries.length < total,
    });
  }

  delete(id: string): Promise<boolean> {
    return Promise.resolve(this.entries.delete(id));
  }

  clear(): Promise<void> {
    this.entries.clear();
    return Promise.resolve();
  }

  close(): Promise<void> {
    // No-op for memory store
    return Promise.resolve();
  }

  private getRating(entry: FeedbackEntry): number {
    switch (entry.type) {
      case 'thumbs':
        return entry.rating === 'up' ? 1 : 0;
      case 'rating':
        return entry.rating;
      case 'multi_criteria':
        return entry.overallRating ?? 0;
      default:
        return 0;
    }
  }
}

/**
 * SQLite feedback store
 */
export class SQLiteFeedbackStore implements FeedbackStoreInterface {
  private db: unknown;
  private tableName: string;
  private initialized = false;

  constructor(private config: { path: string; tableName?: string }) {
    this.tableName = config.tableName ?? 'feedback';
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      const BetterSqlite3 = await import('better-sqlite3');
      this.db = new BetterSqlite3.default(this.config.path);

      // Create table
      (this.db as { exec: (sql: string) => void }).exec(`
        CREATE TABLE IF NOT EXISTS ${this.tableName} (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          response_id TEXT NOT NULL,
          conversation_id TEXT,
          input TEXT NOT NULL,
          output TEXT NOT NULL,
          user_id TEXT,
          timestamp INTEGER NOT NULL,
          data TEXT NOT NULL,
          metadata TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_type ON ${this.tableName}(type);
        CREATE INDEX IF NOT EXISTS idx_timestamp ON ${this.tableName}(timestamp);
        CREATE INDEX IF NOT EXISTS idx_user_id ON ${this.tableName}(user_id);
        CREATE INDEX IF NOT EXISTS idx_response_id ON ${this.tableName}(response_id);
      `);

      this.initialized = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize SQLite store: ${(error as Error).message}`,
      );
    }
  }

  async save(entry: FeedbackEntry): Promise<string> {
    await this.ensureInitialized();

    const stmt = (
      this.db as {
        prepare: (sql: string) => {
          run: (...args: unknown[]) => void;
        };
      }
    ).prepare(`
      INSERT OR REPLACE INTO ${this.tableName}
      (id, type, response_id, conversation_id, input, output, user_id, timestamp, data, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      entry.id,
      entry.type,
      entry.responseId,
      entry.conversationId ?? null,
      entry.input,
      entry.output,
      entry.userId ?? null,
      entry.timestamp,
      JSON.stringify(entry),
      entry.metadata ? JSON.stringify(entry.metadata) : null,
    );

    return entry.id;
  }

  async saveBatch(entries: FeedbackEntry[]): Promise<string[]> {
    const ids: string[] = [];
    for (const entry of entries) {
      const id = await this.save(entry);
      ids.push(id);
    }
    return ids;
  }

  async get(id: string): Promise<FeedbackEntry | null> {
    await this.ensureInitialized();

    const stmt = (
      this.db as {
        prepare: (sql: string) => {
          get: (...args: unknown[]) => { data: string } | undefined;
        };
      }
    ).prepare(`SELECT data FROM ${this.tableName} WHERE id = ?`);

    const row = stmt.get(id);
    return row ? JSON.parse(row.data) : null;
  }

  async query(options: FeedbackQueryOptions): Promise<FeedbackQueryResult> {
    await this.ensureInitialized();

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (options.type) {
      const types = Array.isArray(options.type) ? options.type : [options.type];
      conditions.push(`type IN (${types.map(() => '?').join(', ')})`);
      params.push(...types);
    }

    if (options.userId) {
      conditions.push('user_id = ?');
      params.push(options.userId);
    }

    if (options.conversationId) {
      conditions.push('conversation_id = ?');
      params.push(options.conversationId);
    }

    if (options.responseId) {
      conditions.push('response_id = ?');
      params.push(options.responseId);
    }

    if (options.startTime !== undefined) {
      conditions.push('timestamp >= ?');
      params.push(options.startTime);
    }

    if (options.endTime !== undefined) {
      conditions.push('timestamp <= ?');
      params.push(options.endTime);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countStmt = (
      this.db as {
        prepare: (sql: string) => {
          get: (...args: unknown[]) => { count: number };
        };
      }
    ).prepare(`SELECT COUNT(*) as count FROM ${this.tableName} ${whereClause}`);

    const { count: total } = countStmt.get(...params);

    // Get entries
    const orderBy =
      options.orderBy === 'rating'
        ? 'timestamp'
        : (options.orderBy ?? 'timestamp');
    const orderDir = options.orderDir ?? 'desc';
    const limit = options.limit ?? 100;
    const offset = options.offset ?? 0;

    const selectStmt = (
      this.db as {
        prepare: (sql: string) => {
          all: (...args: unknown[]) => Array<{ data: string }>;
        };
      }
    ).prepare(`
      SELECT data FROM ${this.tableName}
      ${whereClause}
      ORDER BY ${orderBy} ${orderDir}
      LIMIT ? OFFSET ?
    `);

    const rows = selectStmt.all(...params, limit, offset);
    const entries = rows.map((row) => JSON.parse(row.data) as FeedbackEntry);

    return {
      entries,
      total,
      hasMore: offset + entries.length < total,
    };
  }

  async delete(id: string): Promise<boolean> {
    await this.ensureInitialized();

    const stmt = (
      this.db as {
        prepare: (sql: string) => {
          run: (...args: unknown[]) => { changes: number };
        };
      }
    ).prepare(`DELETE FROM ${this.tableName} WHERE id = ?`);

    const result = stmt.run(id);
    return result.changes > 0;
  }

  async clear(): Promise<void> {
    await this.ensureInitialized();
    (this.db as { exec: (sql: string) => void }).exec(
      `DELETE FROM ${this.tableName}`,
    );
  }

  close(): Promise<void> {
    if (this.db) {
      (this.db as { close: () => void }).close();
    }
    this.initialized = false;
    return Promise.resolve();
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
  }
}

/**
 * Create a feedback store based on config
 */
export function createFeedbackStore(
  config: FeedbackStoreConfig,
): FeedbackStoreInterface {
  switch (config.type) {
    case 'memory':
      return new MemoryFeedbackStore();
    case 'sqlite':
      if (!config.path) {
        throw new Error('SQLite store requires a path');
      }
      return new SQLiteFeedbackStore({
        path: config.path,
        tableName: config.tableName,
      });
    default:
      throw new Error(`Unknown store type: ${config.type}`);
  }
}
