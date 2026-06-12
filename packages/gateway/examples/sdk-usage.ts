/**
 * SDK Usage Example
 *
 * This example shows how to use the gateway as an SDK
 * without running an HTTP server.
 *
 * Run: npx ts-node examples/sdk-usage.ts
 */

import { Gateway } from '../src/index.js';

async function main() {
  // Create gateway
  const gateway = new Gateway({
    providers: [
      {
        name: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        models: ['gpt-5.5', 'gpt-5.4-mini'],
      },
      {
        name: 'anthropic',
        apiKey: process.env.ANTHROPIC_API_KEY,
        models: ['claude-sonnet-4-6', 'claude-haiku-4-5'],
      },
    ],
    routing: {
      strategy: 'cost-optimized',
    },
    cache: {
      enabled: true,
      ttl: 3600,
      maxEntries: 100,
      type: 'exact',
    },
  });

  console.log('Gateway initialized with cost-optimized routing\n');

  // Example 1: Simple completion
  console.log('=== Example 1: Simple Completion ===');
  const response1 = await gateway.chat.completions.create({
    model: 'cheapest', // Virtual model - routes to cheapest
    messages: [
      { role: 'user', content: 'What is 2 + 2? Reply with just the number.' },
    ],
    max_tokens: 10,
  });

  if ('choices' in response1) {
    console.log('Response:', response1.choices[0].message.content);
    console.log('Provider:', response1._gateway?.provider);
    console.log(
      'Model:',
      response1._gateway?.originalModel,
      '->',
      response1.model,
    );
    console.log('Cost: $' + response1._gateway?.cost.toFixed(6));
    console.log('Latency:', response1._gateway?.latencyMs + 'ms');
  }

  // Example 2: Streaming completion
  console.log('\n=== Example 2: Streaming Completion ===');
  const stream = await gateway.chat.completions.create({
    model: 'gpt-5.4-mini',
    messages: [
      { role: 'user', content: 'Count from 1 to 5, one number per line.' },
    ],
    stream: true,
    max_tokens: 50,
  });

  if (Symbol.asyncIterator in Object(stream)) {
    process.stdout.write('Response: ');
    for await (const chunk of stream as AsyncGenerator<unknown>) {
      const content = (chunk as Record<string, unknown>).choices?.[0]?.delta
        ?.content;
      if (content) {
        process.stdout.write(String(content));
      }
    }
    console.log('\n');
  }

  // Example 3: With routing hints
  console.log('=== Example 3: Routing Hints ===');
  const response3 = await gateway.chat.completions.create({
    model: 'best', // Route to best quality model
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      {
        role: 'user',
        content: 'Explain quantum entanglement in one sentence.',
      },
    ],
    max_tokens: 100,
    _gateway: {
      preferredProvider: 'anthropic', // Prefer Anthropic if available
      maxCost: 0.01, // Max $0.01 per request
    },
  });

  if ('choices' in response3) {
    console.log('Response:', response3.choices[0].message.content);
    console.log('Provider:', response3._gateway?.provider);
    console.log('Cost: $' + response3._gateway?.cost.toFixed(6));
  }

  // Example 4: Cache demonstration
  console.log('\n=== Example 4: Cache Demo ===');
  const cacheRequest = {
    model: 'gpt-5.4-mini',
    messages: [{ role: 'user' as const, content: 'Say "Hello, Cache!"' }],
    max_tokens: 20,
  };

  console.log('First request (cache miss)...');
  const first = await gateway.chat.completions.create(cacheRequest);
  if ('_gateway' in first) {
    console.log(
      'Cached:',
      first._gateway?.cached,
      '- Latency:',
      first._gateway?.latencyMs + 'ms',
    );
  }

  console.log('Second request (cache hit)...');
  const second = await gateway.chat.completions.create(cacheRequest);
  if ('_gateway' in second) {
    console.log(
      'Cached:',
      second._gateway?.cached,
      '- Latency:',
      second._gateway?.latencyMs + 'ms',
    );
  }

  // Print final metrics
  console.log('\n=== Gateway Metrics ===');
  const metrics = gateway.getMetrics();
  console.log('Total requests:', metrics.requests.total);
  console.log('Successful:', metrics.requests.successful);
  console.log('Cached:', metrics.requests.cached);
  console.log(
    'Cache hit rate:',
    (metrics.cache.hitRate * 100).toFixed(1) + '%',
  );
  console.log('Total cost: $' + metrics.cost.total.toFixed(6));
  console.log('Avg latency:', metrics.latency.avg.toFixed(0) + 'ms');

  // Shutdown
  gateway.shutdown();
}

main().catch(console.error);
