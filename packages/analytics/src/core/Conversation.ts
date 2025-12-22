/**
 * Conversation Manager
 *
 * Manages conversation lifecycle and tracking.
 */

import { EventEmitter } from 'eventemitter3';
import { nanoid } from 'nanoid';
import type {
  AnalyticsConfig,
  Conversation,
  ConversationStatus,
  Message,
  AnalyticsStorageAdapter,
} from '../types/index.js';

/**
 * Conversation manager events
 */
export interface ConversationManagerEvents {
  created: (conversation: Conversation) => void;
  updated: (conversation: Conversation) => void;
  ended: (conversation: Conversation) => void;
  'message:added': (conversation: Conversation, message: Message) => void;
  error: (error: Error) => void;
}

/**
 * ConversationManager - Manages conversation lifecycle
 */
export class ConversationManager extends EventEmitter<ConversationManagerEvents> {
  private readonly storage: AnalyticsStorageAdapter;
  private readonly config: AnalyticsConfig;
  private readonly activeConversations = new Map<string, Conversation>();
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(storage: AnalyticsStorageAdapter, config: AnalyticsConfig) {
    super();
    this.storage = storage;
    this.config = config;
  }

  /**
   * Initialize the conversation manager
   */
  initialize(): void {
    // Start periodic flush if batch config is set
    if (this.config.batchConfig?.maxAge) {
      this.flushTimer = setInterval(
        () => void this.flush(),
        this.config.batchConfig.maxAge,
      );
    }
  }

  /**
   * Flush pending conversations to storage
   */
  async flush(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const conversation of this.activeConversations.values()) {
      promises.push(this.storage.saveConversation(conversation));
    }
    await Promise.all(promises);
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }

  /**
   * Create a new conversation
   */
  async create(
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
      metadata: options.metadata,
    };

    // Apply sampling if enabled
    const sampling = this.config.sampling;
    if (sampling) {
      const rate =
        typeof sampling === 'number'
          ? sampling
          : sampling.enabled
            ? sampling.rate
            : 1.0;
      if (Math.random() > rate) {
        // Skip this conversation due to sampling
        conversation.metadata = {
          ...conversation.metadata,
          sampled: false,
        };
      }
    }

    // Store in active conversations
    this.activeConversations.set(conversation.id, conversation);

    // Persist to storage
    await this.storage.saveConversation(conversation);

    this.emit('created', conversation);
    return conversation;
  }

  /**
   * Get a conversation by ID
   */
  async get(id: string): Promise<Conversation | null> {
    // Check active conversations first
    const active = this.activeConversations.get(id);
    if (active) {
      return active;
    }

    // Fall back to storage
    return this.storage.getConversation(id);
  }

  /**
   * Update a conversation
   */
  async update(
    id: string,
    updates: Partial<Conversation>,
  ): Promise<Conversation> {
    const conversation = await this.get(id);
    if (!conversation) {
      throw new Error(`Conversation not found: ${id}`);
    }

    const updated: Conversation = {
      ...conversation,
      ...updates,
      id: conversation.id, // Prevent ID changes
      startedAt: conversation.startedAt, // Prevent start time changes
    };

    // Update in active conversations if present
    if (this.activeConversations.has(id)) {
      this.activeConversations.set(id, updated);
    }

    // Persist to storage
    await this.storage.updateConversation(id, updates);

    this.emit('updated', updated);
    return updated;
  }

  /**
   * End a conversation
   */
  async end(
    id: string,
    outcome?: Conversation['outcome'],
  ): Promise<Conversation> {
    const conversation = await this.get(id);
    if (!conversation) {
      throw new Error(`Conversation not found: ${id}`);
    }

    const updated: Conversation = {
      ...conversation,
      endedAt: Date.now(),
      status: 'completed' as ConversationStatus,
      outcome,
    };

    // Remove from active conversations
    this.activeConversations.delete(id);

    // Persist to storage
    await this.storage.updateConversation(id, {
      endedAt: updated.endedAt,
      status: updated.status,
      outcome: updated.outcome,
    });

    this.emit('ended', updated);
    return updated;
  }

  /**
   * Add a message to a conversation
   */
  async addMessage(
    conversationId: string,
    messageData: Omit<Message, 'id' | 'timestamp'>,
  ): Promise<Conversation> {
    const conversation = await this.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    const message: Message = {
      id: nanoid(),
      timestamp: Date.now(),
      ...messageData,
    };

    const updated: Conversation = {
      ...conversation,
      messages: [...conversation.messages, message],
    };

    // Update in active conversations if present
    if (this.activeConversations.has(conversationId)) {
      this.activeConversations.set(conversationId, updated);
    }

    // Persist to storage
    await this.storage.updateConversation(conversationId, {
      messages: updated.messages,
    });

    this.emit('message:added', updated, message);
    this.emit('updated', updated);
    return updated;
  }

  /**
   * Mark a conversation as abandoned
   */
  async abandon(id: string, reason?: string): Promise<Conversation> {
    return this.update(id, {
      status: 'abandoned' as ConversationStatus,
      endedAt: Date.now(),
      metadata: {
        ...(await this.get(id))?.metadata,
        abandonReason: reason,
      },
    });
  }

  /**
   * Escalate a conversation
   */
  async escalate(id: string, reason?: string): Promise<Conversation> {
    return this.update(id, {
      status: 'escalated' as ConversationStatus,
      metadata: {
        ...(await this.get(id))?.metadata,
        escalatedAt: Date.now(),
        escalationReason: reason,
      },
    });
  }

  /**
   * Set conversation outcome
   */
  async setOutcome(
    id: string,
    outcome: Conversation['outcome'],
  ): Promise<Conversation> {
    return this.update(id, { outcome });
  }

  /**
   * Set conversation intent
   */
  async setIntent(
    id: string,
    intent: Conversation['intent'],
  ): Promise<Conversation> {
    return this.update(id, { intent });
  }

  /**
   * Set conversation sentiment
   */
  async setSentiment(
    id: string,
    sentiment: Conversation['sentiment'],
  ): Promise<Conversation> {
    return this.update(id, { sentiment });
  }

  /**
   * Add topics to a conversation
   */
  async addTopics(id: string, topics: string[]): Promise<Conversation> {
    const conversation = await this.get(id);
    if (!conversation) {
      throw new Error(`Conversation not found: ${id}`);
    }

    const existingTopics = conversation.topics ?? [];
    const newTopics = [...new Set([...existingTopics, ...topics])];

    return this.update(id, { topics: newTopics });
  }

  /**
   * Calculate conversation duration
   */
  getDuration(conversation: Conversation): number {
    const endTime = conversation.endedAt ?? Date.now();
    return endTime - conversation.startedAt;
  }

  /**
   * Get message count
   */
  getMessageCount(conversation: Conversation): number {
    return conversation.messages.length;
  }

  /**
   * Get user message count
   */
  getUserMessageCount(conversation: Conversation): number {
    return conversation.messages.filter((m) => m.role === 'user').length;
  }

  /**
   * Get assistant message count
   */
  getAssistantMessageCount(conversation: Conversation): number {
    return conversation.messages.filter((m) => m.role === 'assistant').length;
  }

  /**
   * Get tool call count
   */
  getToolCallCount(conversation: Conversation): number {
    return conversation.messages.reduce(
      (count, m) => count + (m.toolCalls?.length ?? 0),
      0,
    );
  }

  /**
   * Get total token usage
   */
  getTotalTokenUsage(conversation: Conversation): {
    input: number;
    output: number;
    total: number;
  } {
    return conversation.messages.reduce(
      (totals, m) => {
        if (m.tokenUsage) {
          totals.input += m.tokenUsage.input;
          totals.output += m.tokenUsage.output;
          totals.total += m.tokenUsage.total;
        }
        return totals;
      },
      { input: 0, output: 0, total: 0 },
    );
  }

  /**
   * Get active conversation count
   */
  getActiveCount(): number {
    return this.activeConversations.size;
  }

  /**
   * Get all active conversations
   */
  getActive(): Conversation[] {
    return Array.from(this.activeConversations.values());
  }
}
