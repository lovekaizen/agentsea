# Per-Model Type Safety

AgentSea provides compile-time type safety for model-specific configurations, inspired by [TanStack AI](https://tanstack.com/ai/latest/docs/guides/per-model-type-safety). This means you get TypeScript errors for invalid model options before your code ever runs.

## Why Per-Model Type Safety?

Different AI models have different capabilities:

| Model             | Tools | System Prompt | Vision | Extended Thinking |
| ----------------- | ----- | ------------- | ------ | ----------------- |
| Claude 3.5 Sonnet | ✅    | ✅            | ✅     | ✅                |
| Claude 3 Haiku    | ✅    | ✅            | ✅     | ❌                |
| GPT-4o            | ✅    | ✅            | ✅     | ❌                |
| o1                | ✅    | ❌            | ✅     | ✅                |
| o1-mini           | ❌    | ❌            | ❌     | ✅                |
| Gemini 1.5 Pro    | ✅    | ✅            | ✅     | ❌                |

Without type safety, you might accidentally pass `systemPrompt` to o1 (which doesn't support it) and get a confusing runtime error. With per-model type safety, TypeScript catches this at compile time.

## Quick Start

```typescript
import {
  anthropic,
  openai,
  gemini,
  ollama,
  createProvider,
} from '@lov3kaizen/agentsea-core';

// Type-safe configuration for Claude
const claudeConfig = anthropic('claude-3-5-sonnet-20241022', {
  tools: [myTool],
  systemPrompt: 'You are helpful',
  temperature: 0.7,
});

// Create a provider
const provider = createProvider(claudeConfig);
```

## Config Builders

AgentSea provides config builder functions for each provider:

### `anthropic(model, config?)`

```typescript
import { anthropic } from '@lov3kaizen/agentsea-core';

// Claude 3.5 Sonnet - supports everything
const config = anthropic('claude-3-5-sonnet-20241022', {
  tools: [myTool],
  systemPrompt: 'You are a helpful assistant',
  thinking: { type: 'enabled', budgetTokens: 10000 }, // Extended thinking
  temperature: 0.7,
  maxTokens: 4096,
  providerOptions: {
    metadata: { userId: 'user-123' },
    betas: ['computer-use-2024-10-22'],
  },
});

// Claude 3 Haiku - NO extended thinking
const haikuConfig = anthropic('claude-3-haiku-20240307', {
  tools: [myTool],
  systemPrompt: 'You are fast',
  // thinking: { ... } // ❌ TypeScript error!
});
```

**Supported Models:**

- `claude-3-5-sonnet-20241022`, `claude-3-5-sonnet-latest`
- `claude-3-5-haiku-20241022`, `claude-3-5-haiku-latest`
- `claude-3-opus-20240229`, `claude-3-opus-latest`
- `claude-3-sonnet-20240229`, `claude-3-haiku-20240307`
- `claude-opus-4-0-20250514`, `claude-sonnet-4-0-20250514`
- `claude-opus-4-5-20251101`

### `openai(model, config?)`

```typescript
import { openai } from '@lov3kaizen/agentsea-core';

// GPT-4o - supports tools, system prompts, structured output
const gpt4oConfig = openai('gpt-4o', {
  tools: [myTool],
  systemPrompt: 'You are helpful',
  temperature: 0.8,
  providerOptions: {
    responseFormat: { type: 'json_object' },
    seed: 42,
    parallelToolCalls: true,
  },
});

// o1 - supports tools and reasoning, but NOT system prompts
const o1Config = openai('o1', {
  tools: [myTool],
  reasoningEffort: 'high',
  // systemPrompt: '...' // ❌ TypeScript error!
});

// o1-mini - NO tools, NO system prompts
const o1MiniConfig = openai('o1-mini', {
  reasoningEffort: 'medium',
  // tools: [...] // ❌ TypeScript error!
});

// o3-mini - supports tools but NOT system prompts
const o3MiniConfig = openai('o3-mini', {
  tools: [myTool],
  reasoningEffort: 'high',
});
```

**Supported Models:**

- `gpt-4o`, `gpt-4o-2024-11-20`, `gpt-4o-2024-08-06`
- `gpt-4o-mini`, `gpt-4o-mini-2024-07-18`
- `gpt-4-turbo`, `gpt-4-turbo-2024-04-09`, `gpt-4-turbo-preview`
- `gpt-4`, `gpt-4-0613`
- `gpt-3.5-turbo`, `gpt-3.5-turbo-0125`
- `o1`, `o1-2024-12-17`, `o1-mini`, `o1-mini-2024-09-12`, `o1-preview`
- `o3-mini`, `o3-mini-2025-01-31`

### `gemini(model, config?)`

```typescript
import { gemini } from '@lov3kaizen/agentsea-core';

// Gemini 1.5 Pro - supports everything
const geminiConfig = gemini('gemini-1.5-pro', {
  tools: [myTool],
  systemPrompt: 'You are helpful',
  topK: 40,
  temperature: 0.9,
  providerOptions: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
    ],
  },
});
```

**Supported Models:**

- `gemini-2.0-flash-exp`, `gemini-2.0-flash-thinking-exp`
- `gemini-1.5-pro`, `gemini-1.5-pro-latest`
- `gemini-1.5-flash`, `gemini-1.5-flash-latest`, `gemini-1.5-flash-8b`
- `gemini-1.0-pro`

### `ollama(model, config?)`

```typescript
import { ollama } from '@lov3kaizen/agentsea-core';

// Ollama - dynamic models (less strict typing)
const ollamaConfig = ollama('llama3.2', {
  tools: [myTool],
  systemPrompt: 'You are helpful',
  temperature: 0.7,
  providerOptions: {
    numCtx: 4096,
    numGpu: 1,
  },
});
```

## Creating Providers

Use `createProvider()` for type-safe provider creation:

```typescript
import { createProvider, anthropic, openai } from '@lov3kaizen/agentsea-core';

// Generic factory
const claudeProvider = createProvider(anthropic('claude-3-5-sonnet-20241022', { ... }));
const openaiProvider = createProvider(openai('gpt-4o', { ... }));

// Provider-specific factories (for explicit typing)
import { createAnthropicProvider, createOpenAIProvider } from '@lov3kaizen/agentsea-core';

const claude = createAnthropicProvider(
  anthropic('claude-3-5-sonnet-20241022', { ... }),
  { apiKey: process.env.ANTHROPIC_API_KEY }
);
```

## Model Capabilities

### Checking Capabilities at Compile Time

TypeScript automatically restricts options based on model:

```typescript
// This compiles:
const config = openai('gpt-4o', { tools: [myTool] });

// This does NOT compile:
const config = openai('o1-mini', { tools: [myTool] });
// Error: 'tools' does not exist in type '...'
```

### Checking Capabilities at Runtime

```typescript
import {
  getModelInfo,
  modelSupportsCapability,
  getModelsWithCapability,
} from '@lov3kaizen/agentsea-core';

// Get full model info
const info = getModelInfo('claude-3-5-sonnet-20241022');
console.log(info);
// {
//   provider: 'anthropic',
//   model: 'claude-3-5-sonnet-20241022',
//   displayName: 'Claude 3.5 Sonnet',
//   capabilities: {
//     tools: true,
//     streaming: true,
//     vision: true,
//     structuredOutput: true,
//     systemMessage: true,
//     extendedThinking: true,
//     contextWindow: 200000,
//     maxOutputTokens: 8192,
//     parallelToolCalls: true,
//   }
// }

// Check specific capability
const supportsTools = modelSupportsCapability('o1-mini', 'tools'); // false
const supportsVision = modelSupportsCapability('gpt-4o', 'vision'); // true

// Find models with specific capabilities
const visionModels = getModelsWithCapability('vision', true);
const thinkingModels = getModelsWithCapability('extendedThinking', true);
```

### Using Provider Capabilities

```typescript
const provider = createProvider(anthropic('claude-3-5-sonnet-20241022', { ... }));

// Check capabilities on the provider
if (provider.supportsCapability('tools')) {
  // Safe to use tools
}

// Get model info
const info = provider.getModelInfo();
console.log(`Context window: ${info?.capabilities.contextWindow}`);
```

## Model Capability Reference

### Anthropic Models

| Model                | Tools | Vision | Thinking | Context | Max Output |
| -------------------- | ----- | ------ | -------- | ------- | ---------- |
| claude-3-5-sonnet-\* | ✅    | ✅     | ✅       | 200K    | 8,192      |
| claude-3-5-haiku-\*  | ✅    | ✅     | ❌       | 200K    | 8,192      |
| claude-3-opus-\*     | ✅    | ✅     | ❌       | 200K    | 4,096      |
| claude-opus-4-5-\*   | ✅    | ✅     | ✅       | 200K    | 32,000     |

### OpenAI Models

| Model         | Tools | System | Vision | Thinking | Context | Max Output |
| ------------- | ----- | ------ | ------ | -------- | ------- | ---------- |
| gpt-4o\*      | ✅    | ✅     | ✅     | ❌       | 128K    | 16,384     |
| gpt-4-turbo   | ✅    | ✅     | ✅     | ❌       | 128K    | 4,096      |
| gpt-3.5-turbo | ✅    | ✅     | ❌     | ❌       | 16K     | 4,096      |
| o1            | ✅    | ❌     | ✅     | ✅       | 200K    | 100,000    |
| o1-mini       | ❌    | ❌     | ❌     | ✅       | 128K    | 65,536     |
| o3-mini       | ✅    | ❌     | ❌     | ✅       | 200K    | 100,000    |

### Gemini Models

| Model                     | Tools | Vision | Thinking | Context | Max Output |
| ------------------------- | ----- | ------ | -------- | ------- | ---------- |
| gemini-2.0-flash-exp      | ✅    | ✅     | ❌       | 1M      | 8,192      |
| gemini-2.0-flash-thinking | ✅    | ✅     | ✅       | 1M      | 8,192      |
| gemini-1.5-pro            | ✅    | ✅     | ❌       | 2M      | 8,192      |
| gemini-1.5-flash          | ✅    | ✅     | ❌       | 1M      | 8,192      |

## Advanced: Type-Level Capability Checks

For advanced use cases, you can use type-level utilities:

```typescript
import type {
  ConfigSupports,
  RequireCapability,
  ProviderModelConfig,
} from '@lov3kaizen/agentsea-core';

// Check if a config supports a capability at the type level
type SupportsTools = ConfigSupports<typeof myConfig, 'tools'>; // true | false

// Require a capability for a function parameter
function withTools<T extends ProviderModelConfig>(
  config: RequireCapability<T, 'tools'>,
) {
  // TypeScript ensures this config supports tools
}
```

## Migration from Basic Provider Usage

**Before (no type safety):**

```typescript
const agent = new Agent(
  {
    name: 'assistant',
    model: 'o1-mini',
    provider: 'openai',
    systemPrompt: 'Hello', // Runtime error: o1-mini doesn't support this!
    tools: [myTool], // Runtime error: o1-mini doesn't support tools!
  },
  new OpenAIProvider(),
  toolRegistry,
);
```

**After (with type safety):**

```typescript
import { openai, createProvider } from '@lov3kaizen/agentsea-core';

// TypeScript catches errors at compile time
const config = openai('o1-mini', {
  // systemPrompt: 'Hello', // ❌ Compile error
  // tools: [myTool], // ❌ Compile error
  reasoningEffort: 'high', // ✅ Valid option
});

const provider = createProvider(config);
```

## Related Documentation

- [Providers](./PROVIDERS.md) - Provider-specific documentation
- [Tools](https://agentsea.dev/docs/tools) - Creating and using tools
- [TanStack AI Type Safety](https://tanstack.com/ai/latest/docs/guides/per-model-type-safety) - Inspiration
