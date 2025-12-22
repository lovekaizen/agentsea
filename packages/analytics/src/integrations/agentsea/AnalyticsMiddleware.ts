/**
 * AnalyticsMiddleware
 *
 * Middleware for auto-tracking analytics in AgentSea agents.
 */

import type {
  AnalyticsConfig,
  AnalyticsStorageAdapter,
  Conversation,
  Message,
  AnalyticsEvent,
  EventType,
  ConversationOutcome,
} from '../../types/index.js';
import { Analytics } from '../../core/Analytics.js';
import { ConversationTracker } from '../../collection/ConversationTracker.js';
import { MessageTracker } from '../../collection/MessageTracker.js';
import { MemoryStorageAdapter } from '../../storage/adapters/MemoryStorage.js';

/**
 * Agent message interface (compatible with AgentSea)
 */
export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp?: number;
  tokenUsage?: {
    input?: number;
    output?: number;
    total: number;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Agent context interface
 */
export interface AgentContext {
  conversationId: string;
  agentId?: string;
  userId?: string;
  sessionId?: string;
  model?: string;
  messages: AgentMessage[];
  metadata?: Record<string, unknown>;
}

/**
 * Middleware options
 */
export interface AnalyticsMiddlewareOptions {
  config?: Partial<AnalyticsConfig>;
  storage?: AnalyticsStorageAdapter;
  trackIntents?: boolean;
  trackSentiment?: boolean;
  trackTopics?: boolean;
  autoCapture?: boolean;
  onConversationStart?: (record: Conversation) => void;
  onConversationEnd?: (record: Conversation) => void;
  onMessage?: (message: Message) => void;
  onEvent?: (event: AnalyticsEvent) => void;
}

/**
 * Analytics middleware for AgentSea agents
 *
 * @example
 * ```typescript
 * import { AnalyticsMiddleware } from '@lov3kaizen/agentsea-analytics/integrations/agentsea';
 *
 * const middleware = new AnalyticsMiddleware({
 *   trackIntents: true,
 *   trackSentiment: true,
 *   onConversationEnd: (record) => {
 *     console.log('Conversation ended:', record);
 *   },
 * });
 *
 * // Track agent messages
 * middleware.trackMessage(context, message);
 *
 * // Start/end conversations
 * middleware.startConversation(context);
 * middleware.endConversation(conversationId);
 * ```
 */
export class AnalyticsMiddleware {
  private analytics: Analytics;
  private conversationTracker: ConversationTracker;
  private messageTracker: MessageTracker;
  private storage: AnalyticsStorageAdapter;
  private options: AnalyticsMiddlewareOptions;
  private activeConversations: Map<
    string,
    {
      startedAt: number;
      messageCount: number;
      context: AgentContext;
      internalId: string;
    }
  > = new Map();

  constructor(options: AnalyticsMiddlewareOptions = {}) {
    this.options = {
      trackIntents: true,
      trackSentiment: true,
      trackTopics: true,
      autoCapture: true,
      ...options,
    };

    this.storage = options.storage ?? new MemoryStorageAdapter();

    const config: AnalyticsConfig = {
      enabled: true,
      storage: this.storage,
      ...options.config,
    };

    this.analytics = new Analytics(config);
    this.conversationTracker = new ConversationTracker(this.storage, config);
    this.messageTracker = new MessageTracker(this.storage, config);
  }

  /**
   * Start tracking a conversation
   */
  async startConversation(context: AgentContext): Promise<Conversation> {
    const record = await this.conversationTracker.startConversation({
      userId: context.userId,
      sessionId: context.sessionId,
      metadata: {
        agentId: context.agentId,
        model: context.model,
        ...context.metadata,
      },
    });

    this.activeConversations.set(context.conversationId, {
      startedAt: Date.now(),
      messageCount: 0,
      context,
      internalId: record.id,
    });

    // Track event
    await this.analytics.trackEvent({
      type: 'conversation_started',
      conversationId: record.id,
      data: {
        agentId: context.agentId,
        userId: context.userId,
        model: context.model,
      },
    });

    this.options.onConversationStart?.(record);

    return record;
  }

  /**
   * End a conversation
   */
  async endConversation(
    conversationId: string,
    outcome?: ConversationOutcome,
  ): Promise<Conversation | null> {
    const active = this.activeConversations.get(conversationId);
    if (!active) {
      return null;
    }

    const record = await this.conversationTracker.endConversation(
      active.internalId,
      outcome,
    );

    await this.analytics.trackEvent({
      type: 'conversation_ended',
      conversationId: active.internalId,
      data: {
        duration: Date.now() - active.startedAt,
        messageCount: active.messageCount,
        success: outcome?.success,
        satisfaction: outcome?.satisfaction,
      },
    });

    this.options.onConversationEnd?.(record);

    this.activeConversations.delete(conversationId);

    return record;
  }

  /**
   * Track a message
   */
  async trackMessage(
    context: AgentContext,
    message: AgentMessage,
  ): Promise<Message> {
    // Ensure conversation is started
    if (!this.activeConversations.has(context.conversationId)) {
      await this.startConversation(context);
    }

    const active = this.activeConversations.get(context.conversationId);
    if (active) {
      active.messageCount++;
    }

    const trackedMessage = await this.messageTracker.trackMessage(
      active?.internalId ?? context.conversationId,
      {
        role: message.role,
        content: message.content,
        tokenUsage: message.tokenUsage
          ? {
              input: message.tokenUsage.input ?? 0,
              output: message.tokenUsage.output ?? 0,
              total: message.tokenUsage.total,
            }
          : undefined,
        latencyMs: message.metadata?.latencyMs as number | undefined,
        metadata: message.metadata,
      },
    );

    this.options.onMessage?.(trackedMessage);

    return trackedMessage;
  }

  /**
   * Process full agent context (auto-capture messages)
   */
  async capture(context: AgentContext): Promise<void> {
    if (!this.options.autoCapture) return;

    // Start conversation if not tracked
    if (!this.activeConversations.has(context.conversationId)) {
      await this.startConversation(context);
    }

    // Track any new messages
    const active = this.activeConversations.get(context.conversationId);
    if (!active) return;

    const newMessages = context.messages.slice(active.messageCount);
    for (const message of newMessages) {
      await this.trackMessage(context, message);
    }
  }

  /**
   * Track custom event
   */
  async trackEvent(
    conversationId: string,
    eventType: string,
    data?: Record<string, unknown>,
  ): Promise<AnalyticsEvent> {
    const active = this.activeConversations.get(conversationId);

    const event = await this.analytics.trackEvent({
      type: eventType as EventType,
      conversationId: active?.internalId ?? conversationId,
      data: data ?? {},
    });

    this.options.onEvent?.(event);

    return event;
  }

  /**
   * Track conversation escalation
   */
  async trackEscalation(
    conversationId: string,
    reason: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const active = this.activeConversations.get(conversationId);
    if (!active) return;

    await this.conversationTracker.escalateConversation(
      active.internalId,
      reason,
    );
    await this.trackEvent(conversationId, 'conversation_escalated', {
      reason,
      ...metadata,
    });
  }

  /**
   * Track conversation abandonment
   */
  async trackAbandonment(
    conversationId: string,
    reason?: string,
  ): Promise<void> {
    await this.trackEvent(conversationId, 'conversation_abandoned', { reason });
    await this.endConversation(conversationId, {
      success: false,
      feedback: reason ?? 'abandoned',
    });
  }

  /**
   * Get analytics instance
   */
  getAnalytics(): Analytics {
    return this.analytics;
  }

  /**
   * Get conversation tracker
   */
  getConversationTracker(): ConversationTracker {
    return this.conversationTracker;
  }

  /**
   * Get message tracker
   */
  getMessageTracker(): MessageTracker {
    return this.messageTracker;
  }

  /**
   * Get active conversation IDs
   */
  getActiveConversationIds(): string[] {
    return Array.from(this.activeConversations.keys());
  }

  /**
   * Check if conversation is active
   */
  isConversationActive(conversationId: string): boolean {
    return this.activeConversations.has(conversationId);
  }

  /**
   * Get conversation stats
   */
  getConversationStats(conversationId: string): {
    startedAt: number;
    messageCount: number;
    duration: number;
  } | null {
    const active = this.activeConversations.get(conversationId);
    if (!active) return null;

    return {
      startedAt: active.startedAt,
      messageCount: active.messageCount,
      duration: Date.now() - active.startedAt,
    };
  }

  /**
   * Flush all pending data
   */
  async flush(): Promise<void> {
    // End all active conversations
    for (const conversationId of this.activeConversations.keys()) {
      await this.endConversation(conversationId);
    }
  }
}

/**
 * Create analytics middleware
 */
export function createAnalyticsMiddleware(
  options?: AnalyticsMiddlewareOptions,
): AnalyticsMiddleware {
  return new AnalyticsMiddleware(options);
}
