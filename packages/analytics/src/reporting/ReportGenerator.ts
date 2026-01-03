/**
 * ReportGenerator
 *
 * Generates comprehensive analytics reports.
 */

import type {
  AnalyticsStorageAdapter,
  Conversation,
  TimeRange,
  TimePeriod,
} from '../types/index.js';
import { DashboardData, type DashboardSnapshot } from './DashboardData.js';

/**
 * Report section
 */
export interface ReportSection {
  title: string;
  content: string | object;
  type: 'text' | 'table' | 'chart' | 'kpi';
}

/**
 * Generated report
 */
export interface Report {
  id: string;
  title: string;
  generatedAt: number;
  period: TimePeriod | TimeRange;
  sections: ReportSection[];
  summary: string;
  metadata?: Record<string, unknown>;
}

/**
 * Report options
 */
export interface ReportOptions {
  title?: string;
  period?: TimePeriod | TimeRange;
  includeSummary?: boolean;
  includeKPIs?: boolean;
  includeConversationDetails?: boolean;
  includeTopPerformers?: boolean;
  includeIssues?: boolean;
  maxConversations?: number;
}

/**
 * ReportGenerator - Generates analytics reports
 */
export class ReportGenerator {
  private readonly storage: AnalyticsStorageAdapter;
  private readonly dashboard: DashboardData;

  constructor(storage: AnalyticsStorageAdapter) {
    this.storage = storage;
    this.dashboard = new DashboardData(storage);
  }

  /**
   * Generate a comprehensive report
   */
  async generate(options: ReportOptions = {}): Promise<Report> {
    const period = options.period ?? 'week';
    const timeRange = this.resolveTimeRange(period);

    // Get dashboard data
    const snapshot = await this.dashboard.getSnapshot({
      period,
      includeCharts: true,
      includeRecentConversations: true,
    });

    // Get conversations
    const result = await this.storage.queryConversations({
      timeRange,
      limit: options.maxConversations ?? 100,
    });
    const conversations = result.conversations;

    const sections: ReportSection[] = [];

    // Executive summary
    if (options.includeSummary !== false) {
      sections.push({
        title: 'Executive Summary',
        type: 'text',
        content: this.generateSummary(snapshot, conversations),
      });
    }

    // KPIs
    if (options.includeKPIs !== false) {
      sections.push({
        title: 'Key Performance Indicators',
        type: 'kpi',
        content: snapshot.kpis.map((kpi) => ({
          name: kpi.name,
          value: kpi.value,
          change: kpi.changePercent,
          trend: kpi.trend,
          unit: kpi.unit,
        })),
      });
    }

    // Conversation details
    if (options.includeConversationDetails) {
      sections.push({
        title: 'Conversation Analysis',
        type: 'table',
        content: this.getConversationAnalysis(conversations),
      });
    }

    // Top performers
    if (options.includeTopPerformers) {
      sections.push({
        title: 'Top Performing Conversations',
        type: 'table',
        content: this.getTopPerformers(conversations),
      });
    }

    // Issues and recommendations
    if (options.includeIssues !== false) {
      sections.push({
        title: 'Issues & Recommendations',
        type: 'text',
        content: this.generateRecommendations(snapshot, conversations),
      });
    }

    // Charts
    for (const chart of snapshot.charts) {
      sections.push({
        title: chart.title,
        type: 'chart',
        content: chart,
      });
    }

    return {
      id: `report-${Date.now()}`,
      title: options.title ?? `Analytics Report - ${this.formatPeriod(period)}`,
      generatedAt: Date.now(),
      period,
      sections,
      summary: this.generateSummary(snapshot, conversations),
    };
  }

  /**
   * Generate daily report
   */
  async generateDaily(): Promise<Report> {
    return this.generate({
      title: `Daily Analytics Report - ${new Date().toLocaleDateString()}`,
      period: 'day',
      includeConversationDetails: true,
    });
  }

  /**
   * Generate weekly report
   */
  async generateWeekly(): Promise<Report> {
    return this.generate({
      title: `Weekly Analytics Report`,
      period: 'week',
      includeTopPerformers: true,
    });
  }

  /**
   * Generate monthly report
   */
  async generateMonthly(): Promise<Report> {
    return this.generate({
      title: `Monthly Analytics Report - ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
      period: 'month',
      includeTopPerformers: true,
      includeConversationDetails: true,
    });
  }

  /**
   * Generate executive summary text
   */
  private generateSummary(
    snapshot: DashboardSnapshot,
    conversations: Conversation[],
  ): string {
    const total = conversations.length;
    const successful = conversations.filter((c) => c.outcome?.success).length;
    const successRate = total > 0 ? (successful / total) * 100 : 0;
    const abandoned = conversations.filter(
      (c) => c.status === 'abandoned',
    ).length;
    const escalated = conversations.filter(
      (c) => c.status === 'escalated',
    ).length;

    const totalKPI = snapshot.kpis.find(
      (k) => k.name === 'Total Conversations',
    );
    const changeText = totalKPI?.changePercent
      ? totalKPI.changePercent > 0
        ? `up ${totalKPI.changePercent.toFixed(1)}%`
        : `down ${Math.abs(totalKPI.changePercent).toFixed(1)}%`
      : 'unchanged';

    let summary = `During this period, there were ${total} conversations (${changeText} from the previous period). `;
    summary += `The success rate was ${successRate.toFixed(1)}%. `;

    if (abandoned > 0) {
      summary += `${abandoned} conversations (${((abandoned / total) * 100).toFixed(1)}%) were abandoned. `;
    }

    if (escalated > 0) {
      summary += `${escalated} conversations (${((escalated / total) * 100).toFixed(1)}%) required escalation. `;
    }

    // Add alerts
    if (snapshot.alerts.length > 0) {
      summary += '\n\nKey alerts:\n';
      for (const alert of snapshot.alerts) {
        summary += `- ${alert.message}\n`;
      }
    }

    return summary;
  }

  /**
   * Get conversation analysis data
   */
  private getConversationAnalysis(conversations: Conversation[]): object {
    const byStatus = {
      completed: conversations.filter((c) => c.outcome?.success).length,
      abandoned: conversations.filter((c) => c.status === 'abandoned').length,
      escalated: conversations.filter((c) => c.status === 'escalated').length,
      active: conversations.filter((c) => !c.endedAt).length,
    };

    const avgDuration =
      conversations
        .filter((c) => c.endedAt)
        .reduce((sum, c) => sum + (c.endedAt! - c.startedAt), 0) /
      (conversations.filter((c) => c.endedAt).length || 1);

    const avgMessages =
      conversations.reduce((sum, c) => sum + c.messages.length, 0) /
      (conversations.length || 1);

    return {
      total: conversations.length,
      byStatus,
      avgDurationSeconds: avgDuration / 1000,
      avgMessages,
      dateRange: {
        start: Math.min(...conversations.map((c) => c.startedAt)),
        end: Math.max(...conversations.map((c) => c.startedAt)),
      },
    };
  }

  /**
   * Get top performing conversations
   */
  private getTopPerformers(conversations: Conversation[]): object[] {
    return conversations
      .filter((c) => c.outcome?.success && c.outcome.satisfaction)
      .sort(
        (a, b) =>
          (b.outcome?.satisfaction ?? 0) - (a.outcome?.satisfaction ?? 0),
      )
      .slice(0, 10)
      .map((c) => ({
        id: c.id,
        satisfaction: c.outcome?.satisfaction,
        duration: c.endedAt ? (c.endedAt - c.startedAt) / 1000 : null,
        messages: c.messages.length,
        startedAt: new Date(c.startedAt).toISOString(),
      }));
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    snapshot: DashboardSnapshot,
    conversations: Conversation[],
  ): string {
    const recommendations: string[] = [];

    // Check success rate
    const successKPI = snapshot.kpis.find((k) => k.name === 'Success Rate');
    if (successKPI && successKPI.value < 80) {
      recommendations.push(
        `- Success rate is below 80%. Consider reviewing failed conversations to identify common issues.`,
      );
    }

    // Check abandonment
    const total = conversations.length;
    const abandoned = conversations.filter(
      (c) => c.status === 'abandoned',
    ).length;
    if (total > 0 && abandoned / total > 0.15) {
      recommendations.push(
        `- Abandonment rate is ${((abandoned / total) * 100).toFixed(1)}%. Consider implementing proactive engagement strategies.`,
      );
    }

    // Check escalations
    const escalated = conversations.filter(
      (c) => c.status === 'escalated',
    ).length;
    if (total > 0 && escalated / total > 0.1) {
      recommendations.push(
        `- Escalation rate is ${((escalated / total) * 100).toFixed(1)}%. Review common escalation triggers to improve automation.`,
      );
    }

    // Check latency
    const latencyKPI = snapshot.kpis.find((k) => k.name === 'Avg Latency');
    if (latencyKPI && latencyKPI.value > 3000) {
      recommendations.push(
        `- Average response latency is ${(latencyKPI.value / 1000).toFixed(2)}s. Consider optimization strategies.`,
      );
    }

    // Check satisfaction
    const satisfactionKPI = snapshot.kpis.find(
      (k) => k.name === 'Avg Satisfaction',
    );
    if (satisfactionKPI && satisfactionKPI.value < 4) {
      recommendations.push(
        `- Average satisfaction score is ${satisfactionKPI.value.toFixed(1)}/5. Review low-rated conversations for improvement areas.`,
      );
    }

    if (recommendations.length === 0) {
      return 'All metrics are within acceptable ranges. Continue monitoring for changes.';
    }

    return 'Recommendations:\n' + recommendations.join('\n');
  }

  /**
   * Format period for display
   */
  private formatPeriod(period: TimePeriod | TimeRange): string {
    if (typeof period === 'object' && 'start' in period) {
      const start = new Date(period.start).toLocaleDateString();
      const end = new Date(period.end).toLocaleDateString();
      return `${start} - ${end}`;
    }

    const labels: Record<TimePeriod, string> = {
      hour: 'Last Hour',
      day: 'Last 24 Hours',
      week: 'Last Week',
      month: 'Last Month',
      quarter: 'Last Quarter',
      year: 'Last Year',
      'last-hour': 'Last Hour',
      'last-24-hours': 'Last 24 Hours',
      'last-7-days': 'Last 7 Days',
      'last-30-days': 'Last 30 Days',
      'last-90-days': 'Last 90 Days',
      'last-year': 'Last Year',
      today: 'Today',
      'this-week': 'This Week',
      'this-month': 'This Month',
      'this-quarter': 'This Quarter',
      'this-year': 'This Year',
      'all-time': 'All Time',
    };

    return labels[period];
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
}
