import { MemoryStore, Message } from '../types';

/**
 * Simple in-memory buffer store for conversation history
 */
export class BufferMemory implements MemoryStore {
  private store = new Map<string, Message[]>();

  constructor(private maxMessages?: number) {}

  /**
   * Save messages to memory
   */
  save(conversationId: string, messages: Message[]): Promise<void> {
    let messagesToStore = messages;

    // Truncate if max messages is set
    if (this.maxMessages && messages.length > this.maxMessages) {
      messagesToStore = messages.slice(-this.maxMessages);
    }

    this.store.set(conversationId, messagesToStore);
    return Promise.resolve();
  }

  /**
   * Load messages from memory
   */
  load(conversationId: string): Promise<Message[]> {
    return Promise.resolve(this.store.get(conversationId) || []);
  }

  /**
   * Clear messages for a conversation
   */
  clear(conversationId: string): Promise<void> {
    this.store.delete(conversationId);
    return Promise.resolve();
  }

  /**
   * Clear all conversations
   */
  clearAll(): void {
    this.store.clear();
  }

  /**
   * Get all conversation IDs
   */
  getConversationIds(): string[] {
    return Array.from(this.store.keys());
  }

  /**
   * Get total number of conversations
   */
  size(): number {
    return this.store.size;
  }
}
