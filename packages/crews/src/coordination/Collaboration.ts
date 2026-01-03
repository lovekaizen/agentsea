/**
 * Collaboration Manager
 *
 * Handles agent-to-agent communication and knowledge sharing.
 */

import type { ExecutionContext } from '../core';
import type { CrewAgent } from '../agents';
import type { TaskConfig } from '../types';

/**
 * Collaboration message types
 */
export type CollaborationMessageType =
  | 'request'
  | 'response'
  | 'broadcast'
  | 'acknowledgment'
  | 'knowledge'
  | 'question'
  | 'answer';

/**
 * Collaboration message
 */
export interface CollaborationMessage {
  id: string;
  type: CollaborationMessageType;
  from: string;
  to: string; // Use 'all' for broadcast messages
  content: string;
  metadata?: Record<string, unknown>;
  replyTo?: string;
  timestamp: Date;
}

/**
 * Help request
 */
export interface HelpRequest {
  id: string;
  requester: string;
  task: TaskConfig;
  question: string;
  context?: Record<string, unknown>;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  timestamp: Date;
}

/**
 * Help response
 */
export interface HelpResponse {
  requestId: string;
  responder: string;
  helpful: boolean;
  response: string;
  suggestions?: string[];
  timestamp: Date;
}

/**
 * Knowledge item
 */
export interface Knowledge {
  id: string;
  contributor: string;
  type: 'fact' | 'insight' | 'procedure' | 'example' | 'warning';
  content: string;
  tags: string[];
  confidence: number;
  timestamp: Date;
}

/**
 * Collaboration channel
 */
export interface CollaborationChannel {
  name: string;
  participants: string[];
  messages: CollaborationMessage[];
  created: Date;
}

/**
 * Collaboration manager configuration
 */
export interface CollaborationConfig {
  /** Enable message persistence */
  persistMessages?: boolean;
  /** Maximum messages to keep per channel */
  maxMessagesPerChannel?: number;
  /** Timeout for help requests (ms) */
  helpRequestTimeoutMs?: number;
  /** Enable automatic knowledge extraction */
  autoExtractKnowledge?: boolean;
}

/**
 * Collaboration manager
 *
 * Facilitates communication and collaboration between agents in a crew.
 */
export class CollaborationManager {
  private readonly agents: Map<string, CrewAgent> = new Map();
  private readonly channels: Map<string, CollaborationChannel> = new Map();
  private readonly pendingHelpRequests: Map<string, HelpRequest> = new Map();
  private readonly knowledge: Knowledge[] = [];
  private readonly config: Required<CollaborationConfig>;
  private messageCounter = 0;

  constructor(config: CollaborationConfig = {}) {
    this.config = {
      persistMessages: config.persistMessages ?? true,
      maxMessagesPerChannel: config.maxMessagesPerChannel ?? 1000,
      helpRequestTimeoutMs: config.helpRequestTimeoutMs ?? 30000,
      autoExtractKnowledge: config.autoExtractKnowledge ?? false,
    };

    // Create default broadcast channel
    this.createChannel('broadcast', []);
  }

  /**
   * Register an agent for collaboration
   */
  registerAgent(agent: CrewAgent): void {
    this.agents.set(agent.name, agent);
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentName: string): void {
    this.agents.delete(agentName);
  }

  /**
   * Create a collaboration channel
   */
  createChannel(name: string, participants: string[]): CollaborationChannel {
    const channel: CollaborationChannel = {
      name,
      participants,
      messages: [],
      created: new Date(),
    };
    this.channels.set(name, channel);
    return channel;
  }

  /**
   * Send a message between agents
   */
  sendMessage(
    from: string,
    to: string,
    content: string,
    context: ExecutionContext,
    options: {
      type?: CollaborationMessageType;
      replyTo?: string;
      metadata?: Record<string, unknown>;
    } = {},
  ): Promise<CollaborationMessage> {
    const message: CollaborationMessage = {
      id: `msg-${++this.messageCounter}`,
      type: options.type ?? 'request',
      from,
      to,
      content,
      metadata: options.metadata,
      replyTo: options.replyTo,
      timestamp: new Date(),
    };

    // Store message
    if (this.config.persistMessages) {
      const channelName = to === 'all' ? 'broadcast' : `${from}-${to}`;
      let channel = this.channels.get(channelName);
      if (!channel) {
        channel = this.createChannel(channelName, [from, to]);
      }
      channel.messages.push(message);

      // Trim old messages
      if (channel.messages.length > this.config.maxMessagesPerChannel) {
        channel.messages = channel.messages.slice(
          -this.config.maxMessagesPerChannel,
        );
      }
    }

    // Emit collaboration event
    context.emit({
      type: 'collaboration:message',
      from,
      to,
      messageType: message.type,
      content,
    });

    return Promise.resolve(message);
  }

  /**
   * Broadcast a message to all agents
   */
  async broadcast(
    from: string,
    content: string,
    context: ExecutionContext,
  ): Promise<CollaborationMessage> {
    return this.sendMessage(from, 'all', content, context, {
      type: 'broadcast',
    });
  }

  /**
   * Request help from other agents
   */
  async requestHelp(
    requester: string,
    task: TaskConfig,
    question: string,
    context: ExecutionContext,
    priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal',
  ): Promise<HelpResponse[]> {
    const request: HelpRequest = {
      id: `help-${++this.messageCounter}`,
      requester,
      task,
      question,
      priority,
      timestamp: new Date(),
    };

    this.pendingHelpRequests.set(request.id, request);

    // Emit help request event
    context.emit({
      type: 'collaboration:help_request',
      requestId: request.id,
      requester,
      taskId: task.id!,
      question,
    });

    // Collect responses from available agents
    const responses: HelpResponse[] = [];
    const otherAgents = Array.from(this.agents.values()).filter(
      (a) => a.name !== requester && !a.isBusy,
    );

    // Request help from each agent
    const helpPromises = otherAgents.map(async (agent) => {
      try {
        const response = await this.getHelpFromAgent(agent, request, context);
        return response;
      } catch {
        return null;
      }
    });

    // Wait for responses with timeout
    const results = await Promise.race([
      Promise.allSettled(helpPromises),
      new Promise<PromiseSettledResult<HelpResponse | null>[]>((resolve) =>
        setTimeout(() => resolve([]), this.config.helpRequestTimeoutMs),
      ),
    ]);

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        responses.push(result.value);

        // Emit help response event
        context.emit({
          type: 'collaboration:help_response',
          requestId: request.id,
          responder: result.value.responder,
          helpful: result.value.helpful,
        });
      }
    }

    // Clean up
    this.pendingHelpRequests.delete(request.id);

    return responses;
  }

  /**
   * Get help from a specific agent
   */
  private async getHelpFromAgent(
    agent: CrewAgent,
    request: HelpRequest,
    context: ExecutionContext,
  ): Promise<HelpResponse> {
    // Use agent's help capability if available
    const response = await agent.provideHelp(
      request.task,
      request.question,
      context,
    );

    return {
      requestId: request.id,
      responder: agent.name,
      helpful: response.helpful,
      response: response.response,
      suggestions: response.suggestions,
      timestamp: new Date(),
    };
  }

  /**
   * Share knowledge with the crew
   */
  shareKnowledge(
    contributor: string,
    type: Knowledge['type'],
    content: string,
    tags: string[],
    context: ExecutionContext,
    confidence: number = 0.8,
  ): Knowledge {
    const knowledge: Knowledge = {
      id: `know-${++this.messageCounter}`,
      contributor,
      type,
      content,
      tags,
      confidence,
      timestamp: new Date(),
    };

    this.knowledge.push(knowledge);

    // Emit knowledge sharing event
    context.emit({
      type: 'collaboration:knowledge_shared',
      contributor,
      knowledgeId: knowledge.id,
      knowledgeType: type,
    });

    return knowledge;
  }

  /**
   * Search shared knowledge
   */
  searchKnowledge(query: string, limit: number = 10): Knowledge[] {
    const queryLower = query.toLowerCase();
    const results: Array<{ knowledge: Knowledge; score: number }> = [];

    for (const item of this.knowledge) {
      let score = 0;

      // Check content
      if (item.content.toLowerCase().includes(queryLower)) {
        score += 0.5;
      }

      // Check tags
      for (const tag of item.tags) {
        if (tag.toLowerCase().includes(queryLower)) {
          score += 0.3;
        }
      }

      if (score > 0) {
        results.push({ knowledge: item, score: score * item.confidence });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((r) => r.knowledge);
  }

  /**
   * Get knowledge by type
   */
  getKnowledgeByType(type: Knowledge['type']): Knowledge[] {
    return this.knowledge.filter((k) => k.type === type);
  }

  /**
   * Get knowledge by contributor
   */
  getKnowledgeByContributor(contributor: string): Knowledge[] {
    return this.knowledge.filter((k) => k.contributor === contributor);
  }

  /**
   * Get conversation history between agents
   */
  getConversation(agent1: string, agent2: string): CollaborationMessage[] {
    const channelName1 = `${agent1}-${agent2}`;
    const channelName2 = `${agent2}-${agent1}`;

    const messages: CollaborationMessage[] = [];

    const channel1 = this.channels.get(channelName1);
    if (channel1) {
      messages.push(...channel1.messages);
    }

    const channel2 = this.channels.get(channelName2);
    if (channel2) {
      messages.push(...channel2.messages);
    }

    return messages.sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );
  }

  /**
   * Get all channels an agent participates in
   */
  getAgentChannels(agentName: string): CollaborationChannel[] {
    return Array.from(this.channels.values()).filter(
      (c) => c.participants.includes(agentName) || c.name === 'broadcast',
    );
  }

  /**
   * Clear all collaboration data
   */
  clear(): void {
    this.channels.clear();
    this.pendingHelpRequests.clear();
    this.knowledge.length = 0;
    this.createChannel('broadcast', []);
  }

  /**
   * Get collaboration statistics
   */
  getStatistics(): {
    totalMessages: number;
    totalChannels: number;
    totalKnowledge: number;
    messagesByAgent: Record<string, number>;
    knowledgeByType: Record<string, number>;
  } {
    const messagesByAgent: Record<string, number> = {};
    const knowledgeByType: Record<string, number> = {};
    let totalMessages = 0;

    for (const channel of this.channels.values()) {
      for (const message of channel.messages) {
        totalMessages++;
        messagesByAgent[message.from] =
          (messagesByAgent[message.from] ?? 0) + 1;
      }
    }

    for (const item of this.knowledge) {
      knowledgeByType[item.type] = (knowledgeByType[item.type] ?? 0) + 1;
    }

    return {
      totalMessages,
      totalChannels: this.channels.size,
      totalKnowledge: this.knowledge.length,
      messagesByAgent,
      knowledgeByType,
    };
  }
}

/**
 * Factory function
 */
export function createCollaborationManager(
  config?: CollaborationConfig,
): CollaborationManager {
  return new CollaborationManager(config);
}

export default CollaborationManager;
