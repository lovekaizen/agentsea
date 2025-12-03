# @lov3kaizen/agentsea-admin-ui

**Visual workflow builder and agent management for AgentSea SDK**

Open-source, self-hosted admin interface for creating and managing AI agents and workflows.

## Features

- **Visual Workflow Builder** - Drag-and-drop interface with React Flow
- **Agent Management** - Create and configure AI agents
- **Tool Registry** - Browse, test, and create custom tools
- **Provider Setup** - Connect to multiple LLM providers
- **Execution Monitor** - Real-time conversation viewing and debugging
- **Testing Playground** - Test agents locally with live output

## Quick Start

### Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Open http://localhost:3000
```

### Production

```bash
# Build for production
pnpm build

# Start production server
pnpm start
```

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **UI:** Tailwind CSS + shadcn/ui
- **Workflow Editor:** React Flow
- **State:** Zustand
- **Database:** SQLite (local, embedded)
- **ORM:** Drizzle ORM

## Usage

### Standalone Mode

Run the admin UI as a standalone application:

```bash
cd packages/admin-ui
pnpm dev
```

### Embedded Mode

Embed in your Next.js application:

```typescript
import { AdminUI } from '@lov3kaizen/agentsea-admin-ui';

export default function Page() {
  return <AdminUI />;
}
```

## Configuration

The admin UI uses SQLite by default for storing configurations locally.

```typescript
// lib/db.ts
import Database from 'better-sqlite3';

const db = new Database('.agentsea/admin.db');
```

## Features Overview

### Workflow Builder

- Visual canvas with drag-and-drop nodes
- Sequential, parallel, and supervisor workflows
- Real-time validation
- Export/import as JSON

### Agent Configuration

- System prompt editor with templates
- Tool assignment
- Memory configuration
- Provider and model selection

### Tool Registry

- Built-in tools showcase
- Custom tool creation wizard
- Parameter validation
- Test execution

### Provider Management

- Add/configure providers (Anthropic, OpenAI, Ollama, etc.)
- API key management (encrypted)
- Connection testing
- Default provider selection

### Execution Monitor

- View conversation history
- Tool call inspection
- Performance metrics
- Export conversations

### Testing Playground

- Execute workflows locally
- Live streaming output
- Input/output preview
- Debug tools

## Development

### Project Structure

```
admin-ui/
├── app/                  # Next.js app directory
│   ├── dashboard/        # Dashboard pages
│   ├── workflows/        # Workflow builder
│   ├── agents/           # Agent management
│   ├── tools/            # Tool registry
│   ├── providers/        # Provider setup
│   └── playground/       # Testing playground
├── components/           # React components
│   ├── ui/               # shadcn/ui components
│   ├── workflow/         # Workflow editor components
│   └── agent/            # Agent form components
├── lib/                  # Utilities and helpers
│   ├── db.ts             # Database setup
│   ├── utils.ts          # Utility functions
│   └── store.ts          # Zustand store
└── public/               # Static assets
```

### Adding UI Components

Use shadcn/ui CLI to add components:

```bash
npx shadcn-ui@latest add button
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add form
```

## Deployment

### Self-Hosted

```bash
# Build the application
pnpm build

# Start with PM2
pm2 start pnpm --name "agentsea-admin" -- start

# Or with Docker
docker build -t agentsea-admin .
docker run -p 3000:3000 agentsea-admin
```

### Vercel

```bash
# Deploy to Vercel
vercel deploy
```

## Environment Variables

```bash
# .env.local
DATABASE_PATH=.agentsea/admin.db
```

## License

MIT License - see [LICENSE](../../LICENSE) for details

## See Also

- [@lov3kaizen/agentsea-core](../core) - Core AgentSea SDK
- [@lov3kaizen/agentsea-nestjs](../nestjs) - NestJS integration
- [@lov3kaizen/agentsea-cli](../cli) - Command-line interface

---

Built with ❤️ by [lovekaizen](https://github.com/lovekaizen)
