/**
 * PostgreSQL Storage Adapter
 *
 * PostgreSQL-based storage adapter for analytics data.
 * Uses node-postgres (pg) for database operations.
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
 * PostgreSQL storage configuration
 */
export interface PostgresStorageConfig {
  /** Connection string or config object */
  connectionString?: string;
  /** Host */
  host?: string;
  /** Port */
  port?: number;
  /** Database name */
  database?: string;
  /** Username */
  user?: string;
  /** Password */
  password?: string;
  /** Max connections in pool */
  max?: number;
  /** Idle timeout in ms */
  idleTimeoutMillis?: number;
  /** Connection timeout in ms */
  connectionTimeoutMillis?: number;
  /** SSL configuration */
  ssl?: boolean | object;
}

/**
 * Pool type (pg)
 */
interface Pool {
  query<T = unknown>(text: string, values?: unknown[]): Promise<QueryResult<T>>;
  end(): Promise<void>;
}

interface QueryResult<T> {
  rows: T[];
  rowCount: number | null;
}

/**
 * PostgresStorageAdapter - PostgreSQL-based storage for analytics
 */
export class PostgresStorageAdapter implements AnalyticsStorageAdapter {
  private pool: Pool | null = null;
  private readonly config: PostgresStorageConfig;

  constructor(config: PostgresStorageConfig) {
    this.config = {
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      ...config,
    };
  }

  /**
   * Initialize the database
   */
  async initialize(): Promise<void> {
    // Dynamic import for pg
    const { Pool } = await import('pg');

    this.pool = new Pool(this.config) as unknown as Pool;

    // Create tables
    await this.createTables();
  }

  /**
   * Create database tables
   */
  private async createTables(): Promise<void> {
    if (!this.pool) throw new Error('Database not initialized');

    await this.pool.query(`
      -- Conversations table
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        session_id TEXT,
        started_at BIGINT NOT NULL,
        ended_at BIGINT,
        status TEXT NOT NULL DEFAULT 'active',
        outcome_json JSONB,
        intent_json JSONB,
        sentiment_json JSONB,
        topics_json JSONB,
        metadata_json JSONB,
        tags_json JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Messages table
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp BIGINT NOT NULL,
        tokens_json JSONB,
        latency_ms INTEGER,
        model TEXT,
        tool_calls_json JSONB,
        sentiment_json JSONB,
        intent_json JSONB,
        metadata_json JSONB
      );

      -- Events table
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT,
        timestamp BIGINT NOT NULL,
        conversation_id TEXT,
        user_id TEXT,
        session_id TEXT,
        data_json JSONB NOT NULL,
        properties_json JSONB,
        metadata_json JSONB
      );

      -- Sessions table
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        started_at BIGINT NOT NULL,
        ended_at BIGINT,
        last_activity_at BIGINT,
        conversation_ids_json JSONB DEFAULT '[]'::jsonb,
        platform TEXT,
        device_json JSONB,
        location_json JSONB,
        page_views INTEGER DEFAULT 0,
        events_count INTEGER DEFAULT 0,
        metadata_json JSONB
      );

      -- Create indexes if they don't exist
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
  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  /**
   * Save a conversation
   */
  async saveConversation(conversation: Conversation): Promise<void> {
    if (!this.pool) throw new Error('Database not initialized');

    await this.pool.query(
      `
      INSERT INTO conversations (
        id, user_id, session_id, started_at, ended_at, status,
        outcome_json, intent_json, sentiment_json, topics_json,
        metadata_json, tags_json
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        session_id = EXCLUDED.session_id,
        started_at = EXCLUDED.started_at,
        ended_at = EXCLUDED.ended_at,
        status = EXCLUDED.status,
        outcome_json = EXCLUDED.outcome_json,
        intent_json = EXCLUDED.intent_json,
        sentiment_json = EXCLUDED.sentiment_json,
        topics_json = EXCLUDED.topics_json,
        metadata_json = EXCLUDED.metadata_json,
        tags_json = EXCLUDED.tags_json
      `,
      [
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
      ],
    );

    // Save messages
    for (const msg of conversation.messages) {
      await this.pool.query(
        `
        INSERT INTO messages (
          id, conversation_id, role, content, timestamp,
          tokens_json, latency_ms, model, tool_calls_json,
          sentiment_json, intent_json, metadata_json
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET
          role = EXCLUDED.role,
          content = EXCLUDED.content,
          timestamp = EXCLUDED.timestamp,
          tokens_json = EXCLUDED.tokens_json,
          latency_ms = EXCLUDED.latency_ms,
          model = EXCLUDED.model,
          tool_calls_json = EXCLUDED.tool_calls_json,
          sentiment_json = EXCLUDED.sentiment_json,
          intent_json = EXCLUDED.intent_json,
          metadata_json = EXCLUDED.metadata_json
        `,
        [
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
        ],
      );
    }
  }

  /**
   * Get a conversation by ID
   */
  async getConversation(id: string): Promise<Conversation | null> {
    if (!this.pool) throw new Error('Database not initialized');

    const result = await this.pool.query<Record<string, unknown>>(
      'SELECT * FROM conversations WHERE id = $1',
      [id],
    );

    if (result.rows.length === 0) return null;

    const messagesResult = await this.pool.query<Record<string, unknown>>(
      'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY timestamp ASC',
      [id],
    );

    return this.rowToConversation(result.rows[0], messagesResult.rows);
  }

  /**
   * Update a conversation
   */
  async updateConversation(
    id: string,
    updates: Partial<Conversation>,
  ): Promise<void> {
    if (!this.pool) throw new Error('Database not initialized');

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
  async queryConversations(
    query: ConversationQuery,
  ): Promise<ConversationQueryResult> {
    if (!this.pool) throw new Error('Database not initialized');

    let sql = 'SELECT * FROM conversations WHERE true';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (query.userId) {
      sql += ` AND user_id = $${paramIndex++}`;
      params.push(query.userId);
    }

    if (query.sessionId) {
      sql += ` AND session_id = $${paramIndex++}`;
      params.push(query.sessionId);
    }

    if (query.status) {
      if (Array.isArray(query.status)) {
        const placeholders = query.status
          .map(() => `$${paramIndex++}`)
          .join(',');
        sql += ` AND status IN (${placeholders})`;
        params.push(...query.status);
      } else {
        sql += ` AND status = $${paramIndex++}`;
        params.push(query.status);
      }
    }

    if (query.timeRange) {
      sql += ` AND started_at >= $${paramIndex++} AND started_at <= $${paramIndex++}`;
      params.push(query.timeRange.start, query.timeRange.end);
    }

    if (query.intent) {
      sql += ` AND intent_json->>'primary' = $${paramIndex++}`;
      params.push(query.intent);
    }

    if (query.outcome !== undefined) {
      sql += ` AND (outcome_json->>'success')::boolean = $${paramIndex++}`;
      params.push(query.outcome);
    }

    // Get total count
    const countSql = sql.replace(
      'SELECT *',
      'SELECT COUNT(*)::integer as count',
    );
    const countResult = await this.pool.query<{ count: number }>(
      countSql,
      params,
    );
    const total = countResult.rows[0].count;

    // Add sorting and pagination
    sql += ' ORDER BY started_at DESC';

    const limit = query.limit ?? 100;
    const offset = query.offset ?? 0;
    sql += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const result = await this.pool.query<Record<string, unknown>>(sql, params);

    const conversations: Conversation[] = [];
    for (const row of result.rows) {
      const messagesResult = await this.pool.query<Record<string, unknown>>(
        'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY timestamp ASC',
        [row.id],
      );
      conversations.push(this.rowToConversation(row, messagesResult.rows));
    }

    return {
      conversations,
      total,
      hasMore: offset + limit < total,
      offset,
      limit,
    };
  }

  /**
   * Save an event
   */
  async saveEvent(event: AnalyticsEvent): Promise<void> {
    if (!this.pool) throw new Error('Database not initialized');

    await this.pool.query(
      `
      INSERT INTO events (
        id, type, name, timestamp, conversation_id, user_id, session_id,
        data_json, properties_json, metadata_json
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        type = EXCLUDED.type,
        name = EXCLUDED.name,
        timestamp = EXCLUDED.timestamp,
        conversation_id = EXCLUDED.conversation_id,
        user_id = EXCLUDED.user_id,
        session_id = EXCLUDED.session_id,
        data_json = EXCLUDED.data_json,
        properties_json = EXCLUDED.properties_json,
        metadata_json = EXCLUDED.metadata_json
      `,
      [
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
      ],
    );
  }

  /**
   * Query events
   */
  async queryEvents(query: EventQuery): Promise<AnalyticsEvent[]> {
    if (!this.pool) throw new Error('Database not initialized');

    let sql = 'SELECT * FROM events WHERE true';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (query.type) {
      if (Array.isArray(query.type)) {
        const placeholders = query.type.map(() => `$${paramIndex++}`).join(',');
        sql += ` AND type IN (${placeholders})`;
        params.push(...query.type);
      } else {
        sql += ` AND type = $${paramIndex++}`;
        params.push(query.type);
      }
    }

    if (query.conversationId) {
      sql += ` AND conversation_id = $${paramIndex++}`;
      params.push(query.conversationId);
    }

    if (query.userId) {
      sql += ` AND user_id = $${paramIndex++}`;
      params.push(query.userId);
    }

    if (query.sessionId) {
      sql += ` AND session_id = $${paramIndex++}`;
      params.push(query.sessionId);
    }

    if (query.timeRange) {
      sql += ` AND timestamp >= $${paramIndex++} AND timestamp <= $${paramIndex++}`;
      params.push(query.timeRange.start, query.timeRange.end);
    }

    sql += ' ORDER BY timestamp DESC';

    if (query.limit) {
      sql += ` LIMIT $${paramIndex++}`;
      params.push(query.limit);
    }

    const result = await this.pool.query<Record<string, unknown>>(sql, params);
    return result.rows.map((row) => this.rowToEvent(row));
  }

  /**
   * Save a session
   */
  async saveSession(session: Session): Promise<void> {
    if (!this.pool) throw new Error('Database not initialized');

    await this.pool.query(
      `
      INSERT INTO sessions (
        id, user_id, started_at, ended_at, last_activity_at,
        conversation_ids_json, platform, device_json, location_json,
        page_views, events_count, metadata_json
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        started_at = EXCLUDED.started_at,
        ended_at = EXCLUDED.ended_at,
        last_activity_at = EXCLUDED.last_activity_at,
        conversation_ids_json = EXCLUDED.conversation_ids_json,
        platform = EXCLUDED.platform,
        device_json = EXCLUDED.device_json,
        location_json = EXCLUDED.location_json,
        page_views = EXCLUDED.page_views,
        events_count = EXCLUDED.events_count,
        metadata_json = EXCLUDED.metadata_json
      `,
      [
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
      ],
    );
  }

  /**
   * Get a session by ID
   */
  async getSession(id: string): Promise<Session | null> {
    if (!this.pool) throw new Error('Database not initialized');

    const result = await this.pool.query<Record<string, unknown>>(
      'SELECT * FROM sessions WHERE id = $1',
      [id],
    );

    if (result.rows.length === 0) return null;
    return this.rowToSession(result.rows[0]);
  }

  /**
   * Run an aggregation query
   */
  async aggregate(query: AggregationQuery): Promise<AggregationResult> {
    if (!this.pool) throw new Error('Database not initialized');

    const timeRange = query.period;
    let value = 0;

    switch (query.metric) {
      case 'conversations': {
        let sql =
          'SELECT COUNT(*)::integer as count FROM conversations WHERE true';
        const params: unknown[] = [];
        let paramIndex = 1;
        if (timeRange) {
          sql += ` AND started_at >= $${paramIndex++} AND started_at <= $${paramIndex++}`;
          params.push(timeRange.start, timeRange.end);
        }
        const result = await this.pool.query<{ count: number }>(sql, params);
        value = result.rows[0].count;
        break;
      }

      case 'successful_conversations': {
        let sql =
          "SELECT COUNT(*)::integer as count FROM conversations WHERE (outcome_json->>'success')::boolean = true";
        const params: unknown[] = [];
        let paramIndex = 1;
        if (timeRange) {
          sql += ` AND started_at >= $${paramIndex++} AND started_at <= $${paramIndex++}`;
          params.push(timeRange.start, timeRange.end);
        }
        const result = await this.pool.query<{ count: number }>(sql, params);
        value = result.rows[0].count;
        break;
      }

      case 'conversation_duration': {
        let sql =
          'SELECT AVG(ended_at - started_at)::float as avg FROM conversations WHERE ended_at IS NOT NULL';
        const params: unknown[] = [];
        let paramIndex = 1;
        if (timeRange) {
          sql += ` AND started_at >= $${paramIndex++} AND started_at <= $${paramIndex++}`;
          params.push(timeRange.start, timeRange.end);
        }
        const result = await this.pool.query<{ avg: number | null }>(
          sql,
          params,
        );
        value = result.rows[0].avg ?? 0;
        break;
      }

      case 'events': {
        let sql = 'SELECT COUNT(*)::integer as count FROM events WHERE true';
        const params: unknown[] = [];
        let paramIndex = 1;
        if (timeRange) {
          sql += ` AND timestamp >= $${paramIndex++} AND timestamp <= $${paramIndex++}`;
          params.push(timeRange.start, timeRange.end);
        }
        const result = await this.pool.query<{ count: number }>(sql, params);
        value = result.rows[0].count;
        break;
      }

      case 'messages': {
        let sql = 'SELECT COUNT(*)::integer as count FROM messages WHERE true';
        const params: unknown[] = [];
        let paramIndex = 1;
        if (timeRange) {
          sql += ` AND timestamp >= $${paramIndex++} AND timestamp <= $${paramIndex++}`;
          params.push(timeRange.start, timeRange.end);
        }
        const result = await this.pool.query<{ count: number }>(sql, params);
        value = result.rows[0].count;
        break;
      }

      default:
        value = 0;
    }

    return {
      value,
      period: timeRange ?? { start: 0, end: Date.now() },
    };
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
      startedAt: Number(row.started_at),
      endedAt: row.ended_at ? Number(row.ended_at) : undefined,
      status: row.status as Conversation['status'],
      outcome: row.outcome_json as Conversation['outcome'] | undefined,
      intent: row.intent_json as Conversation['intent'] | undefined,
      sentiment: row.sentiment_json as Conversation['sentiment'] | undefined,
      topics: row.topics_json as string[] | undefined,
      metadata: row.metadata_json as Record<string, unknown> | undefined,
      tags: row.tags_json as string[] | undefined,
      messages: messageRows.map((msg) => ({
        id: msg.id as string,
        conversationId: msg.conversation_id as string,
        role: msg.role as 'user' | 'assistant' | 'system' | 'tool',
        content: msg.content as string,
        timestamp: Number(msg.timestamp),
        tokens: msg.tokens_json as
          | Conversation['messages'][0]['tokens']
          | undefined,
        latencyMs: msg.latency_ms as number | undefined,
        model: msg.model as string | undefined,
        toolCalls: msg.tool_calls_json as
          | Conversation['messages'][0]['toolCalls']
          | undefined,
        sentiment: msg.sentiment_json as
          | Conversation['messages'][0]['sentiment']
          | undefined,
        intent: msg.intent_json as
          | Conversation['messages'][0]['intent']
          | undefined,
        metadata: msg.metadata_json as Record<string, unknown> | undefined,
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
      timestamp: Number(row.timestamp),
      conversationId: row.conversation_id as string | undefined,
      userId: row.user_id as string | undefined,
      sessionId: row.session_id as string | undefined,
      data: row.data_json as Record<string, unknown>,
      properties: row.properties_json as Record<string, unknown> | undefined,
      metadata: row.metadata_json as Record<string, unknown> | undefined,
    };
  }

  /**
   * Convert database row to Session
   */
  private rowToSession(row: Record<string, unknown>): Session {
    return {
      id: row.id as string,
      userId: row.user_id as string | undefined,
      startedAt: Number(row.started_at),
      endedAt: row.ended_at ? Number(row.ended_at) : undefined,
      lastActivityAt: row.last_activity_at
        ? Number(row.last_activity_at)
        : undefined,
      conversationIds: row.conversation_ids_json as string[],
      platform: row.platform as string | undefined,
      device: row.device_json as Session['device'] | undefined,
      location: row.location_json as Session['location'] | undefined,
      pageViews: row.page_views as number | undefined,
      events: row.events_count as number | undefined,
      metadata: row.metadata_json as Record<string, unknown> | undefined,
    };
  }
}
