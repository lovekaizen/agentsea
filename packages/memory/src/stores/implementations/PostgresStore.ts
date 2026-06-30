/**
 * PostgresStore
 *
 * PostgreSQL-based memory store with pgvector support.
 */

import type {
  MemoryEntry,
  MemoryUpdateInput,
  MemoryQueryOptions,
  MemoryQueryResult,
  MemoryStoreInterface,
  ScoredMemory,
  VectorSearchOptions,
  PostgresStoreConfig,
} from '../../types/index.js';

// Dynamic import for pg
type Pool = import('pg').Pool;

/**
 * PostgreSQL store implementation
 */
export class PostgresStore implements MemoryStoreInterface {
  private pool: Pool | null = null;
  private config: PostgresStoreConfig;
  private tableName: string;
  private vectorDimensions: number;
  private initialized = false;

  constructor(config: PostgresStoreConfig) {
    this.config = config;
    this.tableName = config.tableName ?? 'memories';
    this.vectorDimensions = config.vectorDimensions ?? 1536;
  }

  /**
   * Initialize the database
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const { Pool } = await import('pg');

    if (this.config.connectionString) {
      this.pool = new Pool({
        connectionString: this.config.connectionString,
        max: this.config.poolSize ?? 10,
        ssl: this.config.ssl,
      });
    } else {
      this.pool = new Pool({
        host: this.config.host ?? 'localhost',
        port: this.config.port ?? 5432,
        database: this.config.database ?? 'agentsea',
        user: this.config.user ?? 'postgres',
        password: this.config.password,
        max: this.config.poolSize ?? 10,
        ssl: this.config.ssl,
      });
    }

    // Create pgvector extension if not exists
    await this.pool.query('CREATE EXTENSION IF NOT EXISTS vector');

    // Create table
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        embedding vector(${this.vectorDimensions}),
        type TEXT NOT NULL,
        importance REAL NOT NULL,
        metadata JSONB NOT NULL,
        timestamp BIGINT NOT NULL,
        expires_at BIGINT,
        parent_id TEXT,
        access_count INTEGER DEFAULT 0,
        last_accessed_at BIGINT,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      )
    `);

    // Create indexes
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_timestamp ON ${this.tableName}(timestamp);
      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_type ON ${this.tableName}(type);
      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_importance ON ${this.tableName}(importance);
      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_metadata ON ${this.tableName} USING GIN(metadata);
    `);

    // Create vector index for similarity search
    await this.pool
      .query(
        `
      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_embedding
      ON ${this.tableName} USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100)
    `,
      )
      .catch(() => {
        // Index might not be created if there's no data yet, that's ok
      });

    this.initialized = true;
  }

  /**
   * Ensure database is initialized
   */
  private async ensureInitialized(): Promise<Pool> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.pool!;
  }

  /**
   * Add a memory entry
   */
  async add(entry: MemoryEntry): Promise<string> {
    const pool = await this.ensureInitialized();

    const embeddingValue = entry.embedding
      ? `[${entry.embedding.join(',')}]`
      : null;

    await pool.query(
      `INSERT INTO ${this.tableName} (
        id, content, embedding, type, importance, metadata,
        timestamp, expires_at, parent_id, access_count,
        last_accessed_at, created_at, updated_at
      ) VALUES ($1, $2, $3::vector, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        entry.id,
        entry.content,
        embeddingValue,
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
      ],
    );

    return entry.id;
  }

  /**
   * Get a memory entry by ID
   */
  async get(id: string): Promise<MemoryEntry | null> {
    const pool = await this.ensureInitialized();

    const result = await pool.query(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return null;
    }

    // Update access count
    await pool.query(
      `UPDATE ${this.tableName}
       SET access_count = access_count + 1, last_accessed_at = $1
       WHERE id = $2`,
      [Date.now(), id],
    );

    return Promise.resolve(this.rowToEntry(result.rows[0]));
  }

  /**
   * Update a memory entry
   */
  async update(id: string, updates: MemoryUpdateInput): Promise<boolean> {
    const pool = await this.ensureInitialized();

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

    const embeddingValue = updated.embedding
      ? `[${updated.embedding.join(',')}]`
      : null;

    const result = await pool.query(
      `UPDATE ${this.tableName}
       SET content = $1, embedding = $2::vector, type = $3, importance = $4,
           metadata = $5, expires_at = $6, updated_at = $7
       WHERE id = $8`,
      [
        updated.content,
        embeddingValue,
        updated.type,
        updated.importance,
        JSON.stringify(updated.metadata),
        updated.expiresAt ?? null,
        updated.updatedAt,
        id,
      ],
    );

    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Delete a memory entry
   */
  async delete(id: string): Promise<boolean> {
    const pool = await this.ensureInitialized();

    const result = await pool.query(
      `DELETE FROM ${this.tableName} WHERE id = $1`,
      [id],
    );

    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Query memory entries
   */
  async query(options: MemoryQueryOptions): Promise<MemoryQueryResult> {
    const pool = await this.ensureInitialized();

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    // Build WHERE clause
    if (options.query) {
      conditions.push(`content ILIKE $${paramIndex}`);
      params.push(`%${options.query}%`);
      paramIndex++;
    }

    if (options.userId) {
      conditions.push(`metadata->>'userId' = $${paramIndex}`);
      params.push(options.userId);
      paramIndex++;
    }

    if (options.agentId) {
      conditions.push(`metadata->>'agentId' = $${paramIndex}`);
      params.push(options.agentId);
      paramIndex++;
    }

    if (options.conversationId) {
      conditions.push(`metadata->>'conversationId' = $${paramIndex}`);
      params.push(options.conversationId);
      paramIndex++;
    }

    if (options.namespace) {
      conditions.push(`metadata->>'namespace' = $${paramIndex}`);
      params.push(options.namespace);
      paramIndex++;
    }

    if (options.types && options.types.length > 0) {
      conditions.push(`type = ANY($${paramIndex})`);
      params.push(options.types);
      paramIndex++;
    }

    if (options.minImportance !== undefined) {
      conditions.push(`importance >= $${paramIndex}`);
      params.push(options.minImportance);
      paramIndex++;
    }

    if (options.startTime !== undefined) {
      conditions.push(`timestamp >= $${paramIndex}`);
      params.push(options.startTime);
      paramIndex++;
    }

    if (options.endTime !== undefined) {
      conditions.push(`timestamp <= $${paramIndex}`);
      params.push(options.endTime);
      paramIndex++;
    }

    if (!options.includeExpired) {
      conditions.push(`(expires_at IS NULL OR expires_at > $${paramIndex})`);
      params.push(Date.now());
      paramIndex++;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total
    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM ${this.tableName} ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Query with pagination
    const limit = options.limit ?? 100;
    const offset = options.offset ?? 0;

    const queryResult = await pool.query(
      `SELECT * FROM ${this.tableName}
       ${whereClause}
       ORDER BY timestamp DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset],
    );

    const entries = queryResult.rows.map((row) => this.rowToEntry(row));

    return {
      entries,
      total,
      hasMore: offset + limit < total,
    };
  }

  /**
   * Search by vector similarity using pgvector
   */
  async search(
    embedding: number[],
    options: VectorSearchOptions,
  ): Promise<ScoredMemory[]> {
    const pool = await this.ensureInitialized();

    const conditions: string[] = ['embedding IS NOT NULL'];
    const params: unknown[] = [`[${embedding.join(',')}]`];
    let paramIndex = 2;

    if (options.namespace) {
      conditions.push(`metadata->>'namespace' = $${paramIndex}`);
      params.push(options.namespace);
      paramIndex++;
    }

    if (options.filter) {
      for (const [key, value] of Object.entries(options.filter)) {
        // Filter keys are interpolated into the JSON accessor, so they cannot
        // be bound as parameters — validate to prevent SQL injection.
        if (!/^[A-Za-z0-9_]+$/.test(key)) {
          throw new Error(`Invalid metadata filter key: ${key}`);
        }
        if (value !== undefined) {
          if (Array.isArray(value)) {
            conditions.push(`metadata->>'${key}' = ANY($${paramIndex})`);
            params.push(value);
          } else {
            conditions.push(`metadata->>'${key}' = $${paramIndex}`);
            params.push(value);
          }
          paramIndex++;
        }
      }
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const minScore = options.minScore ?? 0;

    // Use pgvector's cosine distance (1 - similarity)
    const result = await pool.query(
      `SELECT *, 1 - (embedding <=> $1::vector) as score
       FROM ${this.tableName}
       ${whereClause}
       AND 1 - (embedding <=> $1::vector) >= $${paramIndex}
       ORDER BY embedding <=> $1::vector
       LIMIT $${paramIndex + 1}`,
      [...params, minScore, options.topK],
    );

    return result.rows.map((row) => ({
      entry: this.rowToEntry(row),
      score: parseFloat(row.score),
    }));
  }

  /**
   * Clear entries
   */
  async clear(options?: {
    namespace?: string;
    userId?: string;
  }): Promise<number> {
    const pool = await this.ensureInitialized();

    if (!options) {
      const result = await pool.query(`DELETE FROM ${this.tableName}`);
      return result.rowCount ?? 0;
    }

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (options.namespace) {
      conditions.push(`metadata->>'namespace' = $${paramIndex}`);
      params.push(options.namespace);
      paramIndex++;
    }

    if (options.userId) {
      conditions.push(`metadata->>'userId' = $${paramIndex}`);
      params.push(options.userId);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `DELETE FROM ${this.tableName} ${whereClause}`,
      params,
    );

    return result.rowCount ?? 0;
  }

  /**
   * Count entries
   */
  async count(options?: MemoryQueryOptions): Promise<number> {
    const pool = await this.ensureInitialized();

    if (!options) {
      const result = await pool.query(
        `SELECT COUNT(*) as count FROM ${this.tableName}`,
      );
      return Promise.resolve(parseInt(result.rows[0].count, 10));
    }

    const { total } = await this.query({ ...options, limit: 0 });
    return total;
  }

  /**
   * Close the connection pool
   */
  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.initialized = false;
    }
  }

  /**
   * Convert database row to MemoryEntry
   */
  private rowToEntry(row: Record<string, unknown>): MemoryEntry {
    const embedding = row.embedding as string | null;
    let embeddingArray: number[] | undefined;

    if (embedding) {
      // Parse pgvector format: "[0.1,0.2,0.3]"
      const cleaned = embedding.replace(/[[\]]/g, '');
      embeddingArray = cleaned.split(',').map((v) => parseFloat(v));
    }

    return {
      id: row.id as string,
      content: row.content as string,
      embedding: embeddingArray,
      type: row.type as MemoryEntry['type'],
      importance: parseFloat(row.importance as string),
      metadata: row.metadata as MemoryEntry['metadata'],
      timestamp: parseInt(row.timestamp as string, 10),
      expiresAt: row.expires_at
        ? parseInt(row.expires_at as string, 10)
        : undefined,
      parentId: row.parent_id as string | undefined,
      accessCount: parseInt(row.access_count as string, 10),
      lastAccessedAt: row.last_accessed_at
        ? parseInt(row.last_accessed_at as string, 10)
        : undefined,
      createdAt: parseInt(row.created_at as string, 10),
      updatedAt: parseInt(row.updated_at as string, 10),
    };
  }
}

/**
 * Create a PostgreSQL store
 */
export async function createPostgresStore(
  config: PostgresStoreConfig,
): Promise<PostgresStore> {
  const store = new PostgresStore(config);
  await store.initialize();
  return store;
}
