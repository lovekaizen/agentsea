# API Documentation

This guide covers the REST API, Server-Sent Events (SSE), and WebSocket interfaces for AgentSea agents.

## Table of Contents

- [REST API](#rest-api)
- [Server-Sent Events (SSE)](#server-sent-events-sse)
- [WebSocket](#websocket)
- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [Error Handling](#error-handling)

## REST API

### Setup

Enable the REST API in your NestJS application:

```typescript
import { Module } from '@nestjs/common';
import { AgenticModule } from '@lov3kaizen/agentsea-nestjs';

@Module({
  imports: [
    AgenticModule.forRoot({
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY,
      enableRestApi: true, // Enable REST API endpoints
    }),
  ],
})
export class AppModule {}
```

### Endpoints

#### List All Agents

```http
GET /agents
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "name": "customer-support",
      "description": "AI customer support agent",
      "model": "claude-3-5-sonnet-20241022",
      "provider": "anthropic",
      "tools": ["search", "order-lookup"]
    }
  ]
}
```

#### Get Agent Details

```http
GET /agents/:name
```

**Parameters:**

- `name` (path): Agent name

**Response:**

```json
{
  "success": true,
  "data": {
    "name": "customer-support",
    "description": "AI customer support agent",
    "model": "claude-3-5-sonnet-20241022",
    "provider": "anthropic",
    "systemPrompt": "You are a helpful customer support agent...",
    "tools": [
      {
        "name": "search",
        "description": "Search the knowledge base"
      }
    ],
    "temperature": 0.7,
    "maxTokens": 2048,
    "maxIterations": 10
  }
}
```

#### Execute Agent

```http
POST /agents/:name/execute
```

**Parameters:**

- `name` (path): Agent name

**Request Body:**

```json
{
  "input": "I need help with my order #12345",
  "conversationId": "conv-user-123",
  "userId": "user-123",
  "sessionData": {
    "orderNumber": "12345",
    "customerTier": "premium"
  },
  "history": [
    {
      "role": "user",
      "content": "Previous message"
    },
    {
      "role": "assistant",
      "content": "Previous response"
    }
  ],
  "metadata": {
    "source": "web-chat",
    "timestamp": "2025-01-07T12:00:00Z"
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "content": "I'd be happy to help you with order #12345...",
    "toolCalls": [
      {
        "id": "call_123",
        "tool": "order-lookup",
        "parameters": { "orderId": "12345" },
        "result": { "status": "shipped" }
      }
    ],
    "metadata": {
      "tokensUsed": 450,
      "latencyMs": 1234,
      "iterations": 2,
      "cost": 0.0045
    },
    "finishReason": "stop"
  },
  "conversationId": "conv-user-123"
}
```

#### Delete Conversation

```http
DELETE /agents/:name/conversations/:conversationId
```

**Parameters:**

- `name` (path): Agent name
- `conversationId` (path): Conversation ID

**Response:**

```json
{
  "success": true,
  "message": "Conversation conv-user-123 deleted"
}
```

## Server-Sent Events (SSE)

SSE enables real-time streaming of agent responses as they're generated.

### Setup

SSE is automatically enabled when `enableRestApi: true`.

### Endpoint

```http
POST /agents/:name/stream
```

**Request Body:** Same as `/agents/:name/execute`

**Response:** Event stream with the following event types:

### Event Types

#### `iteration`

Emitted at the start of each agent iteration:

```json
{
  "type": "iteration",
  "iteration": 1
}
```

#### `content`

Emitted for each chunk of generated content:

```json
{
  "type": "content",
  "content": "I'd be happy to",
  "delta": true
}
```

- `delta`: If `true`, this is an incremental chunk to append to previous content

#### `tool_calls`

Emitted when the agent decides to use tools:

```json
{
  "type": "tool_calls",
  "toolCalls": [
    {
      "id": "call_123",
      "tool": "search",
      "parameters": { "query": "order status" }
    }
  ]
}
```

#### `tool_result`

Emitted when a tool execution completes:

```json
{
  "type": "tool_result",
  "toolCall": {
    "id": "call_123",
    "tool": "search",
    "parameters": { "query": "order status" },
    "result": { "found": true, "data": "..." }
  }
}
```

#### `done`

Emitted when the agent completes:

```json
{
  "type": "done",
  "metadata": {
    "tokensUsed": 450,
    "latencyMs": 1234,
    "iterations": 2
  }
}
```

#### `error`

Emitted if an error occurs:

```json
{
  "type": "error",
  "error": "Agent execution failed: ..."
}
```

### Client Examples

#### Browser (Fetch API)

```typescript
const response = await fetch('/agents/customer-support/stream', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  },
  body: JSON.stringify({
    input: 'Hello!',
    conversationId: 'conv-123',
  }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const event = JSON.parse(line.substring(6));

      if (event.type === 'content') {
        console.log(event.content);
      }
    }
  }
}
```

#### React Hook

```typescript
function useAgentStream(agentName: string) {
  const [content, setContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const execute = async (input: string) => {
    setIsStreaming(true);
    setContent('');

    const response = await fetch(`/agents/${agentName}/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({ input }),
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const event = JSON.parse(line.substring(6));

          if (event.type === 'content') {
            setContent((prev) => prev + event.content);
          } else if (event.type === 'done') {
            setIsStreaming(false);
          }
        }
      }
    }
  };

  return { content, isStreaming, execute };
}
```

## WebSocket

WebSocket provides bidirectional, real-time communication with agents.

### Setup

Enable WebSocket in your NestJS application:

```typescript
@Module({
  imports: [
    AgenticModule.forRoot({
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY,
      enableWebSocket: true, // Enable WebSocket gateway
    }),
  ],
})
export class AppModule {}
```

### Connection

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/agents');
```

### Events

#### Client → Server

##### `execute`

Execute an agent:

```typescript
socket.emit('execute', {
  agentName: 'customer-support',
  input: 'Hello!',
  conversationId: 'conv-123',
  userId: 'user-456',
  sessionData: { plan: 'premium' },
  metadata: { source: 'mobile' },
});
```

##### `getAgent`

Get agent information:

```typescript
socket.emit('getAgent', { agentName: 'customer-support' });
```

##### `listAgents`

List all agents:

```typescript
socket.emit('listAgents');
```

#### Server → Client

##### `stream`

Streaming events (same format as SSE):

```typescript
socket.on('stream', (event) => {
  switch (event.type) {
    case 'content':
      console.log(event.content);
      break;
    case 'done':
      console.log('Complete!', event.metadata);
      break;
  }
});
```

##### `complete`

Emitted when execution completes:

```typescript
socket.on('complete', (data) => {
  console.log('Conversation ID:', data.conversationId);
});
```

##### `agentInfo`

Response to `getAgent`:

```typescript
socket.on('agentInfo', (info) => {
  console.log('Agent:', info.name);
  console.log('Tools:', info.tools);
});
```

##### `agentList`

Response to `listAgents`:

```typescript
socket.on('agentList', (data) => {
  console.log('Agents:', data.agents);
});
```

##### `error`

Error events:

```typescript
socket.on('error', (error) => {
  console.error('Error:', error.message);
});
```

### Client Example

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/agents');

socket.on('connect', () => {
  console.log('Connected!');

  // Execute agent
  socket.emit('execute', {
    agentName: 'customer-support',
    input: 'I need help with my order',
  });
});

// Handle streaming
let fullResponse = '';

socket.on('stream', (event) => {
  if (event.type === 'content') {
    fullResponse += event.content;
    updateUI(fullResponse);
  }
});

socket.on('complete', () => {
  console.log('Done!');
});
```

## Authentication

You can secure your API endpoints using NestJS guards:

```typescript
import { Controller, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './auth/jwt-auth.guard';

@Controller('agents')
@UseGuards(JwtAuthGuard)
export class AgentController {
  // Protected endpoints
}
```

For WebSocket:

```typescript
@WebSocketGateway({
  namespace: '/agents',
})
export class AgentGateway {
  @SubscribeMessage('execute')
  @UseGuards(WsJwtGuard)
  async handleExecute() {
    // Protected handler
  }
}
```

## Rate Limiting

Use the built-in rate limiting guard:

```typescript
import { RateLimit, RateLimitGuard } from '@lov3kaizen/agentsea-nestjs';

@Controller('agents')
@UseGuards(RateLimitGuard)
export class AgentController {
  @Post(':name/execute')
  @RateLimit({ requests: 10, window: 60000 }) // 10 requests per minute
  async execute() {
    // Rate-limited endpoint
  }
}
```

## Error Handling

### HTTP Status Codes

- `200` - Success
- `400` - Bad request (invalid input)
- `404` - Agent not found
- `429` - Rate limit exceeded
- `500` - Internal server error

### Error Response Format

```json
{
  "success": false,
  "error": {
    "message": "Agent 'unknown-agent' not found",
    "code": "AGENT_NOT_FOUND",
    "statusCode": 404
  }
}
```

### Streaming Error Handling

For SSE/WebSocket, errors are sent as events:

```json
{
  "type": "error",
  "error": "Agent execution failed: timeout"
}
```

## Best Practices

1. **Always provide a conversationId** for multi-turn conversations
2. **Use SSE for one-way streaming** (server → client)
3. **Use WebSocket for bidirectional** real-time communication
4. **Implement exponential backoff** for reconnection logic
5. **Handle all event types** in streaming clients
6. **Validate user input** before sending to agents
7. **Set appropriate timeouts** for long-running agent operations
8. **Monitor token usage** via metadata in responses
9. **Implement rate limiting** to prevent abuse
10. **Use authentication** for production deployments

## Performance Considerations

- **Connection pooling**: Reuse WebSocket connections
- **Message batching**: Group rapid updates for better performance
- **Caching**: Cache agent configurations and tool registries
- **Load balancing**: Distribute WebSocket connections across multiple servers
- **Compression**: Enable gzip compression for HTTP responses

## Next Steps

- See [examples/rest-api-example.ts](../examples/rest-api-example.ts) for complete REST API examples
- See [examples/sse-streaming-example.ts](../examples/sse-streaming-example.ts) for SSE examples
- See [examples/websocket-example.ts](../examples/websocket-example.ts) for WebSocket examples
