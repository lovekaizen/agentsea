/**
 * Budget Manager
 *
 * Manages budgets, enforces limits, and tracks usage.
 */

import { EventEmitter } from 'eventemitter3';
import { Cron } from 'croner';
import { nanoid } from 'nanoid';
import type {
  BudgetConfig,
  BudgetUsage,
  BudgetCheckRequest,
  BudgetCheckResult,
  BudgetHistoryEntry,
  BudgetAlert,
  BudgetManagerConfig,
  BudgetPeriod,
  BudgetScope,
  CreateBudgetRequest,
  UpdateBudgetRequest,
  CostAttribution,
  CostStorageAdapter,
  CostQueryOptions,
} from '../types/index.js';

/**
 * Budget events
 */
export interface BudgetEvents {
  'budget:created': BudgetConfig;
  'budget:updated': { budgetId: string; updates: Partial<BudgetConfig> };
  'budget:deleted': string;
  'budget:warning': BudgetAlert;
  'budget:exceeded': BudgetAlert;
  'budget:reset': { budgetId: string; previousUsage: number };
  error: { message: string; cause?: unknown };
}

/**
 * Budget Manager class
 */
export class BudgetManager extends EventEmitter<BudgetEvents> {
  private budgets: Map<string, BudgetConfig> = new Map();
  private usage: Map<string, BudgetUsage> = new Map();
  private resetJobs: Map<string, Cron> = new Map();
  private storage?: CostStorageAdapter;
  private config: BudgetManagerConfig;

  constructor(config: BudgetManagerConfig = {}, storage?: CostStorageAdapter) {
    super();
    this.config = {
      enforceOnRequest: config.enforceOnRequest ?? true,
      defaultAction: config.defaultAction ?? 'allow',
      checkInterval: config.checkInterval ?? 60000, // 1 minute
      enableProjections: config.enableProjections ?? true,
      ...config,
    };
    this.storage = storage;
  }

  /**
   * Initialize from storage
   */
  async initialize(): Promise<void> {
    if (this.storage) {
      const budgets = await this.storage.listBudgets();
      for (const budget of budgets) {
        this.budgets.set(budget.id, budget);
        this.scheduleReset(budget);
      }

      // Load current usage for each budget
      for (const budget of this.budgets.values()) {
        await this.refreshUsage(budget.id);
      }
    }
  }

  /**
   * Create a new budget
   */
  async createBudget(request: CreateBudgetRequest): Promise<BudgetConfig> {
    const budget: BudgetConfig = {
      id: nanoid(),
      name: request.name,
      description: request.description,
      limit: request.limit,
      currency: request.currency ?? 'USD',
      period: request.period,
      scope: request.scope,
      scopeId: request.scopeId,
      warningThresholds: request.warningThresholds ?? [50, 80, 90],
      actions: request.actions,
      filters: request.filters,
      rollover: request.rollover ?? false,
      maxRollover: request.maxRollover,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.budgets.set(budget.id, budget);

    // Initialize usage
    const usage = this.initializeUsage(budget);
    this.usage.set(budget.id, usage);

    // Schedule reset job
    this.scheduleReset(budget);

    // Save to storage
    if (this.storage) {
      await this.storage.saveBudget(budget);
    }

    this.emit('budget:created', budget);
    return budget;
  }

  /**
   * Update a budget
   */
  async updateBudget(
    budgetId: string,
    updates: UpdateBudgetRequest,
  ): Promise<BudgetConfig> {
    const budget = this.budgets.get(budgetId);
    if (!budget) {
      throw new Error(`Budget not found: ${budgetId}`);
    }

    const updated: BudgetConfig = {
      ...budget,
      ...updates,
      updatedAt: new Date(),
    };

    this.budgets.set(budgetId, updated);

    // Reschedule if period changed
    if (updates.enabled !== undefined || updates.limit) {
      this.scheduleReset(updated);
    }

    // Save to storage
    if (this.storage) {
      await this.storage.updateBudget(budgetId, updated);
    }

    this.emit('budget:updated', { budgetId, updates });
    return updated;
  }

  /**
   * Delete a budget
   */
  async deleteBudget(budgetId: string): Promise<boolean> {
    const budget = this.budgets.get(budgetId);
    if (!budget) {
      return false;
    }

    // Cancel reset job
    const job = this.resetJobs.get(budgetId);
    if (job) {
      job.stop();
      this.resetJobs.delete(budgetId);
    }

    this.budgets.delete(budgetId);
    this.usage.delete(budgetId);

    // Delete from storage
    if (this.storage) {
      await this.storage.deleteBudget(budgetId);
    }

    this.emit('budget:deleted', budgetId);
    return true;
  }

  /**
   * Get a budget
   */
  getBudget(budgetId: string): BudgetConfig | null {
    return this.budgets.get(budgetId) ?? null;
  }

  /**
   * List all budgets
   */
  listBudgets(options?: {
    scope?: BudgetScope;
    scopeId?: string;
    enabled?: boolean;
  }): BudgetConfig[] {
    let budgets = Array.from(this.budgets.values());

    if (options?.scope) {
      budgets = budgets.filter((b) => b.scope === options.scope);
    }
    if (options?.scopeId) {
      budgets = budgets.filter((b) => b.scopeId === options.scopeId);
    }
    if (options?.enabled !== undefined) {
      budgets = budgets.filter((b) => b.enabled === options.enabled);
    }

    return budgets;
  }

  /**
   * Get budget usage
   */
  async getUsage(budgetId: string): Promise<BudgetUsage | null> {
    const budget = this.budgets.get(budgetId);
    if (!budget) {
      return null;
    }

    // Refresh usage from storage
    await this.refreshUsage(budgetId);
    return this.usage.get(budgetId) ?? null;
  }

  /**
   * Check if a request is within budget
   */
  async checkBudget(request: BudgetCheckRequest): Promise<BudgetCheckResult> {
    const matchingBudgets: BudgetUsage[] = [];
    const exceededBudgets: string[] = [];
    const warningBudgets: string[] = [];

    // Find matching budgets
    const budgetsToCheck = request.budgetIds
      ? (request.budgetIds
          .map((id) => this.budgets.get(id))
          .filter(Boolean) as BudgetConfig[])
      : this.findMatchingBudgets(request.attribution);

    for (const budget of budgetsToCheck) {
      if (!budget.enabled) continue;

      await this.refreshUsage(budget.id);
      const usage = this.usage.get(budget.id);
      if (!usage) continue;

      matchingBudgets.push(usage);

      // Check if would exceed
      const projectedUsage = usage.currentUsage + request.estimatedCost;
      const projectedPercentage = (projectedUsage / usage.limit) * 100;

      if (projectedPercentage >= 100) {
        exceededBudgets.push(budget.id);
      } else if (projectedPercentage >= (budget.warningThresholds?.[0] ?? 50)) {
        warningBudgets.push(budget.id);
      }
    }

    // Determine action
    let action: BudgetCheckResult['action'] = 'allow';
    let reason: string | undefined;

    if (exceededBudgets.length > 0) {
      const budget = this.budgets.get(exceededBudgets[0]);
      const budgetAction = budget?.actions?.find((a) => a.threshold >= 100);

      if (budgetAction?.action === 'block') {
        action = 'block';
        reason = `Budget limit exceeded for "${budget?.name}"`;
      } else if (budgetAction?.action === 'throttle') {
        action = 'throttle';
        reason = `Budget limit exceeded for "${budget?.name}"`;
      } else {
        action = this.config.defaultAction ?? 'allow';
        if (action !== 'allow') {
          reason = `Budget limit exceeded for "${budget?.name}"`;
        }
      }
    }

    return {
      allowed: action === 'allow' || action === 'warn',
      reason,
      matchingBudgets,
      exceededBudgets,
      warningBudgets,
      action,
    };
  }

  /**
   * Record cost against budgets
   */
  async recordCost(cost: number, attribution?: CostAttribution): Promise<void> {
    const matchingBudgets = this.findMatchingBudgets(attribution);

    for (const budget of matchingBudgets) {
      if (!budget.enabled) continue;

      const usage = this.usage.get(budget.id);
      if (!usage) continue;

      // Update usage
      usage.currentUsage += cost;
      usage.remaining = Math.max(0, usage.limit - usage.currentUsage);
      usage.usagePercentage = (usage.currentUsage / usage.limit) * 100;

      // Check thresholds
      await this.checkThresholds(budget, usage);

      // Update projections
      if (this.config.enableProjections) {
        this.updateProjections(usage);
      }
    }
  }

  /**
   * Find budgets matching attribution
   */
  private findMatchingBudgets(attribution?: CostAttribution): BudgetConfig[] {
    const matching: BudgetConfig[] = [];

    for (const budget of this.budgets.values()) {
      if (!budget.enabled) continue;

      // Check scope
      if (budget.scope === 'global') {
        matching.push(budget);
        continue;
      }

      if (!attribution) continue;

      // Match by scope
      let matches = false;
      switch (budget.scope) {
        case 'user':
          matches = budget.scopeId === attribution.userId;
          break;
        case 'agent':
          matches = budget.scopeId === attribution.agentId;
          break;
        case 'project':
          matches = budget.scopeId === attribution.projectId;
          break;
        case 'team':
          matches = budget.scopeId === attribution.teamId;
          break;
        case 'feature':
          matches = budget.scopeId === attribution.feature;
          break;
      }

      if (!matches) continue;

      // Check filters
      if (budget.filters) {
        if (
          budget.filters.environment &&
          budget.filters.environment !== attribution.environment
        ) {
          continue;
        }
        // Add more filter checks as needed
      }

      matching.push(budget);
    }

    return matching;
  }

  /**
   * Initialize usage for a budget
   */
  private initializeUsage(budget: BudgetConfig): BudgetUsage {
    const period = this.getPeriodDates(budget.period);

    return {
      budgetId: budget.id,
      currentUsage: 0,
      limit: budget.limit,
      usagePercentage: 0,
      remaining: budget.limit,
      periodStart: period.start,
      periodEnd: period.end,
      timeRemaining: this.getTimeRemaining(period.end),
      status: 'active',
      triggeredThresholds: [],
    };
  }

  /**
   * Refresh usage from storage
   */
  private async refreshUsage(budgetId: string): Promise<void> {
    const budget = this.budgets.get(budgetId);
    if (!budget) return;

    let usage = this.usage.get(budgetId);
    if (!usage) {
      usage = this.initializeUsage(budget);
      this.usage.set(budgetId, usage);
    }

    // Update time remaining
    usage.timeRemaining = this.getTimeRemaining(usage.periodEnd);

    // Query actual usage from storage
    if (this.storage) {
      const queryOptions: CostQueryOptions = {
        startDate: usage.periodStart,
        endDate: usage.periodEnd,
      };

      // Add scope filter
      if (budget.scope !== 'global' && budget.scopeId) {
        switch (budget.scope) {
          case 'user':
            queryOptions.userIds = [budget.scopeId];
            break;
          case 'agent':
            queryOptions.agentIds = [budget.scopeId];
            break;
          case 'project':
            queryOptions.projectIds = [budget.scopeId];
            break;
          case 'team':
            queryOptions.teamIds = [budget.scopeId];
            break;
          case 'feature':
            queryOptions.features = [budget.scopeId];
            break;
        }
      }

      try {
        const summary = await this.storage.getCostSummary(queryOptions);
        usage.currentUsage = summary.totalCost;
        usage.remaining = Math.max(0, budget.limit - usage.currentUsage);
        usage.usagePercentage = (usage.currentUsage / budget.limit) * 100;

        // Update status
        if (usage.usagePercentage >= 100) {
          usage.status = 'exceeded';
        } else if (!budget.enabled) {
          usage.status = 'paused';
        } else {
          usage.status = 'active';
        }
      } catch {
        // Ignore errors, use cached value
      }
    }
  }

  /**
   * Check thresholds and emit alerts
   */
  private async checkThresholds(
    budget: BudgetConfig,
    usage: BudgetUsage,
  ): Promise<void> {
    if (!budget.warningThresholds) return;

    for (const threshold of budget.warningThresholds) {
      if (
        usage.usagePercentage >= threshold &&
        !usage.triggeredThresholds.includes(threshold)
      ) {
        // Mark threshold as triggered
        usage.triggeredThresholds.push(threshold);

        // Create alert
        const alert: BudgetAlert = {
          id: nanoid(),
          budgetId: budget.id,
          budgetName: budget.name,
          type: threshold >= 100 ? 'exceeded' : 'warning',
          threshold,
          usage: usage.currentUsage,
          limit: usage.limit,
          percentage: usage.usagePercentage,
          message:
            threshold >= 100
              ? `Budget "${budget.name}" has been exceeded (${usage.usagePercentage.toFixed(1)}%)`
              : `Budget "${budget.name}" has reached ${threshold}% (${usage.usagePercentage.toFixed(1)}%)`,
          timestamp: new Date(),
          acknowledged: false,
        };

        // Save alert
        if (this.storage) {
          await this.storage.saveBudgetAlert(alert);
        }

        // Emit event
        if (threshold >= 100) {
          this.emit('budget:exceeded', alert);
        } else {
          this.emit('budget:warning', alert);
        }

        // Execute actions
        const action = budget.actions?.find((a) => a.threshold === threshold);
        if (action) {
          await this.executeAction(action, alert);
        }
      }
    }
  }

  /**
   * Execute threshold action
   */
  private async executeAction(
    action: NonNullable<BudgetConfig['actions']>[0],
    alert: BudgetAlert,
  ): Promise<void> {
    // Send notifications
    if (action.notifyEmails && action.notifyEmails.length > 0) {
      // Would integrate with email service
      console.log(
        `Would send email to ${action.notifyEmails.join(', ')}:`,
        alert.message,
      );
    }

    if (action.webhookUrl) {
      try {
        await fetch(action.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alert),
        });
      } catch {
        this.emit('error', {
          message: `Failed to send webhook to ${action.webhookUrl}`,
        });
      }
    }
  }

  /**
   * Update projections
   */
  private updateProjections(usage: BudgetUsage): void {
    if (usage.timeRemaining <= 0) return;

    const elapsedMs = Date.now() - usage.periodStart.getTime();
    const totalMs = usage.periodEnd.getTime() - usage.periodStart.getTime();

    if (elapsedMs <= 0) return;

    const rate = usage.currentUsage / elapsedMs;
    usage.projectedUsage = rate * totalMs;
    usage.projectedExceed = usage.projectedUsage > usage.limit;
  }

  /**
   * Schedule budget reset
   */
  private scheduleReset(budget: BudgetConfig): void {
    // Cancel existing job
    const existingJob = this.resetJobs.get(budget.id);
    if (existingJob) {
      existingJob.stop();
    }

    if (!budget.enabled) return;

    // Get cron pattern for period
    const pattern = this.getCronPattern(budget.period, budget.resetSchedule);
    if (!pattern) return;

    const job = new Cron(pattern, async () => {
      await this.resetBudget(budget.id);
    });

    this.resetJobs.set(budget.id, job);
  }

  /**
   * Reset a budget
   */
  private async resetBudget(budgetId: string): Promise<void> {
    const budget = this.budgets.get(budgetId);
    if (!budget) return;

    const usage = this.usage.get(budgetId);
    if (!usage) return;

    const previousUsage = usage.currentUsage;

    // Save history
    if (this.storage) {
      const historyEntry: BudgetHistoryEntry = {
        budgetId,
        periodStart: usage.periodStart,
        periodEnd: usage.periodEnd,
        usage: previousUsage,
        limit: usage.limit,
        usagePercentage: usage.usagePercentage,
        exceeded: previousUsage > usage.limit,
        rolloverIn: usage.rolloverIn,
        rolloverOut: budget.rollover
          ? Math.min(usage.remaining, budget.maxRollover ?? Infinity)
          : undefined,
      };
      await this.storage.saveBudgetHistory(historyEntry);
    }

    // Calculate rollover
    let newLimit = budget.limit;
    if (budget.rollover && usage.remaining > 0) {
      const rolloverAmount = Math.min(
        usage.remaining,
        budget.maxRollover ?? Infinity,
      );
      newLimit += rolloverAmount;
    }

    // Reset usage
    const period = this.getPeriodDates(budget.period);
    usage.currentUsage = 0;
    usage.limit = newLimit;
    usage.remaining = newLimit;
    usage.usagePercentage = 0;
    usage.periodStart = period.start;
    usage.periodEnd = period.end;
    usage.timeRemaining = this.getTimeRemaining(period.end);
    usage.status = 'active';
    usage.triggeredThresholds = [];
    usage.projectedUsage = undefined;
    usage.projectedExceed = undefined;

    this.emit('budget:reset', { budgetId, previousUsage });
  }

  /**
   * Get period dates
   */
  private getPeriodDates(period: BudgetPeriod): { start: Date; end: Date } {
    const now = new Date();
    let start: Date;
    let end: Date;

    switch (period) {
      case 'hourly':
        start = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          now.getHours(),
        );
        end = new Date(start.getTime() + 60 * 60 * 1000);
        break;
      case 'daily':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'weekly': {
        const dayOfWeek = now.getDay();
        start = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - dayOfWeek,
        );
        end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      }
      case 'monthly':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        break;
      case 'quarterly': {
        const quarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), quarter * 3, 1);
        end = new Date(now.getFullYear(), (quarter + 1) * 3, 1);
        break;
      }
      case 'yearly':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear() + 1, 0, 1);
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }

    return { start, end };
  }

  /**
   * Get time remaining in period
   */
  private getTimeRemaining(endDate: Date): number {
    return Math.max(0, endDate.getTime() - Date.now());
  }

  /**
   * Get cron pattern for period
   */
  private getCronPattern(
    period: BudgetPeriod,
    customSchedule?: string,
  ): string | null {
    if (customSchedule) return customSchedule;

    switch (period) {
      case 'hourly':
        return '0 * * * *'; // Every hour at minute 0
      case 'daily':
        return '0 0 * * *'; // Every day at midnight
      case 'weekly':
        return '0 0 * * 0'; // Every Sunday at midnight
      case 'monthly':
        return '0 0 1 * *'; // First of every month
      case 'quarterly':
        return '0 0 1 1,4,7,10 *'; // First of Jan, Apr, Jul, Oct
      case 'yearly':
        return '0 0 1 1 *'; // First of January
      default:
        return null;
    }
  }

  /**
   * Close budget manager
   */
  close(): void {
    for (const job of this.resetJobs.values()) {
      job.stop();
    }
    this.resetJobs.clear();
  }
}
