/**
 * Message Tracker Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MessageTracker } from '../collection/MessageTracker.js';
import { MemoryStorageAdapter } from '../storage/adapters/MemoryStorage.js';
import type { AnalyticsConfig, Conversation } from '../types/index.js';

describe('MessageTracker', () => {
  let tracker: MessageTracker;
  let storage: MemoryStorageAdapter;
  let config: AnalyticsConfig;
  let conversationId: string;

  beforeEach(async () => {
    storage = new MemoryStorageAdapter();
    config = { enabled: true };
    tracker = new MessageTracker(storage, config);

    // Create a test conversation
    const conversation: Conversation = {
      id: 'conv-test',
      startedAt: Date.now(),
      messages: [],
      status: 'active',
    };
    await storage.saveConversation(conversation);
    conversationId = conversation.id;
  });

  afterEach(() => {
    tracker.cleanup();
  });

  describe('message tracking', () => {
    it('should track a message', async () => {
      const message = await tracker.trackMessage(conversationId, {
        role: 'user',
        content: 'Hello!',
      });

      expect(message.id).toBeDefined();
      expect(message.timestamp).toBeDefined();
      expect(message.conversationId).toBe(conversationId);
      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello!');
    });

    it('should track user message', async () => {
      const message = await tracker.trackUserMessage(
        conversationId,
        'User message',
        { source: 'web' },
      );

      expect(message.role).toBe('user');
      expect(message.content).toBe('User message');
      expect(message.metadata?.source).toBe('web');
    });

    it('should track assistant message', async () => {
      const message = await tracker.trackAssistantMessage(
        conversationId,
        'Assistant response',
        {
          model: 'gpt-5.5',
          tokenUsage: { input: 10, output: 15, total: 25 },
        },
      );

      expect(message.role).toBe('assistant');
      expect(message.content).toBe('Assistant response');
      expect(message.model).toBe('gpt-5.5');
      expect(message.tokenUsage?.total).toBe(25);
    });

    it('should track system message', async () => {
      const message = await tracker.trackSystemMessage(
        conversationId,
        'System notification',
      );

      expect(message.role).toBe('system');
      expect(message.content).toBe('System notification');
    });

    it('should track tool calls', async () => {
      const message = await tracker.trackAssistantMessage(
        conversationId,
        'Using tools',
        {
          toolCalls: [
            { name: 'calculator', success: true },
            { name: 'search', success: true },
          ],
        },
      );

      expect(message.toolCalls).toHaveLength(2);
    });
  });

  describe('response time tracking', () => {
    it('should track response time for assistant messages', async () => {
      await tracker.trackUserMessage(conversationId, 'Question');
      await new Promise((resolve) => setTimeout(resolve, 10));

      const assistantMsg = await tracker.trackAssistantMessage(
        conversationId,
        'Answer',
      );

      expect(assistantMsg.metadata?.responseTimeMs).toBeDefined();
      expect(assistantMsg.metadata?.responseTimeMs).toBeGreaterThan(0);
    });

    it('should not have response time for first message', async () => {
      const message = await tracker.trackAssistantMessage(
        conversationId,
        'First message',
      );

      expect(message.metadata?.responseTimeMs).toBeUndefined();
    });
  });

  describe('message retrieval', () => {
    it('should get messages for conversation', async () => {
      await tracker.trackUserMessage(conversationId, 'Message 1');
      await tracker.trackUserMessage(conversationId, 'Message 2');

      const messages = tracker.getMessages(conversationId);
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe('Message 1');
      expect(messages[1].content).toBe('Message 2');
    });

    it('should get last message', async () => {
      await tracker.trackUserMessage(conversationId, 'First');
      await tracker.trackUserMessage(conversationId, 'Last');

      const lastMessage = tracker.getLastMessage(conversationId);
      expect(lastMessage?.content).toBe('Last');
    });

    it('should return undefined for non-existent conversation', () => {
      const lastMessage = tracker.getLastMessage('non-existent');
      expect(lastMessage).toBeUndefined();
    });

    it('should get message count', async () => {
      await tracker.trackUserMessage(conversationId, 'Msg 1');
      await tracker.trackUserMessage(conversationId, 'Msg 2');
      await tracker.trackUserMessage(conversationId, 'Msg 3');

      const count = tracker.getMessageCount(conversationId);
      expect(count).toBe(3);
    });
  });

  describe('statistics', () => {
    it('should track message statistics', async () => {
      await tracker.trackUserMessage(conversationId, 'User msg');
      await tracker.trackAssistantMessage(conversationId, 'Assistant msg', {
        tokenUsage: { input: 10, output: 15, total: 25 },
      });
      await tracker.trackSystemMessage(conversationId, 'System msg');

      const stats = tracker.getStats();
      expect(stats.totalMessages).toBe(3);
      expect(stats.userMessages).toBe(1);
      expect(stats.assistantMessages).toBe(1);
      expect(stats.systemMessages).toBe(1);
      expect(stats.totalTokens).toBe(25);
    });

    it('should track average message length', async () => {
      await tracker.trackUserMessage(conversationId, 'Hi');
      await tracker.trackUserMessage(conversationId, 'Hello');

      const stats = tracker.getStats();
      expect(stats.avgMessageLength).toBeGreaterThan(0);
    });

    it('should track tool calls in statistics', async () => {
      await tracker.trackAssistantMessage(conversationId, 'Response', {
        toolCalls: [{ name: 'tool1' }, { name: 'tool2' }],
      });

      const stats = tracker.getStats();
      expect(stats.totalToolCalls).toBe(2);
    });

    it('should track average response time', async () => {
      await tracker.trackUserMessage(conversationId, 'Q1');
      await new Promise((resolve) => setTimeout(resolve, 10));
      await tracker.trackAssistantMessage(conversationId, 'A1');

      await tracker.trackUserMessage(conversationId, 'Q2');
      await new Promise((resolve) => setTimeout(resolve, 10));
      await tracker.trackAssistantMessage(conversationId, 'A2');

      const stats = tracker.getStats();
      expect(stats.avgResponseTimeMs).toBeGreaterThan(0);
    });
  });

  describe('token usage tracking', () => {
    it('should get token usage for conversation', async () => {
      await tracker.trackAssistantMessage(conversationId, 'Msg 1', {
        tokenUsage: { input: 10, output: 5, total: 15 },
      });
      await tracker.trackAssistantMessage(conversationId, 'Msg 2', {
        tokenUsage: { input: 20, output: 10, total: 30 },
      });

      const usage = tracker.getTokenUsage(conversationId);
      expect(usage.input).toBe(30);
      expect(usage.output).toBe(15);
      expect(usage.total).toBe(45);
    });

    it('should handle messages without token usage', async () => {
      await tracker.trackUserMessage(conversationId, 'No tokens');

      const usage = tracker.getTokenUsage(conversationId);
      expect(usage.total).toBe(0);
    });
  });

  describe('tool call tracking', () => {
    it('should get tool call count', async () => {
      await tracker.trackAssistantMessage(conversationId, 'Response', {
        toolCalls: [{ name: 'tool1' }, { name: 'tool2' }],
      });
      await tracker.trackAssistantMessage(conversationId, 'Response 2', {
        toolCalls: [{ name: 'tool3' }],
      });

      const count = tracker.getToolCallCount(conversationId);
      expect(count).toBe(3);
    });
  });

  describe('response time analysis', () => {
    it('should get average response time for conversation', async () => {
      await tracker.trackUserMessage(conversationId, 'Q1');
      await new Promise((resolve) => setTimeout(resolve, 10));
      await tracker.trackAssistantMessage(conversationId, 'A1');

      const avgTime = tracker.getAverageResponseTime(conversationId);
      expect(avgTime).toBeGreaterThan(0);
    });

    it('should return 0 for no response times', async () => {
      const avgTime = tracker.getAverageResponseTime('new-conv');
      expect(avgTime).toBe(0);
    });
  });

  describe('cache management', () => {
    it('should clear cache for conversation', async () => {
      await tracker.trackUserMessage(conversationId, 'Test');
      expect(tracker.getMessageCount(conversationId)).toBe(1);

      tracker.clearCache(conversationId);
      expect(tracker.getMessageCount(conversationId)).toBe(0);
    });

    it('should clear all caches', async () => {
      await tracker.trackUserMessage(conversationId, 'Test 1');
      await tracker.trackUserMessage('conv-2', 'Test 2');

      tracker.clearAllCaches();

      expect(tracker.getMessageCount(conversationId)).toBe(0);
      expect(tracker.getMessageCount('conv-2')).toBe(0);
    });
  });

  describe('initialization and cleanup', () => {
    it('should initialize successfully', () => {
      tracker.initialize();
      expect(true).toBe(true);
    });

    it('should cleanup resources', () => {
      tracker.initialize();
      tracker.cleanup();
      expect(tracker.getMessageCount(conversationId)).toBe(0);
    });
  });
});
