/**
 * Consolidator
 *
 * Merges similar or related memories into consolidated entries.
 */

import type {
  MemoryEntry,
  ConsolidatorConfig,
  MemoryStoreInterface,
} from '../types/index.js';
import { Summarizer } from './Summarizer.js';

/**
 * Consolidation group
 */
export interface ConsolidationGroup {
  id: string;
  entries: MemoryEntry[];
  similarity: number;
  groupKey: string;
}

/**
 * Consolidation result
 */
export interface ConsolidationResult {
  consolidated: MemoryEntry;
  sourceIds: string[];
  groupKey: string;
  avgImportance: number;
  timeSpan: {
    start: number;
    end: number;
  };
}

/**
 * Memory consolidator
 */
export class Consolidator {
  private config: Required<ConsolidatorConfig>;
  private summarizer: Summarizer;
  private embedFn?: (text: string) => Promise<number[]>;

  constructor(config: ConsolidatorConfig = {}) {
    this.config = {
      similarityThreshold: config.similarityThreshold ?? 0.8,
      mergeStrategy: config.mergeStrategy ?? 'confidence-weighted',
      extractRelations: config.extractRelations ?? false,
      maxBatchSize: config.maxBatchSize ?? 100,
      minGroupSize: config.minGroupSize ?? 2,
      maxGroupSize: config.maxGroupSize ?? 20,
      groupingStrategy: config.groupingStrategy ?? 'semantic',
      preserveOriginals: config.preserveOriginals ?? false,
    };

    this.summarizer = new Summarizer();
  }

  /**
   * Set embedding function for semantic grouping
   */
  setEmbeddingFunction(fn: (text: string) => Promise<number[]>): void {
    this.embedFn = fn;
  }

  /**
   * Set summarizer function
   */
  setSummarizerFunction(
    fn: (
      entries: MemoryEntry[],
      options?: { maxLength?: number },
    ) => Promise<string>,
  ): void {
    this.summarizer.setSummaryFunction(fn);
  }

  /**
   * Find and consolidate similar memories
   */
  async consolidate(
    entries: MemoryEntry[],
    store?: MemoryStoreInterface,
  ): Promise<ConsolidationResult[]> {
    // Group similar entries
    const groups = await this.groupSimilar(entries);

    // Consolidate each group
    const results: ConsolidationResult[] = [];

    for (const group of groups) {
      if (group.entries.length < this.config.minGroupSize) {
        continue;
      }

      const consolidated = await this.consolidateGroup(group);
      results.push(consolidated);

      // Store consolidated and optionally remove originals
      if (store) {
        await store.add(consolidated.consolidated);

        if (!this.config.preserveOriginals) {
          for (const id of consolidated.sourceIds) {
            await store.delete(id);
          }
        }
      }
    }

    return results;
  }

  /**
   * Group similar entries
   */
  async groupSimilar(entries: MemoryEntry[]): Promise<ConsolidationGroup[]> {
    switch (this.config.groupingStrategy) {
      case 'semantic':
        return Promise.resolve(this.groupBySemantic(entries));
      case 'temporal':
        return Promise.resolve(this.groupByTemporal(entries));
      case 'type':
        return Promise.resolve(this.groupByType(entries));
      default:
        return Promise.resolve(this.groupBySemantic(entries));
    }
  }

  /**
   * Group by semantic similarity
   */
  private async groupBySemantic(
    entries: MemoryEntry[],
  ): Promise<ConsolidationGroup[]> {
    if (!this.embedFn) {
      // Fall back to simple text similarity
      return Promise.resolve(this.groupByTextSimilarity(entries));
    }

    // Ensure all entries have embeddings
    const withEmbeddings = await Promise.all(
      entries.map(async (entry) => {
        if (entry.embedding) return entry;
        return {
          ...entry,
          embedding: await this.embedFn!(entry.content),
        };
      }),
    );

    // Cluster using simple single-linkage clustering
    const groups: ConsolidationGroup[] = [];
    const assigned = new Set<string>();

    for (let i = 0; i < withEmbeddings.length; i++) {
      if (assigned.has(withEmbeddings[i].id)) continue;

      const group: MemoryEntry[] = [withEmbeddings[i]];
      assigned.add(withEmbeddings[i].id);

      for (let j = i + 1; j < withEmbeddings.length; j++) {
        if (assigned.has(withEmbeddings[j].id)) continue;
        if (group.length >= this.config.maxGroupSize) break;

        const similarity = this.cosineSimilarity(
          withEmbeddings[i].embedding!,
          withEmbeddings[j].embedding!,
        );

        if (similarity >= this.config.similarityThreshold) {
          group.push(withEmbeddings[j]);
          assigned.add(withEmbeddings[j].id);
        }
      }

      if (group.length >= this.config.minGroupSize) {
        groups.push({
          id: this.generateId(),
          entries: group,
          similarity: this.calculateGroupSimilarity(group),
          groupKey: `semantic-${i}`,
        });
      }
    }

    return groups;
  }

  /**
   * Group by text similarity (fallback)
   */
  private groupByTextSimilarity(entries: MemoryEntry[]): ConsolidationGroup[] {
    const groups: ConsolidationGroup[] = [];
    const assigned = new Set<string>();

    for (let i = 0; i < entries.length; i++) {
      if (assigned.has(entries[i].id)) continue;

      const group: MemoryEntry[] = [entries[i]];
      assigned.add(entries[i].id);

      for (let j = i + 1; j < entries.length; j++) {
        if (assigned.has(entries[j].id)) continue;
        if (group.length >= this.config.maxGroupSize) break;

        const similarity = this.textSimilarity(
          entries[i].content,
          entries[j].content,
        );

        if (similarity >= this.config.similarityThreshold) {
          group.push(entries[j]);
          assigned.add(entries[j].id);
        }
      }

      if (group.length >= this.config.minGroupSize) {
        groups.push({
          id: this.generateId(),
          entries: group,
          similarity: 0.8,
          groupKey: `text-${i}`,
        });
      }
    }

    return groups;
  }

  /**
   * Group by temporal proximity
   */
  private groupByTemporal(entries: MemoryEntry[]): ConsolidationGroup[] {
    const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp);
    const groups: ConsolidationGroup[] = [];

    // Group entries within time windows
    const windowMs = 60 * 60 * 1000; // 1 hour
    let currentGroup: MemoryEntry[] = [];
    let windowStart = sorted[0]?.timestamp ?? 0;

    for (const entry of sorted) {
      if (
        entry.timestamp - windowStart <= windowMs &&
        currentGroup.length < this.config.maxGroupSize
      ) {
        currentGroup.push(entry);
      } else {
        if (currentGroup.length >= this.config.minGroupSize) {
          groups.push({
            id: this.generateId(),
            entries: currentGroup,
            similarity: 1.0,
            groupKey: `temporal-${new Date(windowStart).toISOString()}`,
          });
        }
        currentGroup = [entry];
        windowStart = entry.timestamp;
      }
    }

    // Don't forget the last group
    if (currentGroup.length >= this.config.minGroupSize) {
      groups.push({
        id: this.generateId(),
        entries: currentGroup,
        similarity: 1.0,
        groupKey: `temporal-${new Date(windowStart).toISOString()}`,
      });
    }

    return groups;
  }

  /**
   * Group by memory type
   */
  private groupByType(entries: MemoryEntry[]): ConsolidationGroup[] {
    const typeGroups = new Map<string, MemoryEntry[]>();

    for (const entry of entries) {
      if (!typeGroups.has(entry.type)) {
        typeGroups.set(entry.type, []);
      }
      typeGroups.get(entry.type)!.push(entry);
    }

    const groups: ConsolidationGroup[] = [];

    for (const [type, typeEntries] of typeGroups) {
      // Split large groups
      for (let i = 0; i < typeEntries.length; i += this.config.maxGroupSize) {
        const chunk = typeEntries.slice(i, i + this.config.maxGroupSize);
        if (chunk.length >= this.config.minGroupSize) {
          groups.push({
            id: this.generateId(),
            entries: chunk,
            similarity: 1.0,
            groupKey: `type-${type}-${i}`,
          });
        }
      }
    }

    return groups;
  }

  /**
   * Consolidate a group into a single entry
   */
  private async consolidateGroup(
    group: ConsolidationGroup,
  ): Promise<ConsolidationResult> {
    const entries = group.entries;

    // Generate summary
    const summaryResult = await this.summarizer.summarize(entries);

    // Calculate combined importance
    const avgImportance =
      entries.reduce((sum, e) => sum + e.importance, 0) / entries.length;
    const maxImportance = Math.max(...entries.map((e) => e.importance));
    const combinedImportance = avgImportance * 0.7 + maxImportance * 0.3;

    // Get time span
    const timestamps = entries.map((e) => e.timestamp);
    const timeSpan = {
      start: Math.min(...timestamps),
      end: Math.max(...timestamps),
    };

    // Merge tags
    const allTags = new Set<string>();
    for (const entry of entries) {
      const tags = entry.metadata.tags;
      if (tags) {
        tags.forEach((t) => allTags.add(t));
      }
    }

    // Create consolidated entry
    const consolidated: MemoryEntry = {
      id: `consolidated-${group.id}`,
      content: summaryResult.summary,
      type: 'summary',
      importance: Math.min(combinedImportance + 0.1, 1), // Boost for consolidation
      metadata: {
        source: 'system',
        confidence: 0.9,
        consolidated: true,
        sourceCount: entries.length,
        groupKey: group.groupKey,
        tags: Array.from(allTags),
        keyPoints: summaryResult.keyPoints,
      },
      timestamp: timeSpan.start,
      accessCount: entries.reduce((sum, e) => sum + e.accessCount, 0),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Generate embedding for consolidated entry if function available
    if (this.embedFn) {
      consolidated.embedding = await this.embedFn(consolidated.content);
    }

    return {
      consolidated,
      sourceIds: entries.map((e) => e.id),
      groupKey: group.groupKey,
      avgImportance,
      timeSpan,
    };
  }

  /**
   * Calculate cosine similarity
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Calculate text similarity (Jaccard)
   */
  private textSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));

    const intersection = new Set([...wordsA].filter((x) => wordsB.has(x)));
    const union = new Set([...wordsA, ...wordsB]);

    return intersection.size / union.size;
  }

  /**
   * Calculate average similarity within a group
   */
  private calculateGroupSimilarity(entries: MemoryEntry[]): number {
    if (entries.length < 2) return 1;
    if (!entries[0].embedding) return 0.8;

    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        if (entries[i].embedding && entries[j].embedding) {
          totalSimilarity += this.cosineSimilarity(
            entries[i].embedding!,
            entries[j].embedding!,
          );
          comparisons++;
        }
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0.8;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `group-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Update configuration
   */
  configure(config: Partial<ConsolidatorConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Create consolidator instance
 */
export function createConsolidator(config?: ConsolidatorConfig): Consolidator {
  return new Consolidator(config);
}
