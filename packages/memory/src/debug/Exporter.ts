/**
 * Exporter
 *
 * Export and import memory data in various formats.
 */

import type {
  MemoryEntry,
  MemoryStoreInterface,
  ExportOptions,
} from '../types/index.js';

/**
 * Export format
 */
export type ExportFormat = 'json' | 'jsonl' | 'csv' | 'training';

/**
 * Export result
 */
export interface ExportResult {
  data: string;
  format: ExportFormat;
  entryCount: number;
  exportedAt: number;
  checksum: string;
}

/**
 * Import result
 */
export interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ entry: unknown; error: string }>;
}

/**
 * Memory exporter
 */
export class Exporter {
  private store: MemoryStoreInterface;

  constructor(store: MemoryStoreInterface) {
    this.store = store;
  }

  /**
   * Export memories to string
   */
  async export(options: ExportOptions = {}): Promise<ExportResult> {
    const format = options.format ?? 'json';

    // Get entries with filters
    const { entries } = await this.store.query({
      namespace: options.namespace,
      types: options.types as MemoryEntry['type'][],
      startTime: options.startTime,
      endTime: options.endTime,
      limit: 100000, // High limit for export
    });

    // Filter by IDs if specified
    let filtered = entries;
    if (options.ids && options.ids.length > 0) {
      const idSet = new Set(options.ids);
      filtered = entries.filter((e) => idSet.has(e.id));
    }

    // Handle embeddings
    if (!options.includeEmbeddings) {
      filtered = filtered.map((e) => ({ ...e, embedding: undefined }));
    }

    // Convert to format
    let data: string;
    switch (format) {
      case 'json':
        data = this.toJSON(filtered, options.pretty);
        break;
      case 'jsonl':
        data = this.toJSONL(filtered);
        break;
      case 'csv':
        data = this.toCSV(filtered);
        break;
      default:
        data = this.toJSON(filtered, options.pretty);
    }

    return {
      data,
      format,
      entryCount: filtered.length,
      exportedAt: Date.now(),
      checksum: this.calculateChecksum(data),
    };
  }

  /**
   * Export to JSON file content
   */
  private toJSON(entries: MemoryEntry[], pretty: boolean = false): string {
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      entryCount: entries.length,
      entries,
    };

    return pretty
      ? JSON.stringify(exportData, null, 2)
      : JSON.stringify(exportData);
  }

  /**
   * Export to JSON Lines format
   */
  private toJSONL(entries: MemoryEntry[]): string {
    return entries.map((e) => JSON.stringify(e)).join('\n');
  }

  /**
   * Export to CSV format
   */
  private toCSV(entries: MemoryEntry[]): string {
    const headers = [
      'id',
      'content',
      'type',
      'importance',
      'timestamp',
      'accessCount',
      'createdAt',
      'updatedAt',
      'namespace',
      'userId',
      'agentId',
    ];

    const rows = entries.map((e) => {
      return [
        this.escapeCSV(e.id),
        this.escapeCSV(e.content),
        e.type,
        e.importance.toString(),
        e.timestamp.toString(),
        e.accessCount.toString(),
        e.createdAt.toString(),
        e.updatedAt.toString(),
        this.escapeCSV(String(e.metadata.namespace ?? '')),
        this.escapeCSV(String(e.metadata.userId ?? '')),
        this.escapeCSV(String(e.metadata.agentId ?? '')),
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Escape CSV value
   */
  private escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Import memories from string
   */
  async import(
    data: string,
    format: ExportFormat = 'json',
    options?: {
      overwrite?: boolean;
      namespace?: string;
      validateOnly?: boolean;
    },
  ): Promise<ImportResult> {
    let entries: MemoryEntry[];

    // Parse data
    switch (format) {
      case 'json':
        entries = this.fromJSON(data);
        break;
      case 'jsonl':
        entries = this.fromJSONL(data);
        break;
      case 'csv':
        entries = this.fromCSV(data);
        break;
      default:
        entries = this.fromJSON(data);
    }

    if (options?.validateOnly) {
      return {
        imported: 0,
        skipped: 0,
        errors: [],
      };
    }

    // Import entries
    let imported = 0;
    let skipped = 0;
    const errors: Array<{ entry: unknown; error: string }> = [];

    for (const entry of entries) {
      try {
        // Apply namespace override
        if (options?.namespace) {
          entry.metadata.namespace = options.namespace;
        }

        // Check if exists
        const existing = await this.store.get(entry.id);
        if (existing && !options?.overwrite) {
          skipped++;
          continue;
        }

        // Validate entry
        if (!this.validateEntry(entry)) {
          errors.push({ entry, error: 'Invalid entry format' });
          continue;
        }

        // Add or update
        if (existing) {
          await this.store.update(entry.id, entry);
        } else {
          await this.store.add(entry);
        }

        imported++;
      } catch (error) {
        errors.push({ entry, error: String(error) });
      }
    }

    return {
      imported,
      skipped,
      errors,
    };
  }

  /**
   * Parse JSON export
   */
  private fromJSON(data: string): MemoryEntry[] {
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (parsed.entries && Array.isArray(parsed.entries)) {
      return parsed.entries;
    }
    throw new Error('Invalid JSON format');
  }

  /**
   * Parse JSONL export
   */
  private fromJSONL(data: string): MemoryEntry[] {
    return data
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));
  }

  /**
   * Parse CSV export
   */
  private fromCSV(data: string): MemoryEntry[] {
    const lines = data.split('\n');
    if (lines.length < 2) return [];

    const headers = this.parseCSVLine(lines[0]);
    const entries: MemoryEntry[] = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;

      const values = this.parseCSVLine(lines[i]);
      const obj: Record<string, unknown> = {};

      headers.forEach((header, index) => {
        obj[header] = values[index];
      });

      // Convert types
      const entry: MemoryEntry = {
        id: String(obj.id),
        content: String(obj.content),
        type: obj.type as MemoryEntry['type'],
        importance: parseFloat(String(obj.importance)) || 0.5,
        metadata: {
          source: 'explicit',
          confidence: 1.0,
          namespace: String(obj.namespace || 'default'),
          userId: obj.userId ? String(obj.userId) : undefined,
          agentId: obj.agentId ? String(obj.agentId) : undefined,
        },
        timestamp: parseInt(String(obj.timestamp)) || Date.now(),
        accessCount: parseInt(String(obj.accessCount)) || 0,
        createdAt: parseInt(String(obj.createdAt)) || Date.now(),
        updatedAt: parseInt(String(obj.updatedAt)) || Date.now(),
      };

      entries.push(entry);
    }

    return entries;
  }

  /**
   * Parse a CSV line
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  }

  /**
   * Validate entry
   */
  private validateEntry(entry: MemoryEntry): boolean {
    if (!entry.id || typeof entry.id !== 'string') return false;
    if (!entry.content || typeof entry.content !== 'string') return false;
    if (!entry.type) return false;
    if (typeof entry.importance !== 'number') return false;
    if (typeof entry.timestamp !== 'number') return false;
    return true;
  }

  /**
   * Calculate simple checksum
   */
  private calculateChecksum(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Create backup
   */
  async createBackup(name?: string): Promise<{
    name: string;
    data: ExportResult;
    createdAt: number;
  }> {
    const data = await this.export({
      format: 'json',
      includeEmbeddings: true,
      pretty: false,
    });

    return {
      name: name ?? `backup-${Date.now()}`,
      data,
      createdAt: Date.now(),
    };
  }

  /**
   * Restore from backup
   */
  async restoreBackup(
    backup: { data: ExportResult },
    options?: { clearExisting?: boolean },
  ): Promise<ImportResult> {
    if (options?.clearExisting) {
      await this.store.clear();
    }

    return this.import(backup.data.data, backup.data.format, {
      overwrite: true,
    });
  }

  /**
   * Get export size estimate
   */
  async estimateExportSize(options?: ExportOptions): Promise<{
    entryCount: number;
    estimatedSizeBytes: number;
    withEmbeddingsBytes?: number;
  }> {
    const { entries, total } = await this.store.query({
      namespace: options?.namespace,
      types: options?.types as MemoryEntry['type'][],
      limit: 100, // Sample
    });

    if (entries.length === 0) {
      return {
        entryCount: total,
        estimatedSizeBytes: 0,
      };
    }

    // Calculate average size
    let totalSize = 0;
    let totalSizeWithEmbeddings = 0;

    for (const entry of entries) {
      const withoutEmbed = {
        ...entry,
        embedding: undefined,
      };
      totalSize += JSON.stringify(withoutEmbed).length;
      totalSizeWithEmbeddings += JSON.stringify(entry).length;
    }

    const avgSize = totalSize / entries.length;
    const avgSizeWithEmbed = totalSizeWithEmbeddings / entries.length;

    return {
      entryCount: total,
      estimatedSizeBytes: Math.round(avgSize * total),
      withEmbeddingsBytes: Math.round(avgSizeWithEmbed * total),
    };
  }

  /**
   * Diff two exports
   */
  diffExports(
    export1: ExportResult,
    export2: ExportResult,
  ): {
    added: string[];
    removed: string[];
    modified: string[];
    unchanged: string[];
  } {
    const entries1 = this.fromJSON(export1.data);
    const entries2 = this.fromJSON(export2.data);

    const map1 = new Map(entries1.map((e) => [e.id, e]));
    const map2 = new Map(entries2.map((e) => [e.id, e]));

    const added: string[] = [];
    const removed: string[] = [];
    const modified: string[] = [];
    const unchanged: string[] = [];

    // Check entries in export2
    for (const [id, entry2] of map2) {
      const entry1 = map1.get(id);
      if (!entry1) {
        added.push(id);
      } else if (JSON.stringify(entry1) !== JSON.stringify(entry2)) {
        modified.push(id);
      } else {
        unchanged.push(id);
      }
    }

    // Check for removed entries
    for (const id of map1.keys()) {
      if (!map2.has(id)) {
        removed.push(id);
      }
    }

    return { added, removed, modified, unchanged };
  }
}

/**
 * Create exporter instance
 */
export function createExporter(store: MemoryStoreInterface): Exporter {
  return new Exporter(store);
}
