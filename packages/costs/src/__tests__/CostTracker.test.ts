/**
 * CostTracker Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CostTracker, ScopedCostTracker } from '../core/CostTracker.js';
import { ModelPricingRegistry } from '../pricing/ModelPricingRegistry.js';
import type { CostStorageAdapter, CostRecord } from '../types/index.js';

describe('CostTracker', () => {
  let registry: ModelPricingRegistry;
  let tracker: CostTracker;
  let mockStorage: CostStorageAdapter;

  beforeEach(() => {
    registry = new ModelPricingRegistry();

    mockStorage = {
      initialize: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      saveCostRecords: vi.fn().mockResolvedValue(undefined),
      getCostRecord: vi.fn(),
      queryCostRecords: vi.fn(),
      getCostSummary: vi.fn(),
      getCostsByDimension: vi.fn(),
      getCostTrends: vi.fn(),
      cleanup: vi.fn(),
      getStats: vi.fn(),
      optimize: vi.fn(),
      saveBudget: vi.fn(),
      updateBudget: vi.fn(),
      deleteBudget: vi.fn(),
      getBudget: vi.fn(),
      listBudgets: vi.fn(),
      saveBudgetAlert: vi.fn(),
      saveBudgetHistory: vi.fn(),
    };
  });

  afterEach(() => {
    if (tracker) {
      tracker.close();
    }
  });

  describe('initialization', () => {
    it('should create tracker with default config', () => {
      tracker = new CostTracker({
        pricingRegistry: registry,
      });

      expect(tracker).toBeDefined();
      expect(tracker.getBufferSize()).toBe(0);
    });

    it('should create tracker with custom config', () => {
      tracker = new CostTracker({
        pricingRegistry: registry,
        storage: mockStorage,
        bufferSize: 50,
        realTimeEvents: false,
      });

      expect(tracker).toBeDefined();
    });

    it('should set default attribution', () => {
      tracker = new CostTracker({
        pricingRegistry: registry,
        defaultAttribution: {
          userId: 'user-123',
          projectId: 'project-456',
        },
      });

      expect(tracker).toBeDefined();
    });
  });

  describe('track', () => {
    beforeEach(() => {
      tracker = new CostTracker({
        pricingRegistry: registry,
        storage: mockStorage,
        autoFlushInterval: 0, // Disable auto-flush for tests
      });
    });

    it('should track a basic API call', async () => {
      const record = await tracker.track({
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        tokens: {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
        },
      });

      expect(record).toBeDefined();
      expect(record.id).toBeDefined();
      expect(record.provider).toBe('anthropic');
      expect(record.model).toBe('claude-3-5-sonnet-20241022');
      expect(record.tokens.totalTokens).toBe(150);
      expect(record.cost.totalCost).toBeGreaterThan(0);
      expect(record.success).toBe(true);
    });

    it('should calculate correct costs', async () => {
      const record = await tracker.track({
        provider: 'openai',
        model: 'gpt-4o',
        tokens: {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
        },
      });

      // gpt-4o: $2.5/1M input, $10/1M output
      const expectedInput = (1000 / 1_000_000) * 2.5;
      const expectedOutput = (500 / 1_000_000) * 10.0;

      expect(record.cost.inputCost).toBeCloseTo(expectedInput);
      expect(record.cost.outputCost).toBeCloseTo(expectedOutput);
      expect(record.cost.totalCost).toBeCloseTo(expectedInput + expectedOutput);
    });

    it('should include cache costs when provided', async () => {
      const record = await tracker.track({
        provider: 'anthropic',
        model: 'claude-3-5-haiku-20241022',
        tokens: {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          cacheReadTokens: 200,
          cacheWriteTokens: 100,
        },
      });

      expect(record.cost.cacheReadCost).toBeGreaterThan(0);
      expect(record.cost.cacheCost).toBeGreaterThan(0);
    });

    it('should handle custom timestamp', async () => {
      const customTime = new Date('2024-01-01T12:00:00Z');
      const record = await tracker.track({
        provider: 'openai',
        model: 'gpt-4o',
        tokens: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        timestamp: customTime,
      });

      expect(record.timestamp).toEqual(customTime);
    });

    it('should track latency', async () => {
      const record = await tracker.track({
        provider: 'openai',
        model: 'gpt-4o',
        tokens: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        latencyMs: 1250,
      });

      expect(record.latencyMs).toBe(1250);
    });

    it('should merge attribution with defaults', async () => {
      const tracker = new CostTracker({
        pricingRegistry: registry,
        defaultAttribution: {
          userId: 'default-user',
          environment: 'production',
        },
      });

      const record = await tracker.track({
        provider: 'openai',
        model: 'gpt-4o',
        tokens: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        attribution: {
          projectId: 'project-123',
        },
      });

      expect(record.attribution?.userId).toBe('default-user');
      expect(record.attribution?.environment).toBe('production');
      expect(record.attribution?.projectId).toBe('project-123');
    });

    it('should handle unknown model gracefully', async () => {
      const record = await tracker.track({
        provider: 'custom',
        model: 'unknown-model',
        tokens: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      });

      expect(record.cost.totalCost).toBe(0);
      expect(record.cost.currency).toBe('USD');
    });

    it('should emit real-time event', async () => {
      const eventSpy = vi.fn();
      tracker.on('cost:recorded', eventSpy);

      await tracker.track({
        provider: 'openai',
        model: 'gpt-4o',
        tokens: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      });

      expect(eventSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('trackAnthropicResponse', () => {
    beforeEach(() => {
      tracker = new CostTracker({
        pricingRegistry: registry,
        autoFlushInterval: 0,
      });
    });

    it('should track Anthropic response', async () => {
      const record = await tracker.trackAnthropicResponse({
        model: 'claude-3-5-sonnet-20241022',
        usage: {
          input_tokens: 100,
          output_tokens: 50,
        },
      });

      expect(record.provider).toBe('anthropic');
      expect(record.tokens.inputTokens).toBe(100);
      expect(record.tokens.outputTokens).toBe(50);
    });

    it('should handle cache tokens', async () => {
      const record = await tracker.trackAnthropicResponse({
        model: 'claude-3-5-sonnet-20241022',
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_read_input_tokens: 25,
          cache_creation_input_tokens: 10,
        },
      });

      expect(record.tokens.cacheReadTokens).toBe(25);
      expect(record.tokens.cacheWriteTokens).toBe(10);
    });

    it('should handle missing usage', async () => {
      const record = await tracker.trackAnthropicResponse({
        model: 'claude-3-5-sonnet-20241022',
      });

      expect(record.tokens.inputTokens).toBe(0);
      expect(record.tokens.outputTokens).toBe(0);
    });
  });

  describe('trackOpenAIResponse', () => {
    beforeEach(() => {
      tracker = new CostTracker({
        pricingRegistry: registry,
        autoFlushInterval: 0,
      });
    });

    it('should track OpenAI response', async () => {
      const record = await tracker.trackOpenAIResponse({
        model: 'gpt-4o',
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
      });

      expect(record.provider).toBe('openai');
      expect(record.tokens.inputTokens).toBe(100);
      expect(record.tokens.outputTokens).toBe(50);
      expect(record.tokens.totalTokens).toBe(150);
    });

    it('should handle missing usage', async () => {
      const record = await tracker.trackOpenAIResponse({
        model: 'gpt-4o',
      });

      expect(record.tokens.totalTokens).toBe(0);
    });
  });

  describe('trackError', () => {
    beforeEach(() => {
      tracker = new CostTracker({
        pricingRegistry: registry,
        autoFlushInterval: 0,
      });
    });

    it('should track failed request', async () => {
      const record = await tracker.trackError({
        provider: 'openai',
        model: 'gpt-4o',
        error: 'Rate limit exceeded',
        estimatedInputTokens: 100,
      });

      expect(record.success).toBe(false);
      expect(record.error).toBe('Rate limit exceeded');
      expect(record.tokens.inputTokens).toBe(100);
      expect(record.tokens.outputTokens).toBe(0);
    });
  });

  describe('buffering and flushing', () => {
    beforeEach(() => {
      tracker = new CostTracker({
        pricingRegistry: registry,
        storage: mockStorage,
        bufferSize: 3,
        autoFlushInterval: 0,
      });
    });

    it('should buffer records', async () => {
      await tracker.track({
        provider: 'openai',
        model: 'gpt-4o',
        tokens: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      });

      expect(tracker.getBufferSize()).toBe(1);
    });

    it('should auto-flush when buffer is full', async () => {
      await tracker.track({
        provider: 'openai',
        model: 'gpt-4o',
        tokens: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      });
      await tracker.track({
        provider: 'openai',
        model: 'gpt-4o',
        tokens: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      });
      await tracker.track({
        provider: 'openai',
        model: 'gpt-4o',
        tokens: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      });

      expect(mockStorage.saveCostRecords).toHaveBeenCalledTimes(1);
      expect(tracker.getBufferSize()).toBe(0);
    });

    it('should manually flush buffer', async () => {
      await tracker.track({
        provider: 'openai',
        model: 'gpt-4o',
        tokens: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      });

      const count = await tracker.flush();

      expect(count).toBe(1);
      expect(mockStorage.saveCostRecords).toHaveBeenCalled();
      expect(tracker.getBufferSize()).toBe(0);
    });

    it('should emit batch event on flush', async () => {
      const eventSpy = vi.fn();
      tracker.on('cost:batch', eventSpy);

      await tracker.track({
        provider: 'openai',
        model: 'gpt-4o',
        tokens: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      });
      await tracker.flush();

      expect(eventSpy).toHaveBeenCalledTimes(1);
    });

    it('should get buffer contents', async () => {
      await tracker.track({
        provider: 'openai',
        model: 'gpt-4o',
        tokens: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      });

      const buffer = tracker.getBuffer();
      expect(buffer).toHaveLength(1);
    });

    it('should clear buffer without flushing', async () => {
      await tracker.track({
        provider: 'openai',
        model: 'gpt-4o',
        tokens: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      });

      tracker.clearBuffer();

      expect(tracker.getBufferSize()).toBe(0);
      expect(mockStorage.saveCostRecords).not.toHaveBeenCalled();
    });
  });

  describe('scoped tracker', () => {
    beforeEach(() => {
      tracker = new CostTracker({
        pricingRegistry: registry,
        autoFlushInterval: 0,
      });
    });

    it('should create scoped tracker', () => {
      const scoped = tracker.scoped({ userId: 'user-123' });

      expect(scoped).toBeInstanceOf(ScopedCostTracker);
    });

    it('should apply scoped attribution', async () => {
      const scoped = tracker.scoped({
        userId: 'user-123',
        projectId: 'project-456',
      });

      const record = await scoped.track({
        provider: 'openai',
        model: 'gpt-4o',
        tokens: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      });

      expect(record.attribution?.userId).toBe('user-123');
      expect(record.attribution?.projectId).toBe('project-456');
    });

    it('should merge scoped and call-specific attribution', async () => {
      const scoped = tracker.scoped({ userId: 'user-123' });

      const record = await scoped.track({
        provider: 'openai',
        model: 'gpt-4o',
        tokens: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        attribution: { feature: 'chat' },
      });

      expect(record.attribution?.userId).toBe('user-123');
      expect(record.attribution?.feature).toBe('chat');
    });

    it('should create nested scopes', async () => {
      const scoped1 = tracker.scoped({ userId: 'user-123' });
      const scoped2 = scoped1.scoped({ projectId: 'project-456' });

      const record = await scoped2.track({
        provider: 'openai',
        model: 'gpt-4o',
        tokens: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      });

      expect(record.attribution?.userId).toBe('user-123');
      expect(record.attribution?.projectId).toBe('project-456');
    });
  });

  describe('auto-flush timer', () => {
    it('should auto-flush at intervals', async () => {
      vi.useFakeTimers();

      tracker = new CostTracker({
        pricingRegistry: registry,
        storage: mockStorage,
        autoFlushInterval: 1000,
      });

      await tracker.track({
        provider: 'openai',
        model: 'gpt-4o',
        tokens: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      });

      // Use advanceTimersByTimeAsync to advance time and settle async operations
      // without causing infinite loop from interval rescheduling
      await vi.advanceTimersByTimeAsync(1000);

      expect(mockStorage.saveCostRecords).toHaveBeenCalled();

      // Clean up the tracker to clear the interval before restoring real timers
      await tracker.close();
      vi.useRealTimers();
    });
  });

  describe('close', () => {
    it('should flush on close', async () => {
      tracker = new CostTracker({
        pricingRegistry: registry,
        storage: mockStorage,
        autoFlushInterval: 0,
      });

      await tracker.track({
        provider: 'openai',
        model: 'gpt-4o',
        tokens: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      });

      await tracker.close();

      expect(mockStorage.saveCostRecords).toHaveBeenCalled();
    });

    it('should clear auto-flush timer on close', async () => {
      vi.useFakeTimers();

      tracker = new CostTracker({
        pricingRegistry: registry,
        storage: mockStorage,
        autoFlushInterval: 1000,
      });

      await tracker.close();

      // Use advanceTimersByTimeAsync instead of runAllTimersAsync
      // to avoid infinite loop from any remaining intervals
      await vi.advanceTimersByTimeAsync(2000);

      // Should not flush after close
      expect(mockStorage.saveCostRecords).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });
});
