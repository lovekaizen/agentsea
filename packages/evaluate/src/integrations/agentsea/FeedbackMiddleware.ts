/**
 * FeedbackMiddleware
 *
 * Auto-collect feedback from AgentSea agents.
 */

import type {
  FeedbackStoreInterface,
  ThumbsFeedback,
} from '../../types/index.js';
import { ThumbsCollector } from '../../feedback/collectors/ThumbsCollector.js';

/**
 * Middleware options
 */
export interface FeedbackMiddlewareOptions {
  collector?: ThumbsCollector;
  store?: FeedbackStoreInterface;
  autoCapture?: boolean;
  captureFields?: string[];
}

/**
 * Agent message interface (simplified)
 */
export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: Record<string, unknown>;
}

/**
 * Agent context interface (simplified)
 */
export interface AgentContext {
  conversationId: string;
  messages: AgentMessage[];
  metadata?: Record<string, unknown>;
}

/**
 * Feedback middleware
 */
export class FeedbackMiddleware {
  private collector: ThumbsCollector;
  private autoCapture: boolean;
  private captureFields: string[];
  private pendingFeedback: Map<
    string,
    {
      input: string;
      output: string;
      conversationId?: string;
      metadata: Record<string, unknown>;
      timestamp: number;
    }
  > = new Map();

  constructor(options: FeedbackMiddlewareOptions) {
    this.collector =
      options.collector ?? new ThumbsCollector({ store: options.store });
    this.autoCapture = options.autoCapture ?? true;
    this.captureFields = options.captureFields ?? [
      'input',
      'output',
      'toolCalls',
      'latency',
    ];
  }

  /**
   * Process agent message and capture for potential feedback
   */
  capture(context: AgentContext): void {
    if (!this.autoCapture) return;

    const messages = context.messages;
    if (messages.length < 2) return;

    // Find the last user message and assistant response
    let userMessage: AgentMessage | undefined;
    let assistantMessage: AgentMessage | undefined;

    for (let i = messages.length - 1; i >= 0; i--) {
      if (!assistantMessage && messages[i].role === 'assistant') {
        assistantMessage = messages[i];
      }
      if (!userMessage && messages[i].role === 'user') {
        userMessage = messages[i];
      }
      if (userMessage && assistantMessage) break;
    }

    if (!userMessage || !assistantMessage) return;

    // Store for potential feedback
    const metadata: Record<string, unknown> = {};
    if (
      this.captureFields.includes('toolCalls') &&
      assistantMessage.metadata?.toolCalls
    ) {
      metadata.toolCalls = assistantMessage.metadata.toolCalls;
    }
    if (
      this.captureFields.includes('latency') &&
      assistantMessage.metadata?.latencyMs
    ) {
      metadata.latencyMs = assistantMessage.metadata.latencyMs;
    }
    if (context.metadata?.model) {
      metadata.model = context.metadata.model;
    }

    this.pendingFeedback.set(assistantMessage.id, {
      input: userMessage.content,
      output: assistantMessage.content,
      conversationId: context.conversationId,
      metadata,
      timestamp: Date.now(),
    });

    // Clean up old pending feedback (older than 1 hour)
    this.cleanupPending();
  }

  /**
   * Record feedback for a response
   */
  async recordFeedback(
    responseId: string,
    rating: 'up' | 'down',
    comment?: string,
    userId?: string,
  ): Promise<ThumbsFeedback | null> {
    const pending = this.pendingFeedback.get(responseId);
    if (!pending) {
      console.warn(`No pending feedback found for response ${responseId}`);
      return null;
    }

    const feedback = await this.collector.collect({
      responseId,
      conversationId: pending.conversationId,
      input: pending.input,
      output: pending.output,
      feedback: { rating, comment },
      userId,
      metadata: pending.metadata,
    });

    this.pendingFeedback.delete(responseId);

    return feedback;
  }

  /**
   * Get pending feedback IDs
   */
  getPendingIds(): string[] {
    return Array.from(this.pendingFeedback.keys());
  }

  /**
   * Clear pending feedback
   */
  clearPending(): void {
    this.pendingFeedback.clear();
  }

  /**
   * Clean up old pending feedback
   */
  private cleanupPending(): void {
    const oneHourAgo = Date.now() - 3600000;
    for (const [id, data] of this.pendingFeedback.entries()) {
      if (data.timestamp < oneHourAgo) {
        this.pendingFeedback.delete(id);
      }
    }
  }

  /**
   * Get collector
   */
  getCollector(): ThumbsCollector {
    return this.collector;
  }
}

/**
 * Create feedback middleware
 */
export function createFeedbackMiddleware(
  options: FeedbackMiddlewareOptions,
): FeedbackMiddleware {
  return new FeedbackMiddleware(options);
}
