# Quick Start: Local Models

Get started with local AI models in under 5 minutes.

## Prerequisites

- Node.js 18+
- One of the following local LLM tools:
  - Ollama (recommended for beginners)
  - LM Studio
  - LocalAI
  - Text Generation WebUI

## Option 1: Using Ollama (Recommended)

### Step 1: Install Ollama

```bash
# macOS/Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Or download from https://ollama.ai
```

### Step 2: Start Ollama and Pull a Model

```bash
# Start Ollama server
ollama serve

# In another terminal, pull a model
ollama pull llama2
```

### Step 3: Install AgentSea ADK

```bash
pnpm add @lov3kaizen/agentsea-core zod
```

### Step 4: Create Your First Local Agent

Create a file `local-agent.ts`:

```typescript
import { Agent, OllamaProvider } from '@lov3kaizen/agentsea-core';

async function main() {
  // Create Ollama provider
  const provider = new OllamaProvider();

  // Create agent
  const agent = new Agent({
    name: 'local-assistant',
    description: 'My first local AI agent',
    model: 'llama2',
    provider: 'ollama',
    systemPrompt: 'You are a helpful AI assistant.',
  });

  // Register provider
  agent.registerProvider('ollama', provider);

  // Use the agent
  const response = await agent.execute(
    'What are three benefits of running AI models locally?',
    {
      conversationId: 'conv-1',
      sessionData: {},
      history: [],
    },
  );

  console.log(response.content);
}

main();
```

### Step 5: Run It

```bash
npx tsx local-agent.ts
```

That's it! You now have a local AI agent running.

## Option 2: Using LM Studio

### Step 1: Install and Setup LM Studio

1. Download LM Studio from <https://lmstudio.ai>
2. Open LM Studio and download a model from the built-in browser
3. Click "Start Server" in the local server tab
4. Note the server URL (default: <http://localhost:1234>)

### Step 2: Install AgentSea ADK

```bash
pnpm add @lov3kaizen/agentsea-core zod
```

### Step 3: Create Your Agent

Create a file `lmstudio-agent.ts`:

```typescript
import { Agent, LMStudioProvider } from '@lov3kaizen/agentsea-core';

async function main() {
  // Create LM Studio provider
  const provider = new LMStudioProvider();

  // Create agent
  const agent = new Agent({
    name: 'lmstudio-assistant',
    description: 'LM Studio powered agent',
    model: 'local-model', // LM Studio uses the loaded model
    provider: 'openai-compatible',
  });

  // Register provider
  agent.registerProvider('openai-compatible', provider);

  // Use the agent
  const response = await agent.execute('Write a haiku about TypeScript', {
    conversationId: 'conv-1',
    sessionData: {},
    history: [],
  });

  console.log(response.content);
}

main();
```

### Step 4: Run It

```bash
npx tsx lmstudio-agent.ts
```

## Next Steps

### Add Tools to Your Agent

```typescript
import { Agent, OllamaProvider, ToolRegistry } from '@lov3kaizen/agentsea-core';
import { z } from 'zod';

const toolRegistry = new ToolRegistry();

// Add a custom tool
toolRegistry.register({
  name: 'get_weather',
  description: 'Get weather for a location',
  parameters: z.object({
    location: z.string(),
  }),
  execute: async (params) => {
    // Your weather API call here
    return `Weather in ${params.location}: Sunny, 72°F`;
  },
});

const agent = new Agent({
  name: 'weather-agent',
  model: 'llama2',
  provider: 'ollama',
  tools: toolRegistry.getAll(),
});
```

### Enable Streaming

```typescript
const provider = new OllamaProvider();
const agent = new Agent({
  name: 'streaming-agent',
  model: 'llama2',
  provider: 'ollama',
});

agent.registerProvider('ollama', provider);

// Stream the response
for await (const chunk of agent.streamExecute('Tell me a story', context)) {
  process.stdout.write(chunk.content || '');
}
```

### Add Memory

```typescript
import { BufferMemory } from '@lov3kaizen/agentsea-core';

const memory = new BufferMemory(50); // Keep last 50 messages

const agent = new Agent({
  name: 'memory-agent',
  model: 'llama2',
  provider: 'ollama',
  memory: {
    type: 'buffer',
    maxMessages: 50,
  },
});
```

### Use Different Models

```typescript
const provider = new OllamaProvider();

// List available models
const models = await provider.listModels();
console.log('Available models:', models);

// Pull a new model
await provider.pullModel('mistral');

// Use the new model
const agent = new Agent({
  name: 'mistral-agent',
  model: 'mistral',
  provider: 'ollama',
});
```

## Popular Models to Try

### General Purpose

```bash
ollama pull llama2       # 7B - Good all-around
ollama pull llama3       # 8B - Better than llama2
ollama pull mistral      # 7B - Excellent quality
ollama pull mixtral      # 8x7B - High quality
```

### Coding

```bash
ollama pull codellama       # 7B - Code specialist
ollama pull deepseek-coder  # 6.7B - Excellent for code
```

### Fast & Lightweight

```bash
ollama pull phi          # 2.7B - Fast and capable
ollama pull gemma        # 2B/7B - Google's models
ollama pull tinyllama    # 1.1B - Very fast
```

## Troubleshooting

### "Connection refused" error

- Make sure Ollama/LM Studio is running
- Check the correct port (Ollama: 11434, LM Studio: 1234)
- Try increasing the timeout:

```typescript
const provider = new OllamaProvider({
  timeout: 120000, // 2 minutes
});
```

### Slow responses

- Use a smaller model (phi, gemma)
- Reduce max_tokens
- Ensure GPU acceleration is enabled
- Close other applications

### Model not found

```typescript
const provider = new OllamaProvider();
await provider.pullModel('llama2');
```

### Out of memory

- Use smaller models
- Reduce context length
- Use quantized models (automatic in Ollama)

## Examples

See more examples in:

- [examples/local-models-example.ts](../examples/local-models-example.ts)
- [Full local models documentation](./LOCAL_MODELS.md)

## Resources

- [Ollama Documentation](https://github.com/ollama/ollama)
- [LM Studio Documentation](https://lmstudio.ai/docs)
- [AgentSea ADK Documentation](https://agentsea.dev)
- [Available Models](https://ollama.ai/library)

## Need Help?

- 💬 [GitHub Discussions](https://github.com/lovekaizen/aigency/discussions)
- 🐛 [Report an Issue](https://github.com/lovekaizen/aigency/issues)
- 📖 [Full Documentation](https://aigency.dev)
