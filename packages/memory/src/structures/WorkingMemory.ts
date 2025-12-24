/**
 * WorkingMemory
 *
 * Short-term, context-focused memory with limited capacity.
 * Implements a sliding window for recent context.
 */

import { EventEmitter } from 'eventemitter3';
import type {
  MemoryEntry,
  WorkingMemoryConfig,
  MemoryStoreInterface,
} from '../types/index.js';

/**
 * Working memory events
 */
export interface WorkingMemoryEvents {
  overflow: (evicted: MemoryEntry[]) => void;
  contextUpdate: (context: MemoryEntry[]) => void;
  attention: (entry: MemoryEntry, score: number) => void;
}

/**
 * Attention score for a memory entry
 */
export interface AttentionScore {
  entry: MemoryEntry;
  relevance: number;
  recency: number;
  importance: number;
  total: number;
}

/**
 * Working memory for short-term context management
 */
export class WorkingMemory extends EventEmitter<WorkingMemoryEvents> {
  private store: MemoryStoreInterface;
  private config: Required<WorkingMemoryConfig>;
  private contextWindow: MemoryEntry[] = [];
  private attentionBuffer: Map<string, number> = new Map();
  private currentQuery: string = '';

  constructor(store: MemoryStoreInterface, config: WorkingMemoryConfig = {}) {
    super();
    this.store = store;
    this.config = {
      maxItems: config.maxItems ?? 20,
      maxSize: config.maxSize ?? 20,
      ttl: config.ttl ?? 300000, // 5 minutes default
      importance: config.importance ?? 'recency',
      onEvict: config.onEvict ?? (() => {}),
      attentionWindow: config.attentionWindow ?? 5,
      decayRate: config.decayRate ?? 0.1,
      relevanceThreshold: config.relevanceThreshold ?? 0.3,
      autoEvict: config.autoEvict ?? true,
    };
  }

  /**
   * Add an entry to working memory
   */
  async add(entry: MemoryEntry): Promise<void> {
    // Check if already in context
    const existingIdx = this.contextWindow.findIndex((e) => e.id === entry.id);
    if (existingIdx !== -1) {
      // Move to front (most recent)
      this.contextWindow.splice(existingIdx, 1);
    }

    // Add to front
    this.contextWindow.unshift(entry);

    // Set initial attention
    this.attentionBuffer.set(entry.id, 1.0);

    // Handle overflow
    if (this.contextWindow.length > this.config.maxSize) {
      await this.evictLowestAttention();
    }

    this.emit('contextUpdate', this.contextWindow);
  }

  /**
   * Get all entries in working memory
   */
  getContext(): MemoryEntry[] {
    return [...this.contextWindow];
  }

  /**
   * Get entries with attention scores
   */
  getContextWithAttention(): AttentionScore[] {
    return this.contextWindow.map((entry, index) => {
      const recency = 1 - index / this.config.maxSize;
      const attention = this.attentionBuffer.get(entry.id) ?? 0;
      const relevance = this.calculateRelevance(entry);
      const importance = entry.importance;

      const total =
        recency * 0.3 + attention * 0.3 + relevance * 0.25 + importance * 0.15;

      return {
        entry,
        relevance,
        recency,
        importance,
        total,
      };
    });
  }

  /**
   * Update attention for an entry (e.g., when referenced)
   */
  attend(id: string): void {
    const current = this.attentionBuffer.get(id) ?? 0;
    const newScore = Math.min(current + 0.2, 1.0);
    this.attentionBuffer.set(id, newScore);

    const entry = this.contextWindow.find((e) => e.id === id);
    if (entry) {
      this.emit('attention', entry, newScore);
    }
  }

  /**
   * Set the current query/context for relevance calculation
   */
  setQuery(query: string): void {
    this.currentQuery = query;
  }

  /**
   * Decay attention scores
   */
  decay(): void {
    for (const [id, score] of this.attentionBuffer) {
      const newScore = score * (1 - this.config.decayRate);
      if (newScore < 0.01) {
        this.attentionBuffer.delete(id);
      } else {
        this.attentionBuffer.set(id, newScore);
      }
    }
  }

  /**
   * Get the most attended entries
   */
  getFocused(limit: number = 5): MemoryEntry[] {
    const scored = this.getContextWithAttention();
    scored.sort((a, b) => b.total - a.total);
    return scored.slice(0, limit).map((s) => s.entry);
  }

  /**
   * Clear working memory
   */
  clear(): void {
    const evicted = [...this.contextWindow];
    this.contextWindow = [];
    this.attentionBuffer.clear();
    this.emit('overflow', evicted);
    this.emit('contextUpdate', []);
  }

  /**
   * Remove a specific entry
   */
  remove(id: string): boolean {
    const idx = this.contextWindow.findIndex((e) => e.id === id);
    if (idx === -1) return false;

    this.contextWindow.splice(idx, 1);
    this.attentionBuffer.delete(id);
    this.emit('contextUpdate', this.contextWindow);
    return true;
  }

  /**
   * Get current size
   */
  get size(): number {
    return this.contextWindow.length;
  }

  /**
   * Check if at capacity
   */
  get isFull(): boolean {
    return this.contextWindow.length >= this.config.maxSize;
  }

  /**
   * Consolidate important items to long-term storage
   */
  async consolidate(targetStore: MemoryStoreInterface): Promise<number> {
    const scored = this.getContextWithAttention();
    const toConsolidate = scored.filter(
      (s) => s.total > this.config.relevanceThreshold,
    );

    let count = 0;
    for (const { entry } of toConsolidate) {
      await targetStore.add(entry);
      count++;
    }

    return count;
  }

  /**
   * Load context from store
   */
  async loadFromStore(options?: {
    namespace?: string;
    userId?: string;
    conversationId?: string;
    limit?: number;
  }): Promise<void> {
    const { entries } = await this.store.query({
      namespace: options?.namespace,
      userId: options?.userId,
      conversationId: options?.conversationId,
      limit: options?.limit ?? this.config.maxSize,
    });

    this.contextWindow = entries;
    this.attentionBuffer.clear();
    for (const entry of entries) {
      this.attentionBuffer.set(entry.id, 0.5);
    }

    this.emit('contextUpdate', this.contextWindow);
  }

  /**
   * Calculate relevance to current query
   */
  private calculateRelevance(entry: MemoryEntry): number {
    if (!this.currentQuery) return 0.5;

    // Simple keyword matching
    const queryWords = this.currentQuery.toLowerCase().split(/\s+/);
    const contentWords = entry.content.toLowerCase();

    let matches = 0;
    for (const word of queryWords) {
      if (word.length > 2 && contentWords.includes(word)) {
        matches++;
      }
    }

    return queryWords.length > 0 ? matches / queryWords.length : 0;
  }

  /**
   * Evict entry with lowest attention
   */
  private async evictLowestAttention(): Promise<void> {
    const scored = this.getContextWithAttention();
    scored.sort((a, b) => a.total - b.total);

    const toEvict = scored[0];
    if (toEvict) {
      const idx = this.contextWindow.findIndex(
        (e) => e.id === toEvict.entry.id,
      );
      if (idx !== -1) {
        const evicted = this.contextWindow.splice(idx, 1);
        this.attentionBuffer.delete(toEvict.entry.id);
        this.emit('overflow', evicted);
      }
    }
    return Promise.resolve();
  }

  /**
   * Get summary of working memory state
   */
  getSummary(): {
    size: number;
    maxSize: number;
    avgAttention: number;
    topTypes: Record<string, number>;
  } {
    const types: Record<string, number> = {};
    let totalAttention = 0;

    for (const entry of this.contextWindow) {
      types[entry.type] = (types[entry.type] ?? 0) + 1;
      totalAttention += this.attentionBuffer.get(entry.id) ?? 0;
    }

    return {
      size: this.contextWindow.length,
      maxSize: this.config.maxSize,
      avgAttention:
        this.contextWindow.length > 0
          ? totalAttention / this.contextWindow.length
          : 0,
      topTypes: types,
    };
  }
}

/**
 * Create working memory instance
 */
export function createWorkingMemory(
  store: MemoryStoreInterface,
  config?: WorkingMemoryConfig,
): WorkingMemory {
  return new WorkingMemory(store, config);
}
