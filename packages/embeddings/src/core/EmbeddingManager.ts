/**
 * EmbeddingManager
 *
 * Main orchestrator for embedding operations.
 * Coordinates providers, caching, chunking, and stores.
 */

import EventEmitter from 'eventemitter3';
import type {
  EmbeddingResult,
  BatchEmbeddingResult,
  EmbeddingOptions,
  BatchEmbeddingOptions,
  DocumentEmbeddingOptions,
  EmbeddingStats,
  EmbeddedChunk,
  SearchResult,
  SearchOptions,
  EmbeddingVector,
} from '../types/index.js';
import { EmbeddingModel, ModelRegistry } from './EmbeddingModel.js';
import { cacheKey, measureTime, batch, generateId } from './utils.js';

/**
 * Embedding manager configuration
 */
export interface EmbeddingManagerConfig {
  /** Default model to use */
  defaultModel?: string;
  /** Default provider */
  defaultProvider?: string;
  /** Enable caching */
  caching?: boolean;
  /** Default batch size */
  batchSize?: number;
  /** Default concurrency */
  concurrency?: number;
  /** Retry configuration */
  retry?: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
  };
}

/**
 * Embedding manager events
 */
export interface EmbeddingManagerEvents {
  'embed:start': [text: string, options?: EmbeddingOptions];
  'embed:complete': [result: EmbeddingResult];
  'embed:error': [error: Error, text: string];
  'batch:start': [texts: string[], options?: BatchEmbeddingOptions];
  'batch:progress': [progress: { completed: number; total: number }];
  'batch:complete': [result: BatchEmbeddingResult];
  'batch:error': [error: Error];
  'cache:hit': [key: string];
  'cache:miss': [key: string];
}

/**
 * Cache interface for embedding manager
 */
export interface EmbeddingCache {
  get(key: string): Promise<EmbeddingResult | undefined>;
  set(key: string, result: EmbeddingResult, ttl?: number): Promise<void>;
  has(key: string): Promise<boolean>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
}

/**
 * Chunker interface for embedding manager
 */
export interface EmbeddingChunker {
  chunk(
    text: string,
    options?: Record<string, unknown>,
  ): Promise<Array<{ text: string; metadata: Record<string, unknown> }>>;
}

/**
 * Store interface for embedding manager
 */
export interface EmbeddingStore {
  upsert(
    chunks: EmbeddedChunk[],
    namespace?: string,
  ): Promise<{ upsertedCount: number }>;
  query(
    vector: EmbeddingVector,
    options?: SearchOptions,
  ): Promise<SearchResult[]>;
  delete(ids: string[], namespace?: string): Promise<{ deletedCount: number }>;
}

/**
 * Main embedding manager class
 */
export class EmbeddingManager extends EventEmitter<EmbeddingManagerEvents> {
  private config: Required<EmbeddingManagerConfig>;
  private modelRegistry: ModelRegistry;
  private cache: EmbeddingCache | null = null;
  private chunker: EmbeddingChunker | null = null;
  private store: EmbeddingStore | null = null;
  private stats: EmbeddingStats;

  constructor(config: EmbeddingManagerConfig = {}) {
    super();

    this.config = {
      defaultModel: config.defaultModel ?? 'text-embedding-3-small',
      defaultProvider: config.defaultProvider ?? 'openai',
      caching: config.caching ?? true,
      batchSize: config.batchSize ?? 100,
      concurrency: config.concurrency ?? 5,
      retry: {
        maxRetries: config.retry?.maxRetries ?? 3,
        initialDelay: config.retry?.initialDelay ?? 1000,
        maxDelay: config.retry?.maxDelay ?? 30000,
      },
    };

    this.modelRegistry = new ModelRegistry();
    this.stats = this.createInitialStats();
  }

  private createInitialStats(): EmbeddingStats {
    return {
      totalEmbeddings: 0,
      totalTokens: 0,
      avgLatencyMs: 0,
      cacheHitRate: 0,
      apiCalls: 0,
      errors: 0,
      estimatedCostUSD: 0,
    };
  }

  /**
   * Register an embedding model
   */
  registerModel(model: EmbeddingModel, isDefault = false): this {
    this.modelRegistry.register(model, isDefault);
    if (isDefault) {
      this.config.defaultModel = model.name;
      this.config.defaultProvider = model.provider;
    }
    return this;
  }

  /**
   * Set the cache implementation
   */
  setCache(cache: EmbeddingCache): this {
    this.cache = cache;
    return this;
  }

  /**
   * Set the chunker implementation
   */
  setChunker(chunker: EmbeddingChunker): this {
    this.chunker = chunker;
    return this;
  }

  /**
   * Set the store implementation
   */
  setStore(store: EmbeddingStore): this {
    this.store = store;
    return this;
  }

  /**
   * Get the model to use for embedding
   */
  private getModel(options?: EmbeddingOptions): EmbeddingModel {
    const modelName = options?.model ?? this.config.defaultModel;
    const model =
      this.modelRegistry.getByKey(
        `${this.config.defaultProvider}:${modelName}`,
      ) ?? this.modelRegistry.getDefault();

    if (!model) {
      throw new Error(`No embedding model found. Register a model first.`);
    }

    return model;
  }

  /**
   * Generate embedding for a single text
   */
  async embed(
    text: string,
    options?: EmbeddingOptions,
  ): Promise<EmbeddingResult> {
    this.emit('embed:start', text, options);

    const model = this.getModel(options);

    // Check cache first
    if (this.config.caching && this.cache && !options?.skipCache) {
      const key = cacheKey(text, model.name);
      const cached = await this.cache.get(key);

      if (cached) {
        this.emit('cache:hit', key);
        this.updateStats({ cacheHits: 1 });
        this.emit('embed:complete', { ...cached, cached: true });
        return { ...cached, cached: true };
      }

      this.emit('cache:miss', key);
    }

    try {
      const { result, durationMs } = await measureTime(() =>
        model.embed(text, options),
      );

      // Update result with timing
      const finalResult: EmbeddingResult = {
        ...result,
        latencyMs: durationMs,
        cached: false,
      };

      // Cache the result
      if (this.config.caching && this.cache && !options?.skipCache) {
        const key = cacheKey(text, model.name);
        await this.cache.set(key, finalResult);
      }

      this.updateStats({
        embeddings: 1,
        tokens: finalResult.tokenCount,
        latency: durationMs,
        apiCalls: 1,
        cost: this.estimateCost(model, finalResult.tokenCount),
      });

      this.emit('embed:complete', finalResult);
      return finalResult;
    } catch (error) {
      this.stats.errors++;
      this.emit('embed:error', error as Error, text);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts
   */
  async embedBatch(
    texts: string[],
    options?: BatchEmbeddingOptions,
  ): Promise<BatchEmbeddingResult> {
    this.emit('batch:start', texts, options);

    const model = this.getModel(options);
    const batchSize = options?.concurrency ?? this.config.batchSize;

    const results: EmbeddingResult[] = [];
    let cacheHits = 0;
    let cacheMisses = 0;
    let failures = 0;
    let totalTokens = 0;
    const startTime = performance.now();

    // Check cache for all texts
    const cacheResults: Map<number, EmbeddingResult> = new Map();
    const textsToEmbed: Array<{ index: number; text: string }> = [];

    if (this.config.caching && this.cache && !options?.skipCache) {
      for (let i = 0; i < texts.length; i++) {
        const key = cacheKey(texts[i], model.name);
        const cached = await this.cache.get(key);
        if (cached) {
          cacheResults.set(i, { ...cached, cached: true });
          cacheHits++;
        } else {
          textsToEmbed.push({ index: i, text: texts[i] });
          cacheMisses++;
        }
      }
    } else {
      textsToEmbed.push(...texts.map((text, index) => ({ index, text })));
      cacheMisses = texts.length;
    }

    // Process uncached texts in batches
    const batches = batch(textsToEmbed, batchSize);
    let processedCount = cacheResults.size;

    for (const batchItems of batches) {
      const batchTexts = batchItems.map((item) => item.text);

      try {
        const { result: batchResult } = await measureTime(() =>
          model.embedBatch(batchTexts, options),
        );

        for (let i = 0; i < batchResult.results.length; i++) {
          const item = batchItems[i];
          const embeddingResult = batchResult.results[i];

          cacheResults.set(item.index, embeddingResult);

          // Cache individual results
          if (this.config.caching && this.cache && !options?.skipCache) {
            const key = cacheKey(item.text, model.name);
            await this.cache.set(key, embeddingResult);
          }
        }

        totalTokens += batchResult.totalTokens;
        processedCount += batchItems.length;
      } catch (error) {
        if (options?.continueOnError) {
          failures += batchItems.length;
          processedCount += batchItems.length;
        } else {
          throw error;
        }
      }

      this.emit('batch:progress', {
        completed: processedCount,
        total: texts.length,
      });
      options?.onProgress?.({
        percent: (processedCount / texts.length) * 100,
        processed: processedCount,
        total: texts.length,
        elapsedMs: performance.now() - startTime,
      });
    }

    // Assemble results in original order
    for (let i = 0; i < texts.length; i++) {
      const result = cacheResults.get(i);
      if (result) {
        results.push(result);
      }
    }

    const totalLatencyMs = performance.now() - startTime;

    const batchResult: BatchEmbeddingResult = {
      results,
      totalTokens,
      totalLatencyMs,
      cacheHits,
      cacheMisses,
      failures,
    };

    this.updateStats({
      embeddings: results.length,
      tokens: totalTokens,
      latency: totalLatencyMs / results.length,
      apiCalls: batches.length,
      cacheHits,
      cost: this.estimateCost(model, totalTokens),
    });

    this.emit('batch:complete', batchResult);
    return batchResult;
  }

  /**
   * Embed a document with chunking
   */
  async embedDocument(
    text: string,
    options?: DocumentEmbeddingOptions,
  ): Promise<EmbeddedChunk[]> {
    if (!this.chunker) {
      throw new Error('No chunker configured. Use setChunker() first.');
    }

    // Chunk the document
    const chunks = await this.chunker.chunk(
      text,
      options as Record<string, unknown>,
    );

    // Embed all chunks
    const chunkTexts = chunks.map((c) => c.text);
    const embedResult = await this.embedBatch(chunkTexts, options);

    // Create embedded chunks
    const embeddedChunks: EmbeddedChunk[] = [];
    let position = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const result = embedResult.results[i];

      if (result) {
        embeddedChunks.push({
          id: generateId('chunk'),
          text: chunk.text,
          vector: result.vector,
          index: i,
          startPosition: position,
          endPosition: position + chunk.text.length,
          tokenCount: result.tokenCount,
          metadata: {
            documentId: options?.documentId,
            source: options?.source,
            type: options?.type,
            ...chunk.metadata,
            ...options?.chunkMetadata,
          },
        });
      }

      position += chunk.text.length;
    }

    // Store if configured
    if (this.store) {
      await this.store.upsert(embeddedChunks, options?.documentId);
    }

    return embeddedChunks;
  }

  /**
   * Search for similar content
   */
  async search(
    query: string,
    options?: SearchOptions,
  ): Promise<SearchResult[]> {
    if (!this.store) {
      throw new Error('No store configured. Use setStore() first.');
    }

    // Embed the query
    const queryResult = await this.embed(query);

    // Search the store
    return this.store.query(queryResult.vector, options);
  }

  /**
   * Calculate similarity between two texts
   */
  async similarity(text1: string, text2: string): Promise<number> {
    const [result1, result2] = await Promise.all([
      this.embed(text1),
      this.embed(text2),
    ]);

    return EmbeddingModel.cosineSimilarity(result1.vector, result2.vector);
  }

  /**
   * Get embedding statistics
   */
  getStats(): EmbeddingStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = this.createInitialStats();
  }

  /**
   * Get registered models
   */
  getModels(): Array<{ provider: string; name: string; dimensions: number }> {
    return this.modelRegistry.list().map((m) => ({
      provider: m.provider,
      name: m.name,
      dimensions: m.dimensions,
    }));
  }

  /**
   * Update statistics
   */
  private updateStats(update: {
    embeddings?: number;
    tokens?: number;
    latency?: number;
    apiCalls?: number;
    cacheHits?: number;
    cost?: number;
  }): void {
    if (update.embeddings) {
      this.stats.totalEmbeddings += update.embeddings;
    }
    if (update.tokens) {
      this.stats.totalTokens += update.tokens;
    }
    if (update.latency) {
      // Running average
      const n = this.stats.totalEmbeddings;
      this.stats.avgLatencyMs =
        (this.stats.avgLatencyMs * (n - 1) + update.latency) / n;
    }
    if (update.apiCalls) {
      this.stats.apiCalls += update.apiCalls;
    }
    if (update.cacheHits !== undefined) {
      const totalLookups = this.stats.totalEmbeddings;
      const currentHits = this.stats.cacheHitRate * (totalLookups - 1);
      this.stats.cacheHitRate = (currentHits + update.cacheHits) / totalLookups;
    }
    if (update.cost) {
      this.stats.estimatedCostUSD += update.cost;
    }
  }

  /**
   * Estimate cost for embedding tokens
   */
  private estimateCost(model: EmbeddingModel, tokens: number): number {
    const costPer1K = model.info.costPer1K ?? 0;
    return (tokens / 1000) * costPer1K;
  }
}

/**
 * Create a new embedding manager
 */
export function createEmbeddingManager(
  config?: EmbeddingManagerConfig,
): EmbeddingManager {
  return new EmbeddingManager(config);
}
