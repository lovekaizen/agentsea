# @lov3kaizen/agentsea-core

**Unite and orchestrate AI agents** - Framework-agnostic core library for building agentic AI applications in Node.js.

[![npm version](https://img.shields.io/npm/v/@lov3kaizen/agentsea-core.svg)](https://www.npmjs.com/package/@lov3kaizen/agentsea-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

## Features

- Multi-Provider Support - Anthropic Claude, OpenAI GPT, Google Gemini
- Local & Open Source Models - Ollama, LM Studio, LocalAI, Text Generation WebUI, vLLM
- Voice Support (TTS/STT) - OpenAI Whisper, ElevenLabs, Piper TTS
- MCP Protocol - First-class Model Context Protocol integration
- ACP Protocol - Agentic Commerce Protocol for e-commerce integration
- Multi-Agent Workflows - Sequential, parallel, and supervisor orchestration
- Conversation Schemas - Structured conversational experiences with validation
- Advanced Memory - Buffer, Redis, and summary-based memory stores
- Built-in Tools - 8 production-ready tools + custom tool support
- Full Observability - Logging, metrics, and distributed tracing

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

## Multi-Provider Support

```typescript
import {
  GeminiProvider,
  OpenAIProvider,
  AnthropicProvider,
  OllamaProvider,
} from '@lov3kaizen/agentsea-core';

// Use any provider
const geminiAgent = new Agent(config, new GeminiProvider(apiKey), toolRegistry);
const openaiAgent = new Agent(config, new OpenAIProvider(apiKey), toolRegistry);
const claudeAgent = new Agent(
  config,
  new AnthropicProvider(apiKey),
  toolRegistry,
);
const ollamaAgent = new Agent(config, new OllamaProvider(), toolRegistry);
```

## Documentation

Full documentation available at [agentsea.dev](https://agentsea.dev)

- [Quick Start](https://agentsea.dev/docs/quick-start)
- [Agents](https://agentsea.dev/docs/agents)
- [Tools](https://agentsea.dev/docs/tools)
- [Workflows](https://agentsea.dev/docs/workflows)
- [Memory](https://agentsea.dev/docs/memory)
- [MCP Integration](https://agentsea.dev/docs/mcp-overview)
- [API Reference](https://agentsea.dev/api)

## Related Packages

- [@lov3kaizen/agentsea-cli](https://www.npmjs.com/package/@lov3kaizen/agentsea-cli) - Command-line interface
- [@lov3kaizen/agentsea-nestjs](https://www.npmjs.com/package/@lov3kaizen/agentsea-nestjs) - NestJS integration
- [@lov3kaizen/agentsea-react](https://www.npmjs.com/package/@lov3kaizen/agentsea-react) - React components

## License

MIT License - see [LICENSE](../../LICENSE) for details
