# @lov3kaizen/agentsea-guardrails

TypeScript-native guardrails engine for AI applications. Provides content safety, prompt injection detection, output validation, and intelligent rate limiting.

## Features

- **Content Safety Guards** - Toxicity, PII detection/masking, topic filtering, bias detection
- **Security Guards** - Prompt injection, jailbreak attempts, data leakage prevention
- **Validation Guards** - Schema validation (Zod), format validation, factuality checking
- **Operational Guards** - Token budgets, rate limiting, cost tracking
- **Rules Engine** - JSON-based configurable policy rules
- **NestJS Integration** - Module, decorators, guards, and interceptors
- **Framework Support** - AgentSea, LangChain.js, Vercel AI SDK

## Installation

```bash
pnpm add @lov3kaizen/agentsea-guardrails
```

## Quick Start

```typescript
import {
  createGuardrailsEngine,
  ToxicityGuard,
  PIIGuard,
  PromptInjectionGuard,
} from '@lov3kaizen/agentsea-guardrails';

// Create the engine
const engine = createGuardrailsEngine({
  guards: [
    { name: 'toxicity', enabled: true, type: 'input', action: 'block' },
    { name: 'pii', enabled: true, type: 'both', action: 'transform' },
    { name: 'prompt-injection', enabled: true, type: 'input', action: 'block' },
  ],
  failureMode: 'fail-fast',
  defaultAction: 'allow',
});

// Register guards
engine.registerGuard(new ToxicityGuard({ sensitivity: 'medium' }));
engine.registerGuard(
  new PIIGuard({ types: ['email', 'phone'], maskingStrategy: 'redact' }),
);
engine.registerGuard(new PromptInjectionGuard({ sensitivity: 'high' }));

// Check input
const result = await engine.checkInput('What is the weather today?', {
  sessionId: 'session-1',
  userId: 'user-1',
});

if (result.passed) {
  // Safe to proceed
  console.log('Input is safe');
} else {
  // Handle blocked input
  console.log(`Blocked: ${result.message}`);
}
```

## Guards

### Content Guards

#### ToxicityGuard

Detects toxic, harmful, or inappropriate content.

```typescript
import { ToxicityGuard } from '@lov3kaizen/agentsea-guardrails';

const guard = new ToxicityGuard({
  sensitivity: 'medium', // 'low' | 'medium' | 'high'
  categories: ['hate', 'violence', 'harassment', 'sexual'],
});
```

#### PIIGuard

Detects and optionally masks PII (Personally Identifiable Information).

```typescript
import { PIIGuard } from '@lov3kaizen/agentsea-guardrails';

const guard = new PIIGuard({
  types: ['email', 'phone', 'ssn', 'creditCard', 'address', 'name'],
  maskingStrategy: 'redact', // 'redact' | 'mask' | 'hash'
  customPatterns: [{ name: 'employeeId', pattern: /EMP-\d{6}/ }],
});
```

#### TopicGuard

Filters content based on allowed/blocked topics.

```typescript
import { TopicGuard } from '@lov3kaizen/agentsea-guardrails';

const guard = new TopicGuard({
  allowedTopics: ['technology', 'science', 'general'],
  blockedTopics: ['politics', 'religion'],
  confidenceThreshold: 0.7,
});
```

#### BiasGuard

Detects biased language.

```typescript
import { BiasGuard } from '@lov3kaizen/agentsea-guardrails';

const guard = new BiasGuard({
  categories: ['gender', 'race', 'religion', 'political'],
  sensitivity: 'medium',
});
```

### Security Guards

#### PromptInjectionGuard

Detects prompt injection attempts.

```typescript
import { PromptInjectionGuard } from '@lov3kaizen/agentsea-guardrails';

const guard = new PromptInjectionGuard({
  sensitivity: 'high',
  customPatterns: [
    /reveal.*system.*prompt/i,
    /ignore.*previous.*instructions/i,
  ],
});
```

#### JailbreakGuard

Detects jailbreak attempts (DAN, roleplay attacks).

```typescript
import { JailbreakGuard } from '@lov3kaizen/agentsea-guardrails';

const guard = new JailbreakGuard({
  sensitivity: 'high',
});
```

#### DataLeakageGuard

Prevents sensitive data from being exposed in outputs.

```typescript
import { DataLeakageGuard } from '@lov3kaizen/agentsea-guardrails';

const guard = new DataLeakageGuard({
  patterns: ['apiKey', 'password', 'secret', 'token'],
  customPatterns: [{ name: 'internalUrl', pattern: /internal\.company\.com/ }],
});
```

### Validation Guards

#### SchemaGuard

Validates output against a Zod schema.

```typescript
import { SchemaGuard } from '@lov3kaizen/agentsea-guardrails';
import { z } from 'zod';

const ResponseSchema = z.object({
  answer: z.string(),
  confidence: z.number().min(0).max(1),
});

const guard = new SchemaGuard({
  schema: ResponseSchema,
});
```

#### FormatGuard

Ensures output matches expected format.

```typescript
import { FormatGuard } from '@lov3kaizen/agentsea-guardrails';

const guard = new FormatGuard({
  format: 'json', // 'json' | 'xml' | 'markdown' | 'custom'
  customValidator: (content) => content.startsWith('{'),
});
```

#### FactualityGuard

Checks factual claims (requires external verification).

```typescript
import { FactualityGuard } from '@lov3kaizen/agentsea-guardrails';

const guard = new FactualityGuard({
  verifier: async (claim) => {
    // Implement your fact-checking logic
    return { accurate: true, confidence: 0.9 };
  },
});
```

### Operational Guards

#### TokenBudgetGuard

Enforces token limits.

```typescript
import { TokenBudgetGuard } from '@lov3kaizen/agentsea-guardrails';

const guard = new TokenBudgetGuard({
  maxTokensPerRequest: 4096,
  maxTokensPerSession: 50000,
  maxTokensPerDay: 1000000,
  warningThreshold: 0.8,
});
```

#### RateLimitGuard

Limits request rates.

```typescript
import { RateLimitGuard } from '@lov3kaizen/agentsea-guardrails';

const guard = new RateLimitGuard({
  requestsPerMinute: 60,
  requestsPerHour: 1000,
  requestsPerDay: 10000,
});
```

#### CostGuard

Tracks and limits costs.

```typescript
import { CostGuard } from '@lov3kaizen/agentsea-guardrails';

const guard = new CostGuard({
  maxCostPerRequest: 0.1,
  maxCostPerSession: 5.0,
  maxCostPerDay: 100.0,
  currency: 'USD',
});
```

## Pipeline

Create custom pipelines for specific use cases:

```typescript
import { createPipeline } from '@lov3kaizen/agentsea-guardrails';

const pipeline = createPipeline('customer-service')
  .addGuard('toxicity')
  .addGuard('pii')
  .addGuard('prompt-injection')
  .setFailureMode('fail-fast')
  .build();

const result = await pipeline.execute({
  input: 'User message here',
  type: 'input',
});
```

## Rules Engine

Define policies with JSON rules:

```typescript
import {
  createRulesEngine,
  type RuleSet,
} from '@lov3kaizen/agentsea-guardrails';

const rules: RuleSet = {
  id: 'content-policy',
  name: 'Content Policy',
  version: '1.0.0',
  rules: [
    {
      id: 'block-profanity',
      name: 'Block Profanity',
      conditions: [
        { field: 'input', operator: 'matches', value: '\\b(bad|word)\\b' },
      ],
      actions: [{ type: 'block', params: { reason: 'Profanity detected' } }],
      priority: 100,
      enabled: true,
    },
    {
      id: 'redact-emails',
      name: 'Redact Emails',
      conditions: [
        {
          field: 'input',
          operator: 'matches',
          value: '[a-z]+@[a-z]+\\.[a-z]+',
        },
      ],
      actions: [
        {
          type: 'transform',
          params: { pattern: '...', replacement: '[EMAIL]' },
        },
      ],
      priority: 80,
      enabled: true,
    },
  ],
};

const engine = createRulesEngine({ defaultAction: 'allow' });
engine.loadRuleSet(rules);

const result = await engine.evaluate({
  input: 'Contact me at user@example.com',
  type: 'input',
  metadata: {},
});
```

## NestJS Integration

### Module Setup

```typescript
import { Module } from '@nestjs/common';
import { GuardrailsModule } from '@lov3kaizen/agentsea-guardrails/nestjs';

@Module({
  imports: [
    GuardrailsModule.forRoot({
      guards: [
        { name: 'toxicity', enabled: true, type: 'input', action: 'block' },
        { name: 'pii', enabled: true, type: 'both', action: 'transform' },
        {
          name: 'prompt-injection',
          enabled: true,
          type: 'input',
          action: 'block',
        },
      ],
      failureMode: 'fail-fast',
      defaultAction: 'allow',
    }),
  ],
})
export class AppModule {}
```

### Controller Decorators

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import {
  Guardrailed,
  BypassGuards,
} from '@lov3kaizen/agentsea-guardrails/nestjs';
import { z } from 'zod';

const ResponseSchema = z.object({
  answer: z.string(),
  confidence: z.number(),
});

@Controller('chat')
export class ChatController {
  @Post()
  @Guardrailed({
    input: ['toxicity', 'prompt-injection', 'pii'],
    output: ['pii', 'schema'],
    schema: ResponseSchema,
  })
  async chat(@Body() body: { message: string }) {
    // Your logic here
    return { answer: '...', confidence: 0.95 };
  }

  @Post('admin')
  @BypassGuards()
  async adminChat(@Body() body: { message: string }) {
    // Bypasses all guardrails
    return { answer: '...' };
  }
}
```

### Service Usage

```typescript
import { Injectable } from '@nestjs/common';
import { GuardrailsService } from '@lov3kaizen/agentsea-guardrails/nestjs';

@Injectable()
export class ChatService {
  constructor(private readonly guardrails: GuardrailsService) {}

  async processMessage(message: string) {
    const inputCheck = await this.guardrails.checkInput(message);

    if (!inputCheck.passed) {
      throw new Error(`Message blocked: ${inputCheck.message}`);
    }

    const safeMessage = inputCheck.transformedContent || message;
    // Process the message...
  }
}
```

## Framework Integrations

### AgentSea

```typescript
import { Agent } from '@lov3kaizen/agentsea-core';
import {
  GuardrailsMiddleware,
  GuardedAgent,
} from '@lov3kaizen/agentsea-guardrails/agentsea';

// Middleware approach
const agent = new Agent({
  /* config */
});
agent.use(new GuardrailsMiddleware(guardrailsConfig));

// Wrapper approach
const guardedAgent = new GuardedAgent(agent, guardrailsEngine);
const response = await guardedAgent.run('User message');
```

### LangChain.js

```typescript
import { LLMChain } from 'langchain/chains';
import { GuardrailsCallbacks } from '@lov3kaizen/agentsea-guardrails/langchain';

const chain = new LLMChain({
  llm,
  prompt,
  callbacks: [new GuardrailsCallbacks(guardrailsConfig)],
});
```

### Vercel AI SDK

```typescript
import { streamText } from 'ai';
import { guardrailsMiddleware } from '@lov3kaizen/agentsea-guardrails/vercel-ai';

const result = await streamText({
  model: anthropic('claude-3-5-sonnet'),
  prompt: userInput,
  experimental_transform: guardrailsMiddleware(guardrailsConfig),
});
```

## Telemetry

### Logging

```typescript
import { GuardrailsLogger } from '@lov3kaizen/agentsea-guardrails';

const logger = new GuardrailsLogger({
  level: 'info',
  pretty: true,
});

const engine = createGuardrailsEngine({
  // ...config
  telemetry: {
    logging: { enabled: true, level: 'info' },
  },
});
```

### Metrics (Prometheus)

```typescript
import { GuardrailsMetrics } from '@lov3kaizen/agentsea-guardrails';

const metrics = new GuardrailsMetrics({
  prefix: 'guardrails_',
});

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', metrics.contentType);
  res.end(await metrics.getMetrics());
});
```

### Tracing (OpenTelemetry)

```typescript
import { GuardrailsTracer } from '@lov3kaizen/agentsea-guardrails';

const tracer = new GuardrailsTracer({
  serviceName: 'my-service',
});

const engine = createGuardrailsEngine({
  // ...config
  telemetry: {
    tracing: { enabled: true },
  },
});
```

## Configuration Reference

```typescript
interface GuardrailsConfig {
  // Array of guard configurations
  guards: GuardConfig[];

  // Pipeline settings
  pipeline?: PipelineConfig;

  // How to handle failures
  // - 'fail-fast': Stop on first failure
  // - 'fail-safe': Continue with warnings
  // - 'collect-all': Run all guards, collect results
  failureMode: 'fail-fast' | 'fail-safe' | 'collect-all';

  // Default action when no guard blocks
  defaultAction: 'allow' | 'block' | 'warn';

  // Telemetry settings
  telemetry?: {
    logging?: { enabled: boolean; level: string };
    metrics?: { enabled: boolean; prefix: string };
    tracing?: { enabled: boolean; serviceName: string };
  };
}

interface GuardConfig {
  name: string;
  enabled: boolean;
  type: 'input' | 'output' | 'both';
  action: 'allow' | 'block' | 'transform' | 'warn';
  config?: Record<string, unknown>;
  priority?: number;
}
```

## Examples

See the [examples](./examples) directory:

- `guardrails-basic.ts` - Basic usage
- `guardrails-nestjs.ts` - NestJS integration
- `guardrails-rules.ts` - Rules engine
- `guardrails-agentsea.ts` - AgentSea integration

## License

MIT
