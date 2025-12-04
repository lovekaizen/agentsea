# Provider Reference

Complete reference for all supported LLM providers in AgentSea ADK.

## Table of Contents

- [Provider Reference](#provider-reference)
  - [Table of Contents](#table-of-contents)
  - [Cloud Providers](#cloud-providers)
    - [Anthropic (Claude)](#anthropic-claude)
    - [OpenAI (GPT)](#openai-gpt)
    - [Google (Gemini)](#google-gemini)
  - [Local Providers](#local-providers)
    - [Ollama](#ollama)
    - [LM Studio](#lm-studio)
    - [LocalAI](#localai)
    - [Text Generation WebUI](#text-generation-webui)
    - [vLLM](#vllm)
    - [Custom OpenAI-Compatible](#custom-openai-compatible)
  - [Provider Comparison](#provider-comparison)
  - [Configuration Options](#configuration-options)
    - [Common Options](#common-options)
    - [Provider-Specific Configuration](#provider-specific-configuration)
      - [Anthropic](#anthropic)
      - [OpenAI](#openai)
      - [Gemini](#gemini)
      - [Local Providers](#local-providers-1)
  - [Best Practices](#best-practices)
    - [1. Use Environment Variables](#1-use-environment-variables)
    - [2. Handle Errors](#2-handle-errors)
    - [3. Configure Timeouts](#3-configure-timeouts)
    - [4. Use Appropriate Models](#4-use-appropriate-models)
    - [5. Implement Fallbacks](#5-implement-fallbacks)
  - [See Also](#see-also)

## Cloud Providers

### Anthropic (Claude)

```typescript
import { Agent, AnthropicProvider } from '@lov3kaizen/agentsea-core';

const provider = new AnthropicProvider(process.env.ANTHROPIC_API_KEY);

const agent = new Agent({
  name: 'claude-agent',
  model: 'claude-sonnet-4-20250514',
  provider: 'anthropic',
});

agent.registerProvider('anthropic', provider);
```

**Available Models:**

- `claude-sonnet-4-20250514` - Most capable
- `claude-3-5-sonnet-20241022` - Fast and capable
- `claude-3-opus-20240229` - Previous flagship
- `claude-3-haiku-20240307` - Fast and cost-effective

**Features:**

- ✅ Tool calling
- ✅ Streaming
- ✅ System prompts
- ✅ Vision (with appropriate models)

**Environment Variables:**

```bash
ANTHROPIC_API_KEY=your_api_key_here
```

### OpenAI (GPT)

```typescript
import { Agent, OpenAIProvider } from '@lov3kaizen/agentsea-core';

const provider = new OpenAIProvider(process.env.OPENAI_API_KEY);

const agent = new Agent({
  name: 'gpt-agent',
  model: 'gpt-4-turbo-preview',
  provider: 'openai',
});

agent.registerProvider('openai', provider);
```

**Available Models:**

- `gpt-4-turbo-preview` - Most capable
- `gpt-4` - Stable GPT-4
- `gpt-3.5-turbo` - Fast and cost-effective

**Features:**

- ✅ Tool calling
- ✅ Streaming
- ✅ System prompts
- ✅ Vision (GPT-4 Vision)

**Environment Variables:**

```bash
OPENAI_API_KEY=your_api_key_here
```

### Google (Gemini)

```typescript
import { Agent, GeminiProvider } from '@lov3kaizen/agentsea-core';

const provider = new GeminiProvider(process.env.GEMINI_API_KEY);

const agent = new Agent({
  name: 'gemini-agent',
  model: 'gemini-pro',
  provider: 'gemini',
});

agent.registerProvider('gemini', provider);
```

**Available Models:**

- `gemini-pro` - Most capable
- `gemini-pro-vision` - With vision capabilities

**Features:**

- ✅ Tool calling
- ✅ Streaming
- ✅ System prompts
- ✅ Vision (gemini-pro-vision)

**Environment Variables:**

```bash
GEMINI_API_KEY=your_api_key_here
```

## Local Providers

### Ollama

Run open source models locally with Ollama.

```typescript
import { Agent, OllamaProvider } from '@lov3kaizen/agentsea-core';

const provider = new OllamaProvider({
  baseUrl: 'http://localhost:11434', // default
  timeout: 60000, // optional
});

// List available models
const models = await provider.listModels();

// Pull a model
await provider.pullModel('llama2');

const agent = new Agent({
  name: 'ollama-agent',
  model: 'llama2',
  provider: 'ollama',
});

agent.registerProvider('ollama', provider);
```

**Popular Models:**

- `llama2`, `llama3` - Meta's models
- `mistral`, `mixtral` - Mistral AI
- `codellama`, `deepseek-coder` - Code-focused
- `phi`, `gemma`, `tinyllama` - Small and fast

**Features:**

- ✅ Tool calling (newer models)
- ✅ Streaming
- ✅ System prompts
- ⚡ Runs fully offline
- 🔒 Complete privacy

**Installation:**

```bash
# macOS/Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Start server
ollama serve

# Pull a model
ollama pull llama2
```

**Environment Variables:**

```bash
OLLAMA_BASE_URL=http://localhost:11434
```

### LM Studio

User-friendly GUI for running local models.

```typescript
import { Agent, LMStudioProvider } from '@lov3kaizen/agentsea-core';

const provider = new LMStudioProvider({
  baseUrl: 'http://localhost:1234/v1', // default
  timeout: 30000, // optional
});

const agent = new Agent({
  name: 'lmstudio-agent',
  model: 'local-model',
  provider: 'openai-compatible',
});

agent.registerProvider('openai-compatible', provider);
```

**Features:**

- ✅ Tool calling
- ✅ Streaming
- ✅ System prompts
- 🎨 User-friendly GUI
- 📦 Built-in model browser

**Installation:**

1. Download from <https://lmstudio.ai>
2. Load a model from the browser
3. Start the local server

**Environment Variables:**

```bash
LMSTUDIO_BASE_URL=http://localhost:1234
```

### LocalAI

OpenAI-compatible local API server.

```typescript
import { Agent, LocalAIProvider } from '@lov3kaizen/agentsea-core';

const provider = new LocalAIProvider({
  baseUrl: 'http://localhost:8080/v1',
});

// List available models
const models = await provider.listModels();

const agent = new Agent({
  name: 'localai-agent',
  model: models[0],
  provider: 'openai-compatible',
});

agent.registerProvider('openai-compatible', provider);
```

**Features:**

- ✅ Tool calling
- ✅ Streaming
- ✅ System prompts
- 🔌 OpenAI API drop-in replacement
- 🐳 Docker support

**Installation:**

```bash
docker run -p 8080:8080 \
  -v $PWD/models:/models \
  -ti --rm \
  quay.io/go-skynet/local-ai:latest
```

**Environment Variables:**

```bash
LOCALAI_BASE_URL=http://localhost:8080
```

### Text Generation WebUI

Feature-rich web interface for LLMs.

```typescript
import { Agent, TextGenerationWebUIProvider } from '@lov3kaizen/agentsea-core';

const provider = new TextGenerationWebUIProvider({
  baseUrl: 'http://localhost:5000/v1',
});

const agent = new Agent({
  name: 'textgen-agent',
  model: 'current-model',
  provider: 'openai-compatible',
});

agent.registerProvider('openai-compatible', provider);
```

**Features:**

- ✅ Tool calling
- ✅ Streaming
- ✅ System prompts
- 🎨 Gradio web interface
- 📊 Model comparison

**Installation:**
Follow instructions at: <https://github.com/oobabooga/text-generation-webui>

Enable the OpenAI extension in settings.

**Environment Variables:**

```bash
TEXTGEN_BASE_URL=http://localhost:5000
```

### vLLM

High-performance inference engine.

```typescript
import { Agent, VLLMProvider } from '@lov3kaizen/agentsea-core';

const provider = new VLLMProvider({
  baseUrl: 'http://localhost:8000/v1',
});

const agent = new Agent({
  name: 'vllm-agent',
  model: 'mistralai/Mistral-7B-v0.1',
  provider: 'openai-compatible',
});

agent.registerProvider('openai-compatible', provider);
```

**Features:**

- ✅ Tool calling
- ✅ Streaming
- ✅ System prompts
- ⚡ High throughput
- 💾 Memory efficient

**Installation:**

```bash
pip install vllm

# Start server
python -m vllm.entrypoints.openai.api_server \
  --model mistralai/Mistral-7B-v0.1
```

**Environment Variables:**

```bash
VLLM_BASE_URL=http://localhost:8000
```

### Custom OpenAI-Compatible

Connect to any OpenAI-compatible endpoint.

```typescript
import { Agent, OpenAICompatibleProvider } from '@lov3kaizen/agentsea-core';

const provider = new OpenAICompatibleProvider({
  baseUrl: 'https://api.your-service.com/v1',
  apiKey: 'your-api-key',
  defaultHeaders: {
    'X-Custom-Header': 'value',
  },
  timeout: 60000,
  organization: 'your-org', // optional
});

const agent = new Agent({
  name: 'custom-agent',
  model: 'your-model',
  provider: 'openai-compatible',
});

agent.registerProvider('openai-compatible', provider);
```

**Features:**

- ✅ Tool calling (if supported)
- ✅ Streaming (if supported)
- ✅ System prompts (if supported)
- 🔌 Works with any OpenAI-compatible API
- 🔧 Highly configurable

## Provider Comparison

| Provider       | Type  | Privacy  | Cost | Speed  | Tool Support       |
| -------------- | ----- | -------- | ---- | ------ | ------------------ |
| Anthropic      | Cloud | API only | $$   | Fast   | ✅ Excellent       |
| OpenAI         | Cloud | API only | $$$  | Fast   | ✅ Excellent       |
| Gemini         | Cloud | API only | $    | Fast   | ✅ Good            |
| Ollama         | Local | 100%     | Free | Medium | ⚠️ Model dependent |
| LM Studio      | Local | 100%     | Free | Medium | ⚠️ Model dependent |
| LocalAI        | Local | 100%     | Free | Medium | ⚠️ Model dependent |
| Text Gen WebUI | Local | 100%     | Free | Medium | ⚠️ Model dependent |
| vLLM           | Local | 100%     | Free | Fast   | ⚠️ Model dependent |

## Configuration Options

### Common Options

All providers support these common options:

```typescript
const agent = new Agent({
  name: 'my-agent',
  model: 'model-name',
  provider: 'provider-type',
  systemPrompt: 'You are a helpful assistant.',
  temperature: 0.7,
  maxTokens: 1000,
  topP: 0.9,
  stopSequences: ['\n\n'],
});
```

### Provider-Specific Configuration

#### Anthropic

```typescript
const provider = new AnthropicProvider(apiKey);
// No additional configuration needed
```

#### OpenAI

```typescript
const provider = new OpenAIProvider(apiKey);
// No additional configuration needed
```

#### Gemini

```typescript
const provider = new GeminiProvider(apiKey);
// No additional configuration needed
```

#### Local Providers

```typescript
const provider = new OllamaProvider({
  baseUrl: 'http://localhost:11434',
  timeout: 60000,
});

const provider = new OpenAICompatibleProvider({
  baseUrl: 'http://your-endpoint/v1',
  apiKey: 'optional-key',
  timeout: 30000,
  defaultHeaders: {
    'X-Custom': 'value',
  },
});
```

## Best Practices

### 1. Use Environment Variables

```typescript
// Good
const provider = new AnthropicProvider(process.env.ANTHROPIC_API_KEY);

// Bad - hardcoded key
const provider = new AnthropicProvider('sk-ant-...');
```

### 2. Handle Errors

```typescript
try {
  const response = await agent.execute(message, context);
} catch (error) {
  if (error.message.includes('rate limit')) {
    // Handle rate limiting
  } else if (error.message.includes('timeout')) {
    // Handle timeout
  } else {
    // Handle other errors
  }
}
```

### 3. Configure Timeouts

```typescript
// For local models that might be slow
const provider = new OllamaProvider({
  timeout: 120000, // 2 minutes
});
```

### 4. Use Appropriate Models

```typescript
// Fast, cheap queries - use smaller models
const quickAgent = new Agent({
  model: 'claude-3-haiku-20240307',
  provider: 'anthropic',
});

// Complex, important queries - use larger models
const smartAgent = new Agent({
  model: 'claude-sonnet-4-20250514',
  provider: 'anthropic',
});
```

### 5. Implement Fallbacks

```typescript
async function executeWithFallback(message: string, context: any) {
  try {
    return await primaryAgent.execute(message, context);
  } catch (error) {
    console.log('Primary provider failed, using fallback');
    return await fallbackAgent.execute(message, context);
  }
}
```

## See Also

- [Local Models Guide](./LOCAL_MODELS.md)
- [Quick Start: Local Models](./QUICK_START_LOCAL.md)
- [Examples](../examples/)
