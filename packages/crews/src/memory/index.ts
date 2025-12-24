/**
 * Memory Module
 *
 * Shared memory, conversation history, and knowledge management.
 */

// Shared memory
export {
  SharedMemory,
  createSharedMemory,
  type SharedMemoryConfig,
  type MemoryChangeEvent,
  type MemoryNamespace,
} from './SharedMemory';

// Conversation history
export {
  ConversationHistory,
  createConversationHistory,
  type ConversationHistoryConfig,
  type ConversationMessage,
  type MultiAgentMessage,
  type ConversationThread,
  type MessageRole,
} from './ConversationHistory';

// Knowledge base
export {
  KnowledgeBase,
  createKnowledgeBase,
  type KnowledgeBaseConfig,
  type KnowledgeItem,
  type KnowledgeType,
  type KnowledgeQueryOptions,
} from './KnowledgeBase';
