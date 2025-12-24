/**
 * Streaming Types
 *
 * Type definitions for streaming cache functionality.
 */

/**
 * Stream chunk types
 */
export type StreamChunkType = 'text' | 'tool_call' | 'tool_result' | 'metadata';

/**
 * Individual stream chunk
 */
export interface StreamChunk {
  /** Chunk type */
  type: StreamChunkType;
  /** Text content for text chunks */
  content?: string;
  /** Tool call information */
  toolCall?: {
    id: string;
    name: string;
    arguments: string;
  };
  /** Tool result */
  toolResult?: {
    callId: string;
    content: string;
  };
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Timestamp when chunk was received */
  timestamp: number;
  /** Index in the stream sequence */
  index: number;
}

/**
 * Complete recorded stream
 */
export interface RecordedStream {
  /** Unique stream ID */
  id: string;
  /** Cache key for this stream */
  key: string;
  /** All chunks in order */
  chunks: StreamChunk[];
  /** Model used */
  model: string;
  /** Original request messages */
  messages: Array<{ role: string; content: string }>;
  /** Stream start time */
  startTime: number;
  /** Stream end time */
  endTime: number;
  /** Total duration in ms */
  durationMs: number;
  /** Total characters streamed */
  totalChars: number;
  /** Token usage if available */
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
  /** Whether stream completed normally */
  complete: boolean;
  /** Error if stream failed */
  error?: string;
}

/**
 * Stream buffer configuration
 */
export interface ChunkBufferConfig {
  /** Maximum chunks to buffer before flushing */
  maxChunks?: number;
  /** Maximum bytes to buffer before flushing */
  maxBytes?: number;
  /** Flush interval in ms */
  flushIntervalMs?: number;
  /** Whether to preserve chunk order strictly */
  preserveOrder?: boolean;
}

/**
 * Stream recorder configuration
 */
export interface StreamRecorderConfig {
  /** Buffer configuration */
  buffer?: ChunkBufferConfig;
  /** Whether to capture tool calls */
  captureToolCalls?: boolean;
  /** Whether to capture metadata */
  captureMetadata?: boolean;
  /** Maximum stream duration in ms */
  maxDurationMs?: number;
  /** Maximum chunks to record */
  maxChunks?: number;
}

/**
 * Stream replayer configuration
 */
export interface StreamReplayerConfig {
  /** Playback speed multiplier (1 = real-time) */
  speedMultiplier?: number;
  /** Minimum delay between chunks in ms */
  minDelayMs?: number;
  /** Maximum delay between chunks in ms */
  maxDelayMs?: number;
  /** Whether to simulate original timing */
  simulateTiming?: boolean;
  /** Callback for each chunk */
  onChunk?: (chunk: StreamChunk) => void;
  /** Callback on completion */
  onComplete?: (stream: RecordedStream) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

/**
 * Stream cache configuration
 */
export interface StreamCacheConfig {
  /** Recorder configuration */
  recorder?: StreamRecorderConfig;
  /** Replayer configuration */
  replayer?: StreamReplayerConfig;
  /** Whether to cache incomplete streams */
  cacheIncomplete?: boolean;
  /** Minimum stream length to cache (chars) */
  minLengthToCache?: number;
  /** TTL for cached streams in seconds */
  streamTtl?: number;
}

/**
 * Stream cache lookup result
 */
export interface StreamCacheLookupResult {
  /** Whether a cached stream was found */
  hit: boolean;
  /** Cached stream if found */
  stream?: RecordedStream;
  /** Similarity score if semantic match */
  similarity?: number;
  /** Match source */
  source: 'exact' | 'semantic' | 'miss';
  /** Lookup latency in ms */
  latencyMs: number;
}

/**
 * Stream cache stats
 */
export interface StreamCacheStats {
  /** Total stream lookups */
  totalLookups: number;
  /** Total stream hits */
  totalHits: number;
  /** Total stream misses */
  totalMisses: number;
  /** Hit rate percentage */
  hitRate: number;
  /** Average replay latency in ms */
  avgReplayLatencyMs: number;
  /** Total streams cached */
  totalStreamsCached: number;
  /** Total bytes cached */
  totalBytesCached: number;
  /** Average stream duration in ms */
  avgStreamDurationMs: number;
}
