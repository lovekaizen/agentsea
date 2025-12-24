/**
 * Message Tracker
 *
 * Tracks individual messages within conversations.
 */

import { EventEmitter } from 'eventemitter3';
import { nanoid } from 'nanoid';
import type {
  AnalyticsConfig,
  Message,
  TokenUsage,
  ToolCallInfo,
  AnalyticsStorageAdapter,
} from '../types/index.js';

/**
 * Message tracker events
 */
export interface MessageTrackerEvents {
  tracked: (conversationId: string, message: Message) => void;
  error: (error: Error) => void;
}

/**
 * Message statistics
 */
export interface MessageStats {
  /** Total messages tracked */
  totalMessages: number;
  /** User messages */
  userMessages: number;
  /** Assistant messages */
  assistantMessages: number;
  /** System messages */
  systemMessages: number;
  /** Total tokens used */
  totalTokens: number;
  /** Total tool calls */
  totalToolCalls: number;
  /** Average message length */
  avgMessageLength: number;
  /** Average response time (ms) */
  avgResponseTimeMs: number;
}

/**
 * MessageTracker - Tracks messages within conversations
 */
export class MessageTracker extends EventEmitter<MessageTrackerEvents> {
  private readonly storage: AnalyticsStorageAdapter;
  private readonly config: AnalyticsConfig;
  private readonly messageCache = new Map<string, Message[]>();
  private readonly lastMessageTime = new Map<string, number>();
  private readonly responseTimes: number[] = [];
  private stats: MessageStats = {
    totalMessages: 0,
    userMessages: 0,
    assistantMessages: 0,
    systemMessages: 0,
    totalTokens: 0,
    totalToolCalls: 0,
    avgMessageLength: 0,
    avgResponseTimeMs: 0,
  };
  private totalMessageLength = 0;

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
    this.messageCache.clear();
    this.lastMessageTime.clear();
    this.responseTimes.length = 0;
  }

  /**
   * Track a message
   */
  async trackMessage(
    conversationId: string,
    messageData: Omit<Message, 'id' | 'timestamp' | 'conversationId'>,
  ): Promise<Message> {
    const now = Date.now();
    const message: Message = {
      id: nanoid(),
      timestamp: now,
      conversationId,
      ...messageData,
    };

    // Calculate response time for assistant messages
    if (message.role === 'assistant') {
      const lastTime = this.lastMessageTime.get(conversationId);
      if (lastTime) {
        const responseTime = now - lastTime;
        this.responseTimes.push(responseTime);
        message.metadata = {
          ...message.metadata,
          responseTimeMs: responseTime,
        };
      }
    }

    // Update last message time
    this.lastMessageTime.set(conversationId, now);

    // Cache message
    const cached = this.messageCache.get(conversationId) ?? [];
    cached.push(message);
    this.messageCache.set(conversationId, cached);

    // Update stats
    this.updateStats(message);

    // Update conversation in storage
    const conversation = await this.storage.getConversation(conversationId);
    if (conversation) {
      await this.storage.updateConversation(conversationId, {
        messages: [...conversation.messages, message],
      });
    }

    this.emit('tracked', conversationId, message);
    return message;
  }

  /**
   * Track a user message
   */
  async trackUserMessage(
    conversationId: string,
    content: string,
    metadata?: Record<string, unknown>,
  ): Promise<Message> {
    return this.trackMessage(conversationId, {
      role: 'user',
      content,
      metadata,
    });
  }

  /**
   * Track an assistant message
   */
  async trackAssistantMessage(
    conversationId: string,
    content: string,
    options?: {
      model?: string;
      tokenUsage?: TokenUsage;
      toolCalls?: ToolCallInfo[];
      metadata?: Record<string, unknown>;
    },
  ): Promise<Message> {
    return this.trackMessage(conversationId, {
      role: 'assistant',
      content,
      model: options?.model,
      tokenUsage: options?.tokenUsage,
      toolCalls: options?.toolCalls,
      metadata: options?.metadata,
    });
  }

  /**
   * Track a system message
   */
  async trackSystemMessage(
    conversationId: string,
    content: string,
    metadata?: Record<string, unknown>,
  ): Promise<Message> {
    return this.trackMessage(conversationId, {
      role: 'system',
      content,
      metadata,
    });
  }

  /**
   * Get messages for a conversation
   */
  getMessages(conversationId: string): Message[] {
    return this.messageCache.get(conversationId) ?? [];
  }

  /**
   * Get the last message for a conversation
   */
  getLastMessage(conversationId: string): Message | undefined {
    const messages = this.messageCache.get(conversationId);
    return messages?.[messages.length - 1];
  }

  /**
   * Get message count for a conversation
   */
  getMessageCount(conversationId: string): number {
    return this.messageCache.get(conversationId)?.length ?? 0;
  }

  /**
   * Update statistics
   */
  private updateStats(message: Message): void {
    this.stats.totalMessages++;

    switch (message.role) {
      case 'user':
        this.stats.userMessages++;
        break;
      case 'assistant':
        this.stats.assistantMessages++;
        break;
      case 'system':
        this.stats.systemMessages++;
        break;
    }

    if (message.tokenUsage) {
      this.stats.totalTokens += message.tokenUsage.total;
    }

    if (message.toolCalls) {
      this.stats.totalToolCalls += message.toolCalls.length;
    }

    // Update average message length
    this.totalMessageLength += message.content.length;
    this.stats.avgMessageLength =
      this.totalMessageLength / this.stats.totalMessages;

    // Update average response time
    if (this.responseTimes.length > 0) {
      this.stats.avgResponseTimeMs =
        this.responseTimes.reduce((a, b) => a + b, 0) /
        this.responseTimes.length;
    }
  }

  /**
   * Get current statistics
   */
  getStats(): MessageStats {
    return { ...this.stats };
  }

  /**
   * Get token usage for a conversation
   */
  getTokenUsage(conversationId: string): {
    input: number;
    output: number;
    total: number;
  } {
    const messages = this.messageCache.get(conversationId) ?? [];
    return messages.reduce(
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
   * Get tool call count for a conversation
   */
  getToolCallCount(conversationId: string): number {
    const messages = this.messageCache.get(conversationId) ?? [];
    return messages.reduce((count, m) => count + (m.toolCalls?.length ?? 0), 0);
  }

  /**
   * Get average response time for a conversation
   */
  getAverageResponseTime(conversationId: string): number {
    const messages = this.messageCache.get(conversationId) ?? [];
    const responseTimes = messages
      .filter((m) => m.role === 'assistant' && m.metadata?.responseTimeMs)
      .map((m) => m.metadata!.responseTimeMs as number);

    if (responseTimes.length === 0) {
      return 0;
    }

    return responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  }

  /**
   * Clear cache for a conversation
   */
  clearCache(conversationId: string): void {
    this.messageCache.delete(conversationId);
    this.lastMessageTime.delete(conversationId);
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    this.messageCache.clear();
    this.lastMessageTime.clear();
  }
}
