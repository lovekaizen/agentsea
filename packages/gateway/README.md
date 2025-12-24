# @lov3kaizen/agentsea-gateway

High-performance TypeScript-native LLM gateway with unified API access, intelligent routing, caching, and cost optimization.

## Features

- **Unified API**: OpenAI-compatible API for all providers (OpenAI, Anthropic, Google)
- **Intelligent Routing**: Round-robin, failover, cost-optimized, and latency-optimized strategies
- **Virtual Models**: Use `best`, `cheapest`, or `fastest` to auto-route to optimal providers
- **Caching**: Built-in LRU cache to reduce costs and latency
- **Streaming**: Full streaming support with SSE
- **Metrics**: Request tracking, cost calculation, and latency monitoring
- **Failover**: Automatic retry with circuit breaker protection
- **Type-Safe**: Full TypeScript support with comprehensive types

## Installation

```bash
pnpm add @lov3kaizen/agentsea-gateway
```

## Quick Start

### As HTTP Proxy

```typescript
import {
  Gateway,
  createHTTPServer,
  startServer,
} from '@lov3kaizen/agentsea-gateway';

const gateway = new Gateway({
  providers: [
    {
      name: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      models: ['gpt-4o', 'gpt-4o-mini'],
    },
    {
      name: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY,
      models: ['claude-3-5-sonnet-20241022'],
    },
  ],
  routing: {
    strategy: 'cost-optimized',
  },
});

const app = createHTTPServer({ gateway });
startServer(app, { port: 3000 });
```

Then use it like the OpenAI API:

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "cheapest",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### As SDK

```typescript
import { Gateway } from '@lov3kaizen/agentsea-gateway';

const gateway = new Gateway({
  providers: [
    { name: 'openai', apiKey: process.env.OPENAI_API_KEY, models: ['gpt-4o'] },
  ],
});

// OpenAI-compatible interface
const response = await gateway.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }],
});

console.log(response.choices[0].message.content);
console.log(response._gateway); // Gateway metadata (provider, cost, latency)
```

## Virtual Models

Instead of specifying a model, use virtual models for automatic routing:

```typescript
// Route to highest quality available model
await gateway.chat.completions.create({
  model: 'best',
  messages: [{ role: 'user', content: 'Complex reasoning task...' }],
});

// Route to cheapest model
await gateway.chat.completions.create({
  model: 'cheapest',
  messages: [{ role: 'user', content: 'Simple task...' }],
});

// Route to fastest provider
await gateway.chat.completions.create({
  model: 'fastest',
  messages: [{ role: 'user', content: 'Time-sensitive task...' }],
});
```

## Routing Strategies

### Round-Robin

Distributes requests evenly across providers:

```typescript
const gateway = new Gateway({
  providers: [...],
  routing: {
    strategy: 'round-robin',
    weights: { openai: 2, anthropic: 1 }, // 2:1 ratio
  },
});
```

### Failover

Tries providers in order until one succeeds:

```typescript
const gateway = new Gateway({
  providers: [...],
  routing: {
    strategy: 'failover',
    fallbackChain: ['openai', 'anthropic', 'google'],
  },
});
```

### Cost-Optimized

Selects the cheapest model meeting quality requirements:

```typescript
import { CostOptimizedStrategy } from '@lov3kaizen/agentsea-gateway';

const gateway = new Gateway({
  providers: [...],
  routing: { strategy: 'cost-optimized' },
});
```

### Latency-Optimized

Routes to the fastest provider based on observed latencies:

```typescript
const gateway = new Gateway({
  providers: [...],
  routing: { strategy: 'latency-optimized' },
});
```

## Caching

Enable caching to reduce costs and latency for repeated requests:

```typescript
const gateway = new Gateway({
  providers: [...],
  cache: {
    enabled: true,
    ttl: 3600, // 1 hour
    maxEntries: 1000,
    type: 'exact', // Hash-based matching
  },
});
```

## Request Metadata

Add gateway-specific options to requests:

```typescript
const response = await gateway.chat.completions.create({
  model: 'gpt-4o',
  messages: [...],
  _gateway: {
    preferredProvider: 'anthropic',
    excludeProviders: ['google'],
    maxCost: 0.01, // Max $0.01 per request
    maxLatency: 5000, // Max 5 seconds
    cachePolicy: 'no-cache', // Skip cache
    tags: { user: 'user-123' },
  },
});
```

## Response Metadata

Every response includes gateway metadata:

```typescript
const response = await gateway.chat.completions.create({ ... });

console.log(response._gateway);
// {
//   provider: 'openai',
//   originalModel: 'cheapest',
//   latencyMs: 1234,
//   cost: 0.000123,
//   cached: false,
//   retries: 0,
//   routingDecision: { ... }
// }
```

## Streaming

Full streaming support:

```typescript
const stream = await gateway.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Tell me a story' }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}
```

## Metrics

Track usage and costs:

```typescript
const metrics = gateway.getMetrics();

console.log(metrics.requests.total);
console.log(metrics.cost.total);
console.log(metrics.cost.byProvider);
console.log(metrics.latency.avg);
console.log(metrics.cache.hitRate);
```

## Events

Listen to gateway events:

```typescript
gateway.on('request:complete', (event) => {
  console.log(`${event.provider}: ${event.latencyMs}ms, $${event.cost}`);
});

gateway.on('request:error', (event) => {
  console.error(`Error: ${event.error.message}`);
});

gateway.on('provider:unhealthy', (provider) => {
  console.warn(`Provider ${provider} is unhealthy`);
});
```

## API Reference

### Gateway

Main gateway class:

- `constructor(config: GatewayConfig)`
- `chat.completions.create(request)` - Create completion
- `getMetrics()` - Get usage metrics
- `getRegistry()` - Get provider registry
- `getRouter()` - Get router instance
- `checkHealth()` - Check provider health
- `shutdown()` - Clean shutdown

### Providers

Built-in providers:

- `OpenAIProvider` - OpenAI/Azure OpenAI
- `AnthropicProvider` - Anthropic Claude
- `GoogleProvider` - Google Gemini

### Routing Strategies

- `RoundRobinStrategy` - Even distribution
- `FailoverStrategy` - Ordered fallback
- `CostOptimizedStrategy` - Cheapest model
- `LatencyOptimizedStrategy` - Fastest provider

## License

MIT
