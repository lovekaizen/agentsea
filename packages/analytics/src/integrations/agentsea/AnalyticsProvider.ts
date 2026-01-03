/**
 * AnalyticsProvider
 *
 * Provider pattern for integrating analytics with AgentSea agents.
 */

import type {
  AnalyticsConfig,
  AnalyticsStorageAdapter,
  Conversation,
  AnalyticsEvent,
  EventType,
  ConversationQueryResult,
  TimeRange,
  TimePeriod,
  AggregationFunction,
  IntentClassification,
  SentimentResult,
  TopicClassification,
  FlowAnalysisResult,
  DropOffDetectionResult,
  TrendAnalysisResult,
  AnomalyDetectionResult,
} from '../../types/index.js';
import { Analytics } from '../../core/Analytics.js';
import { MemoryStorageAdapter } from '../../storage/adapters/MemoryStorage.js';
import { Aggregations } from '../../metrics/Aggregations.js';
import { MetricsEngine } from '../../metrics/MetricsEngine.js';
import { IntentClassifier } from '../../classification/IntentClassifier.js';
import { SentimentAnalyzer } from '../../classification/SentimentAnalyzer.js';
import { TopicClassifier } from '../../classification/TopicClassifier.js';
import { FlowAnalyzer } from '../../analysis/FlowAnalyzer.js';
import { DropOffDetector } from '../../analysis/DropOffDetector.js';
import { TrendAnalyzer } from '../../clustering/TrendAnalyzer.js';
import { AnomalyDetector } from '../../clustering/AnomalyDetector.js';

/**
 * Provider options
 */
export interface AnalyticsProviderOptions {
  config?: Partial<AnalyticsConfig>;
  storage?: AnalyticsStorageAdapter;
  enableClassification?: boolean;
  enableAnalysis?: boolean;
  enableTrends?: boolean;
}

/**
 * Dashboard summary
 */
export interface DashboardSummary {
  period: TimePeriod | TimeRange;
  conversations: {
    total: number;
    active: number;
    completed: number;
    escalated: number;
    abandoned: number;
  };
  messages: {
    total: number;
    avgPerConversation: number;
  };
  tokens: {
    total: number;
    avgPerConversation: number;
  };
  performance: {
    avgLatencyMs: number;
    successRate: number;
    satisfactionScore?: number;
  };
  trends: {
    conversationsChange: number;
    messagesChange: number;
    tokensChange: number;
  };
}

/**
 * Analytics provider for AgentSea
 *
 * @example
 * ```typescript
 * import { AnalyticsProvider } from '@lov3kaizen/agentsea-analytics/integrations/agentsea';
 *
 * const provider = new AnalyticsProvider({
 *   enableClassification: true,
 *   enableAnalysis: true,
 * });
 *
 * // Get dashboard data
 * const summary = await provider.getDashboardSummary('week');
 *
 * // Analyze intent
 * const intent = await provider.classifyIntent('How do I reset my password?');
 * ```
 */
export class AnalyticsProvider {
  private analytics: Analytics;
  private storage: AnalyticsStorageAdapter;
  private aggregations: Aggregations;
  private metrics: MetricsEngine;
  private intentClassifier?: IntentClassifier;
  private sentimentAnalyzer?: SentimentAnalyzer;
  private topicClassifier?: TopicClassifier;
  private flowAnalyzer?: FlowAnalyzer;
  private dropOffDetector?: DropOffDetector;
  private trendAnalyzer?: TrendAnalyzer;
  private anomalyDetector?: AnomalyDetector;

  constructor(options: AnalyticsProviderOptions = {}) {
    this.storage = options.storage ?? new MemoryStorageAdapter();

    const config: AnalyticsConfig = {
      enabled: true,
      storage: this.storage,
      ...options.config,
    };

    this.analytics = new Analytics(config);
    this.aggregations = new Aggregations(this.storage);
    this.metrics = new MetricsEngine(this.storage);

    // Initialize optional components
    if (options.enableClassification !== false) {
      this.intentClassifier = new IntentClassifier();
      this.sentimentAnalyzer = new SentimentAnalyzer();
      this.topicClassifier = new TopicClassifier();
    }

    if (options.enableAnalysis !== false) {
      this.flowAnalyzer = new FlowAnalyzer(this.storage);
      this.dropOffDetector = new DropOffDetector(this.storage);
    }

    if (options.enableTrends !== false) {
      this.trendAnalyzer = new TrendAnalyzer(this.storage);
      this.anomalyDetector = new AnomalyDetector(this.storage);
    }
  }

  /**
   * Get dashboard summary
   */
  async getDashboardSummary(
    period: TimePeriod | TimeRange = 'week',
  ): Promise<DashboardSummary> {
    const timeRange = this.resolveTimeRange(period);

    // Get conversations
    const result = await this.storage.queryConversations({ timeRange });
    const conversations = result.conversations;

    // Calculate stats
    const total = conversations.length;
    const active = conversations.filter((c) => !c.endedAt).length;
    const completed = conversations.filter(
      (c) => c.endedAt && c.outcome?.success,
    ).length;
    const escalated = conversations.filter(
      (c) => c.status === 'escalated',
    ).length;
    const abandoned = conversations.filter(
      (c) => c.endedAt && !c.outcome?.success,
    ).length;

    // Message stats
    let totalMessages = 0;
    let totalTokens = 0;
    let totalLatency = 0;
    let latencyCount = 0;
    let satisfactionSum = 0;
    let satisfactionCount = 0;

    for (const conv of conversations) {
      totalMessages += conv.messages.length;

      for (const msg of conv.messages) {
        if (msg.tokenUsage) {
          totalTokens += msg.tokenUsage.total;
        }
        if (msg.latencyMs) {
          totalLatency += msg.latencyMs;
          latencyCount++;
        }
      }

      if (conv.outcome?.satisfaction !== undefined) {
        satisfactionSum += conv.outcome.satisfaction;
        satisfactionCount++;
      }
    }

    // Calculate trends (compare to previous period)
    const previousPeriod = this.getPreviousPeriod(timeRange);
    const previousResult = await this.storage.queryConversations({
      timeRange: previousPeriod,
    });
    const previousConversations = previousResult.conversations;

    let previousMessages = 0;
    let previousTokens = 0;
    for (const conv of previousConversations) {
      previousMessages += conv.messages.length;
      for (const msg of conv.messages) {
        if (msg.tokenUsage) {
          previousTokens += msg.tokenUsage.total;
        }
      }
    }

    const conversationsChange =
      previousConversations.length > 0
        ? ((total - previousConversations.length) /
            previousConversations.length) *
          100
        : 0;
    const messagesChange =
      previousMessages > 0
        ? ((totalMessages - previousMessages) / previousMessages) * 100
        : 0;
    const tokensChange =
      previousTokens > 0
        ? ((totalTokens - previousTokens) / previousTokens) * 100
        : 0;

    return {
      period,
      conversations: {
        total,
        active,
        completed,
        escalated,
        abandoned,
      },
      messages: {
        total: totalMessages,
        avgPerConversation: total > 0 ? totalMessages / total : 0,
      },
      tokens: {
        total: totalTokens,
        avgPerConversation: total > 0 ? totalTokens / total : 0,
      },
      performance: {
        avgLatencyMs: latencyCount > 0 ? totalLatency / latencyCount : 0,
        successRate: total > 0 ? (completed / total) * 100 : 0,
        satisfactionScore:
          satisfactionCount > 0
            ? satisfactionSum / satisfactionCount
            : undefined,
      },
      trends: {
        conversationsChange,
        messagesChange,
        tokensChange,
      },
    };
  }

  /**
   * Classify intent of text
   */
  classifyIntent(text: string): IntentClassification {
    if (!this.intentClassifier) {
      throw new Error('Classification not enabled');
    }
    return this.intentClassifier.classify(text);
  }

  /**
   * Analyze sentiment of text
   */
  analyzeSentiment(text: string): SentimentResult {
    if (!this.sentimentAnalyzer) {
      throw new Error('Classification not enabled');
    }
    return this.sentimentAnalyzer.analyze(text);
  }

  /**
   * Classify topics in text
   */
  classifyTopics(text: string): TopicClassification {
    if (!this.topicClassifier) {
      throw new Error('Classification not enabled');
    }
    return this.topicClassifier.classify(text);
  }

  /**
   * Analyze conversation flow
   */
  async analyzeFlow(options?: {
    period?: TimePeriod | TimeRange;
    minSupport?: number;
  }): Promise<FlowAnalysisResult> {
    if (!this.flowAnalyzer) {
      throw new Error('Analysis not enabled');
    }
    return this.flowAnalyzer.analyze(options);
  }

  /**
   * Detect drop-offs
   */
  async detectDropOffs(options?: {
    minConversations?: number;
    minDropOffRate?: number;
  }): Promise<DropOffDetectionResult> {
    if (!this.dropOffDetector) {
      throw new Error('Analysis not enabled');
    }
    return this.dropOffDetector.detect(options);
  }

  /**
   * Detect trends
   */
  async detectTrends(options?: {
    compareWindow?: number;
    baselineWindow?: number;
  }): Promise<TrendAnalysisResult> {
    if (!this.trendAnalyzer) {
      throw new Error('Trends not enabled');
    }
    return this.trendAnalyzer.analyze(options);
  }

  /**
   * Detect anomalies
   */
  async detectAnomalies(options?: {
    metric?: string;
    sensitivity?: 'low' | 'medium' | 'high';
  }): Promise<AnomalyDetectionResult> {
    if (!this.anomalyDetector) {
      throw new Error('Trends not enabled');
    }
    return this.anomalyDetector.detect(options);
  }

  /**
   * Aggregate metric
   */
  async aggregate(
    metric: string,
    fn: AggregationFunction,
    period?: TimePeriod | TimeRange,
  ): Promise<number> {
    const result = await this.aggregations
      .query()
      .metric(metric)
      .function(fn)
      .period(period ?? 'week')
      .execute();
    return result.value;
  }

  /**
   * Get conversation records
   */
  async getConversations(options?: {
    period?: TimePeriod | TimeRange;
    limit?: number;
    offset?: number;
    userId?: string;
  }): Promise<ConversationQueryResult> {
    const timeRange = options?.period
      ? this.resolveTimeRange(options.period)
      : undefined;

    return this.storage.queryConversations({
      timeRange,
      limit: options?.limit,
      offset: options?.offset,
      userId: options?.userId,
    });
  }

  /**
   * Get single conversation
   */
  async getConversation(id: string): Promise<Conversation | null> {
    return this.storage.getConversation(id);
  }

  /**
   * Track custom event
   */
  async trackEvent(
    type: string,
    data?: Record<string, unknown>,
    conversationId?: string,
  ): Promise<AnalyticsEvent> {
    return this.analytics.trackEvent({
      type: type as EventType,
      conversationId,
      data: data ?? {},
    });
  }

  /**
   * Get analytics instance
   */
  getAnalytics(): Analytics {
    return this.analytics;
  }

  /**
   * Get storage adapter
   */
  getStorage(): AnalyticsStorageAdapter {
    return this.storage;
  }

  /**
   * Get metrics engine
   */
  getMetrics(): MetricsEngine {
    return this.metrics;
  }

  /**
   * Get intent classifier
   */
  getIntentClassifier(): IntentClassifier | undefined {
    return this.intentClassifier;
  }

  /**
   * Get sentiment analyzer
   */
  getSentimentAnalyzer(): SentimentAnalyzer | undefined {
    return this.sentimentAnalyzer;
  }

  /**
   * Get topic classifier
   */
  getTopicClassifier(): TopicClassifier | undefined {
    return this.topicClassifier;
  }

  /**
   * Get flow analyzer
   */
  getFlowAnalyzer(): FlowAnalyzer | undefined {
    return this.flowAnalyzer;
  }

  /**
   * Get drop-off detector
   */
  getDropOffDetector(): DropOffDetector | undefined {
    return this.dropOffDetector;
  }

  /**
   * Get trend analyzer
   */
  getTrendAnalyzer(): TrendAnalyzer | undefined {
    return this.trendAnalyzer;
  }

  /**
   * Get anomaly detector
   */
  getAnomalyDetector(): AnomalyDetector | undefined {
    return this.anomalyDetector;
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
   * Get previous period for comparison
   */
  private getPreviousPeriod(current: TimeRange): TimeRange {
    const duration = current.end - current.start;
    return {
      start: current.start - duration,
      end: current.start,
    };
  }
}

/**
 * Create analytics provider
 */
export function createAnalyticsProvider(
  options?: AnalyticsProviderOptions,
): AnalyticsProvider {
  return new AnalyticsProvider(options);
}
