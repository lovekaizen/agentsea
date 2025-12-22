/**
 * Basic Proxy Example
 *
 * This example shows how to set up a basic LLM gateway proxy
 * that routes requests to multiple providers.
 *
 * Run: npx ts-node examples/basic-proxy.ts
 */

import { Gateway, createHTTPServer, startServer } from '../src/index.js';

function main() {
  // Create gateway with multiple providers
  const gateway = new Gateway({
    providers: [
      {
        name: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
      },
      {
        name: 'anthropic',
        apiKey: process.env.ANTHROPIC_API_KEY,
        models: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
      },
    ],
    routing: {
      strategy: 'round-robin',
    },
    cache: {
      enabled: true,
      ttl: 3600,
      maxEntries: 1000,
      type: 'exact',
    },
    telemetry: {
      logging: { level: 'info' },
    },
  });

  // Listen for events
  gateway.on('request:complete', (event) => {
    console.log(
      `✓ Request completed: ${event.provider}/${event.model} - ${event.latencyMs}ms - $${event.cost.toFixed(6)}`,
    );
  });

  gateway.on('request:error', (event) => {
    console.error(`✗ Request failed: ${event.error.message}`);
  });

  // Create and start HTTP server
  const app = createHTTPServer({
    gateway,
    cors: { origin: '*' },
    basePath: '',
  });

  const port = parseInt(process.env.PORT || '3000', 10);
  startServer(app, { port });

  console.log(`
🚀 Gateway is running!

Endpoints:
  - POST http://localhost:${port}/v1/chat/completions (OpenAI-compatible)
  - GET  http://localhost:${port}/v1/models
  - GET  http://localhost:${port}/health
  - GET  http://localhost:${port}/metrics

Example curl:
  curl http://localhost:${port}/v1/chat/completions \\
    -H "Content-Type: application/json" \\
    -d '{
      "model": "gpt-4o-mini",
      "messages": [{"role": "user", "content": "Hello!"}]
    }'

Use virtual models:
  - "best" - Routes to highest quality model
  - "cheapest" - Routes to most cost-effective model
  - "fastest" - Routes to lowest latency provider
  `);
}

main();
