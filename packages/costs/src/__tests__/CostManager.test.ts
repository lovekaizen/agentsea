/**
 * CostManager Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CostManager, createCostManager } from '../core/CostManager.js';
import type { CostStorageAdapter } from '../types/index.js';

describe('CostManager', () => {
  let manager: CostManager;
  let mockStorage: CostStorageAdapter;

  beforeEach(() => {
    mockStorage = {
      initialize: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      saveCostRecords: vi.fn().mockResolvedValue(undefined),
      getCostRecord: vi.fn().mockResolvedValue(null),
      queryCostRecords: vi.fn().mockResolvedValue([]),
      getCostSummary: vi.fn().mockResolvedValue({
        periodStart: new Date(),
        periodEnd: new Date(),
        totalCost: 100,
        totalTokens: 1000,
        inputTokens: 600,
        outputTokens: 400,
        requestCount: 10,
        successCount: 9,
        errorCount: 1,
        avgCostPerRequest: 10,
        avgTokensPerRequest: 100,
        currency: 'USD',
      }),
      getCostsByDimension: vi.fn().mockResolvedValue([]),
      getCostTrends: vi.fn().mockResolvedValue([]),
      cleanup: vi.fn().mockResolvedValue(0),
      getStats: vi.fn().mockResolvedValue({
        costRecordCount: 0,
      }),
      optimize: vi.fn().mockResolvedValue(undefined),
      saveBudget: vi.fn(),
      updateBudget: vi.fn(),
      deleteBudget: vi.fn(),
      getBudget: vi.fn(),
      listBudgets: vi.fn(),
      saveBudgetAlert: vi.fn(),
      saveBudgetHistory: vi.fn(),
    };
  });

  describe('initialization', () => {
    it('should create manager with defaults', () => {
      manager = new CostManager();

      expect(manager).toBeDefined();
      expect(manager.getPricingRegistry()).toBeDefined();
      expect(manager.getTokenCounter()).toBeDefined();
    });

    it('should create manager with storage', () => {
      manager = new CostManager({ storage: mockStorage });

      expect(manager).toBeDefined();
    });

    it('should initialize with storage', async () => {
      manager = new CostManager({ storage: mockStorage });

      await manager.initialize();

      expect(mockStorage.initialize).toHaveBeenCalled();
    });

    it('should not initialize twice', async () => {
      manager = new CostManager({ storage: mockStorage });

      await manager.initialize();
      await manager.initialize();

      expect(mockStorage.initialize).toHaveBeenCalledTimes(1);
    });

    it('should create with factory function', () => {
      manager = createCostManager();

      expect(manager).toBeInstanceOf(CostManager);
    });
  });

  describe('tracking', () => {
    beforeEach(() => {
      manager = new CostManager({ autoFlushInterval: 0 });
    });

    it('should track API call', async () => {
      const record = await manager.track({
        provider: 'openai',
        model: 'gpt-4o',
        tokens: {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
        },
      });

      expect(record).toBeDefined();
      expect(record.provider).toBe('openai');
      expect(record.model).toBe('gpt-4o');
    });

    it('should track Anthropic response', async () => {
      const record = await manager.trackAnthropicResponse({
        model: 'claude-sonnet-4-6',
        usage: {
          input_tokens: 100,
          output_tokens: 50,
        },
      });

      expect(record.provider).toBe('anthropic');
    });

    it('should track OpenAI response', async () => {
      const record = await manager.trackOpenAIResponse({
        model: 'gpt-4o',
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
      });

      expect(record.provider).toBe('openai');
    });

    it('should track error', async () => {
      const record = await manager.trackError({
        provider: 'openai',
        model: 'gpt-4o',
        error: 'API error',
      });

      expect(record.success).toBe(false);
      expect(record.error).toBe('API error');
    });

    it('should create scoped tracker', async () => {
      const scoped = manager.scoped({ userId: 'user-123' });

      const record = await scoped.track({
        provider: 'openai',
        model: 'gpt-4o',
        tokens: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      });

      expect(record.attribution?.userId).toBe('user-123');
    });

    it('should flush pending records', async () => {
      manager = new CostManager({
        storage: mockStorage,
        autoFlushInterval: 0,
      });

      await manager.track({
        provider: 'openai',
        model: 'gpt-4o',
        tokens: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      });

      const count = await manager.flush();

      expect(count).toBe(1);
      expect(mockStorage.saveCostRecords).toHaveBeenCalled();
    });
  });

  describe('token counting', () => {
    beforeEach(() => {
      manager = new CostManager();
    });

    it('should count tokens in text', async () => {
      const count = await manager.countTokens('Hello world!');

      expect(count).toBeGreaterThan(0);
    });

    it('should count tokens with model', async () => {
      const count = await manager.countTokens('Hello world!', {
        model: 'gpt-4o',
      });

      expect(count).toBeGreaterThan(0);
    });

    it('should estimate cost', async () => {
      const estimate = await manager.estimateCost('Hello world!', {
        model: 'gpt-4o',
        estimatedOutputTokens: 100,
      });

      expect(estimate.estimatedCost).toBeGreaterThan(0);
      expect(estimate.inputTokens).toBeGreaterThan(0);
      expect(estimate.outputTokens).toBe(100);
      expect(estimate.currency).toBe('USD');
    });

    it('should estimate cost from token count', async () => {
      const estimate = await manager.estimateCost(500, {
        model: 'gpt-4o',
        estimatedOutputTokens: 200,
      });

      expect(estimate.inputTokens).toBe(500);
      expect(estimate.outputTokens).toBe(200);
    });
  });

  describe('pricing', () => {
    beforeEach(() => {
      manager = new CostManager();
    });

    it('should get pricing registry', () => {
      const registry = manager.getPricingRegistry();

      expect(registry).toBeDefined();
      expect(registry.listProviders().length).toBeGreaterThan(0);
    });

    it('should get token counter', () => {
      const counter = manager.getTokenCounter();

      expect(counter).toBeDefined();
    });

    it('should calculate cost', () => {
      const result = manager.calculateCost('openai', 'gpt-4o', {
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
      });

      expect(result.totalCost).toBeGreaterThan(0);
      expect(result.inputCost).toBeGreaterThan(0);
      expect(result.outputCost).toBeGreaterThan(0);
      expect(result.currency).toBe('USD');
    });
  });

  describe('queries', () => {
    beforeEach(() => {
      manager = new CostManager({ storage: mockStorage });
    });

    it('should get cost summary', async () => {
      const summary = await manager.getSummary();

      expect(summary).toBeDefined();
      expect(summary.totalCost).toBe(100);
      expect(mockStorage.getCostSummary).toHaveBeenCalled();
    });

    it('should get costs by dimension', async () => {
      await manager.getCostsByDimension('model');

      expect(mockStorage.getCostsByDimension).toHaveBeenCalledWith('model', {});
    });

    it('should get cost trends', async () => {
      await manager.getCostTrends();

      expect(mockStorage.getCostTrends).toHaveBeenCalled();
    });

    it('should query records', async () => {
      await manager.queryRecords({ limit: 10 });

      expect(mockStorage.queryCostRecords).toHaveBeenCalledWith({ limit: 10 });
    });

    it('should get specific record', async () => {
      await manager.getRecord('record-123');

      expect(mockStorage.getCostRecord).toHaveBeenCalledWith('record-123');
    });

    it('should throw error if no storage', async () => {
      manager = new CostManager();

      await expect(manager.getSummary()).rejects.toThrow(
        'Storage adapter required',
      );
    });
  });

  describe('statistics', () => {
    beforeEach(() => {
      manager = new CostManager({ storage: mockStorage });
    });

    it('should get total cost', async () => {
      const total = await manager.getTotalCost();

      expect(total).toBe(100);
    });

    it('should get total tokens', async () => {
      const total = await manager.getTotalTokens();

      expect(total).toBe(1000);
    });

    it('should get request count', async () => {
      const count = await manager.getRequestCount();

      expect(count).toBe(10);
    });

    it('should get error rate', async () => {
      const rate = await manager.getErrorRate();

      expect(rate).toBe(0.1); // 1/10
    });

    it('should handle zero requests for error rate', async () => {
      vi.mocked(mockStorage.getCostSummary).mockResolvedValue({
        periodStart: new Date(),
        periodEnd: new Date(),
        totalCost: 0,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        requestCount: 0,
        successCount: 0,
        errorCount: 0,
        avgCostPerRequest: 0,
        avgTokensPerRequest: 0,
        currency: 'USD',
      });

      const rate = await manager.getErrorRate();

      expect(rate).toBe(0);
    });

    it('should get average cost per request', async () => {
      const avg = await manager.getAvgCostPerRequest();

      expect(avg).toBe(10);
    });
  });

  describe('top consumers', () => {
    beforeEach(() => {
      manager = new CostManager({ storage: mockStorage });

      vi.mocked(mockStorage.getCostsByDimension).mockResolvedValue([
        {
          dimension: 'model',
          value: 'gpt-4o',
          totalCost: 100,
          totalTokens: 1000,
          requestCount: 10,
          percentage: 60,
        },
        {
          dimension: 'model',
          value: 'claude-sonnet-4-6',
          totalCost: 66,
          totalTokens: 800,
          requestCount: 8,
          percentage: 40,
        },
      ]);
    });

    it('should get top models', async () => {
      const topModels = await manager.getTopModels();

      expect(topModels).toHaveLength(2);
      expect(topModels[0].value).toBe('gpt-4o');
    });

    it('should limit top models', async () => {
      const topModels = await manager.getTopModels({ limit: 1 });

      expect(topModels).toHaveLength(1);
    });

    it('should get top users', async () => {
      await manager.getTopUsers();

      expect(mockStorage.getCostsByDimension).toHaveBeenCalledWith('user', {});
    });

    it('should get top features', async () => {
      await manager.getTopFeatures();

      expect(mockStorage.getCostsByDimension).toHaveBeenCalledWith(
        'feature',
        {},
      );
    });
  });

  describe('maintenance', () => {
    beforeEach(() => {
      manager = new CostManager({ storage: mockStorage });
    });

    it('should cleanup old records', async () => {
      const olderThan = new Date('2024-01-01');

      await manager.cleanup(olderThan);

      expect(mockStorage.cleanup).toHaveBeenCalledWith(olderThan);
    });

    it('should get storage stats', async () => {
      vi.mocked(mockStorage.getStats).mockResolvedValue({
        costRecordCount: 1000,
        storageSizeBytes: 50000,
        oldestRecord: new Date('2024-01-01'),
        newestRecord: new Date('2024-12-01'),
      });

      const stats = await manager.getStorageStats();

      expect(stats.recordCount).toBe(1000);
      expect(stats.storageSizeBytes).toBe(50000);
    });

    it('should handle missing storage for stats', async () => {
      manager = new CostManager();

      const stats = await manager.getStorageStats();

      expect(stats.recordCount).toBe(0);
    });

    it('should optimize storage', async () => {
      await manager.optimizeStorage();

      expect(mockStorage.optimize).toHaveBeenCalled();
    });
  });

  describe('export/import', () => {
    beforeEach(() => {
      manager = new CostManager({ storage: mockStorage });
    });

    it('should export records', async () => {
      const exported = await manager.exportRecords();

      expect(exported.records).toBeDefined();
      expect(exported.summary).toBeDefined();
      expect(exported.exportedAt).toBeInstanceOf(Date);
    });

    it('should import records', async () => {
      const records = [
        {
          id: 'rec-1',
          timestamp: new Date(),
          provider: 'openai' as const,
          model: 'gpt-4o',
          tokens: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          cost: {
            inputCost: 0.01,
            outputCost: 0.02,
            totalCost: 0.03,
            currency: 'USD',
          },
          success: true,
        },
      ];

      const count = await manager.importRecords(records);

      expect(count).toBe(1);
      expect(mockStorage.saveCostRecords).toHaveBeenCalledWith(records);
    });
  });

  describe('close', () => {
    it('should close manager', async () => {
      manager = new CostManager({ storage: mockStorage });

      await manager.close();

      expect(mockStorage.close).toHaveBeenCalled();
    });

    it('should flush on close', async () => {
      manager = new CostManager({
        storage: mockStorage,
        autoFlushInterval: 0,
      });

      await manager.track({
        provider: 'openai',
        model: 'gpt-4o',
        tokens: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      });

      await manager.close();

      expect(mockStorage.saveCostRecords).toHaveBeenCalled();
    });
  });

  describe('events', () => {
    it('should forward cost:recorded event', async () => {
      manager = new CostManager({ autoFlushInterval: 0 });

      const eventSpy = vi.fn();
      manager.on('cost:recorded', eventSpy);

      await manager.track({
        provider: 'openai',
        model: 'gpt-4o',
        tokens: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      });

      expect(eventSpy).toHaveBeenCalledTimes(1);
    });

    it('should forward cost:batch event', async () => {
      manager = new CostManager({
        storage: mockStorage,
        autoFlushInterval: 0,
      });

      const eventSpy = vi.fn();
      manager.on('cost:batch', eventSpy);

      await manager.track({
        provider: 'openai',
        model: 'gpt-4o',
        tokens: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      });

      await manager.flush();

      expect(eventSpy).toHaveBeenCalled();
    });
  });
});
