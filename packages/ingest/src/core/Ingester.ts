/**
 * Ingester
 *
 * High-level document ingestion interface.
 */

import type {
  Ingester as IIngester,
  IngesterConfig,
  IngesterStatus,
  DirectoryIngestOptions,
  PipelineResult,
  ProcessedDocument,
  DocumentInput,
} from '../types/index.js';
import { Pipeline } from './Pipeline.js';
import { ParserRegistry } from './ParserRegistry.js';

/**
 * High-level document ingester
 */
export class Ingester extends Pipeline implements IIngester {
  private ingesterConfig: IngesterConfig;
  private status: IngesterStatus;
  private watcher: unknown = null;
  private processedCount = 0;
  private pendingQueue: DocumentInput[] = [];
  private startTime: number;

  constructor(config: IngesterConfig = {}) {
    super(config);
    this.ingesterConfig = config;
    this.startTime = Date.now();
    this.status = {
      isProcessing: false,
      isWatching: false,
      documentsProcessed: 0,
      documentsPending: 0,
      errorsCount: 0,
      uptime: 0,
    };
  }

  /**
   * Ingest from file path
   */
  async ingestFile(path: string): Promise<ProcessedDocument> {
    await this.validateFileSize(path);

    const extension = ParserRegistry.getExtension(path);
    const mimeType = ParserRegistry.detectMimeType(extension);

    if (!this.isSupportedMimeType(mimeType)) {
      throw new Error(`Unsupported file type: ${extension}`);
    }

    const input: DocumentInput = {
      path,
      filename: path.split('/').pop(),
      mimeType,
    };

    return this.process(input);
  }

  /**
   * Ingest from URL
   */
  async ingestUrl(url: string): Promise<ProcessedDocument> {
    const input: DocumentInput = {
      url,
      filename: url.split('/').pop()?.split('?')[0],
    };

    return this.process(input);
  }

  /**
   * Ingest from buffer
   */
  async ingestBuffer(
    buffer: Buffer,
    filename?: string,
  ): Promise<ProcessedDocument> {
    this.validateBufferSize(buffer);

    const extension = filename
      ? ParserRegistry.getExtension(filename)
      : undefined;
    const mimeType = extension
      ? ParserRegistry.detectMimeType(extension)
      : undefined;

    const input: DocumentInput = {
      buffer,
      filename,
      mimeType,
    };

    return this.process(input);
  }

  /**
   * Ingest from directory
   */
  async ingestDirectory(
    dirPath: string,
    options: DirectoryIngestOptions = {},
  ): Promise<PipelineResult> {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');

    const files = await this.listFiles(dirPath, options);

    // Sort files
    if (options.sortBy) {
      const stats = await Promise.all(
        files.map(async (f) => ({
          file: f,
          stat: await fs.stat(f),
        })),
      );

      stats.sort((a, b) => {
        switch (options.sortBy) {
          case 'name':
            return a.file.localeCompare(b.file);
          case 'date':
            return a.stat.mtime.getTime() - b.stat.mtime.getTime();
          case 'size':
            return a.stat.size - b.stat.size;
          default:
            return 0;
        }
      });

      files.length = 0;
      files.push(...stats.map((s) => s.file));
    }

    // Limit files
    const filesToProcess = options.maxFiles
      ? files.slice(0, options.maxFiles)
      : files;

    // Create inputs
    const inputs: DocumentInput[] = filesToProcess.map((filePath) => ({
      path: filePath,
      filename: path.basename(filePath),
      mimeType: ParserRegistry.detectMimeType(
        ParserRegistry.getExtension(filePath),
      ),
    }));

    return this.processBatch(inputs);
  }

  /**
   * Start watch mode
   */
  startWatching(): void {
    if (!this.ingesterConfig.watchMode?.enabled) {
      throw new Error('Watch mode is not configured');
    }

    this.status.isWatching = true;

    // Process existing files if configured
    if (this.ingesterConfig.watchMode.processExisting) {
      for (const watchPath of this.ingesterConfig.watchMode.paths) {
        this.ingestDirectory(watchPath, {
          recursive: true,
          include: this.ingesterConfig.watchMode.include,
          exclude: this.ingesterConfig.watchMode.exclude,
        }).catch((err) => {
          console.error('Error processing existing files:', err);
        });
      }
    }

    // Set up file watcher (using native fs.watch)
    void this.setupWatcher();
  }

  /**
   * Stop watch mode
   */
  stopWatching(): void {
    this.status.isWatching = false;

    if (this.watcher) {
      // Clean up watcher
      (this.watcher as { close?: () => void }).close?.();
      this.watcher = null;
    }
  }

  /**
   * Get ingestion status
   */
  getStatus(): IngesterStatus {
    return {
      ...this.status,
      documentsProcessed: this.processedCount,
      documentsPending: this.pendingQueue.length,
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * Override process to track status
   */
  async process(input: DocumentInput): Promise<ProcessedDocument> {
    this.status.isProcessing = true;
    this.status.currentDocument = input.filename ?? input.path ?? input.url;

    try {
      const result = await super.process(input);
      this.processedCount++;
      return result;
    } catch (error) {
      this.status.errorsCount++;
      throw error;
    } finally {
      this.status.isProcessing = false;
      this.status.currentDocument = undefined;
    }
  }

  /**
   * List files in directory
   */
  private async listFiles(
    dirPath: string,
    options: DirectoryIngestOptions,
  ): Promise<string[]> {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');

    const files: string[] = [];
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory() && options.recursive) {
        const subFiles = await this.listFiles(fullPath, options);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        // Check include patterns
        if (options.include && options.include.length > 0) {
          const matches = options.include.some((pattern) =>
            this.matchPattern(entry.name, pattern),
          );
          if (!matches) continue;
        }

        // Check exclude patterns
        if (options.exclude && options.exclude.length > 0) {
          const excluded = options.exclude.some((pattern) =>
            this.matchPattern(entry.name, pattern),
          );
          if (excluded) continue;
        }

        // Check if supported
        const extension = ParserRegistry.getExtension(entry.name);
        const mimeType = ParserRegistry.detectMimeType(extension);
        if (this.isSupportedMimeType(mimeType)) {
          files.push(fullPath);
        }
      }
    }

    return files;
  }

  /**
   * Match filename against pattern
   */
  private matchPattern(filename: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${regexPattern}$`).test(filename);
  }

  /**
   * Validate file size
   */
  private async validateFileSize(path: string): Promise<void> {
    if (!this.ingesterConfig.fileSizeLimit) return;

    const fs = await import('node:fs/promises');
    const stats = await fs.stat(path);

    if (stats.size > this.ingesterConfig.fileSizeLimit) {
      throw new Error(
        `File size ${stats.size} exceeds limit ${this.ingesterConfig.fileSizeLimit}`,
      );
    }
  }

  /**
   * Validate buffer size
   */
  private validateBufferSize(buffer: Buffer): void {
    if (!this.ingesterConfig.fileSizeLimit) return;

    if (buffer.length > this.ingesterConfig.fileSizeLimit) {
      throw new Error(
        `Buffer size ${buffer.length} exceeds limit ${this.ingesterConfig.fileSizeLimit}`,
      );
    }
  }

  /**
   * Check if MIME type is supported
   */
  private isSupportedMimeType(mimeType?: string): boolean {
    if (!this.ingesterConfig.supportedMimeTypes) return true;
    if (!mimeType) return false;
    return this.ingesterConfig.supportedMimeTypes.includes(mimeType);
  }

  /**
   * Set up file watcher
   */
  private async setupWatcher(): Promise<void> {
    const fs = await import('node:fs');
    const path = await import('node:path');

    if (!this.ingesterConfig.watchMode) return;

    const debounceMs = this.ingesterConfig.watchMode.debounceDelay ?? 1000;
    const pendingFiles = new Map<string, NodeJS.Timeout>();

    for (const watchPath of this.ingesterConfig.watchMode.paths) {
      const watcher = fs.watch(
        watchPath,
        { recursive: true },
        (eventType, filename) => {
          if (!filename || eventType !== 'change') return;

          const fullPath = path.join(watchPath, filename);

          // Debounce
          if (pendingFiles.has(fullPath)) {
            clearTimeout(pendingFiles.get(fullPath));
          }

          pendingFiles.set(
            fullPath,
            setTimeout(() => {
              pendingFiles.delete(fullPath);

              // Check patterns
              const watchConfig = this.ingesterConfig.watchMode!;
              if (watchConfig.include?.length) {
                const matches = watchConfig.include.some((p) =>
                  this.matchPattern(filename, p),
                );
                if (!matches) return;
              }
              if (watchConfig.exclude?.length) {
                const excluded = watchConfig.exclude.some((p) =>
                  this.matchPattern(filename, p),
                );
                if (excluded) return;
              }

              this.ingestFile(fullPath).catch((error) => {
                console.error(`Error ingesting ${fullPath}:`, error);
              });
            }, debounceMs),
          );
        },
      );

      this.watcher = watcher;
    }
  }
}

/**
 * Create a new ingester
 */
export function createIngester(config?: IngesterConfig): Ingester {
  return new Ingester(config);
}
