/**
 * FileStorage
 *
 * File-based storage adapter for recordings.
 */

import type {
  Recording,
  Checkpoint,
  RecordingStorageAdapter,
} from '../types/index.js';
import { safeStringify, safeParse } from '../utils/helpers.js';

/**
 * File system interface (for Node.js compatibility)
 */
export interface FileSystem {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  readdir(path: string): Promise<string[]>;
  unlink(path: string): Promise<void>;
  stat(
    path: string,
  ): Promise<{ isFile(): boolean; isDirectory(): boolean; mtime: Date }>;
}

/**
 * File storage options
 */
export interface FileStorageOptions {
  /** Base directory for storage */
  basePath: string;
  /** File extension */
  extension?: string;
  /** Whether to compress files */
  compress?: boolean;
  /** Whether to pretty print JSON */
  prettyPrint?: boolean;
  /** File system implementation */
  fs: FileSystem;
}

/**
 * Recording metadata for listing
 */
export interface RecordingMeta {
  id: string;
  agentId: string;
  agentName: string;
  status: string;
  startedAt: number;
  endedAt?: number;
  durationMs: number;
  stepsCount: number;
  filePath: string;
  fileSize?: number;
}

/**
 * FileStorage
 *
 * File-based storage for debug recordings.
 *
 * @example
 * ```typescript
 * import * as fs from 'fs/promises';
 *
 * const storage = new FileStorage({
 *   basePath: './debug-recordings',
 *   fs: {
 *     readFile: (p) => fs.readFile(p, 'utf-8'),
 *     writeFile: (p, c) => fs.writeFile(p, c, 'utf-8'),
 *     exists: async (p) => fs.access(p).then(() => true).catch(() => false),
 *     mkdir: (p, o) => fs.mkdir(p, o),
 *     readdir: (p) => fs.readdir(p),
 *     unlink: (p) => fs.unlink(p),
 *     stat: (p) => fs.stat(p),
 *   },
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
export class FileStorage implements RecordingStorageAdapter {
  private options: Required<FileStorageOptions>;
  private initialized = false;

  constructor(options: FileStorageOptions) {
    this.options = {
      basePath: options.basePath,
      extension: options.extension ?? '.json',
      compress: options.compress ?? false,
      prettyPrint: options.prettyPrint ?? true,
      fs: options.fs,
    };
  }

  /**
   * Initialize storage (create directories)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const { fs, basePath } = this.options;

    // Create base directory
    const exists = await fs.exists(basePath);
    if (!exists) {
      await fs.mkdir(basePath, { recursive: true });
    }

    // Create subdirectories
    const subdirs = ['recordings', 'checkpoints', 'metadata'];
    for (const subdir of subdirs) {
      const path = this.joinPath(basePath, subdir);
      const subdirExists = await fs.exists(path);
      if (!subdirExists) {
        await fs.mkdir(path, { recursive: true });
      }
    }

    this.initialized = true;
  }

  /**
   * Save a recording
   */
  async save(recording: Recording): Promise<void> {
    await this.initialize();

    const { fs, prettyPrint } = this.options;
    const filePath = this.getRecordingPath(recording.id);

    const content = prettyPrint
      ? safeStringify(recording, 2)
      : safeStringify(recording);

    await fs.writeFile(filePath, content);

    // Save metadata separately for quick listing
    await this.saveMetadata(recording);

    // Save checkpoints separately
    for (const checkpoint of recording.checkpoints) {
      await this.saveCheckpoint(checkpoint);
    }
  }

  /**
   * Load a recording
   */
  async load(id: string): Promise<Recording | undefined> {
    await this.initialize();

    const { fs } = this.options;
    const filePath = this.getRecordingPath(id);

    const exists = await fs.exists(filePath);
    if (!exists) {
      return undefined;
    }

    const content = await fs.readFile(filePath);
    return safeParse<Recording>(content);
  }

  /**
   * Delete a recording
   */
  async delete(id: string): Promise<boolean> {
    await this.initialize();

    const { fs } = this.options;
    const filePath = this.getRecordingPath(id);

    const exists = await fs.exists(filePath);
    if (!exists) {
      return false;
    }

    await fs.unlink(filePath);

    // Delete metadata
    const metaPath = this.getMetadataPath(id);
    if (await fs.exists(metaPath)) {
      await fs.unlink(metaPath);
    }

    return true;
  }

  /**
   * List all recordings
   */
  async list(): Promise<RecordingMeta[]> {
    await this.initialize();

    const { fs } = this.options;
    const metaDir = this.joinPath(this.options.basePath, 'metadata');

    const files = await fs.readdir(metaDir);
    const metas: RecordingMeta[] = [];

    for (const file of files) {
      if (file.endsWith(this.options.extension)) {
        const filePath = this.joinPath(metaDir, file);
        const content = await fs.readFile(filePath);
        const meta = safeParse<RecordingMeta>(content);
        if (meta) {
          metas.push(meta);
        }
      }
    }

    // Sort by start time descending
    metas.sort((a, b) => b.startedAt - a.startedAt);

    return metas;
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
  }): Promise<RecordingMeta[]> {
    let recordings = await this.list();

    // Apply filters
    if (options.agentId) {
      recordings = recordings.filter((r) => r.agentId === options.agentId);
    }

    if (options.status) {
      recordings = recordings.filter((r) => r.status === options.status);
    }

    if (options.startAfter) {
      recordings = recordings.filter((r) => r.startedAt > options.startAfter!);
    }

    if (options.startBefore) {
      recordings = recordings.filter((r) => r.startedAt < options.startBefore!);
    }

    // Apply limit
    if (options.limit) {
      recordings = recordings.slice(0, options.limit);
    }

    return recordings;
  }

  /**
   * Save a checkpoint
   */
  async saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
    await this.initialize();

    const { fs, prettyPrint } = this.options;
    const filePath = this.getCheckpointPath(checkpoint.id);

    const content = prettyPrint
      ? safeStringify(checkpoint, 2)
      : safeStringify(checkpoint);

    await fs.writeFile(filePath, content);
  }

  /**
   * Load a checkpoint
   */
  async loadCheckpoint(id: string): Promise<Checkpoint | undefined> {
    await this.initialize();

    const { fs } = this.options;
    const filePath = this.getCheckpointPath(id);

    const exists = await fs.exists(filePath);
    if (!exists) {
      return undefined;
    }

    const content = await fs.readFile(filePath);
    return safeParse<Checkpoint>(content);
  }

  /**
   * List checkpoints for a recording
   */
  async listCheckpoints(recordingId: string): Promise<Checkpoint[]> {
    await this.initialize();

    const { fs } = this.options;
    const cpDir = this.joinPath(this.options.basePath, 'checkpoints');

    const files = await fs.readdir(cpDir);
    const checkpoints: Checkpoint[] = [];

    for (const file of files) {
      if (file.endsWith(this.options.extension)) {
        const filePath = this.joinPath(cpDir, file);
        const content = await fs.readFile(filePath);
        const cp = safeParse<Checkpoint>(content);
        if (cp && cp.recordingId === recordingId) {
          checkpoints.push(cp);
        }
      }
    }

    // Sort by step index
    checkpoints.sort((a, b) => a.stepIndex - b.stepIndex);

    return checkpoints;
  }

  /**
   * Save metadata for quick listing
   */
  private async saveMetadata(recording: Recording): Promise<void> {
    const { fs, prettyPrint } = this.options;
    const filePath = this.getMetadataPath(recording.id);

    const meta: RecordingMeta = {
      id: recording.id,
      agentId: recording.agentId,
      agentName: recording.agentName,
      status: recording.status,
      startedAt: recording.startedAt,
      endedAt: recording.endedAt,
      durationMs: recording.durationMs,
      stepsCount: recording.steps.length,
      filePath: this.getRecordingPath(recording.id),
    };

    const content = prettyPrint ? safeStringify(meta, 2) : safeStringify(meta);

    await fs.writeFile(filePath, content);
  }

  /**
   * Get recording file path
   */
  private getRecordingPath(id: string): string {
    return this.joinPath(
      this.options.basePath,
      'recordings',
      `${id}${this.options.extension}`,
    );
  }

  /**
   * Get metadata file path
   */
  private getMetadataPath(id: string): string {
    return this.joinPath(
      this.options.basePath,
      'metadata',
      `${id}${this.options.extension}`,
    );
  }

  /**
   * Get checkpoint file path
   */
  private getCheckpointPath(id: string): string {
    return this.joinPath(
      this.options.basePath,
      'checkpoints',
      `${id}${this.options.extension}`,
    );
  }

  /**
   * Join path segments
   */
  private joinPath(...segments: string[]): string {
    return segments.join('/').replace(/\/+/g, '/');
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    totalRecordings: number;
    totalCheckpoints: number;
    totalSizeBytes: number;
  }> {
    await this.initialize();

    const { fs } = this.options;
    const recordings = await this.list();

    let totalSize = 0;
    for (const meta of recordings) {
      const stat = await fs.stat(meta.filePath);
      if (stat) {
        totalSize += (stat as { size?: number }).size ?? 0;
      }
    }

    const cpDir = this.joinPath(this.options.basePath, 'checkpoints');
    const cpFiles = await fs.readdir(cpDir);

    return {
      totalRecordings: recordings.length,
      totalCheckpoints: cpFiles.length,
      totalSizeBytes: totalSize,
    };
  }
}

/**
 * Create file storage
 */
export function createFileStorage(options: FileStorageOptions): FileStorage {
  return new FileStorage(options);
}
