/**
 * Collector
 *
 * Main data collection orchestrator that coordinates all collectors.
 */

import { EventEmitter } from 'eventemitter3';
import type {
  AnalyticsConfig,
  Conversation,
  Message,
  AnalyticsEvent,
  AnalyticsStorageAdapter,
} from '../types/index.js';
import { ConversationTracker } from './ConversationTracker.js';
import { MessageTracker } from './MessageTracker.js';
import { BatchCollector } from './BatchCollector.js';

/**
 * Collector events
 */
export interface CollectorEvents {
  'conversation:tracked': (conversation: Conversation) => void;
  'message:tracked': (conversationId: string, message: Message) => void;
  'event:collected': (event: AnalyticsEvent) => void;
  'batch:processed': (count: number) => void;
  error: (error: Error) => void;
}

/**
 * Collector configuration
 */
export interface CollectorConfig {
  /** Enable conversation tracking */
  trackConversations?: boolean;
  /** Enable message tracking */
  trackMessages?: boolean;
  /** Enable event batching */
  enableBatching?: boolean;
  /** Auto-track tool calls */
  trackToolCalls?: boolean;
  /** Auto-track token usage */
  trackTokenUsage?: boolean;
  /** Auto-calculate sentiment */
  autoSentiment?: boolean;
  /** Auto-classify intent */
  autoIntent?: boolean;
}

/**
 * Default collector configuration
 */
const DEFAULT_COLLECTOR_CONFIG: CollectorConfig = {
  trackConversations: true,
  trackMessages: true,
  enableBatching: true,
  trackToolCalls: true,
  trackTokenUsage: true,
  autoSentiment: false,
  autoIntent: false,
};

/**
 * Collector - Main data collection orchestrator
 */
export class Collector extends EventEmitter<CollectorEvents> {
  private readonly storage: AnalyticsStorageAdapter;
  private readonly config: AnalyticsConfig;
  private readonly collectorConfig: CollectorConfig;
  private readonly conversationTracker: ConversationTracker;
  private readonly messageTracker: MessageTracker;
  private readonly batchCollector: BatchCollector;
  private isInitialized = false;

  constructor(
    storage: AnalyticsStorageAdapter,
    config: AnalyticsConfig,
    collectorConfig: Partial<CollectorConfig> = {},
  ) {
    super();
    this.storage = storage;
    this.config = config;
    this.collectorConfig = { ...DEFAULT_COLLECTOR_CONFIG, ...collectorConfig };

    // Initialize sub-collectors
    this.conversationTracker = new ConversationTracker(storage, config);
    this.messageTracker = new MessageTracker(storage, config);
    this.batchCollector = new BatchCollector(storage, config);

    // Setup event forwarding
    this.setupEventForwarding();
  }

  /**
   * Initialize the collector
   */
  initialize(): void {
    if (this.isInitialized) {
      return;
    }

    this.conversationTracker.initialize();
    this.messageTracker.initialize();
    this.batchCollector.initialize();

    this.isInitialized = true;
  }

  /**
   * Shutdown the collector
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    await this.batchCollector.flush();
    this.conversationTracker.cleanup();
    this.messageTracker.cleanup();
    await this.batchCollector.cleanup();

    this.isInitialized = false;
  }

  /**
   * Setup event forwarding from sub-collectors
   */
  private setupEventForwarding(): void {
    this.conversationTracker.on('tracked', (conv) =>
      this.emit('conversation:tracked', conv),
    );
    this.messageTracker.on('tracked', (convId, msg) =>
      this.emit('message:tracked', convId, msg),
    );
    this.batchCollector.on('processed', (count) =>
      this.emit('batch:processed', count),
    );
  }

  /**
   * Track a conversation start
   */
  async trackConversationStart(
    options: {
      userId?: string;
      sessionId?: string;
      metadata?: Record<string, unknown>;
    } = {},
  ): Promise<Conversation> {
    if (!this.collectorConfig.trackConversations) {
      throw new Error('Conversation tracking is disabled');
    }
    return this.conversationTracker.startConversation(options);
  }

  /**
   * Track a conversation end
   */
  async trackConversationEnd(
    conversationId: string,
    outcome?: Conversation['outcome'],
  ): Promise<Conversation> {
    return this.conversationTracker.endConversation(conversationId, outcome);
  }

  /**
   * Track a message
   */
  async trackMessage(
    conversationId: string,
    message: Omit<Message, 'id' | 'timestamp' | 'conversationId'>,
  ): Promise<Message> {
    if (!this.collectorConfig.trackMessages) {
      throw new Error('Message tracking is disabled');
    }
    return this.messageTracker.trackMessage(conversationId, message);
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
      tokenUsage?: Message['tokenUsage'];
      toolCalls?: Message['toolCalls'];
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
   * Track a tool call
   */
  async trackToolCall(
    conversationId: string,
    toolCall: {
      name: string;
      input: Record<string, unknown>;
      output?: unknown;
      durationMs?: number;
      success?: boolean;
      error?: string;
    },
  ): Promise<void> {
    if (!this.collectorConfig.trackToolCalls) {
      return;
    }

    // Add to batch collector as an event
    await this.batchCollector.add({
      type: 'tool_usage',
      name: toolCall.name,
      conversationId,
      data: {
        input: toolCall.input,
        output: toolCall.output,
        durationMs: toolCall.durationMs,
        success: toolCall.success ?? true,
        error: toolCall.error,
      },
    });
  }

  /**
   * Track token usage
   */
  async trackTokenUsage(
    conversationId: string,
    usage: {
      model: string;
      input: number;
      output: number;
      total?: number;
    },
  ): Promise<void> {
    if (!this.collectorConfig.trackTokenUsage) {
      return;
    }

    await this.batchCollector.add({
      type: 'token_usage',
      conversationId,
      data: {
        model: usage.model,
        inputTokens: usage.input,
        outputTokens: usage.output,
        totalTokens: usage.total ?? usage.input + usage.output,
      },
    });
  }

  /**
   * Track a custom event
   */
  async trackEvent(
    event: Omit<AnalyticsEvent, 'id' | 'timestamp'>,
  ): Promise<void> {
    await this.batchCollector.add(event);
    this.emit('event:collected', event as AnalyticsEvent);
  }

  /**
   * Track feedback
   */
  async trackFeedback(
    conversationId: string,
    feedback: {
      rating?: number;
      thumbs?: 'up' | 'down';
      comment?: string;
      categories?: string[];
    },
  ): Promise<void> {
    await this.batchCollector.add({
      type: 'feedback',
      conversationId,
      data: feedback,
    });

    // Also update conversation outcome
    const conversation =
      await this.conversationTracker.getConversation(conversationId);
    if (conversation) {
      await this.conversationTracker.updateConversation(conversationId, {
        outcome: {
          ...conversation.outcome,
          success:
            feedback.thumbs === 'up' ||
            (feedback.rating !== undefined && feedback.rating >= 4),
          satisfaction: feedback.rating,
        },
      });
    }
  }

  /**
   * Track an error
   */
  async trackError(
    conversationId: string,
    error: {
      type: string;
      message: string;
      stack?: string;
      recoverable?: boolean;
    },
  ): Promise<void> {
    await this.batchCollector.add({
      type: 'error',
      name: error.type,
      conversationId,
      data: {
        message: error.message,
        stack: error.stack,
        recoverable: error.recoverable ?? false,
      },
    });
  }

  /**
   * Get the conversation tracker
   */
  getConversationTracker(): ConversationTracker {
    return this.conversationTracker;
  }

  /**
   * Get the message tracker
   */
  getMessageTracker(): MessageTracker {
    return this.messageTracker;
  }

  /**
   * Get the batch collector
   */
  getBatchCollector(): BatchCollector {
    return this.batchCollector;
  }

  /**
   * Flush all pending data
   */
  async flush(): Promise<void> {
    await this.batchCollector.flush();
  }
}
