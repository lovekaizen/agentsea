/**
 * Recording Types
 *
 * Type definitions for execution recording.
 */

import type {
  ExecutionStep,
  ToolCall,
  Decision,
  AgentState,
  TokenUsage,
  ErrorInfo,
} from './debugger.types.js';

/**
 * Recording status
 */
export type RecordingStatus = 'recording' | 'completed' | 'failed' | 'aborted';

/**
 * Recording
 */
export interface Recording {
  /** Recording ID */
  id: string;
  /** Agent ID */
  agentId: string;
  /** Agent name */
  agentName: string;
  /** Recording status */
  status: RecordingStatus;
  /** Start timestamp */
  startedAt: number;
  /** End timestamp */
  endedAt?: number;
  /** Duration in ms */
  durationMs: number;
  /** Execution steps */
  steps: ExecutionStep[];
  /** Tool calls */
  toolCalls: ToolCall[];
  /** Decisions */
  decisions: Decision[];
  /** Checkpoints */
  checkpoints: Checkpoint[];
  /** Initial state */
  initialState: AgentState;
  /** Final state */
  finalState?: AgentState;
  /** Total token usage */
  tokenUsage: TokenUsage;
  /** Final outcome */
  outcome?: RecordingOutcome;
  /** Error if failed */
  error?: ErrorInfo;
  /** Metadata */
  metadata?: RecordingMetadata;
  /** Version for compatibility */
  version: string;
}

/**
 * Recording outcome
 */
export interface RecordingOutcome {
  /** Success status */
  success: boolean;
  /** Final output */
  output?: unknown;
  /** Output type */
  outputType?: string;
  /** Summary */
  summary?: string;
}

/**
 * Recording metadata
 */
export interface RecordingMetadata {
  /** Model used */
  model?: string;
  /** Provider */
  provider?: string;
  /** Tags */
  tags?: string[];
  /** User ID */
  userId?: string;
  /** Session ID */
  sessionId?: string;
  /** Environment */
  environment?: string;
  /** Total steps */
  totalSteps?: number;
  /** Total tool calls */
  totalToolCalls?: number;
  /** Total decisions */
  totalDecisions?: number;
  /** Has errors */
  hasErrors?: boolean;
  /** Compression used */
  compressionUsed?: boolean;
  /** Recording version */
  recordingVersion?: string;
  /** Custom metadata */
  custom?: Record<string, unknown>;
}

/**
 * Checkpoint
 */
export interface Checkpoint {
  /** Checkpoint ID */
  id: string;
  /** Recording ID */
  recordingId: string;
  /** Checkpoint name */
  name: string;
  /** Description */
  description?: string;
  /** Step index */
  stepIndex: number;
  /** Timestamp */
  timestamp: number;
  /** Agent state at checkpoint */
  state: AgentState;
  /** Automatic or manual */
  automatic: boolean;
  /** Tags */
  tags?: string[];
}

/**
 * Snapshot for state capture
 */
export interface Snapshot {
  /** Snapshot ID */
  id: string;
  /** Recording ID */
  recordingId?: string;
  /** Step index */
  stepIndex: number;
  /** Timestamp */
  timestamp: number;
  /** State data */
  state: AgentState;
  /** Size in bytes (alias for sizeBytes) */
  size?: number;
  /** Size in bytes */
  sizeBytes?: number;
  /** Compressed */
  compressed?: boolean;
}

/**
 * Timeline event
 */
export interface TimelineEvent {
  /** Event ID */
  id: string;
  /** Event type */
  type: TimelineEventType;
  /** Timestamp */
  timestamp: number;
  /** Duration (for spans) */
  durationMs?: number;
  /** Summary */
  summary: string;
  /** Description */
  description?: string;
  /** Step index */
  stepIndex: number;
  /** Details */
  details?: unknown;
  /** Parent event ID */
  parentId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Incremental snapshot (for efficient storage)
 */
export interface IncrementalSnapshot {
  /** Snapshot ID */
  id: string;
  /** Step index */
  stepIndex: number;
  /** Timestamp */
  timestamp: number;
  /** State data */
  state: AgentState;
  /** Size in bytes */
  size: number;
  /** Whether this is a full snapshot */
  isFull: boolean;
  /** Diff from previous snapshot */
  diff?: unknown[];
  /** Previous snapshot ID */
  previousId?: string;
}

/**
 * Timeline event type
 */
export type TimelineEventType =
  | 'start'
  | 'end'
  | 'step'
  | 'input'
  | 'prompt'
  | 'response'
  | 'output'
  | 'tool-call'
  | 'tool-result'
  | 'decision'
  | 'memory-read'
  | 'memory-write'
  | 'checkpoint'
  | 'error'
  | 'handoff'
  | 'delegation'
  | 'custom';

/**
 * Recorder configuration
 */
export interface RecorderConfig {
  /** Include prompts in recording */
  includePrompts?: boolean;
  /** Include responses in recording */
  includeResponses?: boolean;
  /** Include tool calls in recording */
  includeToolCalls?: boolean;
  /** Include memory state in recording */
  includeMemory?: boolean;
  /** Include metadata */
  includeMetadata?: boolean;
  /** Enable compression */
  compression?: boolean;
  /** Maximum size in bytes */
  maxSizeBytes?: number;
  /** Auto-snapshot enabled */
  autoSnapshot?: boolean;
  /** Snapshot interval (steps) */
  snapshotInterval?: number;
  /** Maximum recordings to keep */
  maxRecordings?: number;
  /** Retention in days */
  retentionDays?: number;
  /** Auto-checkpoint interval */
  checkpointInterval?: number;
  /** Include embeddings in recordings */
  includeEmbeddings?: boolean;
  /** Storage adapter */
  storage?: RecordingStorageAdapter;
}

/**
 * Recording storage adapter interface
 */
export interface RecordingStorageAdapter {
  /** Save recording */
  save(recording: Recording): Promise<void>;
  /** Load recording */
  load(id: string): Promise<Recording | null | undefined>;
  /** List recordings */
  list(
    options?: RecordingListOptions,
  ): Promise<RecordingListResult | RecordingSummary[] | unknown[]>;
  /** Delete recording */
  delete(id: string): Promise<boolean>;
  /** Check if recording exists */
  exists?(id: string): Promise<boolean>;
  /** Get storage stats */
  getStats?(): StorageStats | Promise<StorageStats>;
}

/**
 * Recording list options
 */
export interface RecordingListOptions {
  /** Filter by agent ID */
  agentId?: string;
  /** Filter by status */
  status?: RecordingStatus;
  /** Filter by date range */
  startDate?: Date;
  endDate?: Date;
  /** Filter by tags */
  tags?: string[];
  /** Sort order */
  sort?: 'newest' | 'oldest' | 'longest' | 'shortest';
  /** Limit results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Recording list result
 */
export interface RecordingListResult {
  /** Recordings */
  recordings: RecordingSummary[];
  /** Total count */
  total: number;
  /** Has more */
  hasMore: boolean;
}

/**
 * Recording summary (lighter than full recording)
 */
export interface RecordingSummary {
  /** Recording ID */
  id: string;
  /** Agent ID */
  agentId: string;
  /** Agent name */
  agentName: string;
  /** Status */
  status: RecordingStatus;
  /** Start timestamp */
  startedAt: number;
  /** Duration in ms */
  durationMs: number;
  /** Step count */
  stepCount: number;
  /** Tool call count */
  toolCallCount: number;
  /** Token usage */
  tokenUsage: TokenUsage;
  /** Success */
  success: boolean;
  /** Tags */
  tags?: string[];
}

/**
 * Storage stats
 */
export interface StorageStats {
  /** Total recordings */
  totalRecordings: number;
  /** Total size in bytes */
  totalSizeBytes: number;
  /** Oldest recording date */
  oldestRecording?: Date;
  /** Newest recording date */
  newestRecording?: Date;
}
