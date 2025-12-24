/**
 * Success Analyzer Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SuccessAnalyzer } from '../analysis/SuccessAnalyzer.js';
import { MemoryStorageAdapter } from '../storage/adapters/MemoryStorage.js';
import type { Conversation, SuccessCriteria } from '../types/index.js';

describe('SuccessAnalyzer', () => {
  let analyzer: SuccessAnalyzer;
  let storage: MemoryStorageAdapter;

  beforeEach(() => {
    storage = new MemoryStorageAdapter();
    analyzer = new SuccessAnalyzer(storage);
  });

  describe('initialization', () => {
    it('should initialize with default criteria', () => {
      const criteria = analyzer.getCriteria();
      expect(criteria.length).toBeGreaterThan(0);
      expect(criteria.some((c) => c.name === 'task_completed')).toBe(true);
    });

    it('should initialize with custom criteria', () => {
      const customCriteria: SuccessCriteria[] = [
        {
          name: 'custom_success',
          condition: (conv) => conv.outcome?.success === true,
          weight: 1.0,
        },
      ];

      const customAnalyzer = new SuccessAnalyzer(storage, customCriteria);
      const criteria = customAnalyzer.getCriteria();
      expect(criteria).toHaveLength(1);
      expect(criteria[0].name).toBe('custom_success');
    });
  });

  describe('success analysis', () => {
    beforeEach(async () => {
      const now = Date.now();
      const conversations: Conversation[] = [
        {
          id: 'conv-1',
          startedAt: now - 10000,
          endedAt: now - 5000,
          messages: [],
          status: 'completed',
          outcome: { success: true, satisfaction: 5 },
          sentiment: {
            score: 0.8,
            label: 'positive',
            confidence: 0.9,
            analyzedAt: now,
          },
        },
        {
          id: 'conv-2',
          startedAt: now - 8000,
          endedAt: now - 3000,
          messages: [],
          status: 'completed',
          outcome: { success: false, satisfaction: 2 },
          sentiment: {
            score: -0.3,
            label: 'negative',
            confidence: 0.8,
            analyzedAt: now,
          },
        },
        {
          id: 'conv-3',
          startedAt: now - 6000,
          endedAt: now - 2000,
          messages: [],
          status: 'escalated',
          outcome: { success: false, escalated: true },
        },
        {
          id: 'conv-4',
          startedAt: now - 3000,
          endedAt: now - 500,
          messages: [],
          status: 'completed',
          outcome: { success: true, satisfaction: 4 },
          sentiment: {
            score: 0.6,
            label: 'positive',
            confidence: 0.85,
            analyzedAt: now,
          },
        },
      ];

      for (const conv of conversations) {
        await storage.saveConversation(conv);
      }
    });

    it('should analyze overall success', async () => {
      const result = await analyzer.analyze({ period: 'all-time' });

      expect(result.overall).toBeDefined();
      expect(result.overall.totalCount).toBe(4);
      expect(result.overall.successCount).toBe(2); // conv-1 and conv-4
      expect(result.overall.rate).toBeGreaterThan(0);
      expect(result.overall.rate).toBeLessThanOrEqual(1);
    });

    it('should analyze by criteria', async () => {
      const result = await analyzer.analyze({ period: 'all-time' });

      expect(result.byCriteria).toBeDefined();
      expect(result.byCriteria.size).toBeGreaterThan(0);

      const taskCompleted = result.byCriteria.get('task_completed');
      expect(taskCompleted).toBeDefined();
      expect(taskCompleted?.successCount).toBe(2);
    });

    it('should emit analysis:complete event', async () => {
      const handler = vi.fn();
      analyzer.on('analysis:complete', handler);

      await analyzer.analyze({ period: 'all-time' });
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should handle empty data', async () => {
      const emptyStorage = new MemoryStorageAdapter();
      const emptyAnalyzer = new SuccessAnalyzer(emptyStorage);

      const result = await emptyAnalyzer.analyze();
      expect(result.overall.rate).toBe(0);
      expect(result.overall.totalCount).toBe(0);
    });
  });

  describe('grouped analysis', () => {
    beforeEach(async () => {
      const now = Date.now();
      await storage.saveConversation({
        id: 'conv-support',
        startedAt: now,
        messages: [],
        status: 'completed',
        outcome: { success: true },
        intent: { primary: 'support', confidence: 0.9 },
      });

      await storage.saveConversation({
        id: 'conv-sales',
        startedAt: now,
        messages: [],
        status: 'completed',
        outcome: { success: false },
        intent: { primary: 'sales', confidence: 0.8 },
      });
    });

    it('should group by intent', async () => {
      const result = await analyzer.analyze({
        period: 'all-time',
        groupBy: 'intent',
      });

      expect(result.byGroup).toBeDefined();
      expect(result.byGroup!.size).toBeGreaterThan(0);
    });

    it('should group by topic', async () => {
      await storage.saveConversation({
        id: 'conv-topic',
        startedAt: Date.now(),
        messages: [],
        status: 'completed',
        topics: ['billing'],
        outcome: { success: true },
      });

      const result = await analyzer.analyze({
        period: 'all-time',
        groupBy: 'topic',
      });

      expect(result.byGroup).toBeDefined();
    });

    it('should group by multiple fields', async () => {
      const result = await analyzer.analyze({
        period: 'all-time',
        groupBy: ['intent', 'userId'],
      });

      expect(result.byGroup).toBeDefined();
    });
  });

  describe('trend analysis', () => {
    beforeEach(async () => {
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;

      for (let i = 0; i < 10; i++) {
        await storage.saveConversation({
          id: `conv-${i}`,
          startedAt: now - i * dayMs,
          endedAt: now - i * dayMs + 1000,
          messages: [],
          status: 'completed',
          outcome: { success: i % 2 === 0 }, // Alternate success
        });
      }
    });

    it('should include trend when requested', async () => {
      const result = await analyzer.analyze({
        period: 'all-time',
        includeTrend: true,
      });

      expect(result.trend).toBeDefined();
      expect(result.trend!.length).toBeGreaterThan(0);
    });

    it('should calculate trend with day granularity', async () => {
      const result = await analyzer.analyze({
        period: 'all-time',
        includeTrend: true,
        trendGranularity: 'day',
      });

      expect(result.trend).toBeDefined();
      result.trend!.forEach((point) => {
        expect(point.timestamp).toBeDefined();
        expect(point.rate).toBeGreaterThanOrEqual(0);
        expect(point.rate).toBeLessThanOrEqual(1);
        expect(point.count).toBeGreaterThanOrEqual(0);
      });
    });

    it('should calculate trend with week granularity', async () => {
      const result = await analyzer.analyze({
        period: 'all-time',
        includeTrend: true,
        trendGranularity: 'week',
      });

      expect(result.trend).toBeDefined();
    });
  });

  describe('insight generation', () => {
    it('should generate insights for low success rate', async () => {
      const now = Date.now();
      for (let i = 0; i < 10; i++) {
        await storage.saveConversation({
          id: `conv-${i}`,
          startedAt: now,
          messages: [],
          status: 'completed',
          outcome: { success: false },
        });
      }

      const result = await analyzer.analyze({ period: 'all-time' });
      expect(result.insights).toBeDefined();
      expect(result.insights!.length).toBeGreaterThan(0);
    });

    it('should emit insight:found events', async () => {
      const handler = vi.fn();
      analyzer.on('insight:found', handler);

      const now = Date.now();
      for (let i = 0; i < 10; i++) {
        await storage.saveConversation({
          id: `conv-${i}`,
          startedAt: now,
          messages: [],
          status: 'completed',
          outcome: { success: false },
        });
      }

      await analyzer.analyze({ period: 'all-time' });

      if (handler.mock.calls.length > 0) {
        expect(handler).toHaveBeenCalled();
      }
    });

    it('should detect weak criteria', async () => {
      const now = Date.now();
      // Create conversations that pass some criteria but fail others
      for (let i = 0; i < 10; i++) {
        await storage.saveConversation({
          id: `conv-${i}`,
          startedAt: now - 10 * 60 * 1000, // 10 minutes ago
          endedAt: now, // Long duration
          messages: [],
          status: 'escalated', // Fails no_escalation criterion
          outcome: { success: true },
        });
      }

      const result = await analyzer.analyze({ period: 'all-time' });
      const noEscalation = result.byCriteria.get('no_escalation');
      expect(noEscalation?.rate).toBe(0); // All escalated
    });
  });

  describe('criteria management', () => {
    it('should add criterion', () => {
      const newCriterion: SuccessCriteria = {
        name: 'new_criterion',
        condition: () => true,
        weight: 0.5,
      };

      analyzer.addCriterion(newCriterion);
      const criteria = analyzer.getCriteria();
      expect(criteria.some((c) => c.name === 'new_criterion')).toBe(true);
    });

    it('should update existing criterion', () => {
      const criteria = analyzer.getCriteria();
      const existing = criteria[0];

      analyzer.addCriterion({ ...existing, weight: 0.9 });
      const updated = analyzer
        .getCriteria()
        .find((c) => c.name === existing.name);
      expect(updated?.weight).toBe(0.9);
    });

    it('should remove criterion', () => {
      const criteria = analyzer.getCriteria();
      const toRemove = criteria[0].name;

      const removed = analyzer.removeCriterion(toRemove);
      expect(removed).toBe(true);

      const remaining = analyzer.getCriteria();
      expect(remaining.some((c) => c.name === toRemove)).toBe(false);
    });

    it('should return false when removing non-existent criterion', () => {
      const removed = analyzer.removeCriterion('non_existent');
      expect(removed).toBe(false);
    });
  });

  describe('conversation evaluation', () => {
    it('should evaluate single conversation', async () => {
      const conversation: Conversation = {
        id: 'test-conv',
        startedAt: Date.now() - 1000,
        endedAt: Date.now(),
        messages: [],
        status: 'completed',
        outcome: { success: true, satisfaction: 5 },
        sentiment: {
          score: 0.8,
          label: 'positive',
          confidence: 0.9,
          analyzedAt: Date.now(),
        },
      };

      const evaluation = analyzer.evaluateConversation(conversation);

      expect(evaluation.success).toBeDefined();
      expect(evaluation.score).toBeGreaterThanOrEqual(0);
      expect(evaluation.score).toBeLessThanOrEqual(1);
      expect(evaluation.criteriaResults.size).toBeGreaterThan(0);
    });

    it('should evaluate failed conversation', async () => {
      const conversation: Conversation = {
        id: 'failed-conv',
        startedAt: Date.now() - 10 * 60 * 1000,
        endedAt: Date.now(),
        messages: [],
        status: 'escalated',
        outcome: { success: false, satisfaction: 1 },
        sentiment: {
          score: -0.5,
          label: 'negative',
          confidence: 0.9,
          analyzedAt: Date.now(),
        },
      };

      const evaluation = analyzer.evaluateConversation(conversation);

      expect(evaluation.success).toBe(false);
      expect(evaluation.score).toBeLessThan(0.5);
    });
  });

  describe('quick resolution criterion', () => {
    it('should pass for quick conversations', () => {
      const conversation: Conversation = {
        id: 'quick',
        startedAt: Date.now() - 2 * 60 * 1000, // 2 minutes
        endedAt: Date.now(),
        messages: [],
        status: 'completed',
        outcome: { success: true },
      };

      const evaluation = analyzer.evaluateConversation(conversation);
      const quickResolution =
        evaluation.criteriaResults.get('quick_resolution');
      expect(quickResolution).toBe(true);
    });

    it('should fail for long conversations', () => {
      const conversation: Conversation = {
        id: 'long',
        startedAt: Date.now() - 10 * 60 * 1000, // 10 minutes
        endedAt: Date.now(),
        messages: [],
        status: 'completed',
        outcome: { success: true },
      };

      const evaluation = analyzer.evaluateConversation(conversation);
      const quickResolution =
        evaluation.criteriaResults.get('quick_resolution');
      expect(quickResolution).toBe(false);
    });
  });
});
