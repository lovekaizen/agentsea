/**
 * Funnel Analyzer
 *
 * Analyzes conversion funnels in conversations.
 */

import { EventEmitter } from 'eventemitter3';
import type {
  Conversation,
  FunnelStep,
  FunnelStepResult,
  FunnelAnalysisOptions,
  FunnelAnalysisResult,
  AnalyticsStorageAdapter,
} from '../types/index.js';

/**
 * Funnel analyzer events
 */
export interface FunnelAnalyzerEvents {
  'analysis:complete': (result: FunnelAnalysisResult) => void;
  'step:analyzed': (step: FunnelStepResult) => void;
  error: (error: Error) => void;
}

/**
 * Funnel definition
 */
export interface FunnelDefinition {
  id: string;
  name: string;
  description?: string;
  steps: FunnelStep[];
}

/**
 * FunnelAnalyzer - Analyzes conversion funnels
 */
export class FunnelAnalyzer extends EventEmitter<FunnelAnalyzerEvents> {
  private readonly storage: AnalyticsStorageAdapter;
  private readonly funnels = new Map<string, FunnelDefinition>();

  constructor(storage: AnalyticsStorageAdapter) {
    super();
    this.storage = storage;

    // Register default funnels
    this.registerDefaultFunnels();
  }

  /**
   * Register default funnel definitions
   */
  private registerDefaultFunnels(): void {
    // Basic conversation funnel
    this.registerFunnel({
      id: 'conversation_completion',
      name: 'Conversation Completion',
      description: 'Tracks conversation from start to successful completion',
      steps: [
        {
          name: 'Started',
          condition: () => true, // All conversations start
          description: 'Conversation initiated',
        },
        {
          name: 'First Response',
          condition: (conv) => conv.messages.length >= 2,
          description: 'User received first response',
        },
        {
          name: 'Engaged',
          condition: (conv) => conv.messages.length >= 4,
          description: 'Multiple exchanges occurred',
        },
        {
          name: 'Completed',
          condition: (conv) => conv.status === 'completed',
          description: 'Conversation completed',
        },
        {
          name: 'Successful',
          condition: (conv) => conv.outcome?.success === true,
          description: 'Task successfully resolved',
        },
      ],
    });

    // Tool usage funnel
    this.registerFunnel({
      id: 'tool_usage',
      name: 'Tool Usage Funnel',
      description: 'Tracks tool usage in conversations',
      steps: [
        {
          name: 'Started',
          condition: () => true,
          description: 'Conversation started',
        },
        {
          name: 'Tool Requested',
          condition: (conv) =>
            conv.messages.some(
              (m) => m.role === 'user' && this.hasToolRequest(m.content),
            ),
          description: 'User requested tool functionality',
        },
        {
          name: 'Tool Used',
          condition: (conv) =>
            conv.messages.some((m) => m.toolCalls && m.toolCalls.length > 0),
          description: 'Tool was invoked',
        },
        {
          name: 'Tool Succeeded',
          condition: (conv) =>
            conv.messages.some((m) =>
              m.toolCalls?.some((t) => t.success === true),
            ),
          description: 'Tool execution succeeded',
        },
        {
          name: 'Task Completed',
          condition: (conv) => conv.outcome?.success === true,
          description: 'Task was completed successfully',
        },
      ],
    });

    // Satisfaction funnel
    this.registerFunnel({
      id: 'satisfaction',
      name: 'Satisfaction Funnel',
      description: 'Tracks user satisfaction progression',
      steps: [
        {
          name: 'Started',
          condition: () => true,
          description: 'Conversation started',
        },
        {
          name: 'Not Frustrated',
          condition: (conv) => (conv.sentiment?.score ?? 0) >= -0.2,
          description: 'User not showing frustration',
        },
        {
          name: 'Positive',
          condition: (conv) => (conv.sentiment?.score ?? 0) > 0.2,
          description: 'User sentiment is positive',
        },
        {
          name: 'Satisfied',
          condition: (conv) => (conv.outcome?.satisfaction ?? 0) >= 4,
          description: 'User gave positive feedback',
        },
      ],
    });
  }

  /**
   * Check if message contains tool request
   */
  private hasToolRequest(content: string): boolean {
    const toolKeywords = [
      'calculate',
      'compute',
      'search',
      'find',
      'look up',
      'check',
      'get',
      'fetch',
      'retrieve',
    ];
    const lower = content.toLowerCase();
    return toolKeywords.some((kw) => lower.includes(kw));
  }

  /**
   * Register a funnel definition
   */
  registerFunnel(funnel: FunnelDefinition): void {
    this.funnels.set(funnel.id, funnel);
  }

  /**
   * Remove a funnel
   */
  removeFunnel(funnelId: string): boolean {
    return this.funnels.delete(funnelId);
  }

  /**
   * Get all registered funnels
   */
  getFunnels(): FunnelDefinition[] {
    return Array.from(this.funnels.values());
  }

  /**
   * Get a specific funnel
   */
  getFunnel(funnelId: string): FunnelDefinition | undefined {
    return this.funnels.get(funnelId);
  }

  /**
   * Analyze a funnel
   */
  async analyze(
    funnelId: string,
    options: FunnelAnalysisOptions = {},
  ): Promise<FunnelAnalysisResult> {
    const funnel = this.funnels.get(funnelId);
    if (!funnel) {
      throw new Error(`Funnel not found: ${funnelId}`);
    }

    // Get conversations
    const conversations = await this.getConversations(options);

    if (conversations.length === 0) {
      return {
        steps: [],
        overallConversion: 0,
        totalStarted: 0,
        totalConverted: 0,
      };
    }

    // Analyze each step
    const steps: FunnelStepResult[] = [];
    let previousCount = conversations.length;

    for (let i = 0; i < funnel.steps.length; i++) {
      const step = funnel.steps[i];
      const passedConvs = conversations.filter((c) =>
        this.passesStep(c, funnel.steps, i),
      );
      const count = passedConvs.length;

      const stepResult: FunnelStepResult = {
        name: step.name,
        count,
        conversionRate: previousCount > 0 ? count / previousCount : 0,
        overallConversionRate:
          conversations.length > 0 ? count / conversations.length : 0,
        dropOff: previousCount - count,
        dropOffRate:
          previousCount > 0 ? (previousCount - count) / previousCount : 0,
      };

      steps.push(stepResult);
      this.emit('step:analyzed', stepResult);
      previousCount = count;
    }

    // Find biggest drop-off
    let biggestDropOff: FunnelAnalysisResult['biggestDropOff'];
    if (steps.length > 0) {
      const maxDropOff = steps.reduce(
        (max, step) =>
          step.dropOffRate > (max?.rate ?? 0)
            ? { step: step.name, rate: step.dropOffRate }
            : max,
        undefined as { step: string; rate: number } | undefined,
      );
      biggestDropOff = maxDropOff;
    }

    // Calculate segments if requested
    let segments: Map<string, FunnelStepResult[]> | undefined;
    if (options.segmentBy) {
      segments = this.analyzeSegmented(
        funnel,
        conversations,
        options.segmentBy,
      );
    }

    const lastStep = steps[steps.length - 1];
    const result: FunnelAnalysisResult = {
      steps,
      overallConversion: lastStep?.overallConversionRate ?? 0,
      totalStarted: conversations.length,
      totalConverted: lastStep?.count ?? 0,
      biggestDropOff,
      segments,
    };

    this.emit('analysis:complete', result);
    return result;
  }

  /**
   * Check if conversation passes up to a specific step
   */
  private passesStep(
    conversation: Conversation,
    steps: FunnelStep[],
    upToIndex: number,
  ): boolean {
    for (let i = 0; i <= upToIndex; i++) {
      if (!steps[i].condition(conversation)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get conversations for analysis
   */
  private async getConversations(
    options: FunnelAnalysisOptions,
  ): Promise<Conversation[]> {
    const query: {
      timeRange?: { start: number; end: number };
      filter?: Record<string, unknown>;
    } = {};

    if (options.period) {
      query.timeRange =
        typeof options.period === 'object'
          ? options.period
          : this.periodToTimeRange(options.period as string);
    }

    if (options.filter) {
      query.filter = options.filter;
    }

    const result = await this.storage.queryConversations(query);
    return result.conversations;
  }

  /**
   * Analyze funnel by segments
   */
  private analyzeSegmented(
    funnel: FunnelDefinition,
    conversations: Conversation[],
    segmentBy: string,
  ): Map<string, FunnelStepResult[]> {
    const segments = new Map<string, Conversation[]>();

    // Group conversations by segment
    for (const conv of conversations) {
      const segmentValue = this.getSegmentValue(conv, segmentBy);
      const existing = segments.get(segmentValue) ?? [];
      existing.push(conv);
      segments.set(segmentValue, existing);
    }

    // Analyze each segment
    const results = new Map<string, FunnelStepResult[]>();
    for (const [segment, convs] of segments) {
      const steps: FunnelStepResult[] = [];
      let previousCount = convs.length;

      for (let i = 0; i < funnel.steps.length; i++) {
        const passedConvs = convs.filter((c) =>
          this.passesStep(c, funnel.steps, i),
        );
        const count = passedConvs.length;

        steps.push({
          name: funnel.steps[i].name,
          count,
          conversionRate: previousCount > 0 ? count / previousCount : 0,
          overallConversionRate: convs.length > 0 ? count / convs.length : 0,
          dropOff: previousCount - count,
          dropOffRate:
            previousCount > 0 ? (previousCount - count) / previousCount : 0,
        });

        previousCount = count;
      }

      results.set(segment, steps);
    }

    return results;
  }

  /**
   * Get segment value from conversation
   */
  private getSegmentValue(
    conversation: Conversation,
    segmentBy: string,
  ): string {
    switch (segmentBy) {
      case 'intent':
        return conversation.intent?.primary ?? 'unknown';
      case 'topic':
        return conversation.topics?.[0] ?? 'unknown';
      case 'userId':
        return conversation.userId ?? 'anonymous';
      default:
        return String(conversation.metadata?.[segmentBy] ?? 'unknown');
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

  /**
   * Compare two funnel results
   */
  compareFunnels(
    resultA: FunnelAnalysisResult,
    resultB: FunnelAnalysisResult,
  ): {
    overallDiff: number;
    stepComparisons: Array<{
      step: string;
      conversionDiff: number;
      dropOffDiff: number;
    }>;
  } {
    const stepComparisons: Array<{
      step: string;
      conversionDiff: number;
      dropOffDiff: number;
    }> = [];

    const maxSteps = Math.max(resultA.steps.length, resultB.steps.length);
    for (let i = 0; i < maxSteps; i++) {
      const stepA = resultA.steps[i];
      const stepB = resultB.steps[i];

      if (stepA && stepB) {
        stepComparisons.push({
          step: stepA.name,
          conversionDiff: stepB.conversionRate - stepA.conversionRate,
          dropOffDiff: stepB.dropOffRate - stepA.dropOffRate,
        });
      }
    }

    return {
      overallDiff: resultB.overallConversion - resultA.overallConversion,
      stepComparisons,
    };
  }

  /**
   * Get funnel visualization data
   */
  getVisualizationData(result: FunnelAnalysisResult): {
    labels: string[];
    values: number[];
    percentages: number[];
    colors: string[];
  } {
    const labels = result.steps.map((s) => s.name);
    const values = result.steps.map((s) => s.count);
    const percentages = result.steps.map((s) => s.overallConversionRate * 100);

    // Generate gradient colors from green to red based on drop-off
    const colors = result.steps.map((s) => {
      const rate = s.overallConversionRate;
      if (rate >= 0.8) return '#22c55e'; // Green
      if (rate >= 0.6) return '#84cc16'; // Lime
      if (rate >= 0.4) return '#eab308'; // Yellow
      if (rate >= 0.2) return '#f97316'; // Orange
      return '#ef4444'; // Red
    });

    return { labels, values, percentages, colors };
  }
}
