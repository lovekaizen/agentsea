/**
 * @lov3kaizen/agentsea-prompts
 *
 * Self-hosted prompt management with Git-like version control,
 * environment promotion, A/B testing, and team collaboration.
 */

// Core exports
export {
  Prompt,
  PromptVersion,
  VersionHistory,
  PromptTemplate,
  Partial,
  compose,
  createComposedTemplate,
  PromptRegistry,
} from './core/index.js';

// Storage exports
export { FileStorage, BufferStorage } from './storage/index.js';

// Testing exports
export { ABTest, createABTestConfig } from './testing/index.js';

// SDK exports
export {
  PromptClient,
  PromptLoader,
  createDynamicPrompt,
  type PromptClientConfig,
} from './sdk/Client.js';

// Integration exports
export {
  PromptProvider,
  createSystemPrompt,
  createABTestPrompt,
  type PromptProviderConfig,
  type DynamicPromptConfig,
} from './integrations/agentsea/index.js';

// Type exports
export type {
  // Prompt types
  PromptData,
  PromptMetadata,
  PromptStatus,
  VariableDefinition,
  VariableDefinitions,
  VariableType,
  CreatePromptInput,
  UpdatePromptInput,
  PromptQueryOptions,
  RenderOptions,
  RenderedPrompt,

  // Version types
  VersionInfo,
  VersionHistoryEntry,
  DiffResult,
  DiffHunk,
  DiffLine,
  DiffLineType,
  DiffOptions,
  BranchInfo,
  CreateBranchInput,
  MergeOptions,
  MergeResult,
  MergeStrategy,
  MergeConflict,
  RollbackOptions,
  RollbackResult,

  // Environment types
  EnvironmentConfig,
  PromoteInput,
  PromotionResult,
  PromotionRequest,
  PromotionStatus,
  EnvironmentSyncStatus,
  EnvironmentComparison,

  // Testing types
  ABTestConfig,
  ABTestData,
  ABTestStatus,
  ABTestResults,
  TestVariant,
  VariantStats,
  MetricComparison,
  MetricRecord,
  VariantAssignment,
  GetVariantOptions,
  TestCase,
  TestCaseResult,
  TestRunResult,
  TestAssertion,
  AssertionType,

  // Collaboration types
  ReviewRequest,
  ReviewStatus,
  ReviewApproval,
  CreateReviewInput,
  Comment,
  CreateCommentInput,
  Permission,
  Role,
  UserPermissions,
  AccessCheck,
  AccessCheckResult,
  AuditLogEntry,
  AuditAction,
  AuditLogQueryOptions,

  // Storage types
  StorageAdapter,
  FileStorageConfig,
  SQLiteStorageConfig,
  PostgresStorageConfig,
  S3StorageConfig,

  // Registry types
  RegistryConfig,
  RegistryEvent,
  RegistryEventType,
  RegistryStats,
  CacheConfig,
  RegistryHooks,
  PartialDefinition,
} from './types/index.js';

// Utility exports
export {
  hashContent,
  generateId,
  generateVersion,
  parseVersion,
  incrementVersion,
  compareVersions,
  shortHash,
} from './utils/hashing.js';

export {
  validatePromptName,
  validateTemplate,
  validateVariables,
  validateBranchName,
  validateEnvironmentName,
  createVariableSchema,
} from './utils/validation.js';

export {
  normalizeTemplate,
  formatPromptDisplay,
  formatVersion,
  formatDate,
  formatRelativeTime,
  truncate,
  highlightVariables,
  indent,
  wordWrap,
} from './utils/formatting.js';
