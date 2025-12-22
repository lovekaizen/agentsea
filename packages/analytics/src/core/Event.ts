/**
 * Event Manager
 *
 * Manages analytics event tracking with batching support.
 */

import { EventEmitter } from 'eventemitter3';
import { nanoid } from 'nanoid';
import type {
  AnalyticsConfig,
  AnalyticsEvent,
  EventType,
  AnalyticsStorageAdapter,
} from '../types/index.js';

/**
 * Event manager events
 */
export interface EventManagerEvents {
  tracked: (event: AnalyticsEvent) => void;
  'batch:flushed': (events: AnalyticsEvent[]) => void;
  error: (error: Error) => void;
}

/**
 * EventManager - Manages analytics event tracking
 */
export class EventManager extends EventEmitter<EventManagerEvents> {
  private readonly storage: AnalyticsStorageAdapter;
  private readonly config: AnalyticsConfig;
  private readonly eventBuffer: AnalyticsEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private isInitialized = false;

  constructor(storage: AnalyticsStorageAdapter, config: AnalyticsConfig) {
    super();
    this.storage = storage;
    this.config = config;
  }

  /**
   * Initialize the event manager
   */
  initialize(): void {
    if (this.isInitialized) {
      return;
    }

    // Start periodic flush if batch config is set
    if (this.config.batchConfig?.maxAge) {
      this.flushTimer = setInterval(
        () => void this.flush(),
        this.config.batchConfig.maxAge,
      );
    }

    this.isInitialized = true;
  }

  /**
   * Flush buffered events to storage
   */
  async flush(): Promise<void> {
    if (this.eventBuffer.length === 0) {
      return;
    }

    const events = [...this.eventBuffer];
    this.eventBuffer.length = 0;

    try {
      await Promise.all(events.map((event) => this.storage.saveEvent(event)));
      this.emit('batch:flushed', events);
    } catch (error) {
      // Put events back in buffer on failure
      this.eventBuffer.unshift(...events);
      this.emit('error', error as Error);
      throw error;
    }
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
    this.isInitialized = false;
  }

  /**
   * Track a single event
   */
  async track(
    eventData: Omit<AnalyticsEvent, 'id' | 'timestamp'>,
  ): Promise<AnalyticsEvent> {
    const event: AnalyticsEvent = {
      id: nanoid(),
      timestamp: Date.now(),
      ...eventData,
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
        // Return event but don't persist (sampled out)
        return event;
      }
    }

    // Apply anonymization if enabled
    const processedEvent = this.anonymizeEvent(event);

    // Add to buffer
    this.eventBuffer.push(processedEvent);

    // Check if we should flush
    if (
      this.config.batchConfig?.maxSize &&
      this.eventBuffer.length >= this.config.batchConfig.maxSize
    ) {
      await this.flush();
    }

    this.emit('tracked', processedEvent);
    return processedEvent;
  }

  /**
   * Track multiple events
   */
  async trackBatch(
    eventsData: Array<Omit<AnalyticsEvent, 'id' | 'timestamp'>>,
  ): Promise<AnalyticsEvent[]> {
    const events = eventsData.map((data) => ({
      id: nanoid(),
      timestamp: Date.now(),
      ...data,
    }));

    const processedEvents = events
      .filter(() => {
        // Apply sampling
        const sampling = this.config.sampling;
        if (sampling) {
          const rate =
            typeof sampling === 'number'
              ? sampling
              : sampling.enabled
                ? sampling.rate
                : 1.0;
          return Math.random() <= rate;
        }
        return true;
      })
      .map((event) => this.anonymizeEvent(event));

    // Add all to buffer
    this.eventBuffer.push(...processedEvents);

    // Check if we should flush
    if (
      this.config.batchConfig?.maxSize &&
      this.eventBuffer.length >= this.config.batchConfig.maxSize
    ) {
      await this.flush();
    }

    for (const event of processedEvents) {
      this.emit('tracked', event);
    }

    return processedEvents;
  }

  /**
   * Anonymize an event based on config
   */
  private anonymizeEvent(event: AnalyticsEvent): AnalyticsEvent {
    if (!this.config.anonymization?.enabled) {
      return event;
    }

    const anonymized = { ...event };
    const anonymization = this.config.anonymization;

    // Hash user ID if configured
    if (anonymization.hashUserIds && anonymized.userId) {
      anonymized.userId = this.hashString(anonymized.userId);
    }

    // Anonymize specified fields
    if (anonymization.fieldsToAnonymize && anonymized.properties) {
      for (const field of anonymization.fieldsToAnonymize) {
        if (field in anonymized.properties) {
          anonymized.properties[field] = '[REDACTED]';
        }
      }
    }

    return anonymized;
  }

  /**
   * Simple hash function for anonymization
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return `anon_${Math.abs(hash).toString(16)}`;
  }

  /**
   * Track a conversation event
   */
  async trackConversation(
    conversationId: string,
    eventType: 'started' | 'ended' | 'message' | 'escalated' | 'abandoned',
    properties?: Record<string, unknown>,
  ): Promise<AnalyticsEvent> {
    return this.track({
      type: `conversation_${eventType}` as EventType,
      conversationId,
      data: properties ?? {},
    });
  }

  /**
   * Track a user action event
   */
  async trackUserAction(
    action: string,
    properties?: Record<string, unknown>,
    userId?: string,
    sessionId?: string,
  ): Promise<AnalyticsEvent> {
    return this.track({
      type: 'user_action' as EventType,
      name: action,
      userId,
      sessionId,
      data: properties ?? {},
    });
  }

  /**
   * Track a tool usage event
   */
  async trackToolUsage(
    toolName: string,
    success: boolean,
    durationMs: number,
    conversationId?: string,
    properties?: Record<string, unknown>,
  ): Promise<AnalyticsEvent> {
    return this.track({
      type: 'tool_usage' as EventType,
      name: toolName,
      conversationId,
      data: {
        success,
        durationMs,
        ...properties,
      },
    });
  }

  /**
   * Track an error event
   */
  async trackError(
    errorType: string,
    errorMessage: string,
    properties?: Record<string, unknown>,
    conversationId?: string,
  ): Promise<AnalyticsEvent> {
    return this.track({
      type: 'error' as EventType,
      name: errorType,
      conversationId,
      data: {
        message: errorMessage,
        ...properties,
      },
    });
  }

  /**
   * Track a feedback event
   */
  async trackFeedback(
    rating: number,
    comment?: string,
    conversationId?: string,
    userId?: string,
  ): Promise<AnalyticsEvent> {
    return this.track({
      type: 'feedback' as EventType,
      conversationId,
      userId,
      data: {
        rating,
        comment,
      },
    });
  }

  /**
   * Track a custom event
   */
  async trackCustom(
    name: string,
    properties?: Record<string, unknown>,
    options?: {
      conversationId?: string;
      userId?: string;
      sessionId?: string;
    },
  ): Promise<AnalyticsEvent> {
    return this.track({
      type: 'custom' as EventType,
      name,
      ...options,
      data: properties ?? {},
    });
  }

  /**
   * Get buffer size
   */
  getBufferSize(): number {
    return this.eventBuffer.length;
  }

  /**
   * Check if buffer is full
   */
  isBufferFull(): boolean {
    return (
      this.config.batchConfig?.maxSize !== undefined &&
      this.eventBuffer.length >= this.config.batchConfig.maxSize
    );
  }
}
