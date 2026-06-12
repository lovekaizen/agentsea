# @lov3kaizen/agentsea-analytics

**Conversation analytics for AI agents** - Intent classification, flow analysis, sentiment tracking, and actionable insights.

[![npm version](https://img.shields.io/npm/v/@lov3kaizen/agentsea-analytics.svg)](https://www.npmjs.com/package/@lov3kaizen/agentsea-analytics)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **Intent Classification** - Classify user intents with custom taxonomies
- **Sentiment Analysis** - Track sentiment across conversations
- **Topic Classification** - Categorize conversations by topic
- **Flow Analysis** - Analyze conversation flows, drop-offs, and funnels
- **Anomaly Detection** - Detect unusual patterns in conversations
- **Trend Analysis** - Track trends over time
- **KPI Tracking** - Monitor key performance indicators
- **Custom Metrics** - Define and track custom metrics with aggregations
- **Dashboards** - Generate dashboard data with time series and charts
- **Report Generation** - Export reports in multiple formats
- **Storage Backends** - Memory, SQLite, and PostgreSQL adapters
- **AgentSea Integration** - Middleware and provider for AgentSea agents

## Installation

```bash
pnpm add @lov3kaizen/agentsea-analytics
```

## Quick Start

```typescript
import {
  Analytics,
  Collector,
  IntentClassifier,
  SentimentAnalyzer,
  MetricsEngine,
} from '@lov3kaizen/agentsea-analytics';

// Create analytics instance
const analytics = new Analytics({
  collector: new Collector(),
  classifiers: [new IntentClassifier(), new SentimentAnalyzer()],
  metrics: new MetricsEngine(),
});

// Track a conversation
analytics.track({
  conversationId: 'conv-123',
  message: { role: 'user', content: 'I need help with my order' },
  metadata: { userId: 'user-456' },
});
```

## Collection

Track conversations, messages, and sessions:

```typescript
import {
  Collector,
  ConversationTracker,
  MessageTracker,
  BatchCollector,
} from '@lov3kaizen/agentsea-analytics/collection';

// Real-time collection
const collector = new Collector({
  batchSize: 100,
  flushInterval: 5000,
});

// Track conversations
const conversationTracker = new ConversationTracker();
conversationTracker.on('conversation:complete', (metrics) => {
  console.log('Duration:', metrics.duration);
  console.log('Messages:', metrics.messageCount);
  console.log('Resolution:', metrics.resolved);
});

// Track individual messages
const messageTracker = new MessageTracker();

// Batch collection for high-throughput
const batchCollector = new BatchCollector({
  maxBatchSize: 500,
  flushInterval: 10000,
});
```

## Classification

Classify intents, sentiment, and topics:

```typescript
import {
  IntentClassifier,
  SentimentAnalyzer,
  TopicClassifier,
  TaxonomyManager,
} from '@lov3kaizen/agentsea-analytics/classification';

// Intent classification
const intentClassifier = new IntentClassifier({
  intents: ['order-inquiry', 'refund-request', 'product-question', 'complaint'],
});
const intent = await intentClassifier.classify('Where is my order?');
// { intent: 'order-inquiry', confidence: 0.95 }

// Sentiment analysis
const sentimentAnalyzer = new SentimentAnalyzer();
const sentiment = await sentimentAnalyzer.analyze('This product is amazing!');
// { sentiment: 'positive', score: 0.92 }

// Topic classification
const topicClassifier = new TopicClassifier({
  topics: ['billing', 'shipping', 'product', 'technical'],
});

// Custom taxonomies
const taxonomy = new TaxonomyManager();
taxonomy.define({
  name: 'support-categories',
  categories: ['billing', 'shipping', 'returns', 'technical'],
});
```

## Flow Analysis

Analyze conversation flows and identify bottlenecks:

```typescript
import {
  FlowAnalyzer,
  DropOffDetector,
  SuccessAnalyzer,
  FunnelAnalyzer,
} from '@lov3kaizen/agentsea-analytics/analysis';

// Analyze conversation flow patterns
const flowAnalyzer = new FlowAnalyzer();
const flows = await flowAnalyzer.analyze(conversations);

// Detect drop-off points
const dropOffDetector = new DropOffDetector();
const dropOffs = await dropOffDetector.detect(conversations);

// Analyze success rates
const successAnalyzer = new SuccessAnalyzer({
  successCriteria: (conv) => conv.resolved === true,
});

// Funnel analysis
const funnelAnalyzer = new FunnelAnalyzer();
const funnel = await funnelAnalyzer.analyze({
  stages: ['greeting', 'problem-identification', 'solution', 'resolution'],
  conversations,
});
```

## Clustering & Pattern Detection

Discover patterns and anomalies:

```typescript
import {
  TopicClusterer,
  PatternDetector,
  AnomalyDetector,
  TrendAnalyzer,
} from '@lov3kaizen/agentsea-analytics/clustering';

// Cluster conversations by topic
const clusterer = new TopicClusterer();
const clusters = await clusterer.cluster(conversations);

// Detect conversation patterns
const patternDetector = new PatternDetector();
const patterns = await patternDetector.detect(conversations);

// Anomaly detection
const anomalyDetector = new AnomalyDetector({
  sensitivity: 'medium',
});
anomalyDetector.on('anomaly', (anomaly) => {
  console.log('Anomaly detected:', anomaly.description);
});

// Trend analysis
const trendAnalyzer = new TrendAnalyzer({ window: '7d' });
const trends = await trendAnalyzer.analyze(metrics);
```

## Metrics & KPIs

Track and monitor key metrics:

```typescript
import {
  MetricsEngine,
  KPITracker,
  CustomMetrics,
  AggregationBuilder,
} from '@lov3kaizen/agentsea-analytics/metrics';

// Built-in metrics engine
const metrics = new MetricsEngine();
metrics.record('response_time', 1500);
metrics.record('satisfaction_score', 4.5);

// KPI tracking
const kpiTracker = new KPITracker({
  kpis: [
    { name: 'resolution_rate', target: 0.85 },
    { name: 'avg_response_time', target: 2000 },
    { name: 'customer_satisfaction', target: 4.0 },
  ],
});

// Custom metrics
const custom = new CustomMetrics();
custom.define('escalation_rate', {
  type: 'ratio',
  numerator: 'escalated_conversations',
  denominator: 'total_conversations',
});

// Aggregations
const agg = new AggregationBuilder()
  .groupBy('intent')
  .aggregate('count')
  .aggregate('avg', 'duration')
  .build();
```

## Reporting & Dashboards

Generate reports and dashboard data:

```typescript
import {
  DashboardData,
  ReportGenerator,
  Exporter,
} from '@lov3kaizen/agentsea-analytics/reporting';

// Dashboard data
const dashboard = new DashboardData({
  timeRange: { start: '2025-01-01', end: '2025-01-31' },
});
const snapshot = await dashboard.getSnapshot();

// Generate reports
const reporter = new ReportGenerator();
const report = await reporter.generate({
  sections: ['summary', 'intents', 'sentiment', 'flows', 'kpis'],
  timeRange: { start: '2025-01-01', end: '2025-01-31' },
});

// Export in multiple formats
const exporter = new Exporter();
await exporter.export(report, { format: 'pdf', path: './report.pdf' });
await exporter.export(report, { format: 'csv', path: './data.csv' });
await exporter.export(report, { format: 'json', path: './report.json' });
```

## Storage Backends

```typescript
import {
  MemoryStorageAdapter,
  SQLiteStorageAdapter,
  PostgresStorageAdapter,
} from '@lov3kaizen/agentsea-analytics/storage';

// In-memory (development)
const memoryStore = new MemoryStorageAdapter();

// SQLite (single-server)
const sqliteStore = new SQLiteStorageAdapter({
  path: './analytics.db',
});

// PostgreSQL (production)
const pgStore = new PostgresStorageAdapter({
  connectionString: process.env.DATABASE_URL,
});
```

## AgentSea Integration

```typescript
import {
  createAnalyticsMiddleware,
  createAnalyticsProvider,
} from '@lov3kaizen/agentsea-analytics/integrations';
import {
  Agent,
  AnthropicProvider,
  ToolRegistry,
} from '@lov3kaizen/agentsea-core';

// As middleware
const middleware = createAnalyticsMiddleware({
  storage: sqliteStore,
  classifiers: [new IntentClassifier(), new SentimentAnalyzer()],
});

// As a provider wrapper
const provider = createAnalyticsProvider({
  provider: new AnthropicProvider(process.env.ANTHROPIC_API_KEY),
  analytics: analyticsInstance,
});
```

## Sub-Package Imports

```typescript
import { Collector } from '@lov3kaizen/agentsea-analytics/collection';
import { IntentClassifier } from '@lov3kaizen/agentsea-analytics/classification';
import { FlowAnalyzer } from '@lov3kaizen/agentsea-analytics/analysis';
import { TopicClusterer } from '@lov3kaizen/agentsea-analytics/clustering';
import { MetricsEngine } from '@lov3kaizen/agentsea-analytics/metrics';
import { DashboardData } from '@lov3kaizen/agentsea-analytics/reporting';
import { SQLiteStorageAdapter } from '@lov3kaizen/agentsea-analytics/storage';
import { createAnalyticsMiddleware } from '@lov3kaizen/agentsea-analytics/integrations';
```

## License

MIT License - see [LICENSE](../../LICENSE) for details
