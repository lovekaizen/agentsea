/**
 * Storage Types
 *
 * Type definitions for cost data storage adapters.
 */

import type {
  CostRecord,
  CostQueryOptions,
  CostSummary,
  CostByDimension,
  CostTrendPoint,
} from './cost.types.js';
import type {
  BudgetConfig,
  BudgetUsage,
  BudgetHistoryEntry,
  BudgetAlert,
} from './budget.types.js';
import type {
  AttributedCost,
  AttributionSummary,
} from './attribution.types.js';
import type { Alert, AlertRule } from './alert.types.js';

/**
 * Storage adapter interface
 */
export interface CostStorageAdapter {
  /** Initialize storage */
  initialize(): Promise<void>;

  /** Close storage connection */
  close(): Promise<void>;

  // Cost Records
  /** Save a cost record */
  saveCostRecord(record: CostRecord): Promise<void>;

  /** Save multiple cost records */
  saveCostRecords(records: CostRecord[]): Promise<void>;

  /** Get a cost record by ID */
  getCostRecord(id: string): Promise<CostRecord | null>;

  /** Query cost records */
  queryCostRecords(options: CostQueryOptions): Promise<CostRecord[]>;

  /** Get cost summary */
  getCostSummary(options: CostQueryOptions): Promise<CostSummary>;

  /** Get costs by dimension */
  getCostsByDimension(
    dimension: string,
    options: CostQueryOptions,
  ): Promise<CostByDimension[]>;

  /** Get cost trends */
  getCostTrends(options: CostQueryOptions): Promise<CostTrendPoint[]>;

  /** Delete cost records */
  deleteCostRecords(ids: string[]): Promise<number>;

  /** Delete cost records by filter */
  deleteCostRecordsByFilter(options: CostQueryOptions): Promise<number>;

  // Budgets
  /** Save a budget */
  saveBudget(budget: BudgetConfig): Promise<void>;

  /** Get a budget by ID */
  getBudget(id: string): Promise<BudgetConfig | null>;

  /** List all budgets */
  listBudgets(options?: {
    scope?: string;
    scopeId?: string;
    enabled?: boolean;
  }): Promise<BudgetConfig[]>;

  /** Update a budget */
  updateBudget(id: string, updates: Partial<BudgetConfig>): Promise<void>;

  /** Delete a budget */
  deleteBudget(id: string): Promise<boolean>;

  /** Get budget usage */
  getBudgetUsage(budgetId: string): Promise<BudgetUsage>;

  /** Save budget history */
  saveBudgetHistory(entry: BudgetHistoryEntry): Promise<void>;

  /** Get budget history */
  getBudgetHistory(
    budgetId: string,
    limit?: number,
  ): Promise<BudgetHistoryEntry[]>;

  /** Save budget alert */
  saveBudgetAlert(alert: BudgetAlert): Promise<void>;

  /** Get budget alerts */
  getBudgetAlerts(budgetId: string): Promise<BudgetAlert[]>;

  // Attribution
  /** Save attributed cost */
  saveAttributedCost(attributed: AttributedCost): Promise<void>;

  /** Save multiple attributed costs */
  saveAttributedCosts(attributed: AttributedCost[]): Promise<void>;

  /** Get attribution summary */
  getAttributionSummary(
    dimension: string,
    options: CostQueryOptions,
  ): Promise<AttributionSummary>;

  // Alerts
  /** Save alert rule */
  saveAlertRule(rule: AlertRule): Promise<void>;

  /** Get alert rule */
  getAlertRule(id: string): Promise<AlertRule | null>;

  /** List alert rules */
  listAlertRules(options?: { enabled?: boolean }): Promise<AlertRule[]>;

  /** Update alert rule */
  updateAlertRule(id: string, updates: Partial<AlertRule>): Promise<void>;

  /** Delete alert rule */
  deleteAlertRule(id: string): Promise<boolean>;

  /** Save alert */
  saveAlert(alert: Alert): Promise<void>;

  /** Get alert */
  getAlert(id: string): Promise<Alert | null>;

  /** Query alerts */
  queryAlerts(options?: {
    status?: string[];
    severity?: string[];
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<Alert[]>;

  /** Update alert */
  updateAlert(id: string, updates: Partial<Alert>): Promise<void>;

  // Maintenance
  /** Cleanup old records */
  cleanup(olderThan: Date): Promise<number>;

  /** Get storage stats */
  getStats(): Promise<StorageStats>;

  /** Optimize storage (vacuum, reindex, etc.) */
  optimize(): Promise<void>;
}

/**
 * Storage statistics
 */
export interface StorageStats {
  /** Total cost records */
  costRecordCount: number;
  /** Total budgets */
  budgetCount: number;
  /** Total alert rules */
  alertRuleCount: number;
  /** Total alerts */
  alertCount: number;
  /** Storage size in bytes */
  storageSizeBytes?: number;
  /** Oldest record date */
  oldestRecord?: Date;
  /** Newest record date */
  newestRecord?: Date;
  /** Index information */
  indexes?: IndexInfo[];
}

/**
 * Index information
 */
export interface IndexInfo {
  /** Index name */
  name: string;
  /** Table/collection */
  table: string;
  /** Columns/fields */
  columns: string[];
  /** Size in bytes */
  sizeBytes?: number;
}

/**
 * SQLite storage configuration
 */
export interface SQLiteStorageConfig {
  /** Database file path */
  path: string;
  /** Enable WAL mode */
  walMode?: boolean;
  /** Busy timeout in ms */
  busyTimeout?: number;
  /** Enable foreign keys */
  foreignKeys?: boolean;
  /** Synchronous mode */
  synchronous?: 'off' | 'normal' | 'full' | 'extra';
  /** Cache size (pages) */
  cacheSize?: number;
  /** Auto vacuum */
  autoVacuum?: 'none' | 'full' | 'incremental';
}

/**
 * PostgreSQL storage configuration
 */
export interface PostgresStorageConfig {
  /** Connection string or config */
  connection: string | PostgresConnectionConfig;
  /** Schema name */
  schema?: string;
  /** Pool size */
  poolSize?: number;
  /** Connection timeout in ms */
  connectionTimeout?: number;
  /** Idle timeout in ms */
  idleTimeout?: number;
  /** Enable SSL */
  ssl?: boolean | PostgresSSLConfig;
}

/**
 * PostgreSQL connection config
 */
export interface PostgresConnectionConfig {
  /** Host */
  host: string;
  /** Port */
  port?: number;
  /** Database name */
  database: string;
  /** Username */
  user: string;
  /** Password */
  password: string;
}

/**
 * PostgreSQL SSL config
 */
export interface PostgresSSLConfig {
  /** Reject unauthorized */
  rejectUnauthorized?: boolean;
  /** CA certificate */
  ca?: string;
  /** Client certificate */
  cert?: string;
  /** Client key */
  key?: string;
}

/**
 * Buffer storage configuration
 */
export interface BufferStorageConfig {
  /** Maximum records to keep */
  maxRecords?: number;
  /** Auto-flush interval in ms (0 = disabled) */
  autoFlushInterval?: number;
  /** Flush callback */
  onFlush?: (records: CostRecord[]) => Promise<void>;
}

/**
 * Storage migration
 */
export interface StorageMigration {
  /** Migration version */
  version: number;
  /** Migration name */
  name: string;
  /** Apply migration */
  up: (adapter: CostStorageAdapter) => Promise<void>;
  /** Rollback migration */
  down: (adapter: CostStorageAdapter) => Promise<void>;
}

/**
 * Storage factory options
 */
export type StorageFactoryOptions =
  | { type: 'sqlite'; config: SQLiteStorageConfig }
  | { type: 'postgres'; config: PostgresStorageConfig }
  | { type: 'buffer'; config?: BufferStorageConfig }
  | { type: 'custom'; adapter: CostStorageAdapter };
