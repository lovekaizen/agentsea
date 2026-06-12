/**
 * Semantic Similarity Cache Example
 *
 * Demonstrates semantic caching using embeddings.
 * Similar queries return cached responses even if not identical.
 */

import {
  SemanticCache,
  MemoryCacheStore,
  HybridMatchStrategy,
  SimilarityEngine,
  type EmbeddingProvider,
} from '@lov3kaizen/agentsea-cache';

// Simulated embedding provider
// In production, use OpenAIProvider from @lov3kaizen/agentsea-embeddings
class MockEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions = 384;

  embed(text: string): Promise<number[]> {
    // Simple hash-based mock embedding
    const embedding = new Array(this.dimensions).fill(0);
    const normalized = text.toLowerCase().trim();

    for (let i = 0; i < normalized.length; i++) {
      const charCode = normalized.charCodeAt(i);
      const idx = (i * 7 + charCode) % this.dimensions;
      embedding[idx] += Math.sin(charCode) * 0.1;
    }

    // Normalize
    const magnitude = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0),
    );
    return Promise.resolve(embedding.map((val) => val / (magnitude || 1)));
  }
}

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
  console.log('=== Semantic Similarity Cache Example ===\n');

  // Create embedding provider and similarity engine
  const embeddingProvider = new MockEmbeddingProvider();
  const similarity = new SimilarityEngine({
    provider: embeddingProvider,
    metric: 'cosine',
    cacheEmbeddings: true,
  });

  // Create cache with hybrid matching (exact + semantic)
  const cache = new SemanticCache(
    {
      defaultTTL: 3600,
      similarityThreshold: 0.85, // 85% similarity required
      matchStrategy: 'hybrid',
      analyticsEnabled: true,
    },
    new MemoryCacheStore({ type: 'memory', maxEntries: 1000 }),
    new HybridMatchStrategy(),
    similarity,
  );

  // First request - cache miss
  console.log('1. First request (cache miss)...');
  const response1 = await cache.wrap(
    {
      model: 'gpt-5.5',
      messages: [{ role: 'user', content: 'What is the capital of France?' }],
    },
    async (request) =>
      simulateLLMCall(request.model, request.messages[0].content),
  );
  console.log(`   Cached: ${response1._cache?.hit}`);
  console.log(`   Response: "${response1.content}"\n`);

  // Similar query - should hit cache via semantic matching
  console.log('2. Similar query (semantic cache hit expected)...');
  const response2 = await cache.wrap(
    {
      model: 'gpt-5.5',
      messages: [{ role: 'user', content: "What's France's capital city?" }],
    },
    async (request) =>
      simulateLLMCall(request.model, request.messages[0].content),
  );
  console.log(`   Cached: ${response2._cache?.hit}`);
  console.log(
    `   Similarity: ${response2._cache?.similarity?.toFixed(3) ?? 'N/A'}`,
  );
  console.log(`   Response: "${response2.content}"\n`);

  // Very similar rephrasing
  console.log('3. Another rephrasing (semantic cache hit expected)...');
  const response3 = await cache.wrap(
    {
      model: 'gpt-5.5',
      messages: [{ role: 'user', content: 'Tell me the capital of France' }],
    },
    async (request) =>
      simulateLLMCall(request.model, request.messages[0].content),
  );
  console.log(`   Cached: ${response3._cache?.hit}`);
  console.log(
    `   Similarity: ${response3._cache?.similarity?.toFixed(3) ?? 'N/A'}`,
  );
  console.log(`   Response: "${response3.content}"\n`);

  // Different question - should be cache miss
  console.log('4. Completely different query (cache miss expected)...');
  const response4 = await cache.wrap(
    {
      model: 'gpt-5.5',
      messages: [{ role: 'user', content: 'How do I make pancakes?' }],
    },
    async (request) =>
      simulateLLMCall(request.model, request.messages[0].content),
  );
  console.log(`   Cached: ${response4._cache?.hit}`);
  console.log(`   Response: "${response4.content}"\n`);

  // Statistics
  const stats = cache.getStats();
  console.log('=== Cache Statistics ===');
  console.log(`Exact Hits: ${stats.exactHits}`);
  console.log(`Semantic Hits: ${stats.semanticHits}`);
  console.log(`Misses: ${stats.misses}`);
  console.log(`Hit Rate: ${(stats.hitRate * 100).toFixed(1)}%`);
  console.log(`Avg Similarity: ${stats.avgSimilarity.toFixed(3)}`);

  // Cleanup
  await cache.close();
}

main().catch(console.error);
