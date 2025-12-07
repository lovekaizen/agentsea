// Components
export { AgentResponse, useFormattedContent } from './AgentResponse';
export { StreamingResponse, useStreamingContent } from './StreamingResponse';
export type { AgentResponseProps } from './AgentResponse';
export type { StreamingResponseProps } from './StreamingResponse';

// Hooks
export { useChat } from './useChat';
export { useAgent } from './useAgent';

// Adapters
export {
  createSSEAdapter,
  createHTTPStreamAdapter,
  fetchChat,
  getAdapter,
} from './adapters';

// Types
export type {
  // Tool states
  ToolCallState,
  TrackedToolCall,

  // Thinking
  ThinkingPart,

  // Messages
  ChatMessage,
  ChatStreamChunk,

  // Connection
  ConnectionAdapter,
  ConnectionOptions,
  ChatRequest,
  ToolApprovalResponse,

  // Hook config
  UseChatConfig,
  UseAgentConfig,

  // Hook returns
  UseChatReturn,
  UseAgentReturn,
} from './types';

// Utilities
export { generateId, createMessage } from './types';
