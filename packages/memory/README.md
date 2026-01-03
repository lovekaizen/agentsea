# @lov3kaizen/agentsea-memory

Advanced memory management system for AI agents with semantic retrieval, hierarchical structures, and multi-agent support. Build agents with persistent, intelligent memory that can recall relevant context across conversations.

## Features

- **Multiple Backends** - Buffer, Redis, PostgreSQL, SQLite, and Pinecone support
- **Memory Structures** - Episodic, Semantic, and Working memory patterns
- **Smart Retrieval** - Recency, relevance, and importance-based strategies
- **Multi-Agent Sharing** - Share memories between agents with access control
- **Processing Pipeline** - Consolidation, summarization, and forgetting
- **Debug Tools** - Inspect and visualize memory state

## Installation

```bash
pnpm add @lov3kaizen/agentsea-memory
```

Optional backends:

```bash
# For Redis
pnpm add ioredis

# For PostgreSQL
pnpm add pg

# For SQLite
pnpm add better-sqlite3

# For Pinecone vector store
pnpm add @pinecone-database/pinecone
```

## Quick Start

```typescript
import {
  MemoryManager,
  BufferMemoryStore,
  RecencyRetrieval,
} from '@lov3kaizen/agentsea-memory';

// Create memory store
const store = new BufferMemoryStore({
  maxEntries: 1000,
});

// Create retrieval strategy
const retrieval = new RecencyRetrieval({
  maxResults: 10,
  decayFactor: 0.95,
});

// Create memory manager
const memory = new MemoryManager({
  store,
  retrieval,
});

// Add memories
await memory.add({
  content: 'User prefers dark mode',
  type: 'preference',
  importance: 0.8,
  metadata: { category: 'ui' },
});

// Retrieve relevant memories
const results = await memory.retrieve('What are the user settings?');
```

## Memory Stores

### Buffer Memory (In-Memory)

Fast, ephemeral storage for development and testing:

```typescript
import { BufferMemoryStore } from '@lov3kaizen/agentsea-memory/stores';

const store = new BufferMemoryStore({
  maxEntries: 1000,
  ttl: 3600000, // 1 hour
});
```

### Redis Memory

Distributed memory with persistence:

```typescript
import { RedisMemoryStore } from '@lov3kaizen/agentsea-memory/stores';

const store = new RedisMemoryStore({
  host: 'localhost',
  port: 6379,
  keyPrefix: 'agent:memory:',
  ttl: 86400, // 1 day
});
```

### PostgreSQL Memory

Relational storage with complex queries:

```typescript
import { PostgresMemoryStore } from '@lov3kaizen/agentsea-memory/stores';

const store = new PostgresMemoryStore({
  connectionString: process.env.DATABASE_URL,
  tableName: 'agent_memories',
});

await store.initialize(); // Creates table if not exists
```

### SQLite Memory

Local file-based persistence:

```typescript
import { SQLiteMemoryStore } from '@lov3kaizen/agentsea-memory/stores';

const store = new SQLiteMemoryStore({
  filename: './agent-memory.db',
  tableName: 'memories',
});
```

### Pinecone Memory (Vector)

Semantic search with embeddings:

```typescript
import { PineconeMemoryStore } from '@lov3kaizen/agentsea-memory/stores';
import { OpenAIEmbeddings } from '@lov3kaizen/agentsea-embeddings';

const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY,
});

const store = new PineconeMemoryStore({
  apiKey: process.env.PINECONE_API_KEY,
  environment: 'us-east-1',
  indexName: 'agent-memories',
  embeddings,
});
```

## Memory Structures

### Episodic Memory

Event-based memories with temporal context:

```typescript
import { EpisodicMemory } from '@lov3kaizen/agentsea-memory/structures';

const episodic = new EpisodicMemory({
  store,
  maxEpisodes: 100,
});

// Record an episode
await episodic.recordEpisode({
  event: 'user_interaction',
  participants: ['user-123', 'agent'],
  content: 'Discussed project requirements',
  timestamp: new Date(),
  metadata: { sentiment: 'positive' },
});

// Query episodes
const episodes = await episodic.queryEpisodes({
  timeRange: { start: lastWeek, end: now },
  participants: ['user-123'],
});
```

### Semantic Memory

Fact-based knowledge storage:

```typescript
import { SemanticMemory } from '@lov3kaizen/agentsea-memory/structures';

const semantic = new SemanticMemory({
  store,
  embeddings,
});

// Store facts
await semantic.addFact({
  subject: 'TypeScript',
  predicate: 'is',
  object: 'a typed superset of JavaScript',
  confidence: 0.95,
});

// Query by concept
const facts = await semantic.queryByConcept('TypeScript');
```

### Working Memory

Short-term active memory:

```typescript
import { WorkingMemory } from '@lov3kaizen/agentsea-memory/structures';

const working = new WorkingMemory({
  capacity: 7, // Miller's law
  decayRate: 0.1,
});

// Add to working memory
await working.focus({
  content: 'Current task: debugging API',
  priority: 'high',
});

// Get active items
const active = working.getActiveItems();
```

## Retrieval Strategies

### Recency-Based

Prioritize recent memories:

```typescript
import { RecencyRetrieval } from '@lov3kaizen/agentsea-memory/retrieval';

const retrieval = new RecencyRetrieval({
  maxResults: 10,
  decayFactor: 0.95, // Exponential decay
});
```

### Relevance-Based

Semantic similarity matching:

```typescript
import { RelevanceRetrieval } from '@lov3kaizen/agentsea-memory/retrieval';

const retrieval = new RelevanceRetrieval({
  embeddings,
  similarityThreshold: 0.7,
  maxResults: 20,
});
```

### Importance-Based

Priority by assigned importance:

```typescript
import { ImportanceRetrieval } from '@lov3kaizen/agentsea-memory/retrieval';

const retrieval = new ImportanceRetrieval({
  importanceThreshold: 0.5,
  maxResults: 15,
});
```

### Hybrid Retrieval

Combine multiple strategies:

```typescript
import { HybridRetrieval } from '@lov3kaizen/agentsea-memory/retrieval';

const retrieval = new HybridRetrieval({
  strategies: [
    { strategy: recency, weight: 0.3 },
    { strategy: relevance, weight: 0.5 },
    { strategy: importance, weight: 0.2 },
  ],
});
```

## Multi-Agent Memory Sharing

### Access Control

```typescript
import { AccessControl } from '@lov3kaizen/agentsea-memory/sharing';

const access = new AccessControl({
  defaultPermission: 'read',
  strictMode: false,
});

// Grant permissions
access.grantPermission('admin', 'agent-2', '*', 'write');
access.grantPermission('admin', 'agent-3', 'facts:*', 'read');

// Check access
const canWrite = access.hasPermission('agent-2', 'memory-123', 'write');
```

### Shared Memory Pool

```typescript
import { SharedMemoryPool } from '@lov3kaizen/agentsea-memory/sharing';

const pool = new SharedMemoryPool({
  store,
  accessControl: access,
});

// Share memory between agents
await pool.share('agent-1', 'memory-123', ['agent-2', 'agent-3']);

// Read shared memory
const memories = await pool.getShared('agent-2');
```

## Memory Processing

### Consolidation

Merge similar memories:

```typescript
import { MemoryConsolidator } from '@lov3kaizen/agentsea-memory/processing';

const consolidator = new MemoryConsolidator({
  similarityThreshold: 0.85,
  minGroupSize: 3,
});

// Consolidate similar memories
await consolidator.consolidate(store);
```

### Summarization

Compress memories using LLM:

```typescript
import { MemorySummarizer } from '@lov3kaizen/agentsea-memory/processing';

const summarizer = new MemorySummarizer({
  provider: anthropicProvider,
  maxTokens: 500,
});

// Summarize old memories
await summarizer.summarize(store, {
  olderThan: oneWeekAgo,
  minEntries: 10,
});
```

### Forgetting

Remove low-importance or old memories:

```typescript
import { ForgetPolicy } from '@lov3kaizen/agentsea-memory/processing';

const policy = new ForgetPolicy({
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  minImportance: 0.3,
  maxEntries: 10000,
});

// Apply forgetting policy
await policy.apply(store);
```

## Debug Tools

### Memory Inspector

```typescript
import { MemoryInspector } from '@lov3kaizen/agentsea-memory/debug';

const inspector = new MemoryInspector(store);

// Get statistics
const stats = await inspector.getStats();
// { totalEntries: 1500, avgImportance: 0.65, oldestEntry: Date, ... }

// Search memories
const results = await inspector.search({
  query: 'user preferences',
  limit: 10,
});

// Export for analysis
await inspector.exportToJSON('./memory-dump.json');
```

## API Reference

### MemoryEntry

```typescript
interface MemoryEntry {
  id: string;
  content: string;
  type: 'fact' | 'episode' | 'preference' | 'context' | 'custom';
  importance: number; // 0-1
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  metadata?: Record<string, unknown>;
  embedding?: number[];
  agentId?: string;
  conversationId?: string;
  tags?: string[];
}
```

### MemoryManager

```typescript
interface MemoryManager {
  add(entry: Partial<MemoryEntry>): Promise<MemoryEntry>;
  retrieve(query: string, options?: RetrievalOptions): Promise<MemoryEntry[]>;
  update(id: string, updates: Partial<MemoryEntry>): Promise<MemoryEntry>;
  delete(id: string): Promise<boolean>;
  clear(): Promise<void>;
}
```

### MemoryStore

```typescript
interface MemoryStore {
  add(entry: MemoryEntry): Promise<void>;
  get(id: string): Promise<MemoryEntry | null>;
  update(id: string, entry: Partial<MemoryEntry>): Promise<void>;
  delete(id: string): Promise<boolean>;
  query(options: QueryOptions): Promise<MemoryEntry[]>;
  clear(): Promise<void>;
}
```

## Links

- [Documentation](https://github.com/lov3kaizen/agentsea)
- [Examples](../../examples)
- [API Reference](../../docs/API.md)
