/**
 * Memory Storage Adapter Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStorageAdapter } from '../storage/adapters/MemoryStorage.js';
import type { Conversation, Session, AnalyticsEvent } from '../types/index.js';

describe('MemoryStorageAdapter', () => {
  let storage: MemoryStorageAdapter;

  beforeEach(() => {
    storage = new MemoryStorageAdapter();
  });

  describe('conversation storage', () => {
    it('should save a conversation', async () => {
      const conversation: Conversation = {
        id: 'conv-1',
        startedAt: Date.now(),
        messages: [],
        status: 'active',
      };

      await storage.saveConversation(conversation);
      const retrieved = await storage.getConversation('conv-1');

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('conv-1');
    });

    it('should update a conversation', async () => {
      const conversation: Conversation = {
        id: 'conv-1',
        startedAt: Date.now(),
        messages: [],
        status: 'active',
      };

      await storage.saveConversation(conversation);
      await storage.updateConversation('conv-1', {
        status: 'completed',
        endedAt: Date.now(),
      });

      const updated = await storage.getConversation('conv-1');
      expect(updated?.status).toBe('completed');
      expect(updated?.endedAt).toBeDefined();
    });

    it('should throw when updating non-existent conversation', async () => {
      await expect(
        storage.updateConversation('non-existent', { status: 'completed' }),
      ).rejects.toThrow(/Conversation not found/);
    });

    it('should not allow ID changes on update', async () => {
      const conversation: Conversation = {
        id: 'conv-1',
        startedAt: Date.now(),
        messages: [],
        status: 'active',
      };

      await storage.saveConversation(conversation);
      await storage.updateConversation('conv-1', { id: 'new-id' } as any);

      const retrieved = await storage.getConversation('conv-1');
      expect(retrieved?.id).toBe('conv-1');
    });
  });

  describe('conversation queries', () => {
    beforeEach(async () => {
      const now = Date.now();
      const conversations: Conversation[] = [
        {
          id: 'conv-1',
          userId: 'user-1',
          sessionId: 'session-1',
          startedAt: now - 10000,
          messages: [],
          status: 'completed',
          outcome: { success: true },
          intent: { primary: 'support', confidence: 0.9 },
          topics: ['billing'],
        },
        {
          id: 'conv-2',
          userId: 'user-2',
          sessionId: 'session-2',
          startedAt: now - 5000,
          messages: [],
          status: 'active',
          intent: { primary: 'sales', confidence: 0.8 },
        },
        {
          id: 'conv-3',
          userId: 'user-1',
          startedAt: now - 2000,
          messages: [],
          status: 'completed',
          outcome: { success: false },
          metadata: { source: 'web' },
        },
      ];

      for (const conv of conversations) {
        await storage.saveConversation(conv);
      }
    });

    it('should query all conversations', async () => {
      const result = await storage.queryConversations({});
      expect(result.conversations.length).toBe(3);
      expect(result.total).toBe(3);
    });

    it('should filter by userId', async () => {
      const result = await storage.queryConversations({ userId: 'user-1' });
      expect(result.conversations.length).toBe(2);
    });

    it('should filter by sessionId', async () => {
      const result = await storage.queryConversations({
        sessionId: 'session-1',
      });
      expect(result.conversations.length).toBe(1);
      expect(result.conversations[0].id).toBe('conv-1');
    });

    it('should filter by status', async () => {
      const result = await storage.queryConversations({ status: 'active' });
      expect(result.conversations.length).toBe(1);
      expect(result.conversations[0].id).toBe('conv-2');
    });

    it('should filter by intent', async () => {
      const result = await storage.queryConversations({ intent: 'support' });
      expect(result.conversations.length).toBe(1);
      expect(result.conversations[0].id).toBe('conv-1');
    });

    it('should filter by topic', async () => {
      const result = await storage.queryConversations({ topic: 'billing' });
      expect(result.conversations.length).toBe(1);
      expect(result.conversations[0].id).toBe('conv-1');
    });

    it('should filter by outcome', async () => {
      const result = await storage.queryConversations({ outcome: true });
      expect(result.conversations.length).toBe(1);
      expect(result.conversations[0].outcome?.success).toBe(true);
    });

    it('should filter by time range', async () => {
      const now = Date.now();
      const result = await storage.queryConversations({
        timeRange: { start: now - 6000, end: now },
      });
      expect(result.conversations.length).toBe(2); // conv-2 and conv-3
    });

    it('should filter by metadata', async () => {
      const result = await storage.queryConversations({
        metadata: { source: 'web' },
      });
      expect(result.conversations.length).toBe(1);
      expect(result.conversations[0].id).toBe('conv-3');
    });

    it('should paginate results', async () => {
      const result = await storage.queryConversations({ limit: 2, offset: 0 });
      expect(result.conversations.length).toBe(2);
      expect(result.hasMore).toBe(true);
      expect(result.offset).toBe(0);
      expect(result.limit).toBe(2);
    });

    it('should sort by startedAt descending', async () => {
      const result = await storage.queryConversations({});
      expect(result.conversations[0].id).toBe('conv-3'); // Most recent
      expect(result.conversations[2].id).toBe('conv-1'); // Oldest
    });
  });

  describe('session storage', () => {
    it('should save a session', async () => {
      const session: Session = {
        id: 'session-1',
        userId: 'user-1',
        startedAt: Date.now(),
        conversationIds: [],
        pageViews: 0,
        events: 0,
      };

      await storage.saveSession(session);
      const retrieved = await storage.getSession('session-1');

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('session-1');
    });

    it('should return null for non-existent session', async () => {
      const session = await storage.getSession('non-existent');
      expect(session).toBeNull();
    });
  });

  describe('event storage', () => {
    it('should save an event', async () => {
      const event: AnalyticsEvent = {
        id: 'event-1',
        type: 'custom',
        timestamp: Date.now(),
        data: { key: 'value' },
      };

      await storage.saveEvent(event);
      const events = await storage.queryEvents({});
      expect(events.length).toBe(1);
      expect(events[0].id).toBe('event-1');
    });

    it('should query events by type', async () => {
      await storage.saveEvent({
        id: 'e1',
        type: 'custom',
        timestamp: Date.now(),
        data: {},
      });
      await storage.saveEvent({
        id: 'e2',
        type: 'error',
        timestamp: Date.now(),
        data: {},
      });

      const result = await storage.queryEvents({ type: 'custom' });
      expect(result.length).toBe(1);
      expect(result[0].type).toBe('custom');
    });

    it('should query events by conversationId', async () => {
      await storage.saveEvent({
        id: 'e1',
        type: 'custom',
        conversationId: 'conv-1',
        timestamp: Date.now(),
        data: {},
      });
      await storage.saveEvent({
        id: 'e2',
        type: 'custom',
        conversationId: 'conv-2',
        timestamp: Date.now(),
        data: {},
      });

      const result = await storage.queryEvents({ conversationId: 'conv-1' });
      expect(result.length).toBe(1);
    });

    it('should query events by time range', async () => {
      const now = Date.now();
      await storage.saveEvent({
        id: 'e1',
        type: 'custom',
        timestamp: now - 10000,
        data: {},
      });
      await storage.saveEvent({
        id: 'e2',
        type: 'custom',
        timestamp: now - 1000,
        data: {},
      });

      const result = await storage.queryEvents({
        timeRange: { start: now - 5000, end: now },
      });
      expect(result.length).toBe(1);
    });

    it('should limit query results', async () => {
      for (let i = 0; i < 10; i++) {
        await storage.saveEvent({
          id: `e${i}`,
          type: 'custom',
          timestamp: Date.now(),
          data: {},
        });
      }

      const result = await storage.queryEvents({ limit: 5 });
      expect(result.length).toBe(5);
    });
  });

  describe('aggregation', () => {
    beforeEach(async () => {
      const now = Date.now();
      await storage.saveConversation({
        id: 'c1',
        startedAt: now - 5000,
        endedAt: now - 1000,
        messages: [],
        status: 'completed',
        outcome: { success: true },
      });
      await storage.saveConversation({
        id: 'c2',
        startedAt: now - 3000,
        endedAt: now - 500,
        messages: [],
        status: 'completed',
        outcome: { success: false },
      });
    });

    it('should aggregate conversations count', async () => {
      const result = await storage.aggregate({
        metric: 'conversations',
        function: 'count',
      });

      expect(result.value).toBe(2);
    });

    it('should aggregate successful conversations', async () => {
      const result = await storage.aggregate({
        metric: 'successful_conversations',
        function: 'count',
      });

      expect(result.value).toBe(1);
    });

    it('should aggregate conversation duration', async () => {
      const result = await storage.aggregate({
        metric: 'conversation_duration',
        function: 'avg',
      });

      expect(result.value).toBeGreaterThan(0);
    });

    it('should aggregate with time period', async () => {
      const now = Date.now();
      const result = await storage.aggregate({
        metric: 'conversations',
        function: 'count',
        period: { start: now - 10000, end: now },
      });

      expect(result.value).toBe(2);
    });

    it('should build time buckets with granularity', async () => {
      const now = Date.now();
      const result = await storage.aggregate({
        metric: 'conversations',
        function: 'count',
        period: { start: now - 10000, end: now },
        granularity: 'hour',
      });

      expect(result.buckets).toBeDefined();
      expect(result.buckets!.length).toBeGreaterThan(0);
    });
  });

  describe('storage limits', () => {
    it('should enforce max conversations limit', async () => {
      const limitedStorage = new MemoryStorageAdapter({ maxConversations: 2 });

      for (let i = 0; i < 3; i++) {
        await limitedStorage.saveConversation({
          id: `conv-${i}`,
          startedAt: Date.now(),
          messages: [],
          status: 'active',
        });
      }

      const stats = limitedStorage.getStats();
      expect(stats.conversationCount).toBe(2);
    });

    it('should enforce max events limit', async () => {
      const limitedStorage = new MemoryStorageAdapter({ maxEvents: 2 });

      for (let i = 0; i < 3; i++) {
        await limitedStorage.saveEvent({
          id: `event-${i}`,
          type: 'custom',
          timestamp: Date.now(),
          data: {},
        });
      }

      const stats = limitedStorage.getStats();
      expect(stats.eventCount).toBe(2);
    });

    it('should enforce max sessions limit', async () => {
      const limitedStorage = new MemoryStorageAdapter({ maxSessions: 2 });

      for (let i = 0; i < 3; i++) {
        await limitedStorage.saveSession({
          id: `session-${i}`,
          startedAt: Date.now(),
          conversationIds: [],
          pageViews: 0,
          events: 0,
        });
      }

      const stats = limitedStorage.getStats();
      expect(stats.sessionCount).toBe(2);
    });
  });

  describe('utility methods', () => {
    it('should clear all data', async () => {
      await storage.saveConversation({
        id: 'c1',
        startedAt: Date.now(),
        messages: [],
        status: 'active',
      });
      await storage.saveEvent({
        id: 'e1',
        type: 'custom',
        timestamp: Date.now(),
        data: {},
      });

      await storage.clear();

      const stats = storage.getStats();
      expect(stats.conversationCount).toBe(0);
      expect(stats.eventCount).toBe(0);
    });

    it('should provide statistics', async () => {
      const now = Date.now();
      await storage.saveConversation({
        id: 'c1',
        startedAt: now - 1000,
        messages: [],
        status: 'active',
      });
      await storage.saveEvent({
        id: 'e1',
        type: 'custom',
        timestamp: now,
        data: {},
      });

      const stats = storage.getStats();
      expect(stats.conversationCount).toBe(1);
      expect(stats.eventCount).toBe(1);
      expect(stats.oldestConversation).toBeDefined();
      expect(stats.newestConversation).toBeDefined();
      expect(stats.oldestEvent).toBeDefined();
      expect(stats.newestEvent).toBeDefined();
    });
  });
});
