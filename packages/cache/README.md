# @lov3kaizen/agentsea-cache

Semantic caching layer for LLM responses. Reduces LLM costs by 30-50% through intelligent caching using exact match and semantic similarity.

## Features

- **Exact Match Caching** - Hash-based caching for identical requests
- **Semantic Matching** - Embedding-based similarity for semantically similar queries
- **Multiple Backends** - Memory, Redis, SQLite, Pinecone support
- **Cost Analytics** - Track tokens saved and cost reduction
- **Streaming Support** - Cache and replay streaming LLM responses
- **Multi-Tier Caching** - L1/L2/L3 cache hierarchy with promotion
- **AgentSea Integration** - CachedProvider and CacheMiddleware for agents
- **Gateway Integration** - Cache layer for LLM Gateway routing

## Installation

```bash
pnpm add @lov3kaizen/agentsea-cache
```

For semantic matching, also install:

```bash
pnpm add @lov3kaizen/agentsea-embeddings
```

## Quick Start

### Basic Exact Match Caching

```typescript
import {
  SemanticCache,
  MemoryCacheStore,
  ExactMatchStrategy,
} from '@lov3kaizen/agentsea-cache';

// Create cache with memory store and exact matching
const cache = new SemanticCache(
  {
    defaultTTL: 3600, // 1 hour
    matchStrategy: 'exact',
  },
  new MemoryCacheStore({ type: 'memory', maxEntries: 10000 }),
  new ExactMatchStrategy(),
);

// Wrap your LLM call
const response = await cache.wrap(
  {
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'What is the capital of France?' }],
  },
  async (request) => {
    // Your LLM call here
    return await openai.chat.completions.create(request);
  },
);

console.log('Cached:', response._cache?.hit);
```

### Semantic Matching (with Embeddings Package)

```typescript
import {
  SemanticCache,
  MemoryCacheStore,
  HybridMatchStrategy,
  SimilarityEngine,
} from '@lov3kaizen/agentsea-cache';
import { OpenAIProvider } from '@lov3kaizen/agentsea-embeddings';

// Create embedding provider
const embeddingProvider = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'text-embedding-3-small',
});

// Create similarity engine
const similarity = new SimilarityEngine({
  provider: embeddingProvider,
  cacheEmbeddings: true,
});

// Create cache with semantic matching
const cache = new SemanticCache(
  {
    defaultTTL: 3600,
    similarityThreshold: 0.92, // 92% similarity required
    matchStrategy: 'hybrid', // Try exact first, then semantic
  },
  new MemoryCacheStore({ type: 'memory' }),
  new HybridMatchStrategy(),
  similarity,
);

// Similar queries will hit cache
const response1 = await cache.wrap(
  {
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'What is the capital of France?' }],
  },
  llmCall,
);

// This will hit cache due to semantic similarity!
const response2 = await cache.wrap(
  {
    model: 'gpt-4o',
    messages: [{ role: 'user', content: "What's France's capital city?" }],
  },
  llmCall,
);

console.log('Second call cached:', response2._cache?.hit); // true
console.log('Similarity:', response2._cache?.similarity); // ~0.95
```

## Configuration

### SemanticCacheConfig

| Option                | Type    | Default   | Description                                      |
| --------------------- | ------- | --------- | ------------------------------------------------ |
| `defaultTTL`          | number  | 3600      | Default TTL in seconds (0 = no expiry)           |
| `similarityThreshold` | number  | 0.92      | Similarity threshold for semantic matching (0-1) |
| `maxEntries`          | number  | 10000     | Maximum cache entries                            |
| `matchStrategy`       | string  | 'hybrid'  | 'exact', 'semantic', or 'hybrid'                 |
| `namespace`           | string  | 'default' | Namespace for multi-tenant isolation             |
| `analyticsEnabled`    | boolean | true      | Enable analytics tracking                        |

### Store Options

#### MemoryStoreConfig

```typescript
{
  type: 'memory',
  maxEntries: 10000,
  maxSizeBytes: 1024 * 1024 * 1024, // 1GB
  evictionPolicy: 'lru'
}
```

#### RedisStoreConfig

```typescript
{
  type: 'redis',
  url: 'redis://localhost:6379',
  keyPrefix: 'llm-cache'
}
```

#### PineconeStoreConfig

```typescript
{
  type: 'pinecone',
  apiKey: process.env.PINECONE_API_KEY,
  index: 'llm-cache',
  namespace: 'production'
}
```

#### TieredStoreConfig

```typescript
{
  type: 'tiered',
  tiers: [
    { name: 'l1-memory', priority: 1, store: memoryStore, ttl: 300 },
    { name: 'l2-redis', priority: 2, store: redisStore, ttl: 3600 }
  ],
  writeThrough: true,
  promoteOnHit: true
}
```

## Analytics

Track cache performance and cost savings:

```typescript
// Get statistics
const stats = cache.getStats();
console.log(`Hit Rate: ${(stats.hitRate * 100).toFixed(1)}%`);
console.log(`Tokens Saved: ${stats.tokensSaved.toLocaleString()}`);
console.log(`Cost Savings: $${stats.costSavingsUSD.toFixed(2)}`);

// Get detailed analytics
const analytics = cache.getAnalytics();
const report = analytics.getCostSavingsReport();
console.log(`Reduction: ${report.reductionPercent.toFixed(1)}%`);
```

## API Reference

### SemanticCache

```typescript
class SemanticCache {
  // Wrap an LLM call with caching
  wrap<T>(request, fn, options?): Promise<T>;

  // Direct cache operations
  get(request, options?): Promise<CacheLookupResult>;
  set(request, response, options?): Promise<void>;
  delete(key): Promise<boolean>;
  clear(): Promise<void>;

  // Invalidation
  invalidateByPattern(pattern): Promise<number>;
  invalidateByTags(tags): Promise<number>;

  // Analytics
  getStats(): CacheStats;
  getAnalytics(): CacheAnalytics;

  // Health
  checkHealth(): Promise<StoreHealth>;
  close(): Promise<void>;
}
```

### WrapOptions

```typescript
interface WrapOptions {
  ttl?: number; // Custom TTL
  tags?: string[]; // Tags for grouping
  namespace?: string; // Namespace override
  skipCache?: boolean; // Bypass cache
  forceRefresh?: boolean; // Force update
}
```

## Streaming Cache

Cache and replay streaming LLM responses:

```typescript
import { StreamCache, MemoryCacheStore } from '@lov3kaizen/agentsea-cache';

const streamCache = new StreamCache(store, {
  minLengthToCache: 50,
  cacheIncomplete: false,
  streamTtl: 3600,
});

// Wrap streaming calls
const stream = streamCache.wrapStream('gpt-4o', messages, async function* () {
  for await (const chunk of llm.stream(request)) {
    yield chunk;
  }
});

// Cached streams are replayed transparently
for await (const chunk of stream) {
  process.stdout.write(chunk.content);
}
```

## AgentSea Integration

### CachedProvider

Wrap any LLM provider with caching:

```typescript
import { CachedProvider } from '@lov3kaizen/agentsea-cache';

const cachedProvider = new CachedProvider({
  provider: anthropicProvider,
  cache: semanticCache,
  skipModels: ['gpt-4-vision'], // Don't cache vision models
});

// Uses cache transparently
const response = await cachedProvider.complete({
  model: 'claude-sonnet-4-20250514',
  messages: [{ role: 'user', content: 'Hello' }],
});
```

### CacheMiddleware

Add caching to agent pipelines:

```typescript
import { CacheMiddleware } from '@lov3kaizen/agentsea-cache';

const middleware = new CacheMiddleware({
  cache: semanticCache,
  skipToolRequests: true, // Don't cache tool-using requests
  defaultTTL: 1800,
});

const response = await middleware.handle(request, next);
```

## Examples

See the `examples/` directory for complete examples:

- `basic-cache.ts` - Exact match caching
- `semantic-similarity.ts` - Semantic matching with embeddings
- `streaming-cache.ts` - Caching streaming responses
- `multi-tier.ts` - Multi-tier cache hierarchy
- `agentsea-integration.ts` - AgentSea CachedProvider and Middleware

## Roadmap

- [x] Phase 1: Core cache with exact matching
- [x] Phase 2: Semantic matching with embeddings
- [x] Phase 3: Streaming cache, multi-tier, invalidation
- [x] Phase 4: AgentSea and Gateway integrations

## License

MIT
