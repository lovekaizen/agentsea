/**
 * FeedbackAggregator
 *
 * Aggregate and analyze feedback data.
 */

import type {
  FeedbackEntry,
  FeedbackStoreInterface,
  AggregationOptions,
  AggregationResult,
  AggregationMetric,
} from '../types/index.js';

/**
 * Feedback aggregator
 */
export class FeedbackAggregator {
  constructor(private store: FeedbackStoreInterface) {}

  /**
   * Aggregate feedback data
   */
  async aggregate(options: AggregationOptions): Promise<AggregationResult[]> {
    // Query all relevant feedback
    const { entries } = await this.store.query({
      startTime: options.timeRange?.start,
      endTime: options.timeRange?.end,
      ...options.filters,
      limit: 100000, // Large limit for aggregation
    });

    if (entries.length === 0) {
      return [];
    }

    // Group entries
    const groups = this.groupEntries(entries, options.groupBy);

    // Calculate metrics for each group
    const results: AggregationResult[] = [];
    for (const [groupKey, groupEntries] of groups) {
      const metrics = this.calculateMetrics(groupEntries, options.metrics);
      results.push({
        groupKey,
        metrics,
        count: groupEntries.length,
      });
    }

    return results;
  }

  /**
   * Get summary statistics
   */
  async getSummary(options?: {
    startTime?: number;
    endTime?: number;
  }): Promise<{
    totalCount: number;
    byType: Record<string, number>;
    thumbsUpRate: number;
    avgRating: number;
    preferenceDistribution: { A: number; B: number; tie: number };
    correctionRate: number;
  }> {
    const { entries } = await this.store.query({
      startTime: options?.startTime,
      endTime: options?.endTime,
      limit: 100000,
    });

    const byType: Record<string, number> = {};
    let thumbsUp = 0;
    let thumbsTotal = 0;
    let ratingSum = 0;
    let ratingCount = 0;
    const prefDist = { A: 0, B: 0, tie: 0 };
    let corrections = 0;

    for (const entry of entries) {
      byType[entry.type] = (byType[entry.type] ?? 0) + 1;

      switch (entry.type) {
        case 'thumbs': {
          const thumbs = entry;
          thumbsTotal++;
          if (thumbs.rating === 'up') thumbsUp++;
          break;
        }
        case 'rating': {
          const rating = entry;
          ratingSum += rating.rating;
          ratingCount++;
          break;
        }
        case 'preference': {
          const pref = entry;
          prefDist[pref.preference]++;
          break;
        }
        case 'correction':
          corrections++;
          break;
      }
    }

    return {
      totalCount: entries.length,
      byType,
      thumbsUpRate: thumbsTotal > 0 ? thumbsUp / thumbsTotal : 0,
      avgRating: ratingCount > 0 ? ratingSum / ratingCount : 0,
      preferenceDistribution: prefDist,
      correctionRate: entries.length > 0 ? corrections / entries.length : 0,
    };
  }

  /**
   * Get trending metrics over time
   */
  async getTrends(options: {
    metric: AggregationMetric;
    interval: 'hour' | 'day' | 'week';
    startTime: number;
    endTime: number;
  }): Promise<Array<{ timestamp: number; value: number; count: number }>> {
    const { entries } = await this.store.query({
      startTime: options.startTime,
      endTime: options.endTime,
      limit: 100000,
    });

    // Group by time interval
    const intervalMs = this.getIntervalMs(options.interval);
    const buckets = new Map<number, FeedbackEntry[]>();

    for (const entry of entries) {
      const bucket = Math.floor(entry.timestamp / intervalMs) * intervalMs;
      if (!buckets.has(bucket)) {
        buckets.set(bucket, []);
      }
      buckets.get(bucket)!.push(entry);
    }

    // Calculate metric for each bucket
    const trends: Array<{ timestamp: number; value: number; count: number }> =
      [];
    const sortedBuckets = Array.from(buckets.entries()).sort(
      (a, b) => a[0] - b[0],
    );

    for (const [timestamp, bucketEntries] of sortedBuckets) {
      const metrics = this.calculateMetrics(bucketEntries, [options.metric]);
      trends.push({
        timestamp,
        value: metrics[options.metric] ?? 0,
        count: bucketEntries.length,
      });
    }

    return trends;
  }

  /**
   * Group entries by field
   */
  private groupEntries(
    entries: FeedbackEntry[],
    groupBy?: string,
  ): Map<string, FeedbackEntry[]> {
    const groups = new Map<string, FeedbackEntry[]>();

    if (!groupBy) {
      groups.set('all', entries);
      return groups;
    }

    for (const entry of entries) {
      let key: string;

      switch (groupBy) {
        case 'model':
          key = (entry.metadata?.model as string) ?? 'unknown';
          break;
        case 'userId':
          key = entry.userId ?? 'anonymous';
          break;
        case 'hour':
          key = new Date(entry.timestamp).toISOString().slice(0, 13);
          break;
        case 'day':
          key = new Date(entry.timestamp).toISOString().slice(0, 10);
          break;
        case 'week':
          key = this.getWeekKey(entry.timestamp);
          break;
        case 'month':
          key = new Date(entry.timestamp).toISOString().slice(0, 7);
          break;
        default:
          key = 'all';
      }

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(entry);
    }

    return groups;
  }

  /**
   * Calculate metrics for a group of entries
   */
  private calculateMetrics(
    entries: FeedbackEntry[],
    metrics: AggregationMetric[],
  ): Record<AggregationMetric, number> {
    const result: Record<AggregationMetric, number> = {} as Record<
      AggregationMetric,
      number
    >;

    for (const metric of metrics) {
      result[metric] = this.calculateSingleMetric(entries, metric);
    }

    return result;
  }

  /**
   * Calculate a single metric
   */
  private calculateSingleMetric(
    entries: FeedbackEntry[],
    metric: AggregationMetric,
  ): number {
    switch (metric) {
      case 'count':
        return entries.length;

      case 'thumbsUpRate': {
        const thumbs = entries.filter((e) => e.type === 'thumbs');
        if (thumbs.length === 0) return 0;
        const ups = thumbs.filter((t) => t.rating === 'up').length;
        return ups / thumbs.length;
      }

      case 'avgRating': {
        const ratings = entries.filter((e) => e.type === 'rating');
        if (ratings.length === 0) return 0;
        const sum = ratings.reduce((s, r) => s + r.rating, 0);
        return sum / ratings.length;
      }

      case 'correctionRate': {
        if (entries.length === 0) return 0;
        const corrections = entries.filter(
          (e) => e.type === 'correction',
        ).length;
        return corrections / entries.length;
      }

      case 'preferenceWinRate': {
        const prefs = entries.filter((e) => e.type === 'preference');
        if (prefs.length === 0) return 0;
        const wins = prefs.filter((p) => p.preference === 'A').length;
        return wins / prefs.length;
      }

      case 'avgCriteriaRating': {
        const multi = entries.filter((e) => e.type === 'multi_criteria');
        if (multi.length === 0) return 0;
        let totalRatings = 0;
        let totalCount = 0;
        for (const m of multi) {
          for (const c of m.criteria) {
            totalRatings += c.rating;
            totalCount++;
          }
        }
        return totalCount > 0 ? totalRatings / totalCount : 0;
      }

      default:
        return 0;
    }
  }

  /**
   * Get week key from timestamp
   */
  private getWeekKey(timestamp: number): string {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const week = this.getWeekNumber(date);
    return `${year}-W${week.toString().padStart(2, '0')}`;
  }

  /**
   * Get week number
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
    );
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }

  /**
   * Get interval in milliseconds
   */
  private getIntervalMs(interval: 'hour' | 'day' | 'week'): number {
    switch (interval) {
      case 'hour':
        return 3600000;
      case 'day':
        return 86400000;
      case 'week':
        return 604800000;
    }
  }
}

/**
 * Create a feedback aggregator
 */
export function createFeedbackAggregator(
  store: FeedbackStoreInterface,
): FeedbackAggregator {
  return new FeedbackAggregator(store);
}
