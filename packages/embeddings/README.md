# @lov3kaizen/agentsea-embeddings

Vector embedding lifecycle management toolkit for Node.js. Handles versioning, caching, chunking, drift detection, and migration across embedding models.

## Features

- **Multiple Providers**: OpenAI, Cohere, Voyage AI, HuggingFace, and local models
- **Smart Chunking**: Fixed, recursive, semantic, markdown-aware, and code-aware strategies
- **Multi-tier Caching**: Memory, Redis, SQLite, and tiered caching
- **Version Management**: Track embedding versions and plan migrations
- **Drift Detection**: Monitor embedding quality and detect distribution drift
- **Vector Stores**: Pinecone, Chroma, Qdrant, and in-memory adapters

## Installation

```bash
npm install @lov3kaizen/agentsea-embeddings
# or
pnpm add @lov3kaizen/agentsea-embeddings
```

## Quick Start

### Basic Embedding

```typescript
import {
  createEmbeddingManager,
  createOpenAIProvider,
  createMemoryCache,
  createMemoryStore,
} from '@lov3kaizen/agentsea-embeddings';

// Create provider
const provider = createOpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'text-embedding-3-small',
});

// Create manager
const manager = createEmbeddingManager({
  defaultModel: 'text-embedding-3-small',
  defaultProvider: 'openai',
});

// Register provider and configure
manager.registerModel(provider, true);
manager.setCache(createMemoryCache());
manager.setStore(createMemoryStore({ type: 'memory', dimensions: 1536 }));

// Generate embedding
const result = await manager.embed('Hello, world!');
console.log('Dimensions:', result.dimensions);
console.log('Tokens:', result.tokenCount);

// Batch embedding
const batchResult = await manager.embedBatch([
  'First document',
  'Second document',
  'Third document',
]);
console.log('Embedded:', batchResult.results.length, 'documents');
```

### Document Chunking & Embedding

```typescript
import {
  createEmbeddingManager,
  createOpenAIProvider,
  createRecursiveChunker,
} from '@lov3kaizen/agentsea-embeddings';

const manager = createEmbeddingManager();
const provider = createOpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY!,
});

manager.registerModel(provider, true);
manager.setChunker(createRecursiveChunker());

// Embed a long document
const document = `
# Introduction

This is a long document that needs to be chunked...

## Section 1

Content for section 1...

## Section 2

Content for section 2...
`;

const chunks = await manager.embedDocument(document, {
  documentId: 'doc-1',
  source: 'example.md',
  type: 'markdown',
});

console.log('Created', chunks.length, 'chunks');
```

### Semantic Search

```typescript
const results = await manager.search('What is the main topic?', {
  topK: 5,
  minScore: 0.7,
});

for (const result of results) {
  console.log(`[${result.score.toFixed(3)}] ${result.text.slice(0, 100)}...`);
}
```

## Providers

### OpenAI

```typescript
import { createOpenAIProvider } from '@lov3kaizen/agentsea-embeddings';

const provider = createOpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'text-embedding-3-small', // or 'text-embedding-3-large', 'text-embedding-ada-002'
  dimensions: 1536, // optional dimension reduction for v3 models
});
```

### Cohere

```typescript
import { createCohereProvider } from '@lov3kaizen/agentsea-embeddings';

const provider = createCohereProvider({
  apiKey: process.env.COHERE_API_KEY!,
  model: 'embed-english-v3.0',
  inputType: 'search_document', // or 'search_query', 'classification', 'clustering'
});
```

### Voyage AI

```typescript
import { createVoyageProvider } from '@lov3kaizen/agentsea-embeddings';

const provider = createVoyageProvider({
  apiKey: process.env.VOYAGE_API_KEY!,
  model: 'voyage-3', // or 'voyage-code-3', 'voyage-finance-2', etc.
});
```

### HuggingFace

```typescript
import { createHuggingFaceProvider } from '@lov3kaizen/agentsea-embeddings';

const provider = createHuggingFaceProvider({
  apiKey: process.env.HF_API_KEY!,
  model: 'sentence-transformers/all-MiniLM-L6-v2',
});
```

### Local/Custom

```typescript
import { createLocalProvider } from '@lov3kaizen/agentsea-embeddings';

const provider = createLocalProvider({
  dimensions: 384,
  name: 'custom-model',
  embedFn: async (texts) => {
    // Your custom embedding logic
    return texts.map((text) => new Array(384).fill(0).map(() => Math.random()));
  },
});
```

## Chunking Strategies

### Fixed Size

```typescript
import { createFixedChunker } from '@lov3kaizen/agentsea-embeddings';

const chunker = createFixedChunker();
const chunks = await chunker.chunk(text, {
  chunkSize: 512,
  chunkOverlap: 50,
});
```

### Recursive

```typescript
import { createRecursiveChunker } from '@lov3kaizen/agentsea-embeddings';

const chunker = createRecursiveChunker();
const chunks = await chunker.chunk(text, {
  chunkSize: 512,
  separators: ['\n\n', '\n', '. ', ' '],
});
```

### Markdown-Aware

```typescript
import { createMarkdownChunker } from '@lov3kaizen/agentsea-embeddings';

const chunker = createMarkdownChunker();
const chunks = await chunker.chunk(markdownText, {
  preserveHeaders: true,
  includeHeaderHierarchy: true,
});
```

### Code-Aware

```typescript
import { createCodeChunker } from '@lov3kaizen/agentsea-embeddings';

const chunker = createCodeChunker();
const chunks = await chunker.chunk(sourceCode, {
  language: 'typescript',
  splitBy: 'function',
  includeImports: true,
});
```

### Semantic

```typescript
import { createSemanticChunker } from '@lov3kaizen/agentsea-embeddings';

const chunker = createSemanticChunker();
const chunks = await chunker.chunk(text, {
  similarityThreshold: 0.5,
  embeddingFn: async (texts) =>
    provider.embedBatch(texts).then((r) => r.results.map((e) => e.vector)),
});
```

## Caching

### Memory Cache

```typescript
import { createMemoryCache } from '@lov3kaizen/agentsea-embeddings';

const cache = createMemoryCache({
  maxEntries: 10000,
  maxAge: 3600000, // 1 hour
});
```

### Redis Cache

```typescript
import { createRedisCache } from '@lov3kaizen/agentsea-embeddings';

const cache = createRedisCache({
  url: 'redis://localhost:6379',
  keyPrefix: 'emb',
  defaultTTL: 86400, // 24 hours
});

await cache.connect();
```

### SQLite Cache

```typescript
import { createSQLiteCache } from '@lov3kaizen/agentsea-embeddings';

const cache = createSQLiteCache({
  dbPath: './embeddings.db',
  walMode: true,
});

await cache.init();
```

### Tiered Cache

```typescript
import { createStandardTieredCache } from '@lov3kaizen/agentsea-embeddings';

const cache = createStandardTieredCache({
  memoryMaxEntries: 1000,
  persistentPath: './embeddings.db',
});
```

## Vector Stores

### Memory Store

```typescript
import { createMemoryStore } from '@lov3kaizen/agentsea-embeddings';

const store = createMemoryStore({
  dimensions: 1536,
  metric: 'cosine',
});
```

### Pinecone

```typescript
import { createPineconeStore } from '@lov3kaizen/agentsea-embeddings';

const store = createPineconeStore({
  apiKey: process.env.PINECONE_API_KEY!,
  indexName: 'my-index',
  namespace: 'default',
});

await store.init();
```

### Chroma

```typescript
import { createChromaStore } from '@lov3kaizen/agentsea-embeddings';

const store = createChromaStore({
  url: 'http://localhost:8000',
  collectionName: 'my-collection',
});

await store.init();
```

### Qdrant

```typescript
import { createQdrantStore } from '@lov3kaizen/agentsea-embeddings';

const store = createQdrantStore({
  url: 'http://localhost:6333',
  collectionName: 'my-collection',
  dimensions: 1536,
});

await store.init();
```

## Version Management

```typescript
import { createVersionRegistry } from '@lov3kaizen/agentsea-embeddings';

const registry = createVersionRegistry();

// Register versions
const v1 = registry.register({
  name: 'v1',
  provider: 'openai',
  model: 'text-embedding-ada-002',
  dimensions: 1536,
});

const v2 = registry.register({
  name: 'v2',
  provider: 'openai',
  model: 'text-embedding-3-small',
  dimensions: 1536,
});

// Activate version
registry.activate(v2.id);

// Compare versions
const comparison = registry.compare(v1.id, v2.id);
console.log('Migration required:', comparison.migrationRequired);

// Deprecate old version
registry.deprecate(v1.id, 'Replaced by v2', v2.id);
```

## Drift Detection

```typescript
import { createDriftDetector } from '@lov3kaizen/agentsea-embeddings';

const detector = createDriftDetector({
  driftThreshold: 0.1,
  alertSeverity: 'medium',
});

// Set reference distribution
const referenceEmbeddings = await manager.embedBatch(referenceTexts);
detector.setReference(
  referenceEmbeddings.results.map((r) => r.vector),
  'text-embedding-3-small',
);

// Monitor for drift
detector.on('drift:detected', (result) => {
  console.log('Drift detected!', result.severity, result.driftScore);
});

// Add samples for monitoring
for (const embedding of newEmbeddings) {
  detector.addSample(embedding.vector);
}

// Or detect manually
const currentEmbeddings = await manager.embedBatch(currentTexts);
const driftResult = detector.detect(
  currentEmbeddings.results.map((r) => r.vector),
);
```

## API Reference

### EmbeddingManager

- `registerModel(model, isDefault?)` - Register an embedding model
- `embed(text, options?)` - Embed a single text
- `embedBatch(texts, options?)` - Embed multiple texts
- `embedDocument(text, options?)` - Chunk and embed a document
- `search(query, options?)` - Search for similar content
- `similarity(text1, text2)` - Calculate similarity between texts
- `setCache(cache)` - Set cache implementation
- `setChunker(chunker)` - Set chunker implementation
- `setStore(store)` - Set store implementation
- `getStats()` - Get embedding statistics

### Providers

All providers implement:

- `embed(text, options?)` - Embed single text
- `embedBatch(texts, options?)` - Batch embedding
- `countTokens(text)` - Count tokens
- `getMetrics()` - Get provider metrics
- `getHealth()` - Check provider health

### Chunkers

All chunkers implement:

- `chunk(text, options?)` - Chunk text
- `chunkWithResult(text, options?)` - Chunk with metadata

### Caches

All caches implement:

- `get(key)` - Get cached embedding
- `set(key, entry)` - Cache embedding
- `has(key)` - Check if key exists
- `delete(key)` - Delete entry
- `clear()` - Clear all entries
- `lookup(key)` - Lookup with stats
- `getStats()` - Get cache statistics

### Stores

All stores implement:

- `upsert(records, options?)` - Upsert vectors
- `query(vector, options?)` - Query similar vectors
- `delete(ids, options?)` - Delete vectors
- `deleteAll(options?)` - Delete all vectors
- `getStats()` - Get store statistics
- `checkHealth()` - Check store health

## License

MIT
