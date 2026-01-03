/**
 * Debugger
 *
 * Memory debugging and tracing tools.
 */

import { EventEmitter } from 'eventemitter3';
import type {
  MemoryEntry,
  MemoryStoreInterface,
  RetrievalDebugOptions,
} from '../types/index.js';

/**
 * Debug trace entry
 */
export interface DebugTrace {
  id: string;
  operation: string;
  timestamp: number;
  duration: number;
  input: unknown;
  output: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Retrieval debug info
 */
export interface RetrievalDebugInfo {
  query: string;
  totalCandidates: number;
  returnedCount: number;
  strategyUsed: string;
  filteringSteps: Array<{
    name: string;
    inputCount: number;
    outputCount: number;
    durationMs: number;
  }>;
  scoringDetails: Array<{
    entryId: string;
    scores: Record<string, number>;
    finalScore: number;
  }>;
  timing: {
    total: number;
    embedding?: number;
    search?: number;
    filtering?: number;
    ranking?: number;
  };
}

/**
 * Breakpoint
 */
export interface Breakpoint {
  id: string;
  condition: (entry: MemoryEntry, operation: string) => boolean;
  enabled: boolean;
  hitCount: number;
}

/**
 * Debug events
 */
export interface DebuggerEvents {
  trace: (trace: DebugTrace) => void;
  breakpointHit: (
    breakpoint: Breakpoint,
    entry: MemoryEntry,
    operation: string,
  ) => void;
  warning: (message: string, data?: unknown) => void;
}

/**
 * Memory debugger
 */
export class Debugger extends EventEmitter<DebuggerEvents> {
  private store: MemoryStoreInterface;
  private traces: DebugTrace[] = [];
  private breakpoints: Map<string, Breakpoint> = new Map();
  private enabled: boolean = true;
  private maxTraces: number = 1000;

  constructor(store: MemoryStoreInterface) {
    super();
    this.store = store;
  }

  /**
   * Enable debugging
   */
  enable(): void {
    this.enabled = true;
  }

  /**
   * Disable debugging
   */
  disable(): void {
    this.enabled = false;
  }

  /**
   * Check if debugging is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Trace an operation
   */
  trace(
    operation: string,
    input: unknown,
    output: unknown,
    durationMs: number,
    metadata?: Record<string, unknown>,
  ): void {
    if (!this.enabled) return;

    const trace: DebugTrace = {
      id: `trace-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      operation,
      timestamp: Date.now(),
      duration: durationMs,
      input,
      output,
      metadata,
    };

    this.traces.push(trace);

    // Trim if too many traces
    if (this.traces.length > this.maxTraces) {
      this.traces = this.traces.slice(-this.maxTraces);
    }

    this.emit('trace', trace);
  }

  /**
   * Wrap a function with tracing
   */
  wrapWithTrace<T extends (...args: unknown[]) => Promise<unknown>>(
    operation: string,
    fn: T,
  ): T {
    return (async (...args: unknown[]) => {
      const startTime = Date.now();
      try {
        const result = await fn(...args);
        this.trace(operation, args, result, Date.now() - startTime);
        return result;
      } catch (error) {
        this.trace(
          operation,
          args,
          { error: String(error) },
          Date.now() - startTime,
          {
            error: true,
          },
        );
        throw error;
      }
    }) as T;
  }

  /**
   * Add a breakpoint
   */
  addBreakpoint(
    condition: (entry: MemoryEntry, operation: string) => boolean,
    id?: string,
  ): string {
    const breakpointId =
      id ?? `bp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    this.breakpoints.set(breakpointId, {
      id: breakpointId,
      condition,
      enabled: true,
      hitCount: 0,
    });

    return breakpointId;
  }

  /**
   * Remove a breakpoint
   */
  removeBreakpoint(id: string): boolean {
    return this.breakpoints.delete(id);
  }

  /**
   * Enable/disable a breakpoint
   */
  toggleBreakpoint(id: string, enabled: boolean): boolean {
    const bp = this.breakpoints.get(id);
    if (!bp) return false;
    bp.enabled = enabled;
    return true;
  }

  /**
   * Check breakpoints for an entry/operation
   */
  checkBreakpoints(entry: MemoryEntry, operation: string): void {
    if (!this.enabled) return;

    for (const bp of this.breakpoints.values()) {
      if (!bp.enabled) continue;

      try {
        if (bp.condition(entry, operation)) {
          bp.hitCount++;
          this.emit('breakpointHit', bp, entry, operation);
        }
      } catch (error) {
        this.emit('warning', `Breakpoint ${bp.id} condition error`, error);
      }
    }
  }

  /**
   * Debug a retrieval operation
   */
  async debugRetrieval(
    query: string,
    embedFn: (text: string) => Promise<number[]>,
    options?: RetrievalDebugOptions,
  ): Promise<RetrievalDebugInfo> {
    const timing: RetrievalDebugInfo['timing'] = { total: 0 };
    const filteringSteps: RetrievalDebugInfo['filteringSteps'] = [];
    const scoringDetails: RetrievalDebugInfo['scoringDetails'] = [];

    const totalStart = Date.now();

    // Step 1: Generate embedding
    const embeddingStart = Date.now();
    const embedding = await embedFn(query);
    timing.embedding = Date.now() - embeddingStart;

    // Step 2: Search
    const searchStart = Date.now();
    const searchResults = await this.store.search(embedding, {
      topK: options?.candidateMultiplier
        ? (options.limit ?? 10) * options.candidateMultiplier
        : 100,
      minScore: 0, // Get all for debugging
    });
    timing.search = Date.now() - searchStart;

    filteringSteps.push({
      name: 'initial-search',
      inputCount: 0,
      outputCount: searchResults.length,
      durationMs: timing.search,
    });

    // Step 3: Apply filters
    let filtered = searchResults;
    const filterStart = Date.now();

    if (options?.types && options.types.length > 0) {
      const beforeCount = filtered.length;
      filtered = filtered.filter((r) => options.types!.includes(r.entry.type));
      filteringSteps.push({
        name: 'type-filter',
        inputCount: beforeCount,
        outputCount: filtered.length,
        durationMs: 0,
      });
    }

    if (options?.namespace) {
      const beforeCount = filtered.length;
      filtered = filtered.filter(
        (r) => r.entry.metadata.namespace === options.namespace,
      );
      filteringSteps.push({
        name: 'namespace-filter',
        inputCount: beforeCount,
        outputCount: filtered.length,
        durationMs: 0,
      });
    }

    if (options?.minScore !== undefined) {
      const beforeCount = filtered.length;
      filtered = filtered.filter((r) => r.score >= options.minScore!);
      filteringSteps.push({
        name: 'score-filter',
        inputCount: beforeCount,
        outputCount: filtered.length,
        durationMs: 0,
      });
    }

    timing.filtering = Date.now() - filterStart;

    // Step 4: Scoring details
    for (const result of filtered.slice(0, options?.limit ?? 10)) {
      scoringDetails.push({
        entryId: result.entry.id,
        scores: {
          similarity: result.score,
          importance: result.entry.importance,
          recency:
            1 /
            (1 + (Date.now() - result.entry.timestamp) / (24 * 60 * 60 * 1000)),
        },
        finalScore: result.score,
      });
    }

    timing.total = Date.now() - totalStart;

    return {
      query,
      totalCandidates: searchResults.length,
      returnedCount: Math.min(filtered.length, options?.limit ?? 10),
      strategyUsed: 'semantic',
      filteringSteps,
      scoringDetails,
      timing,
    };
  }

  /**
   * Get recent traces
   */
  getTraces(options?: {
    operation?: string;
    limit?: number;
    startTime?: number;
    endTime?: number;
  }): DebugTrace[] {
    let traces = [...this.traces];

    if (options?.operation) {
      traces = traces.filter((t) => t.operation === options.operation);
    }
    if (options?.startTime) {
      traces = traces.filter((t) => t.timestamp >= options.startTime!);
    }
    if (options?.endTime) {
      traces = traces.filter((t) => t.timestamp <= options.endTime!);
    }

    traces.sort((a, b) => b.timestamp - a.timestamp);

    return options?.limit ? traces.slice(0, options.limit) : traces;
  }

  /**
   * Get operation statistics
   */
  getOperationStats(): Map<
    string,
    {
      count: number;
      avgDuration: number;
      maxDuration: number;
      minDuration: number;
    }
  > {
    const stats = new Map<
      string,
      {
        count: number;
        totalDuration: number;
        maxDuration: number;
        minDuration: number;
      }
    >();

    for (const trace of this.traces) {
      const existing = stats.get(trace.operation) ?? {
        count: 0,
        totalDuration: 0,
        maxDuration: 0,
        minDuration: Infinity,
      };

      existing.count++;
      existing.totalDuration += trace.duration;
      existing.maxDuration = Math.max(existing.maxDuration, trace.duration);
      existing.minDuration = Math.min(existing.minDuration, trace.duration);

      stats.set(trace.operation, existing);
    }

    const result = new Map<
      string,
      {
        count: number;
        avgDuration: number;
        maxDuration: number;
        minDuration: number;
      }
    >();

    for (const [op, data] of stats) {
      result.set(op, {
        count: data.count,
        avgDuration: data.totalDuration / data.count,
        maxDuration: data.maxDuration,
        minDuration: data.minDuration === Infinity ? 0 : data.minDuration,
      });
    }

    return result;
  }

  /**
   * Get all breakpoints
   */
  getBreakpoints(): Breakpoint[] {
    return Array.from(this.breakpoints.values());
  }

  /**
   * Clear traces
   */
  clearTraces(): void {
    this.traces = [];
  }

  /**
   * Clear all breakpoints
   */
  clearBreakpoints(): void {
    this.breakpoints.clear();
  }

  /**
   * Create a snapshot of current debug state
   */
  createSnapshot(): {
    traces: DebugTrace[];
    breakpoints: Array<{ id: string; enabled: boolean; hitCount: number }>;
    stats: Map<
      string,
      {
        count: number;
        avgDuration: number;
        maxDuration: number;
        minDuration: number;
      }
    >;
    timestamp: number;
  } {
    return {
      traces: [...this.traces],
      breakpoints: this.getBreakpoints().map((bp) => ({
        id: bp.id,
        enabled: bp.enabled,
        hitCount: bp.hitCount,
      })),
      stats: this.getOperationStats(),
      timestamp: Date.now(),
    };
  }
}

/**
 * Create debugger instance
 */
export function createDebugger(store: MemoryStoreInterface): Debugger {
  return new Debugger(store);
}
