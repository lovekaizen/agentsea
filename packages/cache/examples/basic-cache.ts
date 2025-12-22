/**
 * Basic Cache Example
 *
 * Demonstrates exact-match caching for LLM responses.
 * Reduces costs by caching identical requests.
 */

import {
  SemanticCache,
  MemoryCacheStore,
  ExactMatchStrategy,
} from '@lov3kaizen/agentsea-cache';

// Simulated LLM client
interface LLMResponse {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: string;
}

async function simulateLLMCall(
  model: string,
  message: string,
): Promise<LLMResponse> {
  // Simulate API latency
  await new Promise((resolve) => setTimeout(resolve, 500));

  return {
    content: `This is a simulated response for: "${message}"`,
    model,
    usage: {
      promptTokens: message.split(' ').length * 2,
      completionTokens: 50,
      totalTokens: message.split(' ').length * 2 + 50,
    },
    finishReason: 'stop',
  };
}

async function main() {
  console.log('=== Basic Exact Match Cache Example ===\n');

  // Create cache with memory store and exact matching
  const cache = new SemanticCache(
    {
      defaultTTL: 3600, // 1 hour
      matchStrategy: 'exact',
      analyticsEnabled: true,
    },
    new MemoryCacheStore({ type: 'memory', maxEntries: 1000 }),
    new ExactMatchStrategy(),
  );

  // First request - cache miss
  console.log('1. Making first request (cache miss expected)...');
  const startTime1 = performance.now();

  const response1 = await cache.wrap(
    {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'What is the capital of France?' }],
    },
    async (request) => {
      return simulateLLMCall(request.model, request.messages[0].content);
    },
  );

  const duration1 = performance.now() - startTime1;
  console.log(`   Response: "${response1.content}"`);
  console.log(`   Cached: ${response1._cache?.hit ?? false}`);
  console.log(`   Duration: ${duration1.toFixed(0)}ms\n`);

  // Second request - same query, cache hit
  console.log('2. Making identical request (cache hit expected)...');
  const startTime2 = performance.now();

  const response2 = await cache.wrap(
    {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'What is the capital of France?' }],
    },
    async (request) => {
      return simulateLLMCall(request.model, request.messages[0].content);
    },
  );

  const duration2 = performance.now() - startTime2;
  console.log(`   Response: "${response2.content}"`);
  console.log(`   Cached: ${response2._cache?.hit ?? false}`);
  console.log(`   Duration: ${duration2.toFixed(0)}ms\n`);

  // Third request - different query, cache miss
  console.log('3. Making different request (cache miss expected)...');
  const startTime3 = performance.now();

  const response3 = await cache.wrap(
    {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'What is the capital of Germany?' }],
    },
    async (request) => {
      return simulateLLMCall(request.model, request.messages[0].content);
    },
  );

  const duration3 = performance.now() - startTime3;
  console.log(`   Response: "${response3.content}"`);
  console.log(`   Cached: ${response3._cache?.hit ?? false}`);
  console.log(`   Duration: ${duration3.toFixed(0)}ms\n`);

  // Get cache statistics
  const stats = cache.getStats();
  console.log('=== Cache Statistics ===');
  console.log(`Total Entries: ${stats.entries}`);
  console.log(`Hits: ${stats.hits}`);
  console.log(`Misses: ${stats.misses}`);
  console.log(`Hit Rate: ${(stats.hitRate * 100).toFixed(1)}%`);
  console.log(`Tokens Saved: ${stats.tokensSaved}`);
  console.log(`Cost Savings: $${stats.costSavingsUSD.toFixed(4)}`);

  // Cleanup
  await cache.close();
}

main().catch(console.error);
