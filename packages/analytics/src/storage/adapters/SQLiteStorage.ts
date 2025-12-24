/**
 * SQLite Storage Adapter
 *
 * SQLite-based storage adapter for analytics data.
 * Uses better-sqlite3 for synchronous operations with async wrapper.
 */

import type {
  AnalyticsStorageAdapter,
  Conversation,
  Session,
  AnalyticsEvent,
  ConversationQuery,
  ConversationQueryResult,
  EventQuery,
  AggregationQuery,
  AggregationResult,
} from '../../types/index.js';

/**
 * SQLite storage configuration
 */
export interface SQLiteStorageConfig {
  /** Database file path (or :memory: for in-memory) */
  filename: string;
  /** Enable WAL mode for better concurrency */
  walMode?: boolean;
  /** Enable foreign keys */
  foreignKeys?: boolean;
  /** Busy timeout in ms */
  busyTimeout?: number;
}

/**
 * Database instance type (better-sqlite3)
 */
interface Database {
  prepare(sql: string): Statement;
  exec(sql: string): void;
  pragma(sql: string): unknown;
  close(): void;
}

interface Statement {
  run(...params: unknown[]): RunResult;
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

interface RunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

/**
 * SQLiteStorageAdapter - SQLite-based storage for analytics
 */
export class SQLiteStorageAdapter implements AnalyticsStorageAdapter {
  private db: Database | null = null;
  private readonly config: SQLiteStorageConfig;

  constructor(config: SQLiteStorageConfig) {
    this.config = {
      walMode: true,
      foreignKeys: true,
      busyTimeout: 5000,
      ...config,
    };
  }

  /**
   * Initialize the database
   */
  async initialize(): Promise<void> {
    // Dynamic import for better-sqlite3
    const BetterSqlite3 = (await import('better-sqlite3')).default;

    this.db = new BetterSqlite3(this.config.filename) as unknown as Database;

    // Configure database
    if (this.config.walMode) {
      this.db.pragma('journal_mode = WAL');
    }
    if (this.config.foreignKeys) {
      this.db.pragma('foreign_keys = ON');
    }
    if (this.config.busyTimeout) {
      this.db.pragma(`busy_timeout = ${this.config.busyTimeout}`);
    }

    // Create tables
    this.createTables();
  }

  /**
   * Create database tables
   */
  private createTables(): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.exec(`
      -- Conversations table
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        session_id TEXT,
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        status TEXT NOT NULL DEFAULT 'active',
        outcome_json TEXT,
        intent_json TEXT,
        sentiment_json TEXT,
        topics_json TEXT,
        metadata_json TEXT,
        tags_json TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      );

      -- Messages table
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        tokens_json TEXT,
        latency_ms INTEGER,
        model TEXT,
        tool_calls_json TEXT,
        sentiment_json TEXT,
        intent_json TEXT,
        metadata_json TEXT,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );

      -- Events table
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT,
        timestamp INTEGER NOT NULL,
        conversation_id TEXT,
        user_id TEXT,
        session_id TEXT,
        data_json TEXT NOT NULL,
        properties_json TEXT,
        metadata_json TEXT
      );

      -- Sessions table
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        last_activity_at INTEGER,
        conversation_ids_json TEXT DEFAULT '[]',
        platform TEXT,
        device_json TEXT,
        location_json TEXT,
        page_views INTEGER DEFAULT 0,
        events INTEGER DEFAULT 0,
        metadata_json TEXT
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_started_at ON conversations(started_at);
      CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);

      CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);

      CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
      CREATE INDEX IF NOT EXISTS idx_events_conversation_id ON events(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
      CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);

      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at);
    `);
  }

  /**
   * Close the database connection
   */
  close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    return Promise.resolve();
  }

  /**
   * Save a conversation
   */
  saveConversation(conversation: Conversation): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO conversations (
        id, user_id, session_id, started_at, ended_at, status,
        outcome_json, intent_json, sentiment_json, topics_json,
        metadata_json, tags_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      conversation.id,
      conversation.userId ?? null,
      conversation.sessionId ?? null,
      conversation.startedAt,
      conversation.endedAt ?? null,
      conversation.status,
      conversation.outcome ? JSON.stringify(conversation.outcome) : null,
      conversation.intent ? JSON.stringify(conversation.intent) : null,
      conversation.sentiment ? JSON.stringify(conversation.sentiment) : null,
      conversation.topics ? JSON.stringify(conversation.topics) : null,
      conversation.metadata ? JSON.stringify(conversation.metadata) : null,
      conversation.tags ? JSON.stringify(conversation.tags) : null,
    );

    // Save messages
    if (conversation.messages.length > 0) {
      const msgStmt = this.db.prepare(`
        INSERT OR REPLACE INTO messages (
          id, conversation_id, role, content, timestamp,
          tokens_json, latency_ms, model, tool_calls_json,
          sentiment_json, intent_json, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const msg of conversation.messages) {
        msgStmt.run(
          msg.id,
          msg.conversationId,
          msg.role,
          msg.content,
          msg.timestamp,
          msg.tokens ? JSON.stringify(msg.tokens) : null,
          msg.latencyMs ?? null,
          msg.model ?? null,
          msg.toolCalls ? JSON.stringify(msg.toolCalls) : null,
          msg.sentiment ? JSON.stringify(msg.sentiment) : null,
          msg.intent ? JSON.stringify(msg.intent) : null,
          msg.metadata ? JSON.stringify(msg.metadata) : null,
        );
      }
    }

    return Promise.resolve();
  }

  /**
   * Get a conversation by ID
   */
  getConversation(id: string): Promise<Conversation | null> {
    if (!this.db) throw new Error('Database not initialized');

    const row = this.db
      .prepare(
        `
      SELECT * FROM conversations WHERE id = ?
    `,
      )
      .get(id) as Record<string, unknown> | undefined;

    if (!row) return Promise.resolve(null);

    // Get messages
    const messages = this.db
      .prepare(
        `
      SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC
    `,
      )
      .all(id) as Array<Record<string, unknown>>;

    return Promise.resolve(this.rowToConversation(row, messages));
  }

  /**
   * Update a conversation
   */
  async updateConversation(
    id: string,
    updates: Partial<Conversation>,
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const existing = await this.getConversation(id);
    if (!existing) {
      throw new Error(`Conversation not found: ${id}`);
    }

    const merged = { ...existing, ...updates };
    await this.saveConversation(merged);
  }

  /**
   * Query conversations
   */
  queryConversations(
    query: ConversationQuery,
  ): Promise<ConversationQueryResult> {
    if (!this.db) throw new Error('Database not initialized');

    let sql = 'SELECT * FROM conversations WHERE 1=1';
    const params: unknown[] = [];

    if (query.userId) {
      sql += ' AND user_id = ?';
      params.push(query.userId);
    }

    if (query.sessionId) {
      sql += ' AND session_id = ?';
      params.push(query.sessionId);
    }

    if (query.status) {
      if (Array.isArray(query.status)) {
        sql += ` AND status IN (${query.status.map(() => '?').join(',')})`;
        params.push(...query.status);
      } else {
        sql += ' AND status = ?';
        params.push(query.status);
      }
    }

    if (query.timeRange) {
      sql += ' AND started_at >= ? AND started_at <= ?';
      params.push(query.timeRange.start, query.timeRange.end);
    }

    if (query.intent) {
      sql += " AND json_extract(intent_json, '$.primary') = ?";
      params.push(query.intent);
    }

    if (query.outcome !== undefined) {
      sql += " AND json_extract(outcome_json, '$.success') = ?";
      params.push(query.outcome ? 1 : 0);
    }

    // Get total count
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countRow = this.db.prepare(countSql).get(...params) as {
      count: number;
    };
    const total = countRow.count;

    // Add sorting and pagination
    sql += ' ORDER BY started_at DESC';

    const limit = query.limit ?? 100;
    const offset = query.offset ?? 0;
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = this.db.prepare(sql).all(...params) as Array<
      Record<string, unknown>
    >;

    const conversations: Conversation[] = [];
    for (const row of rows) {
      const messages = this.db
        .prepare(
          `
        SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC
      `,
        )
        .all(row.id as string) as Array<Record<string, unknown>>;
      conversations.push(this.rowToConversation(row, messages));
    }

    return Promise.resolve({
      conversations,
      total,
      hasMore: offset + limit < total,
      offset,
      limit,
    });
  }

  /**
   * Save an event
   */
  saveEvent(event: AnalyticsEvent): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO events (
        id, type, name, timestamp, conversation_id, user_id, session_id,
        data_json, properties_json, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      event.id,
      event.type,
      event.name ?? null,
      event.timestamp,
      event.conversationId ?? null,
      event.userId ?? null,
      event.sessionId ?? null,
      JSON.stringify(event.data),
      event.properties ? JSON.stringify(event.properties) : null,
      event.metadata ? JSON.stringify(event.metadata) : null,
    );

    return Promise.resolve();
  }

  /**
   * Query events
   */
  queryEvents(query: EventQuery): Promise<AnalyticsEvent[]> {
    if (!this.db) throw new Error('Database not initialized');

    let sql = 'SELECT * FROM events WHERE 1=1';
    const params: unknown[] = [];

    if (query.type) {
      if (Array.isArray(query.type)) {
        sql += ` AND type IN (${query.type.map(() => '?').join(',')})`;
        params.push(...query.type);
      } else {
        sql += ' AND type = ?';
        params.push(query.type);
      }
    }

    if (query.conversationId) {
      sql += ' AND conversation_id = ?';
      params.push(query.conversationId);
    }

    if (query.userId) {
      sql += ' AND user_id = ?';
      params.push(query.userId);
    }

    if (query.sessionId) {
      sql += ' AND session_id = ?';
      params.push(query.sessionId);
    }

    if (query.timeRange) {
      sql += ' AND timestamp >= ? AND timestamp <= ?';
      params.push(query.timeRange.start, query.timeRange.end);
    }

    sql += ' ORDER BY timestamp DESC';

    if (query.limit) {
      sql += ' LIMIT ?';
      params.push(query.limit);
    }

    const rows = this.db.prepare(sql).all(...params) as Array<
      Record<string, unknown>
    >;
    return Promise.resolve(rows.map((row) => this.rowToEvent(row)));
  }

  /**
   * Save a session
   */
  saveSession(session: Session): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO sessions (
        id, user_id, started_at, ended_at, last_activity_at,
        conversation_ids_json, platform, device_json, location_json,
        page_views, events, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      session.id,
      session.userId ?? null,
      session.startedAt,
      session.endedAt ?? null,
      session.lastActivityAt ?? null,
      JSON.stringify(session.conversationIds),
      session.platform ?? null,
      session.device ? JSON.stringify(session.device) : null,
      session.location ? JSON.stringify(session.location) : null,
      session.pageViews ?? 0,
      session.events ?? 0,
      session.metadata ? JSON.stringify(session.metadata) : null,
    );

    return Promise.resolve();
  }

  /**
   * Get a session by ID
   */
  getSession(id: string): Promise<Session | null> {
    if (!this.db) throw new Error('Database not initialized');

    const row = this.db
      .prepare(
        `
      SELECT * FROM sessions WHERE id = ?
    `,
      )
      .get(id) as Record<string, unknown> | undefined;

    if (!row) return Promise.resolve(null);
    return Promise.resolve(this.rowToSession(row));
  }

  /**
   * Run an aggregation query
   */
  aggregate(query: AggregationQuery): Promise<AggregationResult> {
    if (!this.db) throw new Error('Database not initialized');

    const timeRange = query.period;
    let value = 0;

    switch (query.metric) {
      case 'conversations': {
        let sql = 'SELECT COUNT(*) as count FROM conversations WHERE 1=1';
        const params: unknown[] = [];
        if (timeRange) {
          sql += ' AND started_at >= ? AND started_at <= ?';
          params.push(timeRange.start, timeRange.end);
        }
        const row = this.db.prepare(sql).get(...params) as { count: number };
        value = row.count;
        break;
      }

      case 'successful_conversations': {
        let sql =
          "SELECT COUNT(*) as count FROM conversations WHERE json_extract(outcome_json, '$.success') = 1";
        const params: unknown[] = [];
        if (timeRange) {
          sql += ' AND started_at >= ? AND started_at <= ?';
          params.push(timeRange.start, timeRange.end);
        }
        const row = this.db.prepare(sql).get(...params) as { count: number };
        value = row.count;
        break;
      }

      case 'conversation_duration': {
        let sql =
          'SELECT AVG(ended_at - started_at) as avg FROM conversations WHERE ended_at IS NOT NULL';
        const params: unknown[] = [];
        if (timeRange) {
          sql += ' AND started_at >= ? AND started_at <= ?';
          params.push(timeRange.start, timeRange.end);
        }
        const row = this.db.prepare(sql).get(...params) as {
          avg: number | null;
        };
        value = row.avg ?? 0;
        break;
      }

      case 'events': {
        let sql = 'SELECT COUNT(*) as count FROM events WHERE 1=1';
        const params: unknown[] = [];
        if (timeRange) {
          sql += ' AND timestamp >= ? AND timestamp <= ?';
          params.push(timeRange.start, timeRange.end);
        }
        const row = this.db.prepare(sql).get(...params) as { count: number };
        value = row.count;
        break;
      }

      case 'messages': {
        let sql = 'SELECT COUNT(*) as count FROM messages WHERE 1=1';
        const params: unknown[] = [];
        if (timeRange) {
          sql += ' AND timestamp >= ? AND timestamp <= ?';
          params.push(timeRange.start, timeRange.end);
        }
        const row = this.db.prepare(sql).get(...params) as { count: number };
        value = row.count;
        break;
      }

      default:
        value = 0;
    }

    return Promise.resolve({
      value,
      period: timeRange ?? { start: 0, end: Date.now() },
    });
  }

  /**
   * Convert database row to Conversation
   */
  private rowToConversation(
    row: Record<string, unknown>,
    messageRows: Array<Record<string, unknown>>,
  ): Conversation {
    return {
      id: row.id as string,
      userId: row.user_id as string | undefined,
      sessionId: row.session_id as string | undefined,
      startedAt: row.started_at as number,
      endedAt: row.ended_at as number | undefined,
      status: row.status as Conversation['status'],
      outcome: row.outcome_json
        ? JSON.parse(row.outcome_json as string)
        : undefined,
      intent: row.intent_json
        ? JSON.parse(row.intent_json as string)
        : undefined,
      sentiment: row.sentiment_json
        ? JSON.parse(row.sentiment_json as string)
        : undefined,
      topics: row.topics_json
        ? JSON.parse(row.topics_json as string)
        : undefined,
      metadata: row.metadata_json
        ? JSON.parse(row.metadata_json as string)
        : undefined,
      tags: row.tags_json ? JSON.parse(row.tags_json as string) : undefined,
      messages: messageRows.map((msg) => ({
        id: msg.id as string,
        conversationId: msg.conversation_id as string,
        role: msg.role as 'user' | 'assistant' | 'system' | 'tool',
        content: msg.content as string,
        timestamp: msg.timestamp as number,
        tokens: msg.tokens_json
          ? JSON.parse(msg.tokens_json as string)
          : undefined,
        latencyMs: msg.latency_ms as number | undefined,
        model: msg.model as string | undefined,
        toolCalls: msg.tool_calls_json
          ? JSON.parse(msg.tool_calls_json as string)
          : undefined,
        sentiment: msg.sentiment_json
          ? JSON.parse(msg.sentiment_json as string)
          : undefined,
        intent: msg.intent_json
          ? JSON.parse(msg.intent_json as string)
          : undefined,
        metadata: msg.metadata_json
          ? JSON.parse(msg.metadata_json as string)
          : undefined,
      })),
    };
  }

  /**
   * Convert database row to Event
   */
  private rowToEvent(row: Record<string, unknown>): AnalyticsEvent {
    return {
      id: row.id as string,
      type: row.type as AnalyticsEvent['type'],
      name: row.name as string | undefined,
      timestamp: row.timestamp as number,
      conversationId: row.conversation_id as string | undefined,
      userId: row.user_id as string | undefined,
      sessionId: row.session_id as string | undefined,
      data: JSON.parse(row.data_json as string),
      properties: row.properties_json
        ? JSON.parse(row.properties_json as string)
        : undefined,
      metadata: row.metadata_json
        ? JSON.parse(row.metadata_json as string)
        : undefined,
    };
  }

  /**
   * Convert database row to Session
   */
  private rowToSession(row: Record<string, unknown>): Session {
    return {
      id: row.id as string,
      userId: row.user_id as string | undefined,
      startedAt: row.started_at as number,
      endedAt: row.ended_at as number | undefined,
      lastActivityAt: row.last_activity_at as number | undefined,
      conversationIds: JSON.parse(row.conversation_ids_json as string),
      platform: row.platform as string | undefined,
      device: row.device_json
        ? JSON.parse(row.device_json as string)
        : undefined,
      location: row.location_json
        ? JSON.parse(row.location_json as string)
        : undefined,
      pageViews: row.page_views as number | undefined,
      events: row.events as number | undefined,
      metadata: row.metadata_json
        ? JSON.parse(row.metadata_json as string)
        : undefined,
    };
  }
}
