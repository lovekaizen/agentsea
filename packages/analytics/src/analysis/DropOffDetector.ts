/**
 * Drop-Off Detector
 *
 * Detects where users drop off during conversations.
 */

import { EventEmitter } from 'eventemitter3';
import { nanoid } from 'nanoid';
import type {
  Conversation,
  DropOffPoint,
  DropOffDetectionOptions,
  DropOffDetectionResult,
  AnalyticsStorageAdapter,
} from '../types/index.js';

/**
 * Drop-off detector events
 */
export interface DropOffDetectorEvents {
  'detection:complete': (result: DropOffDetectionResult) => void;
  'dropoff:found': (point: DropOffPoint) => void;
  error: (error: Error) => void;
}

/**
 * Default detection options
 */
const DEFAULT_OPTIONS: DropOffDetectionOptions = {
  threshold: 0.1,
  minConversations: 10,
  includeAnalysis: true,
};

/**
 * Stage definition
 */
interface Stage {
  name: string;
  messageIndex: number;
  type: 'user' | 'assistant' | 'tool' | 'end';
}

/**
 * DropOffDetector - Detects conversation drop-offs
 */
export class DropOffDetector extends EventEmitter<DropOffDetectorEvents> {
  private readonly storage: AnalyticsStorageAdapter;

  constructor(storage: AnalyticsStorageAdapter) {
    super();
    this.storage = storage;
  }

  /**
   * Detect drop-off points
   */
  async detect(
    options: DropOffDetectionOptions = {},
  ): Promise<DropOffDetectionResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Get conversations
    const conversations = await this.getConversations(opts);

    if (conversations.length < (opts.minConversations ?? 10)) {
      return {
        dropOffPoints: [],
        completionRate: 0,
        totalConversations: conversations.length,
      };
    }

    // Analyze stages
    const stageAnalysis = this.analyzeStages(conversations);

    // Find drop-off points
    const dropOffPoints = this.findDropOffPoints(
      stageAnalysis,
      conversations.length,
      opts,
    );

    // Calculate completion rate
    const completedCount = conversations.filter(
      (c) => c.status === 'completed' && c.outcome?.success,
    ).length;
    const completionRate = completedCount / conversations.length;

    // Analyze top reasons if requested
    let topReasons: DropOffDetectionResult['topReasons'];
    if (opts.includeAnalysis) {
      topReasons = this.analyzeDropOffReasons(conversations, dropOffPoints);
    }

    const result: DropOffDetectionResult = {
      dropOffPoints,
      completionRate,
      totalConversations: conversations.length,
      topReasons,
    };

    // Emit events
    for (const point of dropOffPoints) {
      this.emit('dropoff:found', point);
    }
    this.emit('detection:complete', result);

    return result;
  }

  /**
   * Get conversations for analysis
   */
  private async getConversations(
    options: DropOffDetectionOptions,
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
   * Analyze conversation stages
   */
  private analyzeStages(
    conversations: Conversation[],
  ): Map<string, { total: number; completed: number }> {
    const stages = new Map<string, { total: number; completed: number }>();

    for (const conv of conversations) {
      const convStages = this.getConversationStages(conv);
      const wasCompleted = conv.status === 'completed' && conv.outcome?.success;

      for (const stage of convStages) {
        const existing = stages.get(stage.name) ?? { total: 0, completed: 0 };
        existing.total++;
        if (wasCompleted) {
          existing.completed++;
        }
        stages.set(stage.name, existing);
      }
    }

    return stages;
  }

  /**
   * Get stages from a conversation
   */
  private getConversationStages(conversation: Conversation): Stage[] {
    const stages: Stage[] = [];
    let messageIndex = 0;

    // Add entry stage
    stages.push({
      name: 'conversation_start',
      messageIndex: 0,
      type: 'user',
    });

    for (const message of conversation.messages) {
      messageIndex++;
      const stageName = `message_${messageIndex}_${message.role}`;

      stages.push({
        name: stageName,
        messageIndex,
        type: message.role as 'user' | 'assistant',
      });

      // Add tool stages
      if (message.toolCalls) {
        for (const tool of message.toolCalls) {
          stages.push({
            name: `tool_${tool.name}`,
            messageIndex,
            type: 'tool',
          });
        }
      }
    }

    // Add status-based stage
    stages.push({
      name: `end_${conversation.status}`,
      messageIndex: messageIndex + 1,
      type: 'end',
    });

    return stages;
  }

  /**
   * Find drop-off points from stage analysis
   */
  private findDropOffPoints(
    stageAnalysis: Map<string, { total: number; completed: number }>,
    totalConversations: number,
    options: DropOffDetectionOptions,
  ): DropOffPoint[] {
    const dropOffPoints: DropOffPoint[] = [];
    const threshold = options.threshold ?? 0.1;

    // Group by message index for sequential analysis
    const sequentialStages = this.getSequentialStages(stageAnalysis);

    let previousCount = totalConversations;

    for (let i = 0; i < sequentialStages.length; i++) {
      const stage = sequentialStages[i];
      const stageData = stageAnalysis.get(stage.name);
      if (!stageData) continue;

      const currentCount = stageData.total;
      const dropOffCount = previousCount - currentCount;
      const dropOffRate = previousCount > 0 ? dropOffCount / previousCount : 0;

      if (dropOffRate >= threshold) {
        // Determine severity
        let severity: DropOffPoint['severity'];
        if (dropOffRate >= 0.5) {
          severity = 'critical';
        } else if (dropOffRate >= 0.3) {
          severity = 'high';
        } else if (dropOffRate >= 0.2) {
          severity = 'medium';
        } else {
          severity = 'low';
        }

        // Get preceding patterns
        const precedingPatterns = sequentialStages
          .slice(Math.max(0, i - 3), i)
          .map((s) => s.name);

        const point: DropOffPoint = {
          id: nanoid(),
          description: `Drop-off at ${stage.name}`,
          stage: stage.name,
          dropOffRate,
          count: dropOffCount,
          precedingPatterns,
          severity,
          likelyCause: this.inferCause(stage.name, dropOffRate),
          recommendations: this.getRecommendations(stage.name, dropOffRate),
        };

        dropOffPoints.push(point);
      }

      previousCount = currentCount;
    }

    // Sort by drop-off rate
    dropOffPoints.sort((a, b) => b.dropOffRate - a.dropOffRate);

    return dropOffPoints;
  }

  /**
   * Get sequential stages for analysis
   */
  private getSequentialStages(
    stageAnalysis: Map<string, { total: number; completed: number }>,
  ): Array<{ name: string; index: number }> {
    const stages: Array<{ name: string; index: number }> = [];

    for (const name of stageAnalysis.keys()) {
      const match = name.match(/message_(\d+)_/);
      const index = match ? parseInt(match[1], 10) : 0;
      stages.push({ name, index });
    }

    stages.sort((a, b) => a.index - b.index);
    return stages;
  }

  /**
   * Infer likely cause of drop-off
   */
  private inferCause(stageName: string, dropOffRate: number): string {
    if (stageName.includes('tool_')) {
      return 'Tool execution may be failing or taking too long';
    }
    if (stageName.includes('message_1_')) {
      return 'Users may not be getting helpful initial responses';
    }
    if (stageName.includes('message_') && dropOffRate > 0.3) {
      return 'Response quality or relevance may be low';
    }
    if (stageName.includes('end_abandoned')) {
      return 'Users are abandoning before completion';
    }
    if (stageName.includes('end_escalated')) {
      return 'Issues are requiring human escalation';
    }
    return 'Users are leaving at this stage';
  }

  /**
   * Get recommendations for a drop-off point
   */
  private getRecommendations(stageName: string, dropOffRate: number): string[] {
    const recommendations: string[] = [];

    if (stageName.includes('tool_')) {
      recommendations.push('Review tool reliability and response times');
      recommendations.push('Add fallback options when tools fail');
    }

    if (stageName.includes('message_1_')) {
      recommendations.push('Improve initial response quality');
      recommendations.push(
        'Ensure first response directly addresses user need',
      );
    }

    if (dropOffRate > 0.3) {
      recommendations.push('Analyze conversation content at this stage');
      recommendations.push('Consider adding proactive assistance');
    }

    if (dropOffRate > 0.5) {
      recommendations.push(
        'This is a critical drop-off point - prioritize fixing',
      );
      recommendations.push('Review user feedback for this stage');
    }

    return recommendations;
  }

  /**
   * Analyze drop-off reasons
   */
  private analyzeDropOffReasons(
    conversations: Conversation[],
    dropOffPoints: DropOffPoint[],
  ): Array<{ reason: string; count: number; percentage: number }> {
    const reasons = new Map<string, number>();

    // Count conversations by end status
    const abandoned = conversations.filter(
      (c) => c.status === 'abandoned',
    ).length;
    const escalated = conversations.filter(
      (c) => c.status === 'escalated',
    ).length;
    const failed = conversations.filter(
      (c) => c.status === 'completed' && !c.outcome?.success,
    ).length;

    if (abandoned > 0) {
      reasons.set('User abandoned conversation', abandoned);
    }
    if (escalated > 0) {
      reasons.set('Required human escalation', escalated);
    }
    if (failed > 0) {
      reasons.set('Task not completed successfully', failed);
    }

    // Add reasons from drop-off points
    for (const point of dropOffPoints.slice(0, 3)) {
      if (point.likelyCause) {
        reasons.set(
          point.likelyCause,
          (reasons.get(point.likelyCause) ?? 0) + point.count,
        );
      }
    }

    const total = conversations.length;
    return Array.from(reasons.entries())
      .map(([reason, count]) => ({
        reason,
        count,
        percentage: count / total,
      }))
      .sort((a, b) => b.count - a.count);
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
   * Detect drop-offs for a specific conversation
   */
  async detectForConversation(conversationId: string): Promise<{
    completed: boolean;
    lastStage: string;
    dropOffRisk: 'low' | 'medium' | 'high';
    recommendation?: string;
  }> {
    const conversation = await this.storage.getConversation(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    const stages = this.getConversationStages(conversation);
    const lastStage = stages[stages.length - 1];
    const completed =
      conversation.status === 'completed' &&
      (conversation.outcome?.success ?? false);

    // Calculate risk based on message count and status
    let dropOffRisk: 'low' | 'medium' | 'high' = 'low';
    if (conversation.messages.length <= 2) {
      dropOffRisk = 'high';
    } else if (conversation.status === 'active') {
      dropOffRisk = 'medium';
    }

    return {
      completed,
      lastStage: lastStage.name,
      dropOffRisk,
      recommendation:
        dropOffRisk === 'high' ? 'Consider proactive engagement' : undefined,
    };
  }
}
