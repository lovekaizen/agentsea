# AgentSea CLI Guide

Complete guide to using the AgentSea CLI tool (`sea` command).

## Table of Contents

- [Installation](#installation)
- [Getting Started](#getting-started)
- [Commands](#commands)
- [Configuration](#configuration)
- [Workflows](#workflows)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Installation

### Global Installation

```bash
npm install -g @lov3kaizen/agentagentsea-cli
```

### Using npx

```bash
npx @lov3kaizen/agentagentsea-cli [command]
```

### Verify Installation

```bash
sea --version
sea --help
```

## Getting Started

### Quick Start (Cloud Provider)

```bash
# 1. Initialize
sea init

# Follow prompts:
# - Choose "Cloud Provider"
# - Select "Anthropic" (or OpenAI/Gemini)
# - Enter API key
# - Create default agent

# 2. Start chatting
sea chat
```

### Quick Start (Local Provider)

```bash
# 1. Make sure Ollama is running
ollama serve

# 2. Initialize
sea init

# Follow prompts:
# - Choose "Local Provider"
# - Select "Ollama"
# - Confirm base URL
# - Create default agent

# 3. Pull a model
sea model pull llama2

# 4. Start chatting
sea chat
```

## Commands

### Global Options

All commands support these options:

```bash
--help     Show help
--version  Show version
```

### init

Initialize Aigency CLI configuration.

```bash
sea init
```

**Interactive prompts:**

- Provider type (cloud/local)
- Provider configuration (API key/endpoint)
- Agent creation
- Model selection

**Output:**

- Configuration file created
- .env file created (for cloud providers)
- Default provider/agent set

### chat

Start an interactive chat session.

```bash
sea chat [options]
```

**Options:**

- `-a, --agent <name>` - Specify agent to use
- `-p, --provider <name>` - Override provider
- `-m, --model <name>` - Override model

**Examples:**

```bash
# Use default agent
sea chat

# Use specific agent
sea chat --agent coder

# Override model
sea chat --model llama3

# Override provider
sea chat --provider ollama
```

**In Chat:**

- Type messages and press Enter
- Type `exit` or `quit` to end
- Conversation history is maintained within session

### agent

Manage agents.

#### agent create

Create a new agent interactively.

```bash
sea agent create
```

**Prompts for:**

- Name
- Description
- Provider
- Model
- System prompt
- Temperature
- Max tokens
- Set as default

#### agent list

List all configured agents.

```bash
sea agent list
```

**Output:**

- Name
- Model
- Provider
- Description
- Default marker (✓)

#### agent get

Get details of a specific agent.

```bash
sea agent get <name>
```

**Example:**

```bash
sea agent get default
```

#### agent run

Run an agent with a one-off message.

```bash
sea agent run <name> <message> [options]
```

**Options:**

- `-v, --verbose` - Show detailed metadata

**Examples:**

```bash
# Simple run
sea agent run default "Hello world"

# Verbose output
sea agent run default "Explain AI" --verbose

# Complex message
sea agent run coder "Write a function to sort an array in Python"
```

#### agent default

Set the default agent.

```bash
sea agent default <name>
```

**Example:**

```bash
sea agent default coder
```

#### agent delete

Delete an agent.

```bash
sea agent delete <name>
```

## Confirms before deletion

### provider

Manage providers.

#### provider list

List all configured providers.

```bash
sea provider list
```

**Output:**

- Name
- Type
- Base URL (for local)
- Default marker (✓)

#### provider get

Get details of a specific provider.

```bash
sea provider get <name>
```

**Example:**

```bash
sea provider get ollama
```

#### provider add

Add a new provider interactively.

```bash
sea provider add
```

**Prompts for:**

- Name
- Type (anthropic, openai, gemini, ollama, openai-compatible)
- API key (for cloud)
- Base URL (for local)
- Timeout
- Set as default

#### provider default

Set the default provider.

```bash
sea provider default <name>
```

#### provider delete

Delete a provider.

```bash
sea provider delete <name>
```

## Warns if agents depend on it

### model

Manage models (Ollama only).

#### model list

List available models from Ollama.

```bash
sea model list [options]
```

**Options:**

- `-p, --provider <name>` - Specify Ollama provider

**Example:**

```bash
sea model list
sea model list --provider ollama
```

#### model pull

Pull a model from Ollama.

```bash
sea model pull <name> [options]
```

**Options:**

- `-p, --provider <name>` - Specify Ollama provider

**Examples:**

```bash
sea model pull llama2
sea model pull mistral
sea model pull codellama --provider ollama
```

#### model popular

Show popular Ollama models with descriptions.

```bash
sea model popular
```

**Output:**

- General purpose models
- Coding models
- Fast & lightweight models

### config

Show current configuration.

```bash
sea config
```

**Output:**

- Configuration file path
- Default provider
- Default agent
- List of providers
- List of agents

## Configuration

### Configuration File

**Location:**

- Linux: `~/.config/agentsea-cli/config.json`
- macOS: `~/Library/Preferences/agentsea-cli/config.json`
- Windows: `%APPDATA%\agentsea-cli\config.json`

**Structure:**

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

Set API keys via environment variables:

```bash
export ANTHROPIC_API_KEY=your_key
export OPENAI_API_KEY=your_key
export GEMINI_API_KEY=your_key
```

**Priority:**

1. Configuration file
2. Environment variables

### Manual Configuration

You can manually edit the configuration file:

```bash
# Get config path
sea config

# Edit with your favorite editor
vim ~/.config/agentsea-cli/config.json
```

## Workflows

### Workflow 1: Development with Local Models

```bash
# 1. Setup Ollama
ollama serve

# 2. Initialize CLI
sea init
# Choose Ollama, create default agent

# 3. Pull models
sea model pull llama2
sea model pull codellama

# 4. Create specialized agents
sea agent create
# Name: coder
# Model: codellama

# 5. Use them
sea chat --agent coder
```

### Workflow 2: Production with Cloud Providers

```bash
# 1. Setup environment
echo "ANTHROPIC_API_KEY=your_key" > .env

# 2. Initialize
sea init
# Choose Anthropic

# 3. Create production agent
sea agent create
# Name: prod
# Model: claude-sonnet-4-20250514
# High quality settings

# 4. Run tasks
sea agent run prod "Analyze this data: [data]"
```

### Workflow 3: Multi-Provider Setup

```bash
# 1. Add multiple providers
sea provider add
# Add Anthropic

sea provider add
# Add Ollama

sea provider add
# Add OpenAI

# 2. Create agents for each
sea agent create
# Name: claude-agent
# Provider: anthropic

sea agent create
# Name: local-agent
# Provider: ollama

sea agent create
# Name: gpt-agent
# Provider: openai

# 3. Use based on need
sea chat --agent claude-agent    # Cloud, high quality
sea chat --agent local-agent     # Local, private
sea chat --agent gpt-agent       # Cloud, alternative
```

### Workflow 4: Task-Specific Agents

```bash
# Create specialized agents
sea agent create
# Name: coder
# System: You are an expert programmer...

sea agent create
# Name: writer
# System: You are a creative writer...

sea agent create
# Name: analyst
# System: You are a data analyst...

# Use for specific tasks
sea agent run coder "Debug this code"
sea agent run writer "Write a blog post about AI"
sea agent run analyst "Analyze this dataset"
```

## Best Practices

### 1. Agent Naming

Use descriptive, task-based names:

```bash
✅ Good
sea agent create
# Names: coder, writer, analyst, support

❌ Bad
sea agent create
# Names: agent1, a, test
```

### 2. System Prompts

Be specific about the agent's role:

```bash
✅ Good
"You are an expert Python developer specializing in data science..."

❌ Bad
"You are helpful"
```

### 3. Provider Organization

Keep providers organized by purpose:

```bash
# Production
sea provider add
# Name: anthropic-prod

# Development
sea provider add
# Name: ollama-dev

# Backup
sea provider add
# Name: openai-backup
```

### 4. Security

Never commit API keys:

```bash
# Use environment variables
export ANTHROPIC_API_KEY=your_key

# Or store in config (not in git)
echo "config.json" >> .gitignore
```

### 5. Model Selection

Choose appropriate models:

```bash
# Complex tasks - larger models
sea agent run claude-agent "Complex reasoning task"

# Simple tasks - smaller models
sea agent run local-agent "Simple question"

# Code - specialized models
sea agent run coder "Code generation" # codellama
```

## Troubleshooting

### Common Issues

#### "No providers configured"

**Solution:**

```bash
sea init
```

#### "Agent not found"

**Solution:**

```bash
# List available agents
sea agent list

# Create if needed
sea agent create
```

#### Ollama connection error

**Solution:**

```bash
# Make sure Ollama is running
ollama serve

# Check provider config
sea provider get ollama

# Update if needed
sea provider delete ollama
sea provider add
```

#### "Model not found" (Ollama)

**Solution:**

```bash
# Pull the model
sea model pull llama2

# List available models
sea model list
```

#### API key issues

**Solution:**

```bash
# Check environment variables
env | grep API_KEY

# Or set in provider config
sea provider add
# Enter API key when prompted
```

#### Slow responses

**Solutions:**

```bash
# Use smaller models
sea agent create
# Choose phi, gemma, or tinyllama

# Increase timeout
# Edit config manually

# Use faster provider
sea chat --provider openai
```

### Debug Mode

Set verbose mode for debugging:

```bash
# Verbose flag
sea agent run default "test" --verbose

# Environment variable
export VERBOSE=true
sea chat
```

### Getting Help

```bash
# Command help
sea --help
sea agent --help
sea chat --help

# Show configuration
sea config

# Check version
sea --version
```

## Advanced Usage

### Scripting

Use Aigency CLI in scripts:

```bash
#!/bin/bash

# Get response
response=$(sea agent run default "Question" 2>&1)

# Process response
echo "$response" | grep -A 100 "Response:"
```

### Automation

Automate agent creation:

```bash
# Create multiple agents
for task in coder writer analyst; do
  echo "Creating $task agent..."
  # Would need non-interactive mode (future feature)
done
```

### CI/CD Integration

```bash
# In CI pipeline
export ANTHROPIC_API_KEY=$CI_ANTHROPIC_KEY
sea init # with defaults
sea agent run default "Analyze PR changes"
```

## See Also

- [Local Models Guide](./LOCAL_MODELS.md)
- [Provider Reference](./PROVIDERS.md)
- [Quick Start: Local Models](./QUICK_START_LOCAL.md)
- [Aigency ADK Documentation](../README.md)
