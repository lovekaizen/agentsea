# AgentSea ADK - Quick Start Guide

Get up and running with AgentSea ADK in 5 minutes.

## Installation

```bash
# Install the core package
pnpm add @lov3kaizen/agentsea-core

# Optional: Install CLI globally
pnpm add -g @lov3kaizen/agentsea-cli

# Optional: Install NestJS integration
pnpm add @lov3kaizen/agentsea-nestjs
```

## Basic Usage

### 1. Simple Agent with Claude

```typescript
import {
  Agent,
  AnthropicProvider,
  ToolRegistry,
} from '@lov3kaizen/agentsea-core';

const agent = new Agent(
  {
    name: 'assistant',
    model: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    systemPrompt: 'You are a helpful assistant.',
  },
  new AnthropicProvider(process.env.ANTHROPIC_API_KEY),
  new ToolRegistry(),
);

const response = await agent.execute('Hello!', {
  conversationId: 'user-123',
  sessionData: {},
  history: [],
});

console.log(response.content);
```

### 2. Local Agent with Ollama

```typescript
import { Agent, OllamaProvider, ToolRegistry } from '@lov3kaizen/agentsea-core';

// Start Ollama first: ollama serve
const provider = new OllamaProvider();

// Pull model if needed
await provider.pullModel('llama2');

const agent = new Agent(
  {
    name: 'local-assistant',
    model: 'llama2',
    provider: 'ollama',
    systemPrompt: 'You are a helpful assistant.',
  },
  provider,
  new ToolRegistry(),
);

const response = await agent.execute('What is 2+2?', {
  conversationId: 'conv-1',
  sessionData: {},
  history: [],
});

console.log(response.content);
```

### 3. Voice-Enabled Agent

```typescript
import {
  Agent,
  AnthropicProvider,
  ToolRegistry,
  VoiceAgent,
  OpenAIWhisperProvider,
  OpenAITTSProvider,
} from '@lov3kaizen/agentsea-core';
import { readFileSync, writeFileSync } from 'fs';

// Create base agent
const agent = new Agent(
  {
    name: 'voice-assistant',
    model: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    systemPrompt: 'You are a helpful voice assistant.',
  },
  new AnthropicProvider(process.env.ANTHROPIC_API_KEY),
  new ToolRegistry(),
);

// Add voice capabilities
const voiceAgent = new VoiceAgent(agent, {
  sttProvider: new OpenAIWhisperProvider(process.env.OPENAI_API_KEY),
  ttsProvider: new OpenAITTSProvider(process.env.OPENAI_API_KEY),
  ttsConfig: { voice: 'nova' },
});

// Process voice input
const result = await voiceAgent.processVoice(readFileSync('./audio.mp3'), {
  conversationId: 'voice-1',
  sessionData: {},
  history: [],
});

console.log('User said:', result.text);
console.log('Response:', result.response.content);

// Save audio response
writeFileSync('./response.mp3', result.audio!);
```

### 4. Using CLI

```bash
# Initialize configuration
agentsea init

# Start interactive chat
agentsea chat

# Create an agent
agentsea agent create my-agent \
  --provider anthropic \
  --model claude-sonnet-4-20250514

# Run agent with a message
agentsea agent run my-agent "What is the capital of France?"

# Pull a local model
agentsea model pull llama2

# List available models
agentsea model list
```

### 5. REST API & Streaming with NestJS

```typescript
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AgenticModule, AgentService } from '@lov3kaizen/agentsea-nestjs';
import {
  Agent,
  AnthropicProvider,
  ToolRegistry,
  BufferMemory,
} from '@lov3kaizen/agentsea-core';

// Create your NestJS module
@Module({
  imports: [
    AgenticModule.forRoot({
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY,
      enableRestApi: true, // Enable REST endpoints
      enableWebSocket: true, // Enable WebSocket
    }),
  ],
})
class AppModule {}

// Bootstrap the application
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  // Register your agents
  const agentService = app.get(AgentService);
  const agent = new Agent(
    {
      name: 'customer-support',
      description: 'AI customer support agent',
      model: 'claude-3-5-sonnet-20241022',
      provider: 'anthropic',
    },
    new AnthropicProvider(),
    new ToolRegistry(),
    new BufferMemory(),
  );
  agentService.registerAgent(agent);

  await app.listen(3000);
  console.log('🚀 API running on http://localhost:3000');
}

bootstrap();
```

**Available Endpoints:**

- `GET /agents` - List all agents
- `GET /agents/:name` - Get agent details
- `POST /agents/:name/execute` - Execute agent
- `POST /agents/:name/stream` - Stream response (SSE)

**Client Usage:**

```typescript
// REST API call
const response = await fetch(
  'http://localhost:3000/agents/customer-support/execute',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: 'I need help with my order',
      conversationId: 'conv-123',
    }),
  },
);

const data = await response.json();
console.log(data.data.content);

// SSE Streaming
const streamResponse = await fetch(
  'http://localhost:3000/agents/customer-support/stream',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({ input: 'Hello!' }),
  },
);

const reader = streamResponse.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  // Parse and handle SSE events
  console.log(chunk);
}

// WebSocket
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/agents');
socket.emit('execute', {
  agentName: 'customer-support',
  input: 'Hello!',
});
socket.on('stream', (event) => {
  if (event.type === 'content') {
    console.log(event.content);
  }
});
```

[See complete API documentation →](./docs/API.md)

## Environment Variables

Create a `.env` file:

```bash
# Required for Claude
ANTHROPIC_API_KEY=your_key_here

# Optional for OpenAI (GPT, Whisper, TTS)
OPENAI_API_KEY=your_key_here

# Optional for Gemini
GOOGLE_AI_API_KEY=your_key_here

# Optional for ElevenLabs TTS
ELEVENLABS_API_KEY=your_key_here

# Optional for local models
OLLAMA_BASE_URL=http://localhost:11434
```

## Next Steps

### Learn More

1. **Documentation**
   - [Complete Features](./FEATURES.md)
   - [Local Models Guide](./docs/LOCAL_MODELS.md)
   - [Voice Features Guide](./docs/VOICE.md)
   - [CLI Documentation](./docs/CLI.md)
   - [Architecture](./ARCHITECTURE.md)

2. **Examples**
   - [Basic Usage](./examples/basic-usage.ts)
   - [Local Models](./examples/local-models-example.ts)
   - [Voice Features](./examples/voice-example.ts)
   - [Complete Integration](./examples/complete-integration-example.ts)
   - [Tools](./examples/tools-example.ts)
   - [Workflows](./examples/workflow-example.ts)

3. **Advanced Topics**
   - Multi-agent workflows
   - Memory management
   - Custom tools
   - MCP integration
   - NestJS integration

### Common Tasks

#### Add Tools to Agent

```typescript
import { calculatorTool, weatherTool } from '@lov3kaizen/agentsea-core';

const agent = new Agent(
  {
    name: 'assistant',
    model: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    tools: [calculatorTool, weatherTool],
  },
  provider,
  toolRegistry,
);
```

#### Add Memory

```typescript
import { BufferMemory } from '@lov3kaizen/agentsea-core';

const agent = new Agent(
  {
    /* config */
  },
  provider,
  toolRegistry,
  new BufferMemory(50), // Keep last 50 messages
);
```

#### Create Custom Tool

```typescript
import { z } from 'zod';

const myTool = {
  name: 'search',
  description: 'Search for information',
  parameters: z.object({
    query: z.string().describe('The search query'),
  }),
  execute: async (params, context) => {
    // Your implementation
    return `Results for: ${params.query}`;
  },
};

toolRegistry.register(myTool);
```

#### Multi-Agent Workflow

```typescript
import { SequentialWorkflow } from '@lov3kaizen/agentsea-core';

const workflow = new SequentialWorkflow({
  name: 'research-and-summarize',
  agents: [researchAgent, summaryAgent],
});

const result = await workflow.execute('Research AI trends', context);
```

## Local Development

Run locally with complete privacy:

```typescript
import {
  Agent,
  OllamaProvider,
  VoiceAgent,
  LocalWhisperProvider,
  PiperTTSProvider,
} from '@lov3kaizen/agentsea-core';

// All processing happens locally - no cloud APIs
const agent = new Agent(
  {
    name: 'private-assistant',
    model: 'llama2',
    provider: 'ollama',
  },
  new OllamaProvider(),
  new ToolRegistry(),
);

const voiceAgent = new VoiceAgent(agent, {
  sttProvider: new LocalWhisperProvider({
    whisperPath: '/usr/local/bin/whisper',
  }),
  ttsProvider: new PiperTTSProvider({
    piperPath: '/usr/local/bin/piper',
  }),
});
```

## Troubleshooting

### "API key not found"

Set your API key in `.env` file or environment variables.

### "Ollama connection failed"

Make sure Ollama is running: `ollama serve`

### "Model not found"

Pull the model first: `ollama pull llama2` or `agentsea model pull llama2`

### "Audio format not supported"

Convert audio to supported format using ffmpeg:

```bash
ffmpeg -i input.m4a -ar 16000 output.wav
```

## Support

- **Documentation**: See [docs/](./docs/) directory
- **Examples**: See [examples/](./examples/) directory
- **Feature List**: See [FEATURES.md](./FEATURES.md)
- **Project Status**: See [PROJECT_STATUS.md](./PROJECT_STATUS.md)

## What's Included?

✅ **12 LLM Providers**

- 3 Cloud providers (Claude, GPT, Gemini)
- 6 Local providers (Ollama, LM Studio, etc.)
- 3 OpenAI-compatible providers

✅ **5 Voice Providers**

- 2 STT providers (OpenAI Whisper, Local Whisper)
- 3 TTS providers (OpenAI TTS, ElevenLabs, Piper TTS)

✅ **Complete CLI Tool**

- Interactive setup and chat
- Agent and provider management
- Model management (Ollama)

✅ **Full-Featured ADK**

- Multi-agent workflows
- Memory management
- Tool system
- MCP protocol
- Observability
- NestJS integration

---

**Ready to build?** Start with the examples in [examples/](./examples/) or try the CLI with `agentsea init`!
