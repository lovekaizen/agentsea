/**
 * Conversation Tracker
 *
 * Tracks conversation lifecycle with detailed metrics.
 */

import { EventEmitter } from 'eventemitter3';
import { nanoid } from 'nanoid';
import type {
  AnalyticsConfig,
  Conversation,
  ConversationStatus,
  ConversationOutcome,
  AnalyticsStorageAdapter,
} from '../types/index.js';

/**
 * Conversation tracker events
 */
export interface ConversationTrackerEvents {
  tracked: (conversation: Conversation) => void;
  updated: (conversation: Conversation) => void;
  ended: (conversation: Conversation) => void;
  error: (error: Error) => void;
}

/**
 * Conversation metrics
 */
export interface ConversationMetrics {
  /** Duration in milliseconds */
  durationMs: number;
  /** Total messages */
  messageCount: number;
  /** User messages */
  userMessageCount: number;
  /** Assistant messages */
  assistantMessageCount: number;
  /** Tool calls */
  toolCallCount: number;
  /** Total tokens */
  totalTokens: number;
  /** Turns (back-and-forth exchanges) */
  turnCount: number;
  /** Average response time in ms */
  avgResponseTimeMs?: number;
  /** Topics discussed */
  topicCount: number;
  /** Intent changes */
  intentChanges: number;
}

/**
 * ConversationTracker - Tracks conversation lifecycle
 */
export class ConversationTracker extends EventEmitter<ConversationTrackerEvents> {
  private readonly storage: AnalyticsStorageAdapter;
  private readonly config: AnalyticsConfig;
  private readonly activeConversations = new Map<string, Conversation>();
  private readonly conversationMetrics = new Map<string, ConversationMetrics>();

  constructor(storage: AnalyticsStorageAdapter, config: AnalyticsConfig) {
    super();
    this.storage = storage;
    this.config = config;
  }

  /**
   * Initialize the tracker
   */
  initialize(): void {
    // Nothing to initialize
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.activeConversations.clear();
    this.conversationMetrics.clear();
  }

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
    const conversation: Conversation = {
      id: nanoid(),
      userId: options.userId,
      sessionId: options.sessionId,
      startedAt: Date.now(),
      messages: [],
      status: 'active' as ConversationStatus,
      topics: [],
      metadata: options.metadata,
    };

    // Initialize metrics
    this.conversationMetrics.set(conversation.id, {
      durationMs: 0,
      messageCount: 0,
      userMessageCount: 0,
      assistantMessageCount: 0,
      toolCallCount: 0,
      totalTokens: 0,
      turnCount: 0,
      topicCount: 0,
      intentChanges: 0,
    });

    // Store
    this.activeConversations.set(conversation.id, conversation);
    await this.storage.saveConversation(conversation);

    this.emit('tracked', conversation);
    return conversation;
  }

  /**
   * Get a conversation by ID
   */
  async getConversation(id: string): Promise<Conversation | null> {
    const active = this.activeConversations.get(id);
    if (active) {
      return active;
    }
    return this.storage.getConversation(id);
  }

  /**
   * Update a conversation
   */
  async updateConversation(
    id: string,
    updates: Partial<Conversation>,
  ): Promise<Conversation> {
    const conversation = await this.getConversation(id);
    if (!conversation) {
      throw new Error(`Conversation not found: ${id}`);
    }

    // Track intent changes
    if (
      updates.intent &&
      conversation.intent?.primary !== updates.intent.primary
    ) {
      const metrics = this.conversationMetrics.get(id);
      if (metrics) {
        metrics.intentChanges++;
      }
    }

    // Track topic additions
    if (updates.topics) {
      const metrics = this.conversationMetrics.get(id);
      if (metrics) {
        metrics.topicCount = updates.topics.length;
      }
    }

    const updated: Conversation = {
      ...conversation,
      ...updates,
      id: conversation.id,
      startedAt: conversation.startedAt,
    };

    if (this.activeConversations.has(id)) {
      this.activeConversations.set(id, updated);
    }

    await this.storage.updateConversation(id, updates);
    this.emit('updated', updated);
    return updated;
  }

  /**
   * End a conversation
   */
  async endConversation(
    id: string,
    outcome?: ConversationOutcome,
  ): Promise<Conversation> {
    const conversation = await this.getConversation(id);
    if (!conversation) {
      throw new Error(`Conversation not found: ${id}`);
    }

    const endedAt = Date.now();
    const metrics = this.conversationMetrics.get(id);

    // Calculate final metrics
    if (metrics) {
      metrics.durationMs = endedAt - conversation.startedAt;
    }

    const updated: Conversation = {
      ...conversation,
      endedAt,
      status: 'completed' as ConversationStatus,
      outcome,
      metadata: {
        ...conversation.metadata,
        metrics: metrics ? { ...metrics } : undefined,
      },
    };

    this.activeConversations.delete(id);
    this.conversationMetrics.delete(id);

    await this.storage.updateConversation(id, {
      endedAt: updated.endedAt,
      status: updated.status,
      outcome: updated.outcome,
      metadata: updated.metadata,
    });

    this.emit('ended', updated);
    return updated;
  }

  /**
   * Abandon a conversation
   */
  async abandonConversation(
    id: string,
    reason?: string,
  ): Promise<Conversation> {
    const conversation = await this.getConversation(id);
    if (!conversation) {
      throw new Error(`Conversation not found: ${id}`);
    }

    const updated: Conversation = {
      ...conversation,
      endedAt: Date.now(),
      status: 'abandoned' as ConversationStatus,
      metadata: {
        ...conversation.metadata,
        abandonReason: reason,
      },
    };

    this.activeConversations.delete(id);
    this.conversationMetrics.delete(id);

    await this.storage.updateConversation(id, {
      endedAt: updated.endedAt,
      status: updated.status,
      metadata: updated.metadata,
    });

    this.emit('ended', updated);
    return updated;
  }

  /**
   * Escalate a conversation
   */
  async escalateConversation(
    id: string,
    reason?: string,
  ): Promise<Conversation> {
    const conversation = await this.getConversation(id);
    if (!conversation) {
      throw new Error(`Conversation not found: ${id}`);
    }

    const updated: Conversation = {
      ...conversation,
      status: 'escalated' as ConversationStatus,
      metadata: {
        ...conversation.metadata,
        escalatedAt: Date.now(),
        escalationReason: reason,
      },
    };

    if (this.activeConversations.has(id)) {
      this.activeConversations.set(id, updated);
    }

    await this.storage.updateConversation(id, {
      status: updated.status,
      metadata: updated.metadata,
    });

    this.emit('updated', updated);
    return updated;
  }

  /**
   * Update metrics when a message is added
   */
  updateMetricsForMessage(
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    tokenUsage?: { total: number },
    toolCallCount = 0,
  ): void {
    const metrics = this.conversationMetrics.get(conversationId);
    if (!metrics) {
      return;
    }

    metrics.messageCount++;

    if (role === 'user') {
      metrics.userMessageCount++;
    } else if (role === 'assistant') {
      metrics.assistantMessageCount++;
    }

    if (tokenUsage) {
      metrics.totalTokens += tokenUsage.total;
    }

    metrics.toolCallCount += toolCallCount;

    // Calculate turns (a turn is a user message followed by an assistant response)
    metrics.turnCount = Math.min(
      metrics.userMessageCount,
      metrics.assistantMessageCount,
    );
  }

  /**
   * Get conversation metrics
   */
  getMetrics(conversationId: string): ConversationMetrics | undefined {
    return this.conversationMetrics.get(conversationId);
  }

  /**
   * Get all active conversations
   */
  getActiveConversations(): Conversation[] {
    return Array.from(this.activeConversations.values());
  }

  /**
   * Get active conversation count
   */
  getActiveCount(): number {
    return this.activeConversations.size;
  }

  /**
   * Check if a conversation is active
   */
  isActive(conversationId: string): boolean {
    return this.activeConversations.has(conversationId);
  }

  /**
   * Get conversation duration
   */
  getDuration(conversationId: string): number {
    const conversation = this.activeConversations.get(conversationId);
    if (!conversation) {
      return 0;
    }
    return Date.now() - conversation.startedAt;
  }
}
