/**
 * Versioning Types
 *
 * Types for embedding version management and migration.
 */

import type { EmbeddingProviderType, ModelInfo } from './provider.types.js';

/**
 * Embedding version
 */
export interface EmbeddingVersion {
  /** Version ID */
  id: string;
  /** Version name */
  name: string;
  /** Provider type */
  provider: EmbeddingProviderType;
  /** Model ID */
  model: string;
  /** Embedding dimensions */
  dimensions: number;
  /** Version description */
  description?: string;
  /** Created timestamp */
  createdAt: number;
  /** Is active version */
  active: boolean;
  /** Is deprecated */
  deprecated: boolean;
  /** Deprecation reason */
  deprecationReason?: string;
  /** Recommended replacement version */
  replacement?: string;
  /** Model info */
  modelInfo?: ModelInfo;
  /** Version metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Version registry entry
 */
export interface VersionRegistryEntry {
  /** Version info */
  version: EmbeddingVersion;
  /** Document count using this version */
  documentCount: number;
  /** Chunk count using this version */
  chunkCount: number;
  /** First used timestamp */
  firstUsed: number;
  /** Last used timestamp */
  lastUsed: number;
}

/**
 * Version comparison result
 */
export interface VersionComparisonResult {
  /** Source version */
  source: EmbeddingVersion;
  /** Target version */
  target: EmbeddingVersion;
  /** Are versions compatible */
  compatible: boolean;
  /** Dimension change */
  dimensionChange: number;
  /** Provider changed */
  providerChanged: boolean;
  /** Migration required */
  migrationRequired: boolean;
  /** Migration complexity */
  migrationComplexity: 'low' | 'medium' | 'high';
  /** Estimated migration time (minutes) */
  estimatedMigrationTimeMinutes?: number;
  /** Comparison notes */
  notes: string[];
}

/**
 * Migration plan
 */
export interface MigrationPlan {
  /** Plan ID */
  id: string;
  /** Plan name */
  name: string;
  /** Source version */
  sourceVersion: string;
  /** Target version */
  targetVersion: string;
  /** Migration steps */
  steps: MigrationStep[];
  /** Total items to migrate */
  totalItems: number;
  /** Estimated duration (minutes) */
  estimatedDurationMinutes: number;
  /** Created timestamp */
  createdAt: number;
  /** Plan status */
  status: MigrationPlanStatus;
  /** Validation result */
  validation?: MigrationValidation;
  /** Plan metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Migration plan status
 */
export type MigrationPlanStatus =
  | 'draft'
  | 'validated'
  | 'ready'
  | 'in_progress'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Migration step
 */
export interface MigrationStep {
  /** Step ID */
  id: string;
  /** Step type */
  type: MigrationStepType;
  /** Step description */
  description: string;
  /** Step order */
  order: number;
  /** Step status */
  status: MigrationStepStatus;
  /** Items to process */
  itemCount: number;
  /** Items processed */
  processedCount: number;
  /** Step config */
  config?: Record<string, unknown>;
  /** Started at */
  startedAt?: number;
  /** Completed at */
  completedAt?: number;
  /** Error message */
  error?: string;
}

/**
 * Migration step type
 */
export type MigrationStepType =
  | 'backup'
  | 'validate_source'
  | 're_embed'
  | 'transform'
  | 'upsert'
  | 'verify'
  | 'cleanup'
  | 'rollback';

/**
 * Migration step status
 */
export type MigrationStepStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'skipped';

/**
 * Migration validation
 */
export interface MigrationValidation {
  /** Is valid */
  valid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
  /** Validated at */
  validatedAt: number;
}

/**
 * Migration progress
 */
export interface MigrationProgress {
  /** Migration ID */
  migrationId: string;
  /** Current step */
  currentStep: string;
  /** Overall progress (0-100) */
  overallProgress: number;
  /** Step progress (0-100) */
  stepProgress: number;
  /** Items processed */
  itemsProcessed: number;
  /** Total items */
  totalItems: number;
  /** Items per second */
  itemsPerSecond: number;
  /** Estimated remaining time (seconds) */
  estimatedRemainingSeconds: number;
  /** Errors encountered */
  errors: number;
  /** Started at */
  startedAt: number;
  /** Current status */
  status: MigrationPlanStatus;
}

/**
 * Migration result
 */
export interface MigrationResult {
  /** Migration ID */
  migrationId: string;
  /** Success */
  success: boolean;
  /** Source version */
  sourceVersion: string;
  /** Target version */
  targetVersion: string;
  /** Items migrated */
  itemsMigrated: number;
  /** Items failed */
  itemsFailed: number;
  /** Duration (ms) */
  durationMs: number;
  /** Started at */
  startedAt: number;
  /** Completed at */
  completedAt: number;
  /** Errors */
  errors: MigrationError[];
  /** Rollback performed */
  rolledBack: boolean;
  /** Result metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Migration error
 */
export interface MigrationError {
  /** Item ID */
  itemId: string;
  /** Step ID */
  stepId: string;
  /** Error message */
  message: string;
  /** Error code */
  code?: string;
  /** Retryable */
  retryable: boolean;
  /** Timestamp */
  timestamp: number;
}

/**
 * Migration options
 */
export interface MigrationOptions {
  /** Batch size */
  batchSize?: number;
  /** Concurrency */
  concurrency?: number;
  /** Continue on error */
  continueOnError?: boolean;
  /** Max errors before abort */
  maxErrors?: number;
  /** Validate before migration */
  validate?: boolean;
  /** Create backup */
  backup?: boolean;
  /** Backup path */
  backupPath?: string;
  /** Dry run */
  dryRun?: boolean;
  /** Progress callback */
  onProgress?: (progress: MigrationProgress) => void;
  /** Step callback */
  onStep?: (step: MigrationStep) => void;
  /** Error callback */
  onError?: (error: MigrationError) => void;
}

/**
 * Rollback options
 */
export interface RollbackOptions {
  /** Rollback to specific step */
  toStep?: string;
  /** Use backup */
  useBackup?: boolean;
  /** Backup path */
  backupPath?: string;
  /** Force rollback */
  force?: boolean;
}

/**
 * Version upgrade path
 */
export interface VersionUpgradePath {
  /** From version */
  from: string;
  /** To version */
  to: string;
  /** Upgrade steps */
  steps: string[];
  /** Is direct upgrade */
  direct: boolean;
  /** Complexity */
  complexity: 'low' | 'medium' | 'high';
  /** Breaking changes */
  breakingChanges: string[];
}

/**
 * Version registry options
 */
export interface VersionRegistryOptions {
  /** Storage path */
  storagePath?: string;
  /** Auto-register new versions */
  autoRegister?: boolean;
  /** Track usage */
  trackUsage?: boolean;
  /** Max versions to keep */
  maxVersions?: number;
}

/**
 * Version change event
 */
export interface VersionChangeEvent {
  /** Event type */
  type: 'created' | 'activated' | 'deprecated' | 'deleted';
  /** Version ID */
  versionId: string;
  /** Previous version (if applicable) */
  previousVersion?: string;
  /** Timestamp */
  timestamp: number;
  /** Event metadata */
  metadata?: Record<string, unknown>;
}
