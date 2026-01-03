/**
 * Tracer
 *
 * OpenTelemetry tracing for guardrails.
 */

import type { GuardResult } from '../types';

/**
 * Span interface (compatible with OpenTelemetry)
 */
export interface Span {
  setAttribute(key: string, value: string | number | boolean): Span;
  setStatus(status: { code: number; message?: string }): Span;
  recordException(exception: Error): Span;
  end(): void;
}

/**
 * Tracer interface (compatible with OpenTelemetry)
 */
export interface Tracer {
  startSpan(name: string, options?: Record<string, unknown>): Span;
}

/**
 * Tracer configuration
 */
export interface TracerConfig {
  /** Service name */
  serviceName?: string;
  /** Enable tracing */
  enabled?: boolean;
  /** Custom tracer (OpenTelemetry compatible) */
  tracer?: Tracer;
}

/**
 * Span status codes
 */
export const SpanStatusCode = {
  UNSET: 0,
  OK: 1,
  ERROR: 2,
} as const;

/**
 * NoOp Span (when tracing is disabled)
 */
class NoOpSpan implements Span {
  setAttribute(): Span {
    return this;
  }
  setStatus(): Span {
    return this;
  }
  recordException(): Span {
    return this;
  }
  end(): void {}
}

/**
 * Simple in-memory span for testing/debugging
 */
class InMemorySpan implements Span {
  private attributes: Record<string, string | number | boolean> = {};
  private status?: { code: number; message?: string };
  private exception?: Error;
  private startTime: number;
  private endTime?: number;

  constructor(
    public readonly name: string,
    private onEnd?: (span: InMemorySpan) => void,
  ) {
    this.startTime = Date.now();
  }

  setAttribute(key: string, value: string | number | boolean): Span {
    this.attributes[key] = value;
    return this;
  }

  setStatus(status: { code: number; message?: string }): Span {
    this.status = status;
    return this;
  }

  recordException(exception: Error): Span {
    this.exception = exception;
    this.setStatus({ code: SpanStatusCode.ERROR, message: exception.message });
    return this;
  }

  end(): void {
    this.endTime = Date.now();
    this.onEnd?.(this);
  }

  toJSON() {
    return {
      name: this.name,
      attributes: this.attributes,
      status: this.status,
      exception: this.exception?.message,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.endTime ? this.endTime - this.startTime : undefined,
    };
  }
}

/**
 * Guardrails Tracer
 *
 * OpenTelemetry-compatible tracing for guardrails.
 *
 * @example
 * ```typescript
 * import { trace } from '@opentelemetry/api';
 *
 * const tracer = new GuardrailsTracer({
 *   serviceName: 'my-app',
 *   tracer: trace.getTracer('guardrails'),
 * });
 *
 * // Trace a guard check
 * const span = tracer.startGuardCheck('toxicity', 'input');
 * try {
 *   const result = await guard.check(context);
 *   tracer.endGuardCheck(span, result);
 * } catch (error) {
 *   tracer.recordError(span, error);
 *   span.end();
 * }
 * ```
 */
export class GuardrailsTracer {
  private serviceName: string;
  private enabled: boolean;
  private tracer?: Tracer;
  private spans: InMemorySpan[] = [];

  constructor(config: TracerConfig = {}) {
    this.serviceName = config.serviceName ?? 'guardrails';
    this.enabled = config.enabled ?? true;
    this.tracer = config.tracer;
  }

  /**
   * Start a guard check span
   */
  startGuardCheck(guardName: string, type: 'input' | 'output'): Span {
    if (!this.enabled) {
      return new NoOpSpan();
    }

    const span = this.startSpan(`guardrails.guard.${guardName}`);
    span.setAttribute('guardrails.guard.name', guardName);
    span.setAttribute('guardrails.content.type', type);
    span.setAttribute('service.name', this.serviceName);

    return span;
  }

  /**
   * End a guard check span
   */
  endGuardCheck(span: Span, result: GuardResult): void {
    span.setAttribute('guardrails.guard.passed', result.passed);
    span.setAttribute('guardrails.guard.action', result.action);
    span.setAttribute('guardrails.guard.latency_ms', result.latencyMs);

    if (result.confidence !== undefined) {
      span.setAttribute('guardrails.guard.confidence', result.confidence);
    }

    if (result.passed) {
      span.setStatus({ code: SpanStatusCode.OK });
    } else {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: result.message,
      });
    }

    span.end();
  }

  /**
   * Start a pipeline span
   */
  startPipeline(pipelineName: string, guardCount: number): Span {
    if (!this.enabled) {
      return new NoOpSpan();
    }

    const span = this.startSpan(`guardrails.pipeline.${pipelineName}`);
    span.setAttribute('guardrails.pipeline.name', pipelineName);
    span.setAttribute('guardrails.pipeline.guard_count', guardCount);
    span.setAttribute('service.name', this.serviceName);

    return span;
  }

  /**
   * End a pipeline span
   */
  endPipeline(span: Span, passed: boolean, totalLatencyMs: number): void {
    span.setAttribute('guardrails.pipeline.passed', passed);
    span.setAttribute('guardrails.pipeline.latency_ms', totalLatencyMs);

    if (passed) {
      span.setStatus({ code: SpanStatusCode.OK });
    } else {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: 'Pipeline failed',
      });
    }

    span.end();
  }

  /**
   * Record an error on a span
   */
  recordError(span: Span, error: Error): void {
    span.recordException(error);
  }

  /**
   * Start a generic span
   */
  startSpan(name: string): Span {
    if (!this.enabled) {
      return new NoOpSpan();
    }

    if (this.tracer) {
      return this.tracer.startSpan(name);
    }

    // Use in-memory span for testing/debugging
    const span = new InMemorySpan(name, (s) => this.spans.push(s));
    return span;
  }

  /**
   * Get recorded spans (for testing/debugging)
   */
  getSpans(): InMemorySpan[] {
    return this.spans;
  }

  /**
   * Clear recorded spans
   */
  clearSpans(): void {
    this.spans = [];
  }
}

/**
 * Create tracer instance
 */
export function createTracer(config?: TracerConfig): GuardrailsTracer {
  return new GuardrailsTracer(config);
}

export default GuardrailsTracer;
