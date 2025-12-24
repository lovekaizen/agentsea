/**
 * ChunkBuffer
 *
 * Buffers stream chunks for efficient recording.
 */

import type { StreamChunk, ChunkBufferConfig } from '../types/index.js';

/**
 * Default buffer configuration
 */
const DEFAULT_CONFIG: Required<ChunkBufferConfig> = {
  maxChunks: 100,
  maxBytes: 64 * 1024, // 64KB
  flushIntervalMs: 1000,
  preserveOrder: true,
};

/**
 * ChunkBuffer
 *
 * Buffers stream chunks for batch processing.
 *
 * @example
 * ```typescript
 * const buffer = new ChunkBuffer({
 *   maxChunks: 50,
 *   onFlush: (chunks) => console.log(`Flushed ${chunks.length} chunks`)
 * });
 *
 * buffer.add(chunk);
 * const chunks = buffer.flush();
 * ```
 */
export class ChunkBuffer {
  private chunks: StreamChunk[] = [];
  private currentBytes = 0;
  private config: Required<ChunkBufferConfig>;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private onFlush?: (chunks: StreamChunk[]) => void;

  constructor(
    config?: ChunkBufferConfig,
    onFlush?: (chunks: StreamChunk[]) => void,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.onFlush = onFlush;

    if (this.config.flushIntervalMs > 0) {
      this.startFlushTimer();
    }
  }

  /**
   * Add a chunk to the buffer
   */
  add(chunk: StreamChunk): void {
    if (this.config.preserveOrder) {
      // Ensure chunk has correct index
      if (chunk.index === undefined) {
        chunk.index = this.chunks.length;
      }
    }

    this.chunks.push(chunk);
    this.currentBytes += this.estimateChunkSize(chunk);

    // Auto-flush if limits exceeded
    if (this.shouldFlush()) {
      this.flush();
    }
  }

  /**
   * Add multiple chunks
   */
  addAll(chunks: StreamChunk[]): void {
    for (const chunk of chunks) {
      this.add(chunk);
    }
  }

  /**
   * Flush all buffered chunks
   */
  flush(): StreamChunk[] {
    const flushed = this.chunks;

    // Sort by index if preserving order
    if (this.config.preserveOrder) {
      flushed.sort((a, b) => a.index - b.index);
    }

    // Reset buffer
    this.chunks = [];
    this.currentBytes = 0;

    // Callback if set
    if (this.onFlush && flushed.length > 0) {
      this.onFlush(flushed);
    }

    return flushed;
  }

  /**
   * Get current buffer size
   */
  size(): number {
    return this.chunks.length;
  }

  /**
   * Get current buffer bytes
   */
  bytes(): number {
    return this.currentBytes;
  }

  /**
   * Check if buffer is empty
   */
  isEmpty(): boolean {
    return this.chunks.length === 0;
  }

  /**
   * Peek at buffered chunks without flushing
   */
  peek(): readonly StreamChunk[] {
    return this.chunks;
  }

  /**
   * Clear the buffer without flushing
   */
  clear(): void {
    this.chunks = [];
    this.currentBytes = 0;
  }

  /**
   * Stop the flush timer
   */
  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Destroy the buffer
   */
  destroy(): void {
    this.stop();
    this.clear();
  }

  private shouldFlush(): boolean {
    return (
      this.chunks.length >= this.config.maxChunks ||
      this.currentBytes >= this.config.maxBytes
    );
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      if (!this.isEmpty()) {
        this.flush();
      }
    }, this.config.flushIntervalMs);
  }

  private estimateChunkSize(chunk: StreamChunk): number {
    let size = 0;
    if (chunk.content) {
      size += chunk.content.length * 2; // Unicode chars
    }
    if (chunk.toolCall) {
      size += JSON.stringify(chunk.toolCall).length;
    }
    if (chunk.toolResult) {
      size += JSON.stringify(chunk.toolResult).length;
    }
    if (chunk.metadata) {
      size += JSON.stringify(chunk.metadata).length;
    }
    return size + 50; // Base overhead
  }
}

/**
 * Create a ChunkBuffer instance
 */
export function createChunkBuffer(
  config?: ChunkBufferConfig,
  onFlush?: (chunks: StreamChunk[]) => void,
): ChunkBuffer {
  return new ChunkBuffer(config, onFlush);
}
