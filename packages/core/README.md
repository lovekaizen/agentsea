# @lov3kaizen/agentsea-core

**Unite and orchestrate AI agents** - Framework-agnostic core library for building agentic AI applications in Node.js.

[![npm version](https://img.shields.io/npm/v/@lov3kaizen/agentsea-core.svg)](https://www.npmjs.com/package/@lov3kaizen/agentsea-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

## Features

- **Multi-Provider Support** - Anthropic Claude, OpenAI GPT, Google Gemini
- **Per-Model Type Safety** - Compile-time validation of model-specific options
- **Local & Open Source Models** - Ollama, LM Studio, LocalAI, Text Generation WebUI, vLLM
- **Voice Support (TTS/STT)** - OpenAI Whisper, ElevenLabs, Piper TTS, Local Whisper
- **MCP Protocol** - First-class Model Context Protocol integration
- **ACP Protocol** - Agentic Commerce Protocol for e-commerce (14 operations)
- **Multi-Agent Workflows** - Sequential, parallel, and supervisor orchestration
- **Conversation Schemas** - Structured conversational experiences with validation
- **Advanced Memory** - Buffer, Redis, summary, and tenant-based memory stores
- **Built-in Tools** - 13 coding tools + 8 general tools + custom tool support
- **Isomorphic Tool Definitions** - Server, client, and hybrid tool types
- **Multi-Tenancy** - Built-in tenant isolation for SaaS applications
- **Full Observability** - Logging, metrics, and distributed tracing

## Installation

```bash
npm install @lov3kaizen/agentsea-core
# or
pnpm add @lov3kaizen/agentsea-core
# or
yarn add @lov3kaizen/agentsea-core
```

## Quick Start

```typescript
import {
  Agent,
  AnthropicProvider,
  ToolRegistry,
  BufferMemory,
  calculatorTool,
} from '@lov3kaizen/agentsea-core';

const agent = new Agent(
  {
    name: 'assistant',
    model: 'claude-sonnet-4-6',
    provider: 'anthropic',
    systemPrompt: 'You are a helpful assistant.',
    tools: [calculatorTool],
  },
  new AnthropicProvider(process.env.ANTHROPIC_API_KEY),
  new ToolRegistry(),
  new BufferMemory(50),
);

const response = await agent.execute('What is 42 * 58?', {
  conversationId: 'user-123',
  sessionData: {},
  history: [],
});

console.log(response.content);
```

## Providers

### Cloud Providers

```typescript
import {
  AnthropicProvider,
  OpenAIProvider,
  GeminiProvider,
} from '@lov3kaizen/agentsea-core';

// Anthropic Claude (Opus 4.6, Sonnet 4.5, Haiku 4.5, and earlier)
const claude = new AnthropicProvider(process.env.ANTHROPIC_API_KEY);

// OpenAI (GPT-5, GPT-4.1, o3, o4-mini, GPT-4o, and more)
const openai = new OpenAIProvider(process.env.OPENAI_API_KEY);

// Google Gemini
const gemini = new GeminiProvider(process.env.GEMINI_API_KEY);
```

### Local Providers

```typescript
import {
  OllamaProvider,
  LMStudioProvider,
  LocalAIProvider,
  TextGenerationWebUIProvider,
  VLLMProvider,
  OpenAICompatibleProvider,
} from '@lov3kaizen/agentsea-core';

// Ollama
const ollama = new OllamaProvider({ baseUrl: 'http://localhost:11434' });

// LM Studio
const lmstudio = new LMStudioProvider({ baseUrl: 'http://localhost:1234/v1' });

// LocalAI
const localai = new LocalAIProvider({ baseUrl: 'http://localhost:8080/v1' });

// Any OpenAI-compatible endpoint
const custom = new OpenAICompatibleProvider({
  baseUrl: 'http://your-server/v1',
  apiKey: 'optional-key',
});
```

### Per-Model Type Safety

Get compile-time validation for model-specific options:

```typescript
import { anthropic, openai, createProvider } from '@lov3kaizen/agentsea-core';

// Claude supports tools, system prompts, and extended thinking
const claudeConfig = anthropic('claude-sonnet-4-6', {
  tools: [myTool],
  systemPrompt: 'You are a helpful assistant',
  thinking: { type: 'enabled', budgetTokens: 10000 },
});

// o3 supports tools and reasoning effort
const o3Config = openai('o3', {
  tools: [myTool],
  reasoningEffort: 'high',
});

// Create type-safe provider from config
const provider = createProvider(claudeConfig);
```

## Tools

### Built-in Tools

```typescript
import {
  // General tools
  calculatorTool,
  // Coding tools
  fileReadTool,
  fileWriteTool,
  fileListTool,
  shellExecuteTool,
  codeEditTool,
  globTool,
  grepTool,
  gitStatusTool,
  gitDiffTool,
  gitAddTool,
  gitCommitTool,
  gitLogTool,
  gitBranchTool,
} from '@lov3kaizen/agentsea-core';
```

### Custom Tools

```typescript
import { z } from 'zod';

const weatherTool = {
  name: 'get_weather',
  description: 'Get current weather for a location',
  parameters: z.object({
    location: z.string().describe('City name'),
  }),
  execute: async (params) => {
    return `Weather in ${params.location}: Sunny, 72°F`;
  },
};

toolRegistry.register(weatherTool);
```

### Isomorphic Tool Definitions

Define tools that work on server, client, or both:

```typescript
import { serverTool, clientTool, hybridTool } from '@lov3kaizen/agentsea-core';
import { z } from 'zod';

// Server-only tool
const dbQuery = serverTool({
  name: 'db_query',
  description: 'Query the database',
  parameters: z.object({ sql: z.string() }),
  execute: async (params) => {
    /* server-side only */
  },
});

// Client-only tool (runs in browser)
const showModal = clientTool({
  name: 'show_modal',
  description: 'Show a modal dialog',
  parameters: z.object({ message: z.string() }),
  execute: async (params) => {
    /* client-side only */
  },
});

// Hybrid tool (runs on both)
const logger = hybridTool({
  name: 'log',
  description: 'Log a message',
  parameters: z.object({ message: z.string() }),
  executeServer: async (params) => {
    /* server impl */
  },
  executeClient: async (params) => {
    /* client impl */
  },
});
```

## Memory

```typescript
import {
  BufferMemory,
  RedisMemory,
  SummaryMemory,
  TenantBufferMemory,
} from '@lov3kaizen/agentsea-core';

// Simple buffer (keep last N messages)
const buffer = new BufferMemory(50);

// Redis-backed for persistence
const redis = new RedisMemory({ url: 'redis://localhost:6379' });

// Summary-based (compresses old conversations)
const summary = new SummaryMemory(provider);

// Multi-tenant (isolates memory per tenant)
const tenant = new TenantBufferMemory(100);
```

## Workflows

Orchestrate multiple agents in different patterns:

```typescript
import {
  SequentialWorkflow,
  ParallelWorkflow,
  SupervisorWorkflow,
} from '@lov3kaizen/agentsea-core';

// Sequential: agents run one after another
const sequential = new SequentialWorkflow({
  name: 'research-pipeline',
  agents: [researchAgent, analyzeAgent, summaryAgent],
});

// Parallel: agents run simultaneously
const parallel = new ParallelWorkflow({
  name: 'multi-analysis',
  agents: [sentimentAgent, topicAgent, entityAgent],
});

// Supervisor: one agent delegates to others
const supervised = new SupervisorWorkflow({
  name: 'managed-team',
  supervisor: managerAgent,
  workers: [codeAgent, testAgent, reviewAgent],
});

const result = await sequential.execute('Research AI trends', context);
```

## MCP Integration

```typescript
import { MCPRegistry } from '@lov3kaizen/agentsea-core';

const mcpRegistry = new MCPRegistry();

await mcpRegistry.addServer({
  name: 'filesystem',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
  transport: 'stdio',
});

const mcpTools = mcpRegistry.getTools();
const agent = new Agent({ tools: mcpTools }, provider, toolRegistry);
```

## ACP (Agentic Commerce Protocol)

```typescript
import { ACPClient, createACPTools } from '@lov3kaizen/agentsea-core';

const acpClient = new ACPClient({
  baseUrl: 'https://api.yourcommerce.com/v1',
  apiKey: process.env.ACP_API_KEY,
  merchantId: process.env.ACP_MERCHANT_ID,
});

// 14 commerce operations: search, cart, checkout, payments, orders
const acpTools = createACPTools(acpClient);
```

## Voice

```typescript
import {
  VoiceAgent,
  OpenAIWhisperProvider,
  OpenAITTSProvider,
} from '@lov3kaizen/agentsea-core';

const voiceAgent = new VoiceAgent(agent, {
  sttProvider: new OpenAIWhisperProvider(process.env.OPENAI_API_KEY),
  ttsProvider: new OpenAITTSProvider(process.env.OPENAI_API_KEY),
  ttsConfig: { voice: 'nova' },
});

const result = await voiceAgent.processVoice(audioBuffer, context);
```

**Supported Providers:**

- **STT:** OpenAI Whisper, Local Whisper
- **TTS:** OpenAI TTS, ElevenLabs, Piper TTS

## Conversation Schemas

```typescript
import { ConversationSchema } from '@lov3kaizen/agentsea-core';
import { z } from 'zod';

const schema = new ConversationSchema({
  name: 'booking',
  startStep: 'destination',
  steps: [
    {
      id: 'destination',
      prompt: 'Where would you like to go?',
      schema: z.object({ city: z.string() }),
      next: 'dates',
    },
    {
      id: 'dates',
      prompt: 'What dates?',
      schema: z.object({ checkIn: z.string(), checkOut: z.string() }),
      next: 'confirm',
    },
  ],
});
```

## Observability

```typescript
import {
  Logger,
  defaultLogger,
  MetricsCollector,
  globalMetrics,
  Tracer,
  globalTracer,
} from '@lov3kaizen/agentsea-core';

// Structured logging
const logger = new Logger({ level: 'info', pretty: true });
logger.info('Agent started', { agent: 'assistant' });

// Metrics collection
globalMetrics.increment('agent.requests');
globalMetrics.histogram('agent.latency', 150);

// Distributed tracing
const span = globalTracer.startSpan('agent.execute');
span.end();
```

## Utilities

```typescript
import {
  RateLimiter,
  LRUCache,
  ContentFormatter,
} from '@lov3kaizen/agentsea-core';

// Rate limiting
const limiter = new RateLimiter({ maxRequests: 100, windowMs: 60000 });

// LRU caching
const cache = new LRUCache<string>({ maxSize: 1000 });

// Content formatting
const formatted = ContentFormatter.format(response);
```

## API Reference

### Agent

| Method                             | Description                                  |
| ---------------------------------- | -------------------------------------------- |
| `execute(input, context)`          | Execute agent with input and return response |
| `executeStream(input, context)`    | Stream agent response chunks                 |
| `registerProvider(name, provider)` | Register a provider                          |

### ToolRegistry

| Method                           | Description               |
| -------------------------------- | ------------------------- |
| `register(tool)`                 | Register a tool           |
| `get(name)`                      | Get a tool by name        |
| `list()`                         | List all registered tools |
| `execute(name, params, context)` | Execute a tool            |

## Related Packages

| Package                                          | Description                                |
| ------------------------------------------------ | ------------------------------------------ |
| [@lov3kaizen/agentsea-cli](../cli)               | Command-line interface with agentic coding |
| [@lov3kaizen/agentsea-nestjs](../nestjs)         | NestJS integration                         |
| [@lov3kaizen/agentsea-crews](../crews)           | Multi-agent orchestration                  |
| [@lov3kaizen/agentsea-memory](../memory)         | Advanced memory systems                    |
| [@lov3kaizen/agentsea-cache](../cache)           | Intelligent LLM caching                    |
| [@lov3kaizen/agentsea-guardrails](../guardrails) | Safety & validation                        |
| [@lov3kaizen/agentsea-evaluate](../evaluate)     | LLM evaluation                             |
| [@lov3kaizen/agentsea-redteam](../redteam)       | Red teaming & security                     |
| [@lov3kaizen/agentsea-analytics](../analytics)   | Conversation analytics                     |
| [@lov3kaizen/agentsea-react](../react)           | React components                           |

## License

MIT License - see [LICENSE](../../LICENSE) for details
