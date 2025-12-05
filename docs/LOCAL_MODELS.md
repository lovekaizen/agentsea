# Local Models and Open Source Providers

The AgentSea ADK provides comprehensive support for running AI agents with local models and open source LLM providers. This allows you to:

- Run models on your own hardware
- Maintain complete privacy and data control
- Eliminate API costs
- Work offline
- Use custom-trained or fine-tuned models

## Supported Providers

### 1. Ollama

[Ollama](https://ollama.ai) is a popular tool for running open source LLMs locally.

#### Installation

```bash
# macOS/Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Start Ollama
ollama serve
```

#### Usage

```typescript
import { Agent, OllamaProvider } from '@lov3kaizen/agentsea-core';

// Create provider
const provider = new OllamaProvider({
  baseUrl: 'http://localhost:11434', // default
  timeout: 60000, // optional
});

// List available models
const models = await provider.listModels();
console.log('Available models:', models);

// Pull a model
await provider.pullModel('llama2');

// Create agent
const agent = new Agent({
  name: 'local-assistant',
  description: 'Local AI assistant',
  model: 'llama2', // or llama3, mistral, codellama, etc.
  provider: 'ollama',
  temperature: 0.7,
});

agent.registerProvider('ollama', provider);

// Use the agent
const response = await agent.execute('Hello!', {
  conversationId: 'conv-1',
  sessionData: {},
  history: [],
});
```

#### Popular Models

```bash
# General purpose
ollama pull llama2
ollama pull llama3
ollama pull mistral
ollama pull mixtral

# Code-focused
ollama pull codellama
ollama pull deepseek-coder

# Small and fast
ollama pull phi
ollama pull gemma
```

### 2. LM Studio

[LM Studio](https://lmstudio.ai) provides a user-friendly interface for running local LLMs.

#### Installation

1. Download LM Studio from <https://lmstudio.ai>
2. Load a model from the built-in model browser
3. Start the local server (default: <http://localhost:1234>)

#### Usage

```typescript
import { Agent, LMStudioProvider } from '@lov3kaizen/agentsea-core';

const provider = new LMStudioProvider({
  baseUrl: 'http://localhost:1234/v1', // default
});

const toolRegistry = new ToolRegistry();

const agent = new Agent(
  {
    name: 'lmstudio-assistant',
    description: 'LM Studio powered assistant',
    model: 'local-model', // LM Studio uses the loaded model
    provider: 'openai-compatible',
  },
  provider,
  toolRegistry,
);
```

### 3. LocalAI

[LocalAI](https://localai.io) is a drop-in replacement REST API compatible with OpenAI API.

#### Installation

```bash
# Using Docker
docker run -p 8080:8080 -v $PWD/models:/models -ti --rm quay.io/go-skynet/local-ai:latest
```

#### Usage

```typescript
import { Agent, LocalAIProvider } from '@lov3kaizen/agentsea-core';

const provider = new LocalAIProvider({
  baseUrl: 'http://localhost:8080/v1',
});

// List models
const models = await provider.listModels();

const toolRegistry = new ToolRegistry();

const agent = new Agent(
  {
    name: 'localai-assistant',
    description: 'LocalAI powered assistant',
    model: models[0], // Use first available model
    provider: 'openai-compatible',
  },
  provider,
  toolRegistry,
);
```

### 4. Text Generation WebUI (oobabooga)

[Text Generation WebUI](https://github.com/oobabooga/text-generation-webui) is a Gradio web UI for running Large Language Models.

#### Installation

Follow the installation instructions at <https://github.com/oobabooga/text-generation-webui>

Enable the OpenAI extension in the settings.

#### Usage

```typescript
import { Agent, TextGenerationWebUIProvider } from '@lov3kaizen/agentsea-core';

const provider = new TextGenerationWebUIProvider({
  baseUrl: 'http://localhost:5000/v1',
});

const toolRegistry = new ToolRegistry();

const agent = new Agent(
  {
    name: 'textgen-assistant',
    description: 'Text Generation WebUI powered assistant',
    model: 'current-model', // Uses the loaded model
    provider: 'openai-compatible',
  },
  provider,
  toolRegistry,
);
```

### 5. vLLM

[vLLM](https://github.com/vllm-project/vllm) is a high-throughput and memory-efficient inference engine.

#### Installation

```bash
pip install vllm

# Start server
python -m vllm.entrypoints.openai.api_server --model mistralai/Mistral-7B-v0.1
```

#### Usage

```typescript
import { Agent, VLLMProvider } from '@lov3kaizen/agentsea-core';

const provider = new VLLMProvider({
  baseUrl: 'http://localhost:8000/v1',
});

const toolRegistry = new ToolRegistry();

const agent = new Agent(
  {
    name: 'vllm-assistant',
    description: 'vLLM powered assistant',
    model: 'mistralai/Mistral-7B-v0.1',
    provider: 'openai-compatible',
  },
  provider,
  toolRegistry,
);
```

### 6. Custom OpenAI-Compatible Endpoints

Any service that implements the OpenAI API format can be used:

```typescript
import { Agent, OpenAICompatibleProvider } from '@lov3kaizen/agentsea-core';

const provider = new OpenAICompatibleProvider({
  baseUrl: 'https://your-custom-endpoint.com/v1',
  apiKey: 'your-api-key', // if required
  defaultHeaders: {
    'X-Custom-Header': 'value',
  },
  timeout: 60000,
});

const toolRegistry = new ToolRegistry();

const agent = new Agent(
  {
    name: 'custom-assistant',
    description: 'Custom endpoint powered assistant',
    model: 'your-model',
    provider: 'openai-compatible',
  },
  provider,
  toolRegistry,
);
```

## Features

### Streaming Support

All local providers support streaming responses:

```typescript
const provider = new OllamaProvider();
const toolRegistry = new ToolRegistry();

const agent = new Agent(
  {
    name: 'streaming-agent',
    model: 'llama2',
    provider: 'ollama',
  },
  provider,
  toolRegistry,
);

// Stream response
for await (const chunk of agent.streamExecute('Tell me a story', context)) {
  process.stdout.write(chunk.content || '');
}
```

### Tool/Function Calling

Local models that support function calling can use tools:

```typescript
import { ToolRegistry } from '@lov3kaizen/agentsea-core';
import { z } from 'zod';

const toolRegistry = new ToolRegistry();

toolRegistry.register({
  name: 'calculator',
  description: 'Perform calculations',
  parameters: z.object({
    operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
    a: z.number(),
    b: z.number(),
  }),
  execute: async (params) => {
    const { operation, a, b } = params;
    switch (operation) {
      case 'add':
        return a + b;
      case 'subtract':
        return a - b;
      case 'multiply':
        return a * b;
      case 'divide':
        return a / b;
    }
  },
});

const agent = new Agent(
  {
    name: 'math-assistant',
    model: 'llama2',
    provider: 'ollama',
    tools: toolRegistry.getAll(),
  },
  provider,
  toolRegistry,
);
```

### Memory and Context

Local models work with all AgentSea ADK memory types:

```typescript
import { BufferMemory, RedisMemory } from '@lov3kaizen/agentsea-core';

const memory = new BufferMemory(10);
const toolRegistry = new ToolRegistry();

const agent = new Agent(
  {
    name: 'memory-agent',
    model: 'llama2',
    provider: 'ollama',
    memory: {
      type: 'buffer',
      maxMessages: 10,
    },
  },
  provider,
  toolRegistry,
  memory,
);
```

## Model Selection Guide

### General Purpose

- **llama2** (7B, 13B, 70B) - Good all-around performance
- **llama3** (8B, 70B) - Improved over llama2
- **mistral** (7B) - Excellent quality-to-size ratio
- **mixtral** (8x7B) - High quality, mixture of experts

### Coding

- **codellama** (7B, 13B, 34B) - Specialized for code
- **deepseek-coder** (6.7B, 33B) - Excellent coding performance

### Fast & Small

- **phi** (2.7B) - Surprisingly capable for size
- **gemma** (2B, 7B) - Google's efficient models
- **tinyllama** (1.1B) - Very fast, limited capability

### Specialized

- **solar** (10.7B) - Korean language support
- **yi** (6B, 34B) - Chinese language support
- **neural-chat** (7B) - Conversational

## Performance Tips

### 1. Model Quantization

Use quantized models for faster inference:

```bash
# Ollama automatically uses quantized versions
ollama pull llama2  # Uses Q4_0 quantization by default
```

### 2. GPU Acceleration

Ensure your local server is using GPU acceleration:

```bash
# Check if Ollama is using GPU
ollama run llama2 --verbose
```

### 3. Context Length

Adjust max tokens based on your hardware:

```typescript
const agent = new Agent({
  name: 'efficient-agent',
  model: 'llama2',
  provider: 'ollama',
  maxTokens: 512, // Lower for faster responses
  temperature: 0.7,
});
```

### 4. Batch Processing

For multiple requests, reuse the agent instance:

```typescript
const agent = new Agent({
  name: 'batch-agent',
  model: 'llama2',
  provider: 'ollama',
});

const questions = ['Question 1', 'Question 2', 'Question 3'];

for (const question of questions) {
  const response = await agent.execute(question, context);
  console.log(response.content);
}
```

## Troubleshooting

### Connection Issues

```typescript
// Increase timeout for slower local hardware
const provider = new OllamaProvider({
  baseUrl: 'http://localhost:11434',
  timeout: 120000, // 2 minutes
});
```

### Model Not Found

```typescript
// Pull the model first
const provider = new OllamaProvider();
await provider.pullModel('llama2');
```

### Out of Memory

- Use smaller models (phi, gemma)
- Reduce context length
- Use quantized models
- Close other applications

### Slow Performance

- Ensure GPU acceleration is enabled
- Use quantized models
- Reduce max_tokens
- Use smaller models
- Check CPU/GPU usage

## Best Practices

1. **Start Small**: Begin with smaller models like phi or llama2:7b
2. **Test Locally**: Validate your prompts work well with local models
3. **Monitor Resources**: Watch CPU/GPU/memory usage
4. **Use Appropriate Models**: Match model size to your task complexity
5. **Cache Responses**: Implement caching for repeated queries
6. **Optimize Prompts**: Local models benefit from clear, concise prompts
7. **Fallback Strategy**: Consider cloud fallback for complex queries

## Environment Variables

```bash
# Ollama
OLLAMA_BASE_URL=http://localhost:11434

# LM Studio
LMSTUDIO_BASE_URL=http://localhost:1234

# LocalAI
LOCALAI_BASE_URL=http://localhost:8080

# Custom
CUSTOM_LLM_BASE_URL=https://your-endpoint.com
CUSTOM_LLM_API_KEY=your-key
```

## Examples

See the full examples in `examples/local-models-example.ts` for:

- Basic usage with each provider
- Tool/function calling with local models
- Streaming responses
- Comparing different providers
- Error handling and fallbacks

## Further Reading

- [Ollama Documentation](https://github.com/ollama/ollama)
- [LM Studio Documentation](https://lmstudio.ai/docs)
- [LocalAI Documentation](https://localai.io)
- [Text Generation WebUI](https://github.com/oobabooga/text-generation-webui)
- [vLLM Documentation](https://docs.vllm.ai)
