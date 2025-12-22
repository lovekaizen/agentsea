/**
 * Storage Type Definitions
 */

import type { PromptData, PromptQueryOptions } from './prompt.types.js';
import type { VersionHistoryEntry, BranchInfo } from './version.types.js';
import type {
  ABTestData,
  MetricRecord,
  VariantAssignment,
} from './testing.types.js';
import type {
  ReviewRequest,
  Comment,
  AuditLogEntry,
  AuditLogQueryOptions,
} from './collaboration.types.js';
import type { PromotionRequest } from './environment.types.js';

/**
 * Storage adapter interface
 */
export interface StorageAdapter {
  /**
   * Initialize storage (create tables, directories, etc.)
   */
  initialize(): Promise<void>;

  /**
   * Close storage connections
   */
  close(): Promise<void>;

  // Prompt operations
  savePrompt(prompt: PromptData): Promise<void>;
  getPrompt(id: string, environment: string): Promise<PromptData | null>;
  getPromptByName(
    name: string,
    environment: string,
  ): Promise<PromptData | null>;
  queryPrompts(options: PromptQueryOptions): Promise<PromptData[]>;
  deletePrompt(id: string): Promise<boolean>;

  // Version operations
  saveVersion(version: VersionHistoryEntry): Promise<void>;
  getVersion(
    promptId: string,
    version: string,
  ): Promise<VersionHistoryEntry | null>;
  getVersionHistory(
    promptId: string,
    limit?: number,
  ): Promise<VersionHistoryEntry[]>;

  // Branch operations
  saveBranch(branch: BranchInfo): Promise<void>;
  getBranch(promptId: string, name: string): Promise<BranchInfo | null>;
  getBranches(promptId: string): Promise<BranchInfo[]>;
  deleteBranch(promptId: string, name: string): Promise<boolean>;

  // A/B Test operations
  saveTest(test: ABTestData): Promise<void>;
  getTest(id: string): Promise<ABTestData | null>;
  getTestByName(name: string): Promise<ABTestData | null>;
  getTestsForPrompt(promptName: string): Promise<ABTestData[]>;
  updateTestStatus(id: string, status: string): Promise<void>;

  // Test metric operations
  saveMetricRecord(record: MetricRecord): Promise<void>;
  getMetricRecords(testId: string, metric?: string): Promise<MetricRecord[]>;
  saveVariantAssignment(assignment: VariantAssignment): Promise<void>;
  getVariantAssignment(
    testId: string,
    userId: string,
  ): Promise<VariantAssignment | null>;

  // Review operations
  saveReview(review: ReviewRequest): Promise<void>;
  getReview(id: string): Promise<ReviewRequest | null>;
  getReviewsForPrompt(promptId: string): Promise<ReviewRequest[]>;
  updateReview(id: string, updates: Partial<ReviewRequest>): Promise<void>;

  // Comment operations
  saveComment(comment: Comment): Promise<void>;
  getComments(reviewId: string): Promise<Comment[]>;
  updateComment(id: string, updates: Partial<Comment>): Promise<void>;

  // Promotion operations
  savePromotionRequest(request: PromotionRequest): Promise<void>;
  getPromotionRequest(id: string): Promise<PromotionRequest | null>;
  getPendingPromotions(environment?: string): Promise<PromotionRequest[]>;
  updatePromotionRequest(
    id: string,
    updates: Partial<PromotionRequest>,
  ): Promise<void>;

  // Audit log operations
  saveAuditLog(entry: AuditLogEntry): Promise<void>;
  queryAuditLog(options: AuditLogQueryOptions): Promise<AuditLogEntry[]>;

  // Partial operations
  savePartial(name: string, template: string): Promise<void>;
  getPartial(name: string): Promise<string | null>;
  getAllPartials(): Promise<Record<string, string>>;
  deletePartial(name: string): Promise<boolean>;
}

/**
 * File storage configuration
 */
export interface FileStorageConfig {
  path: string;
  format?: 'json' | 'yaml';
  gitIntegration?: boolean;
}

/**
 * SQLite storage configuration
 */
export interface SQLiteStorageConfig {
  filename: string;
  verbose?: boolean;
}

/**
 * PostgreSQL storage configuration
 */
export interface PostgresStorageConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean;
  schema?: string;
}

/**
 * S3 storage configuration
 */
export interface S3StorageConfig {
  bucket: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string; // For S3-compatible services
  prefix?: string;
}

/**
 * Migration info
 */
export interface MigrationInfo {
  version: number;
  name: string;
  appliedAt?: Date;
}
