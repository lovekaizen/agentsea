/**
 * StreamCache
 *
 * Main streaming cache class for caching and replaying LLM streams.
 */

import EventEmitter from 'eventemitter3';
import type {
  CacheMessage,
  RecordedStream,
  StreamCacheConfig,
  StreamCacheLookupResult,
  StreamCacheStats,
  StreamChunk,
} from '../types/index.js';
import type { BaseCacheStore } from '../stores/BaseCacheStore.js';
import type { SimilarityEngine } from '../similarity/SimilarityEngine.js';
import { StreamRecorder } from './StreamRecorder.js';
import { StreamReplayer } from './StreamReplayer.js';
import { generateCacheKey } from '../core/CacheKey.js';
import { generateId, now } from '../core/utils.js';

/**
 * StreamCache events
 */
export interface StreamCacheEvents {
  hit: (result: StreamCacheLookupResult) => void;
  miss: (key: string) => void;
  record: (stream: RecordedStream) => void;
  error: (error: Error) => void;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<StreamCacheConfig> = {
  recorder: {},
  replayer: {},
  cacheIncomplete: false,
  minLengthToCache: 10,
  streamTtl: 3600, // 1 hour
};

/**
 * StreamCache
 *
 * Cache for LLM streaming responses.
 *
 * @example
 * ```typescript
 * const streamCache = new StreamCache({
 *   store,
 *   minLengthToCache: 50
 * });
 *
 * // Wrap a streaming call
 * const stream = streamCache.wrapStream({
 *   model: 'gpt-5.5',
 *   messages: [{ role: 'user', content: 'Hello' }],
 *   stream: true
 * }, async function* () {
 *   // Your streaming LLM call
 *   for await (const chunk of llm.stream(request)) {
 *     yield chunk;
 *   }
 * });
 * ```
 */
export class StreamCache extends EventEmitter<StreamCacheEvents> {
  private store: BaseCacheStore;
  private similarity?: SimilarityEngine;
  private config: Required<StreamCacheConfig>;
  private recorder: StreamRecorder;
  private replayer: StreamReplayer;
  private stats: StreamCacheStats = {
    totalLookups: 0,
    totalHits: 0,
    totalMisses: 0,
    hitRate: 0,
    avgReplayLatencyMs: 0,
    totalStreamsCached: 0,
    totalBytesCached: 0,
    avgStreamDurationMs: 0,
  };
  private replayLatencies: number[] = [];
  private streamDurations: number[] = [];

  constructor(
    store: BaseCacheStore,
    config?: StreamCacheConfig,
    similarity?: SimilarityEngine,
  ) {
    super();
    this.store = store;
    this.similarity = similarity;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.recorder = new StreamRecorder(this.config.recorder);
    this.replayer = new StreamReplayer(this.config.replayer);
  }

  /**
   * Look up a cached stream
   */
  async lookup(
    model: string,
    messages: CacheMessage[],
  ): Promise<StreamCacheLookupResult> {
    const startTime = performance.now();
    this.stats.totalLookups++;

    const key = this.generateStreamKey(model, messages);

    try {
      // Try exact match first
      const entry = await this.store.get(key);

      if (entry) {
        const stream = this.deserializeStream(entry.response.content);
        if (stream) {
          this.stats.totalHits++;
          this.updateHitRate();
          const latencyMs = performance.now() - startTime;
          this.replayLatencies.push(latencyMs);

          const result: StreamCacheLookupResult = {
            hit: true,
            stream,
            similarity: 1.0,
            source: 'exact',
            latencyMs,
          };

          this.emit('hit', result);
          return result;
        }
      }

      // Try semantic match if similarity engine is available
      if (this.similarity) {
        const userMessage = messages.find((m) => m.role === 'user')?.content;
        if (userMessage) {
          const embedding = await this.similarity.embed(userMessage);
          const results = await this.store.query(embedding, {
            topK: 1,
            minSimilarity: 0.92,
          });

          if (results.entries.length > 0) {
            const entry = results.entries[0];
            const stream = this.deserializeStream(entry.response.content);
            if (stream && entry.score >= 0.92) {
              this.stats.totalHits++;
              this.updateHitRate();
              const latencyMs = performance.now() - startTime;
              this.replayLatencies.push(latencyMs);

              const result: StreamCacheLookupResult = {
                hit: true,
                stream,
                similarity: entry.score,
                source: 'semantic',
                latencyMs,
              };

              this.emit('hit', result);
              return result;
            }
          }
        }
      }

      // Cache miss
      this.stats.totalMisses++;
      this.updateHitRate();
      const latencyMs = performance.now() - startTime;

      this.emit('miss', key);
      return {
        hit: false,
        source: 'miss',
        latencyMs,
      };
    } catch (error) {
      this.emit('error', error as Error);
      return {
        hit: false,
        source: 'miss',
        latencyMs: performance.now() - startTime,
      };
    }
  }

  /**
   * Cache a recorded stream
   */
  async cache(stream: RecordedStream, embedding?: number[]): Promise<void> {
    // Don't cache incomplete streams unless configured
    if (!stream.complete && !this.config.cacheIncomplete) {
      return;
    }

    // Don't cache streams that are too short
    if (stream.totalChars < this.config.minLengthToCache) {
      return;
    }

    const key = this.generateStreamKey(stream.model, stream.messages);

    try {
      // Convert messages to CacheMessage format
      const cacheMessages: CacheMessage[] = stream.messages.map((m) => ({
        role: m.role as 'system' | 'user' | 'assistant' | 'tool',
        content: m.content,
      }));

      await this.store.set(key, {
        id: generateId(),
        key,
        request: {
          messages: cacheMessages,
          model: stream.model,
        },
        response: {
          content: this.serializeStream(stream),
          model: stream.model,
          finishReason: stream.complete ? 'stop' : 'error',
          usage: {
            promptTokens: stream.tokenUsage?.prompt ?? 0,
            completionTokens: stream.tokenUsage?.completion ?? 0,
            totalTokens: stream.tokenUsage?.total ?? 0,
          },
        },
        embedding,
        metadata: {
          createdAt: now(),
          accessedAt: now(),
          accessCount: 1,
          hitCount: 0,
          ttl: this.config.streamTtl,
        },
      });

      this.stats.totalStreamsCached++;
      this.stats.totalBytesCached += this.estimateStreamSize(stream);
      this.streamDurations.push(stream.durationMs);
      this.updateAvgStreamDuration();

      this.emit('record', stream);
    } catch (error) {
      this.emit('error', error as Error);
    }
  }

  /**
   * Wrap a streaming function with caching
   */
  async *wrapStream<T extends { content?: string }>(
    model: string,
    messages: CacheMessage[],
    streamFn: () => AsyncGenerator<T>,
    options?: { embedding?: number[] },
  ): AsyncGenerator<T> {
    // Check cache first
    const lookupResult = await this.lookup(model, messages);

    if (lookupResult.hit && lookupResult.stream) {
      // Replay from cache
      for await (const chunk of this.replayer.replay(lookupResult.stream)) {
        yield { content: chunk.content } as T;
      }
      return;
    }

    // Record new stream
    const key = this.generateStreamKey(model, messages);
    this.recorder.start(model, messages, key);

    try {
      for await (const chunk of streamFn()) {
        if (chunk.content) {
          this.recorder.recordText(chunk.content);
        }
        yield chunk;
      }

      // Complete recording and cache
      const stream = this.recorder.complete();
      await this.cache(stream, options?.embedding);
    } catch (error) {
      // Abort recording on error
      if (this.recorder.isRecording()) {
        this.recorder.abort((error as Error).message);
      }
      throw error;
    }
  }

  /**
   * Replay a cached stream
   */
  async *replay(stream: RecordedStream): AsyncGenerator<StreamChunk> {
    for await (const chunk of this.replayer.replay(stream)) {
      yield chunk;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): StreamCacheStats {
    return { ...this.stats };
  }

  /**
   * Clear the stream cache
   */
  async clear(): Promise<void> {
    await this.store.clear();
    this.stats = {
      totalLookups: 0,
      totalHits: 0,
      totalMisses: 0,
      hitRate: 0,
      avgReplayLatencyMs: 0,
      totalStreamsCached: 0,
      totalBytesCached: 0,
      avgStreamDurationMs: 0,
    };
    this.replayLatencies = [];
    this.streamDurations = [];
  }

  /**
   * Destroy the stream cache
   */
  destroy(): void {
    this.recorder.destroy();
    this.replayer.stop();
    this.removeAllListeners();
  }

  private generateStreamKey(
    model: string,
    messages: Array<{ role: string; content: string }>,
  ): string {
    // Convert to CacheMessage format for key generation
    const cacheMessages: CacheMessage[] = messages.map((m) => ({
      role: m.role as 'system' | 'user' | 'assistant' | 'tool',
      content: m.content,
    }));
    return generateCacheKey(model, cacheMessages);
  }

  private serializeStream(stream: RecordedStream): string {
    return JSON.stringify(stream);
  }

  private deserializeStream(content: string): RecordedStream | null {
    try {
      return JSON.parse(content) as RecordedStream;
    } catch {
      return null;
    }
  }

  private estimateStreamSize(stream: RecordedStream): number {
    return JSON.stringify(stream).length;
  }

  private updateHitRate(): void {
    if (this.stats.totalLookups > 0) {
      this.stats.hitRate =
        (this.stats.totalHits / this.stats.totalLookups) * 100;
    }
  }

  private updateAvgStreamDuration(): void {
    if (this.streamDurations.length > 0) {
      this.stats.avgStreamDurationMs =
        this.streamDurations.reduce((a, b) => a + b, 0) /
        this.streamDurations.length;
    }
  }
}

/**
 * Create a StreamCache instance
 */
export function createStreamCache(
  store: BaseCacheStore,
  config?: StreamCacheConfig,
  similarity?: SimilarityEngine,
): StreamCache {
  return new StreamCache(store, config, similarity);
}
