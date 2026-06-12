# @lov3kaizen/agentsea-prompts

Self-hosted prompt management with Git-like version control, environment promotion, A/B testing, and team collaboration. Treat prompts as first-class software artifacts with proper DevOps workflows.

## Features

- **Version Control** - Git-like versioning with diff, history, branches, and merge
- **Environment Promotion** - Dev → Staging → Production workflows with approvals
- **Template Engine** - Handlebars-based templates with partials and helpers
- **A/B Testing** - Run experiments with statistical significance analysis
- **Multiple Backends** - File, SQLite, PostgreSQL, and S3 storage adapters
- **SDK Client** - Runtime prompt loading with caching and auto-refresh
- **AgentSea Integration** - Dynamic prompts for AI agents

## Installation

```bash
pnpm add @lov3kaizen/agentsea-prompts
```

## Quick Start

```typescript
import { PromptRegistry, FileStorage } from '@lov3kaizen/agentsea-prompts';

// Create registry with file storage
const registry = new PromptRegistry({
  storage: new FileStorage({ path: './prompts' }),
  defaultEnvironment: 'development',
});

await registry.initialize();

// Create a prompt
const prompt = await registry.create({
  name: 'customer-support',
  description: 'Main customer support system prompt',
  template: `You are a helpful customer support agent for {{company_name}}.

Your responsibilities:
- Answer questions about {{product_name}}
- Help with billing and account issues
- Escalate complex issues to human agents

Customer name: {{customer_name}}
Account type: {{account_type}}`,
  variables: {
    company_name: { type: 'string', required: true },
    product_name: { type: 'string', required: true },
    customer_name: { type: 'string', required: true },
    account_type: { type: 'enum', values: ['free', 'pro', 'enterprise'] },
  },
  metadata: {
    author: 'product-team',
    tags: ['support', 'customer-facing'],
  },
});

// Render with variables
const rendered = await registry.render('customer-support', {
  company_name: 'Acme Corp',
  product_name: 'Widget Pro',
  customer_name: 'John Doe',
  account_type: 'pro',
});

console.log(rendered.content);
```

## Version Control

### Update Prompts

```typescript
// Update creates a new version
const updated = await registry.update('customer-support', {
  template: `${existingTemplate}

Additional guideline:
- Offer a 10% discount for frustrated customers`,
  message: 'Added discount guideline for retention',
});

console.log(`Updated to ${updated.version}`); // v2
```

### View History

```typescript
const history = await registry.history('customer-support');

for (const version of history) {
  console.log(`${version.version}: ${version.message} (${version.author})`);
}
```

### Compare Versions

```typescript
const diff = await registry.diff('customer-support', {
  from: 'v1',
  to: 'v2',
});

console.log(`+${diff.additions} -${diff.deletions}`);
console.log(`Similarity: ${(diff.similarity * 100).toFixed(1)}%`);
```

### Rollback

```typescript
await registry.rollback('customer-support', {
  to: 'v1',
  reason: 'User complaints about new guideline',
});
```

### Branching

```typescript
// Create a branch for experimentation
await registry.branch('customer-support', {
  name: 'experiment/shorter-prompt',
  from: 'v2',
});

// Make changes on the branch...

// Merge back to main
await registry.merge('customer-support', {
  from: 'experiment/shorter-prompt',
  strategy: 'squash',
  message: 'Merged shorter prompt experiment',
});
```

## Environment Management

### Define Environments

```typescript
const registry = new PromptRegistry({
  storage,
  environments: [
    { name: 'development', label: 'Dev', order: 1 },
    { name: 'staging', label: 'Staging', order: 2 },
    { name: 'production', label: 'Prod', protected: true, order: 3 },
  ],
});
```

### Promote Prompts

```typescript
// Promote from dev to staging
await registry.promote('customer-support', {
  from: 'development',
  to: 'staging',
  version: 'v3',
  message: 'Ready for QA testing',
});

// Promote to production (requires approver for protected env)
await registry.promote('customer-support', {
  from: 'staging',
  to: 'production',
  version: 'v3',
  approver: 'lead-engineer',
  message: 'Approved after QA sign-off',
});
```

### Get Prompt by Environment

```typescript
const prodPrompt = await registry.get('customer-support', {
  environment: 'production',
});
```

## Template System

### Variables

```typescript
const prompt = await registry.create({
  name: 'greeting',
  template: 'Hello, {{name}}! Welcome to {{company}}.',
  variables: {
    name: { type: 'string', required: true },
    company: { type: 'string', default: 'Acme Corp' },
  },
});

// Render with validation
const result = await registry.render('greeting', { name: 'Alice' });
// "Hello, Alice! Welcome to Acme Corp."
```

### Partials (Reusable Snippets)

```typescript
import { Partial } from '@lov3kaizen/agentsea-prompts';

// Register partials
await registry.registerPartial(
  new Partial({
    name: 'safety-guidelines',
    template: `Safety Guidelines:
- Never provide harmful information
- Decline requests for illegal activities
- Protect user privacy at all times`,
  }),
);

// Use in prompts
const prompt = await registry.create({
  name: 'assistant',
  template: `You are a helpful assistant.

{{> safety-guidelines}}

Task: {{task}}`,
});
```

### Built-in Helpers

```typescript
// Available helpers
const template = `
{{upper name}}           // JOHN
{{lower name}}           // john
{{capitalize name}}      // John
{{truncate text 50}}     // Truncated text...
{{default value "N/A"}}  // Default if undefined
{{json object}}          // JSON stringified
{{join array ", "}}      // Array to string
{{date timestamp "iso"}} // Date formatting
{{number value 2}}       // Number with decimals
`;
```

## A/B Testing

### Create Test

```typescript
import { ABTest } from '@lov3kaizen/agentsea-prompts';

const test = await registry.createABTest({
  name: 'concise-vs-detailed',
  prompt: 'customer-support',
  variants: [
    { name: 'control', version: 'v1', weight: 0.5 },
    { name: 'treatment', version: 'v2', weight: 0.5 },
  ],
  metrics: ['user_satisfaction', 'resolution_time'],
  targetSampleSize: 1000,
  confidenceLevel: 0.95,
});
```

### Assign Variants

```typescript
// Get variant for user (consistent assignment)
const variant = await test.getVariant({ userId: 'user-123' });
const prompt = await registry.get('customer-support', {
  version: variant.version,
});
```

### Record Metrics

```typescript
await test.recordMetric('control', 'user_satisfaction', 4.5, {
  userId: 'user-123',
});
```

### Get Results

```typescript
const results = await test.getResults();

console.log('Total samples:', results.totalSamples);
console.log('Significant?', results.isSignificant);
console.log('Winner:', results.winner);
console.log('P-value:', results.pValue);
console.log('Recommendation:', results.recommendation);
```

## SDK Client

### Runtime Loading

```typescript
import { PromptClient } from '@lov3kaizen/agentsea-prompts/client';

const client = new PromptClient({
  registryUrl: 'https://prompts.example.com',
  apiKey: process.env.PROMPT_API_KEY,
  environment: 'production',
  cache: {
    enabled: true,
    ttl: 300, // 5 minutes
  },
});

// Load and render prompt
const result = await client.render('customer-support', {
  company_name: 'Acme Corp',
  customer_name: 'John',
});
```

### Local Prompts

```typescript
// Register local prompts (no API needed)
client.register('greeting', 'Hello, {{name}}!', {
  variables: { name: { type: 'string', required: true } },
});

const result = await client.render('greeting', { name: 'Alice' });
```

### Auto-Refresh

```typescript
// Listen for updates
client.on('prompt:updated', ({ name, version }) => {
  console.log(`Prompt ${name} updated to ${version}`);
});
```

## AgentSea Integration

### Dynamic Prompts

```typescript
import { Agent } from '@lov3kaizen/agentsea-core';
import { PromptProvider } from '@lov3kaizen/agentsea-prompts';

const provider = new PromptProvider({
  registry,
  environment: 'production',
  autoRefresh: true,
});

// Create agent with managed prompt
const agent = new Agent({
  name: 'support-agent',
  model: 'claude-sonnet-4-6',
  provider: 'anthropic',
  // Dynamic prompt from registry
  systemPrompt: provider.dynamic('customer-support', {
    company_name: 'Acme Corp',
    product_name: 'Widget Pro',
  }),
});

// Prompt updates automatically when registry changes!
```

### Helper Functions

```typescript
import { createSystemPrompt } from '@lov3kaizen/agentsea-prompts';

const agent = new Agent({
  systemPrompt: createSystemPrompt(provider, 'customer-support', {
    company_name: 'Acme Corp',
  }),
});
```

## Storage Adapters

### File Storage (Git-friendly)

```typescript
import { FileStorage } from '@lov3kaizen/agentsea-prompts';

const storage = new FileStorage({
  path: './prompts',
  format: 'json',
});
```

### In-Memory (Testing)

```typescript
import { BufferStorage } from '@lov3kaizen/agentsea-prompts';

const storage = new BufferStorage();
```

### PostgreSQL (Coming Soon)

```typescript
import { PostgresStorage } from '@lov3kaizen/agentsea-prompts';

const storage = new PostgresStorage({
  connectionString: process.env.DATABASE_URL,
});
```

## API Reference

### PromptRegistry

```typescript
interface PromptRegistry {
  // CRUD
  create(input: CreatePromptInput): Promise<Prompt>;
  get(
    name: string,
    options?: { environment?: string; version?: string },
  ): Promise<Prompt | null>;
  update(name: string, updates: UpdatePromptInput): Promise<Prompt>;
  delete(name: string): Promise<boolean>;
  query(options: PromptQueryOptions): Promise<Prompt[]>;

  // Rendering
  render(
    name: string,
    variables: Record<string, unknown>,
  ): Promise<RenderedPrompt>;

  // Version Control
  history(name: string, options?: { limit?: number }): Promise<PromptVersion[]>;
  diff(name: string, options: DiffOptions): Promise<DiffResult>;
  rollback(name: string, options: RollbackOptions): Promise<RollbackResult>;
  branch(name: string, input: CreateBranchInput): Promise<BranchInfo>;
  merge(name: string, options: MergeOptions): Promise<MergeResult>;

  // Environments
  promote(name: string, options: PromoteInput): Promise<PromotionResult>;
  getEnvironments(): EnvironmentConfig[];

  // Partials
  registerPartial(partial: Partial): Promise<void>;
  getPartial(name: string): Partial | undefined;

  // A/B Testing
  createABTest(config: ABTestConfig): Promise<ABTestData>;

  // Reviews
  requestReview(name: string, input: CreateReviewInput): Promise<ReviewRequest>;

  // Audit
  getAuditLog(options?: AuditLogQueryOptions): Promise<AuditLogEntry[]>;
}
```

### Prompt

```typescript
interface Prompt {
  id: string;
  name: string;
  description?: string;
  template: string;
  variables: VariableDefinitions;
  metadata: PromptMetadata;
  status: PromptStatus;
  version: string;
  environment: string;
  hash: string;

  render(
    variables: Record<string, unknown>,
    options?: RenderOptions,
  ): RenderedPrompt;
  getVariableNames(): string[];
  getRequiredVariables(): string[];
  clone(overrides?: Partial<PromptData>): Prompt;
}
```

### PromptClient

```typescript
interface PromptClient {
  get(name: string, options?: { version?: string }): Promise<Prompt | null>;
  render(
    name: string,
    variables: Record<string, unknown>,
  ): Promise<RenderedPrompt>;
  register(
    name: string,
    template: string,
    options?: { variables?: VariableDefinitions },
  ): Prompt;
  has(name: string): Promise<boolean>;
  list(): string[];
  invalidate(name: string): void;
  clearCache(): void;
}
```

## Best Practices

1. **Use descriptive names** - `customer-support-v2` not `cs2`
2. **Add commit messages** - Document why changes were made
3. **Test in staging** - Always promote through environments
4. **Use partials** - Share common prompt sections
5. **Version variables** - Update variable definitions with templates
6. **Monitor A/B tests** - Wait for statistical significance
7. **Cache in production** - Use SDK client with caching

## Links

- [Documentation](https://github.com/lov3kaizen/agentsea)
- [Examples](../../examples)
- [API Reference](../../docs/API.md)
