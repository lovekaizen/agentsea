# @lov3kaizen/agentsea-structured

TypeScript-native structured output framework that guarantees LLM responses match your Zod schemas. Similar to Python's Instructor/Outlines but built specifically for TypeScript.

## Features

- **Zod Schema Integration**: Define expected output shapes using Zod schemas
- **Multiple Extraction Modes**: JSON mode, tool/function calling, prompt engineering, and hybrid approaches
- **Provider Adapters**: Built-in support for OpenAI, Anthropic, and Google
- **Streaming Support**: Get partial results as they stream in
- **Automatic Retries**: Smart retry with fix hints when validation fails
- **Schema-Aware Prompting**: Automatically generates schema prompts in multiple formats

## Installation

```bash
pnpm add @lov3kaizen/agentsea-structured zod
```

## Quick Start

```typescript
import { z } from 'zod';
import OpenAI from 'openai';
import {
  createStructuredClient,
  createOpenAIAdapter,
} from '@lov3kaizen/agentsea-structured';

// Define your schema
const UserSchema = z.object({
  name: z.string().describe('User full name'),
  email: z.string().email().describe('User email address'),
  age: z.number().int().positive().describe('User age'),
  interests: z.array(z.string()).describe('User interests'),
});

// Create provider adapter
const openai = new OpenAI();
const adapter = createOpenAIAdapter(openai);

// Create structured client
const client = createStructuredClient(adapter, {
  defaultMode: 'json',
  enableFixHints: true,
});

// Extract structured data
const result = await client.extract({
  model: 'gpt-4o',
  messages: [
    {
      role: 'user',
      content:
        'Extract user info: John Doe, john@example.com, 30 years old, likes coding and gaming',
    },
  ],
  response_format: UserSchema,
});

if (result.success) {
  console.log(result.data);
  // { name: 'John Doe', email: 'john@example.com', age: 30, interests: ['coding', 'gaming'] }
}
```

## Extraction Modes

### JSON Mode (Default)

Uses native JSON mode when available (OpenAI, Google):

```typescript
const result = await client.extract({
  model: 'gpt-4o',
  messages: [...],
  response_format: schema,
  mode: 'json',
});
```

### Tool Mode

Uses function/tool calling for extraction:

```typescript
const result = await client.extract({
  model: 'gpt-4o',
  messages: [...],
  response_format: schema,
  mode: 'tool',
});
```

### Prompt Mode

Uses prompt engineering for providers without native JSON support:

```typescript
const result = await client.extract({
  model: 'claude-3-5-sonnet-20241022',
  messages: [...],
  response_format: schema,
  mode: 'prompt',
});
```

### Hybrid Mode

Automatically falls back between modes:

```typescript
const result = await client.extract({
  model: 'gpt-4o',
  messages: [...],
  response_format: schema,
  mode: {
    mode: 'hybrid',
    fallbackOrder: ['json', 'tool', 'prompt'],
  },
});
```

## Streaming

Get partial results as they stream in:

```typescript
const stream = await client.extractStream(
  {
    model: 'gpt-4o',
    messages: [...],
    response_format: schema,
  },
  {
    yieldPartials: true,
    minFieldsBeforeYield: 2,
    onFieldComplete: (path, value) => {
      console.log(`Field ${path} completed:`, value);
    },
  }
);

// Iterate over partial results
for await (const partial of stream.partials()) {
  console.log('Partial:', partial);
}

// Get final result
const final = await stream.final();
```

## Provider Adapters

### OpenAI

```typescript
import OpenAI from 'openai';
import { createOpenAIAdapter } from '@lov3kaizen/agentsea-structured';

const openai = new OpenAI();
const adapter = createOpenAIAdapter(openai);
```

### Anthropic

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { createAnthropicAdapter } from '@lov3kaizen/agentsea-structured';

const anthropic = new Anthropic();
const adapter = createAnthropicAdapter(anthropic);
```

### Google

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createGoogleAdapter } from '@lov3kaizen/agentsea-structured';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const adapter = createGoogleAdapter(genAI);
```

## Retry Configuration

```typescript
const client = createStructuredClient(adapter, {
  defaultRetry: {
    maxAttempts: 3,
    retryOn: ['validation_error', 'parse_error'],
    backoffMultiplier: 1.5,
    initialDelay: 1000,
    maxDelay: 10000,
  },
  enableFixHints: true, // Add validation hints to retry prompts
});
```

## Schema Utilities

### Schema to Prompt

Convert Zod schemas to prompt-friendly representations:

```typescript
import { schemaToPrompt } from '@lov3kaizen/agentsea-structured';

const prompt = schemaToPrompt(UserSchema, {
  format: 'natural', // 'json-schema' | 'typescript' | 'natural' | 'examples'
  includeConstraints: true,
  includeExamples: true,
});

console.log(prompt.text);
```

### Schema Validation

```typescript
import {
  validateSchema,
  getValidationHints,
} from '@lov3kaizen/agentsea-structured';

const result = validateSchema(UserSchema, data);
if (!result.success) {
  const hints = getValidationHints(UserSchema, data);
  console.log('Hints for fixing:', hints);
}
```

## AgentSea Integration

Use with the AgentSea framework:

```typescript
import {
  createStructuredProvider,
  Extractors,
} from '@lov3kaizen/agentsea-structured';

const provider = createStructuredProvider({
  defaultModel: 'gpt-4o',
  enableFixHints: true,
});

provider.registerProvider('openai', {
  provider: 'openai',
  client: new OpenAI(),
});

// Use built-in extractors
const sentimentSchema = Extractors.sentiment();
const result = await provider.extract(
  sentimentSchema,
  'I love this product! The quality is amazing.',
);

// Create reusable typed extractors
const userExtractor = provider.createExtractor(UserSchema, {
  model: 'gpt-4o',
});

const user = await userExtractor.extract('John Doe, john@example.com, 30');
```

### Built-in Extractors

```typescript
import { Extractors } from '@lov3kaizen/agentsea-structured';

// List extraction
const listSchema = Extractors.list(z.string(), { minItems: 1, maxItems: 10 });

// Entity extraction
const entitySchema = Extractors.entity({
  name: z.string(),
  type: z.string(),
});

// Classification
const classifySchema = Extractors.classification(['spam', 'not_spam'], {
  confidence: true,
});

// Sentiment analysis
const sentimentSchema = Extractors.sentiment();

// Summary extraction
const summarySchema = Extractors.summary({ maxLength: 500 });
```

## API Reference

### StructuredClient

Main client for structured extraction.

```typescript
const client = createStructuredClient(adapter, config);

// Extract structured data
const result = await client.extract(options);

// Extract with streaming
const stream = await client.extractStream(options, streamingOptions);

// Check mode support
const supports = client.supportsMode('json', 'gpt-4o');

// Get provider capabilities
const caps = client.getProviderCapabilities('gpt-4o');
```

### Events

```typescript
client.on('extraction:start', ({ requestId, mode }) => { ... });
client.on('extraction:attempt', ({ requestId, attempt, mode }) => { ... });
client.on('extraction:success', ({ requestId, data, attempts }) => { ... });
client.on('extraction:error', ({ requestId, error, attempt }) => { ... });
client.on('extraction:retry', ({ requestId, attempt, reason, hints }) => { ... });
client.on('validation:failed', ({ requestId, errors }) => { ... });
client.on('mode:switch', ({ requestId, from, to }) => { ... });
```

## License

MIT
