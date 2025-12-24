/**
 * AgentMemory
 *
 * Integration with AgentSea core agent system.
 */

import { EventEmitter } from 'eventemitter3';
import type {
  MemoryEntry,
  MemoryStoreInterface,
  ScoredMemory,
} from '../types/index.js';
import { MemoryManager } from '../core/MemoryManager.js';
import { WorkingMemory } from '../structures/WorkingMemory.js';
import { EpisodicMemory } from '../structures/EpisodicMemory.js';
import { SemanticMemory } from '../structures/SemanticMemory.js';

/**
 * Agent memory configuration
 */
export interface AgentMemoryConfig {
  agentId: string;
  namespace?: string;
  store: MemoryStoreInterface;
  embedFn?: (text: string) => Promise<number[]>;
  workingMemorySize?: number;
  autoConsolidate?: boolean;
}

/**
 * Conversation turn
 */
export interface ConversationTurn {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Agent memory events
 */
export interface AgentMemoryEvents {
  memoryAdded: (entry: MemoryEntry) => void;
  memoryRetrieved: (entries: MemoryEntry[], query: string) => void;
  conversationUpdated: (turn: ConversationTurn) => void;
  contextUpdated: (context: MemoryEntry[]) => void;
}

/**
 * Agent memory integration for AgentSea
 */
export class AgentMemory extends EventEmitter<AgentMemoryEvents> {
  private agentId: string;
  private namespace: string;
  private workingMemorySize: number;
  private store: MemoryStoreInterface;
  private manager: MemoryManager;
  private working: WorkingMemory;
  private episodic: EpisodicMemory;
  private semantic: SemanticMemory;
  private conversationHistory: ConversationTurn[] = [];

  constructor(config: AgentMemoryConfig) {
    super();
    this.agentId = config.agentId;
    this.namespace = config.namespace ?? 'default';
    this.workingMemorySize = config.workingMemorySize ?? 20;
    this.store = config.store;

    // Initialize components
    this.manager = new MemoryManager({
      store: config.store,
      defaultNamespace: this.namespace,
    });

    this.working = new WorkingMemory(config.store, {
      maxSize: this.workingMemorySize,
    });

    this.episodic = new EpisodicMemory(config.store);
    this.semantic = new SemanticMemory(config.store);

    // Set up event forwarding
    this.setupEventForwarding();
  }

  /**
   * Remember information
   */
  async remember(
    content: string,
    options?: {
      type?: MemoryEntry['type'];
      importance?: number;
      tags?: string[];
      metadata?: Record<string, unknown>;
    },
  ): Promise<string> {
    const entryId = await this.manager.add({
      content,
      type: options?.type ?? 'context',
      importance: options?.importance ?? 0.5,
      metadata: {
        source: 'explicit' as const,
        confidence: 1.0,
        ...options?.metadata,
        agentId: this.agentId,
        tags: options?.tags,
      },
    });

    // Get the entry for working memory
    const entry = await this.manager.get(entryId);
    if (entry) {
      await this.working.add(entry);
      this.emit('memoryAdded', entry);
    }
    return entryId;
  }

  /**
   * Recall information
   */
  async recall(
    query: string,
    options?: {
      limit?: number;
      minScore?: number;
      types?: string[];
      includeContext?: boolean;
    },
  ): Promise<MemoryEntry[]> {
    // Update working memory context
    this.working.setQuery(query);

    // Search long-term memory
    const results = await this.manager.retrieve(query, {
      limit: options?.limit ?? 10,
      minScore: options?.minScore ?? 0.5,
    });

    // Extract entries from scored results
    const entries = results.map((r) => r.entry);

    // Combine with working memory context
    let combined = entries;
    if (options?.includeContext !== false) {
      const workingContext = this.working.getFocused(5);
      const workingIds = new Set(workingContext.map((e) => e.id));
      combined = [
        ...workingContext,
        ...entries.filter((e) => !workingIds.has(e.id)),
      ];
    }

    this.emit('memoryRetrieved', combined, query);
    return combined;
  }

  /**
   * Learn a fact
   */
  async learnFact(
    content: string,
    options?: {
      confidence?: number;
      source?: string;
    },
  ): Promise<string> {
    const fact = await this.semantic.learnFact(content, {
      agentId: this.agentId,
      confidence: options?.confidence ?? 0.8,
      source: options?.source,
    });

    this.emit('memoryAdded', fact);
    return fact.id;
  }

  /**
   * Record an event/experience
   */
  async recordEvent(
    content: string,
    options?: {
      importance?: number;
      participants?: string[];
      location?: string;
    },
  ): Promise<string> {
    const entry: MemoryEntry = {
      id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      content,
      type: 'event',
      importance: options?.importance ?? 0.5,
      metadata: {
        source: 'explicit' as const,
        confidence: 1.0,
        agentId: this.agentId,
        namespace: this.namespace,
        participants: options?.participants,
        location: options?.location,
      },
      timestamp: Date.now(),
      accessCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await this.episodic.recordEvent(entry);
    this.emit('memoryAdded', entry);

    return entry.id;
  }

  /**
   * Add a conversation turn
   */
  async addConversationTurn(turn: ConversationTurn): Promise<void> {
    const fullTurn: ConversationTurn = {
      ...turn,
      timestamp: turn.timestamp ?? Date.now(),
    };

    this.conversationHistory.push(fullTurn);

    // Store as memory if significant
    if (turn.content.length > 20) {
      await this.remember(`[${turn.role}]: ${turn.content}`, {
        type: 'context',
        importance: turn.role === 'user' ? 0.7 : 0.5,
        metadata: {
          conversationTurn: true,
          role: turn.role,
          ...turn.metadata,
        },
      });
    }

    this.emit('conversationUpdated', fullTurn);
  }

  /**
   * Get recent conversation
   */
  getRecentConversation(turns: number = 10): ConversationTurn[] {
    return this.conversationHistory.slice(-turns);
  }

  /**
   * Format conversation for LLM context
   */
  formatConversationForContext(turns: number = 10): string {
    return this.getRecentConversation(turns)
      .map((turn) => `${turn.role}: ${turn.content}`)
      .join('\n');
  }

  /**
   * Get working memory context
   */
  getWorkingContext(): MemoryEntry[] {
    return this.working.getContext();
  }

  /**
   * Clear working memory
   */
  clearWorkingMemory(): void {
    this.working.clear();
  }

  /**
   * Clear conversation history
   */
  clearConversation(): void {
    this.conversationHistory = [];
  }

  /**
   * Forget a specific memory
   */
  async forget(id: string): Promise<boolean> {
    return Promise.resolve(this.manager.delete(id));
  }

  /**
   * Update a memory
   */
  update(
    id: string,
    updates: {
      content?: string;
      importance?: number;
      metadata?: Record<string, unknown>;
    },
  ): Promise<boolean> {
    return Promise.resolve(this.manager.update(id, updates));
  }

  /**
   * Search by semantic similarity
   */
  async searchSimilar(
    text: string,
    options?: { topK?: number; minScore?: number },
  ): Promise<ScoredMemory[]> {
    return this.manager.retrieve(text, {
      limit: options?.topK ?? 10,
      minScore: options?.minScore,
    });
  }

  /**
   * Get memory by ID
   */
  get(id: string): Promise<MemoryEntry | null> {
    return Promise.resolve(this.manager.get(id));
  }

  /**
   * Get agent statistics
   */
  async getStats(): Promise<{
    totalMemories: number;
    workingMemorySize: number;
    conversationLength: number;
    currentEpisode: { eventCount: number } | null;
    factCount: number;
  }> {
    const stats = await this.manager.getStats();
    const semanticStats = this.semantic.getStats();
    const currentEpisode = this.episodic.getCurrentEpisode();

    return {
      totalMemories: stats.byType
        ? Object.values(stats.byType).reduce((a, b) => a + b, 0)
        : 0,
      workingMemorySize: this.working.size,
      conversationLength: this.conversationHistory.length,
      currentEpisode: currentEpisode
        ? { eventCount: currentEpisode.events.length }
        : null,
      factCount: semanticStats.conceptCount,
    };
  }

  /**
   * Consolidate memories
   */
  async consolidate(): Promise<number> {
    return Promise.resolve(this.working.consolidate(this.store));
  }

  /**
   * Get related concepts
   */
  getRelatedConcepts(conceptId: string, depth: number = 1) {
    return Promise.resolve(
      this.semantic.getRelatedConcepts(conceptId, undefined, depth),
    );
  }

  /**
   * Export agent memory
   */
  async export(): Promise<{
    agentId: string;
    namespace: string;
    conversationHistory: ConversationTurn[];
    workingContext: MemoryEntry[];
    stats: Awaited<ReturnType<AgentMemory['getStats']>>;
    exportedAt: number;
  }> {
    return {
      agentId: this.agentId,
      namespace: this.namespace,
      conversationHistory: [...this.conversationHistory],
      workingContext: this.working.getContext(),
      stats: await this.getStats(),
      exportedAt: Date.now(),
    };
  }

  /**
   * Set up event forwarding
   */
  private setupEventForwarding(): void {
    this.working.on('contextUpdate', (context) => {
      this.emit('contextUpdated', context);
    });
  }

  /**
   * Access underlying components
   */
  get components() {
    return {
      manager: this.manager,
      working: this.working,
      episodic: this.episodic,
      semantic: this.semantic,
    };
  }
}

/**
 * Create agent memory
 */
export function createAgentMemory(config: AgentMemoryConfig): AgentMemory {
  return new AgentMemory(config);
}
