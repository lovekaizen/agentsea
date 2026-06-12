/**
 * Multi-Provider Routing Example
 *
 * This example demonstrates different routing strategies
 * across multiple LLM providers.
 *
 * Run: npx ts-node examples/multi-provider.ts
 */

import {
  Gateway,
  RoundRobinStrategy,
  FailoverStrategy,
  CostOptimizedStrategy,
  LatencyOptimizedStrategy,
} from '../src/index.js';

async function main() {
  // Create gateway with all major providers
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
      {
        name: 'google',
        apiKey: process.env.GOOGLE_API_KEY,
        models: ['gemini-3.1-pro-preview', 'gemini-3.5-flash'],
      },
    ],
    routing: {
      strategy: 'round-robin', // Default strategy
      fallbackChain: ['openai', 'anthropic', 'google'],
    },
  });

  const testMessage = {
    messages: [
      { role: 'user' as const, content: 'Say "Hello from [provider]!"' },
    ],
    max_tokens: 20,
  };

  // Test 1: Round-Robin Strategy
  console.log('=== Round-Robin Strategy ===');
  console.log('Distributes requests evenly across providers\n');

  const router = gateway.getRouter();
  router.setStrategy(new RoundRobinStrategy());

  for (let i = 0; i < 3; i++) {
    const response = await gateway.chat.completions.create({
      model: 'gpt-5.4-mini', // Will be mapped to equivalent on each provider
      ...testMessage,
    });

    if ('_gateway' in response) {
      console.log(
        `Request ${i + 1}: ${response._gateway?.provider} (${response.model})`,
      );
    }
  }

  // Test 2: Failover Strategy
  console.log('\n=== Failover Strategy ===');
  console.log('Tries providers in order until one succeeds\n');

  router.setStrategy(
    new FailoverStrategy({
      chain: ['openai', 'anthropic', 'google'],
      modelMappings: {
        'gpt-5.4-mini': {
          anthropic: 'claude-haiku-4-5',
          google: 'gemini-3.5-flash',
        },
      },
    }),
  );

  const failoverResponse = await gateway.chat.completions.create({
    model: 'gpt-5.4-mini',
    ...testMessage,
  });

  if ('_gateway' in failoverResponse) {
    console.log(`Routed to: ${failoverResponse._gateway?.provider}`);
    console.log(
      `Reason: ${failoverResponse._gateway?.routingDecision?.reason}`,
    );
  }

  // Test 3: Cost-Optimized Strategy
  console.log('\n=== Cost-Optimized Strategy ===');
  console.log('Selects the cheapest model that meets quality threshold\n');

  router.setStrategy(
    new CostOptimizedStrategy({
      qualityThreshold: 0.7,
      preferLocal: false,
    }),
  );

  const costResponse = await gateway.chat.completions.create({
    model: 'cheapest',
    ...testMessage,
  });

  if ('_gateway' in costResponse) {
    console.log(
      `Selected: ${costResponse._gateway?.provider}/${costResponse.model}`,
    );
    console.log(`Cost: $${costResponse._gateway?.cost.toFixed(6)}`);
    console.log(`Reason: ${costResponse._gateway?.routingDecision?.reason}`);
  }

  // Test 4: Latency-Optimized Strategy
  console.log('\n=== Latency-Optimized Strategy ===');
  console.log('Selects the fastest provider based on observed latencies\n');

  const latencyStrategy = new LatencyOptimizedStrategy({
    adaptiveRouting: true,
    warmupRequests: 3,
  });
  router.setStrategy(latencyStrategy);

  // Make a few requests to gather latency data
  console.log('Warming up...');
  for (let i = 0; i < 3; i++) {
    await gateway.chat.completions.create({
      model: 'fastest',
      ...testMessage,
    });
  }

  // Now make a request with learned latencies
  const latencyResponse = await gateway.chat.completions.create({
    model: 'fastest',
    ...testMessage,
  });

  if ('_gateway' in latencyResponse) {
    console.log(
      `Selected: ${latencyResponse._gateway?.provider}/${latencyResponse.model}`,
    );
    console.log(`Latency: ${latencyResponse._gateway?.latencyMs}ms`);
    console.log(`Reason: ${latencyResponse._gateway?.routingDecision?.reason}`);
  }

  // Print final stats
  console.log('\n=== Final Statistics ===');
  const metrics = gateway.getMetrics();
  console.log('Total requests:', metrics.requests.total);
  console.log('Cost by provider:');
  for (const [provider, cost] of Object.entries(metrics.cost.byProvider)) {
    console.log(`  ${provider}: $${cost.toFixed(6)}`);
  }

  gateway.shutdown();
}

main().catch(console.error);
