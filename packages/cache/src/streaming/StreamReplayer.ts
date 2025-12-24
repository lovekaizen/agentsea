/**
 * StreamReplayer
 *
 * Replays cached stream responses.
 */

import type {
  StreamChunk,
  RecordedStream,
  StreamReplayerConfig,
} from '../types/index.js';

/**
 * Default replayer configuration
 */
const DEFAULT_CONFIG: Required<StreamReplayerConfig> = {
  speedMultiplier: 1,
  minDelayMs: 0,
  maxDelayMs: 100,
  simulateTiming: false,
  onChunk: () => {},
  onComplete: () => {},
  onError: () => {},
};

/**
 * StreamReplayer
 *
 * Replays recorded streams as async iterables.
 *
 * @example
 * ```typescript
 * const replayer = new StreamReplayer({
 *   speedMultiplier: 2, // 2x speed
 *   simulateTiming: true
 * });
 *
 * for await (const chunk of replayer.replay(recordedStream)) {
 *   process.stdout.write(chunk.content ?? '');
 * }
 * ```
 */
export class StreamReplayer {
  private config: Required<StreamReplayerConfig>;
  private abortController: AbortController | null = null;

  constructor(config?: StreamReplayerConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Replay a recorded stream as an async iterable
   */
  async *replay(stream: RecordedStream): AsyncGenerator<StreamChunk> {
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    try {
      const chunks = [...stream.chunks].sort((a, b) => a.index - b.index);
      let lastTimestamp = chunks[0]?.timestamp ?? 0;

      for (let i = 0; i < chunks.length; i++) {
        if (signal.aborted) {
          break;
        }

        const chunk = chunks[i];

        // Simulate timing if enabled
        if (this.config.simulateTiming && i > 0) {
          const timeDiff = chunk.timestamp - lastTimestamp;
          const delay = Math.min(
            Math.max(
              timeDiff / this.config.speedMultiplier,
              this.config.minDelayMs,
            ),
            this.config.maxDelayMs,
          );

          if (delay > 0) {
            await this.delay(delay, signal);
          }
        }

        lastTimestamp = chunk.timestamp;
        this.config.onChunk(chunk);
        yield chunk;
      }

      this.config.onComplete(stream);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        this.config.onError(error as Error);
        throw error;
      }
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Replay as a full async iterable of text content only
   */
  async *replayText(stream: RecordedStream): AsyncGenerator<string> {
    for await (const chunk of this.replay(stream)) {
      if (chunk.type === 'text' && chunk.content) {
        yield chunk.content;
      }
    }
  }

  /**
   * Replay synchronously (no timing simulation)
   */
  *replaySync(stream: RecordedStream): Generator<StreamChunk> {
    const chunks = [...stream.chunks].sort((a, b) => a.index - b.index);
    for (const chunk of chunks) {
      this.config.onChunk(chunk);
      yield chunk;
    }
    this.config.onComplete(stream);
  }

  /**
   * Get all chunks at once
   */
  getAllChunks(stream: RecordedStream): StreamChunk[] {
    return [...stream.chunks].sort((a, b) => a.index - b.index);
  }

  /**
   * Get full text content from stream
   */
  getFullText(stream: RecordedStream): string {
    return stream.chunks
      .filter((c) => c.type === 'text' && c.content)
      .sort((a, b) => a.index - b.index)
      .map((c) => c.content)
      .join('');
  }

  /**
   * Get tool calls from stream
   */
  getToolCalls(
    stream: RecordedStream,
  ): Array<{ id: string; name: string; arguments: string }> {
    return stream.chunks
      .filter((c) => c.type === 'tool_call' && c.toolCall)
      .sort((a, b) => a.index - b.index)
      .map((c) => c.toolCall!);
  }

  /**
   * Stop current replay
   */
  stop(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Update configuration
   */
  configure(config: Partial<StreamReplayerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private delay(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(resolve, ms);

      signal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        reject(new DOMException('Aborted', 'AbortError'));
      });
    });
  }
}

/**
 * Create a StreamReplayer instance
 */
export function createStreamReplayer(
  config?: StreamReplayerConfig,
): StreamReplayer {
  return new StreamReplayer(config);
}
