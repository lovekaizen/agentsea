/**
 * Aggregations
 *
 * Provides aggregation utilities for analytics data.
 */

import type {
  AggregationQuery,
  AggregationResult,
  AggregationBucket,
  AggregationFunction,
  TimeGranularity,
  TimeRange,
  TimePeriod,
  AnalyticsStorageAdapter,
} from '../types/index.js';

/**
 * Aggregation builder for fluent API
 */
export class AggregationBuilder {
  private readonly storage: AnalyticsStorageAdapter;
  private query: Partial<AggregationQuery> = {};

  constructor(storage: AnalyticsStorageAdapter) {
    this.storage = storage;
  }

  /**
   * Set metric to aggregate
   */
  metric(name: string): this {
    this.query.metric = name;
    return this;
  }

  /**
   * Set aggregation function
   */
  function(fn: AggregationFunction): this {
    this.query.function = fn;
    return this;
  }

  /**
   * Set time period
   */
  period(period: TimePeriod | TimeRange): this {
    if (typeof period === 'object' && 'start' in period) {
      this.query.period = period;
    } else {
      this.query.period = this.resolveTimeRange(period);
    }
    return this;
  }

  /**
   * Set time granularity
   */
  granularity(granularity: TimeGranularity): this {
    this.query.granularity = granularity;
    return this;
  }

  /**
   * Set group by fields
   */
  groupBy(fields: string | string[]): this {
    this.query.groupBy = Array.isArray(fields) ? fields : [fields];
    return this;
  }

  /**
   * Set filter
   */
  filter(filter: Record<string, unknown>): this {
    this.query.filter = filter;
    return this;
  }

  /**
   * Execute the aggregation
   */
  async execute(): Promise<AggregationResult> {
    if (!this.query.metric) {
      throw new Error('Metric is required for aggregation');
    }
    if (!this.query.function) {
      throw new Error('Aggregation function is required');
    }

    return this.storage.aggregate(this.query as AggregationQuery);
  }

  /**
   * Resolve time range from period
   */
  private resolveTimeRange(period: TimePeriod): TimeRange {
    const now = Date.now();
    const HOUR = 60 * 60 * 1000;
    const DAY = 24 * HOUR;
    const periods: Record<TimePeriod, number> = {
      hour: HOUR,
      day: DAY,
      week: 7 * DAY,
      month: 30 * DAY,
      quarter: 90 * DAY,
      year: 365 * DAY,
      'last-hour': HOUR,
      'last-24-hours': DAY,
      'last-7-days': 7 * DAY,
      'last-30-days': 30 * DAY,
      'last-90-days': 90 * DAY,
      'last-year': 365 * DAY,
      today: DAY,
      'this-week': 7 * DAY,
      'this-month': 30 * DAY,
      'this-quarter': 90 * DAY,
      'this-year': 365 * DAY,
      'all-time': Number.MAX_SAFE_INTEGER,
    };

    return {
      start: now - periods[period],
      end: now,
    };
  }
}

/**
 * Aggregations - Utility class for aggregations
 */
export class Aggregations {
  private readonly storage: AnalyticsStorageAdapter;

  constructor(storage: AnalyticsStorageAdapter) {
    this.storage = storage;
  }

  /**
   * Start building an aggregation
   */
  query(): AggregationBuilder {
    return new AggregationBuilder(this.storage);
  }

  /**
   * Count conversations
   */
  async count(period?: TimePeriod | TimeRange): Promise<number> {
    const result = await this.query()
      .metric('conversations')
      .function('count')
      .period(period ?? 'week')
      .execute();
    return result.value;
  }

  /**
   * Sum a metric
   */
  async sum(metric: string, period?: TimePeriod | TimeRange): Promise<number> {
    const result = await this.query()
      .metric(metric)
      .function('sum')
      .period(period ?? 'week')
      .execute();
    return result.value;
  }

  /**
   * Average a metric
   */
  async avg(metric: string, period?: TimePeriod | TimeRange): Promise<number> {
    const result = await this.query()
      .metric(metric)
      .function('avg')
      .period(period ?? 'week')
      .execute();
    return result.value;
  }

  /**
   * Min of a metric
   */
  async min(metric: string, period?: TimePeriod | TimeRange): Promise<number> {
    const result = await this.query()
      .metric(metric)
      .function('min')
      .period(period ?? 'week')
      .execute();
    return result.value;
  }

  /**
   * Max of a metric
   */
  async max(metric: string, period?: TimePeriod | TimeRange): Promise<number> {
    const result = await this.query()
      .metric(metric)
      .function('max')
      .period(period ?? 'week')
      .execute();
    return result.value;
  }

  /**
   * Distinct count of a metric
   */
  async distinct(
    metric: string,
    period?: TimePeriod | TimeRange,
  ): Promise<number> {
    const result = await this.query()
      .metric(metric)
      .function('distinct')
      .period(period ?? 'week')
      .execute();
    return result.value;
  }

  /**
   * Time series aggregation
   */
  async timeSeries(
    metric: string,
    granularity: TimeGranularity,
    period?: TimePeriod | TimeRange,
  ): Promise<AggregationBucket[]> {
    const result = await this.query()
      .metric(metric)
      .function('count')
      .granularity(granularity)
      .period(period ?? 'month')
      .execute();
    return result.buckets ?? [];
  }

  /**
   * Group by aggregation
   */
  async groupBy(
    metric: string,
    groupFields: string | string[],
    fn: AggregationFunction = 'count',
    period?: TimePeriod | TimeRange,
  ): Promise<Map<string, number>> {
    const result = await this.query()
      .metric(metric)
      .function(fn)
      .groupBy(groupFields)
      .period(period ?? 'week')
      .execute();

    const groups = new Map<string, number>();
    if (result.buckets) {
      for (const bucket of result.buckets) {
        groups.set(String(bucket.key), bucket.value);
      }
    }
    return groups;
  }

  /**
   * Percentile calculation
   */
  async percentile(
    metric: string,
    p: number,
    period?: TimePeriod | TimeRange,
  ): Promise<number> {
    // Get all values
    const timeRange = period
      ? typeof period === 'object' && 'start' in period
        ? period
        : this.resolveTimeRange(period)
      : this.resolveTimeRange('week');

    const result = await this.storage.queryConversations({ timeRange });
    const conversations = result.conversations;

    // Extract values based on metric
    const values = this.extractMetricValues(conversations, metric);

    if (values.length === 0) return 0;

    // Sort and find percentile
    values.sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * values.length) - 1;
    return values[Math.max(0, index)];
  }

  /**
   * Extract metric values from conversations
   */
  private extractMetricValues(
    conversations: Array<{
      startedAt: number;
      endedAt?: number;
      messages: Array<{ tokenUsage?: { total: number } }>;
      outcome?: { satisfaction?: number };
    }>,
    metric: string,
  ): number[] {
    const values: number[] = [];

    for (const conv of conversations) {
      switch (metric) {
        case 'duration':
          if (conv.endedAt) {
            values.push(conv.endedAt - conv.startedAt);
          }
          break;
        case 'messages':
          values.push(conv.messages.length);
          break;
        case 'tokens': {
          let total = 0;
          for (const msg of conv.messages) {
            total += msg.tokenUsage?.total ?? 0;
          }
          values.push(total);
          break;
        }
        case 'satisfaction':
          if (conv.outcome?.satisfaction !== undefined) {
            values.push(conv.outcome.satisfaction);
          }
          break;
      }
    }

    return values;
  }

  /**
   * Moving average calculation
   */
  async movingAverage(
    metric: string,
    windowSize: number,
    granularity: TimeGranularity,
    period?: TimePeriod | TimeRange,
  ): Promise<Array<{ timestamp: number; value: number; movingAvg: number }>> {
    const buckets = await this.timeSeries(metric, granularity, period);

    const result: Array<{
      timestamp: number;
      value: number;
      movingAvg: number;
    }> = [];

    for (let i = 0; i < buckets.length; i++) {
      const bucket = buckets[i];
      const windowStart = Math.max(0, i - windowSize + 1);
      const window = buckets.slice(windowStart, i + 1);
      const movingAvg =
        window.reduce((sum, b) => sum + b.value, 0) / window.length;

      result.push({
        timestamp: new Date(bucket.key).getTime(),
        value: bucket.value,
        movingAvg,
      });
    }

    return result;
  }

  /**
   * Comparison aggregation (period over period)
   */
  async compare(
    metric: string,
    currentPeriod: TimePeriod | TimeRange,
    previousPeriod: TimePeriod | TimeRange,
    fn: AggregationFunction = 'sum',
  ): Promise<{
    current: number;
    previous: number;
    change: number;
    changePercent: number;
  }> {
    const current = await this.query()
      .metric(metric)
      .function(fn)
      .period(currentPeriod)
      .execute();

    const previous = await this.query()
      .metric(metric)
      .function(fn)
      .period(previousPeriod)
      .execute();

    const change = current.value - previous.value;
    const changePercent =
      previous.value !== 0 ? (change / previous.value) * 100 : 0;

    return {
      current: current.value,
      previous: previous.value,
      change,
      changePercent,
    };
  }

  /**
   * Top N aggregation
   */
  async topN(
    metric: string,
    groupField: string,
    n: number,
    fn: AggregationFunction = 'count',
    period?: TimePeriod | TimeRange,
  ): Promise<Array<{ key: string; value: number }>> {
    const groups = await this.groupBy(metric, groupField, fn, period);

    return Array.from(groups.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([key, value]) => ({ key, value }));
  }

  /**
   * Resolve time range from period
   */
  private resolveTimeRange(period: TimePeriod): TimeRange {
    const now = Date.now();
    const HOUR = 60 * 60 * 1000;
    const DAY = 24 * HOUR;
    const periods: Record<TimePeriod, number> = {
      hour: HOUR,
      day: DAY,
      week: 7 * DAY,
      month: 30 * DAY,
      quarter: 90 * DAY,
      year: 365 * DAY,
      'last-hour': HOUR,
      'last-24-hours': DAY,
      'last-7-days': 7 * DAY,
      'last-30-days': 30 * DAY,
      'last-90-days': 90 * DAY,
      'last-year': 365 * DAY,
      today: DAY,
      'this-week': 7 * DAY,
      'this-month': 30 * DAY,
      'this-quarter': 90 * DAY,
      'this-year': 365 * DAY,
      'all-time': Number.MAX_SAFE_INTEGER,
    };

    return {
      start: now - periods[period],
      end: now,
    };
  }
}
