# @lov3kaizen/agentsea-react

React components for rendering AgentSea agent responses with formatting support.

[![npm version](https://img.shields.io/npm/v/@lov3kaizen/agentsea-react.svg)](https://www.npmjs.com/package/@lov3kaizen/agentsea-react)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

## Features

- Markdown rendering with GitHub Flavored Markdown support
- Code syntax highlighting
- Streaming response support
- Customizable styling

## Installation

```bash
npm install @lov3kaizen/agentsea-react @lov3kaizen/agentsea-core react react-dom
# or
pnpm add @lov3kaizen/agentsea-react @lov3kaizen/agentsea-core react react-dom
# or
yarn add @lov3kaizen/agentsea-react @lov3kaizen/agentsea-core react react-dom
```

## Quick Start

```tsx
import { AgentResponse } from '@lov3kaizen/agentsea-react';

function ChatMessage({ content }: { content: string }) {
  return <AgentResponse content={content} />;
}
```

## Components

### AgentResponse

Renders agent response content with markdown formatting:

```tsx
import { AgentResponse } from '@lov3kaizen/agentsea-react';

<AgentResponse
  content="# Hello World\n\nThis is **markdown** content."
  className="my-response"
/>;
```

### StreamingResponse

For streaming responses:

```tsx
import { StreamingResponse } from '@lov3kaizen/agentsea-react';

<StreamingResponse content={streamingContent} isStreaming={true} />;
```

## Styling

Components can be styled using CSS classes or inline styles:

```tsx
<AgentResponse
  content={content}
  className="custom-response"
  style={{ maxWidth: '600px' }}
/>
```

## Documentation

Full documentation available at [agentsea.dev](https://agentsea.dev)

## Related Packages

- [@lov3kaizen/agentsea-core](https://www.npmjs.com/package/@lov3kaizen/agentsea-core) - Core library
- [@lov3kaizen/agentsea-nestjs](https://www.npmjs.com/package/@lov3kaizen/agentsea-nestjs) - NestJS integration
- [@lov3kaizen/agentsea-cli](https://www.npmjs.com/package/@lov3kaizen/agentsea-cli) - Command-line interface

## License

MIT License - see [LICENSE](../../LICENSE) for details
