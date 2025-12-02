# @lov3kaizen/agentsea-nestjs

NestJS integration for AgentSea - Unite and orchestrate AI agents in your NestJS applications.

[![npm version](https://img.shields.io/npm/v/@lov3kaizen/agentsea-nestjs.svg)](https://www.npmjs.com/package/@lov3kaizen/agentsea-nestjs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

## Features

- Decorators for agents and tools (`@Agent`, `@Tool`)
- REST API endpoints for agent execution
- WebSocket gateway for real-time streaming
- Rate limiting guard
- Full dependency injection support

## Installation

```bash
npm install @lov3kaizen/agentsea-nestjs @lov3kaizen/agentsea-core
# or
pnpm add @lov3kaizen/agentsea-nestjs @lov3kaizen/agentsea-core
# or
yarn add @lov3kaizen/agentsea-nestjs @lov3kaizen/agentsea-core
```

## Quick Start

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
      enableRestApi: true,
      enableWebSocket: true,
    }),
  ],
})
export class AppModule {}
```

## REST API Endpoints

When `enableRestApi` is set to `true`:

- `GET /agents` - List all agents
- `GET /agents/:name` - Get agent details
- `POST /agents/:name/execute` - Execute agent
- `POST /agents/:name/stream` - Stream agent response (SSE)

## WebSocket Events

When `enableWebSocket` is set to `true`:

- `execute` - Execute an agent
- `stream` - Real-time streaming events
- `listAgents` - Get available agents
- `getAgent` - Get agent info

## Creating Agents with Decorators

```typescript
import { Injectable } from '@nestjs/common';
import { Agent, Tool } from '@lov3kaizen/agentsea-nestjs';

@Injectable()
@Agent({
  name: 'assistant',
  description: 'A helpful assistant',
  model: 'claude-sonnet-4-20250514',
  provider: 'anthropic',
})
export class AssistantAgent {
  @Tool({
    name: 'greet',
    description: 'Greet a user by name',
    parameters: {
      name: { type: 'string', description: 'The name to greet' },
    },
  })
  greet(params: { name: string }) {
    return `Hello, ${params.name}!`;
  }
}
```

## Documentation

Full documentation available at [agentsea.dev](https://agentsea.dev)

- [NestJS Integration](https://agentsea.dev/docs/nestjs)
- [API Reference](https://agentsea.dev/api)

## Related Packages

- [@lov3kaizen/agentsea-core](https://www.npmjs.com/package/@lov3kaizen/agentsea-core) - Core library
- [@lov3kaizen/agentsea-cli](https://www.npmjs.com/package/@lov3kaizen/agentsea-cli) - Command-line interface
- [@lov3kaizen/agentsea-react](https://www.npmjs.com/package/@lov3kaizen/agentsea-react) - React components

## License

MIT License - see [LICENSE](../../LICENSE) for details
