/**
 * Inspector
 *
 * Memory inspection and analysis tools.
 */

import type {
  MemoryEntry,
  MemoryStoreInterface,
  InspectorConfig,
} from '../types/index.js';

/**
 * Memory statistics
 */
export interface MemoryStats {
  totalEntries: number;
  totalSize: number;
  avgContentLength: number;
  avgImportance: number;
  avgAccessCount: number;
  typeDistribution: Record<string, number>;
  namespaceDistribution: Record<string, number>;
  timeRange: { oldest: number; newest: number } | null;
  entriesWithEmbeddings: number;
  expiredEntries: number;
}

/**
 * Memory health report
 */
export interface HealthReport {
  score: number; // 0-100
  issues: HealthIssue[];
  recommendations: string[];
}

/**
 * Health issue
 */
export interface HealthIssue {
  type: 'warning' | 'error' | 'info';
  message: string;
  affectedEntries?: number;
  suggestion?: string;
}

/**
 * Inspection result
 */
export interface InspectionResult {
  entry: MemoryEntry;
  analysis: {
    contentLength: number;
    wordCount: number;
    hasEmbedding: boolean;
    embeddingDimensions?: number;
    metadataKeys: string[];
    age: number;
    accessRate: number; // accesses per hour
    isExpired: boolean;
    importancePercentile?: number;
  };
}

/**
 * Memory inspector
 */
export class Inspector {
  private store: MemoryStoreInterface;
  private config: Required<InspectorConfig>;

  constructor(store: MemoryStoreInterface, config: InspectorConfig = {}) {
    this.store = store;
    this.config = {
      includeEmbeddings: config.includeEmbeddings ?? false,
      samplingRate: config.samplingRate ?? 1.0,
      maxEntriesForAnalysis: config.maxEntriesForAnalysis ?? 10000,
      warningThresholds: {
        lowImportance: config.warningThresholds?.lowImportance ?? 0.2,
        highEntryCount: config.warningThresholds?.highEntryCount ?? 50000,
        oldAge: config.warningThresholds?.oldAge ?? 30 * 24 * 60 * 60 * 1000, // 30 days
        ...config.warningThresholds,
      },
    };
  }

  /**
   * Get comprehensive memory statistics
   */
  async getStats(): Promise<MemoryStats> {
    const { entries, total } = await this.store.query({
      limit: this.config.maxEntriesForAnalysis,
    });

    const now = Date.now();
    let totalSize = 0;
    let totalImportance = 0;
    let totalAccessCount = 0;
    let entriesWithEmbeddings = 0;
    let expiredEntries = 0;
    let oldest: number | null = null;
    let newest: number | null = null;

    const typeDistribution: Record<string, number> = {};
    const namespaceDistribution: Record<string, number> = {};

    for (const entry of entries) {
      totalSize += entry.content.length + JSON.stringify(entry.metadata).length;
      totalImportance += entry.importance;
      totalAccessCount += entry.accessCount;

      if (entry.embedding) entriesWithEmbeddings++;
      if (entry.expiresAt && entry.expiresAt < now) expiredEntries++;

      if (oldest === null || entry.timestamp < oldest) oldest = entry.timestamp;
      if (newest === null || entry.timestamp > newest) newest = entry.timestamp;

      typeDistribution[entry.type] = (typeDistribution[entry.type] ?? 0) + 1;
      const namespace = String(entry.metadata.namespace ?? 'default');
      namespaceDistribution[namespace] =
        (namespaceDistribution[namespace] ?? 0) + 1;
    }

    return {
      totalEntries: total,
      totalSize,
      avgContentLength: entries.length > 0 ? totalSize / entries.length : 0,
      avgImportance: entries.length > 0 ? totalImportance / entries.length : 0,
      avgAccessCount:
        entries.length > 0 ? totalAccessCount / entries.length : 0,
      typeDistribution,
      namespaceDistribution,
      timeRange: oldest !== null ? { oldest, newest: newest! } : null,
      entriesWithEmbeddings,
      expiredEntries,
    };
  }

  /**
   * Inspect a specific entry
   */
  async inspect(id: string): Promise<InspectionResult | null> {
    const entry = await this.store.get(id);
    if (!entry) return null;

    const now = Date.now();
    const age = now - entry.timestamp;
    const hoursOld = age / (60 * 60 * 1000);

    return {
      entry,
      analysis: {
        contentLength: entry.content.length,
        wordCount: entry.content.split(/\s+/).filter((w) => w.length > 0)
          .length,
        hasEmbedding: !!entry.embedding,
        embeddingDimensions: entry.embedding?.length,
        metadataKeys: Object.keys(entry.metadata),
        age,
        accessRate:
          hoursOld > 0 ? entry.accessCount / hoursOld : entry.accessCount,
        isExpired: !!(entry.expiresAt && entry.expiresAt < now),
      },
    };
  }

  /**
   * Get memory health report
   */
  async getHealthReport(): Promise<HealthReport> {
    const stats = await this.getStats();
    const issues: HealthIssue[] = [];
    const recommendations: string[] = [];

    // Check for high entry count
    if (stats.totalEntries > this.config.warningThresholds.highEntryCount!) {
      issues.push({
        type: 'warning',
        message: `High entry count: ${stats.totalEntries} entries`,
        suggestion: 'Consider consolidating or archiving old memories',
      });
      recommendations.push('Run memory consolidation to reduce entry count');
    }

    // Check for low importance entries
    if (stats.avgImportance < this.config.warningThresholds.lowImportance!) {
      issues.push({
        type: 'info',
        message: `Low average importance: ${(stats.avgImportance * 100).toFixed(1)}%`,
        suggestion: 'Review importance scoring or prune low-importance entries',
      });
    }

    // Check for expired entries
    if (stats.expiredEntries > 0) {
      issues.push({
        type: 'warning',
        message: `${stats.expiredEntries} expired entries found`,
        affectedEntries: stats.expiredEntries,
        suggestion: 'Run cleanup to remove expired entries',
      });
      recommendations.push('Clean up expired entries to free storage');
    }

    // Check for missing embeddings
    const withoutEmbeddings = stats.totalEntries - stats.entriesWithEmbeddings;
    if (withoutEmbeddings > stats.totalEntries * 0.3) {
      issues.push({
        type: 'info',
        message: `${withoutEmbeddings} entries without embeddings (${((withoutEmbeddings / stats.totalEntries) * 100).toFixed(1)}%)`,
        affectedEntries: withoutEmbeddings,
        suggestion: 'Generate embeddings for better semantic search',
      });
    }

    // Check for old entries
    if (stats.timeRange) {
      const oldestAge = Date.now() - stats.timeRange.oldest;
      if (oldestAge > this.config.warningThresholds.oldAge!) {
        issues.push({
          type: 'info',
          message: `Oldest entry is ${Math.round(oldestAge / (24 * 60 * 60 * 1000))} days old`,
          suggestion: 'Consider archiving or summarizing old memories',
        });
      }
    }

    // Check namespace distribution
    const namespaceCount = Object.keys(stats.namespaceDistribution).length;
    if (namespaceCount === 1 && stats.totalEntries > 1000) {
      recommendations.push('Consider using namespaces to organize memories');
    }

    // Calculate health score
    let score = 100;
    for (const issue of issues) {
      if (issue.type === 'error') score -= 20;
      else if (issue.type === 'warning') score -= 10;
      else score -= 5;
    }
    score = Math.max(0, Math.min(100, score));

    return {
      score,
      issues,
      recommendations,
    };
  }

  /**
   * Find duplicate entries
   */
  async findDuplicates(
    threshold: number = 0.95,
  ): Promise<Array<[MemoryEntry, MemoryEntry]>> {
    const { entries } = await this.store.query({
      limit: this.config.maxEntriesForAnalysis,
    });
    const duplicates: Array<[MemoryEntry, MemoryEntry]> = [];

    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const similarity = this.calculateSimilarity(entries[i], entries[j]);
        if (similarity >= threshold) {
          duplicates.push([entries[i], entries[j]]);
        }
      }
    }

    return duplicates;
  }

  /**
   * Find orphaned entries (no parent, but has parentId)
   */
  async findOrphans(): Promise<MemoryEntry[]> {
    const { entries } = await this.store.query({
      limit: this.config.maxEntriesForAnalysis,
    });

    const entryIds = new Set(entries.map((e) => e.id));
    const orphans: MemoryEntry[] = [];

    for (const entry of entries) {
      if (entry.parentId && !entryIds.has(entry.parentId)) {
        orphans.push(entry);
      }
    }

    return orphans;
  }

  /**
   * Find low-value entries
   */
  async findLowValueEntries(options?: {
    maxImportance?: number;
    maxAccessCount?: number;
    minAge?: number;
  }): Promise<MemoryEntry[]> {
    const { entries } = await this.store.query({
      limit: this.config.maxEntriesForAnalysis,
    });
    const now = Date.now();

    const maxImportance = options?.maxImportance ?? 0.2;
    const maxAccessCount = options?.maxAccessCount ?? 2;
    const minAge = options?.minAge ?? 7 * 24 * 60 * 60 * 1000; // 7 days

    return entries.filter((entry) => {
      const age = now - entry.timestamp;
      return (
        entry.importance <= maxImportance &&
        entry.accessCount <= maxAccessCount &&
        age >= minAge
      );
    });
  }

  /**
   * Get entry distribution over time
   */
  async getTimeDistribution(
    bucketSize: 'hour' | 'day' | 'week' | 'month' = 'day',
  ): Promise<Map<string, number>> {
    const { entries } = await this.store.query({
      limit: this.config.maxEntriesForAnalysis,
    });
    const distribution = new Map<string, number>();

    for (const entry of entries) {
      const date = new Date(entry.timestamp);
      let key: string;

      switch (bucketSize) {
        case 'hour':
          key = `${date.toISOString().slice(0, 13)}:00`;
          break;
        case 'day':
          key = date.toISOString().slice(0, 10);
          break;
        case 'week': {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = `week-${weekStart.toISOString().slice(0, 10)}`;
          break;
        }
        case 'month':
          key = date.toISOString().slice(0, 7);
          break;
      }

      distribution.set(key, (distribution.get(key) ?? 0) + 1);
    }

    return distribution;
  }

  /**
   * Calculate similarity between two entries
   */
  private calculateSimilarity(a: MemoryEntry, b: MemoryEntry): number {
    // Use embeddings if available
    if (a.embedding && b.embedding) {
      return this.cosineSimilarity(a.embedding, b.embedding);
    }

    // Fall back to text similarity
    return this.textSimilarity(a.content, b.content);
  }

  /**
   * Cosine similarity
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
   * Text similarity (Jaccard)
   */
  private textSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));

    const intersection = new Set([...wordsA].filter((x) => wordsB.has(x)));
    const union = new Set([...wordsA, ...wordsB]);

    return intersection.size / union.size;
  }
}

/**
 * Create inspector instance
 */
export function createInspector(
  store: MemoryStoreInterface,
  config?: InspectorConfig,
): Inspector {
  return new Inspector(store, config);
}
