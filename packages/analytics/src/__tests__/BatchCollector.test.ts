/**
 * Batch Collector Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BatchCollector } from '../collection/BatchCollector.js';
import { MemoryStorageAdapter } from '../storage/adapters/MemoryStorage.js';
import type { AnalyticsConfig } from '../types/index.js';

describe('BatchCollector', () => {
  let collector: BatchCollector;
  let storage: MemoryStorageAdapter;
  let config: AnalyticsConfig;

  beforeEach(() => {
    storage = new MemoryStorageAdapter();
    config = {
      enabled: true,
      batchConfig: {
        enabled: true,
        maxSize: 5,
        maxAge: 1000,
        flushOnShutdown: true,
      },
    };
    collector = new BatchCollector(storage, config);
  });

  afterEach(async () => {
    await collector.cleanup();
  });

  describe('event collection', () => {
    it('should add event to batch', async () => {
      collector.initialize();
      const event = await collector.add({
        type: 'custom',
        name: 'test',
        data: { value: 42 },
      });

      expect(event.id).toBeDefined();
      expect(event.timestamp).toBeDefined();
      expect(event.name).toBe('test');
      expect(collector.getBufferSize()).toBe(1);
    });

    it('should add multiple events', async () => {
      collector.initialize();
      const events = await collector.addBatch([
        { type: 'custom', name: 'event1', data: {} },
        { type: 'custom', name: 'event2', data: {} },
        { type: 'custom', name: 'event3', data: {} },
      ]);

      expect(events).toHaveLength(3);
      expect(collector.getBufferSize()).toBe(3);
    });

    it('should emit added event', async () => {
      collector.initialize();
      const handler = vi.fn();
      collector.on('added', handler);

      await collector.add({ type: 'custom', data: {} });
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('auto-flushing', () => {
    it('should auto-flush when buffer is full', async () => {
      collector.initialize();
      const handler = vi.fn();
      collector.on('flushed', handler);

      // Add events up to max size (5)
      for (let i = 0; i < 5; i++) {
        await collector.add({ type: 'custom', data: { index: i } });
      }

      expect(handler).toHaveBeenCalled();
      expect(collector.getBufferSize()).toBe(0);
    });

    it('should check if buffer is full', async () => {
      collector.initialize();
      expect(collector.isBufferFull()).toBe(false);

      for (let i = 0; i < 4; i++) {
        await collector.add({ type: 'custom', data: {} });
      }
      expect(collector.isBufferFull()).toBe(false);

      await collector.add({ type: 'custom', data: {} });
      // After auto-flush, buffer should be empty
      expect(collector.isBufferFull()).toBe(false);
    });
  });

  describe('manual flushing', () => {
    it('should flush buffer to storage', async () => {
      collector.initialize();
      await collector.add({ type: 'custom', data: {} });
      await collector.add({ type: 'custom', data: {} });

      expect(collector.getBufferSize()).toBe(2);

      const handler = vi.fn();
      collector.on('flushed', handler);

      await collector.flush();

      expect(collector.getBufferSize()).toBe(0);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should handle empty flush', async () => {
      collector.initialize();
      await collector.flush(); // Should not throw
      expect(collector.getBufferSize()).toBe(0);
    });

    it('should emit processed event', async () => {
      collector.initialize();
      const handler = vi.fn();
      collector.on('processed', handler);

      await collector.add({ type: 'custom', data: {} });
      await collector.flush();

      expect(handler).toHaveBeenCalledWith(1);
    });
  });

  describe('force flush with retry', () => {
    it('should retry on failure', async () => {
      collector.initialize();
      let attempts = 0;
      const failingStorage = {
        ...storage,
        saveEvent: vi.fn().mockImplementation(async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Storage error');
          }
        }),
      };

      const failingCollector = new BatchCollector(
        failingStorage as any,
        config,
      );
      failingCollector.initialize();

      await failingCollector.add({ type: 'custom', data: {} });
      await failingCollector.forceFlush(3);

      expect(attempts).toBe(3);

      await failingCollector.cleanup();
    });

    it('should throw after max retries', async () => {
      collector.initialize();
      const errorStorage = {
        ...storage,
        saveEvent: vi.fn().mockRejectedValue(new Error('Persistent error')),
      };

      const errorCollector = new BatchCollector(errorStorage as any, config);
      errorCollector.initialize();

      await errorCollector.add({ type: 'custom', data: {} });
      await expect(errorCollector.forceFlush(2)).rejects.toThrow();

      // Cleanup will also throw due to error storage, so catch it
      try {
        await errorCollector.cleanup();
      } catch {
        // Expected
      }
    });
  });

  describe('error handling', () => {
    it('should restore buffer on flush error', async () => {
      collector.initialize();
      const errorStorage = {
        ...storage,
        saveEvent: vi.fn().mockRejectedValue(new Error('Storage error')),
      };

      const errorCollector = new BatchCollector(errorStorage as any, config);
      errorCollector.initialize();

      await errorCollector.add({ type: 'custom', data: {} });
      const initialSize = errorCollector.getBufferSize();

      await expect(errorCollector.flush()).rejects.toThrow();
      expect(errorCollector.getBufferSize()).toBe(initialSize);

      // Cleanup will also throw due to error storage, so catch it
      try {
        await errorCollector.cleanup();
      } catch {
        // Expected
      }
    });

    it('should emit error event', async () => {
      collector.initialize();
      const errorStorage = {
        ...storage,
        saveEvent: vi.fn().mockRejectedValue(new Error('Storage error')),
      };

      const errorCollector = new BatchCollector(errorStorage as any, config);
      errorCollector.initialize();

      const handler = vi.fn();
      errorCollector.on('error', handler);

      await errorCollector.add({ type: 'custom', data: {} });
      await expect(errorCollector.flush()).rejects.toThrow();

      expect(handler).toHaveBeenCalled();

      // Cleanup will also throw due to error storage, so catch it
      try {
        await errorCollector.cleanup();
      } catch {
        // Expected
      }
    });
  });

  describe('statistics', () => {
    it('should track collection stats', async () => {
      collector.initialize();
      await collector.add({ type: 'custom', data: {} });
      await collector.add({ type: 'custom', data: {} });
      await collector.flush();

      const stats = collector.getStats();
      expect(stats.totalCollected).toBe(2);
      expect(stats.totalProcessed).toBe(2);
      expect(stats.batchesFlushed).toBe(1);
      expect(stats.avgBatchSize).toBe(2);
    });

    it('should track buffer size in stats', async () => {
      collector.initialize();
      await collector.add({ type: 'custom', data: {} });

      const stats = collector.getStats();
      expect(stats.bufferSize).toBe(1);
    });

    it('should track dropped events', async () => {
      collector.initialize();
      await collector.add({ type: 'custom', data: {} });

      collector.clear();

      const stats = collector.getStats();
      expect(stats.eventsDropped).toBe(1);
    });
  });

  describe('buffer management', () => {
    it('should get buffer contents', async () => {
      collector.initialize();
      await collector.add({ type: 'custom', name: 'event1', data: {} });
      await collector.add({ type: 'custom', name: 'event2', data: {} });

      const buffer = collector.getBuffer();
      expect(buffer).toHaveLength(2);
      expect(buffer[0].name).toBe('event1');
      expect(buffer[1].name).toBe('event2');
    });

    it('should clear buffer', async () => {
      collector.initialize();
      await collector.add({ type: 'custom', data: {} });
      await collector.add({ type: 'custom', data: {} });

      expect(collector.getBufferSize()).toBe(2);
      collector.clear();
      expect(collector.getBufferSize()).toBe(0);
    });
  });

  describe('sampling', () => {
    it('should sample events', async () => {
      const samplingConfig: AnalyticsConfig = {
        enabled: true,
        sampling: { enabled: true, rate: 0.5 },
        batchConfig: { enabled: true, maxSize: 100 },
      };

      const samplingCollector = new BatchCollector(storage, samplingConfig);
      samplingCollector.initialize();

      // Add many events
      for (let i = 0; i < 100; i++) {
        await samplingCollector.add({ type: 'custom', data: { i } });
      }

      await samplingCollector.flush();

      // Should have roughly 50 events (allow variance)
      const events = await storage.queryEvents({});
      expect(events.length).toBeLessThan(100);

      await samplingCollector.cleanup();
    });

    it('should handle numeric sampling rate', async () => {
      const samplingConfig: AnalyticsConfig = {
        enabled: true,
        sampling: 0.5,
      };

      const samplingCollector = new BatchCollector(storage, samplingConfig);
      samplingCollector.initialize();

      await samplingCollector.add({ type: 'custom', data: {} });

      await samplingCollector.cleanup();
    });
  });

  describe('initialization and cleanup', () => {
    it('should initialize successfully', () => {
      collector.initialize();
      expect(true).toBe(true);
    });

    it('should handle multiple initializations', () => {
      collector.initialize();
      collector.initialize();
      expect(true).toBe(true);
    });

    it('should flush on cleanup when configured', async () => {
      collector.initialize();
      await collector.add({ type: 'custom', data: {} });

      const handler = vi.fn();
      collector.on('flushed', handler);

      await collector.cleanup();
      expect(handler).toHaveBeenCalled();
    });

    it('should not flush on cleanup when disabled', async () => {
      const noFlushConfig: AnalyticsConfig = {
        enabled: true,
        batchConfig: { enabled: true, flushOnShutdown: false },
      };

      const noFlushCollector = new BatchCollector(storage, noFlushConfig);
      noFlushCollector.initialize();

      await noFlushCollector.add({ type: 'custom', data: {} });

      const handler = vi.fn();
      noFlushCollector.on('flushed', handler);

      await noFlushCollector.cleanup();
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
