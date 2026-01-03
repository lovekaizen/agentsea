/**
 * LongTermMemory
 *
 * Persistent, compressed storage for important memories.
 * Supports consolidation from working/episodic memory.
 */

import { EventEmitter } from 'eventemitter3';
import type {
  MemoryEntry,
  LongTermMemoryConfig,
  MemoryStoreInterface,
  ScoredMemory,
} from '../types/index.js';

/**
 * Consolidated memory summary
 */
export interface ConsolidatedMemory {
  id: string;
  summary: string;
  sourceIds: string[];
  sourceCount: number;
  avgImportance: number;
  timeRange: {
    start: number;
    end: number;
  };
  metadata: Record<string, unknown>;
  embedding?: number[];
  createdAt: number;
}

/**
 * Long-term memory events
 */
export interface LongTermMemoryEvents {
  consolidated: (
    consolidated: ConsolidatedMemory,
    sources: MemoryEntry[],
  ) => void;
  pruned: (pruned: MemoryEntry[]) => void;
  retrieved: (entries: MemoryEntry[]) => void;
}

/**
 * Long-term memory for persistent storage
 */
export class LongTermMemory extends EventEmitter<LongTermMemoryEvents> {
  private store: MemoryStoreInterface;
  private config: Required<LongTermMemoryConfig>;
  private consolidatedMemories: Map<string, ConsolidatedMemory> = new Map();

  constructor(store: MemoryStoreInterface, config: LongTermMemoryConfig = {}) {
    super();
    this.store = store;
    this.config = {
      store: config.store ?? store,
      indexing: config.indexing ?? 'hybrid',
      compression: config.compression ?? true,
      compressionThreshold: config.compressionThreshold ?? 1000,
      consolidationThreshold: config.consolidationThreshold ?? 100,
      compressionRatio: config.compressionRatio ?? 5,
      minImportance: config.minImportance ?? 0.3,
      retentionPeriod: config.retentionPeriod ?? 365 * 24 * 60 * 60 * 1000, // 1 year
      autoConsolidate: config.autoConsolidate ?? true,
      maxStorageSize: config.maxStorageSize ?? 100000,
    };
  }

  /**
   * Store a memory in long-term storage
   */
  async store_memory(entry: MemoryEntry): Promise<string> {
    // Only store if importance meets threshold
    if (entry.importance < this.config.minImportance) {
      return entry.id;
    }

    // Set expiration based on retention period
    const entryWithExpiry: MemoryEntry = {
      ...entry,
      expiresAt: entry.expiresAt ?? Date.now() + this.config.retentionPeriod,
    };

    await this.store.add(entryWithExpiry);

    // Check if consolidation is needed
    if (this.config.autoConsolidate) {
      const count = await this.store.count();
      if (count >= this.config.consolidationThreshold) {
        await this.consolidateOldMemories();
      }
    }

    return entry.id;
  }

  /**
   * Retrieve memories by similarity
   */
  async retrieve(
    embedding: number[],
    options?: {
      topK?: number;
      minScore?: number;
      includeConsolidated?: boolean;
    },
  ): Promise<ScoredMemory[]> {
    const results = await this.store.search(embedding, {
      topK: options?.topK ?? 10,
      minScore: options?.minScore ?? 0.5,
    });

    this.emit(
      'retrieved',
      results.map((r) => r.entry),
    );
    return results;
  }

  /**
   * Query long-term memories
   */
  async query(options: {
    query?: string;
    types?: string[];
    namespace?: string;
    userId?: string;
    minImportance?: number;
    startTime?: number;
    endTime?: number;
    limit?: number;
  }): Promise<MemoryEntry[]> {
    const { entries } = await this.store.query({
      ...options,
      types: options.types as MemoryEntry['type'][],
      minImportance: options.minImportance ?? this.config.minImportance,
      limit: options.limit ?? 100,
    });

    return entries;
  }

  /**
   * Consolidate old memories into summaries
   */
  async consolidateOldMemories(options?: {
    olderThan?: number;
    groupBy?: 'day' | 'week' | 'topic';
    summarizeFn?: (entries: MemoryEntry[]) => Promise<string>;
  }): Promise<ConsolidatedMemory[]> {
    const olderThan =
      options?.olderThan ?? Date.now() - 7 * 24 * 60 * 60 * 1000; // 1 week

    // Get old memories
    const { entries } = await this.store.query({
      endTime: olderThan,
      limit: 1000,
    });

    if (entries.length < this.config.compressionRatio) {
      return [];
    }

    // Group memories
    const groups = this.groupMemories(entries, options?.groupBy ?? 'day');

    const consolidated: ConsolidatedMemory[] = [];

    for (const [key, groupEntries] of groups) {
      if (groupEntries.length < 2) continue;

      // Generate summary
      const summary = options?.summarizeFn
        ? await options.summarizeFn(groupEntries)
        : this.generateSimpleSummary(groupEntries);

      const consolidatedMemory: ConsolidatedMemory = {
        id: this.generateId(),
        summary,
        sourceIds: groupEntries.map((e) => e.id),
        sourceCount: groupEntries.length,
        avgImportance:
          groupEntries.reduce((sum, e) => sum + e.importance, 0) /
          groupEntries.length,
        timeRange: {
          start: Math.min(...groupEntries.map((e) => e.timestamp)),
          end: Math.max(...groupEntries.map((e) => e.timestamp)),
        },
        metadata: {
          groupKey: key,
        },
        createdAt: Date.now(),
      };

      // Store consolidated memory
      await this.store.add({
        id: consolidatedMemory.id,
        content: consolidatedMemory.summary,
        type: 'summary',
        importance: consolidatedMemory.avgImportance,
        metadata: {
          source: 'system' as const,
          confidence: 0.85,
          consolidated: true,
          sourceCount: consolidatedMemory.sourceCount,
          ...consolidatedMemory.metadata,
        },
        timestamp: consolidatedMemory.timeRange.start,
        accessCount: 0,
        createdAt: consolidatedMemory.createdAt,
        updatedAt: consolidatedMemory.createdAt,
      });

      this.consolidatedMemories.set(consolidatedMemory.id, consolidatedMemory);

      // Delete original memories
      for (const entry of groupEntries) {
        await this.store.delete(entry.id);
      }

      consolidated.push(consolidatedMemory);
      this.emit('consolidated', consolidatedMemory, groupEntries);
    }

    return consolidated;
  }

  /**
   * Prune low-importance memories
   */
  async prune(options?: {
    maxAge?: number;
    maxImportance?: number;
    maxCount?: number;
  }): Promise<number> {
    const { entries } = await this.store.query({
      limit: 10000,
    });

    const now = Date.now();
    const maxAge = options?.maxAge ?? this.config.retentionPeriod;
    const maxImportance = options?.maxImportance ?? this.config.minImportance;

    // Find candidates for pruning
    const toPrune = entries.filter((entry) => {
      const age = now - entry.timestamp;
      const isOld = age > maxAge;
      const isLowImportance = entry.importance < maxImportance;
      const isLowAccess = entry.accessCount < 2;

      return isOld || (isLowImportance && isLowAccess);
    });

    // Apply max count limit
    const limit = options?.maxCount ?? toPrune.length;
    const pruneList = toPrune.slice(0, limit);

    // Delete pruned entries
    for (const entry of pruneList) {
      await this.store.delete(entry.id);
    }

    this.emit('pruned', pruneList);
    return pruneList.length;
  }

  /**
   * Reinforce a memory (increase importance)
   */
  async reinforce(id: string, amount: number = 0.1): Promise<boolean> {
    const entry = await this.store.get(id);
    if (!entry) return false;

    const newImportance = Math.min(entry.importance + amount, 1.0);

    return this.store.update(id, {
      importance: newImportance,
      expiresAt: Date.now() + this.config.retentionPeriod, // Reset expiration
    });
  }

  /**
   * Get consolidated memory by ID
   */
  getConsolidated(id: string): ConsolidatedMemory | undefined {
    return this.consolidatedMemories.get(id);
  }

  /**
   * Get all consolidated memories
   */
  getAllConsolidated(): ConsolidatedMemory[] {
    return Array.from(this.consolidatedMemories.values());
  }

  /**
   * Expand a consolidated memory to show original summaries
   */
  expandConsolidated(id: string): MemoryEntry[] | null {
    const consolidated = this.consolidatedMemories.get(id);
    if (!consolidated) return null;

    // Source memories have been deleted, but we can return the summary
    // In a real implementation, you might store source content in metadata
    return [
      {
        id: consolidated.id,
        content: consolidated.summary,
        type: 'summary',
        importance: consolidated.avgImportance,
        metadata: {
          source: 'system' as const,
          confidence: 0.85,
          expanded: true,
          sourceCount: consolidated.sourceCount,
        },
        timestamp: consolidated.timeRange.start,
        accessCount: 0,
        createdAt: consolidated.createdAt,
        updatedAt: consolidated.createdAt,
      },
    ];
  }

  /**
   * Group memories by time or topic
   */
  private groupMemories(
    entries: MemoryEntry[],
    groupBy: 'day' | 'week' | 'topic',
  ): Map<string, MemoryEntry[]> {
    const groups = new Map<string, MemoryEntry[]>();

    for (const entry of entries) {
      let key: string;

      switch (groupBy) {
        case 'day':
          key = new Date(entry.timestamp).toISOString().split('T')[0];
          break;
        case 'week': {
          const date = new Date(entry.timestamp);
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        }
        case 'topic':
          key = String(entry.metadata.topic ?? entry.type);
          break;
        default:
          key = 'default';
      }

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(entry);
    }

    return groups;
  }

  /**
   * Generate simple summary from entries
   */
  private generateSimpleSummary(entries: MemoryEntry[]): string {
    const types = new Set(entries.map((e) => e.type));
    const snippets = entries
      .slice(0, 5)
      .map((e) => e.content.slice(0, 50))
      .join('; ');

    return `Consolidated ${entries.length} memories (${Array.from(types).join(', ')}): ${snippets}...`;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `ltm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{
    totalMemories: number;
    consolidatedCount: number;
    avgImportance: number;
    oldestMemory: number | null;
    newestMemory: number | null;
  }> {
    const count = await this.store.count();
    const { entries } = await this.store.query({ limit: 1000 });

    const avgImportance =
      entries.length > 0
        ? entries.reduce((sum, e) => sum + e.importance, 0) / entries.length
        : 0;

    const timestamps = entries.map((e) => e.timestamp);

    return {
      totalMemories: count,
      consolidatedCount: this.consolidatedMemories.size,
      avgImportance,
      oldestMemory: timestamps.length > 0 ? Math.min(...timestamps) : null,
      newestMemory: timestamps.length > 0 ? Math.max(...timestamps) : null,
    };
  }
}

/**
 * Create long-term memory instance
 */
export function createLongTermMemory(
  store: MemoryStoreInterface,
  config?: LongTermMemoryConfig,
): LongTermMemory {
  return new LongTermMemory(store, config);
}
