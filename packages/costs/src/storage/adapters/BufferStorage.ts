/**
 * Buffer Storage Adapter
 *
 * In-memory storage adapter for development and testing.
 */

import type {
  CostStorageAdapter,
  CostRecord,
  CostQueryOptions,
  CostSummary,
  CostByDimension,
  CostTrendPoint,
  BudgetConfig,
  BudgetUsage,
  BudgetHistoryEntry,
  BudgetAlert,
  AttributedCost,
  AttributionSummary,
  Alert,
  AlertRule,
  StorageStats,
  BufferStorageConfig,
  TimeGranularity,
} from '../../types/index.js';

/**
 * Buffer Storage Adapter
 */
export class BufferStorage implements CostStorageAdapter {
  private records: Map<string, CostRecord> = new Map();
  private budgets: Map<string, BudgetConfig> = new Map();
  private budgetHistory: Map<string, BudgetHistoryEntry[]> = new Map();
  private budgetAlerts: Map<string, BudgetAlert[]> = new Map();
  private attributedCosts: AttributedCost[] = [];
  private alertRules: Map<string, AlertRule> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private config: BufferStorageConfig;
  private flushTimer?: ReturnType<typeof setInterval>;

  constructor(config: BufferStorageConfig = {}) {
    this.config = {
      maxRecords: config.maxRecords ?? 10000,
      autoFlushInterval: config.autoFlushInterval ?? 0,
      onFlush: config.onFlush,
    };

    if (this.config.autoFlushInterval && this.config.autoFlushInterval > 0) {
      this.flushTimer = setInterval(() => {
        void (async () => {
          if (this.config.onFlush) {
            const records = Array.from(this.records.values());
            await this.config.onFlush(records);
          }
        })();
      }, this.config.autoFlushInterval);
    }
  }

  async initialize(): Promise<void> {
    // No initialization needed for in-memory storage
  }

  close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    return Promise.resolve();
  }

  // ==================== Cost Records ====================

  saveCostRecord(record: CostRecord): Promise<void> {
    this.enforceLimit();
    this.records.set(record.id, record);
    return Promise.resolve();
  }

  async saveCostRecords(records: CostRecord[]): Promise<void> {
    for (const record of records) {
      await this.saveCostRecord(record);
    }
  }

  getCostRecord(id: string): Promise<CostRecord | null> {
    return Promise.resolve(this.records.get(id) ?? null);
  }

  queryCostRecords(options: CostQueryOptions): Promise<CostRecord[]> {
    let results = Array.from(this.records.values());
    results = this.applyFilters(results, options);
    results = this.applySort(results, options);
    results = this.applyPagination(results, options);
    return Promise.resolve(results);
  }

  async getCostSummary(options: CostQueryOptions): Promise<CostSummary> {
    const records = await this.queryCostRecords(options);

    const summary: CostSummary = {
      periodStart: options.startDate ?? new Date(0),
      periodEnd: options.endDate ?? new Date(),
      totalCost: 0,
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      requestCount: records.length,
      successCount: 0,
      errorCount: 0,
      avgCostPerRequest: 0,
      avgTokensPerRequest: 0,
      currency: 'USD',
    };

    let totalLatency = 0;
    let latencyCount = 0;

    for (const record of records) {
      summary.totalCost += record.cost.totalCost;
      summary.totalTokens += record.tokens.totalTokens;
      summary.inputTokens += record.tokens.inputTokens;
      summary.outputTokens += record.tokens.outputTokens;

      if (record.success) {
        summary.successCount++;
      } else {
        summary.errorCount++;
      }

      if (record.latencyMs) {
        totalLatency += record.latencyMs;
        latencyCount++;
      }
    }

    if (summary.requestCount > 0) {
      summary.avgCostPerRequest = summary.totalCost / summary.requestCount;
      summary.avgTokensPerRequest = summary.totalTokens / summary.requestCount;
    }

    if (latencyCount > 0) {
      summary.avgLatencyMs = totalLatency / latencyCount;
    }

    return summary;
  }

  async getCostsByDimension(
    dimension: string,
    options: CostQueryOptions,
  ): Promise<CostByDimension[]> {
    const records = await this.queryCostRecords(options);
    const groups = new Map<
      string,
      { cost: number; tokens: number; count: number }
    >();

    let totalCost = 0;

    for (const record of records) {
      const value = this.getDimensionValue(record, dimension);
      if (!value) continue;

      const existing = groups.get(value) ?? { cost: 0, tokens: 0, count: 0 };
      existing.cost += record.cost.totalCost;
      existing.tokens += record.tokens.totalTokens;
      existing.count++;
      groups.set(value, existing);

      totalCost += record.cost.totalCost;
    }

    return Array.from(groups.entries()).map(([value, data]) => ({
      dimension,
      value,
      totalCost: data.cost,
      totalTokens: data.tokens,
      requestCount: data.count,
      percentage: totalCost > 0 ? (data.cost / totalCost) * 100 : 0,
    }));
  }

  async getCostTrends(options: CostQueryOptions): Promise<CostTrendPoint[]> {
    const records = await this.queryCostRecords(options);
    const granularity = options.granularity ?? 'day';
    const buckets = new Map<number, CostTrendPoint>();

    for (const record of records) {
      const bucketTime = this.getBucketTime(record.timestamp, granularity);
      const existing = buckets.get(bucketTime) ?? {
        timestamp: new Date(bucketTime),
        cost: 0,
        tokens: 0,
        requests: 0,
      };

      existing.cost += record.cost.totalCost;
      existing.tokens += record.tokens.totalTokens;
      existing.requests++;

      buckets.set(bucketTime, existing);
    }

    return Array.from(buckets.values()).sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );
  }

  deleteCostRecords(ids: string[]): Promise<number> {
    let deleted = 0;
    for (const id of ids) {
      if (this.records.delete(id)) {
        deleted++;
      }
    }
    return Promise.resolve(deleted);
  }

  async deleteCostRecordsByFilter(options: CostQueryOptions): Promise<number> {
    const toDelete = await this.queryCostRecords(options);
    return this.deleteCostRecords(toDelete.map((r) => r.id));
  }

  // ==================== Budgets ====================

  saveBudget(budget: BudgetConfig): Promise<void> {
    this.budgets.set(budget.id, budget);
    return Promise.resolve();
  }

  getBudget(id: string): Promise<BudgetConfig | null> {
    return Promise.resolve(this.budgets.get(id) ?? null);
  }

  listBudgets(options?: {
    scope?: string;
    scopeId?: string;
    enabled?: boolean;
  }): Promise<BudgetConfig[]> {
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

    return Promise.resolve(budgets);
  }

  updateBudget(id: string, updates: Partial<BudgetConfig>): Promise<void> {
    const budget = this.budgets.get(id);
    if (budget) {
      this.budgets.set(id, { ...budget, ...updates });
    }
    return Promise.resolve();
  }

  deleteBudget(id: string): Promise<boolean> {
    return Promise.resolve(this.budgets.delete(id));
  }

  getBudgetUsage(budgetId: string): Promise<BudgetUsage> {
    const budget = this.budgets.get(budgetId);
    if (!budget) {
      throw new Error(`Budget not found: ${budgetId}`);
    }

    // Calculate current usage from records
    const now = new Date();
    const periodStart = this.getPeriodStart(budget.period, now);

    const records = Array.from(this.records.values()).filter(
      (r) => r.timestamp >= periodStart && this.matchesBudgetScope(r, budget),
    );

    const currentUsage = records.reduce((sum, r) => sum + r.cost.totalCost, 0);

    return Promise.resolve({
      budgetId,
      currentUsage,
      limit: budget.limit,
      usagePercentage: (currentUsage / budget.limit) * 100,
      remaining: Math.max(0, budget.limit - currentUsage),
      periodStart,
      periodEnd: this.getPeriodEnd(budget.period, periodStart),
      timeRemaining:
        this.getPeriodEnd(budget.period, periodStart).getTime() - now.getTime(),
      status: currentUsage >= budget.limit ? 'exceeded' : 'active',
      triggeredThresholds: [],
    });
  }

  saveBudgetHistory(entry: BudgetHistoryEntry): Promise<void> {
    const existing = this.budgetHistory.get(entry.budgetId) ?? [];
    existing.push(entry);
    this.budgetHistory.set(entry.budgetId, existing);
    return Promise.resolve();
  }

  getBudgetHistory(
    budgetId: string,
    limit?: number,
  ): Promise<BudgetHistoryEntry[]> {
    const history = this.budgetHistory.get(budgetId) ?? [];
    return Promise.resolve(limit ? history.slice(-limit) : history);
  }

  saveBudgetAlert(alert: BudgetAlert): Promise<void> {
    const existing = this.budgetAlerts.get(alert.budgetId) ?? [];
    existing.push(alert);
    this.budgetAlerts.set(alert.budgetId, existing);
    return Promise.resolve();
  }

  getBudgetAlerts(budgetId: string): Promise<BudgetAlert[]> {
    return Promise.resolve(this.budgetAlerts.get(budgetId) ?? []);
  }

  // ==================== Attribution ====================

  saveAttributedCost(attributed: AttributedCost): Promise<void> {
    this.attributedCosts.push(attributed);
    return Promise.resolve();
  }

  saveAttributedCosts(attributed: AttributedCost[]): Promise<void> {
    this.attributedCosts.push(...attributed);
    return Promise.resolve();
  }

  getAttributionSummary(
    dimension: string,
    options: CostQueryOptions,
  ): Promise<AttributionSummary> {
    const costs = this.attributedCosts.filter(
      (c) =>
        c.dimension === dimension &&
        (!options.startDate || c.timestamp >= options.startDate) &&
        (!options.endDate || c.timestamp <= options.endDate),
    );

    const groups = new Map<
      string,
      { cost: number; tokens: number; requests: number }
    >();
    let totalCost = 0;

    for (const cost of costs) {
      const existing = groups.get(cost.dimensionValue) ?? {
        cost: 0,
        tokens: 0,
        requests: 0,
      };
      existing.cost += cost.attributedCost;
      existing.requests++;
      groups.set(cost.dimensionValue, existing);
      totalCost += cost.attributedCost;
    }

    return Promise.resolve({
      dimension: dimension as AttributionSummary['dimension'],
      breakdown: Array.from(groups.entries()).map(([value, data]) => ({
        value,
        cost: data.cost,
        tokens: data.tokens,
        requests: data.requests,
        percentage: totalCost > 0 ? (data.cost / totalCost) * 100 : 0,
      })),
      totalCost,
      periodStart: options.startDate ?? new Date(0),
      periodEnd: options.endDate ?? new Date(),
    });
  }

  // ==================== Alerts ====================

  saveAlertRule(rule: AlertRule): Promise<void> {
    this.alertRules.set(rule.id, rule);
    return Promise.resolve();
  }

  getAlertRule(id: string): Promise<AlertRule | null> {
    return Promise.resolve(this.alertRules.get(id) ?? null);
  }

  listAlertRules(options?: { enabled?: boolean }): Promise<AlertRule[]> {
    let rules = Array.from(this.alertRules.values());

    if (options?.enabled !== undefined) {
      rules = rules.filter((r) => r.enabled === options.enabled);
    }

    return Promise.resolve(rules);
  }

  updateAlertRule(id: string, updates: Partial<AlertRule>): Promise<void> {
    const rule = this.alertRules.get(id);
    if (rule) {
      this.alertRules.set(id, { ...rule, ...updates });
    }
    return Promise.resolve();
  }

  deleteAlertRule(id: string): Promise<boolean> {
    return Promise.resolve(this.alertRules.delete(id));
  }

  saveAlert(alert: Alert): Promise<void> {
    this.alerts.set(alert.id, alert);
    return Promise.resolve();
  }

  getAlert(id: string): Promise<Alert | null> {
    return Promise.resolve(this.alerts.get(id) ?? null);
  }

  queryAlerts(options?: {
    status?: string[];
    severity?: string[];
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<Alert[]> {
    let alerts = Array.from(this.alerts.values());

    if (options?.status) {
      alerts = alerts.filter((a) => options.status!.includes(a.status));
    }
    if (options?.severity) {
      alerts = alerts.filter((a) => options.severity!.includes(a.severity));
    }
    if (options?.startDate) {
      alerts = alerts.filter((a) => a.triggeredAt >= options.startDate!);
    }
    if (options?.endDate) {
      alerts = alerts.filter((a) => a.triggeredAt <= options.endDate!);
    }

    alerts.sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime());

    if (options?.offset) {
      alerts = alerts.slice(options.offset);
    }
    if (options?.limit) {
      alerts = alerts.slice(0, options.limit);
    }

    return Promise.resolve(alerts);
  }

  updateAlert(id: string, updates: Partial<Alert>): Promise<void> {
    const alert = this.alerts.get(id);
    if (alert) {
      this.alerts.set(id, { ...alert, ...updates });
    }
    return Promise.resolve();
  }

  // ==================== Maintenance ====================

  cleanup(olderThan: Date): Promise<number> {
    const toDelete: string[] = [];

    for (const [id, record] of this.records) {
      if (record.timestamp < olderThan) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      this.records.delete(id);
    }

    return Promise.resolve(toDelete.length);
  }

  getStats(): Promise<StorageStats> {
    const records = Array.from(this.records.values());

    let oldestRecord: Date | undefined;
    let newestRecord: Date | undefined;

    for (const record of records) {
      if (!oldestRecord || record.timestamp < oldestRecord) {
        oldestRecord = record.timestamp;
      }
      if (!newestRecord || record.timestamp > newestRecord) {
        newestRecord = record.timestamp;
      }
    }

    return Promise.resolve({
      costRecordCount: this.records.size,
      budgetCount: this.budgets.size,
      alertRuleCount: this.alertRules.size,
      alertCount: this.alerts.size,
      oldestRecord,
      newestRecord,
    });
  }

  async optimize(): Promise<void> {
    // No optimization needed for in-memory storage
  }

  // ==================== Helper Methods ====================

  private enforceLimit(): void {
    if (this.config.maxRecords && this.records.size >= this.config.maxRecords) {
      // Remove oldest records
      const sorted = Array.from(this.records.entries()).sort(
        (a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime(),
      );

      const toRemove = sorted.slice(
        0,
        Math.floor(this.config.maxRecords * 0.1),
      );
      for (const [id] of toRemove) {
        this.records.delete(id);
      }
    }
  }

  private applyFilters(
    records: CostRecord[],
    options: CostQueryOptions,
  ): CostRecord[] {
    return records.filter((record) => {
      if (options.startDate && record.timestamp < options.startDate)
        return false;
      if (options.endDate && record.timestamp > options.endDate) return false;
      if (options.providers && !options.providers.includes(record.provider))
        return false;
      if (options.models && !options.models.includes(record.model))
        return false;
      if (
        options.userIds &&
        !options.userIds.includes(record.attribution?.userId ?? '')
      )
        return false;
      if (
        options.agentIds &&
        !options.agentIds.includes(record.attribution?.agentId ?? '')
      )
        return false;
      if (
        options.sessionIds &&
        !options.sessionIds.includes(record.attribution?.sessionId ?? '')
      )
        return false;
      if (
        options.projectIds &&
        !options.projectIds.includes(record.attribution?.projectId ?? '')
      )
        return false;
      if (
        options.teamIds &&
        !options.teamIds.includes(record.attribution?.teamId ?? '')
      )
        return false;
      if (
        options.features &&
        !options.features.includes(record.attribution?.feature ?? '')
      )
        return false;
      if (
        options.environment &&
        record.attribution?.environment !== options.environment
      )
        return false;
      if (options.success !== undefined && record.success !== options.success)
        return false;

      return true;
    });
  }

  private applySort(
    records: CostRecord[],
    options: CostQueryOptions,
  ): CostRecord[] {
    const sortBy = options.sortBy ?? 'timestamp';
    const sortOrder = options.sortOrder ?? 'desc';

    return records.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'cost':
          comparison = a.cost.totalCost - b.cost.totalCost;
          break;
        case 'tokens':
          comparison = a.tokens.totalTokens - b.tokens.totalTokens;
          break;
        case 'timestamp':
        default:
          comparison = a.timestamp.getTime() - b.timestamp.getTime();
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }

  private applyPagination(
    records: CostRecord[],
    options: CostQueryOptions,
  ): CostRecord[] {
    let result = records;

    if (options.offset) {
      result = result.slice(options.offset);
    }
    if (options.limit) {
      result = result.slice(0, options.limit);
    }

    return result;
  }

  private getDimensionValue(
    record: CostRecord,
    dimension: string,
  ): string | undefined {
    switch (dimension) {
      case 'provider':
        return record.provider;
      case 'model':
        return record.model;
      case 'user':
        return record.attribution?.userId;
      case 'agent':
        return record.attribution?.agentId;
      case 'session':
        return record.attribution?.sessionId;
      case 'project':
        return record.attribution?.projectId;
      case 'team':
        return record.attribution?.teamId;
      case 'feature':
        return record.attribution?.feature;
      case 'environment':
        return record.attribution?.environment;
      default:
        return record.attribution?.labels?.[dimension];
    }
  }

  private getBucketTime(date: Date, granularity: TimeGranularity): number {
    const d = new Date(date);

    switch (granularity) {
      case 'minute':
        d.setSeconds(0, 0);
        break;
      case 'hour':
        d.setMinutes(0, 0, 0);
        break;
      case 'day':
        d.setHours(0, 0, 0, 0);
        break;
      case 'week': {
        const day = d.getDay();
        d.setDate(d.getDate() - day);
        d.setHours(0, 0, 0, 0);
        break;
      }
      case 'month':
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        break;
    }

    return d.getTime();
  }

  private matchesBudgetScope(
    record: CostRecord,
    budget: BudgetConfig,
  ): boolean {
    if (budget.scope === 'global') return true;

    switch (budget.scope) {
      case 'user':
        return record.attribution?.userId === budget.scopeId;
      case 'agent':
        return record.attribution?.agentId === budget.scopeId;
      case 'project':
        return record.attribution?.projectId === budget.scopeId;
      case 'team':
        return record.attribution?.teamId === budget.scopeId;
      case 'feature':
        return record.attribution?.feature === budget.scopeId;
      case 'model':
        return record.model === budget.scopeId;
      case 'provider':
        return record.provider === budget.scopeId;
      default:
        return false;
    }
  }

  private getPeriodStart(period: string, now: Date): Date {
    const d = new Date(now);

    switch (period) {
      case 'hourly':
        d.setMinutes(0, 0, 0);
        break;
      case 'daily':
        d.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        d.setDate(d.getDate() - d.getDay());
        d.setHours(0, 0, 0, 0);
        break;
      case 'monthly':
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        break;
      case 'quarterly':
        d.setMonth(Math.floor(d.getMonth() / 3) * 3, 1);
        d.setHours(0, 0, 0, 0);
        break;
      case 'yearly':
        d.setMonth(0, 1);
        d.setHours(0, 0, 0, 0);
        break;
    }

    return d;
  }

  private getPeriodEnd(period: string, start: Date): Date {
    const d = new Date(start);

    switch (period) {
      case 'hourly':
        d.setHours(d.getHours() + 1);
        break;
      case 'daily':
        d.setDate(d.getDate() + 1);
        break;
      case 'weekly':
        d.setDate(d.getDate() + 7);
        break;
      case 'monthly':
        d.setMonth(d.getMonth() + 1);
        break;
      case 'quarterly':
        d.setMonth(d.getMonth() + 3);
        break;
      case 'yearly':
        d.setFullYear(d.getFullYear() + 1);
        break;
    }

    return d;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.records.clear();
    this.budgets.clear();
    this.budgetHistory.clear();
    this.budgetAlerts.clear();
    this.attributedCosts = [];
    this.alertRules.clear();
    this.alerts.clear();
  }
}
