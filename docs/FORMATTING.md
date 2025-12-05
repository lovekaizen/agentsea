# Content Formatting

AgentSea supports multiple output formats for agent responses, making it easy to integrate AI-generated content into your applications with rich formatting.

## Overview

Agent responses can be automatically formatted in multiple ways:

- **Text**: Plain text output (default)
- **Markdown**: Preserve markdown formatting with metadata
- **HTML**: Rendered HTML with syntax highlighting and theming
- **React**: React-compatible HTML with data attributes for hydration

## Quick Start

### Basic Usage

```typescript
import {
  Agent,
  AnthropicProvider,
  ToolRegistry,
} from '@lov3kaizen/agentsea-core';

const provider = new AnthropicProvider({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const agent = new Agent(
  {
    name: 'my-agent',
    description: 'Agent with formatting',
    model: 'claude-3-5-sonnet-20241022',
    provider: 'anthropic',
    outputFormat: 'markdown', // or 'text', 'html', 'react'
    formatOptions: {
      includeMetadata: true,
      sanitizeHtml: true,
      highlightCode: true,
      theme: 'dark',
    },
  },
  provider,
  new ToolRegistry(),
);

const response = await agent.execute('Explain quantum computing', {
  conversationId: 'conv-1',
  sessionData: {},
  history: [],
});

console.log('Raw content:', response.content);
console.log('Format:', response.formatted?.format);
console.log('Rendered:', response.formatted?.rendered);
console.log('Metadata:', response.formatted?.metadata);
```

## Output Formats

### Text Format

Plain text output with no processing. This is the default format.

```typescript
const agent = new Agent(
  {
    // ... config
    outputFormat: 'text',
  },
  provider,
  toolRegistry,
);
```

**Use cases:**

- When you need plain text output
- Terminal/CLI applications
- When processing the content further yourself

### Markdown Format

Preserves markdown formatting and extracts metadata about the content.

```typescript
const agent = new Agent(
  {
    // ... config
    outputFormat: 'markdown',
    formatOptions: {
      includeMetadata: true,
    },
  },
  provider,
  toolRegistry,
);
```

**Response structure:**

```typescript
{
  content: "# Title\n\n**Bold text**...",
  formatted: {
    raw: "# Title\n\n**Bold text**...",
    format: "markdown",
    rendered: "# Title\n\n**Bold text**...",
    metadata: {
      hasCodeBlocks: true,
      hasTables: false,
      hasLists: true,
      links: [{ text: "Link", url: "https://..." }]
    }
  }
}
```

**Use cases:**

- When you need to preserve markdown formatting
- Markdown editors
- Documentation generation
- GitHub/GitLab integrations

### HTML Format

Converts markdown to HTML with syntax highlighting, theming, and sanitization.

```typescript
const agent = new Agent(
  {
    // ... config
    outputFormat: 'html',
    formatOptions: {
      includeMetadata: true,
      sanitizeHtml: true, // Remove dangerous HTML
      highlightCode: true, // Add syntax highlighting classes
      theme: 'dark', // 'light', 'dark', or 'auto'
    },
  },
  provider,
  toolRegistry,
);
```

**Response structure:**

```typescript
{
  content: "# Title\n\n**Bold text**...",
  formatted: {
    raw: "# Title\n\n**Bold text**...",
    format: "html",
    rendered: '<div class="agentsea-content" data-theme="dark"><h1>Title</h1><p><strong>Bold text</strong>...</p></div>',
    metadata: { ... }
  }
}
```

**Features:**

- **Sanitization**: Removes `<script>` tags, event handlers, and `javascript:` protocols
- **Syntax highlighting**: Adds classes for code syntax highlighting
- **Theming**: Wraps content in theme container
- **GFM support**: GitHub Flavored Markdown (tables, task lists, etc.)

**Use cases:**

- Web applications
- Rich text editors
- Email generation
- HTML documentation

### React Format

Generates React-compatible HTML with data attributes for component hydration.

```typescript
const agent = new Agent(
  {
    // ... config
    outputFormat: 'react',
    formatOptions: {
      includeMetadata: true,
    },
  },
  provider,
  toolRegistry,
);
```

**Response structure:**

```typescript
{
  content: "# Title\n\n**Bold text**...",
  formatted: {
    raw: "# Title\n\n**Bold text**...",
    format: "react",
    rendered: '<h1>Title</h1><p><strong>Bold text</strong></p>',
    metadata: { ... }
  }
}
```

**Features:**

- Adds `data-component` attributes to elements
- Safe for React `dangerouslySetInnerHTML`
- Compatible with React Server Components

**Use cases:**

- React applications
- Next.js applications
- Server-side rendering
- Component hydration

## Format Options

### `includeMetadata`

Include metadata about the content structure.

```typescript
formatOptions: {
  includeMetadata: true,
}
```

**Metadata includes:**

- `hasCodeBlocks`: Whether content contains code blocks
- `hasTables`: Whether content contains tables
- `hasLists`: Whether content contains lists
- `links`: Array of links with text and URL

### `sanitizeHtml`

Remove potentially dangerous HTML elements (only for HTML/React formats).

```typescript
formatOptions: {
  sanitizeHtml: true,
}
```

**Removes:**

- `<script>` tags
- Event handlers (`onclick`, etc.)
- `javascript:` protocol in links

### `highlightCode`

Add syntax highlighting classes to code blocks (only for HTML format).

```typescript
formatOptions: {
  highlightCode: true,
}
```

Adds `hljs` class to code blocks for use with highlight.js or similar libraries.

### `theme`

Apply a theme wrapper to the rendered content (only for HTML format).

```typescript
formatOptions: {
  theme: 'dark', // 'light', 'dark', or 'auto'
}
```

Wraps content in `<div class="agentsea-content" data-theme="dark">`.

## Using with React

### Installation

```bash
pnpm add @lov3kaizen/agentsea-react
```

### AgentResponse Component

```tsx
import { AgentResponse } from '@lov3kaizen/agentsea-react';

function MyComponent({ response }) {
  return (
    <AgentResponse
      response={response}
      showMetadata={true}
      theme="light"
      components={{
        // Custom component overrides
        code: ({ node, inline, className, children, ...props }) => (
          <MyCustomCode className={className} {...props}>
            {children}
          </MyCustomCode>
        ),
      }}
    />
  );
}
```

**Props:**

- `response`: The agent response object
- `className?`: Additional CSS class names
- `showMetadata?`: Show token usage and metadata
- `theme?`: Theme for styling (`'light'`, `'dark'`, `'auto'`)
- `components?`: Custom component overrides for react-markdown

### StreamingResponse Component

```tsx
import { StreamingResponse } from '@lov3kaizen/agentsea-react';

function MyStreamingComponent() {
  const [stream, setStream] = useState(null);

  const startStream = async () => {
    const streamGenerator = agent.executeStream(input, context);
    setStream(streamGenerator);
  };

  return (
    <StreamingResponse
      stream={stream}
      showMetadata={true}
      theme="dark"
      onComplete={(content) => console.log('Done:', content)}
    />
  );
}
```

### Hooks

#### `useFormattedContent`

```tsx
import { useFormattedContent } from '@lov3kaizen/agentsea-react';

function MyComponent() {
  const formatted = useFormattedContent(content, 'markdown');

  return <div>{formatted?.rendered}</div>;
}
```

#### `useStreamingContent`

```tsx
import { useStreamingContent } from '@lov3kaizen/agentsea-react';

function MyComponent() {
  const { content, isStreaming, metadata, consumeStream } =
    useStreamingContent();

  const handleStream = async () => {
    await consumeStream(streamGenerator);
  };

  return (
    <div>
      {isStreaming && <Spinner />}
      <div>{content}</div>
    </div>
  );
}
```

## Using with NestJS

### Configure Agent

```typescript
import { AgentDecorator } from '@lov3kaizen/agentsea-nestjs';

@AgentDecorator({
  name: 'my-agent',
  description: 'Agent with formatting',
  model: 'claude-3-5-sonnet-20241022',
  provider: 'anthropic',
  outputFormat: 'html',
  formatOptions: {
    includeMetadata: true,
    sanitizeHtml: true,
    highlightCode: true,
  },
})
class MyAgent {}
```

### Runtime Format Override

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { ExecuteAgentDto } from '@lov3kaizen/agentsea-nestjs';

@Controller('agent')
class MyController {
  @Post('execute')
  async execute(@Body() dto: ExecuteAgentDto) {
    // Format can be specified in the request body
    // dto.outputFormat: 'text' | 'markdown' | 'html' | 'react'
    // dto.formatOptions: { ... }

    const response = await this.agent.execute(dto.input, context);
    return response;
  }
}
```

### API Request Example

```bash
curl -X POST http://localhost:3000/agent/execute \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Explain async/await",
    "outputFormat": "html",
    "formatOptions": {
      "includeMetadata": true,
      "sanitizeHtml": true,
      "highlightCode": true,
      "theme": "dark"
    }
  }'
```

## Manual Formatting

You can also manually format content using the `ContentFormatter` utility:

```typescript
import { ContentFormatter } from '@lov3kaizen/agentsea-core';

// Format content
const formatted = ContentFormatter.format(
  '# Title\n\nSome **markdown** content',
  'html',
  {
    includeMetadata: true,
    sanitizeHtml: true,
    highlightCode: true,
    theme: 'dark',
  },
);

console.log(formatted.rendered); // HTML output

// Detect format
const detectedFormat = ContentFormatter.detectFormat('<h1>Hello</h1>');
console.log(detectedFormat); // 'html'
```

## Styling

### Default Styles

The React components don't include default styles, allowing you to style them as needed. Here's a basic example:

```css
.agentsea-response {
  padding: 1rem;
  border-radius: 8px;
  background: #f5f5f5;
}

.agentsea-response[data-theme='dark'] {
  background: #1a1a1a;
  color: #e0e0e0;
}

.agentsea-response code {
  background: #e0e0e0;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-family: monospace;
}

.agentsea-response pre {
  background: #2d2d2d;
  color: #f8f8f8;
  padding: 1rem;
  border-radius: 4px;
  overflow-x: auto;
}

.agentsea-response table {
  border-collapse: collapse;
  width: 100%;
}

.agentsea-response th,
.agentsea-response td {
  border: 1px solid #ddd;
  padding: 0.5rem;
}
```

### Syntax Highlighting

For code syntax highlighting, use a library like highlight.js:

```bash
pnpm add highlight.js
```

```typescript
import 'highlight.js/styles/github-dark.css';
```

The `highlightCode` option adds the necessary classes for highlight.js to work.

## Best Practices

### 1. Choose the Right Format

- **Text**: Simple text output, CLI tools
- **Markdown**: Markdown editors, documentation
- **HTML**: Web apps, emails, rich displays
- **React**: React/Next.js applications

### 2. Use Metadata

Enable `includeMetadata` to get information about content structure:

```typescript
if (response.formatted?.metadata?.hasCodeBlocks) {
  // Load syntax highlighting library
}

if (response.formatted?.metadata?.hasTables) {
  // Enable table styling
}
```

### 3. Sanitize User-Facing HTML

Always use `sanitizeHtml: true` for HTML that will be displayed to users:

```typescript
formatOptions: {
  sanitizeHtml: true, // Prevents XSS attacks
}
```

### 4. Theme Support

Use the `theme` option to match your application:

```typescript
formatOptions: {
  theme: 'auto', // Respects user's system preference
}
```

### 5. Runtime Format Override

Allow users to choose their preferred format:

```typescript
const format = userPreference || agent.config.outputFormat || 'text';
agent.config.outputFormat = format;
```

## Examples

See the following example files for complete implementations:

- **Basic**: `examples/formatting-example.ts`
- **React**: `examples/react-formatting-example.tsx`
- **NestJS**: `examples/nestjs-formatting-example.ts`

## API Reference

### Types

```typescript
type OutputFormat = 'text' | 'markdown' | 'html' | 'react';

interface FormatOptions {
  includeMetadata?: boolean;
  sanitizeHtml?: boolean;
  highlightCode?: boolean;
  theme?: 'light' | 'dark' | 'auto';
}

interface FormattedContent {
  raw: string;
  format: OutputFormat;
  rendered?: string;
  metadata?: {
    hasCodeBlocks?: boolean;
    hasTables?: boolean;
    hasLists?: boolean;
    links?: Array<{ text: string; url: string }>;
  };
}

interface AgentResponse {
  content: string;
  formatted?: FormattedContent;
  toolCalls?: ToolCall[];
  metadata: {
    tokensUsed: number;
    latencyMs: number;
    iterations: number;
    cost?: number;
  };
  finishReason?: 'stop' | 'length' | 'tool_calls' | 'error';
}
```

### ContentFormatter

```typescript
class ContentFormatter {
  // Format content
  static format(
    content: string,
    format: OutputFormat,
    options?: FormatOptions,
  ): FormattedContent;

  // Detect format
  static detectFormat(content: string): OutputFormat;
}
```

## Troubleshooting

### Markdown Not Rendering

Make sure you've installed the `marked` package:

```bash
pnpm add marked
```

### React Components Not Working

Install the required dependencies:

```bash
pnpm add react-markdown remark-gfm rehype-highlight rehype-raw
```

### Syntax Highlighting Not Working

1. Make sure `highlightCode` is enabled
2. Install highlight.js
3. Import the CSS file

```typescript
import 'highlight.js/styles/github-dark.css';
```

### HTML Looks Unstyled

The components don't include default styles. Add your own CSS or use the example styles from the documentation.

## License

MIT
