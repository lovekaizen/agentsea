/**
 * Metrics Engine
 *
 * Central engine for calculating and managing metrics.
 */

import { EventEmitter } from 'eventemitter3';
import type {
  MetricDefinition,
  MetricValue,
  MetricsQueryOptions,
  MetricsResult,
  MetricComparison,
  TimeRange,
  TimePeriod,
  TimeGranularity,
  MetricDataPoint,
  AnalyticsStorageAdapter,
} from '../types/index.js';

/**
 * Metrics engine events
 */
export interface MetricsEngineEvents {
  'metric:calculated': (metric: MetricValue) => void;
  'metric:registered': (definition: MetricDefinition) => void;
  error: (error: Error) => void;
}

/**
 * Built-in metric names
 */
export type BuiltInMetric =
  | 'conversations_total'
  | 'conversations_successful'
  | 'conversations_abandoned'
  | 'conversations_escalated'
  | 'success_rate'
  | 'avg_duration'
  | 'avg_messages'
  | 'avg_response_time'
  | 'avg_satisfaction'
  | 'total_tokens'
  | 'avg_tokens_per_conversation'
  | 'tool_usage_count';

/**
 * MetricsEngine - Central metrics calculation engine
 */
export class MetricsEngine extends EventEmitter<MetricsEngineEvents> {
  private readonly storage: AnalyticsStorageAdapter;
  private readonly metrics = new Map<string, MetricDefinition>();
  private readonly cache = new Map<
    string,
    { value: MetricValue; expires: number }
  >();
  private readonly cacheTTL: number;

  constructor(
    storage: AnalyticsStorageAdapter,
    options: { cacheTTL?: number } = {},
  ) {
    super();
    this.storage = storage;
    this.cacheTTL = options.cacheTTL ?? 60000; // Default 1 minute cache

    // Register built-in metrics
    this.registerBuiltInMetrics();
  }

  /**
   * Register built-in metrics
   */
  private registerBuiltInMetrics(): void {
    this.registerMetric({
      name: 'conversations_total',
      displayName: 'Total Conversations',
      description: 'Total number of conversations',
      calculation: 'count(conversations)',
      format: 'count',
      aggregation: 'sum',
    });

    this.registerMetric({
      name: 'conversations_successful',
      displayName: 'Successful Conversations',
      description: 'Number of successful conversations',
      calculation: 'count(conversations where outcome.success = true)',
      format: 'count',
      aggregation: 'sum',
    });

    this.registerMetric({
      name: 'success_rate',
      displayName: 'Success Rate',
      description: 'Percentage of successful conversations',
      calculation: 'conversations_successful / conversations_total',
      format: 'percentage',
      aggregation: 'avg',
    });

    this.registerMetric({
      name: 'avg_duration',
      displayName: 'Average Duration',
      description: 'Average conversation duration in milliseconds',
      calculation: 'avg(endedAt - startedAt)',
      unit: 'ms',
      format: 'duration',
      aggregation: 'avg',
    });

    this.registerMetric({
      name: 'avg_messages',
      displayName: 'Average Messages',
      description: 'Average messages per conversation',
      calculation: 'avg(messages.length)',
      format: 'number',
      aggregation: 'avg',
    });

    this.registerMetric({
      name: 'avg_satisfaction',
      displayName: 'Average Satisfaction',
      description: 'Average user satisfaction rating',
      calculation: 'avg(outcome.satisfaction)',
      format: 'number',
      aggregation: 'avg',
    });
  }

  /**
   * Register a metric definition
   */
  registerMetric(definition: MetricDefinition): void {
    this.metrics.set(definition.name, definition);
    this.emit('metric:registered', definition);
  }

  /**
   * Get metric definition
   */
  getMetricDefinition(name: string): MetricDefinition | undefined {
    return this.metrics.get(name);
  }

  /**
   * List all registered metrics
   */
  listMetrics(): MetricDefinition[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Calculate a single metric
   */
  async calculate(
    metricName: string,
    period?: TimePeriod | TimeRange,
  ): Promise<MetricValue> {
    const timeRange = period
      ? this.resolveTimeRange(period)
      : this.getDefaultTimeRange();
    const cacheKey = `${metricName}:${timeRange.start}:${timeRange.end}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.value;
    }

    const definition = this.metrics.get(metricName);
    if (!definition) {
      throw new Error(`Metric not found: ${metricName}`);
    }

    // Calculate the metric
    const value = await this.calculateMetric(metricName, timeRange);
    const formatted = this.formatValue(value, definition.format);

    const result: MetricValue = {
      name: metricName,
      value,
      formatted,
      timestamp: Date.now(),
    };

    // Cache result
    this.cache.set(cacheKey, {
      value: result,
      expires: Date.now() + this.cacheTTL,
    });
    this.emit('metric:calculated', result);

    return result;
  }

  /**
   * Calculate multiple metrics
   */
  async query(options: MetricsQueryOptions): Promise<MetricsResult> {
    const period = options.period
      ? this.resolveTimeRange(options.period)
      : this.getDefaultTimeRange();

    const metrics = new Map<string, MetricValue>();

    // Calculate each requested metric
    for (const metricName of options.metrics) {
      try {
        const value = await this.calculate(metricName, period);

        // Add comparison if requested
        if (options.includeComparison) {
          value.comparison = await this.calculateComparison(
            metricName,
            period,
            options.comparisonPeriod,
          );
        }

        metrics.set(metricName, value);
      } catch (error) {
        console.error(`Error calculating metric ${metricName}:`, error);
      }
    }

    // Build time series if granularity specified
    let timeSeries: Map<string, MetricDataPoint[]> | undefined;
    if (options.granularity) {
      timeSeries = await this.buildTimeSeries(
        options.metrics,
        period,
        options.granularity,
      );
    }

    // Build grouped results if groupBy specified
    let grouped: Map<string, Map<string, MetricValue>> | undefined;
    if (options.groupBy) {
      grouped = await this.buildGroupedResults(
        options.metrics,
        period,
        options.groupBy,
      );
    }

    return {
      metrics,
      timeSeries,
      grouped,
      period,
    };
  }

  /**
   * Calculate a metric value
   */
  private async calculateMetric(
    name: string,
    period: TimeRange,
  ): Promise<number> {
    const result = await this.storage.queryConversations({ timeRange: period });
    const conversations = result.conversations;

    switch (name) {
      case 'conversations_total':
        return conversations.length;

      case 'conversations_successful':
        return conversations.filter((c) => c.outcome?.success).length;

      case 'conversations_abandoned':
        return conversations.filter((c) => c.status === 'abandoned').length;

      case 'conversations_escalated':
        return conversations.filter((c) => c.status === 'escalated').length;

      case 'success_rate': {
        if (conversations.length === 0) return 0;
        const successful = conversations.filter(
          (c) => c.outcome?.success,
        ).length;
        return successful / conversations.length;
      }

      case 'avg_duration': {
        const completed = conversations.filter((c) => c.endedAt);
        if (completed.length === 0) return 0;
        const durations = completed.map((c) => c.endedAt! - c.startedAt);
        return durations.reduce((a, b) => a + b, 0) / completed.length;
      }

      case 'avg_messages': {
        if (conversations.length === 0) return 0;
        const totalMessages = conversations.reduce(
          (sum, c) => sum + c.messages.length,
          0,
        );
        return totalMessages / conversations.length;
      }

      case 'avg_satisfaction': {
        const withSatisfaction = conversations.filter(
          (c) => c.outcome?.satisfaction !== undefined,
        );
        if (withSatisfaction.length === 0) return 0;
        const total = withSatisfaction.reduce(
          (sum, c) => sum + (c.outcome?.satisfaction ?? 0),
          0,
        );
        return total / withSatisfaction.length;
      }

      case 'total_tokens': {
        let total = 0;
        for (const conv of conversations) {
          for (const msg of conv.messages) {
            if (msg.tokenUsage) {
              total += msg.tokenUsage.total;
            }
          }
        }
        return total;
      }

      case 'avg_tokens_per_conversation': {
        if (conversations.length === 0) return 0;
        let total = 0;
        for (const conv of conversations) {
          for (const msg of conv.messages) {
            if (msg.tokenUsage) {
              total += msg.tokenUsage.total;
            }
          }
        }
        return total / conversations.length;
      }

      case 'tool_usage_count': {
        let total = 0;
        for (const conv of conversations) {
          for (const msg of conv.messages) {
            total += msg.toolCalls?.length ?? 0;
          }
        }
        return total;
      }

      default:
        // Try aggregation query
        try {
          const aggResult = await this.storage.aggregate({
            metric: name,
            function: 'sum',
            period,
          });
          return aggResult.value;
        } catch {
          return 0;
        }
    }
  }

  /**
   * Calculate comparison to previous period
   */
  private async calculateComparison(
    metricName: string,
    currentPeriod: TimeRange,
    comparisonPeriod?: TimePeriod | TimeRange,
  ): Promise<MetricComparison> {
    const duration = currentPeriod.end - currentPeriod.start;
    const previousPeriod: TimeRange = comparisonPeriod
      ? this.resolveTimeRange(comparisonPeriod)
      : {
          start: currentPeriod.start - duration,
          end: currentPeriod.start,
        };

    const currentValue = await this.calculateMetric(metricName, currentPeriod);
    const previousValue = await this.calculateMetric(
      metricName,
      previousPeriod,
    );

    const change = currentValue - previousValue;
    const changePercent =
      previousValue !== 0
        ? (change / previousValue) * 100
        : currentValue > 0
          ? 100
          : 0;

    return {
      previousValue,
      change,
      changePercent,
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'unchanged',
      isImprovement: this.isImprovement(metricName, change),
    };
  }

  /**
   * Determine if a change is an improvement
   */
  private isImprovement(metricName: string, change: number): boolean {
    // Metrics where increase is good
    const positiveMetrics = [
      'success_rate',
      'conversations_successful',
      'avg_satisfaction',
    ];

    // Metrics where decrease is good
    const negativeMetrics = [
      'conversations_abandoned',
      'conversations_escalated',
      'avg_duration', // Usually shorter is better
    ];

    if (positiveMetrics.includes(metricName)) {
      return change > 0;
    }
    if (negativeMetrics.includes(metricName)) {
      return change < 0;
    }
    return change >= 0;
  }

  /**
   * Build time series for metrics
   */
  private async buildTimeSeries(
    metricNames: string[],
    period: TimeRange,
    granularity: TimeGranularity,
  ): Promise<Map<string, MetricDataPoint[]>> {
    const result = new Map<string, MetricDataPoint[]>();
    const granularityMs = this.getGranularityMs(granularity);

    for (const metricName of metricNames) {
      const dataPoints: MetricDataPoint[] = [];
      let currentStart = period.start;

      while (currentStart < period.end) {
        const currentEnd = Math.min(currentStart + granularityMs, period.end);
        const value = await this.calculateMetric(metricName, {
          start: currentStart,
          end: currentEnd,
        });

        dataPoints.push({
          timestamp: currentStart,
          value,
        });

        currentStart = currentEnd;
      }

      result.set(metricName, dataPoints);
    }

    return result;
  }

  /**
   * Build grouped results
   */
  private async buildGroupedResults(
    metricNames: string[],
    period: TimeRange,
    groupBy: string | string[],
  ): Promise<Map<string, Map<string, MetricValue>>> {
    const fields = Array.isArray(groupBy) ? groupBy : [groupBy];
    const result = new Map<string, Map<string, MetricValue>>();

    // Get all conversations
    const queryResult = await this.storage.queryConversations({
      timeRange: period,
    });
    const conversations = queryResult.conversations;

    // Group conversations
    const groups = new Map<string, typeof conversations>();
    for (const conv of conversations) {
      const key = fields
        .map((f) => {
          switch (f) {
            case 'intent':
              return conv.intent?.primary ?? 'unknown';
            case 'topic':
              return conv.topics?.[0] ?? 'unknown';
            default:
              return String(conv.metadata?.[f] ?? 'unknown');
          }
        })
        .join(':');

      const existing = groups.get(key) ?? [];
      existing.push(conv);
      groups.set(key, existing);
    }

    // Calculate metrics for each group
    for (const [groupKey, groupConvs] of groups) {
      const groupMetrics = new Map<string, MetricValue>();

      for (const metricName of metricNames) {
        // Create a mock storage with just this group's conversations
        // For simplicity, calculate directly here
        const value = this.calculateMetricForConversations(
          metricName,
          groupConvs,
        );

        const definition = this.metrics.get(metricName);
        groupMetrics.set(metricName, {
          name: metricName,
          value,
          formatted: definition
            ? this.formatValue(value, definition.format)
            : String(value),
          timestamp: Date.now(),
        });
      }

      result.set(groupKey, groupMetrics);
    }

    return result;
  }

  /**
   * Calculate metric for a set of conversations
   */
  private calculateMetricForConversations(
    name: string,
    conversations: Array<{
      outcome?: { success?: boolean; satisfaction?: number };
      status?: string;
      startedAt: number;
      endedAt?: number;
      messages: Array<{
        tokenUsage?: { total: number };
        toolCalls?: unknown[];
      }>;
    }>,
  ): number {
    switch (name) {
      case 'conversations_total':
        return conversations.length;
      case 'success_rate':
        if (conversations.length === 0) return 0;
        return (
          conversations.filter((c) => c.outcome?.success).length /
          conversations.length
        );
      case 'avg_messages':
        if (conversations.length === 0) return 0;
        return (
          conversations.reduce((s, c) => s + c.messages.length, 0) /
          conversations.length
        );
      default:
        return 0;
    }
  }

  /**
   * Format a metric value
   */
  private formatValue(value: number, format?: string): string {
    switch (format) {
      case 'percentage':
        return `${(value * 100).toFixed(1)}%`;
      case 'duration':
        if (value < 1000) return `${Math.round(value)}ms`;
        if (value < 60000) return `${(value / 1000).toFixed(1)}s`;
        return `${(value / 60000).toFixed(1)}m`;
      case 'count':
        return Math.round(value).toLocaleString();
      case 'currency':
        return `$${value.toFixed(2)}`;
      default:
        return value.toFixed(2);
    }
  }

  /**
   * Resolve time range from period
   */
  private resolveTimeRange(period: TimePeriod | TimeRange): TimeRange {
    if (typeof period === 'object' && 'start' in period) {
      return period;
    }

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

  /**
   * Get default time range (last 7 days)
   */
  private getDefaultTimeRange(): TimeRange {
    return this.resolveTimeRange('week');
  }

  /**
   * Get granularity in milliseconds
   */
  private getGranularityMs(granularity: TimeGranularity): number {
    switch (granularity) {
      case 'minute':
        return 60 * 1000;
      case 'hour':
        return 60 * 60 * 1000;
      case 'day':
        return 24 * 60 * 60 * 1000;
      case 'week':
        return 7 * 24 * 60 * 60 * 1000;
      case 'month':
        return 30 * 24 * 60 * 60 * 1000;
      default:
        return 24 * 60 * 60 * 1000;
    }
  }

  /**
   * Clear metric cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}
