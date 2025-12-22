/**
 * Conversation History
 *
 * Multi-agent conversation tracking and retrieval.
 */

import { nanoid } from 'nanoid';

/**
 * Message role
 */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

/**
 * Conversation message
 */
export interface ConversationMessage {
  id: string;
  role: MessageRole;
  content: string;
  agentName?: string;
  timestamp: Date;
  metadata?: {
    toolCall?: {
      name: string;
      input: unknown;
      output?: unknown;
    };
    tokens?: number;
    model?: string;
    taskId?: string;
  };
}

/**
 * Multi-agent message (with agent attribution)
 */
export interface MultiAgentMessage extends ConversationMessage {
  agentName: string;
  replyTo?: string;
  threadId?: string;
}

/**
 * Conversation thread
 */
export interface ConversationThread {
  id: string;
  title?: string;
  participants: string[];
  messages: MultiAgentMessage[];
  created: Date;
  lastActivity: Date;
}

/**
 * Conversation history configuration
 */
export interface ConversationHistoryConfig {
  /** Maximum messages per agent */
  maxMessagesPerAgent?: number;
  /** Maximum total messages */
  maxTotalMessages?: number;
  /** Enable thread grouping */
  enableThreads?: boolean;
  /** Auto-summarize old conversations */
  autoSummarize?: boolean;
}

/**
 * Conversation history
 *
 * Tracks multi-agent conversations with search and retrieval.
 */
export class ConversationHistory {
  private readonly agentMessages: Map<string, ConversationMessage[]> =
    new Map();
  private readonly threads: Map<string, ConversationThread> = new Map();
  private readonly allMessages: MultiAgentMessage[] = [];
  private readonly config: Required<ConversationHistoryConfig>;
  private currentThreadId?: string;

  constructor(config: ConversationHistoryConfig = {}) {
    this.config = {
      maxMessagesPerAgent: config.maxMessagesPerAgent ?? 100,
      maxTotalMessages: config.maxTotalMessages ?? 1000,
      enableThreads: config.enableThreads ?? true,
      autoSummarize: config.autoSummarize ?? false,
    };
  }

  // ============ Message Operations ============

  /**
   * Add a message
   */
  addMessage(
    agentName: string,
    message: Omit<ConversationMessage, 'id' | 'timestamp'>,
  ): MultiAgentMessage {
    const fullMessage: MultiAgentMessage = {
      ...message,
      id: nanoid(),
      agentName,
      timestamp: new Date(),
      threadId: this.currentThreadId,
    };

    // Add to agent messages
    if (!this.agentMessages.has(agentName)) {
      this.agentMessages.set(agentName, []);
    }
    const agentMsgs = this.agentMessages.get(agentName)!;
    agentMsgs.push(fullMessage);

    // Trim if needed
    if (agentMsgs.length > this.config.maxMessagesPerAgent) {
      agentMsgs.shift();
    }

    // Add to all messages
    this.allMessages.push(fullMessage);
    if (this.allMessages.length > this.config.maxTotalMessages) {
      this.allMessages.shift();
    }

    // Add to current thread
    if (this.config.enableThreads && this.currentThreadId) {
      const thread = this.threads.get(this.currentThreadId);
      if (thread) {
        thread.messages.push(fullMessage);
        thread.lastActivity = new Date();

        // Add participant if new
        if (!thread.participants.includes(agentName)) {
          thread.participants.push(agentName);
        }
      }
    }

    return fullMessage;
  }

  /**
   * Add a user message
   */
  addUserMessage(content: string, agentName?: string): MultiAgentMessage {
    return this.addMessage(agentName ?? 'user', {
      role: 'user',
      content,
    });
  }

  /**
   * Add an assistant message
   */
  addAssistantMessage(
    agentName: string,
    content: string,
    metadata?: ConversationMessage['metadata'],
  ): MultiAgentMessage {
    return this.addMessage(agentName, {
      role: 'assistant',
      content,
      metadata,
    });
  }

  /**
   * Add a system message
   */
  addSystemMessage(agentName: string, content: string): MultiAgentMessage {
    return this.addMessage(agentName, {
      role: 'system',
      content,
    });
  }

  /**
   * Add a tool message
   */
  addToolMessage(
    agentName: string,
    toolName: string,
    input: unknown,
    output: unknown,
  ): MultiAgentMessage {
    return this.addMessage(agentName, {
      role: 'tool',
      content: typeof output === 'string' ? output : JSON.stringify(output),
      metadata: {
        toolCall: {
          name: toolName,
          input,
          output,
        },
      },
    });
  }

  // ============ Retrieval ============

  /**
   * Get messages for an agent
   */
  getAgentHistory(
    agentName: string,
    options: {
      limit?: number;
      since?: Date;
      role?: MessageRole;
    } = {},
  ): ConversationMessage[] {
    let messages = this.agentMessages.get(agentName) ?? [];

    if (options.since) {
      messages = messages.filter((m) => m.timestamp >= options.since!);
    }

    if (options.role) {
      messages = messages.filter((m) => m.role === options.role);
    }

    if (options.limit) {
      messages = messages.slice(-options.limit);
    }

    return [...messages];
  }

  /**
   * Get full history
   */
  getFullHistory(
    options: {
      limit?: number;
      since?: Date;
      agents?: string[];
    } = {},
  ): MultiAgentMessage[] {
    let messages = [...this.allMessages];

    if (options.since) {
      messages = messages.filter((m) => m.timestamp >= options.since!);
    }

    if (options.agents) {
      messages = messages.filter((m) => options.agents!.includes(m.agentName));
    }

    if (options.limit) {
      messages = messages.slice(-options.limit);
    }

    return messages;
  }

  /**
   * Get conversation between agents
   */
  getConversation(
    agent1: string,
    agent2: string,
    limit?: number,
  ): MultiAgentMessage[] {
    const messages = this.allMessages.filter(
      (m) => m.agentName === agent1 || m.agentName === agent2,
    );

    if (limit) {
      return messages.slice(-limit);
    }

    return [...messages];
  }

  /**
   * Get recent messages
   */
  getRecent(count: number = 10): MultiAgentMessage[] {
    return this.allMessages.slice(-count);
  }

  /**
   * Search history
   */
  searchHistory(
    query: string,
    options: {
      limit?: number;
      agent?: string;
      caseSensitive?: boolean;
    } = {},
  ): MultiAgentMessage[] {
    const searchQuery = options.caseSensitive ? query : query.toLowerCase();

    let results = this.allMessages.filter((m) => {
      const content = options.caseSensitive
        ? m.content
        : m.content.toLowerCase();
      return content.includes(searchQuery);
    });

    if (options.agent) {
      results = results.filter((m) => m.agentName === options.agent);
    }

    if (options.limit) {
      results = results.slice(-options.limit);
    }

    return results;
  }

  // ============ Thread Operations ============

  /**
   * Create a new thread
   */
  createThread(
    title?: string,
    participants: string[] = [],
  ): ConversationThread {
    const thread: ConversationThread = {
      id: nanoid(),
      title,
      participants,
      messages: [],
      created: new Date(),
      lastActivity: new Date(),
    };

    this.threads.set(thread.id, thread);
    this.currentThreadId = thread.id;

    return thread;
  }

  /**
   * Switch to a thread
   */
  switchThread(threadId: string): boolean {
    if (this.threads.has(threadId)) {
      this.currentThreadId = threadId;
      return true;
    }
    return false;
  }

  /**
   * Get current thread
   */
  getCurrentThread(): ConversationThread | undefined {
    if (!this.currentThreadId) return undefined;
    return this.threads.get(this.currentThreadId);
  }

  /**
   * Get a thread
   */
  getThread(threadId: string): ConversationThread | undefined {
    return this.threads.get(threadId);
  }

  /**
   * Get all threads
   */
  getThreads(): ConversationThread[] {
    return Array.from(this.threads.values()).sort(
      (a, b) => b.lastActivity.getTime() - a.lastActivity.getTime(),
    );
  }

  /**
   * Delete a thread
   */
  deleteThread(threadId: string): boolean {
    if (this.currentThreadId === threadId) {
      this.currentThreadId = undefined;
    }
    return this.threads.delete(threadId);
  }

  // ============ Context Building ============

  /**
   * Build context for an agent (recent conversation)
   */
  buildAgentContext(
    agentName: string,
    maxMessages: number = 20,
  ): ConversationMessage[] {
    return this.getAgentHistory(agentName, { limit: maxMessages });
  }

  /**
   * Build context for LLM (formatted messages)
   */
  buildLLMContext(
    agentName: string,
    options: {
      maxMessages?: number;
      includeSystem?: boolean;
      includeTools?: boolean;
    } = {},
  ): Array<{ role: string; content: string }> {
    const messages = this.getAgentHistory(agentName, {
      limit: options.maxMessages ?? 20,
    });

    return messages
      .filter((m) => {
        if (m.role === 'system' && !options.includeSystem) return false;
        if (m.role === 'tool' && !options.includeTools) return false;
        return true;
      })
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));
  }

  /**
   * Summarize conversation (placeholder for LLM summarization)
   */
  summarize(messages: ConversationMessage[]): string {
    // Simple summary - in practice, this would use an LLM
    const agentSummaries: Record<string, number> = {};
    let totalMessages = 0;
    let toolCalls = 0;

    for (const msg of messages) {
      totalMessages++;
      if ((msg as MultiAgentMessage).agentName) {
        const agent = (msg as MultiAgentMessage).agentName;
        agentSummaries[agent] = (agentSummaries[agent] ?? 0) + 1;
      }
      if (msg.metadata?.toolCall) {
        toolCalls++;
      }
    }

    const parts: string[] = [];
    parts.push(`Conversation with ${totalMessages} messages`);

    if (Object.keys(agentSummaries).length > 0) {
      const agentList = Object.entries(agentSummaries)
        .map(([name, count]) => `${name} (${count})`)
        .join(', ');
      parts.push(`Participants: ${agentList}`);
    }

    if (toolCalls > 0) {
      parts.push(`Tool calls: ${toolCalls}`);
    }

    return parts.join('. ');
  }

  // ============ Utilities ============

  /**
   * Get all participating agents
   */
  getParticipants(): string[] {
    return Array.from(this.agentMessages.keys());
  }

  /**
   * Get message count
   */
  getMessageCount(agentName?: string): number {
    if (agentName) {
      return this.agentMessages.get(agentName)?.length ?? 0;
    }
    return this.allMessages.length;
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.agentMessages.clear();
    this.threads.clear();
    this.allMessages.length = 0;
    this.currentThreadId = undefined;
  }

  /**
   * Clear history for an agent
   */
  clearAgent(agentName: string): void {
    this.agentMessages.delete(agentName);

    // Remove from all messages
    for (let i = this.allMessages.length - 1; i >= 0; i--) {
      if (this.allMessages[i].agentName === agentName) {
        this.allMessages.splice(i, 1);
      }
    }
  }

  /**
   * Export history
   */
  export(): {
    messages: MultiAgentMessage[];
    threads: ConversationThread[];
  } {
    return {
      messages: [...this.allMessages],
      threads: Array.from(this.threads.values()),
    };
  }

  /**
   * Import history
   */
  import(data: {
    messages: MultiAgentMessage[];
    threads?: ConversationThread[];
  }): void {
    // Import messages
    for (const msg of data.messages) {
      // Restore date
      msg.timestamp = new Date(msg.timestamp);

      // Add to agent messages
      if (!this.agentMessages.has(msg.agentName)) {
        this.agentMessages.set(msg.agentName, []);
      }
      this.agentMessages.get(msg.agentName)!.push(msg);

      // Add to all messages
      this.allMessages.push(msg);
    }

    // Import threads
    if (data.threads) {
      for (const thread of data.threads) {
        thread.created = new Date(thread.created);
        thread.lastActivity = new Date(thread.lastActivity);
        for (const msg of thread.messages) {
          msg.timestamp = new Date(msg.timestamp);
        }
        this.threads.set(thread.id, thread);
      }
    }
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalMessages: number;
    messagesByAgent: Record<string, number>;
    messagesByRole: Record<string, number>;
    totalThreads: number;
    averageMessagesPerAgent: number;
  } {
    const messagesByAgent: Record<string, number> = {};
    const messagesByRole: Record<string, number> = {};

    for (const msg of this.allMessages) {
      messagesByAgent[msg.agentName] =
        (messagesByAgent[msg.agentName] ?? 0) + 1;
      messagesByRole[msg.role] = (messagesByRole[msg.role] ?? 0) + 1;
    }

    const agentCount = Object.keys(messagesByAgent).length;

    return {
      totalMessages: this.allMessages.length,
      messagesByAgent,
      messagesByRole,
      totalThreads: this.threads.size,
      averageMessagesPerAgent:
        agentCount > 0 ? this.allMessages.length / agentCount : 0,
    };
  }
}

/**
 * Factory function
 */
export function createConversationHistory(
  config?: ConversationHistoryConfig,
): ConversationHistory {
  return new ConversationHistory(config);
}

export default ConversationHistory;
