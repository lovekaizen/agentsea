import { randomUUID } from 'crypto';

import { SpanContext } from '../types';

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTime: Date;
  endTime?: Date;
  attributes: Record<string, any>;
  events: Array<{ timestamp: Date; name: string; attributes?: any }>;
  status: 'ok' | 'error';
  error?: Error;
}

/**
 * Tracer for distributed tracing
 */
export class Tracer {
  private spans: Map<string, Span> = new Map();
  private activeSpans: Map<string, string> = new Map(); // context -> spanId

  /**
   * Start a new span
   */
  startSpan(
    name: string,
    context?: SpanContext,
  ): { span: Span; context: SpanContext } {
    const span: Span = {
      traceId: context?.traceId || randomUUID(),
      spanId: randomUUID(),
      parentSpanId: context?.spanId,
      name,
      startTime: new Date(),
      attributes: {},
      events: [],
      status: 'ok',
    };

    this.spans.set(span.spanId, span);

    const newContext: SpanContext = {
      traceId: span.traceId,
      spanId: span.spanId,
      parentSpanId: span.parentSpanId,
    };

    return { span, context: newContext };
  }

  /**
   * End a span
   */
  endSpan(spanId: string, error?: Error): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.endTime = new Date();
      if (error) {
        span.status = 'error';
        span.error = error;
      }
    }
  }

  /**
   * Add attributes to a span
   */
  setAttributes(spanId: string, attributes: Record<string, any>): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.attributes = { ...span.attributes, ...attributes };
    }
  }

  /**
   * Add an event to a span
   */
  addEvent(
    spanId: string,
    name: string,
    attributes?: Record<string, any>,
  ): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.events.push({
        timestamp: new Date(),
        name,
        attributes,
      });
    }
  }

  /**
   * Get a span by ID
   */
  getSpan(spanId: string): Span | undefined {
    return this.spans.get(spanId);
  }

  /**
   * Get all spans for a trace
   */
  getTrace(traceId: string): Span[] {
    return Array.from(this.spans.values()).filter((s) => s.traceId === traceId);
  }

  /**
   * Get span duration in milliseconds
   */
  getSpanDuration(spanId: string): number | undefined {
    const span = this.spans.get(spanId);
    if (span && span.endTime) {
      return span.endTime.getTime() - span.startTime.getTime();
    }
    return undefined;
  }

  /**
   * Clear all spans
   */
  clear(): void {
    this.spans.clear();
    this.activeSpans.clear();
  }

  /**
   * Export spans (for sending to tracing backends)
   */
  export(): Span[] {
    return Array.from(this.spans.values());
  }
}

/**
 * Global tracer instance
 */
export const globalTracer = new Tracer();
