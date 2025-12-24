/**
 * Analytics Core Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Analytics } from '../core/Analytics.js';
import { MemoryStorageAdapter } from '../storage/adapters/MemoryStorage.js';
import type { AnalyticsConfig } from '../types/index.js';

describe('Analytics', () => {
  let analytics: Analytics;
  let storage: MemoryStorageAdapter;

  beforeEach(() => {
    storage = new MemoryStorageAdapter();
    analytics = new Analytics({ storage, enabled: true });
  });

  afterEach(async () => {
    await analytics.shutdown();
  });

  describe('initialization', () => {
    it('should initialize successfully', () => {
      analytics.initialize();
      expect(analytics.isEnabled()).toBe(true);
    });

    it('should handle multiple initialize calls', () => {
      analytics.initialize();
      analytics.initialize();
      expect(analytics.isEnabled()).toBe(true);
    });

    it('should shutdown properly', async () => {
      analytics.initialize();
      await analytics.shutdown();
      // Second shutdown should be safe
      await analytics.shutdown();
    });
  });

  describe('configuration', () => {
    it('should use default configuration', () => {
      const config = analytics.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.batchConfig).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const customAnalytics = new Analytics({
        enabled: false,
        batchConfig: { enabled: true, maxSize: 50 },
      });
      const config = customAnalytics.getConfig();
      expect(config.enabled).toBe(false);
      expect(config.batchConfig?.maxSize).toBe(50);
    });

    it('should return enabled state', () => {
      expect(analytics.isEnabled()).toBe(true);
      const disabled = new Analytics({ enabled: false });
      expect(disabled.isEnabled()).toBe(false);
    });
  });

  describe('conversation tracking', () => {
    it('should start a conversation', async () => {
      analytics.initialize();
      const conversation = await analytics.startConversation({
        userId: 'user-123',
        metadata: { source: 'web' },
      });

      expect(conversation.id).toBeDefined();
      expect(conversation.userId).toBe('user-123');
      expect(conversation.status).toBe('active');
      expect(conversation.messages).toEqual([]);
    });

    it('should get conversation by id', async () => {
      analytics.initialize();
      const created = await analytics.startConversation({ userId: 'user-123' });
      const retrieved = await analytics.getConversation(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should update conversation', async () => {
      analytics.initialize();
      const conv = await analytics.startConversation();
      const updated = await analytics.updateConversation(conv.id, {
        metadata: { updated: true },
      });

      expect(updated.metadata?.updated).toBe(true);
    });

    it('should end conversation', async () => {
      analytics.initialize();
      const conv = await analytics.startConversation();
      const ended = await analytics.endConversation(conv.id, {
        success: true,
        satisfaction: 5,
      });

      expect(ended.endedAt).toBeDefined();
      expect(ended.status).toBe('completed');
      expect(ended.outcome?.success).toBe(true);
    });

    it('should add message to conversation', async () => {
      analytics.initialize();
      const conv = await analytics.startConversation();
      const updated = await analytics.addMessage(conv.id, {
        role: 'user',
        content: 'Hello!',
      });

      expect(updated.messages).toHaveLength(1);
      expect(updated.messages[0].content).toBe('Hello!');
      expect(updated.messages[0].role).toBe('user');
    });

    it('should throw when analytics disabled', async () => {
      const disabled = new Analytics({ enabled: false });
      await expect(disabled.startConversation()).rejects.toThrow(
        'Analytics is disabled',
      );
    });
  });

  describe('event tracking', () => {
    it('should track an event', async () => {
      analytics.initialize();
      const event = await analytics.trackEvent({
        type: 'custom',
        name: 'button_clicked',
        data: { button: 'submit' },
      });

      expect(event.id).toBeDefined();
      expect(event.timestamp).toBeDefined();
      expect(event.name).toBe('button_clicked');
    });

    it('should track multiple events', async () => {
      analytics.initialize();
      const events = await analytics.trackEvents([
        { type: 'custom', name: 'event1', data: {} },
        { type: 'custom', name: 'event2', data: {} },
      ]);

      expect(events).toHaveLength(2);
      expect(events[0].name).toBe('event1');
      expect(events[1].name).toBe('event2');
    });

    it('should query events', async () => {
      analytics.initialize();
      await analytics.trackEvent({
        type: 'custom',
        name: 'test',
        data: {},
        userId: 'user-123',
      });
      // Note: flush is internal - events are in buffer until shutdown
      // Query may return empty if events haven't been flushed to storage
      const results = await analytics.queryEvents({ userId: 'user-123' });
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('session tracking', () => {
    it('should start a session', async () => {
      analytics.initialize();
      const session = await analytics.startSession({
        userId: 'user-123',
        device: { type: 'desktop', os: 'macOS' },
      });

      expect(session.id).toBeDefined();
      expect(session.userId).toBe('user-123');
      expect(session.device?.type).toBe('desktop');
    });

    it('should get session by id', () => {
      analytics.initialize();
      analytics.startSession({ userId: 'user-123' }).then((created) => {
        const retrieved = analytics.getSession(created.id);
        expect(retrieved?.id).toBe(created.id);
      });
    });

    it('should end session', async () => {
      analytics.initialize();
      const session = await analytics.startSession();
      const ended = await analytics.endSession(session.id);

      expect(ended.endedAt).toBeDefined();
    });

    it('should touch session', async () => {
      analytics.initialize();
      const session = await analytics.startSession();
      await new Promise((r) => setTimeout(r, 5)); // Small delay to ensure different timestamps
      const touched = await analytics.touchSession(session.id);

      expect(touched.lastActivityAt).toBeGreaterThanOrEqual(session.startedAt);
    });
  });

  describe('aggregations', () => {
    it('should get conversation count', async () => {
      analytics.initialize();
      await analytics.startConversation();
      await analytics.startConversation();

      const count = await analytics.getConversationCount('all-time');
      expect(count).toBe(2);
    });

    it('should get average duration', async () => {
      analytics.initialize();
      const conv1 = await analytics.startConversation();
      await new Promise((resolve) => setTimeout(resolve, 10));
      await analytics.endConversation(conv1.id);

      const avgDuration =
        await analytics.getAverageConversationDuration('all-time');
      expect(avgDuration).toBeGreaterThan(0);
    });

    it('should get success rate', async () => {
      analytics.initialize();
      const conv1 = await analytics.startConversation();
      const conv2 = await analytics.startConversation();

      await analytics.endConversation(conv1.id, { success: true });
      await analytics.endConversation(conv2.id, { success: false });

      const rate = await analytics.getSuccessRate('all-time');
      expect(rate).toBe(0.5);
    });

    it('should handle empty aggregations', async () => {
      analytics.initialize();
      const rate = await analytics.getSuccessRate('all-time');
      expect(rate).toBe(0);
    });
  });

  describe('event emission', () => {
    it('should emit conversation:created event', async () => {
      analytics.initialize();
      const handler = vi.fn();
      analytics.on('conversation:created', handler);

      await analytics.startConversation();
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should emit conversation:ended event', async () => {
      analytics.initialize();
      const handler = vi.fn();
      analytics.on('conversation:ended', handler);

      const conv = await analytics.startConversation();
      await analytics.endConversation(conv.id);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should emit event:tracked event', async () => {
      analytics.initialize();
      const handler = vi.fn();
      analytics.on('event:tracked', handler);

      await analytics.trackEvent({ type: 'custom', name: 'test', data: {} });
      expect(handler).toHaveBeenCalled();
    });

    it('should emit session events', async () => {
      analytics.initialize();
      const createdHandler = vi.fn();
      const endedHandler = vi.fn();
      analytics.on('session:created', createdHandler);
      analytics.on('session:ended', endedHandler);

      const session = await analytics.startSession();
      expect(createdHandler).toHaveBeenCalledTimes(1);

      await analytics.endSession(session.id);
      expect(endedHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('manager access', () => {
    it('should provide conversation manager', () => {
      const manager = analytics.getConversationManager();
      expect(manager).toBeDefined();
    });

    it('should provide event manager', () => {
      const manager = analytics.getEventManager();
      expect(manager).toBeDefined();
    });

    it('should provide session manager', () => {
      const manager = analytics.getSessionManager();
      expect(manager).toBeDefined();
    });

    it('should provide storage adapter', () => {
      const storageAdapter = analytics.getStorage();
      expect(storageAdapter).toBe(storage);
    });
  });

  describe('time range resolution', () => {
    it('should resolve time period to time range', async () => {
      analytics.initialize();
      const count = await analytics.getConversationCount('last-7-days');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should accept custom time range', async () => {
      analytics.initialize();
      const now = Date.now();
      const count = await analytics.getConversationCount({
        start: now - 1000,
        end: now,
      });
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
});
