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

## 🧠 Supported Models

AgentSea ships a typed model registry (60+ models with capabilities and live pricing). Latest highlights per provider — pass any of these as `model`:

| Provider             | Latest models                                                                                                                  | Notes                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| **Anthropic Claude** | `claude-opus-4-8` _(default)_, `claude-opus-4-7`, `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5`, `claude-fable-5` | Adaptive thinking on Opus 4.6+, Sonnet 4.6, Fable 5 |
| **OpenAI**           | `gpt-5.5`, `gpt-5.4-mini`, `gpt-5.2` (+ `pro` / `codex`), `gpt-5.1`, `o3`, `o1`                                                | Reasoning-effort aware, per-model capability typing |
| **Google Gemini**    | `gemini-3.5-flash`, `gemini-3.1-pro-preview`, `gemini-2.5-pro`, `gemini-2.5-flash`                                             |                                                     |
| **Local / OSS**      | Ollama, LM Studio, LocalAI, vLLM, Text Generation WebUI, any OpenAI-compatible endpoint                                        | Run fully on your own hardware                      |

Older generations (Claude 3.x / Sonnet 4.5, GPT-4o, Gemini 1.5/2.0, …) remain supported. See [`@lov3kaizen/agentsea-types`](./packages/types) for the full registry and [costs](./packages/costs) for the pricing table.

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
    model: 'claude-opus-4-8',
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
  { model: 'gemini-2.5-pro', provider: 'gemini' },
  new GeminiProvider(process.env.GEMINI_API_KEY),
  toolRegistry,
);

// Use OpenAI
const openaiAgent = new Agent(
  { model: 'gpt-5.5', provider: 'openai' },
  new OpenAIProvider(process.env.OPENAI_API_KEY),
  toolRegistry,
);

// Use Anthropic
const claudeAgent = new Agent(
  { model: 'claude-opus-4-8', provider: 'anthropic' },
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

// ✅ Valid: Claude Opus 4.8 supports tools and system prompts. Thinking is
// adaptive on 4.6+ models, so budget_tokens-style config is intentionally
// not part of the type.
const claudeConfig = anthropic('claude-opus-4-8', {
  tools: [myTool],
  systemPrompt: 'You are a helpful assistant',
});

// ✅ Valid: Claude Sonnet 4.5 still exposes explicit extended thinking
const sonnetConfig = anthropic('claude-sonnet-4-5-20250929', {
  tools: [myTool],
  systemPrompt: 'You are a helpful assistant',
  thinking: { type: 'enabled', budgetTokens: 10000 },
});

// ✅ Valid: o1 supports tools but NOT system prompts
const o1Config = openai('o1', {
  tools: [myTool],
  reasoningEffort: 'high',
  // systemPrompt: '...' // ❌ TypeScript error - o1 doesn't support system prompts
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
    model: 'claude-opus-4-8',
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
    model: 'claude-opus-4-8',
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
sea code --provider anthropic --model claude-opus-4-8

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
        model: 'claude-opus-4-8',
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
│         AgentSea ADK Layer              │
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

## Core Concepts

| Concept                   | What it is                                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Agents**                | Autonomous entities that reason, call tools, and keep conversation context                           |
| **Crews**                 | Multi-agent teams with roles, delegation, and sequential/concurrent task execution                   |
| **Tools**                 | Functions agents call (built-in coding/general tools, MCP tools, or your own)                        |
| **Memory**                | Episodic, semantic, and working memory with multi-agent sharing and access control                   |
| **Guardrails**            | Input validation, output filtering, prompt-injection/PII safety checks                               |
| **Gateway**               | OpenAI-compatible gateway with routing, load balancing, caching, and fallbacks                       |
| **MCP**                   | Model Context Protocol for plug-in tools and resources                                               |
| **Conversation Schemas**  | Structured, validated conversation flows with dynamic routing                                        |
| **Evaluation / Red Team** | LLM-as-Judge, human feedback, monitoring + adversarial attack generation and jailbreak detection     |
| **Prompts / Debugger**    | Git-like prompt versioning & A/B testing; step-through execution with checkpoints and what-if replay |
| **Analytics**             | Intent classification, sentiment, topic clustering, anomaly detection, and KPI tracking              |

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

- [Upgrading](./docs/UPGRADING.md) - Version policy, package updates, and breaking changes
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
- The open source community

---

<div align="center">

**[Website](https://agentsea.dev)** • **[Documentation](https://agentsea.dev/docs)** • **[Examples](https://agentsea.dev/examples)** • **[API Reference](https://agentsea.dev/api)**

Made with TypeScript and AI 🤖

</div>
