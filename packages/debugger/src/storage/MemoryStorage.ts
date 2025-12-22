/**
 * MemoryStorage
 *
 * In-memory storage adapter for recordings.
 */

import type {
  Recording,
  Checkpoint,
  RecordingStorageAdapter,
} from '../types/index.js';
import { deepClone, estimateSize } from '../utils/helpers.js';

/**
 * Memory storage options
 */
export interface MemoryStorageOptions {
  /** Maximum recordings to store */
  maxRecordings?: number;
  /** Maximum total size in bytes */
  maxSizeBytes?: number;
  /** Whether to deep clone on save/load */
  deepCopy?: boolean;
}

/**
 * Recording entry with metadata
 */
interface RecordingEntry {
  recording: Recording;
  size: number;
  savedAt: number;
}

/**
 * Checkpoint entry with metadata
 */
interface CheckpointEntry {
  checkpoint: Checkpoint;
  size: number;
  savedAt: number;
}

/**
 * MemoryStorage
 *
 * In-memory storage for debug recordings.
 * Useful for testing and development.
 *
 * @example
 * ```typescript
 * const storage = new MemoryStorage({
 *   maxRecordings: 100,
 *   maxSizeBytes: 50 * 1024 * 1024, // 50MB
 * });
 *
 * // Save a recording
 * await storage.save(recording);
 *
 * // Load a recording
 * const loaded = await storage.load('rec_123');
 *
 * // List all recordings
 * const recordings = await storage.list();
 * ```
 */
export class MemoryStorage implements RecordingStorageAdapter {
  private recordings: Map<string, RecordingEntry> = new Map();
  private checkpoints: Map<string, CheckpointEntry> = new Map();
  private options: Required<MemoryStorageOptions>;
  private totalSize = 0;

  constructor(options?: MemoryStorageOptions) {
    this.options = {
      maxRecordings: options?.maxRecordings ?? 1000,
      maxSizeBytes: options?.maxSizeBytes ?? 100 * 1024 * 1024, // 100MB
      deepCopy: options?.deepCopy ?? true,
    };
  }

  /**
   * Save a recording
   */
  save(recording: Recording): Promise<void> {
    const size = estimateSize(recording);

    // Check size limit
    if (size > this.options.maxSizeBytes) {
      return Promise.reject(new Error('Recording exceeds maximum size limit'));
    }

    // Evict old recordings if needed
    this.ensureCapacity(size);

    const entry: RecordingEntry = {
      recording: this.options.deepCopy ? deepClone(recording) : recording,
      size,
      savedAt: Date.now(),
    };

    // Update total size
    const existing = this.recordings.get(recording.id);
    if (existing) {
      this.totalSize -= existing.size;
    }
    this.totalSize += size;

    this.recordings.set(recording.id, entry);

    // Save checkpoints
    for (const checkpoint of recording.checkpoints) {
      this.saveCheckpoint(checkpoint);
    }

    return Promise.resolve();
  }

  /**
   * Load a recording
   */
  load(id: string): Promise<Recording | undefined> {
    const entry = this.recordings.get(id);
    if (!entry) {
      return Promise.resolve(undefined);
    }

    return Promise.resolve(
      this.options.deepCopy ? deepClone(entry.recording) : entry.recording,
    );
  }

  /**
   * Delete a recording
   */
  delete(id: string): Promise<boolean> {
    const entry = this.recordings.get(id);
    if (!entry) {
      return Promise.resolve(false);
    }

    this.totalSize -= entry.size;
    this.recordings.delete(id);

    // Delete associated checkpoints
    for (const checkpoint of entry.recording.checkpoints) {
      this.deleteCheckpoint(checkpoint.id);
    }

    return Promise.resolve(true);
  }

  /**
   * List all recordings
   */
  list(): Promise<
    Array<{
      id: string;
      agentId: string;
      agentName: string;
      status: string;
      startedAt: number;
      endedAt?: number;
      durationMs: number;
      stepsCount: number;
    }>
  > {
    const results: Array<{
      id: string;
      agentId: string;
      agentName: string;
      status: string;
      startedAt: number;
      endedAt?: number;
      durationMs: number;
      stepsCount: number;
    }> = [];

    for (const entry of this.recordings.values()) {
      const r = entry.recording;
      results.push({
        id: r.id,
        agentId: r.agentId,
        agentName: r.agentName,
        status: r.status,
        startedAt: r.startedAt,
        endedAt: r.endedAt,
        durationMs: r.durationMs,
        stepsCount: r.steps.length,
      });
    }

    // Sort by start time descending
    results.sort((a, b) => b.startedAt - a.startedAt);

    return Promise.resolve(results);
  }

  /**
   * Query recordings
   */
  async query(options: {
    agentId?: string;
    status?: string;
    startAfter?: number;
    startBefore?: number;
    limit?: number;
  }): Promise<
    Array<{
      id: string;
      agentId: string;
      agentName: string;
      status: string;
      startedAt: number;
      endedAt?: number;
      durationMs: number;
      stepsCount: number;
    }>
  > {
    let results = await this.list();

    // Apply filters
    if (options.agentId) {
      results = results.filter((r) => r.agentId === options.agentId);
    }

    if (options.status) {
      results = results.filter((r) => r.status === options.status);
    }

    if (options.startAfter) {
      results = results.filter((r) => r.startedAt > options.startAfter!);
    }

    if (options.startBefore) {
      results = results.filter((r) => r.startedAt < options.startBefore!);
    }

    // Apply limit
    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Save a checkpoint
   */
  saveCheckpoint(checkpoint: Checkpoint): void {
    const size = estimateSize(checkpoint);

    const entry: CheckpointEntry = {
      checkpoint: this.options.deepCopy ? deepClone(checkpoint) : checkpoint,
      size,
      savedAt: Date.now(),
    };

    // Update total size
    const existing = this.checkpoints.get(checkpoint.id);
    if (existing) {
      this.totalSize -= existing.size;
    }
    this.totalSize += size;

    this.checkpoints.set(checkpoint.id, entry);
  }

  /**
   * Load a checkpoint
   */
  loadCheckpoint(id: string): Checkpoint | undefined {
    const entry = this.checkpoints.get(id);
    if (!entry) {
      return undefined;
    }

    return this.options.deepCopy
      ? deepClone(entry.checkpoint)
      : entry.checkpoint;
  }

  /**
   * Delete a checkpoint
   */
  deleteCheckpoint(id: string): boolean {
    const entry = this.checkpoints.get(id);
    if (!entry) {
      return false;
    }

    this.totalSize -= entry.size;
    this.checkpoints.delete(id);
    return true;
  }

  /**
   * List checkpoints for a recording
   */
  listCheckpoints(recordingId: string): Checkpoint[] {
    const results: Checkpoint[] = [];

    for (const entry of this.checkpoints.values()) {
      if (entry.checkpoint.recordingId === recordingId) {
        results.push(
          this.options.deepCopy
            ? deepClone(entry.checkpoint)
            : entry.checkpoint,
        );
      }
    }

    // Sort by step index
    results.sort((a, b) => a.stepIndex - b.stepIndex);

    return results;
  }

  /**
   * Ensure capacity for new data
   */
  private ensureCapacity(requiredSize: number): void {
    // Check recording count limit
    while (this.recordings.size >= this.options.maxRecordings) {
      this.evictOldest();
    }

    // Check size limit
    while (this.totalSize + requiredSize > this.options.maxSizeBytes) {
      if (this.recordings.size === 0) {
        break;
      }
      this.evictOldest();
    }
  }

  /**
   * Evict the oldest recording
   */
  private evictOldest(): void {
    let oldestId: string | undefined;
    let oldestTime = Infinity;

    for (const [id, entry] of this.recordings) {
      if (entry.savedAt < oldestTime) {
        oldestTime = entry.savedAt;
        oldestId = id;
      }
    }

    if (oldestId) {
      void this.delete(oldestId);
    }
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.recordings.clear();
    this.checkpoints.clear();
    this.totalSize = 0;
  }

  /**
   * Get storage statistics
   */
  getStats(): {
    totalRecordings: number;
    totalCheckpoints: number;
    totalSizeBytes: number;
    maxRecordings: number;
    maxSizeBytes: number;
    utilizationPercent: number;
  } {
    return {
      totalRecordings: this.recordings.size,
      totalCheckpoints: this.checkpoints.size,
      totalSizeBytes: this.totalSize,
      maxRecordings: this.options.maxRecordings,
      maxSizeBytes: this.options.maxSizeBytes,
      utilizationPercent: (this.totalSize / this.options.maxSizeBytes) * 100,
    };
  }

  /**
   * Export all data
   */
  exportAll(): {
    recordings: Recording[];
    checkpoints: Checkpoint[];
  } {
    const recordings: Recording[] = [];
    const checkpoints: Checkpoint[] = [];

    for (const entry of this.recordings.values()) {
      recordings.push(
        this.options.deepCopy ? deepClone(entry.recording) : entry.recording,
      );
    }

    for (const entry of this.checkpoints.values()) {
      checkpoints.push(
        this.options.deepCopy ? deepClone(entry.checkpoint) : entry.checkpoint,
      );
    }

    return { recordings, checkpoints };
  }

  /**
   * Import data
   */
  importAll(data: {
    recordings: Recording[];
    checkpoints?: Checkpoint[];
  }): void {
    for (const recording of data.recordings) {
      void this.save(recording);
    }

    if (data.checkpoints) {
      for (const checkpoint of data.checkpoints) {
        this.saveCheckpoint(checkpoint);
      }
    }
  }
}

/**
 * Create memory storage
 */
export function createMemoryStorage(
  options?: MemoryStorageOptions,
): MemoryStorage {
  return new MemoryStorage(options);
}
