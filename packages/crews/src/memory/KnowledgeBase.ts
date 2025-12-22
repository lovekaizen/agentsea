/**
 * Knowledge Base
 *
 * Persistent knowledge store for crew-wide information sharing.
 */

import { nanoid } from 'nanoid';

/**
 * Knowledge type
 */
export type KnowledgeType =
  | 'fact'
  | 'procedure'
  | 'concept'
  | 'example'
  | 'rule'
  | 'definition'
  | 'insight'
  | 'warning';

/**
 * Knowledge item
 */
export interface KnowledgeItem {
  id: string;
  type: KnowledgeType;
  title: string;
  content: string;
  tags: string[];
  source?: string;
  contributor?: string;
  confidence: number;
  references?: string[];
  created: Date;
  updated: Date;
  accessCount: number;
  metadata?: Record<string, unknown>;
}

/**
 * Knowledge query options
 */
export interface KnowledgeQueryOptions {
  type?: KnowledgeType;
  tags?: string[];
  contributor?: string;
  minConfidence?: number;
  limit?: number;
  sortBy?: 'relevance' | 'recency' | 'confidence' | 'access';
}

/**
 * Knowledge base configuration
 */
export interface KnowledgeBaseConfig {
  /** Maximum items to store */
  maxItems?: number;
  /** Enable automatic indexing */
  autoIndex?: boolean;
  /** Minimum confidence threshold */
  minConfidence?: number;
  /** Enable deduplication */
  deduplicate?: boolean;
}

/**
 * Knowledge base
 *
 * Stores and retrieves structured knowledge for the crew.
 */
export class KnowledgeBase {
  private readonly items: Map<string, KnowledgeItem> = new Map();
  private readonly tagIndex: Map<string, Set<string>> = new Map();
  private readonly typeIndex: Map<KnowledgeType, Set<string>> = new Map();
  private readonly contributorIndex: Map<string, Set<string>> = new Map();
  private readonly config: Required<KnowledgeBaseConfig>;

  constructor(config: KnowledgeBaseConfig = {}) {
    this.config = {
      maxItems: config.maxItems ?? 10000,
      autoIndex: config.autoIndex ?? true,
      minConfidence: config.minConfidence ?? 0,
      deduplicate: config.deduplicate ?? true,
    };
  }

  // ============ CRUD Operations ============

  /**
   * Add knowledge item
   */
  add(
    item: Omit<KnowledgeItem, 'id' | 'created' | 'updated' | 'accessCount'>,
  ): KnowledgeItem {
    // Check confidence threshold
    if (item.confidence < this.config.minConfidence) {
      throw new Error(
        `Confidence ${item.confidence} below threshold ${this.config.minConfidence}`,
      );
    }

    // Check for duplicates
    if (this.config.deduplicate) {
      const duplicate = this.findDuplicate(item.title, item.content);
      if (duplicate) {
        // Update existing instead
        return this.update(duplicate.id, {
          ...item,
          confidence: Math.max(duplicate.confidence, item.confidence),
        });
      }
    }

    // Check capacity
    if (this.items.size >= this.config.maxItems) {
      this.evictLeastUsed();
    }

    const fullItem: KnowledgeItem = {
      ...item,
      id: nanoid(),
      created: new Date(),
      updated: new Date(),
      accessCount: 0,
    };

    this.items.set(fullItem.id, fullItem);

    // Index
    if (this.config.autoIndex) {
      this.indexItem(fullItem);
    }

    return fullItem;
  }

  /**
   * Get knowledge item
   */
  get(id: string): KnowledgeItem | undefined {
    const item = this.items.get(id);
    if (item) {
      item.accessCount++;
    }
    return item;
  }

  /**
   * Update knowledge item
   */
  update(
    id: string,
    updates: Partial<Omit<KnowledgeItem, 'id' | 'created' | 'accessCount'>>,
  ): KnowledgeItem {
    const item = this.items.get(id);
    if (!item) {
      throw new Error(`Knowledge item not found: ${id}`);
    }

    // Remove from indices
    if (this.config.autoIndex) {
      this.unindexItem(item);
    }

    // Update item
    const updatedItem: KnowledgeItem = {
      ...item,
      ...updates,
      updated: new Date(),
    };

    this.items.set(id, updatedItem);

    // Re-index
    if (this.config.autoIndex) {
      this.indexItem(updatedItem);
    }

    return updatedItem;
  }

  /**
   * Delete knowledge item
   */
  delete(id: string): boolean {
    const item = this.items.get(id);
    if (!item) return false;

    // Remove from indices
    if (this.config.autoIndex) {
      this.unindexItem(item);
    }

    return this.items.delete(id);
  }

  // ============ Search & Query ============

  /**
   * Search knowledge base
   */
  search(query: string, options: KnowledgeQueryOptions = {}): KnowledgeItem[] {
    let results = this.textSearch(query);

    // Apply filters
    if (options.type) {
      results = results.filter((item) => item.type === options.type);
    }

    if (options.tags && options.tags.length > 0) {
      results = results.filter((item) =>
        options.tags!.some((tag) => item.tags.includes(tag)),
      );
    }

    if (options.contributor) {
      results = results.filter(
        (item) => item.contributor === options.contributor,
      );
    }

    if (options.minConfidence !== undefined) {
      results = results.filter(
        (item) => item.confidence >= options.minConfidence!,
      );
    }

    // Sort
    results = this.sortResults(results, options.sortBy ?? 'relevance', query);

    // Limit
    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    // Update access counts
    for (const item of results) {
      item.accessCount++;
    }

    return results;
  }

  /**
   * Get by tag
   */
  getByTag(tag: string, limit?: number): KnowledgeItem[] {
    const ids = this.tagIndex.get(tag.toLowerCase());
    if (!ids) return [];

    let items = Array.from(ids)
      .map((id) => this.items.get(id)!)
      .filter(Boolean);

    if (limit) {
      items = items.slice(0, limit);
    }

    return items;
  }

  /**
   * Get by type
   */
  getByType(type: KnowledgeType, limit?: number): KnowledgeItem[] {
    const ids = this.typeIndex.get(type);
    if (!ids) return [];

    let items = Array.from(ids)
      .map((id) => this.items.get(id)!)
      .filter(Boolean);

    if (limit) {
      items = items.slice(0, limit);
    }

    return items;
  }

  /**
   * Get by contributor
   */
  getByContributor(contributor: string, limit?: number): KnowledgeItem[] {
    const ids = this.contributorIndex.get(contributor);
    if (!ids) return [];

    let items = Array.from(ids)
      .map((id) => this.items.get(id)!)
      .filter(Boolean);

    if (limit) {
      items = items.slice(0, limit);
    }

    return items;
  }

  /**
   * Get related items
   */
  getRelated(id: string, limit: number = 5): KnowledgeItem[] {
    const item = this.items.get(id);
    if (!item) return [];

    // Find items with overlapping tags
    const relatedIds = new Set<string>();

    for (const tag of item.tags) {
      const taggedIds = this.tagIndex.get(tag.toLowerCase());
      if (taggedIds) {
        for (const relatedId of taggedIds) {
          if (relatedId !== id) {
            relatedIds.add(relatedId);
          }
        }
      }
    }

    // Score by tag overlap
    const scored = Array.from(relatedIds).map((relatedId) => {
      const relatedItem = this.items.get(relatedId)!;
      const overlap = item.tags.filter((t) =>
        relatedItem.tags.includes(t),
      ).length;
      return { item: relatedItem, score: overlap };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.item);
  }

  // ============ Agent Contributions ============

  /**
   * Contribute knowledge from an agent
   */
  contributeKnowledge(
    agentName: string,
    type: KnowledgeType,
    title: string,
    content: string,
    tags: string[] = [],
    confidence: number = 0.8,
  ): KnowledgeItem {
    return this.add({
      type,
      title,
      content,
      tags,
      contributor: agentName,
      confidence,
    });
  }

  /**
   * Add a fact
   */
  addFact(
    title: string,
    content: string,
    tags: string[] = [],
    source?: string,
  ): KnowledgeItem {
    return this.add({
      type: 'fact',
      title,
      content,
      tags,
      source,
      confidence: 0.9,
    });
  }

  /**
   * Add a procedure
   */
  addProcedure(
    title: string,
    steps: string[],
    tags: string[] = [],
  ): KnowledgeItem {
    return this.add({
      type: 'procedure',
      title,
      content: steps.map((s, i) => `${i + 1}. ${s}`).join('\n'),
      tags,
      confidence: 0.85,
    });
  }

  /**
   * Add an insight
   */
  addInsight(
    title: string,
    content: string,
    contributor: string,
    tags: string[] = [],
  ): KnowledgeItem {
    return this.add({
      type: 'insight',
      title,
      content,
      tags,
      contributor,
      confidence: 0.7,
    });
  }

  /**
   * Add a warning
   */
  addWarning(
    title: string,
    content: string,
    tags: string[] = [],
  ): KnowledgeItem {
    return this.add({
      type: 'warning',
      title,
      content,
      tags,
      confidence: 0.95,
    });
  }

  // ============ Indexing ============

  /**
   * Index an item
   */
  private indexItem(item: KnowledgeItem): void {
    // Tag index
    for (const tag of item.tags) {
      const tagLower = tag.toLowerCase();
      if (!this.tagIndex.has(tagLower)) {
        this.tagIndex.set(tagLower, new Set());
      }
      this.tagIndex.get(tagLower)!.add(item.id);
    }

    // Type index
    if (!this.typeIndex.has(item.type)) {
      this.typeIndex.set(item.type, new Set());
    }
    this.typeIndex.get(item.type)!.add(item.id);

    // Contributor index
    if (item.contributor) {
      if (!this.contributorIndex.has(item.contributor)) {
        this.contributorIndex.set(item.contributor, new Set());
      }
      this.contributorIndex.get(item.contributor)!.add(item.id);
    }
  }

  /**
   * Remove item from indices
   */
  private unindexItem(item: KnowledgeItem): void {
    // Tag index
    for (const tag of item.tags) {
      const tagLower = tag.toLowerCase();
      this.tagIndex.get(tagLower)?.delete(item.id);
    }

    // Type index
    this.typeIndex.get(item.type)?.delete(item.id);

    // Contributor index
    if (item.contributor) {
      this.contributorIndex.get(item.contributor)?.delete(item.id);
    }
  }

  /**
   * Text search
   */
  private textSearch(query: string): KnowledgeItem[] {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/);

    const scored: Array<{ item: KnowledgeItem; score: number }> = [];

    for (const item of this.items.values()) {
      let score = 0;

      const titleLower = item.title.toLowerCase();
      const contentLower = item.content.toLowerCase();

      // Title match (higher weight)
      if (titleLower.includes(queryLower)) {
        score += 3;
      }

      // Content match
      if (contentLower.includes(queryLower)) {
        score += 1;
      }

      // Word matches
      for (const word of queryWords) {
        if (titleLower.includes(word)) score += 0.5;
        if (contentLower.includes(word)) score += 0.2;
        if (item.tags.some((t) => t.toLowerCase().includes(word))) score += 0.3;
      }

      if (score > 0) {
        scored.push({ item, score });
      }
    }

    return scored.sort((a, b) => b.score - a.score).map((s) => s.item);
  }

  /**
   * Sort results
   */
  private sortResults(
    items: KnowledgeItem[],
    sortBy: 'relevance' | 'recency' | 'confidence' | 'access',
    _query?: string,
  ): KnowledgeItem[] {
    switch (sortBy) {
      case 'recency':
        return items.sort((a, b) => b.updated.getTime() - a.updated.getTime());

      case 'confidence':
        return items.sort((a, b) => b.confidence - a.confidence);

      case 'access':
        return items.sort((a, b) => b.accessCount - a.accessCount);

      case 'relevance':
      default:
        // Already sorted by relevance from text search
        return items;
    }
  }

  /**
   * Find duplicate
   */
  private findDuplicate(
    title: string,
    content: string,
  ): KnowledgeItem | undefined {
    const titleLower = title.toLowerCase();
    const contentLower = content.toLowerCase().substring(0, 200);

    for (const item of this.items.values()) {
      if (
        item.title.toLowerCase() === titleLower ||
        item.content.toLowerCase().substring(0, 200) === contentLower
      ) {
        return item;
      }
    }

    return undefined;
  }

  /**
   * Evict least used item
   */
  private evictLeastUsed(): void {
    let leastUsed: KnowledgeItem | undefined;
    let minAccess = Infinity;

    for (const item of this.items.values()) {
      if (item.accessCount < minAccess) {
        minAccess = item.accessCount;
        leastUsed = item;
      }
    }

    if (leastUsed) {
      this.delete(leastUsed.id);
    }
  }

  // ============ Utilities ============

  /**
   * Get all tags
   */
  getTags(): string[] {
    return Array.from(this.tagIndex.keys());
  }

  /**
   * Get all types
   */
  getTypes(): KnowledgeType[] {
    return Array.from(this.typeIndex.keys());
  }

  /**
   * Get all contributors
   */
  getContributors(): string[] {
    return Array.from(this.contributorIndex.keys());
  }

  /**
   * Get all items
   */
  getAll(): KnowledgeItem[] {
    return Array.from(this.items.values());
  }

  /**
   * Get count
   */
  getCount(): number {
    return this.items.size;
  }

  /**
   * Clear all
   */
  clear(): void {
    this.items.clear();
    this.tagIndex.clear();
    this.typeIndex.clear();
    this.contributorIndex.clear();
  }

  /**
   * Export
   */
  export(): KnowledgeItem[] {
    return Array.from(this.items.values());
  }

  /**
   * Import
   */
  import(items: KnowledgeItem[]): number {
    let count = 0;

    for (const item of items) {
      // Restore dates
      item.created = new Date(item.created);
      item.updated = new Date(item.updated);

      this.items.set(item.id, item);

      if (this.config.autoIndex) {
        this.indexItem(item);
      }

      count++;
    }

    return count;
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalItems: number;
    itemsByType: Record<string, number>;
    itemsByContributor: Record<string, number>;
    totalTags: number;
    averageConfidence: number;
    mostUsedTags: Array<{ tag: string; count: number }>;
  } {
    const itemsByType: Record<string, number> = {};
    const itemsByContributor: Record<string, number> = {};
    let totalConfidence = 0;

    for (const item of this.items.values()) {
      itemsByType[item.type] = (itemsByType[item.type] ?? 0) + 1;
      if (item.contributor) {
        itemsByContributor[item.contributor] =
          (itemsByContributor[item.contributor] ?? 0) + 1;
      }
      totalConfidence += item.confidence;
    }

    const mostUsedTags = Array.from(this.tagIndex.entries())
      .map(([tag, ids]) => ({ tag, count: ids.size }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalItems: this.items.size,
      itemsByType,
      itemsByContributor,
      totalTags: this.tagIndex.size,
      averageConfidence:
        this.items.size > 0 ? totalConfidence / this.items.size : 0,
      mostUsedTags,
    };
  }
}

/**
 * Factory function
 */
export function createKnowledgeBase(
  config?: KnowledgeBaseConfig,
): KnowledgeBase {
  return new KnowledgeBase(config);
}

export default KnowledgeBase;
