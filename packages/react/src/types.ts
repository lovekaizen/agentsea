import type { ToolCall, AgentResponse } from '@lov3kaizen/agentsea-core';

// ============================================================================
// Tool State Types (inspired by TanStack AI)
// ============================================================================

/**
 * Tool call states during execution lifecycle
 */
export type ToolCallState =
  | 'awaiting-input' // Tool call received but no arguments yet
  | 'input-streaming' // Partial arguments being received
  | 'input-complete' // All arguments received, ready to execute
  | 'approval-requested' // Awaiting user approval
  | 'approval-denied' // User denied execution
  | 'executing' // Tool is executing
  | 'result-streaming' // Result is being streamed
  | 'complete' // Tool execution complete
  | 'error'; // Tool execution failed

/**
 * Extended tool call with state tracking
 */
export interface TrackedToolCall extends ToolCall {
  state: ToolCallState;
  needsApproval?: boolean;
  approvalMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
}

// ============================================================================
// Thinking Token Types
// ============================================================================

/**
 * Thinking/reasoning content from models that support it (o1, Claude thinking)
 */
export interface ThinkingPart {
  type: 'thinking';
  content: string;
  isComplete: boolean;
}

// ============================================================================
// Message Types
// ============================================================================

/**
 * Chat message with extended metadata for UI rendering
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: TrackedToolCall[];
  thinking?: ThinkingPart;
  createdAt: Date;
  metadata?: {
    tokensUsed?: number;
    latencyMs?: number;
    model?: string;
    finishReason?: string;
  };
}

/**
 * Stream chunk types for real-time updates
 */
export type ChatStreamChunk =
  | { type: 'content'; content: string; delta: boolean }
  | { type: 'thinking'; content: string; delta: boolean }
  | { type: 'tool_call'; toolCall: TrackedToolCall }
  | { type: 'tool_result'; toolCall: TrackedToolCall }
  | { type: 'tool_state'; toolCallId: string; state: ToolCallState }
  | { type: 'done'; metadata?: ChatMessage['metadata'] }
  | { type: 'error'; error: string };

// ============================================================================
// Connection Adapter Types
// ============================================================================

/**
 * Connection adapter for handling different transport protocols
 */
export interface ConnectionAdapter {
  connect(url: string, options?: ConnectionOptions): Promise<void>;
  send(data: ChatRequest): Promise<void>;
  onMessage(callback: (chunk: ChatStreamChunk) => void): void;
  onError(callback: (error: Error) => void): void;
  onClose(callback: () => void): void;
  close(): void;
}

/**
 * Connection options
 */
export interface ConnectionOptions {
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeout?: number;
}

/**
 * Request sent to the chat endpoint
 */
export interface ChatRequest {
  messages: ChatMessage[];
  conversationId?: string;
  agentId?: string;
  stream?: boolean;
  toolApprovals?: ToolApprovalResponse[];
}

/**
 * Tool approval response from user
 */
export interface ToolApprovalResponse {
  toolCallId: string;
  approved: boolean;
  reason?: string;
}

// ============================================================================
// Hook Configuration Types
// ============================================================================

/**
 * Configuration for useChat hook
 */
export interface UseChatConfig {
  /** API endpoint for chat requests */
  endpoint: string;

  /** Unique conversation ID */
  conversationId?: string;

  /** Agent ID to use */
  agentId?: string;

  /** Initial messages to populate the chat */
  initialMessages?: ChatMessage[];

  /** Connection adapter to use (defaults to fetch with SSE) */
  adapter?: 'sse' | 'http' | ConnectionAdapter;

  /** Additional headers for requests */
  headers?: Record<string, string>;

  /** Called when a message is received */
  onMessage?: (message: ChatMessage) => void;

  /** Called when streaming content updates */
  onContentUpdate?: (content: string) => void;

  /** Called when a tool needs approval */
  onToolApproval?: (toolCall: TrackedToolCall) => void;

  /** Called on error */
  onError?: (error: Error) => void;

  /** Called when chat completes */
  onComplete?: (response: ChatMessage) => void;

  /** Called when thinking tokens are received */
  onThinking?: (thinking: ThinkingPart) => void;

  /** Enable automatic tool approval (default: false) */
  autoApprove?: boolean;

  /** Maximum retry attempts on failure */
  maxRetries?: number;
}

/**
 * Configuration for useAgent hook
 */
export interface UseAgentConfig {
  /** API endpoint for agent requests */
  endpoint: string;

  /** Agent ID to use */
  agentId: string;

  /** Additional headers for requests */
  headers?: Record<string, string>;

  /** Called when agent execution starts */
  onStart?: () => void;

  /** Called when streaming content updates */
  onContentUpdate?: (content: string) => void;

  /** Called when a tool needs approval */
  onToolApproval?: (toolCall: TrackedToolCall) => void;

  /** Called on error */
  onError?: (error: Error) => void;

  /** Called when agent completes */
  onComplete?: (response: AgentResponse) => void;

  /** Called when thinking tokens are received */
  onThinking?: (thinking: ThinkingPart) => void;
}

// ============================================================================
// Hook Return Types
// ============================================================================

/**
 * Return type for useChat hook
 */
export interface UseChatReturn {
  /** All messages in the conversation */
  messages: ChatMessage[];

  /** Current streaming content (before message is complete) */
  streamingContent: string;

  /** Current thinking content */
  thinkingContent: string;

  /** Active tool calls with their states */
  activeToolCalls: TrackedToolCall[];

  /** Whether a request is in progress */
  isLoading: boolean;

  /** Whether currently streaming */
  isStreaming: boolean;

  /** Current error if any */
  error: Error | null;

  /** Send a message */
  sendMessage: (content: string) => Promise<void>;

  /** Approve a tool call */
  approveToolCall: (toolCallId: string) => void;

  /** Deny a tool call */
  denyToolCall: (toolCallId: string, reason?: string) => void;

  /** Stop the current stream */
  stop: () => void;

  /** Clear all messages */
  clear: () => void;

  /** Reload/regenerate the last response */
  reload: () => Promise<void>;

  /** Set messages directly */
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

/**
 * Return type for useAgent hook
 */
export interface UseAgentReturn {
  /** Execute the agent with input */
  execute: (
    input: string,
    context?: Record<string, unknown>,
  ) => Promise<AgentResponse | null>;

  /** Execute the agent with streaming */
  executeStream: (
    input: string,
    context?: Record<string, unknown>,
  ) => AsyncGenerator<ChatStreamChunk, void, unknown>;

  /** Current response content */
  content: string;

  /** Current thinking content */
  thinkingContent: string;

  /** Active tool calls with their states */
  activeToolCalls: TrackedToolCall[];

  /** Whether a request is in progress */
  isLoading: boolean;

  /** Whether currently streaming */
  isStreaming: boolean;

  /** Current error if any */
  error: Error | null;

  /** Response metadata */
  metadata: ChatMessage['metadata'] | null;

  /** Approve a tool call */
  approveToolCall: (toolCallId: string) => void;

  /** Deny a tool call */
  denyToolCall: (toolCallId: string, reason?: string) => void;

  /** Stop the current execution */
  stop: () => void;

  /** Reset state */
  reset: () => void;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a new chat message
 */
export function createMessage(
  role: ChatMessage['role'],
  content: string,
  options?: Partial<ChatMessage>,
): ChatMessage {
  return {
    id: generateId(),
    role,
    content,
    createdAt: new Date(),
    ...options,
  };
}
