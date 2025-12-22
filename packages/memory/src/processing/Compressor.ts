/**
 * Compressor
 *
 * Compresses memory entries to save space while preserving key information.
 */

import type { MemoryEntry, CompressorConfig } from '../types/index.js';

/**
 * Compression result
 */
export interface CompressionResult {
  compressed: MemoryEntry;
  originalSize: number;
  compressedSize: number;
  ratio: number;
  preservedFields: string[];
}

/**
 * Batch compression result
 */
export interface BatchCompressionResult {
  entries: MemoryEntry[];
  totalOriginalSize: number;
  totalCompressedSize: number;
  avgRatio: number;
  removedCount: number;
}

/**
 * Memory compressor
 */
export class Compressor {
  private config: Required<CompressorConfig>;

  constructor(config: CompressorConfig = {}) {
    this.config = {
      targetRatio: config.targetRatio ?? 0.5,
      preserveImportant: config.preserveImportant ?? true,
      strategy: config.strategy ?? 'importance-weighted',
      minImportance: config.minImportance ?? 0.3,
      minContentLength: config.minContentLength ?? 50,
      removeEmbeddings: config.removeEmbeddings ?? false,
      truncateMetadata: config.truncateMetadata ?? true,
    };
  }

  /**
   * Compress a single memory entry
   */
  compress(entry: MemoryEntry): CompressionResult {
    const originalSize = this.calculateSize(entry);
    const preservedFields: string[] = [];

    // Start with a copy
    const compressed: MemoryEntry = { ...entry };

    // Truncate content
    if (entry.content.length > this.config.minContentLength) {
      compressed.content = this.truncateContent(
        entry.content,
        entry.importance,
      );
      preservedFields.push('content (truncated)');
    } else {
      preservedFields.push('content');
    }

    // Handle embeddings
    if (this.config.removeEmbeddings && entry.embedding) {
      delete compressed.embedding;
    } else if (entry.embedding) {
      preservedFields.push('embedding');
    }

    // Truncate metadata
    if (this.config.truncateMetadata) {
      compressed.metadata = this.truncateMetadata(entry.metadata);
      preservedFields.push('metadata (truncated)');
    } else {
      preservedFields.push('metadata');
    }

    const compressedSize = this.calculateSize(compressed);

    return {
      compressed,
      originalSize,
      compressedSize,
      ratio: compressedSize / originalSize,
      preservedFields,
    };
  }

  /**
   * Compress multiple entries
   */
  compressBatch(entries: MemoryEntry[]): BatchCompressionResult {
    let totalOriginalSize = 0;
    let totalCompressedSize = 0;
    let removedCount = 0;
    const compressedEntries: MemoryEntry[] = [];

    for (const entry of entries) {
      const originalSize = this.calculateSize(entry);
      totalOriginalSize += originalSize;

      // Skip low-importance entries if configured
      if (this.config.preserveImportant && entry.importance < 0.2) {
        removedCount++;
        continue;
      }

      const result = this.compress(entry);
      compressedEntries.push(result.compressed);
      totalCompressedSize += result.compressedSize;
    }

    return {
      entries: compressedEntries,
      totalOriginalSize,
      totalCompressedSize,
      avgRatio:
        totalOriginalSize > 0 ? totalCompressedSize / totalOriginalSize : 1,
      removedCount,
    };
  }

  /**
   * Compress entries to target size
   */
  compressToSize(
    entries: MemoryEntry[],
    targetSize: number,
  ): BatchCompressionResult {
    // Sort by importance (keep most important)
    const sorted = [...entries].sort((a, b) => b.importance - a.importance);

    let currentSize = 0;
    const result: MemoryEntry[] = [];
    let removedCount = 0;

    for (const entry of sorted) {
      const compressed = this.compress(entry);

      if (currentSize + compressed.compressedSize <= targetSize) {
        result.push(compressed.compressed);
        currentSize += compressed.compressedSize;
      } else {
        // Try aggressive compression
        const aggressive = this.aggressiveCompress(entry);
        if (currentSize + this.calculateSize(aggressive) <= targetSize) {
          result.push(aggressive);
          currentSize += this.calculateSize(aggressive);
        } else {
          removedCount++;
        }
      }
    }

    return {
      entries: result,
      totalOriginalSize: entries.reduce(
        (sum, e) => sum + this.calculateSize(e),
        0,
      ),
      totalCompressedSize: currentSize,
      avgRatio:
        currentSize /
        Math.max(
          entries.reduce((sum, e) => sum + this.calculateSize(e), 0),
          1,
        ),
      removedCount,
    };
  }

  /**
   * Deduplicate and compress similar entries
   */
  deduplicateAndCompress(entries: MemoryEntry[]): BatchCompressionResult {
    const seen = new Map<string, MemoryEntry>();
    let removedCount = 0;

    for (const entry of entries) {
      const key = this.getDedupeKey(entry);
      const existing = seen.get(key);

      if (!existing) {
        seen.set(key, entry);
      } else {
        // Keep more important or more recent
        if (
          entry.importance > existing.importance ||
          (entry.importance === existing.importance &&
            entry.timestamp > existing.timestamp)
        ) {
          seen.set(key, entry);
        }
        removedCount++;
      }
    }

    const unique = Array.from(seen.values());
    const batchResult = this.compressBatch(unique);

    return {
      ...batchResult,
      removedCount: removedCount + batchResult.removedCount,
    };
  }

  /**
   * Truncate content based on importance
   */
  private truncateContent(content: string, importance: number): string {
    // Higher importance = keep more content
    const keepRatio = 0.3 + importance * 0.5; // 30% to 80%
    const targetLength = Math.max(
      this.config.minContentLength,
      Math.floor(content.length * keepRatio),
    );

    if (content.length <= targetLength) {
      return content;
    }

    // Try to cut at sentence boundary
    const truncated = content.slice(0, targetLength);
    const lastSentenceEnd = Math.max(
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('!'),
      truncated.lastIndexOf('?'),
    );

    if (lastSentenceEnd > targetLength * 0.5) {
      return truncated.slice(0, lastSentenceEnd + 1);
    }

    // Fall back to word boundary
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > targetLength * 0.8) {
      return truncated.slice(0, lastSpace) + '...';
    }

    return truncated + '...';
  }

  /**
   * Truncate metadata
   */
  private truncateMetadata(
    metadata: MemoryEntry['metadata'],
  ): MemoryEntry['metadata'] {
    const result: MemoryEntry['metadata'] = {
      source: metadata.source,
      confidence: metadata.confidence,
    };
    const essentialFields = [
      'userId',
      'agentId',
      'conversationId',
      'namespace',
      'tags',
    ] as const;

    for (const field of essentialFields) {
      if (field in metadata) {
        (result as Record<string, unknown>)[field] = metadata[field];
      }
    }

    return result;
  }

  /**
   * Aggressive compression for tight space constraints
   */
  private aggressiveCompress(entry: MemoryEntry): MemoryEntry {
    return {
      ...entry,
      content:
        entry.content.slice(0, 100) + (entry.content.length > 100 ? '...' : ''),
      embedding: undefined,
      metadata: {
        source: entry.metadata.source,
        confidence: entry.metadata.confidence,
        namespace: entry.metadata.namespace,
      },
    };
  }

  /**
   * Get deduplication key for entry
   */
  private getDedupeKey(entry: MemoryEntry): string {
    // Use first 100 chars of content normalized
    const contentKey = entry.content
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .slice(0, 100);
    return `${entry.type}:${contentKey}`;
  }

  /**
   * Calculate approximate size of entry in bytes
   */
  private calculateSize(entry: MemoryEntry): number {
    let size = 0;

    // Content
    size += entry.content.length * 2; // UTF-16

    // Embedding
    if (entry.embedding) {
      size += entry.embedding.length * 8; // 64-bit floats
    }

    // Metadata
    size += JSON.stringify(entry.metadata).length * 2;

    // Other fields (approximate)
    size += 200;

    return size;
  }

  /**
   * Update configuration
   */
  configure(config: Partial<CompressorConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Create compressor instance
 */
export function createCompressor(config?: CompressorConfig): Compressor {
  return new Compressor(config);
}
