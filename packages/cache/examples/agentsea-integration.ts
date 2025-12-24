/**
 * AgentSea Integration Example
 *
 * Demonstrates using the cache with AgentSea agents via:
 * - CachedProvider: Wrap any LLM provider with caching
 * - CacheMiddleware: Add caching to agent pipelines
 */

import {
  SemanticCache,
  MemoryCacheStore,
  ExactMatchStrategy,
  CachedProvider,
  CacheMiddleware,
  type CacheMessage,
} from '@lov3kaizen/agentsea-cache';

// Simulated LLM provider (in production, use @lov3kaizen/agentsea-core providers)
const mockProvider = {
  async complete(request: {
    model: string;
    messages: CacheMessage[];
  }): Promise<{
    content: string;
    model: string;
    finishReason: string;
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  }> {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return {
      content: `Response for: "${request.messages[0].content}"`,
      model: request.model,
      finishReason: 'stop',
      usage: { promptTokens: 10, completionTokens: 50, totalTokens: 60 },
    };
  },
};

async function demonstrateCachedProvider() {
  console.log('=== CachedProvider Example ===\n');

  // Create cache
  const cache = new SemanticCache(
    { defaultTTL: 3600, matchStrategy: 'exact' },
    new MemoryCacheStore({ type: 'memory' }),
    new ExactMatchStrategy(),
  );

  // Wrap provider with cache
  const cachedProvider = new CachedProvider({
    provider: mockProvider,
    cache,
    skipModels: ['gpt-4-vision'], // Don't cache vision models
  });

  // First call - cache miss
  console.log('1. First call (cache miss)...');
  const response1 = await cachedProvider.complete({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'Hello, world!' }],
  });
  console.log(`   Content: "${response1.content}"`);

  // Second call - cache hit
  console.log('2. Same call (cache hit)...');
  const response2 = await cachedProvider.complete({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'Hello, world!' }],
  });
  console.log(`   Content: "${response2.content}"`);

  // Get stats
  const stats = cachedProvider.getCacheStats();
  console.log(`\n   Hit Rate: ${(stats.hitRate * 100).toFixed(1)}%`);
  console.log(`   Tokens Saved: ${stats.tokensSaved}\n`);

  await cache.close();
}

async function demonstrateCacheMiddleware() {
  console.log('=== CacheMiddleware Example ===\n');

  // Create cache
  const cache = new SemanticCache(
    { defaultTTL: 3600, matchStrategy: 'exact' },
    new MemoryCacheStore({ type: 'memory' }),
    new ExactMatchStrategy(),
  );

  // Create middleware
  const middleware = new CacheMiddleware({
    cache,
    skipToolRequests: true, // Don't cache tool-using requests
    defaultTTL: 1800,
    tagPrefix: 'my-agent',
  });

  // Simulated next handler (the actual LLM call)
  const next = async (request: { model: string; messages: CacheMessage[] }) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return {
      content: `Processed: "${request.messages[0].content}"`,
      model: request.model,
      finishReason: 'stop',
    };
  };

  // First request through middleware
  console.log('1. First request through middleware (cache miss)...');
  const response1 = await middleware.handle(
    {
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: 'Explain caching' }],
    },
    next,
  );
  console.log(`   Content: "${response1.content}"`);

  // Same request - cache hit
  console.log('2. Same request (cache hit)...');
  const response2 = await middleware.handle(
    {
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: 'Explain caching' }],
    },
    next,
  );
  console.log(`   Content: "${response2.content}"`);

  // Request with tools - should skip cache
  console.log('3. Request with tools (cache skipped)...');
  const response3 = await middleware.handle(
    {
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: 'Search the web' }],
      tools: [{ name: 'web_search' }],
    },
    next,
  );
  console.log(`   Content: "${response3.content}"`);
  console.log(`   (Tools request bypassed cache)\n`);

  // Get stats
  const stats = cache.getStats();
  console.log(`   Hit Rate: ${(stats.hitRate * 100).toFixed(1)}%`);
  console.log(`   Exact Hits: ${stats.exactHits}`);

  await cache.close();
}

async function main() {
  await demonstrateCachedProvider();
  console.log('---\n');
  await demonstrateCacheMiddleware();
}

main().catch(console.error);
