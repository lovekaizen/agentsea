/**
 * Multi-Tier Cache Example
 *
 * Demonstrates hierarchical caching with multiple storage tiers.
 * L1: Fast in-memory cache (small, fast)
 * L2: Larger memory cache (bigger, slightly slower)
 *
 * In production, you might use:
 * L1: Memory (hot cache)
 * L2: Redis (shared cache)
 * L3: Pinecone (semantic search at scale)
 */

import {
  SemanticCache,
  TieredCacheStore,
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
  await new Promise((resolve) => setTimeout(resolve, 500));

  return {
    content: `Response for: "${message}"`,
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
  console.log('=== Multi-Tier Cache Example ===\n');

  // Create tier stores
  const l1Store = new MemoryCacheStore({
    type: 'memory',
    maxEntries: 100, // Small, fast cache
  });

  const l2Store = new MemoryCacheStore({
    type: 'memory',
    maxEntries: 1000, // Larger cache
  });

  // Create tiered store
  const tieredStore = new TieredCacheStore({
    type: 'tiered',
    tiers: [
      {
        name: 'l1-memory',
        priority: 1,
        store: l1Store,
        ttl: 300, // 5 minutes
        maxSize: 100,
      },
      {
        name: 'l2-memory',
        priority: 2,
        store: l2Store,
        ttl: 3600, // 1 hour
        maxSize: 1000,
      },
    ],
    writeThrough: true, // Write to all tiers
    promoteOnHit: true, // Promote L2 hits to L1
    promotionThreshold: 2, // Promote after 2 hits
  });

  // Create semantic cache with tiered store
  const cache = new SemanticCache(
    {
      defaultTTL: 3600,
      matchStrategy: 'exact',
      analyticsEnabled: true,
    },
    tieredStore,
    new ExactMatchStrategy(),
  );

  console.log('Tier Configuration:');
  console.log('  L1: In-memory (100 entries, 5 min TTL)');
  console.log('  L2: In-memory (1000 entries, 1 hour TTL)');
  console.log('  Write-through: enabled');
  console.log('  Promotion on hit: enabled\n');

  // First request - cache miss, writes to both tiers
  console.log('1. First request (writes to all tiers)...');
  const response1 = await cache.wrap(
    {
      model: 'gpt-5.5',
      messages: [{ role: 'user', content: 'What is cloud computing?' }],
    },
    async (request) =>
      simulateLLMCall(request.model, request.messages[0].content),
  );
  console.log(`   Cached: ${response1._cache?.hit}`);

  // Check tier sizes
  const l1Size = await l1Store.size();
  const l2Size = await l2Store.size();
  console.log(`   L1 size: ${l1Size}, L2 size: ${l2Size}\n`);

  // Second request - should hit L1 (fastest)
  console.log('2. Same request (L1 hit expected)...');
  const startTime = performance.now();
  const response2 = await cache.wrap(
    {
      model: 'gpt-5.5',
      messages: [{ role: 'user', content: 'What is cloud computing?' }],
    },
    async (request) =>
      simulateLLMCall(request.model, request.messages[0].content),
  );
  const duration = performance.now() - startTime;
  console.log(`   Cached: ${response2._cache?.hit}`);
  console.log(`   Lookup time: ${duration.toFixed(2)}ms\n`);

  // Add more entries to demonstrate tier behavior
  console.log('3. Adding multiple entries...');
  for (let i = 0; i < 5; i++) {
    await cache.wrap(
      {
        model: 'gpt-5.5',
        messages: [{ role: 'user', content: `Question number ${i}` }],
      },
      async (request) =>
        simulateLLMCall(request.model, request.messages[0].content),
    );
  }

  // Check tier sizes again
  const l1SizeAfter = await l1Store.size();
  const l2SizeAfter = await l2Store.size();
  console.log(`   L1 size: ${l1SizeAfter}, L2 size: ${l2SizeAfter}\n`);

  // Statistics
  const stats = cache.getStats();
  console.log('=== Cache Statistics ===');
  console.log(`Total Entries: ${stats.entries}`);
  console.log(`Hits: ${stats.hits}`);
  console.log(`Misses: ${stats.misses}`);
  console.log(`Hit Rate: ${(stats.hitRate * 100).toFixed(1)}%`);

  // Tiered store metrics
  const tieredMetrics = tieredStore.getMetrics();
  console.log('\n=== Tier Metrics ===');
  console.log(`Gets: ${tieredMetrics.gets}`);
  console.log(`Sets: ${tieredMetrics.sets}`);
  console.log(`Hits: ${tieredMetrics.hits}`);
  console.log(`Misses: ${tieredMetrics.misses}`);

  // Cleanup
  await cache.close();
}

main().catch(console.error);
