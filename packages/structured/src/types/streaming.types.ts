/**
 * Streaming Types
 *
 * Type definitions for streaming structured output.
 */

import type { TokenUsage } from './core.types.js';

/**
 * Streaming options
 */
export interface StreamingOptions {
  /** Yield partial objects as fields complete */
  yieldPartials?: boolean;
  /** Validate partial objects */
  validatePartials?: boolean;
  /** Minimum fields before yielding */
  minFieldsBeforeYield?: number;
  /** Field completion callback */
  onFieldComplete?: (path: string, value: unknown) => void;
  /** Partial update callback */
  onPartial?: (partial: unknown, path: string | null) => void;
  /** Error callback */
  onError?: (error: Error) => void;
}

/**
 * Streaming result
 */
export interface StreamingResult<T> {
  /** Async iterator for partial objects */
  partials(): AsyncIterableIterator<Partial<T>>;

  /** Async iterator for field updates */
  fields(): AsyncIterableIterator<FieldUpdate>;

  /** Get final complete object */
  final(): Promise<T>;

  /** Register partial update callback */
  onPartial(callback: (partial: Partial<T>, path: string | null) => void): void;

  /** Register field complete callback */
  onField(callback: (path: string, value: unknown) => void): void;

  /** Register completion callback */
  onComplete(callback: (result: T) => void): void;

  /** Register error callback */
  onError(callback: (error: Error) => void): void;

  /** Cancel the stream */
  cancel(): void;

  /** Whether streaming is complete */
  readonly isComplete: boolean;

  /** Current partial state */
  readonly current: Partial<T>;
}

/**
 * Field update event
 */
export interface FieldUpdate {
  /** Field path (e.g., 'user.name', 'items[0].id') */
  path: string;
  /** Field value */
  value: unknown;
  /** Whether the field is complete */
  complete: boolean;
  /** Timestamp */
  timestamp: number;
}

/**
 * Partial object state
 */
export interface PartialState<T> {
  /** Current partial data */
  data: Partial<T>;
  /** Completed field paths */
  completedFields: string[];
  /** Fields in progress */
  inProgressFields: string[];
  /** Completion percentage (0-100) */
  completionPercent: number;
  /** Is valid according to partial schema */
  isValid: boolean;
}

/**
 * JSON token
 */
export interface JsonToken {
  type: JsonTokenType;
  value: string;
  path: string[];
  complete: boolean;
}

/**
 * JSON token type
 */
export type JsonTokenType =
  | 'object_start'
  | 'object_end'
  | 'array_start'
  | 'array_end'
  | 'key'
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'colon'
  | 'comma';

/**
 * Streaming parser state
 */
export interface ParserState {
  /** Current JSON path */
  currentPath: string[];
  /** Current depth */
  depth: number;
  /** Buffer of incomplete data */
  buffer: string;
  /** Parsed partial object */
  partial: Record<string, unknown>;
  /** Whether in string */
  inString: boolean;
  /** Whether in escape sequence */
  inEscape: boolean;
  /** Current string value being built */
  currentString: string;
  /** Current key being processed */
  currentKey: string | null;
  /** Stack of container types */
  containerStack: ('object' | 'array')[];
}

/**
 * Stream chunk
 */
export interface StreamChunk {
  /** Chunk content */
  content: string;
  /** Whether this is the final chunk */
  isFinal: boolean;
  /** Token usage (if available) */
  usage?: TokenUsage;
  /** Chunk index */
  index: number;
}

/**
 * Stream metadata
 */
export interface StreamMetadata {
  /** Total chunks received */
  totalChunks: number;
  /** Total characters received */
  totalChars: number;
  /** Start time */
  startTime: number;
  /** End time (when complete) */
  endTime?: number;
  /** Token usage */
  usage?: TokenUsage;
  /** Model used */
  model?: string;
}
