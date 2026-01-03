/**
 * Analytics Core
 *
 * Main analytics class that orchestrates all analytics functionality.
 */

import { EventEmitter } from 'eventemitter3';
import type {
  AnalyticsConfig,
  Conversation,
  AnalyticsEvent,
  Session,
  AnalyticsStorageAdapter,
  ConversationQuery,
  ConversationQueryResult,
  EventQuery,
  AggregationQuery,
  AggregationResult,
  TimePeriod,
  TimeRange,
} from '../types/index.js';
import { ConversationManager } from './Conversation.js';
import { EventManager } from './Event.js';
import { SessionManager } from './Session.js';
import { MemoryStorageAdapter } from '../storage/adapters/MemoryStorage.js';

/**
 * Analytics events
 */
export interface AnalyticsEvents {
  'conversation:created': (conversation: Conversation) => void;
  'conversation:updated': (conversation: Conversation) => void;
  'conversation:ended': (conversation: Conversation) => void;
  'event:tracked': (event: AnalyticsEvent) => void;
  'session:created': (session: Session) => void;
  'session:ended': (session: Session) => void;
  error: (error: Error) => void;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: AnalyticsConfig = {
  enabled: true,
  batchConfig: {
    enabled: true,
    maxSize: 100,
    maxAge: 5000,
    flushOnShutdown: true,
  },
  anonymization: {
    enabled: false,
    hashUserIds: false,
    removeIPs: false,
    fieldsToAnonymize: [],
  },
  sampling: {
    enabled: false,
    rate: 1.0,
  },
};

/**
 * Analytics - Main analytics orchestration class
 */
export class Analytics extends EventEmitter<AnalyticsEvents> {
  private readonly config: AnalyticsConfig;
  private readonly storage: AnalyticsStorageAdapter;
  private readonly conversations: ConversationManager;
  private readonly events: EventManager;
  private readonly sessions: SessionManager;
  private isInitialized = false;

  constructor(config: Partial<AnalyticsConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.storage = config.storage ?? new MemoryStorageAdapter();

    // Initialize managers
    this.conversations = new ConversationManager(this.storage, this.config);
    this.events = new EventManager(this.storage, this.config);
    this.sessions = new SessionManager(this.storage, this.config);

    // Forward events
    this.setupEventForwarding();
  }

  /**
   * Initialize analytics
   */
  initialize(): void {
    if (this.isInitialized) {
      return;
    }

    this.conversations.initialize();
    this.events.initialize();
    this.sessions.initialize();

    this.isInitialized = true;
  }

  /**
   * Shutdown analytics
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    await this.events.flush();
    await this.conversations.flush();
    this.sessions.flush();

    this.isInitialized = false;
  }

  /**
   * Setup event forwarding from managers
   */
  private setupEventForwarding(): void {
    this.conversations.on('created', (conv) =>
      this.emit('conversation:created', conv),
    );
    this.conversations.on('updated', (conv) =>
      this.emit('conversation:updated', conv),
    );
    this.conversations.on('ended', (conv) =>
      this.emit('conversation:ended', conv),
    );

    this.events.on('tracked', (event) => this.emit('event:tracked', event));

    this.sessions.on('created', (session) =>
      this.emit('session:created', session),
    );
    this.sessions.on('ended', (session) => this.emit('session:ended', session));
  }

  // ==================== Conversation Methods ====================

  /**
   * Start a new conversation
   */
  async startConversation(
    options: {
      userId?: string;
      sessionId?: string;
      metadata?: Record<string, unknown>;
    } = {},
  ): Promise<Conversation> {
    if (!this.config.enabled) {
      throw new Error('Analytics is disabled');
    }
    return this.conversations.create(options);
  }

  /**
   * Get a conversation by ID
   */
  async getConversation(id: string): Promise<Conversation | null> {
    return this.conversations.get(id);
  }

  /**
   * Update a conversation
   */
  async updateConversation(
    id: string,
    updates: Partial<Conversation>,
  ): Promise<Conversation> {
    return this.conversations.update(id, updates);
  }

  /**
   * End a conversation
   */
  async endConversation(
    id: string,
    outcome?: Conversation['outcome'],
  ): Promise<Conversation> {
    return this.conversations.end(id, outcome);
  }

  /**
   * Add a message to a conversation
   */
  async addMessage(
    conversationId: string,
    message: Omit<Conversation['messages'][0], 'id' | 'timestamp'>,
  ): Promise<Conversation> {
    return this.conversations.addMessage(conversationId, message);
  }

  /**
   * Query conversations
   */
  async queryConversations(
    query: ConversationQuery,
  ): Promise<ConversationQueryResult> {
    return this.storage.queryConversations(query);
  }

  // ==================== Event Methods ====================

  /**
   * Track an event
   */
  async trackEvent(
    event: Omit<AnalyticsEvent, 'id' | 'timestamp'>,
  ): Promise<AnalyticsEvent> {
    if (!this.config.enabled) {
      throw new Error('Analytics is disabled');
    }
    return this.events.track(event);
  }

  /**
   * Track multiple events
   */
  async trackEvents(
    events: Array<Omit<AnalyticsEvent, 'id' | 'timestamp'>>,
  ): Promise<AnalyticsEvent[]> {
    if (!this.config.enabled) {
      throw new Error('Analytics is disabled');
    }
    return this.events.trackBatch(events);
  }

  /**
   * Query events
   */
  async queryEvents(query: EventQuery): Promise<AnalyticsEvent[]> {
    return this.storage.queryEvents(query);
  }

  // ==================== Session Methods ====================

  /**
   * Start a new session
   */
  async startSession(
    options: {
      userId?: string;
      device?: Session['device'];
      location?: Session['location'];
      metadata?: Record<string, unknown>;
    } = {},
  ): Promise<Session> {
    if (!this.config.enabled) {
      throw new Error('Analytics is disabled');
    }
    return this.sessions.create(options);
  }

  /**
   * Get a session by ID
   */
  getSession(id: string): Session | null {
    return this.sessions.get(id);
  }

  /**
   * End a session
   */
  async endSession(id: string): Promise<Session> {
    return this.sessions.end(id);
  }

  /**
   * Update session activity
   */
  async touchSession(id: string): Promise<Session> {
    return this.sessions.touch(id);
  }

  // ==================== Aggregation Methods ====================

  /**
   * Run an aggregation query
   */
  async aggregate(query: AggregationQuery): Promise<AggregationResult> {
    return this.storage.aggregate(query);
  }

  /**
   * Get conversation count for a period
   */
  async getConversationCount(period: TimePeriod | TimeRange): Promise<number> {
    const timeRange = this.resolveTimeRange(period);
    const result = await this.storage.aggregate({
      metric: 'conversations',
      function: 'count',
      period: timeRange,
    });
    return result.value;
  }

  /**
   * Get average conversation duration for a period
   */
  async getAverageConversationDuration(
    period: TimePeriod | TimeRange,
  ): Promise<number> {
    const timeRange = this.resolveTimeRange(period);
    const result = await this.storage.aggregate({
      metric: 'conversation_duration',
      function: 'avg',
      period: timeRange,
    });
    return result.value;
  }

  /**
   * Get success rate for a period
   */
  async getSuccessRate(period: TimePeriod | TimeRange): Promise<number> {
    const timeRange = this.resolveTimeRange(period);
    const total = await this.storage.aggregate({
      metric: 'conversations',
      function: 'count',
      period: timeRange,
    });
    const successful = await this.storage.aggregate({
      metric: 'successful_conversations',
      function: 'count',
      period: timeRange,
    });
    return total.value > 0 ? successful.value / total.value : 0;
  }

  // ==================== Utility Methods ====================

  /**
   * Resolve a time period to a time range
   */
  private resolveTimeRange(period: TimePeriod | TimeRange): TimeRange {
    if (typeof period === 'object' && 'start' in period) {
      return period;
    }

    const now = Date.now();
    const HOUR = 60 * 60 * 1000;
    const DAY = 24 * HOUR;

    const periods: Record<TimePeriod, number> = {
      hour: HOUR,
      day: DAY,
      week: 7 * DAY,
      month: 30 * DAY,
      quarter: 90 * DAY,
      year: 365 * DAY,
      'last-hour': HOUR,
      'last-24-hours': DAY,
      'last-7-days': 7 * DAY,
      'last-30-days': 30 * DAY,
      'last-90-days': 90 * DAY,
      'last-year': 365 * DAY,
      today: DAY,
      'this-week': 7 * DAY,
      'this-month': 30 * DAY,
      'this-quarter': 90 * DAY,
      'this-year': 365 * DAY,
      'all-time': Number.MAX_SAFE_INTEGER,
    };

    return {
      start: now - periods[period],
      end: now,
    };
  }

  /**
   * Get the storage adapter
   */
  getStorage(): AnalyticsStorageAdapter {
    return this.storage;
  }

  /**
   * Get the conversation manager
   */
  getConversationManager(): ConversationManager {
    return this.conversations;
  }

  /**
   * Get the event manager
   */
  getEventManager(): EventManager {
    return this.events;
  }

  /**
   * Get the session manager
   */
  getSessionManager(): SessionManager {
    return this.sessions;
  }

  /**
   * Check if analytics is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled ?? true;
  }

  /**
   * Get current configuration
   */
  getConfig(): AnalyticsConfig {
    return { ...this.config };
  }
}
