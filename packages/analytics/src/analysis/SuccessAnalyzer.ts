/**
 * Success Analyzer
 *
 * Analyzes conversation success rates and factors.
 */

import { EventEmitter } from 'eventemitter3';
import type {
  Conversation,
  SuccessCriteria,
  SuccessAnalysisOptions,
  SuccessAnalysisResult,
  SuccessMetric,
  SuccessTrendPoint,
  SuccessInsight,
  AnalyticsStorageAdapter,
} from '../types/index.js';

/**
 * Success analyzer events
 */
export interface SuccessAnalyzerEvents {
  'analysis:complete': (result: SuccessAnalysisResult) => void;
  'insight:found': (insight: SuccessInsight) => void;
  error: (error: Error) => void;
}

/**
 * Default success criteria
 */
const DEFAULT_CRITERIA: SuccessCriteria[] = [
  {
    name: 'task_completed',
    condition: (conv) => conv.outcome?.success === true,
    weight: 1.0,
  },
  {
    name: 'positive_sentiment',
    condition: (conv) => (conv.sentiment?.score ?? 0) > 0.2,
    weight: 0.5,
  },
  {
    name: 'no_escalation',
    condition: (conv) => conv.status !== 'escalated',
    weight: 0.3,
  },
  {
    name: 'quick_resolution',
    condition: (conv) => {
      if (!conv.endedAt) return false;
      const duration = conv.endedAt - conv.startedAt;
      return duration < 5 * 60 * 1000; // Under 5 minutes
    },
    weight: 0.2,
  },
];

/**
 * SuccessAnalyzer - Analyzes conversation success
 */
export class SuccessAnalyzer extends EventEmitter<SuccessAnalyzerEvents> {
  private readonly storage: AnalyticsStorageAdapter;
  private criteria: SuccessCriteria[];

  constructor(storage: AnalyticsStorageAdapter, criteria?: SuccessCriteria[]) {
    super();
    this.storage = storage;
    this.criteria = criteria ?? DEFAULT_CRITERIA;
  }

  /**
   * Analyze success rates
   */
  async analyze(
    options: SuccessAnalysisOptions = {},
  ): Promise<SuccessAnalysisResult> {
    // Get conversations
    const conversations = await this.getConversations(options);

    if (conversations.length === 0) {
      return {
        overall: { rate: 0, successCount: 0, totalCount: 0 },
        byCriteria: new Map(),
      };
    }

    // Calculate overall success
    const overall = this.calculateOverallSuccess(conversations);

    // Calculate by criteria
    const byCriteria = new Map<string, SuccessMetric>();
    for (const criterion of this.criteria) {
      byCriteria.set(
        criterion.name,
        this.calculateCriterionSuccess(conversations, criterion),
      );
    }

    // Calculate by group if requested
    let byGroup: Map<string, SuccessMetric> | undefined;
    if (options.groupBy) {
      byGroup = this.calculateByGroup(conversations, options.groupBy);
    }

    // Calculate trend if requested
    let trend: SuccessTrendPoint[] | undefined;
    if (options.includeTrend) {
      trend = this.calculateTrend(
        conversations,
        options.trendGranularity ?? 'day',
      );
    }

    // Generate insights
    const insights = this.generateInsights(overall, byCriteria, trend);

    const result: SuccessAnalysisResult = {
      overall,
      byCriteria,
      byGroup,
      trend,
      insights,
    };

    // Emit events
    for (const insight of insights ?? []) {
      this.emit('insight:found', insight);
    }
    this.emit('analysis:complete', result);

    return result;
  }

  /**
   * Get conversations for analysis
   */
  private async getConversations(
    options: SuccessAnalysisOptions,
  ): Promise<Conversation[]> {
    const query: { timeRange?: { start: number; end: number } } = {};

    if (options.period) {
      query.timeRange =
        typeof options.period === 'object'
          ? options.period
          : this.periodToTimeRange(options.period as string);
    }

    const result = await this.storage.queryConversations(query);
    return result.conversations;
  }

  /**
   * Calculate overall success metric
   */
  private calculateOverallSuccess(
    conversations: Conversation[],
  ): SuccessMetric {
    // Use weighted criteria for composite success
    let totalSuccessScore = 0;
    const totalWeight = this.criteria.reduce(
      (sum, c) => sum + (c.weight ?? 1),
      0,
    );

    for (const conv of conversations) {
      let convScore = 0;
      for (const criterion of this.criteria) {
        if (criterion.condition(conv)) {
          convScore += criterion.weight ?? 1;
        }
      }
      totalSuccessScore += convScore / totalWeight;
    }

    // Primary success based on task_completed criterion
    const successCount = conversations.filter(
      (c) => c.outcome?.success === true,
    ).length;

    return {
      rate:
        conversations.length > 0 ? totalSuccessScore / conversations.length : 0,
      successCount,
      totalCount: conversations.length,
    };
  }

  /**
   * Calculate success for a specific criterion
   */
  private calculateCriterionSuccess(
    conversations: Conversation[],
    criterion: SuccessCriteria,
  ): SuccessMetric {
    const successCount = conversations.filter((c) =>
      criterion.condition(c),
    ).length;

    return {
      rate: conversations.length > 0 ? successCount / conversations.length : 0,
      successCount,
      totalCount: conversations.length,
    };
  }

  /**
   * Calculate success by group
   */
  private calculateByGroup(
    conversations: Conversation[],
    groupBy: string | string[],
  ): Map<string, SuccessMetric> {
    const groups = new Map<string, Conversation[]>();
    const groupFields = Array.isArray(groupBy) ? groupBy : [groupBy];

    for (const conv of conversations) {
      const groupKey = this.getGroupKey(conv, groupFields);
      const existing = groups.get(groupKey) ?? [];
      existing.push(conv);
      groups.set(groupKey, existing);
    }

    const results = new Map<string, SuccessMetric>();
    for (const [key, convs] of groups) {
      results.set(key, this.calculateOverallSuccess(convs));
    }

    return results;
  }

  /**
   * Get group key for a conversation
   */
  private getGroupKey(conv: Conversation, fields: string[]): string {
    const parts: string[] = [];

    for (const field of fields) {
      switch (field) {
        case 'intent':
          parts.push(conv.intent?.primary ?? 'unknown');
          break;
        case 'topic':
          parts.push(conv.topics?.[0] ?? 'unknown');
          break;
        case 'userId':
          parts.push(conv.userId ?? 'anonymous');
          break;
        default:
          parts.push(String(conv.metadata?.[field] ?? 'unknown'));
      }
    }

    return parts.join(':');
  }

  /**
   * Calculate success trend
   */
  private calculateTrend(
    conversations: Conversation[],
    granularity: 'day' | 'week' | 'month',
  ): SuccessTrendPoint[] {
    const buckets = new Map<number, Conversation[]>();
    const granularityMs = this.getGranularityMs(granularity);

    for (const conv of conversations) {
      const bucketKey =
        Math.floor(conv.startedAt / granularityMs) * granularityMs;
      const existing = buckets.get(bucketKey) ?? [];
      existing.push(conv);
      buckets.set(bucketKey, existing);
    }

    const trend: SuccessTrendPoint[] = [];
    for (const [timestamp, convs] of buckets) {
      const successCount = convs.filter(
        (c) => c.outcome?.success === true,
      ).length;
      trend.push({
        timestamp,
        rate: convs.length > 0 ? successCount / convs.length : 0,
        count: convs.length,
      });
    }

    trend.sort((a, b) => a.timestamp - b.timestamp);
    return trend;
  }

  /**
   * Generate insights from analysis
   */
  private generateInsights(
    overall: SuccessMetric,
    byCriteria: Map<string, SuccessMetric>,
    trend?: SuccessTrendPoint[],
  ): SuccessInsight[] {
    const insights: SuccessInsight[] = [];

    // Low overall success rate
    if (overall.rate < 0.5) {
      insights.push({
        type: 'decline',
        description: `Overall success rate is low at ${(overall.rate * 100).toFixed(1)}%`,
        significance: 'high',
        data: { rate: overall.rate },
      });
    }

    // Identify weak criteria
    for (const [name, metric] of byCriteria) {
      if (metric.rate < 0.3) {
        insights.push({
          type: 'decline',
          description: `Criterion "${name}" has low success rate: ${(metric.rate * 100).toFixed(1)}%`,
          significance: 'medium',
          data: { criterion: name, rate: metric.rate },
        });
      }
    }

    // Trend analysis
    if (trend && trend.length >= 3) {
      const recentTrend = this.analyzeTrendDirection(trend);
      if (recentTrend === 'improving') {
        insights.push({
          type: 'improvement',
          description: 'Success rate is trending upward',
          significance: 'medium',
        });
      } else if (recentTrend === 'declining') {
        insights.push({
          type: 'decline',
          description: 'Success rate is trending downward',
          significance: 'high',
        });
      }
    }

    return insights;
  }

  /**
   * Analyze trend direction
   */
  private analyzeTrendDirection(
    trend: SuccessTrendPoint[],
  ): 'improving' | 'declining' | 'stable' {
    if (trend.length < 2) return 'stable';

    const recent = trend.slice(-3);
    const older = trend.slice(-6, -3);

    if (older.length === 0) {
      // Compare first half to second half
      const mid = Math.floor(trend.length / 2);
      const firstHalf = trend.slice(0, mid);
      const secondHalf = trend.slice(mid);

      const firstAvg =
        firstHalf.reduce((sum, t) => sum + t.rate, 0) / firstHalf.length;
      const secondAvg =
        secondHalf.reduce((sum, t) => sum + t.rate, 0) / secondHalf.length;

      if (secondAvg - firstAvg > 0.05) return 'improving';
      if (firstAvg - secondAvg > 0.05) return 'declining';
      return 'stable';
    }

    const recentAvg =
      recent.reduce((sum, t) => sum + t.rate, 0) / recent.length;
    const olderAvg = older.reduce((sum, t) => sum + t.rate, 0) / older.length;

    if (recentAvg - olderAvg > 0.05) return 'improving';
    if (olderAvg - recentAvg > 0.05) return 'declining';
    return 'stable';
  }

  /**
   * Get granularity in milliseconds
   */
  private getGranularityMs(granularity: 'day' | 'week' | 'month'): number {
    switch (granularity) {
      case 'day':
        return 24 * 60 * 60 * 1000;
      case 'week':
        return 7 * 24 * 60 * 60 * 1000;
      case 'month':
        return 30 * 24 * 60 * 60 * 1000;
    }
  }

  /**
   * Convert period to time range
   */
  private periodToTimeRange(period: string): { start: number; end: number } {
    const now = Date.now();
    const periods: Record<string, number> = {
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
    };

    return {
      start: now - (periods[period] ?? periods.week),
      end: now,
    };
  }

  // ==================== Criteria Management ====================

  /**
   * Add success criterion
   */
  addCriterion(criterion: SuccessCriteria): void {
    const existing = this.criteria.findIndex((c) => c.name === criterion.name);
    if (existing >= 0) {
      this.criteria[existing] = criterion;
    } else {
      this.criteria.push(criterion);
    }
  }

  /**
   * Remove success criterion
   */
  removeCriterion(name: string): boolean {
    const index = this.criteria.findIndex((c) => c.name === name);
    if (index >= 0) {
      this.criteria.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get all criteria
   */
  getCriteria(): SuccessCriteria[] {
    return [...this.criteria];
  }

  /**
   * Evaluate a single conversation
   */
  evaluateConversation(conversation: Conversation): {
    success: boolean;
    score: number;
    criteriaResults: Map<string, boolean>;
  } {
    const criteriaResults = new Map<string, boolean>();
    let totalScore = 0;
    let totalWeight = 0;

    for (const criterion of this.criteria) {
      const passed = criterion.condition(conversation);
      criteriaResults.set(criterion.name, passed);

      if (passed) {
        totalScore += criterion.weight ?? 1;
      }
      totalWeight += criterion.weight ?? 1;
    }

    const score = totalWeight > 0 ? totalScore / totalWeight : 0;

    return {
      success: score >= 0.5,
      score,
      criteriaResults,
    };
  }
}
