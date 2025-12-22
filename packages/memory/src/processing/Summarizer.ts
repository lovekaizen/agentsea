/**
 * Summarizer
 *
 * Summarizes memory entries using LLM or heuristic methods.
 */

import type { MemoryEntry, SummarizerConfig } from '../types/index.js';

/**
 * Summary result
 */
export interface SummaryResult {
  summary: string;
  keyPoints: string[];
  sourceCount: number;
  compressionRatio: number;
  metadata: Record<string, unknown>;
}

/**
 * Summary function type (for LLM integration)
 */
export type SummaryFunction = (
  entries: MemoryEntry[],
  options?: { maxLength?: number; style?: string },
) => Promise<string>;

/**
 * Memory summarizer
 */
export class Summarizer {
  private config: Required<SummarizerConfig>;
  private summaryFn?: SummaryFunction;

  constructor(config: SummarizerConfig = {}) {
    this.config = {
      provider:
        config.provider ??
        (undefined as unknown as Required<SummarizerConfig>['provider']),
      model: config.model ?? 'default',
      strategy: config.strategy ?? 'abstractive',
      maxLength: config.maxLength ?? 500,
      preserveEntities: config.preserveEntities ?? true,
      focusPrompt: config.focusPrompt ?? '',
      maxSummaryLength: config.maxSummaryLength ?? 500,
      minEntriesForSummary: config.minEntriesForSummary ?? 3,
      preserveKeyEntities: config.preserveKeyEntities ?? true,
      summaryStyle: config.summaryStyle ?? 'concise',
    };
  }

  /**
   * Set custom summary function (for LLM integration)
   */
  setSummaryFunction(fn: SummaryFunction): void {
    this.summaryFn = fn;
  }

  /**
   * Summarize a collection of memories
   */
  async summarize(entries: MemoryEntry[]): Promise<SummaryResult> {
    if (entries.length < this.config.minEntriesForSummary) {
      return Promise.resolve(this.createSimpleSummary(entries));
    }

    // Use custom function if provided
    if (this.summaryFn) {
      const summary = await this.summaryFn(entries, {
        maxLength: this.config.maxSummaryLength,
        style: this.config.summaryStyle,
      });

      return {
        summary,
        keyPoints: this.extractKeyPoints(entries),
        sourceCount: entries.length,
        compressionRatio: this.calculateCompressionRatio(entries, summary),
        metadata: {
          method: 'llm',
          style: this.config.summaryStyle,
        },
      };
    }

    // Fallback to heuristic summarization
    return Promise.resolve(this.heuristicSummarize(entries));
  }

  /**
   * Summarize memories by time period
   */
  async summarizeByPeriod(
    entries: MemoryEntry[],
    period: 'hour' | 'day' | 'week',
  ): Promise<Map<string, SummaryResult>> {
    const grouped = this.groupByPeriod(entries, period);
    const results = new Map<string, SummaryResult>();

    for (const [key, groupEntries] of grouped) {
      const summary = await this.summarize(groupEntries);
      results.set(key, summary);
    }

    return results;
  }

  /**
   * Summarize memories by topic/type
   */
  async summarizeByTopic(
    entries: MemoryEntry[],
  ): Promise<Map<string, SummaryResult>> {
    const grouped = this.groupByTopic(entries);
    const results = new Map<string, SummaryResult>();

    for (const [topic, topicEntries] of grouped) {
      const summary = await this.summarize(topicEntries);
      results.set(topic, summary);
    }

    return results;
  }

  /**
   * Create incremental summary (add to existing summary)
   */
  async incrementalSummarize(
    existingSummary: string,
    newEntries: MemoryEntry[],
  ): Promise<SummaryResult> {
    if (this.summaryFn) {
      // Create a pseudo-entry for the existing summary
      const contextEntry: MemoryEntry = {
        id: 'context',
        content: `Previous summary: ${existingSummary}`,
        type: 'summary',
        importance: 0.8,
        metadata: {
          source: 'system',
          confidence: 1.0,
        },
        timestamp: Date.now(),
        accessCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const summary = await this.summaryFn([contextEntry, ...newEntries], {
        maxLength: this.config.maxSummaryLength,
        style: this.config.summaryStyle,
      });

      return {
        summary,
        keyPoints: this.extractKeyPoints(newEntries),
        sourceCount: newEntries.length,
        compressionRatio: this.calculateCompressionRatio(newEntries, summary),
        metadata: {
          method: 'incremental',
          hadExistingSummary: true,
        },
      };
    }

    // Heuristic incremental summary
    const newPoints = this.extractKeyPoints(newEntries);
    const combinedSummary = `${existingSummary} Additionally: ${newPoints.join('; ')}.`;

    return {
      summary: combinedSummary.slice(0, this.config.maxSummaryLength),
      keyPoints: newPoints,
      sourceCount: newEntries.length,
      compressionRatio: this.calculateCompressionRatio(
        newEntries,
        combinedSummary,
      ),
      metadata: {
        method: 'heuristic-incremental',
      },
    };
  }

  /**
   * Heuristic-based summarization
   */
  private heuristicSummarize(entries: MemoryEntry[]): SummaryResult {
    // Sort by importance
    const sorted = [...entries].sort((a, b) => b.importance - a.importance);

    // Extract key sentences
    const keyPoints = this.extractKeyPoints(sorted);

    // Build summary
    const typeGroups = new Map<string, number>();
    for (const entry of entries) {
      typeGroups.set(entry.type, (typeGroups.get(entry.type) ?? 0) + 1);
    }

    const typesSummary = Array.from(typeGroups.entries())
      .map(([type, count]) => `${count} ${type}(s)`)
      .join(', ');

    const timeRange = this.getTimeRange(entries);
    const summary = `Summary of ${entries.length} memories (${typesSummary}) from ${timeRange}: ${keyPoints.slice(0, 3).join('. ')}.`;

    return {
      summary: summary.slice(0, this.config.maxSummaryLength),
      keyPoints,
      sourceCount: entries.length,
      compressionRatio: this.calculateCompressionRatio(entries, summary),
      metadata: {
        method: 'heuristic',
        typeDistribution: Object.fromEntries(typeGroups),
      },
    };
  }

  /**
   * Create simple summary for few entries
   */
  private createSimpleSummary(entries: MemoryEntry[]): SummaryResult {
    const summary = entries.map((e) => e.content.slice(0, 100)).join('; ');

    return {
      summary: summary.slice(0, this.config.maxSummaryLength),
      keyPoints: entries.map((e) => e.content.slice(0, 50)),
      sourceCount: entries.length,
      compressionRatio: 1,
      metadata: {
        method: 'simple',
      },
    };
  }

  /**
   * Extract key points from entries
   */
  private extractKeyPoints(entries: MemoryEntry[]): string[] {
    const points: string[] = [];

    for (const entry of entries.slice(0, 10)) {
      // Extract first sentence or meaningful chunk
      const firstSentence = entry.content.split(/[.!?]/)[0];
      if (firstSentence && firstSentence.length > 10) {
        points.push(firstSentence.trim());
      }
    }

    // Deduplicate similar points
    return this.deduplicateStrings(points);
  }

  /**
   * Group entries by time period
   */
  private groupByPeriod(
    entries: MemoryEntry[],
    period: 'hour' | 'day' | 'week',
  ): Map<string, MemoryEntry[]> {
    const groups = new Map<string, MemoryEntry[]>();

    for (const entry of entries) {
      const date = new Date(entry.timestamp);
      let key: string;

      switch (period) {
        case 'hour':
          key = `${date.toISOString().slice(0, 13)}:00`;
          break;
        case 'day':
          key = date.toISOString().slice(0, 10);
          break;
        case 'week': {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = `week-${weekStart.toISOString().slice(0, 10)}`;
          break;
        }
      }

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(entry);
    }

    return groups;
  }

  /**
   * Group entries by topic/type
   */
  private groupByTopic(entries: MemoryEntry[]): Map<string, MemoryEntry[]> {
    const groups = new Map<string, MemoryEntry[]>();

    for (const entry of entries) {
      const topic = String(entry.metadata.topic ?? entry.type);

      if (!groups.has(topic)) {
        groups.set(topic, []);
      }
      groups.get(topic)!.push(entry);
    }

    return groups;
  }

  /**
   * Get time range description
   */
  private getTimeRange(entries: MemoryEntry[]): string {
    if (entries.length === 0) return 'unknown period';

    const timestamps = entries.map((e) => e.timestamp);
    const start = new Date(Math.min(...timestamps));
    const end = new Date(Math.max(...timestamps));

    const diffMs = end.getTime() - start.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 1) {
      return 'the last hour';
    } else if (diffHours < 24) {
      return 'today';
    } else if (diffHours < 168) {
      return 'this week';
    } else {
      return `${start.toLocaleDateString()} to ${end.toLocaleDateString()}`;
    }
  }

  /**
   * Calculate compression ratio
   */
  private calculateCompressionRatio(
    entries: MemoryEntry[],
    summary: string,
  ): number {
    const originalLength = entries.reduce(
      (sum, e) => sum + e.content.length,
      0,
    );
    return originalLength > 0 ? originalLength / summary.length : 1;
  }

  /**
   * Deduplicate similar strings
   */
  private deduplicateStrings(strings: string[]): string[] {
    const result: string[] = [];

    for (const str of strings) {
      const isDuplicate = result.some(
        (existing) => this.stringSimilarity(str, existing) > 0.8,
      );
      if (!isDuplicate) {
        result.push(str);
      }
    }

    return result;
  }

  /**
   * Simple string similarity (Jaccard)
   */
  private stringSimilarity(a: string, b: string): number {
    const setA = new Set(a.toLowerCase().split(/\s+/));
    const setB = new Set(b.toLowerCase().split(/\s+/));

    const intersection = new Set([...setA].filter((x) => setB.has(x)));
    const union = new Set([...setA, ...setB]);

    return intersection.size / union.size;
  }

  /**
   * Update configuration
   */
  configure(config: Partial<SummarizerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Create summarizer instance
 */
export function createSummarizer(config?: SummarizerConfig): Summarizer {
  return new Summarizer(config);
}
