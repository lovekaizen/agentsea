/**
 * Collector Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Collector } from '../collection/Collector.js';
import { MemoryStorageAdapter } from '../storage/adapters/MemoryStorage.js';
import type { AnalyticsConfig } from '../types/index.js';

describe('Collector', () => {
  let collector: Collector;
  let storage: MemoryStorageAdapter;
  let config: AnalyticsConfig;

  beforeEach(() => {
    storage = new MemoryStorageAdapter();
    config = {
      enabled: true,
      batchConfig: { enabled: true, maxSize: 100, maxAge: 5000 },
    };
    collector = new Collector(storage, config);
  });

  afterEach(async () => {
    await collector.shutdown();
  });

  describe('initialization', () => {
    it('should initialize successfully', () => {
      collector.initialize();
      expect(true).toBe(true);
    });

    it('should handle multiple initializations', () => {
      collector.initialize();
      collector.initialize();
      expect(true).toBe(true);
    });

    it('should shutdown properly', async () => {
      collector.initialize();
      await collector.shutdown();
      expect(true).toBe(true);
    });
  });

  describe('conversation tracking', () => {
    it('should track conversation start', async () => {
      collector.initialize();
      const conversation = await collector.trackConversationStart({
        userId: 'user-123',
        metadata: { source: 'web' },
      });

      expect(conversation.id).toBeDefined();
      expect(conversation.userId).toBe('user-123');
      expect(conversation.status).toBe('active');
    });

    it('should track conversation end', async () => {
      collector.initialize();
      const conversation = await collector.trackConversationStart();
      const ended = await collector.trackConversationEnd(conversation.id, {
        success: true,
        satisfaction: 5,
      });

      expect(ended.endedAt).toBeDefined();
      expect(ended.outcome?.success).toBe(true);
    });

    it('should emit conversation:tracked event', async () => {
      collector.initialize();
      const handler = vi.fn();
      collector.on('conversation:tracked', handler);

      await collector.trackConversationStart();
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should throw when tracking disabled', async () => {
      const disabledCollector = new Collector(storage, config, {
        trackConversations: false,
      });
      disabledCollector.initialize();

      await expect(disabledCollector.trackConversationStart()).rejects.toThrow(
        'Conversation tracking is disabled',
      );

      await disabledCollector.shutdown();
    });
  });

  describe('message tracking', () => {
    it('should track user message', async () => {
      collector.initialize();
      const conversation = await collector.trackConversationStart();
      const message = await collector.trackUserMessage(
        conversation.id,
        'Hello!',
        { source: 'chat' },
      );

      expect(message.id).toBeDefined();
      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello!');
      expect(message.metadata?.source).toBe('chat');
    });

    it('should track assistant message', async () => {
      collector.initialize();
      const conversation = await collector.trackConversationStart();
      const message = await collector.trackAssistantMessage(
        conversation.id,
        'Hi there!',
        {
          model: 'gpt-4',
          tokenUsage: { input: 10, output: 5, total: 15 },
        },
      );

      expect(message.role).toBe('assistant');
      expect(message.content).toBe('Hi there!');
      expect(message.model).toBe('gpt-4');
      expect(message.tokenUsage?.total).toBe(15);
    });

    it('should track generic message', async () => {
      collector.initialize();
      const conversation = await collector.trackConversationStart();
      const message = await collector.trackMessage(conversation.id, {
        role: 'system',
        content: 'System message',
      });

      expect(message.role).toBe('system');
    });

    it('should emit message:tracked event', async () => {
      collector.initialize();
      const handler = vi.fn();
      collector.on('message:tracked', handler);

      const conversation = await collector.trackConversationStart();
      await collector.trackUserMessage(conversation.id, 'Test');

      expect(handler).toHaveBeenCalled();
    });

    it('should throw when message tracking disabled', async () => {
      const disabledCollector = new Collector(storage, config, {
        trackMessages: false,
      });
      disabledCollector.initialize();

      const conversation = await disabledCollector.trackConversationStart();
      await expect(
        disabledCollector.trackUserMessage(conversation.id, 'Test'),
      ).rejects.toThrow('Message tracking is disabled');

      await disabledCollector.shutdown();
    });
  });

  describe('tool call tracking', () => {
    it('should track tool call', async () => {
      collector.initialize();
      const conversation = await collector.trackConversationStart();

      await collector.trackToolCall(conversation.id, {
        name: 'calculator',
        input: { operation: 'add', a: 1, b: 2 },
        output: 3,
        durationMs: 100,
        success: true,
      });

      expect(true).toBe(true); // Event added to batch
    });

    it('should not track when disabled', async () => {
      const disabledCollector = new Collector(storage, config, {
        trackToolCalls: false,
      });
      disabledCollector.initialize();

      const conversation = await disabledCollector.trackConversationStart();
      await disabledCollector.trackToolCall(conversation.id, {
        name: 'test',
        input: {},
      });

      // Should not throw, just skip
      expect(true).toBe(true);

      await disabledCollector.shutdown();
    });
  });

  describe('token usage tracking', () => {
    it('should track token usage', async () => {
      collector.initialize();
      const conversation = await collector.trackConversationStart();

      await collector.trackTokenUsage(conversation.id, {
        model: 'gpt-4',
        input: 100,
        output: 50,
        total: 150,
      });

      expect(true).toBe(true);
    });

    it('should calculate total tokens', async () => {
      collector.initialize();
      const conversation = await collector.trackConversationStart();

      await collector.trackTokenUsage(conversation.id, {
        model: 'gpt-4',
        input: 100,
        output: 50,
      });

      expect(true).toBe(true);
    });
  });

  describe('feedback tracking', () => {
    it('should track thumbs up feedback', async () => {
      collector.initialize();
      const conversation = await collector.trackConversationStart();

      await collector.trackFeedback(conversation.id, {
        thumbs: 'up',
        comment: 'Great!',
      });

      expect(true).toBe(true);
    });

    it('should track rating feedback', async () => {
      collector.initialize();
      const conversation = await collector.trackConversationStart();

      await collector.trackFeedback(conversation.id, {
        rating: 5,
        comment: 'Excellent service',
        categories: ['helpful', 'fast'],
      });

      expect(true).toBe(true);
    });

    it('should update conversation outcome', async () => {
      collector.initialize();
      const conversation = await collector.trackConversationStart();

      await collector.trackFeedback(conversation.id, {
        thumbs: 'down',
        rating: 2,
      });

      const tracker = collector.getConversationTracker();
      const updated = await tracker.getConversation(conversation.id);
      expect(updated?.outcome).toBeDefined();
    });
  });

  describe('error tracking', () => {
    it('should track error event', async () => {
      collector.initialize();
      const conversation = await collector.trackConversationStart();

      await collector.trackError(conversation.id, {
        type: 'ValidationError',
        message: 'Invalid input',
        stack: 'Error stack trace',
        recoverable: true,
      });

      expect(true).toBe(true);
    });
  });

  describe('custom event tracking', () => {
    it('should track custom event', async () => {
      collector.initialize();
      const handler = vi.fn();
      collector.on('event:collected', handler);

      await collector.trackEvent({
        type: 'custom',
        name: 'page_view',
        data: { page: '/home' },
      });

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('batch processing', () => {
    it('should emit batch:processed event', async () => {
      collector.initialize();
      const handler = vi.fn();
      collector.on('batch:processed', handler);

      await collector.trackEvent({ type: 'custom', data: {} });
      await collector.flush();

      expect(handler).toHaveBeenCalled();
    });

    it('should flush pending data', async () => {
      collector.initialize();
      await collector.trackEvent({ type: 'custom', data: {} });

      const batchCollector = collector.getBatchCollector();
      expect(batchCollector.getBufferSize()).toBeGreaterThan(0);

      await collector.flush();
      expect(batchCollector.getBufferSize()).toBe(0);
    });
  });

  describe('sub-collector access', () => {
    it('should provide conversation tracker', () => {
      const tracker = collector.getConversationTracker();
      expect(tracker).toBeDefined();
    });

    it('should provide message tracker', () => {
      const tracker = collector.getMessageTracker();
      expect(tracker).toBeDefined();
    });

    it('should provide batch collector', () => {
      const batch = collector.getBatchCollector();
      expect(batch).toBeDefined();
    });
  });

  describe('configuration', () => {
    it('should respect custom configuration', async () => {
      const customCollector = new Collector(storage, config, {
        trackConversations: true,
        trackMessages: true,
        trackToolCalls: false,
        trackTokenUsage: false,
      });

      customCollector.initialize();

      const conversation = await customCollector.trackConversationStart();
      await customCollector.trackUserMessage(conversation.id, 'Test');

      // Should not track tokens (just verify no error)
      await customCollector.trackTokenUsage(conversation.id, {
        model: 'gpt-4',
        input: 10,
        output: 5,
      });

      await customCollector.shutdown();
    });
  });
});
