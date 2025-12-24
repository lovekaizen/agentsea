/**
 * DashboardData
 *
 * Provides real-time and historical data for dashboards.
 */

import { EventEmitter } from 'eventemitter3';
import type {
  AnalyticsStorageAdapter,
  Conversation,
  TimeRange,
  TimePeriod,
  TimeGranularity,
} from '../types/index.js';

/**
 * Dashboard data events
 */
export interface DashboardDataEvents {
  updated: (data: DashboardSnapshot) => void;
  error: (error: Error) => void;
}

/**
 * KPI data point
 */
export interface KPIDataPoint {
  name: string;
  value: number;
  previousValue?: number;
  change?: number;
  changePercent?: number;
  trend: 'up' | 'down' | 'stable';
  unit?: string;
}

/**
 * Time series data point
 */
export interface TimeSeriesPoint {
  timestamp: number;
  value: number;
  label?: string;
}

/**
 * Chart data
 */
export interface ChartData {
  title: string;
  type: 'line' | 'bar' | 'pie' | 'area';
  data: TimeSeriesPoint[] | Array<{ label: string; value: number }>;
  labels?: string[];
}

/**
 * Dashboard snapshot
 */
export interface DashboardSnapshot {
  timestamp: number;
  period: TimePeriod | TimeRange;
  kpis: KPIDataPoint[];
  charts: ChartData[];
  recentConversations: Array<{
    id: string;
    status: string;
    duration?: number;
    messageCount: number;
    startedAt: number;
  }>;
  alerts: Array<{
    type: 'warning' | 'critical' | 'info';
    message: string;
    timestamp: number;
  }>;
}

/**
 * Dashboard options
 */
export interface DashboardOptions {
  period?: TimePeriod | TimeRange;
  granularity?: TimeGranularity;
  includeCharts?: boolean;
  includeRecentConversations?: boolean;
  recentConversationsLimit?: number;
}

/**
 * DashboardData - Provides dashboard data
 */
export class DashboardData extends EventEmitter<DashboardDataEvents> {
  private readonly storage: AnalyticsStorageAdapter;
  private refreshInterval?: ReturnType<typeof setInterval>;

  constructor(storage: AnalyticsStorageAdapter) {
    super();
    this.storage = storage;
  }

  /**
   * Get dashboard snapshot
   */
  async getSnapshot(
    options: DashboardOptions = {},
  ): Promise<DashboardSnapshot> {
    const period = options.period ?? 'week';
    const timeRange = this.resolveTimeRange(period);
    const granularity = options.granularity ?? 'day';

    // Get conversations
    const result = await this.storage.queryConversations({ timeRange });
    const conversations = result.conversations;

    // Calculate KPIs
    const kpis = await this.calculateKPIs(conversations, timeRange);

    // Generate charts
    const charts: ChartData[] =
      options.includeCharts !== false
        ? this.generateCharts(conversations, granularity, timeRange)
        : [];

    // Get recent conversations
    const recentConversations =
      options.includeRecentConversations !== false
        ? this.getRecentConversations(
            conversations,
            options.recentConversationsLimit ?? 10,
          )
        : [];

    // Generate alerts
    const alerts = this.generateAlerts(kpis, conversations);

    return {
      timestamp: Date.now(),
      period,
      kpis,
      charts,
      recentConversations,
      alerts,
    };
  }

  /**
   * Calculate KPIs
   */
  private async calculateKPIs(
    conversations: Conversation[],
    timeRange: TimeRange,
  ): Promise<KPIDataPoint[]> {
    const total = conversations.length;
    const completed = conversations.filter((c) => c.outcome?.success).length;
    const abandoned = conversations.filter(
      (c) => c.status === 'abandoned',
    ).length;
    const escalated = conversations.filter(
      (c) => c.status === 'escalated',
    ).length;
    const active = conversations.filter((c) => !c.endedAt).length;

    // Calculate averages
    let totalDuration = 0;
    let totalMessages = 0;
    let totalTokens = 0;
    let satisfactionSum = 0;
    let satisfactionCount = 0;
    let latencySum = 0;
    let latencyCount = 0;

    for (const conv of conversations) {
      if (conv.endedAt) {
        totalDuration += conv.endedAt - conv.startedAt;
      }
      totalMessages += conv.messages.length;

      for (const msg of conv.messages) {
        if (msg.tokenUsage) {
          totalTokens += msg.tokenUsage.total;
        }
        if (msg.latencyMs) {
          latencySum += msg.latencyMs;
          latencyCount++;
        }
      }

      if (conv.outcome?.satisfaction !== undefined) {
        satisfactionSum += conv.outcome.satisfaction;
        satisfactionCount++;
      }
    }

    // Get previous period for comparison
    const previousRange = this.getPreviousPeriod(timeRange);
    const previousResult = await this.storage.queryConversations({
      timeRange: previousRange,
    });
    const previousTotal = previousResult.conversations.length;
    const previousCompleted = previousResult.conversations.filter(
      (c) => c.outcome?.success,
    ).length;

    // Create KPIs
    const kpis: KPIDataPoint[] = [
      {
        name: 'Total Conversations',
        value: total,
        previousValue: previousTotal,
        change: total - previousTotal,
        changePercent:
          previousTotal > 0
            ? ((total - previousTotal) / previousTotal) * 100
            : 0,
        trend:
          total > previousTotal
            ? 'up'
            : total < previousTotal
              ? 'down'
              : 'stable',
      },
      {
        name: 'Success Rate',
        value: total > 0 ? (completed / total) * 100 : 0,
        previousValue:
          previousTotal > 0 ? (previousCompleted / previousTotal) * 100 : 0,
        trend:
          completed / (total || 1) > previousCompleted / (previousTotal || 1)
            ? 'up'
            : 'stable',
        unit: '%',
      },
      {
        name: 'Active Conversations',
        value: active,
        trend: 'stable',
      },
      {
        name: 'Abandoned',
        value: abandoned,
        trend: abandoned > 0 ? 'down' : 'stable',
      },
      {
        name: 'Escalated',
        value: escalated,
        trend: escalated > 0 ? 'down' : 'stable',
      },
      {
        name: 'Avg Duration',
        value: total > 0 ? totalDuration / total / 1000 : 0,
        trend: 'stable',
        unit: 's',
      },
      {
        name: 'Avg Messages',
        value: total > 0 ? totalMessages / total : 0,
        trend: 'stable',
      },
      {
        name: 'Total Tokens',
        value: totalTokens,
        trend: 'stable',
      },
      {
        name: 'Avg Latency',
        value: latencyCount > 0 ? latencySum / latencyCount : 0,
        trend: 'stable',
        unit: 'ms',
      },
      {
        name: 'Avg Satisfaction',
        value: satisfactionCount > 0 ? satisfactionSum / satisfactionCount : 0,
        trend: 'stable',
        unit: '/5',
      },
    ];

    return kpis;
  }

  /**
   * Generate charts
   */
  private generateCharts(
    conversations: Conversation[],
    granularity: TimeGranularity,
    timeRange: TimeRange,
  ): ChartData[] {
    const charts: ChartData[] = [];

    // Conversations over time
    const convOverTime = this.aggregateByTime(
      conversations,
      granularity,
      timeRange,
    );
    charts.push({
      title: 'Conversations Over Time',
      type: 'line',
      data: convOverTime,
    });

    // Status distribution
    const statusDist = this.getStatusDistribution(conversations);
    charts.push({
      title: 'Conversation Status',
      type: 'pie',
      data: statusDist,
    });

    // Messages per conversation distribution
    const msgDist = this.getMessageDistribution(conversations);
    charts.push({
      title: 'Messages per Conversation',
      type: 'bar',
      data: msgDist,
    });

    return charts;
  }

  /**
   * Aggregate conversations by time
   */
  private aggregateByTime(
    conversations: Conversation[],
    granularity: TimeGranularity,
    timeRange: TimeRange,
  ): TimeSeriesPoint[] {
    const buckets = new Map<number, number>();
    const interval = this.getGranularityInterval(granularity);

    // Initialize buckets
    let time = Math.floor(timeRange.start / interval) * interval;
    while (time <= timeRange.end) {
      buckets.set(time, 0);
      time += interval;
    }

    // Count conversations
    for (const conv of conversations) {
      const bucket = Math.floor(conv.startedAt / interval) * interval;
      buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
    }

    return Array.from(buckets.entries())
      .sort(([a], [b]) => a - b)
      .map(([timestamp, value]) => ({ timestamp, value }));
  }

  /**
   * Get status distribution
   */
  private getStatusDistribution(
    conversations: Conversation[],
  ): Array<{ label: string; value: number }> {
    const dist: Record<string, number> = {
      completed: 0,
      active: 0,
      abandoned: 0,
      escalated: 0,
    };

    for (const conv of conversations) {
      if (!conv.endedAt) {
        dist.active++;
      } else if (conv.outcome?.success) {
        dist.completed++;
      } else if (conv.status === 'abandoned') {
        dist.abandoned++;
      } else if (conv.status === 'escalated') {
        dist.escalated++;
      } else {
        dist.completed++;
      }
    }

    return Object.entries(dist)
      .filter(([, value]) => value > 0)
      .map(([label, value]) => ({ label, value }));
  }

  /**
   * Get message count distribution
   */
  private getMessageDistribution(
    conversations: Conversation[],
  ): Array<{ label: string; value: number }> {
    const ranges = [
      { label: '1-2', min: 1, max: 2 },
      { label: '3-5', min: 3, max: 5 },
      { label: '6-10', min: 6, max: 10 },
      { label: '11-20', min: 11, max: 20 },
      { label: '20+', min: 21, max: Infinity },
    ];

    const dist: Array<{ label: string; value: number }> = ranges.map((r) => ({
      label: r.label,
      value: 0,
    }));

    for (const conv of conversations) {
      const count = conv.messages.length;
      for (let i = 0; i < ranges.length; i++) {
        if (count >= ranges[i].min && count <= ranges[i].max) {
          dist[i].value++;
          break;
        }
      }
    }

    return dist.filter((d) => d.value > 0);
  }

  /**
   * Get recent conversations
   */
  private getRecentConversations(
    conversations: Conversation[],
    limit: number,
  ): Array<{
    id: string;
    status: string;
    duration?: number;
    messageCount: number;
    startedAt: number;
  }> {
    return conversations
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, limit)
      .map((conv) => ({
        id: conv.id,
        status: conv.status,
        duration: conv.endedAt ? conv.endedAt - conv.startedAt : undefined,
        messageCount: conv.messages.length,
        startedAt: conv.startedAt,
      }));
  }

  /**
   * Generate alerts
   */
  private generateAlerts(
    kpis: KPIDataPoint[],
    conversations: Conversation[],
  ): Array<{
    type: 'warning' | 'critical' | 'info';
    message: string;
    timestamp: number;
  }> {
    const alerts: Array<{
      type: 'warning' | 'critical' | 'info';
      message: string;
      timestamp: number;
    }> = [];
    const now = Date.now();

    // Check success rate
    const successRate = kpis.find((k) => k.name === 'Success Rate');
    if (successRate && successRate.value < 70) {
      alerts.push({
        type: successRate.value < 50 ? 'critical' : 'warning',
        message: `Success rate is ${successRate.value.toFixed(1)}%`,
        timestamp: now,
      });
    }

    // Check abandonment rate
    const total = conversations.length;
    const abandoned = conversations.filter(
      (c) => c.status === 'abandoned',
    ).length;
    if (total > 0 && abandoned / total > 0.2) {
      alerts.push({
        type: 'warning',
        message: `High abandonment rate: ${((abandoned / total) * 100).toFixed(1)}%`,
        timestamp: now,
      });
    }

    // Check escalation rate
    const escalated = conversations.filter(
      (c) => c.status === 'escalated',
    ).length;
    if (total > 0 && escalated / total > 0.1) {
      alerts.push({
        type: 'warning',
        message: `High escalation rate: ${((escalated / total) * 100).toFixed(1)}%`,
        timestamp: now,
      });
    }

    // Check avg latency
    const avgLatency = kpis.find((k) => k.name === 'Avg Latency');
    if (avgLatency && avgLatency.value > 5000) {
      alerts.push({
        type: 'warning',
        message: `High average latency: ${(avgLatency.value / 1000).toFixed(2)}s`,
        timestamp: now,
      });
    }

    return alerts;
  }

  /**
   * Start auto-refresh
   */
  startAutoRefresh(intervalMs: number, options: DashboardOptions = {}): void {
    this.stopAutoRefresh();
    this.refreshInterval = setInterval(() => {
      void (async () => {
        try {
          const snapshot = await this.getSnapshot(options);
          this.emit('updated', snapshot);
        } catch (error) {
          this.emit('error', error as Error);
        }
      })();
    }, intervalMs);
  }

  /**
   * Stop auto-refresh
   */
  stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = undefined;
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
   * Get previous period
   */
  private getPreviousPeriod(current: TimeRange): TimeRange {
    const duration = current.end - current.start;
    return {
      start: current.start - duration,
      end: current.start,
    };
  }

  /**
   * Get granularity interval in ms
   */
  private getGranularityInterval(granularity: TimeGranularity): number {
    const MINUTE = 60 * 1000;
    const HOUR = 60 * MINUTE;
    const DAY = 24 * HOUR;

    const intervals: Record<TimeGranularity, number> = {
      minute: MINUTE,
      hour: HOUR,
      day: DAY,
      week: 7 * DAY,
      month: 30 * DAY,
      quarter: 90 * DAY,
      year: 365 * DAY,
    };

    return intervals[granularity];
  }
}
