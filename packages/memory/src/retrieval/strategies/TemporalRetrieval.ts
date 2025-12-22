/**
 * TemporalRetrieval
 *
 * Time-based memory retrieval with recency weighting and temporal patterns.
 */

import type {
  MemoryEntry,
  ScoredMemory,
  TemporalRetrievalConfig,
  RetrievalResult,
  MemoryStoreInterface,
} from '../../types/index.js';

/**
 * Temporal retrieval options
 */
export interface TemporalRetrievalOptions {
  startTime?: number;
  endTime?: number;
  topK?: number;
  recencyWeight?: number;
  importanceWeight?: number;
  accessWeight?: number;
  namespace?: string;
  types?: string[];
  filter?: Record<string, unknown>;
}

/**
 * Time window definition
 */
export interface TimeWindow {
  start: number;
  end: number;
  label?: string;
}

/**
 * Temporal pattern
 */
export interface TemporalPattern {
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  interval: number; // milliseconds
  peakHours?: number[]; // hours of day (0-23)
  peakDays?: number[]; // days of week (0-6)
}

/**
 * Temporal retrieval strategy with time-based scoring
 */
export class TemporalRetrieval {
  private store: MemoryStoreInterface;
  private config: TemporalRetrievalConfig;

  constructor(
    store: MemoryStoreInterface,
    config: TemporalRetrievalConfig = {},
  ) {
    this.store = store;
    this.config = {
      recencyWeight: config.recencyWeight ?? 0.5,
      importanceWeight: config.importanceWeight ?? 0.3,
      accessWeight: config.accessWeight ?? 0.2,
      decayFunction: config.decayFunction ?? 'exponential',
      decayHalfLife: config.decayHalfLife ?? 24 * 60 * 60 * 1000, // 24 hours
      topK: config.topK ?? 10,
      ...config,
    };
  }

  /**
   * Retrieve memories with temporal scoring
   */
  async retrieve(options: TemporalRetrievalOptions): Promise<RetrievalResult> {
    const startTime = Date.now();

    // Query memories within time range
    const { entries } = await this.store.query({
      startTime: options.startTime,
      endTime: options.endTime,
      namespace: options.namespace,
      types: options.types as MemoryEntry['type'][],
      limit: 1000, // Get many candidates for scoring
    });

    // Apply filter if provided
    let filtered = entries;
    if (options.filter) {
      filtered = this.applyFilter(entries, options.filter);
    }

    // Score memories
    const now = Date.now();
    const scored: ScoredMemory[] = filtered.map((entry) => ({
      entry,
      score: this.calculateTemporalScore(entry, now, options),
    }));

    // Sort by score and take top-K
    scored.sort((a, b) => b.score - a.score);
    const topK = options.topK ?? this.config.topK!;
    const results = scored.slice(0, topK);

    return {
      memories: results.map((r) => r.entry),
      scores: results.map((r) => r.score),
      totalCandidates: filtered.length,
      retrievalTimeMs: Date.now() - startTime,
      strategy: 'temporal',
    };
  }

  /**
   * Retrieve memories from specific time windows
   */
  async retrieveFromWindows(
    windows: TimeWindow[],
    options?: Partial<TemporalRetrievalOptions>,
  ): Promise<Map<string, RetrievalResult>> {
    const results = new Map<string, RetrievalResult>();

    for (const window of windows) {
      const label = window.label ?? `${window.start}-${window.end}`;
      const result = await this.retrieve({
        ...options,
        startTime: window.start,
        endTime: window.end,
      });
      results.set(label, result);
    }

    return results;
  }

  /**
   * Get memories from relative time periods
   */
  async retrieveRecent(
    period: 'hour' | 'day' | 'week' | 'month',
    options?: Partial<TemporalRetrievalOptions>,
  ): Promise<RetrievalResult> {
    const now = Date.now();
    const periodMs = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
    };

    return this.retrieve({
      ...options,
      startTime: now - periodMs[period],
      endTime: now,
    });
  }

  /**
   * Get trending memories (high access in recent time)
   */
  async retrieveTrending(
    windowMs: number = 24 * 60 * 60 * 1000,
    options?: Partial<TemporalRetrievalOptions>,
  ): Promise<RetrievalResult> {
    const startTime = Date.now();
    const windowStart = startTime - windowMs;

    // Get recent memories
    const { entries } = await this.store.query({
      startTime: windowStart,
      namespace: options?.namespace,
      limit: 1000,
    });

    // Score by access frequency relative to age
    const scored: ScoredMemory[] = entries.map((entry) => {
      const age = startTime - entry.timestamp;
      const accessRate =
        entry.accessCount / Math.max(age / (60 * 60 * 1000), 1); // accesses per hour
      return {
        entry,
        score: accessRate * entry.importance,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    const topK = options?.topK ?? this.config.topK!;
    const results = scored.slice(0, topK);

    return {
      memories: results.map((r) => r.entry),
      scores: results.map((r) => r.score),
      totalCandidates: entries.length,
      retrievalTimeMs: Date.now() - startTime,
      strategy: 'temporal-trending',
    };
  }

  /**
   * Get memories matching a temporal pattern
   */
  async retrieveByPattern(
    pattern: TemporalPattern,
    lookbackPeriods: number = 4,
    options?: Partial<TemporalRetrievalOptions>,
  ): Promise<RetrievalResult> {
    const startTime = Date.now();
    const now = Date.now();

    // Calculate time windows matching the pattern
    const windows: TimeWindow[] = [];

    for (let i = 0; i < lookbackPeriods; i++) {
      const periodStart = now - (i + 1) * pattern.interval;
      const periodEnd = now - i * pattern.interval;

      // Filter by peak hours/days if specified
      if (pattern.peakHours || pattern.peakDays) {
        const date = new Date(periodStart);
        const hour = date.getHours();
        const day = date.getDay();

        if (pattern.peakHours && !pattern.peakHours.includes(hour)) {
          continue;
        }
        if (pattern.peakDays && !pattern.peakDays.includes(day)) {
          continue;
        }
      }

      windows.push({ start: periodStart, end: periodEnd });
    }

    // Get memories from all matching windows
    const allEntries: MemoryEntry[] = [];
    for (const window of windows) {
      const { entries } = await this.store.query({
        startTime: window.start,
        endTime: window.end,
        namespace: options?.namespace,
        limit: 100,
      });
      allEntries.push(...entries);
    }

    // Deduplicate
    const uniqueEntries = this.deduplicateEntries(allEntries);

    // Score and sort
    const scored: ScoredMemory[] = uniqueEntries.map((entry) => ({
      entry,
      score: this.calculateTemporalScore(entry, now, options ?? {}),
    }));

    scored.sort((a, b) => b.score - a.score);
    const topK = options?.topK ?? this.config.topK!;
    const results = scored.slice(0, topK);

    return {
      memories: results.map((r) => r.entry),
      scores: results.map((r) => r.score),
      totalCandidates: uniqueEntries.length,
      retrievalTimeMs: Date.now() - startTime,
      strategy: 'temporal-pattern',
      metadata: {
        pattern: pattern.type,
        windowsMatched: windows.length,
      },
    };
  }

  /**
   * Get timeline of memories
   */
  async getTimeline(options: {
    startTime: number;
    endTime: number;
    bucketSize: 'hour' | 'day' | 'week';
    namespace?: string;
  }): Promise<Map<string, MemoryEntry[]>> {
    const bucketMs = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
    };

    const { entries } = await this.store.query({
      startTime: options.startTime,
      endTime: options.endTime,
      namespace: options.namespace,
      limit: 10000,
    });

    const timeline = new Map<string, MemoryEntry[]>();
    const size = bucketMs[options.bucketSize];

    for (const entry of entries) {
      const bucketStart = Math.floor(entry.timestamp / size) * size;
      const key = new Date(bucketStart).toISOString();

      if (!timeline.has(key)) {
        timeline.set(key, []);
      }
      timeline.get(key)!.push(entry);
    }

    return timeline;
  }

  /**
   * Calculate temporal score for a memory
   */
  private calculateTemporalScore(
    entry: MemoryEntry,
    now: number,
    options: TemporalRetrievalOptions,
  ): number {
    const recencyWeight = options.recencyWeight ?? this.config.recencyWeight!;
    const importanceWeight =
      options.importanceWeight ?? this.config.importanceWeight!;
    const accessWeight = options.accessWeight ?? this.config.accessWeight!;

    // Calculate recency score (0-1)
    const recencyScore = this.calculateDecay(now - entry.timestamp);

    // Importance score (already 0-1)
    const importanceScore = entry.importance;

    // Access score (normalized)
    const maxAccessCount = 100; // Normalize against expected max
    const accessScore = Math.min(entry.accessCount / maxAccessCount, 1);

    // Weighted combination
    return (
      recencyScore * recencyWeight +
      importanceScore * importanceWeight +
      accessScore * accessWeight
    );
  }

  /**
   * Calculate decay based on configured function
   */
  private calculateDecay(ageMs: number): number {
    const halfLife = this.config.decayHalfLife!;

    switch (this.config.decayFunction) {
      case 'exponential':
        return Math.exp((-Math.LN2 * ageMs) / halfLife);

      case 'linear':
        return Math.max(0, 1 - ageMs / (halfLife * 2));

      case 'step':
        // Returns 1 if within half-life, 0 otherwise
        return ageMs <= halfLife ? 1 : 0;

      case 'logarithmic':
        // Slower decay using log
        return 1 / (1 + Math.log2(1 + ageMs / halfLife));

      default:
        return Math.exp((-Math.LN2 * ageMs) / halfLife);
    }
  }

  /**
   * Apply metadata filter to entries
   */
  private applyFilter(
    entries: MemoryEntry[],
    filter: Record<string, unknown>,
  ): MemoryEntry[] {
    return entries.filter((entry) => {
      for (const [key, value] of Object.entries(filter)) {
        const entryValue = entry.metadata[key];
        if (Array.isArray(value)) {
          if (!value.includes(entryValue)) return false;
        } else if (entryValue !== value) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Deduplicate entries by ID
   */
  private deduplicateEntries(entries: MemoryEntry[]): MemoryEntry[] {
    const seen = new Set<string>();
    return entries.filter((entry) => {
      if (seen.has(entry.id)) return false;
      seen.add(entry.id);
      return true;
    });
  }

  /**
   * Update configuration
   */
  configure(config: Partial<TemporalRetrievalConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): TemporalRetrievalConfig {
    return { ...this.config };
  }
}

/**
 * Create a temporal retrieval instance
 */
export function createTemporalRetrieval(
  store: MemoryStoreInterface,
  config?: TemporalRetrievalConfig,
): TemporalRetrieval {
  return new TemporalRetrieval(store, config);
}

/**
 * Helper to create common time windows
 */
export const TimeWindows = {
  lastHour: (): TimeWindow => ({
    start: Date.now() - 60 * 60 * 1000,
    end: Date.now(),
    label: 'last-hour',
  }),

  lastDay: (): TimeWindow => ({
    start: Date.now() - 24 * 60 * 60 * 1000,
    end: Date.now(),
    label: 'last-day',
  }),

  lastWeek: (): TimeWindow => ({
    start: Date.now() - 7 * 24 * 60 * 60 * 1000,
    end: Date.now(),
    label: 'last-week',
  }),

  lastMonth: (): TimeWindow => ({
    start: Date.now() - 30 * 24 * 60 * 60 * 1000,
    end: Date.now(),
    label: 'last-month',
  }),

  today: (): TimeWindow => {
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    return {
      start: startOfDay,
      end: Date.now(),
      label: 'today',
    };
  },

  yesterday: (): TimeWindow => {
    const now = new Date();
    const startOfYesterday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 1,
    ).getTime();
    const endOfYesterday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    return {
      start: startOfYesterday,
      end: endOfYesterday,
      label: 'yesterday',
    };
  },

  custom: (startDate: Date, endDate: Date, label?: string): TimeWindow => ({
    start: startDate.getTime(),
    end: endDate.getTime(),
    label,
  }),
};
