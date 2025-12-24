/**
 * Flow Analyzer
 *
 * Analyzes conversation flow patterns.
 */

import { EventEmitter } from 'eventemitter3';
import { nanoid } from 'nanoid';
import type {
  Conversation,
  FlowPattern,
  FlowStep,
  FlowStepType,
  FlowAnalysisOptions,
  FlowAnalysisResult,
  AnalyticsStorageAdapter,
  ConversationQuery,
} from '../types/index.js';

/**
 * Flow analyzer events
 */
export interface FlowAnalyzerEvents {
  'analysis:complete': (result: FlowAnalysisResult) => void;
  'pattern:found': (pattern: FlowPattern) => void;
  error: (error: Error) => void;
}

/**
 * Default analysis options
 */
const DEFAULT_OPTIONS: FlowAnalysisOptions = {
  minSupport: 0.05,
  maxLength: 10,
  includeIntents: true,
  includeTopics: false,
};

/**
 * FlowAnalyzer - Analyzes conversation flow patterns
 */
export class FlowAnalyzer extends EventEmitter<FlowAnalyzerEvents> {
  private readonly storage: AnalyticsStorageAdapter;

  constructor(storage: AnalyticsStorageAdapter) {
    super();
    this.storage = storage;
  }

  /**
   * Analyze conversation flows
   */
  async analyze(
    options: FlowAnalysisOptions = {},
  ): Promise<FlowAnalysisResult> {
    const startTime = Date.now();
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Get conversations
    const conversations = await this.getConversations(opts);

    if (conversations.length === 0) {
      return {
        patterns: [],
        totalConversations: 0,
        metadata: {
          options: opts,
          executedAt: startTime,
          durationMs: Date.now() - startTime,
        },
      };
    }

    // Extract flows from conversations
    const flows = conversations.map((conv) => this.extractFlow(conv, opts));

    // Find patterns
    const patterns = this.findPatterns(flows, opts);

    // Calculate metrics for each pattern
    const enrichedPatterns = patterns.map((pattern) => {
      const matchingConvs = this.getMatchingConversations(
        conversations,
        pattern.steps,
        opts,
      );
      const successCount = matchingConvs.filter(
        (c) => c.outcome?.success,
      ).length;

      return {
        ...pattern,
        count: matchingConvs.length,
        frequency: matchingConvs.length / conversations.length,
        successRate:
          matchingConvs.length > 0 ? successCount / matchingConvs.length : 0,
        avgDurationMs: this.calculateAvgDuration(matchingConvs),
        avgSatisfaction: this.calculateAvgSatisfaction(matchingConvs),
      };
    });

    // Sort by frequency
    enrichedPatterns.sort((a, b) => b.frequency - a.frequency);

    // Emit events for patterns
    for (const pattern of enrichedPatterns) {
      this.emit('pattern:found', pattern);
    }

    const result: FlowAnalysisResult = {
      patterns: enrichedPatterns,
      totalConversations: conversations.length,
      mostCommonFlow: enrichedPatterns[0],
      mostSuccessfulFlow: this.findMostSuccessful(enrichedPatterns),
      fastestFlow: this.findFastest(enrichedPatterns),
      metadata: {
        options: opts,
        executedAt: startTime,
        durationMs: Date.now() - startTime,
      },
    };

    this.emit('analysis:complete', result);
    return result;
  }

  /**
   * Get conversations for analysis
   */
  private async getConversations(
    options: FlowAnalysisOptions,
  ): Promise<Conversation[]> {
    const query: ConversationQuery = {};

    if (options.period) {
      query.timeRange =
        typeof options.period === 'object'
          ? options.period
          : this.periodToTimeRange(options.period);
    }

    if (options.intent) {
      query.intent = options.intent;
    }

    if (options.outcome) {
      query.outcome = options.outcome === 'success';
    }

    const result = await this.storage.queryConversations(query);
    return result.conversations;
  }

  /**
   * Extract flow from a conversation
   */
  private extractFlow(
    conversation: Conversation,
    options: FlowAnalysisOptions,
  ): FlowStep[] {
    const steps: FlowStep[] = [];

    // Add start step
    steps.push({
      type: 'start',
      name: 'Start',
    });

    let lastIntent: string | undefined;

    for (const message of conversation.messages) {
      // Add message step
      const stepType: FlowStepType =
        message.role === 'user' ? 'user_message' : 'assistant_message';

      const step: FlowStep = {
        type: stepType,
        name: `${message.role}_message`,
      };

      steps.push(step);

      // Track intent changes
      if (options.includeIntents && conversation.intent) {
        if (lastIntent && lastIntent !== conversation.intent.primary) {
          steps.push({
            type: 'intent_change',
            name: 'Intent Change',
            intent: conversation.intent.primary,
          });
        }
        lastIntent = conversation.intent.primary;
      }

      // Add tool call steps
      if (message.toolCalls) {
        for (const toolCall of message.toolCalls) {
          steps.push({
            type: 'tool_call',
            name: toolCall.name,
          });
        }
      }
    }

    // Add end step based on status
    if (conversation.status === 'escalated') {
      steps.push({
        type: 'escalation',
        name: 'Escalated',
      });
    }

    steps.push({
      type: 'end',
      name: conversation.outcome?.success ? 'Success' : 'End',
    });

    return steps;
  }

  /**
   * Find patterns in flows
   */
  private findPatterns(
    flows: FlowStep[][],
    options: FlowAnalysisOptions,
  ): FlowPattern[] {
    const patternCounts = new Map<
      string,
      { steps: FlowStep[]; count: number }
    >();
    const minCount = Math.max(
      1,
      Math.floor(flows.length * (options.minSupport ?? 0.05)),
    );

    // Count subsequences
    for (const flow of flows) {
      // Generate subsequences up to maxLength
      for (
        let len = 2;
        len <= Math.min(flow.length, options.maxLength ?? 10);
        len++
      ) {
        for (let i = 0; i <= flow.length - len; i++) {
          const subsequence = flow.slice(i, i + len);
          const key = this.stepsToKey(subsequence);

          const existing = patternCounts.get(key);
          if (existing) {
            existing.count++;
          } else {
            patternCounts.set(key, { steps: subsequence, count: 1 });
          }
        }
      }
    }

    // Filter by minimum support
    const patterns: FlowPattern[] = [];
    for (const [, data] of patternCounts) {
      if (data.count >= minCount) {
        patterns.push({
          id: nanoid(),
          steps: data.steps,
          frequency: data.count / flows.length,
          count: data.count,
          successRate: 0, // Will be calculated later
          avgDurationMs: 0, // Will be calculated later
        });
      }
    }

    return patterns;
  }

  /**
   * Convert steps to a unique key
   */
  private stepsToKey(steps: FlowStep[]): string {
    return steps.map((s) => `${s.type}:${s.name}`).join('|');
  }

  /**
   * Get conversations matching a pattern
   */
  private getMatchingConversations(
    conversations: Conversation[],
    pattern: FlowStep[],
    options: FlowAnalysisOptions,
  ): Conversation[] {
    const patternKey = this.stepsToKey(pattern);

    return conversations.filter((conv) => {
      const flow = this.extractFlow(conv, options);
      const flowKey = this.stepsToKey(flow);
      return flowKey.includes(patternKey);
    });
  }

  /**
   * Calculate average duration
   */
  private calculateAvgDuration(conversations: Conversation[]): number {
    const durations = conversations
      .filter((c) => c.endedAt)
      .map((c) => c.endedAt! - c.startedAt);

    if (durations.length === 0) return 0;
    return durations.reduce((a, b) => a + b, 0) / durations.length;
  }

  /**
   * Calculate average satisfaction
   */
  private calculateAvgSatisfaction(
    conversations: Conversation[],
  ): number | undefined {
    const satisfactions = conversations
      .filter((c) => c.outcome?.satisfaction !== undefined)
      .map((c) => c.outcome!.satisfaction!);

    if (satisfactions.length === 0) return undefined;
    return satisfactions.reduce((a, b) => a + b, 0) / satisfactions.length;
  }

  /**
   * Find most successful pattern
   */
  private findMostSuccessful(patterns: FlowPattern[]): FlowPattern | undefined {
    const successful = patterns.filter((p) => p.count >= 5); // Need minimum sample
    if (successful.length === 0) return patterns[0];
    return successful.reduce((best, current) =>
      current.successRate > best.successRate ? current : best,
    );
  }

  /**
   * Find fastest pattern
   */
  private findFastest(patterns: FlowPattern[]): FlowPattern | undefined {
    const withDuration = patterns.filter((p) => p.avgDurationMs > 0);
    if (withDuration.length === 0) return undefined;
    return withDuration.reduce((best, current) =>
      current.avgDurationMs < best.avgDurationMs ? current : best,
    );
  }

  /**
   * Convert period to time range
   */
  private periodToTimeRange(period: string): { start: number; end: number } {
    const now = Date.now();
    const periods: Record<string, number> = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
    };

    return {
      start: now - (periods[period] ?? periods.week),
      end: now,
    };
  }

  /**
   * Compare two flows
   */
  compareFlows(
    flowA: FlowPattern,
    flowB: FlowPattern,
  ): {
    similarity: number;
    differences: Array<{
      position: number;
      stepA?: FlowStep;
      stepB?: FlowStep;
    }>;
  } {
    const differences: Array<{
      position: number;
      stepA?: FlowStep;
      stepB?: FlowStep;
    }> = [];

    const maxLen = Math.max(flowA.steps.length, flowB.steps.length);
    let matches = 0;

    for (let i = 0; i < maxLen; i++) {
      const stepA = flowA.steps[i];
      const stepB = flowB.steps[i];

      if (!stepA || !stepB) {
        differences.push({ position: i, stepA, stepB });
      } else if (stepA.type !== stepB.type || stepA.name !== stepB.name) {
        differences.push({ position: i, stepA, stepB });
      } else {
        matches++;
      }
    }

    return {
      similarity: maxLen > 0 ? matches / maxLen : 0,
      differences,
    };
  }
}
