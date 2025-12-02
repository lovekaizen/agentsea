# @lov3kaizen/agentsea-cli

**Command-line interface for AgentSea ADK** - Build and orchestrate AI agents from your terminal.

[![npm version](https://img.shields.io/npm/v/@lov3kaizen/agentsea-cli.svg)](https://www.npmjs.com/package/@lov3kaizen/agentsea-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🚀 **Quick Setup** - Initialize with interactive prompts
- 💬 **Interactive Chat** - Chat with agents in your terminal
- 🤖 **Agent Management** - Create, list, and manage agents
- 🔌 **Provider Support** - Cloud and local providers
- 📦 **Model Management** - Pull and manage Ollama models
- ⚙️ **Configuration** - Persistent configuration management
- 🎨 **Beautiful Output** - Colored, formatted terminal output

## Installation

```bash
# Global installation
npm install -g @lov3kaizen/agentsea-cli

# Or use with npx
npx @lov3kaizen/agentsea-cli init
```

## Quick Start

### 1. Initialize

```bash
agentsea init
```

This will guide you through:

- Choosing a provider (cloud or local)
- Configuring API keys or endpoints
- Creating a default agent

### 2. Start Chatting

```bash
agentsea chat
```

Interactive chat session with your default agent.

### 3. Run One-Off Commands

```bash
agentsea agent run default "What is the capital of France?"
```

## Commands

### `agentsea init`

Initialize AgentSea CLI configuration with interactive prompts.

```bash
agentsea init
```

### `agentsea chat`

Start an interactive chat session.

```bash
agentsea chat                        # Use default agent
agentsea chat --agent my-agent       # Use specific agent
agentsea chat --model llama3         # Override model
```

### `agentsea agent`

Manage agents.

```bash
# Create a new agent
agentsea agent create

# List all agents
agentsea agent list

# Get agent details
agentsea agent get <name>

# Run an agent with a message
agentsea agent run <name> "Your message"

# Set default agent
agentsea agent default <name>

# Delete an agent
agentsea agent delete <name>
```

### `agentsea provider`

Manage providers.

```bash
# List all providers
agentsea provider list

# Get provider details
agentsea provider get <name>

# Add a new provider
agentsea provider add

# Set default provider
agentsea provider default <name>

# Delete a provider
agentsea provider delete <name>
```

### `agentsea model`

Manage models (Ollama only).

```bash
# List available models
agentsea model list

# Pull a model from Ollama
agentsea model pull llama2

# Show popular models
agentsea model popular
```

### `agentsea config`

Show current configuration.

```bash
agentsea config
```

## Examples

### Cloud Provider (Anthropic)

```bash
# Initialize with Anthropic
agentsea init
> Cloud Provider
> Anthropic
> [Enter API Key]

# Chat with Claude
agentsea chat
```

### Local Provider (Ollama)

```bash
# Initialize with Ollama
agentsea init
> Local Provider
> Ollama
> http://localhost:11434

# Pull a model
agentsea model pull llama2

# Chat with local model
agentsea chat
```

### Multiple Agents

```bash
# Create a coding assistant
agentsea agent create
> Name: coder
> Model: codellama
> System Prompt: You are a coding assistant...

# Create a writer assistant
agentsea agent create
> Name: writer
> Model: llama2
> System Prompt: You are a creative writer...

# Use specific agent
agentsea chat --agent coder
```

## Configuration

Configuration is stored in:

- **Linux**: `~/.config/agentsea-cli/config.json`
- **macOS**: `~/Library/Preferences/agentsea-cli/config.json`
- **Windows**: `%APPDATA%\agentsea-cli\config.json`

### Configuration Structure

```json
{
  "defaultProvider": "anthropic",
  "defaultAgent": "default",
  "providers": {
    "anthropic": {
      "name": "anthropic",
      "type": "anthropic",
      "apiKey": "sk-ant-...",
      "timeout": 60000
    },
    "ollama": {
      "name": "ollama",
      "type": "ollama",
      "baseUrl": "http://localhost:11434",
      "timeout": 60000
    }
  },
  "agents": {
    "default": {
      "name": "default",
      "description": "Default agent",
      "model": "claude-sonnet-4-20250514",
      "provider": "anthropic",
      "systemPrompt": "You are a helpful assistant.",
      "temperature": 0.7,
      "maxTokens": 2048
    }
  }
}
```

### Environment Variables

API keys can also be set via environment variables:

```bash
export ANTHROPIC_API_KEY=your_key_here
export OPENAI_API_KEY=your_key_here
export GEMINI_API_KEY=your_key_here
```

## Supported Providers

### Cloud Providers

- **Anthropic** - Claude models
- **OpenAI** - GPT models
- **Google** - Gemini models

### Local Providers

- **Ollama** - Local LLM runtime
- **LM Studio** - GUI for local models
- **LocalAI** - OpenAI-compatible local API

## Ollama Integration

The CLI has first-class support for Ollama:

```bash
# Make sure Ollama is running
ollama serve

# Pull popular models
agentsea model pull llama2
agentsea model pull mistral
agentsea model pull codellama

# List available models
agentsea model list

# Show popular models
agentsea model popular

# Chat with local model
agentsea chat
```

## Tips & Tricks

### 1. Quick Chat

Create an alias for quick access:

```bash
alias bc="agentsea chat"
```

### 2. Multiple Providers

Set up multiple providers for different use cases:

```bash
agentsea provider add
> Name: anthropic-prod
> Type: Anthropic

agentsea provider add
> Name: ollama-dev
> Type: Ollama
```

### 3. Specialized Agents

Create agents for specific tasks:

```bash
# Coding agent
agentsea agent create
> Name: code
> Model: codellama
> System Prompt: You are an expert programmer...

# Writing agent
agentsea agent create
> Name: write
> Model: llama2
> System Prompt: You are a creative writer...

# Use them
agentsea chat --agent code
agentsea chat --agent write
```

### 4. Verbose Mode

Get detailed output:

```bash
agentsea agent run default "Hello" --verbose
```

## Troubleshooting

### "No providers configured"

Run `agentsea init` to set up your first provider.

### "Provider not found"

List providers: `agentsea provider list`

Add provider: `agentsea provider add`

### "Agent not found"

List agents: `agentsea agent list`

Create agent: `agentsea agent create`

### Ollama Connection Error

Make sure Ollama is running:

```bash
ollama serve
```

Check the base URL in your provider configuration:

```bash
agentsea provider get ollama
```

### Model Not Found (Ollama)

Pull the model first:

```bash
agentsea model pull llama2
```

## Development

```bash
# Install dependencies
pnpm install

# Build the CLI
pnpm build

# Link for local testing
pnpm link --global

# Test commands
agentsea--help
```

## License

MIT License - see [LICENSE](../../LICENSE) for details

## See Also

- [@lov3kaizen/agentsea-core](../core) - Core AgentSea ADK
- [@lov3kaizen/agentsea-nestjs](../nestjs) - NestJS integration
- [AgentSea Documentation](../../docs)

---

Built with ❤️ by [lovekaizen](https://lovekaizen.com)
