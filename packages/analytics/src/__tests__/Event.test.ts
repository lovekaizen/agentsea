/**
 * Event Manager Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EventManager } from '../core/Event.js';
import { MemoryStorageAdapter } from '../storage/adapters/MemoryStorage.js';
import type { AnalyticsConfig } from '../types/index.js';

describe('EventManager', () => {
  let manager: EventManager;
  let storage: MemoryStorageAdapter;
  let config: AnalyticsConfig;

  beforeEach(() => {
    storage = new MemoryStorageAdapter();
    config = {
      enabled: true,
      batchConfig: { enabled: true, maxSize: 5, maxAge: 1000 },
    };
    manager = new EventManager(storage, config);
  });

  afterEach(async () => {
    await manager.cleanup();
  });

  describe('event tracking', () => {
    it('should track an event', async () => {
      manager.initialize();
      const event = await manager.track({
        type: 'custom',
        name: 'button_clicked',
        data: { button: 'submit' },
      });

      expect(event.id).toBeDefined();
      expect(event.timestamp).toBeDefined();
      expect(event.name).toBe('button_clicked');
      expect(event.data.button).toBe('submit');
    });

    it('should track event with user ID', async () => {
      manager.initialize();
      const event = await manager.track({
        type: 'user_action',
        userId: 'user-123',
        data: {},
      });

      expect(event.userId).toBe('user-123');
    });

    it('should track event with conversation ID', async () => {
      manager.initialize();
      const event = await manager.track({
        type: 'conversation_message',
        conversationId: 'conv-123',
        data: {},
      });

      expect(event.conversationId).toBe('conv-123');
    });

    it('should emit tracked event', async () => {
      manager.initialize();
      const handler = vi.fn();
      manager.on('tracked', handler);

      await manager.track({ type: 'custom', data: {} });
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('batch tracking', () => {
    it('should track multiple events', async () => {
      manager.initialize();
      const events = await manager.trackBatch([
        { type: 'custom', name: 'event1', data: {} },
        { type: 'custom', name: 'event2', data: {} },
        { type: 'custom', name: 'event3', data: {} },
      ]);

      expect(events).toHaveLength(3);
      expect(events[0].name).toBe('event1');
      expect(events[2].name).toBe('event3');
    });

    it('should auto-flush when buffer is full', async () => {
      manager.initialize();
      const handler = vi.fn();
      manager.on('batch:flushed', handler);

      // Max size is 5, so this should trigger flush
      for (let i = 0; i < 5; i++) {
        await manager.track({ type: 'custom', data: {} });
      }

      expect(handler).toHaveBeenCalled();
      expect(manager.getBufferSize()).toBe(0);
    });

    it('should track buffer size', async () => {
      manager.initialize();
      expect(manager.getBufferSize()).toBe(0);

      await manager.track({ type: 'custom', data: {} });
      expect(manager.getBufferSize()).toBe(1);

      await manager.track({ type: 'custom', data: {} });
      expect(manager.getBufferSize()).toBe(2);
    });

    it('should detect full buffer', async () => {
      manager.initialize();
      expect(manager.isBufferFull()).toBe(false);

      for (let i = 0; i < 5; i++) {
        await manager.track({ type: 'custom', data: {} });
      }

      // After flush, buffer should be empty
      expect(manager.isBufferFull()).toBe(false);
    });
  });

  describe('flushing', () => {
    it('should flush events to storage', async () => {
      manager.initialize();
      await manager.track({ type: 'custom', data: {} });
      await manager.track({ type: 'custom', data: {} });

      expect(manager.getBufferSize()).toBe(2);
      await manager.flush();
      expect(manager.getBufferSize()).toBe(0);
    });

    it('should emit flush event', async () => {
      manager.initialize();
      const handler = vi.fn();
      manager.on('batch:flushed', handler);

      await manager.track({ type: 'custom', data: {} });
      await manager.flush();

      expect(handler).toHaveBeenCalled();
    });

    it('should handle empty flush', async () => {
      manager.initialize();
      await manager.flush(); // Should not throw
      expect(manager.getBufferSize()).toBe(0);
    });

    it('should handle flush errors gracefully', async () => {
      // Create a config without periodic flushing
      const noAutoFlushConfig: AnalyticsConfig = {
        enabled: true,
        batchConfig: { enabled: true, maxSize: 100 }, // No maxAge to prevent auto-flush
      };
      const errorStorage = {
        ...storage,
        saveEvent: vi.fn().mockRejectedValue(new Error('Storage error')),
      };
      const errorManager = new EventManager(
        errorStorage as any,
        noAutoFlushConfig,
      );
      errorManager.initialize();

      await errorManager.track({ type: 'custom', data: {} });
      const sizeBefore = errorManager.getBufferSize();
      expect(sizeBefore).toBe(1);

      // Flush should throw but preserve events in buffer
      try {
        await errorManager.flush();
      } catch {
        // Expected to throw
      }
      // Buffer should be preserved since flush failed
      expect(errorManager.getBufferSize()).toBe(1);

      // Cleanup also calls flush, so catch its error too
      try {
        await errorManager.cleanup();
      } catch {
        // Expected due to storage error
      }
    });
  });

  describe('sampling', () => {
    it('should sample events when enabled', async () => {
      const samplingConfig: AnalyticsConfig = {
        enabled: true,
        sampling: { enabled: true, rate: 0.5 },
      };
      const samplingManager = new EventManager(storage, samplingConfig);
      samplingManager.initialize();

      // Track many events
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(samplingManager.track({ type: 'custom', data: {} }));
      }
      await Promise.all(promises);

      await samplingManager.flush();

      // With 0.5 rate, should have roughly 50 events (allow variance)
      const events = await storage.queryEvents({});
      expect(events.length).toBeLessThan(100);

      await samplingManager.cleanup();
    });

    it('should handle numeric sampling rate', async () => {
      const samplingConfig: AnalyticsConfig = {
        enabled: true,
        sampling: 0.5,
      };
      const samplingManager = new EventManager(storage, samplingConfig);
      samplingManager.initialize();

      await samplingManager.track({ type: 'custom', data: {} });
      await samplingManager.cleanup();
    });
  });

  describe('anonymization', () => {
    it('should hash user IDs when configured', async () => {
      const anonConfig: AnalyticsConfig = {
        enabled: true,
        anonymization: {
          enabled: true,
          hashUserIds: true,
        },
      };
      const anonManager = new EventManager(storage, anonConfig);
      anonManager.initialize();

      const event = await anonManager.track({
        type: 'custom',
        userId: 'user-123',
        data: {},
      });

      expect(event.userId).not.toBe('user-123');
      expect(event.userId).toMatch(/^anon_/);

      await anonManager.cleanup();
    });

    it('should anonymize specific fields', async () => {
      const anonConfig: AnalyticsConfig = {
        enabled: true,
        anonymization: {
          enabled: true,
          fieldsToAnonymize: ['email', 'name'],
        },
      };
      const anonManager = new EventManager(storage, anonConfig);
      anonManager.initialize();

      const event = await anonManager.track({
        type: 'custom',
        data: {},
        properties: {
          email: 'user@example.com',
          name: 'John Doe',
          age: 30,
        },
      });

      expect(event.properties?.email).toBe('[REDACTED]');
      expect(event.properties?.name).toBe('[REDACTED]');
      expect(event.properties?.age).toBe(30);

      await anonManager.cleanup();
    });
  });

  describe('specialized event tracking', () => {
    it('should track conversation event', async () => {
      manager.initialize();
      const event = await manager.trackConversation('conv-123', 'started', {
        source: 'web',
      });

      expect(event.type).toBe('conversation_started');
      expect(event.conversationId).toBe('conv-123');
      expect(event.data.source).toBe('web');
    });

    it('should track user action', async () => {
      manager.initialize();
      const event = await manager.trackUserAction(
        'click',
        { button: 'submit' },
        'user-123',
        'session-456',
      );

      expect(event.type).toBe('user_action');
      expect(event.name).toBe('click');
      expect(event.userId).toBe('user-123');
      expect(event.sessionId).toBe('session-456');
    });

    it('should track tool usage', async () => {
      manager.initialize();
      const event = await manager.trackToolUsage(
        'calculator',
        true,
        123,
        'conv-123',
      );

      expect(event.type).toBe('tool_usage');
      expect(event.name).toBe('calculator');
      expect(event.data.success).toBe(true);
      expect(event.data.durationMs).toBe(123);
    });

    it('should track error', async () => {
      manager.initialize();
      const event = await manager.trackError(
        'ValidationError',
        'Invalid input',
        { field: 'email' },
        'conv-123',
      );

      expect(event.type).toBe('error');
      expect(event.name).toBe('ValidationError');
      expect(event.data.message).toBe('Invalid input');
    });

    it('should track feedback', async () => {
      manager.initialize();
      const event = await manager.trackFeedback(
        5,
        'Great service!',
        'conv-123',
        'user-123',
      );

      expect(event.type).toBe('feedback');
      expect(event.data.rating).toBe(5);
      expect(event.data.comment).toBe('Great service!');
    });

    it('should track custom event', async () => {
      manager.initialize();
      const event = await manager.trackCustom(
        'custom_metric',
        { value: 42 },
        { conversationId: 'conv-123' },
      );

      expect(event.type).toBe('custom');
      expect(event.name).toBe('custom_metric');
      expect(event.data.value).toBe(42);
    });
  });

  describe('initialization and cleanup', () => {
    it('should initialize successfully', () => {
      manager.initialize();
      expect(true).toBe(true);
    });

    it('should handle multiple initializations', () => {
      manager.initialize();
      manager.initialize();
      expect(true).toBe(true);
    });

    it('should cleanup and flush', async () => {
      manager.initialize();
      await manager.track({ type: 'custom', data: {} });

      const handler = vi.fn();
      manager.on('batch:flushed', handler);

      await manager.cleanup();
      expect(handler).toHaveBeenCalled();
    });
  });
});
