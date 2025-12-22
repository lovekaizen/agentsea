/**
 * Memory Storage Adapter
 *
 * In-memory storage adapter for development and testing.
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
 * MemoryStorageAdapter - In-memory storage for analytics
 */
export class MemoryStorageAdapter implements AnalyticsStorageAdapter {
  private readonly conversations = new Map<string, Conversation>();
  private readonly sessions = new Map<string, Session>();
  private readonly events: AnalyticsEvent[] = [];
  private readonly maxEvents: number;
  private readonly maxConversations: number;
  private readonly maxSessions: number;

  constructor(
    options: {
      maxEvents?: number;
      maxConversations?: number;
      maxSessions?: number;
    } = {},
  ) {
    this.maxEvents = options.maxEvents ?? 10000;
    this.maxConversations = options.maxConversations ?? 1000;
    this.maxSessions = options.maxSessions ?? 1000;
  }

  /**
   * Save a conversation
   */
  saveConversation(conversation: Conversation): Promise<void> {
    // Enforce max conversations limit
    if (
      this.conversations.size >= this.maxConversations &&
      !this.conversations.has(conversation.id)
    ) {
      // Remove oldest conversation (first one in map)
      const firstKey = this.conversations.keys().next().value;
      if (firstKey) {
        this.conversations.delete(firstKey);
      }
    }

    this.conversations.set(conversation.id, { ...conversation });
    return Promise.resolve();
  }

  /**
   * Get a conversation by ID
   */
  getConversation(id: string): Promise<Conversation | null> {
    const conversation = this.conversations.get(id);
    return Promise.resolve(conversation ? { ...conversation } : null);
  }

  /**
   * Update a conversation
   */
  updateConversation(
    id: string,
    updates: Partial<Conversation>,
  ): Promise<void> {
    const existing = this.conversations.get(id);
    if (!existing) {
      throw new Error(`Conversation not found: ${id}`);
    }

    this.conversations.set(id, {
      ...existing,
      ...updates,
      id: existing.id, // Prevent ID changes
    });
    return Promise.resolve();
  }

  /**
   * Query conversations
   */
  queryConversations(
    query: ConversationQuery,
  ): Promise<ConversationQueryResult> {
    let results = Array.from(this.conversations.values());

    // Apply time range filter
    if (query.timeRange) {
      results = results.filter(
        (c) =>
          c.startedAt >= query.timeRange!.start &&
          c.startedAt <= query.timeRange!.end,
      );
    }

    // Apply user ID filter
    if (query.userId) {
      results = results.filter((c) => c.userId === query.userId);
    }

    // Apply session ID filter
    if (query.sessionId) {
      results = results.filter((c) => c.sessionId === query.sessionId);
    }

    // Apply status filter
    if (query.status) {
      results = results.filter((c) => c.status === query.status);
    }

    // Apply intent filter
    if (query.intent) {
      results = results.filter((c) => c.intent?.primary === query.intent);
    }

    // Apply topic filter
    if (query.topic) {
      results = results.filter((c) => c.topics?.includes(query.topic!));
    }

    // Apply outcome filter
    if (query.outcome) {
      results = results.filter((c) => c.outcome?.success === query.outcome);
    }

    // Apply metadata filters
    if (query.metadata) {
      for (const [key, value] of Object.entries(query.metadata)) {
        results = results.filter((c) => c.metadata?.[key] === value);
      }
    }

    // Sort by startedAt descending (most recent first)
    results.sort((a, b) => b.startedAt - a.startedAt);

    // Apply pagination
    const total = results.length;
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 100;
    const paginatedResults = results.slice(offset, offset + limit);

    return Promise.resolve({
      conversations: paginatedResults,
      total,
      hasMore: offset + limit < total,
      offset,
      limit,
    });
  }

  /**
   * Save a session
   */
  saveSession(session: Session): Promise<void> {
    // Enforce max sessions limit
    if (
      this.sessions.size >= this.maxSessions &&
      !this.sessions.has(session.id)
    ) {
      const firstKey = this.sessions.keys().next().value;
      if (firstKey) {
        this.sessions.delete(firstKey);
      }
    }

    this.sessions.set(session.id, { ...session });
    return Promise.resolve();
  }

  /**
   * Get a session by ID
   */
  getSession(id: string): Promise<Session | null> {
    const session = this.sessions.get(id);
    return Promise.resolve(session ? { ...session } : null);
  }

  /**
   * Save an event
   */
  saveEvent(event: AnalyticsEvent): Promise<void> {
    // Enforce max events limit
    if (this.events.length >= this.maxEvents) {
      this.events.shift(); // Remove oldest event
    }

    this.events.push({ ...event });
    return Promise.resolve();
  }

  /**
   * Query events
   */
  queryEvents(query: EventQuery): Promise<AnalyticsEvent[]> {
    let results = [...this.events];

    // Apply time range filter
    if (query.timeRange) {
      results = results.filter(
        (e) =>
          e.timestamp >= query.timeRange!.start &&
          e.timestamp <= query.timeRange!.end,
      );
    }

    // Apply type filter
    if (query.type) {
      results = results.filter((e) => e.type === query.type);
    }

    // Apply conversation ID filter
    if (query.conversationId) {
      results = results.filter(
        (e) => e.conversationId === query.conversationId,
      );
    }

    // Apply user ID filter
    if (query.userId) {
      results = results.filter((e) => e.userId === query.userId);
    }

    // Apply session ID filter
    if (query.sessionId) {
      results = results.filter((e) => e.sessionId === query.sessionId);
    }

    // Sort by timestamp descending (most recent first)
    results.sort((a, b) => b.timestamp - a.timestamp);

    // Apply limit
    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return Promise.resolve(results);
  }

  /**
   * Run an aggregation query
   */
  aggregate(query: AggregationQuery): Promise<AggregationResult> {
    const timeRange = query.period;
    let value = 0;

    switch (query.metric) {
      case 'conversations': {
        let conversations = Array.from(this.conversations.values());
        if (timeRange) {
          conversations = conversations.filter(
            (c) =>
              c.startedAt >= timeRange.start && c.startedAt <= timeRange.end,
          );
        }
        value = this.applyAggregationFunction(
          conversations.map(() => 1),
          query.function,
        );
        break;
      }

      case 'successful_conversations': {
        let conversations = Array.from(this.conversations.values());
        if (timeRange) {
          conversations = conversations.filter(
            (c) =>
              c.startedAt >= timeRange.start && c.startedAt <= timeRange.end,
          );
        }
        const successful = conversations.filter((c) => c.outcome?.success);
        value = this.applyAggregationFunction(
          successful.map(() => 1),
          query.function,
        );
        break;
      }

      case 'conversation_duration': {
        let conversations = Array.from(this.conversations.values());
        if (timeRange) {
          conversations = conversations.filter(
            (c) =>
              c.startedAt >= timeRange.start && c.startedAt <= timeRange.end,
          );
        }
        const durations = conversations
          .filter((c) => c.endedAt)
          .map((c) => c.endedAt! - c.startedAt);
        value = this.applyAggregationFunction(durations, query.function);
        break;
      }

      case 'events': {
        let events = [...this.events];
        if (timeRange) {
          events = events.filter(
            (e) =>
              e.timestamp >= timeRange.start && e.timestamp <= timeRange.end,
          );
        }
        value = this.applyAggregationFunction(
          events.map(() => 1),
          query.function,
        );
        break;
      }

      case 'messages': {
        let conversations = Array.from(this.conversations.values());
        if (timeRange) {
          conversations = conversations.filter(
            (c) =>
              c.startedAt >= timeRange.start && c.startedAt <= timeRange.end,
          );
        }
        const messageCounts = conversations.map((c) => c.messages.length);
        value = this.applyAggregationFunction(messageCounts, query.function);
        break;
      }

      default:
        // Custom metric - would need to be implemented
        value = 0;
    }

    // Build buckets if granularity is specified
    let buckets: AggregationResult['buckets'];
    if (query.granularity && timeRange) {
      buckets = this.buildTimeBuckets(
        query.metric,
        timeRange,
        query.granularity,
        query.function,
      );
    }

    return Promise.resolve({
      value,
      period: timeRange ?? { start: 0, end: Date.now() },
      buckets,
    });
  }

  /**
   * Apply aggregation function to values
   */
  private applyAggregationFunction(
    values: number[],
    func: AggregationQuery['function'],
  ): number {
    if (values.length === 0) {
      return 0;
    }

    switch (func) {
      case 'count':
        return values.length;
      case 'sum':
        return values.reduce((a, b) => a + b, 0);
      case 'avg':
        return values.reduce((a, b) => a + b, 0) / values.length;
      case 'min':
        return Math.min(...values);
      case 'max':
        return Math.max(...values);
      case 'distinct':
        return new Set(values).size;
      default:
        return values.reduce((a, b) => a + b, 0);
    }
  }

  /**
   * Build time-based buckets for aggregation
   */
  private buildTimeBuckets(
    metric: string,
    timeRange: { start: number; end: number },
    granularity: string,
    func: AggregationQuery['function'],
  ): AggregationResult['buckets'] {
    const buckets: AggregationResult['buckets'] = [];
    const granularityMs = this.getGranularityMs(granularity);

    let currentStart = timeRange.start;
    while (currentStart < timeRange.end) {
      const currentEnd = Math.min(currentStart + granularityMs, timeRange.end);

      // Get values for this bucket
      let bucketValues: number[] = [];

      if (metric === 'conversations') {
        bucketValues = Array.from(this.conversations.values())
          .filter(
            (c) => c.startedAt >= currentStart && c.startedAt < currentEnd,
          )
          .map(() => 1);
      } else if (metric === 'events') {
        bucketValues = this.events
          .filter(
            (e) => e.timestamp >= currentStart && e.timestamp < currentEnd,
          )
          .map(() => 1);
      }

      buckets.push({
        key: new Date(currentStart).toISOString(),
        value: this.applyAggregationFunction(bucketValues, func),
        count: bucketValues.length,
      });

      currentStart = currentEnd;
    }

    return buckets;
  }

  /**
   * Convert granularity string to milliseconds
   */
  private getGranularityMs(granularity: string): number {
    switch (granularity) {
      case 'minute':
        return 60 * 1000;
      case 'hour':
        return 60 * 60 * 1000;
      case 'day':
        return 24 * 60 * 60 * 1000;
      case 'week':
        return 7 * 24 * 60 * 60 * 1000;
      case 'month':
        return 30 * 24 * 60 * 60 * 1000;
      default:
        return 24 * 60 * 60 * 1000;
    }
  }

  /**
   * Clear all data (useful for testing)
   */
  clear(): Promise<void> {
    this.conversations.clear();
    this.sessions.clear();
    this.events.length = 0;
    return Promise.resolve();
  }

  /**
   * Get statistics about stored data
   */
  getStats(): {
    conversationCount: number;
    sessionCount: number;
    eventCount: number;
    oldestConversation?: number;
    newestConversation?: number;
    oldestEvent?: number;
    newestEvent?: number;
  } {
    const conversations = Array.from(this.conversations.values());
    const stats: ReturnType<typeof this.getStats> = {
      conversationCount: conversations.length,
      sessionCount: this.sessions.size,
      eventCount: this.events.length,
    };

    if (conversations.length > 0) {
      const timestamps = conversations.map((c) => c.startedAt);
      stats.oldestConversation = Math.min(...timestamps);
      stats.newestConversation = Math.max(...timestamps);
    }

    if (this.events.length > 0) {
      const timestamps = this.events.map((e) => e.timestamp);
      stats.oldestEvent = Math.min(...timestamps);
      stats.newestEvent = Math.max(...timestamps);
    }

    return stats;
  }
}
