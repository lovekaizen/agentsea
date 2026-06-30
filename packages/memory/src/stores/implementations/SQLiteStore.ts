/**
 * SQLiteStore
 *
 * SQLite-based persistent memory store.
 */

import type {
  MemoryEntry,
  MemoryUpdateInput,
  MemoryQueryOptions,
  MemoryQueryResult,
  MemoryStoreInterface,
  ScoredMemory,
  VectorSearchOptions,
  SQLiteStoreConfig,
} from '../../types/index.js';

// Dynamic import for better-sqlite3
type Database = import('better-sqlite3').Database;

/**
 * SQLite store implementation
 */
export class SQLiteStore implements MemoryStoreInterface {
  private db: Database | null = null;
  private config: SQLiteStoreConfig;
  private tableName: string;

  constructor(config: SQLiteStoreConfig) {
    this.config = config;
    this.tableName = config.tableName ?? 'memories';
  }

  /**
   * Initialize the database
   */
  async initialize(): Promise<void> {
    const BetterSqlite3 = (await import('better-sqlite3')).default;
    this.db = new BetterSqlite3(this.config.path);

    // Enable WAL mode for better performance
    if (this.config.enableWAL !== false) {
      this.db.pragma('journal_mode = WAL');
    }

    // Create table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        embedding BLOB,
        type TEXT NOT NULL,
        importance REAL NOT NULL,
        metadata TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        expires_at INTEGER,
        parent_id TEXT,
        access_count INTEGER DEFAULT 0,
        last_accessed_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_timestamp ON ${this.tableName}(timestamp);
      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_type ON ${this.tableName}(type);
      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_importance ON ${this.tableName}(importance);
    `);
  }

  /**
   * Ensure database is initialized
   */
  private async ensureInitialized(): Promise<Database> {
    if (!this.db) {
      await this.initialize();
    }
    return this.db!;
  }

  /**
   * Add a memory entry
   */
  async add(entry: MemoryEntry): Promise<string> {
    const db = await this.ensureInitialized();

    const stmt = db.prepare(`
      INSERT INTO ${this.tableName} (
        id, content, embedding, type, importance, metadata,
        timestamp, expires_at, parent_id, access_count,
        last_accessed_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      entry.id,
      entry.content,
      entry.embedding ? this.serializeVector(entry.embedding) : null,
      entry.type,
      entry.importance,
      JSON.stringify(entry.metadata),
      entry.timestamp,
      entry.expiresAt ?? null,
      entry.parentId ?? null,
      entry.accessCount,
      entry.lastAccessedAt ?? null,
      entry.createdAt,
      entry.updatedAt,
    );

    return entry.id;
  }

  /**
   * Get a memory entry by ID
   */
  async get(id: string): Promise<MemoryEntry | null> {
    const db = await this.ensureInitialized();

    const stmt = db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`);
    const row = stmt.get(id) as Record<string, unknown> | undefined;

    if (!row) {
      return null;
    }

    // Update access count
    const updateStmt = db.prepare(`
      UPDATE ${this.tableName}
      SET access_count = access_count + 1, last_accessed_at = ?
      WHERE id = ?
    `);
    updateStmt.run(Date.now(), id);

    return Promise.resolve(this.rowToEntry(row));
  }

  /**
   * Update a memory entry
   */
  async update(id: string, updates: MemoryUpdateInput): Promise<boolean> {
    const db = await this.ensureInitialized();

    const existing = await this.get(id);
    if (!existing) {
      return false;
    }

    const updated: MemoryEntry = {
      ...existing,
      ...updates,
      metadata: {
        ...existing.metadata,
        ...updates.metadata,
      },
      updatedAt: Date.now(),
    };

    const stmt = db.prepare(`
      UPDATE ${this.tableName}
      SET content = ?, embedding = ?, type = ?, importance = ?,
          metadata = ?, expires_at = ?, updated_at = ?
      WHERE id = ?
    `);

    const result = stmt.run(
      updated.content,
      updated.embedding ? this.serializeVector(updated.embedding) : null,
      updated.type,
      updated.importance,
      JSON.stringify(updated.metadata),
      updated.expiresAt ?? null,
      updated.updatedAt,
      id,
    );

    return result.changes > 0;
  }

  /**
   * Delete a memory entry
   */
  async delete(id: string): Promise<boolean> {
    const db = await this.ensureInitialized();

    const stmt = db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`);
    const result = stmt.run(id);

    return result.changes > 0;
  }

  /**
   * Query memory entries
   */
  async query(options: MemoryQueryOptions): Promise<MemoryQueryResult> {
    const db = await this.ensureInitialized();

    const conditions: string[] = [];
    const params: unknown[] = [];

    // Build WHERE clause
    if (options.query) {
      conditions.push('content LIKE ?');
      params.push(`%${options.query}%`);
    }

    if (options.userId) {
      conditions.push("json_extract(metadata, '$.userId') = ?");
      params.push(options.userId);
    }

    if (options.agentId) {
      conditions.push("json_extract(metadata, '$.agentId') = ?");
      params.push(options.agentId);
    }

    if (options.conversationId) {
      conditions.push("json_extract(metadata, '$.conversationId') = ?");
      params.push(options.conversationId);
    }

    if (options.namespace) {
      conditions.push("json_extract(metadata, '$.namespace') = ?");
      params.push(options.namespace);
    }

    if (options.types && options.types.length > 0) {
      const placeholders = options.types.map(() => '?').join(', ');
      conditions.push(`type IN (${placeholders})`);
      params.push(...options.types);
    }

    if (options.minImportance !== undefined) {
      conditions.push('importance >= ?');
      params.push(options.minImportance);
    }

    if (options.startTime !== undefined) {
      conditions.push('timestamp >= ?');
      params.push(options.startTime);
    }

    if (options.endTime !== undefined) {
      conditions.push('timestamp <= ?');
      params.push(options.endTime);
    }

    if (!options.includeExpired) {
      conditions.push('(expires_at IS NULL OR expires_at > ?)');
      params.push(Date.now());
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total
    const countStmt = db.prepare(
      `SELECT COUNT(*) as count FROM ${this.tableName} ${whereClause}`,
    );
    const countResult = countStmt.get(...params) as { count: number };
    const total = countResult.count;

    // Query with pagination
    const limit = options.limit ?? 100;
    const offset = options.offset ?? 0;

    const queryStmt = db.prepare(`
      SELECT * FROM ${this.tableName}
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `);

    const rows = queryStmt.all(...params, limit, offset) as Record<
      string,
      unknown
    >[];
    const entries = rows.map((row) => this.rowToEntry(row));

    return {
      entries,
      total,
      hasMore: offset + limit < total,
    };
  }

  /**
   * Search by vector similarity
   */
  async search(
    embedding: number[],
    options: VectorSearchOptions,
  ): Promise<ScoredMemory[]> {
    const db = await this.ensureInitialized();

    // Get all entries with embeddings
    // Note: For production, consider using sqlite-vss or similar extension
    const conditions: string[] = ['embedding IS NOT NULL'];
    const params: unknown[] = [];

    if (options.namespace) {
      conditions.push("json_extract(metadata, '$.namespace') = ?");
      params.push(options.namespace);
    }

    if (options.filter) {
      for (const [key, value] of Object.entries(options.filter)) {
        // Filter keys are interpolated into the JSON path, so they cannot be
        // bound as parameters — validate to prevent SQL injection.
        if (!/^[A-Za-z0-9_]+$/.test(key)) {
          throw new Error(`Invalid metadata filter key: ${key}`);
        }
        if (value !== undefined) {
          if (Array.isArray(value)) {
            const placeholders = value.map(() => '?').join(', ');
            conditions.push(
              `json_extract(metadata, '$.${key}') IN (${placeholders})`,
            );
            params.push(...value);
          } else {
            conditions.push(`json_extract(metadata, '$.${key}') = ?`);
            params.push(value);
          }
        }
      }
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const stmt = db.prepare(`SELECT * FROM ${this.tableName} ${whereClause}`);
    const rows = stmt.all(...params) as Record<string, unknown>[];

    // Calculate similarities
    const results: ScoredMemory[] = [];

    for (const row of rows) {
      const entry = this.rowToEntry(row);
      if (!entry.embedding) continue;

      const score = this.cosineSimilarity(embedding, entry.embedding);

      if (options.minScore === undefined || score >= options.minScore) {
        results.push({ entry, score });
      }
    }

    // Sort by score and return top-K
    results.sort((a, b) => b.score - a.score);
    return Promise.resolve(results.slice(0, options.topK));
  }

  /**
   * Clear entries
   */
  async clear(options?: {
    namespace?: string;
    userId?: string;
  }): Promise<number> {
    const db = await this.ensureInitialized();

    if (!options) {
      const stmt = db.prepare(`DELETE FROM ${this.tableName}`);
      const result = stmt.run();
      return result.changes;
    }

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (options.namespace) {
      conditions.push("json_extract(metadata, '$.namespace') = ?");
      params.push(options.namespace);
    }

    if (options.userId) {
      conditions.push("json_extract(metadata, '$.userId') = ?");
      params.push(options.userId);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const stmt = db.prepare(`DELETE FROM ${this.tableName} ${whereClause}`);
    const result = stmt.run(...params);

    return result.changes;
  }

  /**
   * Count entries
   */
  async count(options?: MemoryQueryOptions): Promise<number> {
    const db = await this.ensureInitialized();

    if (!options) {
      const stmt = db.prepare(
        `SELECT COUNT(*) as count FROM ${this.tableName}`,
      );
      const result = stmt.get() as { count: number };
      return result.count;
    }

    const { total } = await this.query({ ...options, limit: 0 });
    return total;
  }

  /**
   * Close the database
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    return Promise.resolve();
  }

  /**
   * Convert database row to MemoryEntry
   */
  private rowToEntry(row: Record<string, unknown>): MemoryEntry {
    return {
      id: row.id as string,
      content: row.content as string,
      embedding: row.embedding
        ? this.deserializeVector(row.embedding as Buffer)
        : undefined,
      type: row.type as MemoryEntry['type'],
      importance: row.importance as number,
      metadata: JSON.parse(row.metadata as string),
      timestamp: row.timestamp as number,
      expiresAt: row.expires_at as number | undefined,
      parentId: row.parent_id as string | undefined,
      accessCount: row.access_count as number,
      lastAccessedAt: row.last_accessed_at as number | undefined,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
    };
  }

  /**
   * Serialize vector to buffer
   */
  private serializeVector(vector: number[]): Buffer {
    const buffer = Buffer.alloc(vector.length * 4);
    for (let i = 0; i < vector.length; i++) {
      buffer.writeFloatLE(vector[i], i * 4);
    }
    return buffer;
  }

  /**
   * Deserialize vector from buffer
   */
  private deserializeVector(buffer: Buffer): number[] {
    const vector: number[] = [];
    for (let i = 0; i < buffer.length / 4; i++) {
      vector.push(buffer.readFloatLE(i * 4));
    }
    return vector;
  }

  /**
   * Calculate cosine similarity
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    if (magnitude === 0) {
      return 0;
    }

    return dotProduct / magnitude;
  }
}

/**
 * Create a SQLite store
 */
export async function createSQLiteStore(
  config: SQLiteStoreConfig,
): Promise<SQLiteStore> {
  const store = new SQLiteStore(config);
  await store.initialize();
  return store;
}
