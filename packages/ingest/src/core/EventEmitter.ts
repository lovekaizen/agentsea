/**
 * Event Emitter
 *
 * Simple typed event emitter for pipeline events.
 */

import type { DocumentEvent, PipelineEventEmitter } from '../types/index.js';

type EventHandler<T> = (event: T) => void;

/**
 * Typed event emitter for document processing events
 */
export class IngestEventEmitter implements PipelineEventEmitter {
  private listeners: Map<string, Set<EventHandler<DocumentEvent>>> = new Map();

  /**
   * Subscribe to events
   */
  on(
    eventType: DocumentEvent['type'],
    handler: EventHandler<DocumentEvent>,
  ): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(handler);
  }

  /**
   * Unsubscribe from events
   */
  off(
    eventType: DocumentEvent['type'],
    handler: EventHandler<DocumentEvent>,
  ): void {
    const handlers = this.listeners.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Subscribe to event once
   */
  once(
    eventType: DocumentEvent['type'],
    handler: EventHandler<DocumentEvent>,
  ): void {
    const onceHandler: EventHandler<DocumentEvent> = (event) => {
      this.off(eventType, onceHandler);
      handler(event);
    };
    this.on(eventType, onceHandler);
  }

  /**
   * Emit event
   */
  emit(event: DocumentEvent): void {
    const handlers = this.listeners.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (error) {
          console.error(`Error in event handler for ${event.type}:`, error);
        }
      }
    }
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(eventType?: DocumentEvent['type']): void {
    if (eventType) {
      this.listeners.delete(eventType);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get listener count
   */
  listenerCount(eventType: DocumentEvent['type']): number {
    return this.listeners.get(eventType)?.size ?? 0;
  }
}

/**
 * Create a new event emitter instance
 */
export function createEventEmitter(): PipelineEventEmitter {
  return new IngestEventEmitter();
}
