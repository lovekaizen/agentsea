/**
 * Trend Analyzer
 *
 * Analyzes trends in conversation topics and metrics.
 */

import { EventEmitter } from 'eventemitter3';
import { nanoid } from 'nanoid';
import type {
  Conversation,
  Trend,
  TrendAnalysisOptions,
  TrendAnalysisResult,
  TrendTimeSeries,
  TopicEvolution,
  TimeGranularity,
  AnalyticsStorageAdapter,
} from '../types/index.js';

/**
 * Trend analyzer events
 */
export interface TrendAnalyzerEvents {
  'analysis:complete': (result: TrendAnalysisResult) => void;
  'trend:found': (trend: Trend) => void;
  'topic:emerging': (topic: string) => void;
  'topic:declining': (topic: string) => void;
  error: (error: Error) => void;
}

/**
 * Default analysis options
 */
const DEFAULT_OPTIONS: TrendAnalysisOptions = {
  compareWindow: 7,
  baselineWindow: 30,
  minChange: 0.1,
  granularity: 'day',
  includeEmerging: true,
  includeDeclining: true,
};

/**
 * TrendAnalyzer - Analyzes trends in conversations
 */
export class TrendAnalyzer extends EventEmitter<TrendAnalyzerEvents> {
  private readonly storage: AnalyticsStorageAdapter;

  constructor(storage: AnalyticsStorageAdapter) {
    super();
    this.storage = storage;
  }

  /**
   * Analyze trends
   */
  async analyze(
    options: TrendAnalysisOptions = {},
  ): Promise<TrendAnalysisResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Get conversations for both windows
    const now = Date.now();
    const compareStart = now - (opts.compareWindow ?? 7) * 24 * 60 * 60 * 1000;
    const baselineStart =
      now - (opts.baselineWindow ?? 30) * 24 * 60 * 60 * 1000;

    const allConversations = await this.getConversations(baselineStart, now);
    const recentConversations = allConversations.filter(
      (c) => c.startedAt >= compareStart,
    );
    const baselineConversations = allConversations.filter(
      (c) => c.startedAt < compareStart,
    );

    if (allConversations.length === 0) {
      return {
        trends: [],
        emerging: [],
        declining: [],
        stable: [],
      };
    }

    // Extract topics and calculate trends
    const trends = this.calculateTopicTrends(
      recentConversations,
      baselineConversations,
      opts,
    );

    // Categorize trends
    const emerging = trends.filter(
      (t) =>
        t.direction === 'up' &&
        t.growthPercent >= (opts.minChange ?? 0.1) * 100,
    );
    const declining = trends.filter(
      (t) =>
        t.direction === 'down' &&
        Math.abs(t.growthPercent) >= (opts.minChange ?? 0.1) * 100,
    );
    const stable = trends.filter(
      (t) =>
        t.direction === 'stable' ||
        Math.abs(t.growthPercent) < (opts.minChange ?? 0.1) * 100,
    );

    // Build time series if requested
    let timeSeries: TrendTimeSeries[] | undefined;
    if (opts.topics && opts.topics.length > 0) {
      timeSeries = this.buildTimeSeries(
        allConversations,
        opts.topics,
        opts.granularity ?? 'day',
      );
    }

    const result: TrendAnalysisResult = {
      trends,
      emerging,
      declining,
      stable,
      timeSeries,
    };

    // Emit events
    for (const trend of trends) {
      this.emit('trend:found', trend);
    }
    for (const topic of emerging) {
      this.emit('topic:emerging', topic.topic);
    }
    for (const topic of declining) {
      this.emit('topic:declining', topic.topic);
    }
    this.emit('analysis:complete', result);

    return result;
  }

  /**
   * Get conversations for analysis
   */
  private async getConversations(
    start: number,
    end: number,
  ): Promise<Conversation[]> {
    const result = await this.storage.queryConversations({
      timeRange: { start, end },
    });
    return result.conversations;
  }

  /**
   * Calculate topic trends
   */
  private calculateTopicTrends(
    recent: Conversation[],
    baseline: Conversation[],
    options: TrendAnalysisOptions,
  ): Trend[] {
    // Count topics in each period
    const recentTopics = this.countTopics(recent);
    const baselineTopics = this.countTopics(baseline);

    // Normalize by conversation count
    const recentTotal = recent.length || 1;
    const baselineTotal = baseline.length || 1;

    const trends: Trend[] = [];
    const allTopics = new Set([
      ...recentTopics.keys(),
      ...baselineTopics.keys(),
    ]);

    for (const topic of allTopics) {
      const recentCount = recentTopics.get(topic) ?? 0;
      const baselineCount = baselineTopics.get(topic) ?? 0;

      const recentRate = recentCount / recentTotal;
      const baselineRate = baselineCount / baselineTotal;

      // Calculate growth
      let growthPercent: number;
      let direction: 'up' | 'down' | 'stable';

      if (baselineRate === 0) {
        growthPercent = recentRate > 0 ? 100 : 0;
        direction = recentRate > 0 ? 'up' : 'stable';
      } else {
        growthPercent = ((recentRate - baselineRate) / baselineRate) * 100;

        if (growthPercent > (options.minChange ?? 0.1) * 100) {
          direction = 'up';
        } else if (growthPercent < -(options.minChange ?? 0.1) * 100) {
          direction = 'down';
        } else {
          direction = 'stable';
        }
      }

      // Calculate momentum (rate of change)
      const momentum = recentRate - baselineRate;

      // Get first seen timestamp
      const topicConvs = [...recent, ...baseline].filter((c) =>
        c.topics?.includes(topic),
      );
      const firstSeen =
        topicConvs.length > 0
          ? Math.min(...topicConvs.map((c) => c.startedAt))
          : undefined;

      // Get related topics
      const relatedTopics = this.getRelatedTopics(
        [...recent, ...baseline],
        topic,
      );

      trends.push({
        id: nanoid(),
        topic,
        direction,
        growthPercent,
        currentVolume: recentCount,
        previousVolume: baselineCount,
        firstSeen,
        momentum,
        relatedTopics: relatedTopics.slice(0, 5),
      });
    }

    // Sort by absolute growth
    trends.sort(
      (a, b) => Math.abs(b.growthPercent) - Math.abs(a.growthPercent),
    );

    return trends;
  }

  /**
   * Count topics across conversations
   */
  private countTopics(conversations: Conversation[]): Map<string, number> {
    const counts = new Map<string, number>();

    for (const conv of conversations) {
      for (const topic of conv.topics ?? []) {
        counts.set(topic, (counts.get(topic) ?? 0) + 1);
      }

      // Also count intents as topics
      if (conv.intent?.primary) {
        const intentTopic = `intent:${conv.intent.primary}`;
        counts.set(intentTopic, (counts.get(intentTopic) ?? 0) + 1);
      }
    }

    return counts;
  }

  /**
   * Get related topics (co-occurring)
   */
  private getRelatedTopics(
    conversations: Conversation[],
    topic: string,
  ): string[] {
    const coOccurrence = new Map<string, number>();

    for (const conv of conversations) {
      if (!conv.topics?.includes(topic)) continue;

      for (const otherTopic of conv.topics) {
        if (otherTopic !== topic) {
          coOccurrence.set(otherTopic, (coOccurrence.get(otherTopic) ?? 0) + 1);
        }
      }
    }

    return Array.from(coOccurrence.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => t);
  }

  /**
   * Build time series for specific topics
   */
  private buildTimeSeries(
    conversations: Conversation[],
    topics: string[],
    granularity: TimeGranularity,
  ): TrendTimeSeries[] {
    const granularityMs = this.getGranularityMs(granularity);
    const seriesMap = new Map<string, Map<number, number>>();

    // Initialize series for each topic
    for (const topic of topics) {
      seriesMap.set(topic, new Map());
    }

    // Count by time bucket
    for (const conv of conversations) {
      const bucket = Math.floor(conv.startedAt / granularityMs) * granularityMs;

      for (const topic of topics) {
        if (conv.topics?.includes(topic)) {
          const series = seriesMap.get(topic)!;
          series.set(bucket, (series.get(bucket) ?? 0) + 1);
        }
      }
    }

    // Convert to time series format
    const result: TrendTimeSeries[] = [];
    for (const [topic, buckets] of seriesMap) {
      const points = Array.from(buckets.entries())
        .map(([timestamp, value]) => ({ timestamp, value }))
        .sort((a, b) => a.timestamp - b.timestamp);

      result.push({ topic, points });
    }

    return result;
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
   * Analyze topic evolution
   */
  async analyzeTopicEvolution(
    topic: string,
    options: { granularity?: TimeGranularity; windowDays?: number } = {},
  ): Promise<TopicEvolution> {
    const windowDays = options.windowDays ?? 30;
    const granularity = options.granularity ?? 'day';
    const now = Date.now();
    const start = now - windowDays * 24 * 60 * 60 * 1000;

    const result = await this.storage.queryConversations({
      timeRange: { start, end: now },
      topic,
    });

    const conversations = result.conversations;
    const granularityMs = this.getGranularityMs(granularity);

    // Build stages
    const stagesMap = new Map<
      number,
      {
        timestamp: number;
        volume: number;
        keywords: Map<string, number>;
        sentimentSum: number;
        sentimentCount: number;
      }
    >();

    for (const conv of conversations) {
      const bucket = Math.floor(conv.startedAt / granularityMs) * granularityMs;
      const stage = stagesMap.get(bucket) ?? {
        timestamp: bucket,
        volume: 0,
        keywords: new Map(),
        sentimentSum: 0,
        sentimentCount: 0,
      };

      stage.volume++;

      // Extract keywords from conversation
      for (const message of conv.messages) {
        const words = message.content
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 3);
        for (const word of words) {
          stage.keywords.set(word, (stage.keywords.get(word) ?? 0) + 1);
        }
      }

      if (conv.sentiment?.score !== undefined) {
        stage.sentimentSum += conv.sentiment.score;
        stage.sentimentCount++;
      }

      stagesMap.set(bucket, stage);
    }

    // Convert to stages array
    const stages = Array.from(stagesMap.values())
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((s) => ({
        timestamp: s.timestamp,
        volume: s.volume,
        keywords: Array.from(s.keywords.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([k]) => k),
        sentiment:
          s.sentimentCount > 0 ? s.sentimentSum / s.sentimentCount : undefined,
      }));

    // Determine lifecycle stage
    let lifecycleStage: TopicEvolution['lifecycleStage'] = 'mature';
    if (stages.length >= 2) {
      const firstHalf = stages.slice(0, Math.floor(stages.length / 2));
      const secondHalf = stages.slice(Math.floor(stages.length / 2));

      const firstAvg =
        firstHalf.reduce((sum, s) => sum + s.volume, 0) / firstHalf.length;
      const secondAvg =
        secondHalf.reduce((sum, s) => sum + s.volume, 0) / secondHalf.length;

      if (secondAvg > firstAvg * 1.3) {
        lifecycleStage = firstAvg < 5 ? 'emerging' : 'growing';
      } else if (secondAvg < firstAvg * 0.7) {
        lifecycleStage = secondAvg < 2 ? 'dormant' : 'declining';
      }
    }

    // Simple prediction based on recent trend
    let prediction: TopicEvolution['prediction'];
    if (stages.length >= 3) {
      const recentVolumes = stages.slice(-3).map((s) => s.volume);
      const trend = (recentVolumes[2] - recentVolumes[0]) / 2;

      prediction = {
        nextWeek: Math.max(0, recentVolumes[2] + trend * 7),
        nextMonth: Math.max(0, recentVolumes[2] + trend * 30),
        confidence: 0.6,
      };
    }

    return {
      topic,
      stages,
      lifecycleStage,
      prediction,
    };
  }
}
