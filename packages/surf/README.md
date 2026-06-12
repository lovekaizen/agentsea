# @lov3kaizen/agentsea-surf

Surf - Computer-use agent for AgentSea. Control desktop environments through screen capture, mouse, and keyboard actions using Claude's vision capabilities.

## Features

- **8 Computer-Use Tools**: screenshot, click, type, scroll, drag, key press, cursor move, wait
- **Multiple Backends**: Native (macOS, Linux, Windows), Puppeteer browser, Docker container
- **Claude Vision Integration**: Automatic screen analysis and action determination
- **NestJS Integration**: Full REST API and WebSocket support
- **Security Sandboxing**: Rate limiting, command blocking, domain/path restrictions

## Installation

```bash
npm install @lov3kaizen/agentsea-surf
# or
pnpm add @lov3kaizen/agentsea-surf
```

### Optional Dependencies

```bash
# For browser automation
npm install puppeteer

# For image processing
npm install sharp
```

## Quick Start

### Basic Usage

```typescript
import { SurfAgent, createNativeBackend } from '@lov3kaizen/agentsea-surf';

async function main() {
  // Create a native backend for your platform
  const backend = createNativeBackend();
  await backend.connect();

  // Create the agent
  const agent = new SurfAgent('session-1', backend, {
    maxSteps: 20,
    vision: {
      model: 'claude-sonnet-4-6',
      maxTokens: 4096,
      includeScreenshotInResponse: true,
    },
  });

  // Execute a task
  const result = await agent.execute('Open Chrome and navigate to google.com');

  console.log('Result:', result.response);
  console.log('Steps taken:', result.state.actionHistory.length);

  await backend.disconnect();
}

main().catch(console.error);
```

### With Streaming

```typescript
const agent = new SurfAgent('session-1', backend, config);

for await (const event of agent.executeStream('Search for weather')) {
  switch (event.type) {
    case 'screenshot':
      console.log('Screenshot taken');
      break;
    case 'action':
      console.log(`Executing: ${event.action.description}`);
      break;
    case 'complete':
      console.log('Task completed:', event.response);
      break;
  }
}
```

### NestJS Integration

```typescript
import { Module } from '@nestjs/common';
import { SurfModule } from '@lov3kaizen/agentsea-surf/nestjs';

@Module({
  imports: [
    SurfModule.forRoot({
      backend: { type: 'native' },
      config: {
        maxSteps: 50,
        sandbox: { enabled: true },
      },
      enableRestApi: true,
      enableWebSocket: true,
    }),
  ],
})
export class AppModule {}
```

## Backends

### Native Backend

Automatically selects the appropriate backend for your platform:

```typescript
import { createNativeBackend } from '@lov3kaizen/agentsea-surf';

const backend = createNativeBackend({ displayIndex: 0 });
```

### Browser Backend (Puppeteer)

```typescript
import { PuppeteerBackend } from '@lov3kaizen/agentsea-surf';

const backend = new PuppeteerBackend({
  headless: false,
  viewport: { width: 1920, height: 1080 },
  initialUrl: 'https://example.com',
});
```

### Docker Backend

```typescript
import { DockerBackend } from '@lov3kaizen/agentsea-surf';

const backend = new DockerBackend({
  image: 'agentsea/desktop:ubuntu-22.04',
  resolution: { width: 1920, height: 1080, scaleFactor: 1 },
  removeOnDisconnect: true,
});
```

## Tools

All tools can be used independently:

```typescript
import {
  createSurfTools,
  createNativeBackend,
} from '@lov3kaizen/agentsea-surf';

const backend = createNativeBackend();
await backend.connect();

const tools = createSurfTools(backend);

// Use individual tools
await tools.screenshot.execute({});
await tools.click.execute({ x: 100, y: 200 });
await tools.typeText.execute({ text: 'Hello World' });
```

## Security

The sandbox configuration allows you to restrict agent capabilities:

```typescript
const agent = new SurfAgent('session', backend, {
  sandbox: {
    enabled: true,
    maxActionsPerMinute: 60,
    blockedDomains: ['malicious-site.com'],
    blockedCommands: ['rm -rf', 'sudo'],
    blockedPaths: ['/etc', '/root'],
  },
});
```

## API Reference

### SurfAgent

Main agent class for executing computer automation tasks.

**Constructor:**

```typescript
new SurfAgent(
  sessionId: string,
  backend: DesktopBackend,
  config?: Partial<SurfConfig>
)
```

**Methods:**

- `execute(task: string, context?: AgentContext)` - Execute a task
- `executeStream(task: string, context?: AgentContext)` - Execute with streaming
- `stop()` - Stop the current execution
- `getState()` - Get current agent state

### REST API Endpoints

When using NestJS integration:

- `POST /surf/execute` - Execute a task
- `POST /surf/action` - Execute single action
- `POST /surf/screenshot` - Take a screenshot
- `GET /surf/screen` - Get screen state
- `GET /surf/sessions` - List active sessions
- `GET /surf/status` - Get backend status

### WebSocket Events

- `execute` - Start task execution (emits `stream`, `complete`, `error`)
- `action` - Execute single action (emits `actionResult`)
- `screenshot` - Take screenshot (emits `screenshotResult`)
- `stop` - Stop current execution
- `status` - Get backend status

## License

MIT
