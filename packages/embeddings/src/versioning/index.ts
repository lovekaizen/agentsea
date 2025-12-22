/**
 * Versioning Module Exports
 */

export { VersionRegistry, createVersionRegistry } from './VersionRegistry.js';

// Re-export versioning types
export type {
  EmbeddingVersion,
  VersionRegistryEntry,
  VersionComparisonResult,
  MigrationPlan,
  MigrationPlanStatus,
  MigrationStep,
  MigrationStepType,
  MigrationStepStatus,
  MigrationValidation,
  MigrationProgress,
  MigrationResult,
  MigrationError,
  MigrationOptions,
  RollbackOptions,
  VersionUpgradePath,
  VersionRegistryOptions,
  VersionChangeEvent,
} from '../types/index.js';
