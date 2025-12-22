/**
 * @lov3kaizen/agentsea-analytics
 *
 * Conversation analytics for AI agents.
 */

// Core
export {
  Analytics,
  ConversationManager,
  EventManager,
  SessionManager,
  type AnalyticsEvents,
  type ConversationManagerEvents,
  type EventManagerEvents,
  type SessionManagerEvents,
} from './core/index.js';

// Collection
export {
  Collector,
  ConversationTracker,
  MessageTracker,
  BatchCollector,
  type CollectorEvents,
  type CollectorConfig,
  type ConversationTrackerEvents,
  type ConversationMetrics,
  type MessageTrackerEvents,
  type MessageStats,
  type BatchCollectorEvents,
  type BatchStats,
} from './collection/index.js';

// Classification
export {
  IntentClassifier,
  SentimentAnalyzer,
  TopicClassifier,
  TaxonomyManager,
  type IntentClassifierEvents,
  type SentimentAnalyzerEvents,
  type TopicClassifierEvents,
  type TaxonomyManagerEvents,
} from './classification/index.js';

// Analysis
export {
  FlowAnalyzer,
  DropOffDetector,
  SuccessAnalyzer,
  FunnelAnalyzer,
  type FlowAnalyzerEvents,
  type DropOffDetectorEvents,
  type SuccessAnalyzerEvents,
  type FunnelAnalyzerEvents,
  type FunnelDefinition,
} from './analysis/index.js';

// Clustering
export {
  TopicClusterer,
  PatternDetector,
  AnomalyDetector,
  TrendAnalyzer,
  type TopicClustererEvents,
  type PatternDetectorEvents,
  type AnomalyDetectorEvents,
  type TrendAnalyzerEvents,
} from './clustering/index.js';

// Metrics
export {
  MetricsEngine,
  KPITracker,
  CustomMetrics,
  Aggregations,
  AggregationBuilder,
  type MetricsEngineEvents,
  type BuiltInMetric,
  type KPITrackerEvents,
  type CustomMetricsEvents,
} from './metrics/index.js';

// Storage
export {
  MemoryStorageAdapter,
  SQLiteStorageAdapter,
  PostgresStorageAdapter,
  type SQLiteStorageConfig,
  type PostgresStorageConfig,
} from './storage/index.js';

// Integrations
export {
  AnalyticsMiddleware,
  AnalyticsProvider,
  createAnalyticsMiddleware,
  createAnalyticsProvider,
  type AnalyticsMiddlewareOptions,
  type AnalyticsProviderOptions,
  type AgentMessage,
  type AgentContext,
  type DashboardSummary,
} from './integrations/index.js';

// Reporting
export {
  DashboardData,
  ReportGenerator,
  Exporter,
  type DashboardDataEvents,
  type KPIDataPoint,
  type TimeSeriesPoint,
  type ChartData,
  type DashboardSnapshot,
  type DashboardOptions,
  type ReportSection,
  type Report,
  type ReportOptions,
  type ExportFormat,
  type ExportOptions,
  type ExportResult,
} from './reporting/index.js';

// Types
export * from './types/index.js';
