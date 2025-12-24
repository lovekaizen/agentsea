/**
 * Core Memory Types
 *
 * Core type definitions for memory management.
 */

/**
 * Memory entry type
 */
export type MemoryType =
  | 'fact'
  | 'preference'
  | 'event'
  | 'context'
  | 'summary'
  | 'entity'
  | 'relation'
  | 'conversation'
  | 'custom';

/**
 * Memory source
 */
export type MemorySource =
  | 'explicit'
  | 'inferred'
  | 'extracted'
  | 'system'
  | 'agent';

/**
 * Memory importance level
 */
export type ImportanceLevel =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'trivial';

/**
 * Entity extracted from memory
 */
export interface Entity {
  type: string;
  value: string;
  confidence: number;
  metadata?: Record<string, unknown>;
}

/**
 * Relation between entities
 */
export interface Relation {
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  metadata?: Record<string, unknown>;
}

/**
 * Memory entry metadata
 */
export interface MemoryMetadata {
  userId?: string;
  agentId?: string;
  conversationId?: string;
  sessionId?: string;
  source: MemorySource;
  confidence: number;
  entities?: Entity[];
  relations?: Relation[];
  tags?: string[];
  namespace?: string;
  [key: string]: unknown;
}

/**
 * Memory entry
 */
export interface MemoryEntry {
  id: string;
  content: string;
  embedding?: number[];
  type: MemoryType;
  importance: number;
  metadata: MemoryMetadata;
  timestamp: number;
  expiresAt?: number;
  parentId?: string;
  accessCount: number;
  lastAccessedAt?: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Memory input for adding
 */
export interface MemoryInput {
  content: string;
  type?: MemoryType;
  importance?: number;
  metadata?: Partial<MemoryMetadata>;
  expiresAt?: number;
  parentId?: string;
}

/**
 * Memory update input
 */
export interface MemoryUpdateInput {
  content?: string;
  type?: MemoryType;
  importance?: number;
  metadata?: Partial<MemoryMetadata>;
  expiresAt?: number;
  lastAccessedAt?: number;
  accessCount?: number;
}

/**
 * Memory query options
 */
export interface MemoryQueryOptions {
  query?: string;
  userId?: string;
  agentId?: string;
  conversationId?: string;
  sessionId?: string;
  namespace?: string;
  types?: MemoryType[];
  tags?: string[];
  minImportance?: number;
  startTime?: number;
  endTime?: number;
  limit?: number;
  offset?: number;
  includeExpired?: boolean;
}

/**
 * Memory query result
 */
export interface MemoryQueryResult {
  entries: MemoryEntry[];
  total: number;
  hasMore: boolean;
}

/**
 * Scored memory entry (retrieval result)
 */
export interface ScoredMemory {
  entry: MemoryEntry;
  score: number;
  explanation?: string;
}

/**
 * Memory retrieval options
 */
export interface RetrievalOptions {
  userId?: string;
  agentId?: string;
  conversationId?: string;
  namespace?: string;
  limit?: number;
  minScore?: number;
  types?: MemoryType[];
  timeRange?: {
    start?: number;
    end?: number;
  };
  filters?: Record<string, unknown>;
}

/**
 * Memory manager configuration
 */
export interface MemoryManagerConfig {
  store: MemoryStoreInterface;
  embedding?: EmbeddingProviderInterface;
  retrieval?: RetrievalStrategyInterface;
  defaultNamespace?: string;
  autoEmbed?: boolean;
  importanceCalculator?: ImportanceCalculator;
}

/**
 * Memory store interface
 */
export interface MemoryStoreInterface {
  add(entry: MemoryEntry): Promise<string>;
  get(id: string): Promise<MemoryEntry | null>;
  update(id: string, updates: MemoryUpdateInput): Promise<boolean>;
  delete(id: string): Promise<boolean>;
  query(options: MemoryQueryOptions): Promise<MemoryQueryResult>;
  search(
    embedding: number[],
    options: VectorSearchOptions,
  ): Promise<ScoredMemory[]>;
  clear(options?: { namespace?: string; userId?: string }): Promise<number>;
  count(options?: MemoryQueryOptions): Promise<number>;
  close?(): Promise<void>;
}

/**
 * Vector search options
 */
export interface VectorSearchOptions {
  topK: number;
  minScore?: number;
  filter?: Record<string, unknown>;
  namespace?: string;
}

/**
 * Embedding provider interface
 */
export interface EmbeddingProviderInterface {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  dimensions: number;
}

/**
 * Retrieval strategy interface
 */
export interface RetrievalStrategyInterface {
  readonly name: string;
  retrieve(
    query: string,
    store: MemoryStoreInterface,
    embedding: EmbeddingProviderInterface,
    options: RetrievalOptions,
  ): Promise<ScoredMemory[]>;
}

/**
 * Importance calculator function
 */
export type ImportanceCalculator = (
  content: string,
  type: MemoryType,
  metadata: MemoryMetadata,
) => number;

/**
 * LLM provider interface (simplified for memory processing)
 */
export interface LLMProviderInterface {
  complete(options: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    maxTokens?: number;
  }): Promise<{ content: string }>;
}

/**
 * Memory event types
 */
export type MemoryEventType =
  | 'memory:added'
  | 'memory:updated'
  | 'memory:deleted'
  | 'memory:retrieved'
  | 'memory:expired'
  | 'memory:consolidated'
  | 'memory:summarized';

/**
 * Memory event
 */
export interface MemoryEvent {
  type: MemoryEventType;
  memoryId?: string;
  memory?: MemoryEntry;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

/**
 * Memory statistics
 */
export interface MemoryStats {
  totalCount: number;
  byType: Record<MemoryType, number>;
  byNamespace: Record<string, number>;
  sizeBytes: number;
  oldestTimestamp: number;
  newestTimestamp: number;
  averageImportance: number;
  embeddedCount: number;
}
