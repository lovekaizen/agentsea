/**
 * Pattern Detector
 *
 * Detects patterns in conversation data.
 */

import { EventEmitter } from 'eventemitter3';
import { nanoid } from 'nanoid';
import type {
  Conversation,
  Pattern,
  PatternElement,
  PatternDetectionOptions,
  PatternDetectionResult,
  AnalyticsStorageAdapter,
} from '../types/index.js';

/**
 * Pattern detector events
 */
export interface PatternDetectorEvents {
  'detection:complete': (result: PatternDetectionResult) => void;
  'pattern:found': (pattern: Pattern) => void;
  error: (error: Error) => void;
}

/**
 * Default detection options
 */
const DEFAULT_OPTIONS: PatternDetectionOptions = {
  minSupport: 0.05,
  minConfidence: 0.5,
  maxLength: 5,
  types: ['sequence', 'association', 'temporal'],
};

/**
 * PatternDetector - Detects patterns in conversations
 */
export class PatternDetector extends EventEmitter<PatternDetectorEvents> {
  private readonly storage: AnalyticsStorageAdapter;

  constructor(storage: AnalyticsStorageAdapter) {
    super();
    this.storage = storage;
  }

  /**
   * Detect patterns in conversations
   */
  async detect(
    options: PatternDetectionOptions = {},
  ): Promise<PatternDetectionResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Get conversations
    const conversations = await this.getConversations(opts);

    if (conversations.length === 0) {
      return {
        patterns: [],
        totalItems: 0,
        topPatterns: [],
        emergingPatterns: [],
      };
    }

    const allPatterns: Pattern[] = [];

    // Detect sequence patterns
    if (opts.types?.includes('sequence')) {
      const seqPatterns = this.detectSequencePatterns(conversations, opts);
      allPatterns.push(...seqPatterns);
    }

    // Detect association patterns
    if (opts.types?.includes('association')) {
      const assocPatterns = this.detectAssociationPatterns(conversations, opts);
      allPatterns.push(...assocPatterns);
    }

    // Detect temporal patterns
    if (opts.types?.includes('temporal')) {
      const tempPatterns = this.detectTemporalPatterns(conversations, opts);
      allPatterns.push(...tempPatterns);
    }

    // Detect behavioral patterns
    if (opts.types?.includes('behavioral')) {
      const behPatterns = this.detectBehavioralPatterns(conversations, opts);
      allPatterns.push(...behPatterns);
    }

    // Sort by support
    allPatterns.sort((a, b) => b.support - a.support);

    // Find emerging patterns (recent + increasing)
    const emergingPatterns = this.findEmergingPatterns(allPatterns);

    // Get top patterns
    const topPatterns = allPatterns.slice(0, 10);

    const result: PatternDetectionResult = {
      patterns: allPatterns,
      totalItems: conversations.length,
      topPatterns,
      emergingPatterns,
    };

    // Emit events
    for (const pattern of allPatterns) {
      this.emit('pattern:found', pattern);
    }
    this.emit('detection:complete', result);

    return result;
  }

  /**
   * Get conversations for analysis
   */
  private async getConversations(
    options: PatternDetectionOptions,
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
   * Detect sequence patterns (sequential message patterns)
   */
  private detectSequencePatterns(
    conversations: Conversation[],
    options: PatternDetectionOptions,
  ): Pattern[] {
    const sequences = new Map<
      string,
      { count: number; timestamps: number[] }
    >();
    const minSupport = (options.minSupport ?? 0.05) * conversations.length;
    const maxLength = options.maxLength ?? 5;

    for (const conv of conversations) {
      // Extract sequence of intents/topics/message types
      const seq = this.extractSequence(conv);

      // Generate subsequences
      for (let len = 2; len <= Math.min(seq.length, maxLength); len++) {
        for (let i = 0; i <= seq.length - len; i++) {
          const subseq = seq.slice(i, i + len);
          const key = subseq.map((s) => `${s.type}:${s.value}`).join('->');

          const existing = sequences.get(key) ?? { count: 0, timestamps: [] };
          existing.count++;
          existing.timestamps.push(conv.startedAt);
          sequences.set(key, existing);
        }
      }
    }

    // Filter by minimum support and create patterns
    const patterns: Pattern[] = [];
    for (const [key, data] of sequences) {
      if (data.count < minSupport) continue;

      const elements = key.split('->').map((e, i) => {
        const [type, value] = e.split(':');
        return { type, value, position: i };
      });

      patterns.push({
        id: nanoid(),
        type: 'sequence',
        description: `Sequence: ${elements.map((e) => e.value).join(' → ')}`,
        support: data.count / conversations.length,
        confidence: this.calculateSequenceConfidence(sequences, key),
        elements,
        firstSeen: Math.min(...data.timestamps),
        lastSeen: Math.max(...data.timestamps),
        trend: this.calculateTrend(data.timestamps),
      });
    }

    return patterns;
  }

  /**
   * Extract sequence from conversation
   */
  private extractSequence(conversation: Conversation): PatternElement[] {
    const elements: PatternElement[] = [];

    for (const message of conversation.messages) {
      // Add message role
      elements.push({
        type: 'role',
        value: message.role,
      });

      // Add tool calls
      if (message.toolCalls) {
        for (const tool of message.toolCalls) {
          elements.push({
            type: 'tool',
            value: tool.name,
          });
        }
      }
    }

    // Add intent if available
    if (conversation.intent?.primary) {
      elements.unshift({
        type: 'intent',
        value: conversation.intent.primary,
      });
    }

    // Add outcome
    elements.push({
      type: 'outcome',
      value: conversation.outcome?.success ? 'success' : 'failure',
    });

    return elements;
  }

  /**
   * Calculate sequence confidence
   */
  private calculateSequenceConfidence(
    sequences: Map<string, { count: number }>,
    key: string,
  ): number {
    // Confidence = P(full sequence | prefix)
    const parts = key.split('->');
    if (parts.length <= 1) return 1;

    const prefix = parts.slice(0, -1).join('->');
    const prefixData = sequences.get(prefix);

    if (!prefixData) return 0;

    const fullData = sequences.get(key)!;
    return fullData.count / prefixData.count;
  }

  /**
   * Detect association patterns (co-occurring elements)
   */
  private detectAssociationPatterns(
    conversations: Conversation[],
    options: PatternDetectionOptions,
  ): Pattern[] {
    const associations = new Map<
      string,
      { count: number; timestamps: number[] }
    >();
    const itemCounts = new Map<string, number>();
    const minSupport = (options.minSupport ?? 0.05) * conversations.length;

    for (const conv of conversations) {
      // Extract items (topics, intents, tools used)
      const items = new Set<string>();

      if (conv.intent?.primary) {
        items.add(`intent:${conv.intent.primary}`);
      }
      for (const topic of conv.topics ?? []) {
        items.add(`topic:${topic}`);
      }
      for (const message of conv.messages) {
        for (const tool of message.toolCalls ?? []) {
          items.add(`tool:${tool.name}`);
        }
      }

      // Count individual items
      for (const item of items) {
        itemCounts.set(item, (itemCounts.get(item) ?? 0) + 1);
      }

      // Count pairs
      const itemArray = Array.from(items);
      for (let i = 0; i < itemArray.length; i++) {
        for (let j = i + 1; j < itemArray.length; j++) {
          const key = [itemArray[i], itemArray[j]].sort().join('&');
          const existing = associations.get(key) ?? {
            count: 0,
            timestamps: [],
          };
          existing.count++;
          existing.timestamps.push(conv.startedAt);
          associations.set(key, existing);
        }
      }
    }

    // Filter and create patterns
    const patterns: Pattern[] = [];
    for (const [key, data] of associations) {
      if (data.count < minSupport) continue;

      const items = key.split('&');
      const support = data.count / conversations.length;

      // Calculate confidence (both directions)
      const confidence = Math.max(
        data.count / (itemCounts.get(items[0]) ?? 1),
        data.count / (itemCounts.get(items[1]) ?? 1),
      );

      if (confidence < (options.minConfidence ?? 0.5)) continue;

      patterns.push({
        id: nanoid(),
        type: 'association',
        description: `Association: ${items.join(' + ')}`,
        support,
        confidence,
        elements: items.map((item) => {
          const [type, value] = item.split(':');
          return { type, value };
        }),
        firstSeen: Math.min(...data.timestamps),
        lastSeen: Math.max(...data.timestamps),
        trend: this.calculateTrend(data.timestamps),
      });
    }

    return patterns;
  }

  /**
   * Detect temporal patterns (time-based patterns)
   */
  private detectTemporalPatterns(
    conversations: Conversation[],
    _options: PatternDetectionOptions,
  ): Pattern[] {
    const patterns: Pattern[] = [];
    const hourCounts = new Array(24).fill(0);
    const dayCounts = new Array(7).fill(0);
    const timestamps: number[] = [];

    for (const conv of conversations) {
      const date = new Date(conv.startedAt);
      hourCounts[date.getHours()]++;
      dayCounts[date.getDay()]++;
      timestamps.push(conv.startedAt);
    }

    // Find peak hours
    const avgHourCount = conversations.length / 24;
    for (let hour = 0; hour < 24; hour++) {
      if (hourCounts[hour] > avgHourCount * 1.5) {
        patterns.push({
          id: nanoid(),
          type: 'temporal',
          description: `Peak activity at ${hour}:00`,
          support: hourCounts[hour] / conversations.length,
          confidence: hourCounts[hour] / avgHourCount - 1,
          elements: [{ type: 'hour', value: String(hour) }],
          firstSeen: Math.min(...timestamps),
          lastSeen: Math.max(...timestamps),
        });
      }
    }

    // Find peak days
    const dayNames = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    const avgDayCount = conversations.length / 7;
    for (let day = 0; day < 7; day++) {
      if (dayCounts[day] > avgDayCount * 1.3) {
        patterns.push({
          id: nanoid(),
          type: 'temporal',
          description: `High volume on ${dayNames[day]}`,
          support: dayCounts[day] / conversations.length,
          confidence: dayCounts[day] / avgDayCount - 1,
          elements: [{ type: 'day', value: dayNames[day] }],
          firstSeen: Math.min(...timestamps),
          lastSeen: Math.max(...timestamps),
        });
      }
    }

    return patterns;
  }

  /**
   * Detect behavioral patterns
   */
  private detectBehavioralPatterns(
    conversations: Conversation[],
    options: PatternDetectionOptions,
  ): Pattern[] {
    const patterns: Pattern[] = [];
    const minSupport = (options.minSupport ?? 0.05) * conversations.length;

    // Detect quick abandonment pattern
    const quickAbandons = conversations.filter(
      (c) => c.status === 'abandoned' && c.messages.length <= 2,
    );
    if (quickAbandons.length >= minSupport) {
      patterns.push({
        id: nanoid(),
        type: 'behavioral',
        description: 'Quick abandonment (≤2 messages)',
        support: quickAbandons.length / conversations.length,
        confidence: 0.8,
        elements: [{ type: 'behavior', value: 'quick_abandon' }],
        firstSeen: Math.min(...quickAbandons.map((c) => c.startedAt)),
        lastSeen: Math.max(...quickAbandons.map((c) => c.startedAt)),
      });
    }

    // Detect escalation pattern
    const escalated = conversations.filter((c) => c.status === 'escalated');
    if (escalated.length >= minSupport) {
      patterns.push({
        id: nanoid(),
        type: 'behavioral',
        description: 'Conversation escalation',
        support: escalated.length / conversations.length,
        confidence: 0.9,
        elements: [{ type: 'behavior', value: 'escalation' }],
        firstSeen: Math.min(...escalated.map((c) => c.startedAt)),
        lastSeen: Math.max(...escalated.map((c) => c.startedAt)),
      });
    }

    // Detect long conversation pattern
    const longConvs = conversations.filter((c) => c.messages.length >= 10);
    if (longConvs.length >= minSupport) {
      patterns.push({
        id: nanoid(),
        type: 'behavioral',
        description: 'Long conversations (≥10 messages)',
        support: longConvs.length / conversations.length,
        confidence: 0.7,
        elements: [{ type: 'behavior', value: 'long_conversation' }],
        firstSeen: Math.min(...longConvs.map((c) => c.startedAt)),
        lastSeen: Math.max(...longConvs.map((c) => c.startedAt)),
      });
    }

    return patterns;
  }

  /**
   * Calculate trend from timestamps
   */
  private calculateTrend(
    timestamps: number[],
  ): 'increasing' | 'decreasing' | 'stable' {
    if (timestamps.length < 2) return 'stable';

    // Sort timestamps
    const sorted = [...timestamps].sort((a, b) => a - b);

    // Compare first half to second half
    const mid = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, mid);
    const secondHalf = sorted.slice(mid);

    // Calculate average gap in each half
    const avgGapFirst = this.averageGap(firstHalf);
    const avgGapSecond = this.averageGap(secondHalf);

    // If gaps are getting smaller, frequency is increasing
    if (avgGapSecond < avgGapFirst * 0.7) return 'increasing';
    if (avgGapSecond > avgGapFirst * 1.3) return 'decreasing';
    return 'stable';
  }

  /**
   * Calculate average gap between timestamps
   */
  private averageGap(timestamps: number[]): number {
    if (timestamps.length < 2) return Infinity;
    let totalGap = 0;
    for (let i = 1; i < timestamps.length; i++) {
      totalGap += timestamps[i] - timestamps[i - 1];
    }
    return totalGap / (timestamps.length - 1);
  }

  /**
   * Find emerging patterns
   */
  private findEmergingPatterns(patterns: Pattern[]): Pattern[] {
    const now = Date.now();
    const recentThreshold = 7 * 24 * 60 * 60 * 1000; // 7 days

    return patterns
      .filter(
        (p) =>
          p.trend === 'increasing' &&
          p.lastSeen &&
          now - p.lastSeen < recentThreshold,
      )
      .slice(0, 5);
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
}
