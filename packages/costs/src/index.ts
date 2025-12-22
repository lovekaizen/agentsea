/**
 * AgentSea Costs
 *
 * AI cost management platform with real-time tracking,
 * budget enforcement, and optimization.
 *
 * @packageDocumentation
 */

// Types
export type {
  // Cost types
  AIProvider,
  TokenUsage,
  CostBreakdown,
  CostRecord,
  CostAttribution,
  CostSummary,
  CostByDimension,
  CostTrendPoint,
  TimeGranularity,
  CostQueryFilter,
  CostQueryOptions,
  CostManagerConfig,
  CostEvents,
  // Pricing types
  PricingTier,
  ModelPricing,
  ModelCapabilities,
  PricingRegistryConfig,
  TokenCountRequest,
  TokenCountResult,
  CostEstimateRequest,
  CostEstimateResult,
  ProviderPricingSummary,
  PricingComparison,
  // Budget types
  BudgetPeriod,
  BudgetScope,
  BudgetAction,
  BudgetStatus,
  BudgetConfig,
  BudgetThresholdAction,
  BudgetFilter,
  BudgetUsage,
  BudgetCheckRequest,
  BudgetCheckResult,
  BudgetHistoryEntry,
  BudgetAlert,
  BudgetManagerConfig,
  CreateBudgetRequest,
  UpdateBudgetRequest,
  // Attribution types
  AttributionDimension,
  AttributionRuleType,
  AttributionRule,
  AttributionCondition,
  AttributionTarget,
  AttributedCost,
  AttributionSummary,
  AttributionBreakdown,
  AttributionQueryOptions,
  AttributionTrend,
  AttributionTrendPoint,
  CostAllocationPolicy,
  AttributionReport,
  AttributionEngineConfig,
  ChargebackRecord,
  ChargebackLineItem,
  // Analytics types
  TimeRangePreset,
  AnalyticsQuery,
  AnalyticsFilter,
  AnalyticsMetric,
  AnalyticsResult,
  AnalyticsSummary,
  AnalyticsTimeSeries,
  AnalyticsComparison,
  ChangeMetric,
  ForecastConfig,
  ForecastMethod,
  ForecastResult,
  ForecastDataPoint,
  SeasonalityInfo,
  ForecastAccuracy,
  AnomalyDetectionConfig,
  Anomaly,
  DashboardWidget,
  DashboardConfig,
  // Alert types
  AlertType,
  AlertSeverity,
  AlertStatus,
  NotificationChannel,
  AlertRule,
  AlertCondition,
  AlertFilter,
  NotificationConfig,
  NotificationChannelConfig,
  EmailNotificationConfig,
  SlackNotificationConfig,
  WebhookNotificationConfig,
  PagerDutyNotificationConfig,
  TeamsNotificationConfig,
  DiscordNotificationConfig,
  Alert,
  AlertDetails,
  NotificationRecord,
  AlertSummary,
  AlertManagerConfig,
  CreateAlertRuleRequest,
  AlertQueryOptions,
  // Storage types
  CostStorageAdapter,
  StorageStats,
  IndexInfo,
  SQLiteStorageConfig,
  PostgresStorageConfig,
  PostgresConnectionConfig,
  PostgresSSLConfig,
  BufferStorageConfig,
  StorageMigration,
  StorageFactoryOptions,
  // Optimization types
  OptimizationCategory,
  ImpactLevel,
  EffortLevel,
  OptimizationStatus,
  OptimizationRecommendation,
  OptimizationCurrentState,
  OptimizationAction,
  OptimizationActionType,
  ModelSwitchRecommendation,
  CachingRecommendation,
  CacheablePattern,
  PromptOptimizationRecommendation,
  PromptOptimizationTechnique,
  OptimizationAnalyzerConfig,
  OptimizationAnalysisResult,
  OptimizationTracking,
  OptimizationABTest,
  OptimizationABTestResults,
} from './types/index.js';

// Core
export {
  CostManager,
  createCostManager,
  type CostManagerOptions,
} from './core/CostManager.js';
export {
  CostTracker,
  ScopedCostTracker,
  type CostTrackerConfig,
  type TrackOptions,
} from './core/CostTracker.js';

// Pricing
export { ModelPricingRegistry } from './pricing/ModelPricingRegistry.js';
export {
  TokenCounter,
  countTokens,
  countTokensApprox,
} from './pricing/TokenCounter.js';

// Budgets
export { BudgetManager, type BudgetEvents } from './budgets/BudgetManager.js';

// Storage
export { BufferStorage } from './storage/adapters/BufferStorage.js';

// AgentSea Integration
export {
  CostProvider,
  AgentCostTracker,
  createCostProvider,
  type CostProviderEvents,
  type CostProviderConfig,
  type AgentCostContext,
} from './integrations/agentsea/index.js';
