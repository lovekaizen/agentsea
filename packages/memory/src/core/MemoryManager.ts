/**
 * MemoryManager
 *
 * Main orchestrator for memory operations.
 */

import { EventEmitter } from 'eventemitter3';
import { nanoid } from 'nanoid';
import type {
  MemoryEntry,
  MemoryInput,
  MemoryUpdateInput,
  MemoryQueryOptions,
  MemoryQueryResult,
  MemoryManagerConfig,
  MemoryStoreInterface,
  EmbeddingProviderInterface,
  RetrievalStrategyInterface,
  RetrievalOptions,
  ScoredMemory,
  MemoryEvent,
  MemoryStats,
  MemoryType,
  ImportanceCalculator,
} from '../types/index.js';

interface MemoryManagerEvents {
  'memory:added': (event: MemoryEvent) => void;
  'memory:updated': (event: MemoryEvent) => void;
  'memory:deleted': (event: MemoryEvent) => void;
  'memory:retrieved': (event: MemoryEvent) => void;
}

/**
 * Memory manager - main orchestrator
 */
export class MemoryManager extends EventEmitter<MemoryManagerEvents> {
  private store: MemoryStoreInterface;
  private embedding?: EmbeddingProviderInterface;
  private retrieval?: RetrievalStrategyInterface;
  private defaultNamespace: string;
  private autoEmbed: boolean;
  private importanceCalculator: ImportanceCalculator;

  constructor(config: MemoryManagerConfig) {
    super();
    this.store = config.store;
    this.embedding = config.embedding;
    this.retrieval = config.retrieval;
    this.defaultNamespace = config.defaultNamespace ?? 'default';
    this.autoEmbed = config.autoEmbed ?? true;
    this.importanceCalculator =
      config.importanceCalculator ?? this.defaultImportanceCalculator;
  }

  /**
   * Add a memory
   */
  async add(input: MemoryInput): Promise<string> {
    const now = Date.now();

    // Calculate importance
    const importance =
      input.importance ??
      this.importanceCalculator(input.content, input.type ?? 'context', {
        source: input.metadata?.source ?? 'explicit',
        confidence: input.metadata?.confidence ?? 1,
        namespace: input.metadata?.namespace ?? this.defaultNamespace,
        ...input.metadata,
      });

    // Generate embedding if provider available and autoEmbed enabled
    let embedding: number[] | undefined;
    if (this.embedding && this.autoEmbed) {
      embedding = await this.embedding.embed(input.content);
    }

    const entry: MemoryEntry = {
      id: nanoid(),
      content: input.content,
      embedding,
      type: input.type ?? 'context',
      importance,
      metadata: {
        source: 'explicit',
        confidence: 1,
        namespace: this.defaultNamespace,
        ...input.metadata,
      },
      timestamp: now,
      expiresAt: input.expiresAt,
      parentId: input.parentId,
      accessCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    const id = await this.store.add(entry);

    this.emit('memory:added', {
      type: 'memory:added',
      memoryId: id,
      memory: entry,
      timestamp: now,
    });

    return id;
  }

  /**
   * Add multiple memories
   */
  async addBatch(inputs: MemoryInput[]): Promise<string[]> {
    const ids: string[] = [];

    // If embedding provider supports batch, use it
    if (this.embedding && this.autoEmbed && inputs.length > 1) {
      const contents = inputs.map((i) => i.content);
      const embeddings = await this.embedding.embedBatch(contents);

      for (let i = 0; i < inputs.length; i++) {
        const id = await this.addWithEmbedding(inputs[i], embeddings[i]);
        ids.push(id);
      }
    } else {
      for (const input of inputs) {
        const id = await this.add(input);
        ids.push(id);
      }
    }

    return ids;
  }

  /**
   * Add memory with pre-computed embedding
   */
  private async addWithEmbedding(
    input: MemoryInput,
    embedding: number[],
  ): Promise<string> {
    const now = Date.now();

    const importance =
      input.importance ??
      this.importanceCalculator(input.content, input.type ?? 'context', {
        source: input.metadata?.source ?? 'explicit',
        confidence: input.metadata?.confidence ?? 1,
        namespace: input.metadata?.namespace ?? this.defaultNamespace,
        ...input.metadata,
      });

    const entry: MemoryEntry = {
      id: nanoid(),
      content: input.content,
      embedding,
      type: input.type ?? 'context',
      importance,
      metadata: {
        source: 'explicit',
        confidence: 1,
        namespace: this.defaultNamespace,
        ...input.metadata,
      },
      timestamp: now,
      expiresAt: input.expiresAt,
      parentId: input.parentId,
      accessCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    const id = await this.store.add(entry);

    this.emit('memory:added', {
      type: 'memory:added',
      memoryId: id,
      memory: entry,
      timestamp: now,
    });

    return id;
  }

  /**
   * Get a memory by ID
   */
  async get(id: string): Promise<MemoryEntry | null> {
    const entry = await this.store.get(id);

    if (entry) {
      // Update access count
      await this.store.update(id, {});
    }

    return entry;
  }

  /**
   * Update a memory
   */
  async update(id: string, updates: MemoryUpdateInput): Promise<boolean> {
    const existing = await this.store.get(id);
    if (!existing) {
      return false;
    }

    // Re-embed if content changed
    if (updates.content && this.embedding && this.autoEmbed) {
      const embedding = await this.embedding.embed(updates.content);
      (updates as MemoryEntry).embedding = embedding;
    }

    const success = await this.store.update(id, updates);

    if (success) {
      const updated = await this.store.get(id);
      this.emit('memory:updated', {
        type: 'memory:updated',
        memoryId: id,
        memory: updated ?? undefined,
        timestamp: Date.now(),
      });
    }

    return success;
  }

  /**
   * Delete a memory
   */
  async delete(id: string): Promise<boolean> {
    const success = await this.store.delete(id);

    if (success) {
      this.emit('memory:deleted', {
        type: 'memory:deleted',
        memoryId: id,
        timestamp: Date.now(),
      });
    }

    return success;
  }

  /**
   * Retrieve relevant memories using semantic search
   */
  async retrieve(
    query: string,
    options: RetrievalOptions = {},
  ): Promise<ScoredMemory[]> {
    if (!this.embedding) {
      throw new Error('Embedding provider required for semantic retrieval');
    }

    let results: ScoredMemory[];

    if (this.retrieval) {
      results = await this.retrieval.retrieve(
        query,
        this.store,
        this.embedding,
        options,
      );
    } else {
      // Default semantic search
      const queryEmbedding = await this.embedding.embed(query);
      results = await this.store.search(queryEmbedding, {
        topK: options.limit ?? 10,
        minScore: options.minScore ?? 0.5,
        filter: {
          userId: options.userId,
          agentId: options.agentId,
          conversationId: options.conversationId,
          namespace: options.namespace ?? this.defaultNamespace,
          types: options.types,
        },
        namespace: options.namespace ?? this.defaultNamespace,
      });
    }

    this.emit('memory:retrieved', {
      type: 'memory:retrieved',
      metadata: { query, count: results.length },
      timestamp: Date.now(),
    });

    return results;
  }

  /**
   * Search memories with filters (non-semantic)
   */
  search(options: MemoryQueryOptions): Promise<MemoryQueryResult> {
    const queryOptions: MemoryQueryOptions = {
      ...options,
      namespace: options.namespace ?? this.defaultNamespace,
    };

    return this.store.query(queryOptions);
  }

  /**
   * Query memories (alias for search)
   */
  query(options: MemoryQueryOptions): Promise<MemoryQueryResult> {
    return this.search(options);
  }

  /**
   * Clear memories
   */
  clear(options?: { namespace?: string; userId?: string }): Promise<number> {
    return this.store.clear({
      namespace: options?.namespace ?? this.defaultNamespace,
      userId: options?.userId,
    });
  }

  /**
   * Get memory count
   */
  count(options?: MemoryQueryOptions): Promise<number> {
    return this.store.count({
      ...options,
      namespace: options?.namespace ?? this.defaultNamespace,
    });
  }

  /**
   * Get memory statistics
   */
  async getStats(): Promise<MemoryStats> {
    const result = await this.store.query({ limit: 100000 });
    const entries = result.entries;

    const byType: Record<MemoryType, number> = {
      fact: 0,
      preference: 0,
      event: 0,
      context: 0,
      summary: 0,
      entity: 0,
      relation: 0,
      conversation: 0,
      custom: 0,
    };

    const byNamespace: Record<string, number> = {};
    let totalImportance = 0;
    let embeddedCount = 0;
    let oldestTimestamp = Infinity;
    let newestTimestamp = 0;
    let totalSize = 0;

    for (const entry of entries) {
      byType[entry.type] = (byType[entry.type] ?? 0) + 1;

      const ns = entry.metadata.namespace ?? 'default';
      byNamespace[ns] = (byNamespace[ns] ?? 0) + 1;

      totalImportance += entry.importance;

      if (entry.embedding) {
        embeddedCount++;
      }

      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
      }
      if (entry.timestamp > newestTimestamp) {
        newestTimestamp = entry.timestamp;
      }

      totalSize += JSON.stringify(entry).length;
    }

    return {
      totalCount: entries.length,
      byType,
      byNamespace,
      sizeBytes: totalSize,
      oldestTimestamp: oldestTimestamp === Infinity ? 0 : oldestTimestamp,
      newestTimestamp,
      averageImportance:
        entries.length > 0 ? totalImportance / entries.length : 0,
      embeddedCount,
    };
  }

  /**
   * Set embedding provider
   */
  setEmbedding(embedding: EmbeddingProviderInterface): void {
    this.embedding = embedding;
  }

  /**
   * Set retrieval strategy
   */
  setRetrieval(retrieval: RetrievalStrategyInterface): void {
    this.retrieval = retrieval;
  }

  /**
   * Set importance calculator
   */
  setImportanceCalculator(calculator: ImportanceCalculator): void {
    this.importanceCalculator = calculator;
  }

  /**
   * Get the underlying store
   */
  getStore(): MemoryStoreInterface {
    return this.store;
  }

  /**
   * Close the memory manager
   */
  async close(): Promise<void> {
    if (this.store.close) {
      await this.store.close();
    }
  }

  /**
   * Default importance calculator
   */
  private defaultImportanceCalculator: ImportanceCalculator = (
    _content: string,
    type: MemoryType,
    metadata,
  ): number => {
    let importance = 0.5;

    // Boost based on type
    switch (type) {
      case 'fact':
      case 'preference':
        importance = 0.8;
        break;
      case 'event':
        importance = 0.6;
        break;
      case 'summary':
        importance = 0.7;
        break;
      case 'context':
        importance = 0.5;
        break;
      case 'entity':
      case 'relation':
        importance = 0.7;
        break;
      default:
        importance = 0.5;
    }

    // Adjust by confidence
    if (metadata.confidence !== undefined) {
      importance *= 0.5 + 0.5 * metadata.confidence;
    }

    // Boost explicit memories
    if (metadata.source === 'explicit') {
      importance *= 1.1;
    }

    return Math.min(importance, 1);
  };
}

/**
 * Create a memory manager
 */
export function createMemoryManager(
  config: MemoryManagerConfig,
): MemoryManager {
  return new MemoryManager(config);
}
