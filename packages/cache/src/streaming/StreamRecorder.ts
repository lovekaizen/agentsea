/**
 * StreamRecorder
 *
 * Records LLM stream responses for caching.
 */

import type {
  StreamChunk,
  RecordedStream,
  StreamRecorderConfig,
} from '../types/index.js';
import { ChunkBuffer } from './ChunkBuffer.js';
import { generateId, now } from '../core/utils.js';

/**
 * Default recorder configuration
 */
const DEFAULT_CONFIG: Required<StreamRecorderConfig> = {
  buffer: {
    maxChunks: 100,
    maxBytes: 64 * 1024,
    flushIntervalMs: 0, // No auto-flush during recording
    preserveOrder: true,
  },
  captureToolCalls: true,
  captureMetadata: true,
  maxDurationMs: 300000, // 5 minutes
  maxChunks: 10000,
};

/**
 * StreamRecorder
 *
 * Records stream chunks for later caching and replay.
 *
 * @example
 * ```typescript
 * const recorder = new StreamRecorder({
 *   captureToolCalls: true
 * });
 *
 * recorder.start('gpt-4', messages);
 *
 * for await (const chunk of stream) {
 *   recorder.recordChunk({ type: 'text', content: chunk.content });
 * }
 *
 * const recorded = recorder.complete();
 * ```
 */
export class StreamRecorder {
  private config: Required<StreamRecorderConfig>;
  private buffer: ChunkBuffer;
  private recording = false;
  private startTime = 0;
  private model = '';
  private messages: Array<{ role: string; content: string }> = [];
  private key = '';
  private totalChars = 0;
  private chunkIndex = 0;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(config?: StreamRecorderConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      buffer: { ...DEFAULT_CONFIG.buffer, ...config?.buffer },
    };
    this.buffer = new ChunkBuffer(this.config.buffer);
  }

  /**
   * Start recording a new stream
   */
  start(
    model: string,
    messages: Array<{ role: string; content: string }>,
    key?: string,
  ): void {
    if (this.recording) {
      throw new Error('Recording already in progress');
    }

    this.recording = true;
    this.startTime = now();
    this.model = model;
    this.messages = messages;
    this.key = key ?? generateId();
    this.totalChars = 0;
    this.chunkIndex = 0;
    this.buffer.clear();

    // Set timeout for max duration
    if (this.config.maxDurationMs > 0) {
      this.timeoutId = setTimeout(() => {
        if (this.recording) {
          this.abort('Recording exceeded maximum duration');
        }
      }, this.config.maxDurationMs);
    }
  }

  /**
   * Record a text chunk
   */
  recordText(content: string, metadata?: Record<string, unknown>): void {
    this.recordChunk({
      type: 'text',
      content,
      metadata: this.config.captureMetadata ? metadata : undefined,
      timestamp: now(),
      index: this.chunkIndex++,
    });
    this.totalChars += content.length;
  }

  /**
   * Record a tool call chunk
   */
  recordToolCall(
    id: string,
    name: string,
    args: string,
    metadata?: Record<string, unknown>,
  ): void {
    if (!this.config.captureToolCalls) return;

    this.recordChunk({
      type: 'tool_call',
      toolCall: { id, name, arguments: args },
      metadata: this.config.captureMetadata ? metadata : undefined,
      timestamp: now(),
      index: this.chunkIndex++,
    });
  }

  /**
   * Record a tool result chunk
   */
  recordToolResult(
    callId: string,
    content: string,
    metadata?: Record<string, unknown>,
  ): void {
    if (!this.config.captureToolCalls) return;

    this.recordChunk({
      type: 'tool_result',
      toolResult: { callId, content },
      metadata: this.config.captureMetadata ? metadata : undefined,
      timestamp: now(),
      index: this.chunkIndex++,
    });
  }

  /**
   * Record metadata
   */
  recordMetadata(metadata: Record<string, unknown>): void {
    if (!this.config.captureMetadata) return;

    this.recordChunk({
      type: 'metadata',
      metadata,
      timestamp: now(),
      index: this.chunkIndex++,
    });
  }

  /**
   * Record a generic chunk
   */
  recordChunk(chunk: StreamChunk): void {
    if (!this.recording) {
      throw new Error('Not currently recording');
    }

    // Check if we've already recorded maxChunks (chunk.index is 0-based, already incremented)
    if (chunk.index >= this.config.maxChunks) {
      throw new Error('Maximum chunks exceeded');
    }

    this.buffer.add(chunk);
  }

  /**
   * Complete the recording and return the recorded stream
   */
  complete(tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  }): RecordedStream {
    if (!this.recording) {
      throw new Error('Not currently recording');
    }

    this.clearTimeout();
    const endTime = now();
    const chunks = this.buffer.flush();

    const stream: RecordedStream = {
      id: generateId(),
      key: this.key,
      chunks,
      model: this.model,
      messages: this.messages,
      startTime: this.startTime,
      endTime,
      durationMs: endTime - this.startTime,
      totalChars: this.totalChars,
      tokenUsage,
      complete: true,
    };

    this.reset();
    return stream;
  }

  /**
   * Abort the recording
   */
  abort(reason?: string): RecordedStream {
    if (!this.recording) {
      throw new Error('Not currently recording');
    }

    this.clearTimeout();
    const endTime = now();
    const chunks = this.buffer.flush();

    const stream: RecordedStream = {
      id: generateId(),
      key: this.key,
      chunks,
      model: this.model,
      messages: this.messages,
      startTime: this.startTime,
      endTime,
      durationMs: endTime - this.startTime,
      totalChars: this.totalChars,
      complete: false,
      error: reason ?? 'Recording aborted',
    };

    this.reset();
    return stream;
  }

  /**
   * Check if currently recording
   */
  isRecording(): boolean {
    return this.recording;
  }

  /**
   * Get current chunk count
   */
  getChunkCount(): number {
    return this.chunkIndex;
  }

  /**
   * Get current recording duration in ms
   */
  getDuration(): number {
    if (!this.recording) return 0;
    return now() - this.startTime;
  }

  /**
   * Destroy the recorder
   */
  destroy(): void {
    this.clearTimeout();
    this.buffer.destroy();
    this.reset();
  }

  private reset(): void {
    this.recording = false;
    this.startTime = 0;
    this.model = '';
    this.messages = [];
    this.key = '';
    this.totalChars = 0;
    this.chunkIndex = 0;
  }

  private clearTimeout(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}

/**
 * Create a StreamRecorder instance
 */
export function createStreamRecorder(
  config?: StreamRecorderConfig,
): StreamRecorder {
  return new StreamRecorder(config);
}
