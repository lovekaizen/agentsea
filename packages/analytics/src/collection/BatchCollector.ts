/**
 * Batch Collector
 *
 * Collects events in batches for efficient storage.
 */

import { EventEmitter } from 'eventemitter3';
import { nanoid } from 'nanoid';
import type {
  AnalyticsConfig,
  AnalyticsEvent,
  AnalyticsStorageAdapter,
} from '../types/index.js';

/**
 * Batch collector events
 */
export interface BatchCollectorEvents {
  added: (event: AnalyticsEvent) => void;
  processed: (count: number) => void;
  flushed: (events: AnalyticsEvent[]) => void;
  error: (error: Error) => void;
}

/**
 * Batch statistics
 */
export interface BatchStats {
  /** Total events collected */
  totalCollected: number;
  /** Total events processed */
  totalProcessed: number;
  /** Current buffer size */
  bufferSize: number;
  /** Total batches flushed */
  batchesFlushed: number;
  /** Average batch size */
  avgBatchSize: number;
  /** Events dropped due to errors */
  eventsDropped: number;
}

/**
 * BatchCollector - Collects events in batches
 */
export class BatchCollector extends EventEmitter<BatchCollectorEvents> {
  private readonly storage: AnalyticsStorageAdapter;
  private readonly config: AnalyticsConfig;
  private readonly buffer: AnalyticsEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private isInitialized = false;
  private stats: BatchStats = {
    totalCollected: 0,
    totalProcessed: 0,
    bufferSize: 0,
    batchesFlushed: 0,
    avgBatchSize: 0,
    eventsDropped: 0,
  };
  private totalBatchedEvents = 0;

  constructor(storage: AnalyticsStorageAdapter, config: AnalyticsConfig) {
    super();
    this.storage = storage;
    this.config = config;
  }

  /**
   * Initialize the batch collector
   */
  initialize(): void {
    if (this.isInitialized) {
      return;
    }

    // Start periodic flush timer
    const maxAge = this.config.batchConfig?.maxAge ?? 5000;
    this.flushTimer = setInterval(() => void this.flush(), maxAge);

    this.isInitialized = true;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Flush remaining events if configured
    if (this.config.batchConfig?.flushOnShutdown) {
      await this.flush();
    }

    this.isInitialized = false;
  }

  /**
   * Add an event to the batch
   */
  async add(
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
        // Sampled out - return event but don't add to buffer
        return event;
      }
    }

    this.buffer.push(event);
    this.stats.totalCollected++;
    this.stats.bufferSize = this.buffer.length;

    this.emit('added', event);

    // Check if we should flush
    const maxSize = this.config.batchConfig?.maxSize ?? 100;
    if (this.buffer.length >= maxSize) {
      await this.flush();
    }

    return event;
  }

  /**
   * Add multiple events to the batch
   */
  async addBatch(
    eventsData: Array<Omit<AnalyticsEvent, 'id' | 'timestamp'>>,
  ): Promise<AnalyticsEvent[]> {
    const events: AnalyticsEvent[] = [];

    for (const data of eventsData) {
      const event = await this.add(data);
      events.push(event);
    }

    return events;
  }

  /**
   * Flush the buffer to storage
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    const events = [...this.buffer];
    this.buffer.length = 0;
    this.stats.bufferSize = 0;

    try {
      // Save all events
      await Promise.all(events.map((event) => this.storage.saveEvent(event)));

      // Update stats
      this.stats.totalProcessed += events.length;
      this.stats.batchesFlushed++;
      this.totalBatchedEvents += events.length;
      this.stats.avgBatchSize =
        this.totalBatchedEvents / this.stats.batchesFlushed;

      this.emit('processed', events.length);
      this.emit('flushed', events);
    } catch (error) {
      // Put events back in buffer
      this.buffer.unshift(...events);
      this.stats.bufferSize = this.buffer.length;
      this.stats.eventsDropped += events.length;

      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Force flush with retry
   */
  async forceFlush(maxRetries = 3): Promise<void> {
    let lastError: Error | undefined;

    for (let i = 0; i < maxRetries; i++) {
      try {
        await this.flush();
        return;
      } catch (error) {
        lastError = error as Error;
        // Wait before retry (exponential backoff)
        await this.delay(Math.pow(2, i) * 100);
      }
    }

    if (lastError) {
      throw lastError;
    }
  }

  /**
   * Get buffer contents without flushing
   */
  getBuffer(): AnalyticsEvent[] {
    return [...this.buffer];
  }

  /**
   * Get buffer size
   */
  getBufferSize(): number {
    return this.buffer.length;
  }

  /**
   * Check if buffer is full
   */
  isBufferFull(): boolean {
    const maxSize = this.config.batchConfig?.maxSize ?? 100;
    return this.buffer.length >= maxSize;
  }

  /**
   * Get statistics
   */
  getStats(): BatchStats {
    return { ...this.stats };
  }

  /**
   * Clear the buffer without flushing
   */
  clear(): void {
    const dropped = this.buffer.length;
    this.buffer.length = 0;
    this.stats.bufferSize = 0;
    this.stats.eventsDropped += dropped;
  }

  /**
   * Helper to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
