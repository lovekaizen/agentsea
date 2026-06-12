# @lov3kaizen/agentsea-costs

AI cost management platform with real-time tracking, budget enforcement, and optimization recommendations.

## Features

- **Real-time Cost Tracking** - Track API calls and costs as they happen
- **Token Counting** - Accurate token counting using tiktoken for OpenAI models
- **Model Pricing Registry** - Up-to-date pricing for major AI providers
- **Budget Management** - Set and enforce budgets at multiple scopes
- **Cost Attribution** - Attribute costs to users, agents, projects, features
- **Analytics** - Cost trends, forecasting, and anomaly detection
- **Alerts** - Threshold-based notifications via multiple channels
- **Optimization** - AI-powered cost optimization recommendations

## Installation

```bash
npm install @lov3kaizen/agentsea-costs
# or
pnpm add @lov3kaizen/agentsea-costs
```

## Quick Start

```typescript
import {
  CostManager,
  createCostManager,
  BufferStorage,
} from '@lov3kaizen/agentsea-costs';

// Create a cost manager
const costManager = createCostManager({
  currency: 'USD',
  defaultAttribution: {
    environment: 'production',
  },
});

// Track an Anthropic API call
await costManager.trackAnthropicResponse(
  {
    model: 'claude-sonnet-4-6',
    usage: {
      input_tokens: 1500,
      output_tokens: 500,
    },
  },
  {
    attribution: {
      userId: 'user-123',
      feature: 'chat',
    },
  },
);

// Get cost summary
const summary = await costManager.getSummary({
  startDate: new Date('2024-01-01'),
  endDate: new Date(),
});

console.log(`Total cost: $${summary.totalCost.toFixed(4)}`);
console.log(`Total tokens: ${summary.totalTokens}`);
console.log(`Requests: ${summary.requestCount}`);
```

## Cost Tracking

### Track API Calls

```typescript
import { CostManager, BufferStorage } from '@lov3kaizen/agentsea-costs';

// With persistent storage
const storage = new BufferStorage();
const costManager = new CostManager({ storage });

// Track any LLM call
await costManager.track({
  provider: 'anthropic',
  model: 'claude-sonnet-4-6',
  tokens: {
    inputTokens: 1000,
    outputTokens: 500,
    totalTokens: 1500,
  },
  latencyMs: 1200,
  attribution: {
    userId: 'user-123',
    agentId: 'agent-456',
    feature: 'document-analysis',
  },
});

// Track OpenAI responses directly
await costManager.trackOpenAIResponse({
  model: 'gpt-5.2',
  usage: {
    prompt_tokens: 1000,
    completion_tokens: 500,
    total_tokens: 1500,
  },
});

// Track errors
await costManager.trackError({
  provider: 'openai',
  model: 'gpt-5.2',
  error: 'Rate limit exceeded',
  estimatedInputTokens: 1000,
});
```

### Scoped Tracking

```typescript
// Create scoped trackers for specific contexts
const userTracker = costManager.scoped({
  userId: 'user-123',
  environment: 'production',
});

// All calls through this tracker include the scope
await userTracker.track({
  provider: 'anthropic',
  model: 'claude-sonnet-4-6',
  tokens: {
    inputTokens: 500,
    outputTokens: 200,
    totalTokens: 700,
  },
});
```

## Token Counting

```typescript
import { TokenCounter, ModelPricingRegistry } from '@lov3kaizen/agentsea-costs';

const registry = new ModelPricingRegistry();
const counter = new TokenCounter(registry);

// Count tokens
const result = await counter.countTokens({
  text: 'Hello, how can I help you today?',
  model: 'claude-sonnet-4-6',
});

console.log(`Tokens: ${result.tokens}`);
console.log(`Estimated cost: $${result.estimatedInputCost}`);

// Estimate cost before making a call
const estimate = await counter.estimateCost({
  input: 'Your prompt here...',
  model: 'claude-sonnet-4-6',
  estimatedOutputTokens: 1000,
});

console.log(`Estimated total: $${estimate.estimatedCost.toFixed(4)}`);
```

## Model Pricing

```typescript
import { ModelPricingRegistry } from '@lov3kaizen/agentsea-costs';

const registry = new ModelPricingRegistry();

// Get pricing for a model
const pricing = registry.getPricing('anthropic', 'claude-sonnet-4-6');
console.log(`Input: $${pricing.inputPricePerMillion}/1M tokens`);
console.log(`Output: $${pricing.outputPricePerMillion}/1M tokens`);

// Calculate cost
const cost = registry.calculateCost(
  'anthropic',
  'claude-sonnet-4-6',
  1000, // input tokens
  500, // output tokens
);
console.log(`Total: $${cost.totalCost.toFixed(4)}`);

// Find cheapest model with requirements
const cheapest = registry.findCheapestModel({
  requireVision: true,
  requireFunctionCalling: true,
  minContextWindow: 100000,
});

// Compare models
const comparison = registry.comparePricing(
  'claude-sonnet-4-6',
  'gpt-5.2',
  { input: 1000000, output: 500000 }, // sample workload
);

console.log(
  `${comparison.cheaperModel} is ${comparison.percentageDiff}% cheaper`,
);
```

## Budget Management

```typescript
import { BudgetManager, BufferStorage } from '@lov3kaizen/agentsea-costs';

const storage = new BufferStorage();
const budgetManager = new BudgetManager({}, storage);

// Create a budget
const budget = await budgetManager.createBudget({
  name: 'Monthly AI Budget',
  limit: 1000, // $1000
  period: 'monthly',
  scope: 'global',
  warningThresholds: [50, 80, 90],
  actions: [
    { threshold: 80, action: 'notify', notifyEmails: ['team@example.com'] },
    { threshold: 100, action: 'block' },
  ],
});

// Check budget before making a call
const check = await budgetManager.checkBudget({
  estimatedCost: 0.05,
  attribution: { userId: 'user-123' },
});

if (check.allowed) {
  // Proceed with API call
} else {
  console.log(`Blocked: ${check.reason}`);
}

// Get budget usage
const usage = await budgetManager.getUsage(budget.id);
console.log(`Used: $${usage.currentUsage} of $${usage.limit}`);
console.log(`${usage.usagePercentage.toFixed(1)}% used`);

// Listen for budget events
budgetManager.on('budget:warning', (alert) => {
  console.log(`Warning: ${alert.message}`);
});

budgetManager.on('budget:exceeded', (alert) => {
  console.log(`Exceeded: ${alert.message}`);
});
```

### Budget Scopes

```typescript
// User-level budget
await budgetManager.createBudget({
  name: 'User Daily Limit',
  limit: 10,
  period: 'daily',
  scope: 'user',
  scopeId: 'user-123',
});

// Project budget
await budgetManager.createBudget({
  name: 'Project Budget',
  limit: 500,
  period: 'monthly',
  scope: 'project',
  scopeId: 'project-abc',
});

// Feature-specific budget
await budgetManager.createBudget({
  name: 'Document Processing',
  limit: 100,
  period: 'weekly',
  scope: 'feature',
  scopeId: 'document-analysis',
});
```

## Storage Adapters

### Buffer Storage (In-Memory)

```typescript
import { BufferStorage } from '@lov3kaizen/agentsea-costs';

const storage = new BufferStorage({
  maxRecords: 10000,
  autoFlushInterval: 30000, // 30 seconds
  onFlush: async (records) => {
    // Persist records to external storage
    console.log(`Flushing ${records.length} records`);
  },
});
```

## Analytics

```typescript
// Get cost summary
const summary = await costManager.getSummary({
  startDate: new Date('2024-01-01'),
  endDate: new Date(),
  providers: ['anthropic', 'openai'],
});

// Get costs by dimension
const byModel = await costManager.getCostsByDimension('model', {
  startDate: new Date('2024-01-01'),
});

byModel.forEach((m) => {
  console.log(
    `${m.value}: $${m.totalCost.toFixed(2)} (${m.percentage.toFixed(1)}%)`,
  );
});

// Get cost trends
const trends = await costManager.getCostTrends({
  granularity: 'day',
  startDate: new Date('2024-01-01'),
});

// Get top consumers
const topUsers = await costManager.getTopUsers({ limit: 10 });
const topModels = await costManager.getTopModels({ limit: 5 });
const topFeatures = await costManager.getTopFeatures({ limit: 5 });
```

## Event Handling

```typescript
costManager.on('cost:recorded', (record) => {
  console.log(
    `Tracked: ${record.model} - $${record.cost.totalCost.toFixed(4)}`,
  );
});

costManager.on('cost:batch', ({ records }) => {
  console.log(`Batch saved: ${records.length} records`);
});

costManager.on('budget:warning', (alert) => {
  sendSlackNotification(alert.message);
});

costManager.on('budget:exceeded', (alert) => {
  sendPagerDutyAlert(alert);
});

costManager.on('error', (error) => {
  console.error('Cost tracking error:', error.message);
});
```

## Supported Providers

| Provider  | Models                                                   |
| --------- | -------------------------------------------------------- |
| Anthropic | Claude 3.5 Sonnet, Claude 3.5 Haiku, Claude 3 Opus, etc. |
| OpenAI    | GPT-4o, GPT-4o-mini, GPT-4 Turbo, o1, etc.               |
| Google    | Gemini 1.5 Pro, Gemini 1.5 Flash, Gemini 2.0             |
| Mistral   | Mistral Large, Mistral Small, Codestral                  |
| Cohere    | Command R+, Command R                                    |

## API Reference

### CostManager

The main entry point for cost management.

```typescript
interface CostManagerOptions {
  currency?: string; // Default: 'USD'
  autoFlushInterval?: number; // Default: 30000ms
  bufferSize?: number; // Default: 100
  realTimeTracking?: boolean; // Default: true
  defaultAttribution?: Partial<CostAttribution>;
  storage?: CostStorageAdapter;
  pricingRegistry?: ModelPricingRegistry;
}
```

### BudgetManager

Manages budgets and enforces limits.

```typescript
interface BudgetConfig {
  id: string;
  name: string;
  limit: number;
  currency: string;
  period: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  scope: 'global' | 'user' | 'agent' | 'project' | 'team' | 'feature';
  scopeId?: string;
  warningThresholds?: number[];
  actions?: BudgetThresholdAction[];
  enabled: boolean;
}
```

### ModelPricingRegistry

Manages model pricing information.

```typescript
interface ModelPricing {
  model: string;
  provider: AIProvider;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  cacheReadPricePerMillion?: number;
  cacheWritePricePerMillion?: number;
  contextWindow?: number;
  maxOutputTokens?: number;
  currency: string;
}
```

## Types

All types are exported from the package:

```typescript
import type {
  // Cost
  CostRecord,
  CostAttribution,
  CostSummary,
  TokenUsage,
  CostBreakdown,

  // Pricing
  ModelPricing,
  TokenCountResult,
  CostEstimateResult,

  // Budget
  BudgetConfig,
  BudgetUsage,
  BudgetCheckResult,

  // Attribution
  AttributionDimension,
  AttributionSummary,

  // Analytics
  AnalyticsQuery,
  AnalyticsResult,
  ForecastResult,

  // Alerts
  AlertRule,
  Alert,
  NotificationConfig,

  // Storage
  CostStorageAdapter,
  StorageStats,
} from '@lov3kaizen/agentsea-costs';
```

## License

MIT
