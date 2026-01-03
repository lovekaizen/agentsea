/**
 * Debugger Types
 *
 * Core type definitions for the debugger.
 */

/**
 * Debug session state
 */
export type DebugSessionState =
  | 'idle'
  | 'running'
  | 'paused'
  | 'stopped'
  | 'completed'
  | 'error';

/**
 * Breakpoint type
 */
export type BreakpointType =
  | 'step'
  | 'tool-call'
  | 'tool-result'
  | 'decision'
  | 'error'
  | 'memory-change'
  | 'custom';

/**
 * Step type in execution
 */
export type StepType =
  | 'input'
  | 'prompt'
  | 'response'
  | 'tool-call'
  | 'tool-result'
  | 'decision'
  | 'memory-read'
  | 'memory-write'
  | 'handoff'
  | 'delegation'
  | 'output'
  | 'error'
  | 'custom';

/**
 * Debugger configuration
 */
export interface DebuggerConfig {
  /** Storage path for debug sessions */
  storagePath?: string;
  /** Recording configuration */
  recording?: RecordingConfig;
  /** Maximum steps to track */
  maxSteps?: number;
  /** Enable auto-checkpoints */
  autoCheckpoint?: boolean;
  /** Checkpoint interval (steps) */
  checkpointInterval?: number;
  /** Enable performance profiling */
  profiling?: boolean;
}

/**
 * Recording configuration
 */
export interface RecordingConfig {
  /** Enable recording */
  enabled?: boolean;
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
  /** Compression enabled */
  compression?: boolean;
  /** Maximum recording size (bytes) */
  maxSizeBytes?: number;
}

/**
 * Breakpoint definition
 */
export interface Breakpoint {
  /** Unique breakpoint ID */
  id: string;
  /** Breakpoint type */
  type: BreakpointType;
  /** Breakpoint condition function */
  condition?: BreakpointCondition;
  /** Step number (for step breakpoints) */
  step?: number;
  /** Tool name (for tool breakpoints) */
  toolName?: string;
  /** Whether breakpoint is enabled */
  enabled: boolean;
  /** Hit count */
  hitCount: number;
  /** Description */
  description?: string;
}

/**
 * Breakpoint condition function
 */
export type BreakpointCondition = (context: BreakpointContext) => boolean;

/**
 * Breakpoint context passed to condition
 */
export interface BreakpointContext {
  /** Current step */
  step: ExecutionStep;
  /** Step index */
  stepIndex: number;
  /** Current state */
  state: AgentState;
  /** Tool call (if applicable) */
  toolCall?: ToolCall;
  /** Decision (if applicable) */
  decision?: Decision;
}

/**
 * Execution step
 */
export interface ExecutionStep {
  /** Step ID */
  id: string;
  /** Step index */
  index: number;
  /** Step type */
  type: StepType;
  /** Timestamp */
  timestamp: number;
  /** Duration in ms */
  durationMs: number;
  /** Input data */
  input?: unknown;
  /** Output data */
  output?: unknown;
  /** Associated tool call */
  toolCall?: ToolCall;
  /** Associated decision */
  decision?: Decision;
  /** Memory state */
  memory?: MemorySnapshot;
  /** Token usage */
  tokenUsage?: TokenUsage;
  /** Metadata */
  metadata?: Record<string, unknown>;
  /** Parent step ID (for nested) */
  parentId?: string;
  /** Child step IDs */
  childIds?: string[];
  /** Error if any */
  error?: ErrorInfo;
}

/**
 * Tool call information
 */
export interface ToolCall {
  /** Tool call ID */
  id: string;
  /** Tool name */
  name: string;
  /** Tool arguments */
  arguments: Record<string, unknown>;
  /** Tool result */
  result?: unknown;
  /** Start timestamp */
  startedAt?: number;
  /** End timestamp */
  endedAt?: number;
  /** Duration in ms */
  durationMs?: number;
  /** Success status */
  success?: boolean;
  /** Error message */
  error?: string;
}

/**
 * Decision made by agent
 */
export interface Decision {
  /** Decision ID */
  id: string;
  /** Decision prompt/context */
  prompt: string;
  /** Options considered */
  options: DecisionOption[];
  /** Chosen option index */
  chosenIndex: number;
  /** Chosen option */
  chosen: DecisionOption;
  /** Confidence score (0-1) */
  confidence: number;
  /** Reasoning explanation */
  reasoning?: string;
  /** Short reason/rationale */
  reason?: string;
  /** Timestamp */
  timestamp: number;
}

/**
 * Decision option
 */
export interface DecisionOption {
  /** Option ID */
  id: string;
  /** Option description */
  description: string;
  /** Option score */
  score?: number;
  /** Would result in */
  predictedOutcome?: string;
}

/**
 * Agent state snapshot
 */
export interface AgentState {
  /** Agent ID */
  agentId: string;
  /** Agent name */
  agentName: string;
  /** Current model */
  model: string;
  /** Memory state */
  memory: MemorySnapshot;
  /** Context/variables */
  context: Record<string, unknown>;
  /** Available tools */
  tools: string[];
  /** Message history */
  messages: Message[];
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Memory snapshot
 */
export interface MemorySnapshot {
  /** Working memory */
  working?: Record<string, unknown>;
  /** Short-term memory */
  shortTerm?: unknown[];
  /** Long-term memory summary */
  longTermSummary?: string;
  /** Memory size in entries */
  size: number;
}

/**
 * Message in conversation
 */
export interface Message {
  /** Role */
  role: 'system' | 'user' | 'assistant' | 'tool';
  /** Content */
  content: string;
  /** Tool call ID (for tool messages) */
  toolCallId?: string;
  /** Tool calls in this message */
  toolCalls?: ToolCall[];
  /** Timestamp */
  timestamp?: number;
}

/**
 * Token usage
 */
export interface TokenUsage {
  /** Prompt tokens */
  prompt: number;
  /** Completion tokens */
  completion: number;
  /** Total tokens */
  total: number;
  /** Cached tokens */
  cached?: number;
}

/**
 * Error information
 */
export interface ErrorInfo {
  /** Error name */
  name: string;
  /** Error message */
  message: string;
  /** Stack trace */
  stack?: string;
  /** Error code */
  code?: string;
  /** Additional data */
  data?: unknown;
}

/**
 * Debug session
 */
export interface DebugSession {
  /** Session ID */
  id: string;
  /** Agent ID */
  agentId: string;
  /** Session state */
  state: DebugSessionState;
  /** Start timestamp */
  startedAt: number;
  /** End timestamp */
  endedAt?: number;
  /** Current step index */
  currentStep: number;
  /** Total steps */
  totalSteps: number;
  /** Breakpoints */
  breakpoints: Breakpoint[];
  /** Checkpoints */
  checkpoints: string[];
  /** Recording ID */
  recordingId?: string;
}

/**
 * Inspector result
 */
export interface InspectorResult {
  /** Current step */
  currentStep: ExecutionStep | null;
  /** Step index */
  stepIndex: number;
  /** Total steps */
  totalSteps: number;
  /** Agent state */
  state: AgentState;
  /** Tool calls so far */
  toolCalls: ToolCall[];
  /** Decisions made */
  decisions: Decision[];
  /** Memory snapshot */
  memory: MemorySnapshot;
  /** Variables/context */
  variables: Record<string, unknown>;
  /** Call stack */
  callStack: string[];
}

/**
 * Step control action
 */
export type StepAction =
  | 'continue'
  | 'step-over'
  | 'step-into'
  | 'step-out'
  | 'stop';
