# AgentSea

**Unite and orchestrate AI agents** - A production-ready ADK for building agentic AI applications in Node.js.

AgentSea ADK unites AI agents and services to create powerful, intelligent applications and integrations.

[![npm version](https://img.shields.io/npm/v/@lov3kaizen/agentsea-core.svg)](https://www.npmjs.com/package/@lov3kaizen/agentsea-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)

## ✨ Features

- 🤖 **Multi-Provider Support** - Anthropic Claude, OpenAI GPT, Google Gemini
- 🎯 **Per-Model Type Safety** - Compile-time validation of model-specific options
- 🏠 **Local & Open Source Models** - Ollama, LM Studio, LocalAI, Text Generation WebUI, vLLM
- 💻 **Agentic Coding** - Interactive AI coding assistant with 13 built-in tools (file ops, git, shell, search)
- 🎙️ **Voice Support (TTS/STT)** - OpenAI Whisper, ElevenLabs, Piper TTS, Local Whisper
- 🔗 **MCP Protocol** - First-class Model Context Protocol integration
- 🛒 **ACP Protocol** - Agentic Commerce Protocol for e-commerce integration
- 🔄 **Multi-Agent Crews** - Role-based coordination with delegation strategies
- 💬 **Conversation Schemas** - Structured conversational experiences with validation
- 🧠 **Advanced Memory** - Episodic, semantic, and working memory with multi-agent sharing
- 🔧 **Built-in Tools** - 13 coding tools + 8 general tools + custom tool support
- 🛡️ **Guardrails** - Content safety, prompt injection detection, PII filtering, and validation
- 📊 **LLM Evaluation** - Metrics, LLM-as-Judge, human feedback, and continuous monitoring
- 🔴 **Red Teaming** - Adversarial testing, vulnerability scanning, and compliance checking
- 🌐 **LLM Gateway** - OpenAI-compatible API with intelligent routing, caching, and cost optimization
- 🔍 **Embeddings** - Multi-provider embeddings with caching and quality metrics
- 📝 **Structured Output** - TypeScript-native Zod schema enforcement for LLM responses
- 📥 **Document Ingestion** - Flexible pipeline with parsers, chunkers, and transformers
- 💾 **Intelligent Caching** - Exact match, semantic similarity, and streaming replay with multi-tier support
- 📋 **Prompt Management** - Version control, A/B testing, and environment promotion for prompts
- 🌐 **Browser Automation** - Web agents with Playwright, Puppeteer, and native backends
- 📈 **Full Observability** - Logging, metrics, distributed tracing, cost tracking, and conversation analytics
- 🎯 **NestJS Integration** - Decorators, modules, and dependency injection
- 🌐 **REST API & Streaming** - HTTP endpoints, SSE streaming, WebSocket support
- 🐛 **Agent Debugger** - Step-through execution, checkpoint replay, and what-if scenario testing
- 🚀 **Production Ready** - Rate limiting, caching, error handling, retries
- 📘 **TypeScript** - Fully typed with comprehensive definitions

## 🚀 Quick Start

### Requirements

- **Node.js >= 20.0.0** (Node 18 is no longer supported as of v1.0.1)
- TypeScript 5.0+ (recommended)

### Installation

```bash
# Core package (framework-agnostic)
pnpm add @lov3kaizen/agentsea-core

# NestJS integration
pnpm add @lov3kaizen/agentsea-nestjs
```

### Basic Agent

```typescript
import {
  Agent,
  AnthropicProvider,
  ToolRegistry,
  BufferMemory,
  calculatorTool,
} from '@lov3kaizen/agentsea-core';

// Create agent
const agent = new Agent(
  {
    name: 'assistant',
    model: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    systemPrompt: 'You are a helpful assistant.',
    tools: [calculatorTool],
  },
  new AnthropicProvider(process.env.ANTHROPIC_API_KEY),
  new ToolRegistry(),
  new BufferMemory(50),
);

// Execute
const response = await agent.execute('What is 42 * 58?', {
  conversationId: 'user-123',
  sessionData: {},
  history: [],
});

console.log(response.content);
```

### Multi-Provider Support

```typescript
import {
  Agent,
  GeminiProvider,
  OpenAIProvider,
  AnthropicProvider,
  OllamaProvider,
  LMStudioProvider,
  LocalAIProvider,
} from '@lov3kaizen/agentsea-core';

// Use Gemini
const geminiAgent = new Agent(
  { model: 'gemini-pro', provider: 'gemini' },
  new GeminiProvider(process.env.GEMINI_API_KEY),
  toolRegistry,
);

// Use OpenAI
const openaiAgent = new Agent(
  { model: 'gpt-4-turbo-preview', provider: 'openai' },
  new OpenAIProvider(process.env.OPENAI_API_KEY),
  toolRegistry,
);

// Use Anthropic
const claudeAgent = new Agent(
  { model: 'claude-sonnet-4-20250514', provider: 'anthropic' },
  new AnthropicProvider(process.env.ANTHROPIC_API_KEY),
  toolRegistry,
);

// Use Ollama (local)
const ollamaAgent = new Agent(
  { model: 'llama2', provider: 'ollama' },
  new OllamaProvider(),
  toolRegistry,
);

// Use LM Studio (local)
const lmstudioAgent = new Agent(
  { model: 'local-model', provider: 'openai-compatible' },
  new LMStudioProvider(),
  toolRegistry,
);

// Use LocalAI (local)
const localaiAgent = new Agent(
  { model: 'gpt-3.5-turbo', provider: 'openai-compatible' },
  new LocalAIProvider(),
  toolRegistry,
);
```

### Per-Model Type Safety

Get compile-time validation for model-specific options. Inspired by [TanStack AI](https://tanstack.com/ai/latest/docs/guides/per-model-type-safety):

```typescript
import { anthropic, openai, createProvider } from '@lov3kaizen/agentsea-core';

// ✅ Valid: Claude 3.5 Sonnet supports tools, system prompts, and extended thinking
const claudeConfig = anthropic('claude-3-5-sonnet-20241022', {
  tools: [myTool],
  systemPrompt: 'You are a helpful assistant',
  thinking: { type: 'enabled', budgetTokens: 10000 },
  temperature: 0.7,
});

// ✅ Valid: o1 supports tools but NOT system prompts
const o1Config = openai('o1', {
  tools: [myTool],
  reasoningEffort: 'high',
  // systemPrompt: '...' // ❌ TypeScript error - o1 doesn't support system prompts
});

// ❌ TypeScript error: o1-mini doesn't support tools
const o1MiniConfig = openai('o1-mini', {
  // tools: [myTool], // Error: 'tools' does not exist in type
  reasoningEffort: 'medium',
});

// Create type-safe providers
const provider = createProvider(claudeConfig);
console.log('Supports vision:', provider.supportsCapability('vision')); // true
```

**Key Benefits:**

- **Zero runtime overhead** - All validation at compile time
- **IDE autocomplete** - Only valid options appear per model
- **Model capability registry** - Query what each model supports

[See full per-model type safety documentation →](./docs/PER_MODEL_TYPE_SAFETY.md)

### Local Models & Open Source

Run AI models on your own hardware with complete privacy:

```typescript
import { Agent, OllamaProvider } from '@lov3kaizen/agentsea-core';

// Create Ollama provider
const provider = new OllamaProvider({
  baseUrl: 'http://localhost:11434',
});

// Pull a model (if not already available)
await provider.pullModel('llama2');

// List available models
const models = await provider.listModels();
console.log('Available models:', models);

// Create agent with local model
const agent = new Agent({
  name: 'local-assistant',
  description: 'AI assistant running locally',
  model: 'llama2',
  provider: 'ollama',
  systemPrompt: 'You are a helpful assistant.',
});

agent.registerProvider('ollama', provider);

// Use the agent
const response = await agent.execute('Hello!', {
  conversationId: 'conv-1',
  sessionData: {},
  history: [],
});
```

Supported local providers:

- **Ollama** - Easy local LLM execution
- **LM Studio** - User-friendly GUI for local models
- **LocalAI** - OpenAI-compatible local API
- **Text Generation WebUI** - Feature-rich web interface
- **vLLM** - High-performance inference engine
- **Any OpenAI-compatible endpoint**

[See full local models documentation →](./docs/LOCAL_MODELS.md)

### Voice Capabilities

Add voice interaction with Text-to-Speech and Speech-to-Text:

```typescript
import {
  Agent,
  AnthropicProvider,
  ToolRegistry,
  VoiceAgent,
  OpenAIWhisperProvider,
  OpenAITTSProvider,
} from '@lov3kaizen/agentsea-core';

// Create base agent
const provider = new AnthropicProvider(process.env.ANTHROPIC_API_KEY);
const toolRegistry = new ToolRegistry();

const agent = new Agent(
  {
    name: 'voice-assistant',
    model: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    systemPrompt: 'You are a helpful voice assistant.',
    description: 'Voice assistant',
  },
  provider,
  toolRegistry,
);

// Create voice agent with STT and TTS
const sttProvider = new OpenAIWhisperProvider(process.env.OPENAI_API_KEY);
const ttsProvider = new OpenAITTSProvider(process.env.OPENAI_API_KEY);

const voiceAgent = new VoiceAgent(agent, {
  sttProvider,
  ttsProvider,
  ttsConfig: { voice: 'nova' },
});

// Process voice input
const result = await voiceAgent.processVoice(audioBuffer, context);
console.log('User said:', result.text);
console.log('Assistant response:', result.response.content);

// Save audio response
fs.writeFileSync('./response.mp3', result.audio!);
```

Supported providers:

- **STT:** OpenAI Whisper, Local Whisper
- **TTS:** OpenAI TTS, ElevenLabs, Piper TTS

[See full voice documentation →](./docs/VOICE.md)

### MCP Integration

```typescript
import { MCPRegistry } from '@lov3kaizen/agentsea-core';

// Connect to MCP servers
const mcpRegistry = new MCPRegistry();

await mcpRegistry.addServer({
  name: 'filesystem',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
  transport: 'stdio',
});

// Get MCP tools (automatically converted)
const mcpTools = mcpRegistry.getTools();

// Use with agent
const agent = new Agent({ tools: mcpTools }, provider, toolRegistry);
```

### ACP Commerce Integration

Add e-commerce capabilities to your agents with the Agentic Commerce Protocol:

```typescript
import { ACPClient, createACPTools, Agent } from '@lov3kaizen/agentsea-core';

// Setup ACP client
const acpClient = new ACPClient({
  baseUrl: 'https://api.yourcommerce.com/v1',
  apiKey: process.env.ACP_API_KEY,
  merchantId: process.env.ACP_MERCHANT_ID,
});

// Create commerce tools
const acpTools = createACPTools(acpClient);

// Create shopping agent
const shoppingAgent = new Agent(
  {
    name: 'shopping-assistant',
    model: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    systemPrompt: 'You are a helpful shopping assistant.',
    tools: acpTools, // Includes 14 commerce tools
  },
  provider,
  toolRegistry,
);

// Start shopping
const response = await shoppingAgent.execute(
  'I need wireless headphones under $100',
  context,
);
```

**Available Commerce Operations:**

- Product search and discovery
- Shopping cart management
- Checkout and payment processing
- Delegated payments (Stripe, PayPal, etc.)
- Order tracking and management

[See full ACP documentation →](./docs/ACP_INTEGRATION.md)

### Conversation Schemas

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
      schema: z.object({
        checkIn: z.string(),
        checkOut: z.string(),
      }),
      next: 'confirm',
    },
  ],
});
```

### Agentic Coding

Launch an interactive AI coding session with 13 built-in tools:

```bash
# Start agentic coding session
sea code

# Use a specific provider/model
sea code --provider anthropic --model claude-sonnet-4-20250514

# Verbose mode with token usage and latency
sea code --verbose

# Limit tool iterations
sea code --maxIterations 50
```

The coding agent has access to:

- **File Operations** - `file_read`, `file_write`, `file_list`
- **Code Editing** - `code_edit` (precise search-and-replace)
- **Search** - `glob` (pattern matching), `grep` (regex search)
- **Shell** - `shell_execute` (with safety checks)
- **Git** - `git_status`, `git_diff`, `git_add`, `git_commit`, `git_log`, `git_branch`

[See CLI documentation →](./packages/cli)

### With CLI

```bash
# Install CLI globally
npm install -g @lov3kaizen/agentsea-cli

# Initialize configuration
sea init

# Start chatting
sea chat

# Start an agentic coding session
sea code

# Run an agent
sea agent run default "What is the capital of France?"

# Manage models (Ollama)
sea model pull llama2
sea model list
```

[See CLI documentation →](./packages/cli)

### With NestJS

```typescript
import { Module } from '@nestjs/common';
import { AgenticModule } from '@lov3kaizen/agentsea-nestjs';
import { AnthropicProvider } from '@lov3kaizen/agentsea-core';

@Module({
  imports: [
    AgenticModule.forRoot({
      provider: new AnthropicProvider(),
      defaultConfig: {
        model: 'claude-sonnet-4-20250514',
        provider: 'anthropic',
      },
      enableRestApi: true, // Enable REST API endpoints
      enableWebSocket: true, // Enable WebSocket gateway
    }),
  ],
})
export class AppModule {}
```

**REST API Endpoints:**

- `GET /agents` - List all agents
- `GET /agents/:name` - Get agent details
- `POST /agents/:name/execute` - Execute agent
- `POST /agents/:name/stream` - Stream agent response (SSE)

**WebSocket Events:**

- `execute` - Execute an agent
- `stream` - Real-time streaming events
- `listAgents` - Get available agents
- `getAgent` - Get agent info

[See API documentation →](./docs/API.md)

## 📦 Packages

### Core Packages

- **[@lov3kaizen/agentsea-core](./packages/core)** - Framework-agnostic core library
- **[@lov3kaizen/agentsea-types](./packages/types)** - Shared TypeScript type definitions
- **[@lov3kaizen/agentsea-nestjs](./packages/nestjs)** - NestJS integration with decorators
- **[@lov3kaizen/agentsea-cli](./packages/cli)** - Command-line interface

### Agent Orchestration

- **[@lov3kaizen/agentsea-crews](./packages/crews)** - Multi-agent orchestration with role-based coordination
- **[@lov3kaizen/agentsea-gateway](./packages/gateway)** - High-performance LLM gateway with routing, caching, and cost optimization

### Memory & Retrieval

- **[@lov3kaizen/agentsea-memory](./packages/memory)** - Advanced memory with semantic retrieval and multi-agent support
- **[@lov3kaizen/agentsea-embeddings](./packages/embeddings)** - Embedding providers with caching and quality metrics
- **[@lov3kaizen/agentsea-cache](./packages/cache)** - Intelligent caching with semantic similarity, streaming replay, and multi-tier support

### Data Processing

- **[@lov3kaizen/agentsea-structured](./packages/structured)** - TypeScript-native structured output with Zod schema enforcement
- **[@lov3kaizen/agentsea-ingest](./packages/ingest)** - Document ingestion pipeline with parsers and chunkers
- **[@lov3kaizen/agentsea-prompts](./packages/prompts)** - Prompt management with version control, A/B testing, and environment promotion

### Safety & Evaluation

- **[@lov3kaizen/agentsea-guardrails](./packages/guardrails)** - Content safety, prompt injection detection, and validation
- **[@lov3kaizen/agentsea-evaluate](./packages/evaluate)** - LLM evaluation, human feedback, and continuous monitoring
- **[@lov3kaizen/agentsea-redteam](./packages/redteam)** - Red teaming and adversarial testing for AI systems

### Observability & Operations

- **[@lov3kaizen/agentsea-analytics](./packages/analytics)** - Conversation analytics with intent classification, sentiment tracking, flow analysis, and KPI monitoring
- **[@lov3kaizen/agentsea-costs](./packages/costs)** - Cost tracking with 60+ model pricing registry, budget enforcement, and Stripe billing integration
- **[@lov3kaizen/agentsea-debugger](./packages/debugger)** - Agent debugger with step-through execution, checkpoint replay, and what-if scenario testing

### Automation

- **[@lov3kaizen/agentsea-surf](./packages/surf)** - Computer-use agent for desktop automation with screen capture, mouse/keyboard control, and browser automation

### UI

- **[@lov3kaizen/agentsea-react](./packages/react)** - React components for agent interfaces
- **[@lov3kaizen/agentsea-admin-ui](./packages/admin-ui)** - Admin dashboard for monitoring agents

### Examples

- **[examples](./examples)** - Example applications

## 🏗️ Architecture

AgentSea follows a clean, layered architecture:

```
┌─────────────────────────────────────────┐
│         Application Layer               │
│  (Your NestJS/Node.js Application)      │
└─────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────┐
│         AgentSea ADK Layer               │
│  ┌─────────────────────────────────┐    │
│  │  Multi-Agent Orchestration      │    │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │  Conversation Management        │    │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │  Agent Runtime & Tools          │    │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │  Multi-Provider Adapters        │    │
│  │  (Claude, GPT, Gemini, MCP)     │    │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │  Observability & Utils          │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────┐
│         Infrastructure Layer            │
│  (LLM APIs, Storage, Monitoring)        │
└─────────────────────────────────────────┘
```

## 🎯 Core Concepts

### Agents

Autonomous AI entities that can reason, use tools, and maintain conversation context.

### Crews

Multi-agent teams with defined roles, delegation strategies, and coordinated task execution.

### Tools

Functions that agents can call to perform specific tasks (API calls, calculations, etc.).

### Memory

Hierarchical memory system with episodic, semantic, and working memory structures. Supports multi-agent sharing with access control.

### Guardrails

Input validation, output filtering, and safety checks to ensure responsible AI behavior.

### Evaluation

LLM-as-Judge, human feedback collection, and continuous monitoring for quality assurance.

### Gateway

OpenAI-compatible API gateway with intelligent routing, load balancing, and fallback handling.

### MCP

Model Context Protocol integration for seamless tool and resource integration.

### Conversation Schemas

Define structured conversation flows with validation and dynamic routing.

### Agentic Coding

Interactive AI coding sessions with 13 built-in tools for file operations, code editing, search, shell execution, and git operations. Works with any provider.

### Red Teaming

Proactive security testing with adversarial attack generation, vulnerability scanning, jailbreak detection, compliance checking, and audit logging.

### Prompt Management

Git-like version control for prompts with environment promotion (dev/staging/prod), A/B testing, and team collaboration.

### Debugger

Step-through agent execution with breakpoints, checkpoint replay, what-if scenario testing, and decision tree visualization.

### Analytics

Conversation analytics with intent classification, sentiment analysis, topic clustering, anomaly detection, and KPI tracking.

## 📚 Documentation

Full documentation available at [agentsea.dev](https://agentsea.dev)

### Getting Started

- [Installation](https://agentsea.dev/docs/installation)
- [Quick Start](https://agentsea.dev/docs/quick-start)
- [CLI Guide](./docs/CLI.md)

### Core Concepts

- [Agents](https://agentsea.dev/docs/agents)
- [Providers](https://agentsea.dev/docs/providers)
- [Per-Model Type Safety](./docs/PER_MODEL_TYPE_SAFETY.md)
- [Tools](https://agentsea.dev/docs/tools)
- [Conversation Schemas](https://agentsea.dev/docs/conversation)

### Package Documentation

- [Core - Agent Framework](./packages/core/README.md)
- [Structured - Zod Schema Enforcement](./packages/structured/README.md)
- [Guardrails - Safety & Validation](./packages/guardrails/README.md)
- [Gateway - LLM Gateway](./packages/gateway/README.md)
- [Ingest - Document Ingestion](./packages/ingest/README.md)
- [Crews - Multi-Agent Orchestration](./packages/crews/README.md)
- [Memory - Advanced Memory Systems](./packages/memory/README.md)
- [Embeddings - Embedding Providers](./packages/embeddings/README.md)
- [Cache - Intelligent LLM Caching](./packages/cache/README.md)
- [Evaluate - LLM Evaluation](./packages/evaluate/README.md)
- [Red Team - AI Safety Testing](./packages/redteam/README.md)
- [Analytics - Conversation Analytics](./packages/analytics/README.md)
- [Prompts - Prompt Management](./packages/prompts/README.md)
- [Debugger - Agent Debugging](./packages/debugger/README.md)
- [Costs - Cost Tracking](./packages/costs/README.md)
- [Surf - Computer-Use Agent](./packages/surf/README.md)
- [React - UI Components](./packages/react/README.md)

### Integrations

- [MCP Integration](https://agentsea.dev/docs/mcp-overview)
- [Local Models & Open Source](./docs/LOCAL_MODELS.md)
- [Voice Features (TTS/STT)](./docs/VOICE.md)
- [Provider Reference](./docs/PROVIDERS.md)
- [NestJS Integration](https://agentsea.dev/docs/nestjs)

### Operations

- [Observability](https://agentsea.dev/docs/observability)
- [API Reference](https://agentsea.dev/api)

## 🛠️ Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run tests with coverage
pnpm test:cov

# Development mode (watch)
pnpm dev

# Lint
pnpm lint

# Type check
pnpm type-check
```

## ✅ Feature Status

Maturity is tracked per area. **Stable** = implemented and covered by tests;
**Beta** = usable and tested but with known gaps or rough edges (see each package
README); **WIP** = under active development, APIs and behavior may change.

### ✅ Stable

- [x] Multi-provider support (Claude, GPT, Gemini) with 60+ models including GPT-5, GPT-4.1, o3, o4-mini
- [x] Per-model type safety with compile-time validation of model-specific options
- [x] Local & open source model support (Ollama, LM Studio, LocalAI, etc.)
- [x] Voice support (TTS/STT) with multiple providers
- [x] Command-line interface (CLI) with interactive chat
- [x] Agentic coding (`sea code`) with 13 built-in coding tools
- [x] MCP protocol integration
- [x] ACP (Agentic Commerce Protocol) with 14 commerce operations
- [x] Conversation schema system with step-based flows
- [x] Advanced memory stores (Buffer, Redis, PostgreSQL, SQLite, Pinecone)
- [x] Memory structures (Episodic, Semantic, Working)
- [x] Multi-agent memory sharing with access control
- [x] LLM Gateway with OpenAI-compatible API, caching, and cost optimization
- [x] Intelligent routing (round-robin, least-latency, cost-based)
- [x] Structured output with Zod schema enforcement
- [x] Document ingestion pipeline with parsers and chunkers
- [x] Guardrails for content safety, prompt injection, and PII detection
- [x] Content filtering and validation
- [x] Intelligent caching with semantic similarity, streaming replay, and multi-tier support
- [x] Prompt management with version control, A/B testing, and environment promotion
- [x] Agent debugger with step-through execution, checkpoint replay, and what-if testing
- [x] Conversation analytics with intent classification, sentiment, and topic clustering
- [x] Built-in tools (13 coding tools + 8 general tools + custom support)
- [x] Observability (logging, metrics, tracing)
- [x] Cost tracking with 60+ model pricing registry and budget enforcement
- [x] NestJS integration for all packages
- [x] React components for agent interfaces
- [x] Multi-tenancy support
- [x] Rate limiting and caching
- [x] TypeScript definitions with strict type safety
- [x] CI/CD workflows with automated releases
- [x] **Crews** — multi-agent orchestration (role-based coordination; round-robin,
      best-match, auction, hierarchical, and consensus delegation) with real LLM
      execution by default via the core-backed `CoreExecutor` (mock path opt-in
      with `mock: true`). The default execution path is covered end-to-end in the
      `e2e` package via an injectable provider seam.
- [x] **Evaluate** — LLM evaluation metrics, LLM-as-Judge, human feedback, and
      preference learning (RLHF/DPO). Continuous monitoring with email (SMTP via
      nodemailer), webhook/Slack, and PagerDuty (Events API v2) alert channels;
      HuggingFace dataset import (datasets-server REST) and Hub export
      (`@huggingface/hub`).
- [x] **Red Team** — adversarial attack generation, vulnerability scanning, and
      jailbreak detection; safety benchmarks, compliance checking. Continuous
      testing with cron-driven schedules (`cron-parser`), real alert delivery
      (webhook/Slack/Teams/Discord/PagerDuty/email), and tamper-evident,
      hash-chained audit logging with pluggable persistent storage
      (`FileAuditStore`).
- [x] **Embeddings** — multi-provider support (OpenAI, Cohere, Voyage, HuggingFace),
      chunking, caching, and Pinecone/Chroma/Qdrant/**pgvector/Weaviate/Milvus**
      stores, plus local **ONNX** models via Transformers.js
      (`@xenova/transformers`).
- [x] **Surf** — vision-driven computer use and browser automation across
      **Puppeteer/Playwright** (chromium/firefox/webkit), **Docker**,
      **Kubernetes** (pod via `kubectl exec`), **VNC/RDP** (remote display), and
      native Linux/macOS/Windows backends. Backend action translation is
      unit-tested (injected exec/clients) and a guarded headless smoke test
      covers the real browser launch path. VNC/RDP frame-capture and the RDP
      transport are experimental — inject a custom client for production.

### 🚧 Work in Progress

- [ ] Admin UI dashboard improvements
- [ ] Additional MCP tools/servers
- [ ] Enhanced computer-use agent capabilities

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

- 💬 [Discussions](https://github.com/lovekaizen/agentsea/discussions) - Ask questions and share ideas
- 🐛 [Issues](https://github.com/lovekaizen/agentsea/issues) - Report bugs and request features
- 📖 [Documentation](https://agentsea.dev) - Read the full documentation

## 📄 License

MIT License - see [LICENSE](LICENSE) for details

## 🙏 Credits

Built with ❤️ by [lovekaizen](https://lovekaizen.com)

Special thanks to:

- [Anthropic](https://anthropic.com) for Claude
- [OpenAI](https://openai.com) for GPT
- [Google](https://ai.google.dev) for Gemini
- The open source community

---

<div align="center">

**[Website](https://agentsea.dev)** • **[Documentation](https://agentsea.dev/docs)** • **[Examples](https://agentsea.dev/examples)** • **[API Reference](https://agentsea.dev/api)**

Made with TypeScript and AI 🤖

</div>
