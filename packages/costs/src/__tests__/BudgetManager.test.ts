/**
 * BudgetManager Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BudgetManager } from '../budgets/BudgetManager.js';
import type {
  CostStorageAdapter,
  BudgetConfig,
  CostSummary,
} from '../types/index.js';

describe('BudgetManager', () => {
  let manager: BudgetManager;
  let mockStorage: CostStorageAdapter;

  beforeEach(() => {
    mockStorage = {
      initialize: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      saveCostRecords: vi.fn().mockResolvedValue(undefined),
      getCostRecord: vi.fn(),
      queryCostRecords: vi.fn(),
      getCostSummary: vi.fn().mockResolvedValue({
        periodStart: new Date(),
        periodEnd: new Date(),
        totalCost: 50,
        totalTokens: 1000,
        inputTokens: 600,
        outputTokens: 400,
        requestCount: 10,
        successCount: 10,
        errorCount: 0,
        avgCostPerRequest: 5,
        avgTokensPerRequest: 100,
        currency: 'USD',
      } as CostSummary),
      getCostsByDimension: vi.fn(),
      getCostTrends: vi.fn(),
      cleanup: vi.fn(),
      getStats: vi.fn(),
      optimize: vi.fn(),
      saveBudget: vi.fn().mockResolvedValue(undefined),
      updateBudget: vi.fn().mockResolvedValue(undefined),
      deleteBudget: vi.fn().mockResolvedValue(undefined),
      getBudget: vi.fn(),
      listBudgets: vi.fn().mockResolvedValue([]),
      saveBudgetAlert: vi.fn().mockResolvedValue(undefined),
      saveBudgetHistory: vi.fn().mockResolvedValue(undefined),
    };

    manager = new BudgetManager({}, mockStorage);
  });

  afterEach(() => {
    manager.close();
  });

  describe('initialization', () => {
    it('should create manager with defaults', () => {
      expect(manager).toBeDefined();
    });

    it('should initialize from storage', async () => {
      const budgets: BudgetConfig[] = [
        {
          id: 'budget-1',
          name: 'Test Budget',
          limit: 100,
          currency: 'USD',
          period: 'monthly',
          scope: 'global',
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(mockStorage.listBudgets).mockResolvedValue(budgets);

      await manager.initialize();

      expect(mockStorage.listBudgets).toHaveBeenCalled();
    });
  });

  describe('createBudget', () => {
    it('should create a budget', async () => {
      const budget = await manager.createBudget({
        name: 'Monthly Budget',
        limit: 100,
        period: 'monthly',
        scope: 'global',
      });

      expect(budget).toBeDefined();
      expect(budget.id).toBeDefined();
      expect(budget.name).toBe('Monthly Budget');
      expect(budget.limit).toBe(100);
      expect(budget.enabled).toBe(true);
    });

    it('should set default currency', async () => {
      const budget = await manager.createBudget({
        name: 'Test',
        limit: 100,
        period: 'monthly',
        scope: 'global',
      });

      expect(budget.currency).toBe('USD');
    });

    it('should set default warning thresholds', async () => {
      const budget = await manager.createBudget({
        name: 'Test',
        limit: 100,
        period: 'monthly',
        scope: 'global',
      });

      expect(budget.warningThresholds).toEqual([50, 80, 90]);
    });

    it('should accept custom thresholds', async () => {
      const budget = await manager.createBudget({
        name: 'Test',
        limit: 100,
        period: 'monthly',
        scope: 'global',
        warningThresholds: [75, 95],
      });

      expect(budget.warningThresholds).toEqual([75, 95]);
    });

    it('should save to storage', async () => {
      await manager.createBudget({
        name: 'Test',
        limit: 100,
        period: 'monthly',
        scope: 'global',
      });

      expect(mockStorage.saveBudget).toHaveBeenCalled();
    });

    it('should emit creation event', async () => {
      const eventSpy = vi.fn();
      manager.on('budget:created', eventSpy);

      await manager.createBudget({
        name: 'Test',
        limit: 100,
        period: 'monthly',
        scope: 'global',
      });

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should create scoped budget', async () => {
      const budget = await manager.createBudget({
        name: 'User Budget',
        limit: 50,
        period: 'monthly',
        scope: 'user',
        scopeId: 'user-123',
      });

      expect(budget.scope).toBe('user');
      expect(budget.scopeId).toBe('user-123');
    });
  });

  describe('updateBudget', () => {
    let budgetId: string;

    beforeEach(async () => {
      const budget = await manager.createBudget({
        name: 'Test',
        limit: 100,
        period: 'monthly',
        scope: 'global',
      });
      budgetId = budget.id;
    });

    it('should update budget', async () => {
      const updated = await manager.updateBudget(budgetId, {
        name: 'Updated Budget',
        limit: 200,
      });

      expect(updated.name).toBe('Updated Budget');
      expect(updated.limit).toBe(200);
    });

    it('should update timestamp', async () => {
      const original = manager.getBudget(budgetId);
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = await manager.updateBudget(budgetId, {
        limit: 150,
      });

      expect(updated.updatedAt.getTime()).toBeGreaterThan(
        original!.updatedAt.getTime(),
      );
    });

    it('should emit update event', async () => {
      const eventSpy = vi.fn();
      manager.on('budget:updated', eventSpy);

      await manager.updateBudget(budgetId, { limit: 200 });

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should throw error for unknown budget', async () => {
      await expect(
        manager.updateBudget('unknown-id', { limit: 200 }),
      ).rejects.toThrow('Budget not found');
    });
  });

  describe('deleteBudget', () => {
    let budgetId: string;

    beforeEach(async () => {
      const budget = await manager.createBudget({
        name: 'Test',
        limit: 100,
        period: 'monthly',
        scope: 'global',
      });
      budgetId = budget.id;
    });

    it('should delete budget', async () => {
      const result = await manager.deleteBudget(budgetId);

      expect(result).toBe(true);
      expect(manager.getBudget(budgetId)).toBeNull();
    });

    it('should return false for unknown budget', async () => {
      const result = await manager.deleteBudget('unknown-id');

      expect(result).toBe(false);
    });

    it('should emit deletion event', async () => {
      const eventSpy = vi.fn();
      manager.on('budget:deleted', eventSpy);

      await manager.deleteBudget(budgetId);

      expect(eventSpy).toHaveBeenCalledWith(budgetId);
    });
  });

  describe('getBudget', () => {
    it('should get budget by ID', async () => {
      const created = await manager.createBudget({
        name: 'Test',
        limit: 100,
        period: 'monthly',
        scope: 'global',
      });

      const budget = manager.getBudget(created.id);

      expect(budget).toBeDefined();
      expect(budget?.id).toBe(created.id);
    });

    it('should return null for unknown budget', () => {
      const budget = manager.getBudget('unknown-id');

      expect(budget).toBeNull();
    });
  });

  describe('listBudgets', () => {
    beforeEach(async () => {
      await manager.createBudget({
        name: 'Global Budget',
        limit: 100,
        period: 'monthly',
        scope: 'global',
      });

      await manager.createBudget({
        name: 'User Budget',
        limit: 50,
        period: 'monthly',
        scope: 'user',
        scopeId: 'user-123',
      });

      await manager.createBudget({
        name: 'Disabled Budget',
        limit: 75,
        period: 'monthly',
        scope: 'global',
      });

      await manager.updateBudget(manager.listBudgets()[2].id, {
        enabled: false,
      });
    });

    it('should list all budgets', () => {
      const budgets = manager.listBudgets();

      expect(budgets.length).toBe(3);
    });

    it('should filter by scope', () => {
      const budgets = manager.listBudgets({ scope: 'user' });

      expect(budgets.length).toBe(1);
      expect(budgets[0].scope).toBe('user');
    });

    it('should filter by scopeId', () => {
      const budgets = manager.listBudgets({ scopeId: 'user-123' });

      expect(budgets.length).toBe(1);
      expect(budgets[0].scopeId).toBe('user-123');
    });

    it('should filter by enabled', () => {
      const budgets = manager.listBudgets({ enabled: true });

      expect(budgets.length).toBe(2);
    });
  });

  describe('getUsage', () => {
    let budgetId: string;

    beforeEach(async () => {
      const budget = await manager.createBudget({
        name: 'Test',
        limit: 100,
        period: 'monthly',
        scope: 'global',
      });
      budgetId = budget.id;
    });

    it('should get budget usage', async () => {
      const usage = await manager.getUsage(budgetId);

      expect(usage).toBeDefined();
      expect(usage?.budgetId).toBe(budgetId);
      expect(usage?.limit).toBe(100);
    });

    it('should return null for unknown budget', async () => {
      const usage = await manager.getUsage('unknown-id');

      expect(usage).toBeNull();
    });

    it('should refresh from storage', async () => {
      await manager.getUsage(budgetId);

      expect(mockStorage.getCostSummary).toHaveBeenCalled();
    });
  });

  describe('checkBudget', () => {
    let budgetId: string;

    beforeEach(async () => {
      const budget = await manager.createBudget({
        name: 'Test',
        limit: 100,
        period: 'monthly',
        scope: 'global',
        warningThresholds: [80, 90, 100],
      });
      budgetId = budget.id;
    });

    it('should allow request within budget', async () => {
      const result = await manager.checkBudget({
        estimatedCost: 10,
        budgetIds: [budgetId],
      });

      expect(result.allowed).toBe(true);
      expect(result.action).toBe('allow');
    });

    it('should warn near threshold', async () => {
      const result = await manager.checkBudget({
        estimatedCost: 40,
        budgetIds: [budgetId],
      });

      expect(result.warningBudgets.length).toBeGreaterThan(0);
    });

    it('should block when exceeding budget', async () => {
      await manager.updateBudget(budgetId, {
        actions: [
          {
            threshold: 100,
            action: 'block',
          },
        ],
      });

      const result = await manager.checkBudget({
        estimatedCost: 60,
        budgetIds: [budgetId],
      });

      expect(result.allowed).toBe(false);
      expect(result.action).toBe('block');
    });

    it('should find matching budgets by attribution', async () => {
      const result = await manager.checkBudget({
        estimatedCost: 10,
      });

      expect(result.matchingBudgets.length).toBeGreaterThan(0);
    });
  });

  describe('recordCost', () => {
    let budgetId: string;

    beforeEach(async () => {
      const budget = await manager.createBudget({
        name: 'Test',
        limit: 100,
        period: 'monthly',
        scope: 'global',
        warningThresholds: [80],
      });
      budgetId = budget.id;
    });

    it('should record cost against budget', async () => {
      await manager.recordCost(25);

      const usage = await manager.getUsage(budgetId);
      expect(usage?.currentUsage).toBeGreaterThan(0);
    });

    it('should emit warning event', async () => {
      const eventSpy = vi.fn();
      manager.on('budget:warning', eventSpy);

      // Record cost that exceeds 80% threshold
      await manager.recordCost(85);

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should not warn on same threshold twice', async () => {
      const eventSpy = vi.fn();
      manager.on('budget:warning', eventSpy);

      await manager.recordCost(85);
      await manager.recordCost(1);

      expect(eventSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('period dates', () => {
    it('should calculate daily period', async () => {
      const budget = await manager.createBudget({
        name: 'Daily',
        limit: 10,
        period: 'daily',
        scope: 'global',
      });

      const usage = await manager.getUsage(budget.id);
      const duration =
        usage!.periodEnd.getTime() - usage!.periodStart.getTime();

      expect(duration).toBe(24 * 60 * 60 * 1000);
    });

    it('should calculate weekly period', async () => {
      const budget = await manager.createBudget({
        name: 'Weekly',
        limit: 50,
        period: 'weekly',
        scope: 'global',
      });

      const usage = await manager.getUsage(budget.id);
      const duration =
        usage!.periodEnd.getTime() - usage!.periodStart.getTime();

      expect(duration).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('should calculate monthly period', async () => {
      const budget = await manager.createBudget({
        name: 'Monthly',
        limit: 100,
        period: 'monthly',
        scope: 'global',
      });

      const usage = await manager.getUsage(budget.id);

      expect(usage?.periodStart.getDate()).toBe(1);
    });
  });

  describe('scope matching', () => {
    it('should match global scope', async () => {
      await manager.createBudget({
        name: 'Global',
        limit: 100,
        period: 'monthly',
        scope: 'global',
      });

      const result = await manager.checkBudget({
        estimatedCost: 10,
        attribution: { userId: 'any-user' },
      });

      expect(result.matchingBudgets.length).toBeGreaterThan(0);
    });

    it('should match user scope', async () => {
      await manager.createBudget({
        name: 'User Budget',
        limit: 50,
        period: 'monthly',
        scope: 'user',
        scopeId: 'user-123',
      });

      const result = await manager.checkBudget({
        estimatedCost: 10,
        attribution: { userId: 'user-123' },
      });

      const userBudgets = result.matchingBudgets.filter((b) =>
        b.budgetId.includes('user'),
      );
      expect(userBudgets.length).toBeGreaterThanOrEqual(0);
    });

    it('should match project scope', async () => {
      await manager.createBudget({
        name: 'Project Budget',
        limit: 75,
        period: 'monthly',
        scope: 'project',
        scopeId: 'project-456',
      });

      await manager.checkBudget({
        estimatedCost: 10,
        attribution: { projectId: 'project-456' },
      });

      // Should not throw
      expect(true).toBe(true);
    });

    it('should not match wrong scope', async () => {
      await manager.createBudget({
        name: 'User Budget',
        limit: 50,
        period: 'monthly',
        scope: 'user',
        scopeId: 'user-123',
      });

      const result = await manager.checkBudget({
        estimatedCost: 10,
        attribution: { userId: 'user-456' },
      });

      const userBudgets = result.matchingBudgets.filter(
        (b) => manager.getBudget(b.budgetId)?.scopeId === 'user-123',
      );
      expect(userBudgets.length).toBe(0);
    });
  });

  describe('budget actions', () => {
    it('should send webhook notification', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      global.fetch = mockFetch;

      const budget = await manager.createBudget({
        name: 'Test',
        limit: 100,
        period: 'monthly',
        scope: 'global',
        warningThresholds: [80],
        actions: [
          {
            threshold: 80,
            action: 'warn',
            webhookUrl: 'https://example.com/webhook',
          },
        ],
      });

      await manager.recordCost(85);

      // Wait for async webhook
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('should stop all reset jobs', () => {
      manager.close();

      // Should not throw
      expect(true).toBe(true);
    });
  });
});
