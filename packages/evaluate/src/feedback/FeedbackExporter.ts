/**
 * FeedbackExporter
 *
 * Export feedback data to various formats.
 */

import * as fs from 'fs/promises';
import type {
  FeedbackEntry,
  FeedbackStoreInterface,
  ExportOptions,
  FeedbackQueryOptions,
} from '../types/index.js';

/**
 * Feedback exporter
 */
export class FeedbackExporter {
  constructor(private store: FeedbackStoreInterface) {}

  /**
   * Export feedback to string
   */
  async exportToString(options: ExportOptions): Promise<string> {
    const entries = await this.getEntries(options.query);
    const filtered = this.filterFields(
      entries,
      options.fields,
      options.includeMetadata,
    );

    switch (options.format) {
      case 'json':
        return JSON.stringify(filtered, null, 2);
      case 'jsonl':
        return filtered.map((e) => JSON.stringify(e)).join('\n');
      case 'csv':
        return this.toCSV(filtered);
      default:
        throw new Error(`Unknown export format: ${String(options.format)}`);
    }
  }

  /**
   * Export feedback to file
   */
  async exportToFile(path: string, options: ExportOptions): Promise<number> {
    const content = await this.exportToString(options);
    await fs.writeFile(path, content, 'utf-8');
    const entries = await this.getEntries(options.query);
    return entries.length;
  }

  /**
   * Stream export for large datasets
   */
  async *exportStream(
    options: ExportOptions,
    batchSize = 1000,
  ): AsyncGenerator<string, void, unknown> {
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { entries, hasMore: more } = await this.store.query({
        ...options.query,
        limit: batchSize,
        offset,
      });

      hasMore = more;
      offset += entries.length;

      const filtered = this.filterFields(
        entries,
        options.fields,
        options.includeMetadata,
      );

      if (options.format === 'jsonl') {
        for (const entry of filtered) {
          yield JSON.stringify(entry) + '\n';
        }
      } else if (options.format === 'csv') {
        if (offset === batchSize) {
          // First batch - include header
          yield this.toCSV(filtered);
        } else {
          // Subsequent batches - no header
          yield this.toCSVRows(filtered);
        }
      }
    }
  }

  /**
   * Get entries from store
   */
  private async getEntries(
    query?: FeedbackQueryOptions,
  ): Promise<FeedbackEntry[]> {
    const { entries } = await this.store.query({
      ...query,
      limit: query?.limit ?? 100000,
    });
    return entries;
  }

  /**
   * Filter fields from entries
   */
  private filterFields(
    entries: FeedbackEntry[],
    fields?: string[],
    includeMetadata = true,
  ): Record<string, unknown>[] {
    return entries.map((entry) => {
      const entryRecord = entry as unknown as Record<string, unknown>;

      if (fields && fields.length > 0) {
        const filtered: Record<string, unknown> = {};
        for (const field of fields) {
          if (field in entryRecord) {
            filtered[field] = entryRecord[field];
          }
        }
        return filtered;
      }

      if (!includeMetadata) {
        const { metadata: _metadata, ...rest } = entryRecord;
        return rest;
      }

      return entryRecord;
    });
  }

  /**
   * Convert entries to CSV
   */
  private toCSV(entries: Record<string, unknown>[]): string {
    if (entries.length === 0) return '';

    const headers = this.getCSVHeaders(entries);
    const headerRow = headers.map((h) => this.escapeCSV(h)).join(',');

    const rows = entries.map((entry) => {
      return headers
        .map((header) => {
          const value = entry[header];
          return this.escapeCSV(this.formatCSVValue(value));
        })
        .join(',');
    });

    return [headerRow, ...rows].join('\n');
  }

  /**
   * Convert entries to CSV rows (no header)
   */
  private toCSVRows(entries: Record<string, unknown>[]): string {
    if (entries.length === 0) return '';

    const headers = this.getCSVHeaders(entries);

    return entries
      .map((entry) => {
        return headers
          .map((header) => {
            const value = entry[header];
            return this.escapeCSV(this.formatCSVValue(value));
          })
          .join(',');
      })
      .join('\n');
  }

  /**
   * Get CSV headers from entries
   */
  private getCSVHeaders(entries: Record<string, unknown>[]): string[] {
    const headers = new Set<string>();
    for (const entry of entries) {
      for (const key of Object.keys(entry)) {
        headers.add(key);
      }
    }
    return Array.from(headers);
  }

  /**
   * Format value for CSV
   */
  private formatCSVValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
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
}

/**
 * Create a feedback exporter
 */
export function createFeedbackExporter(
  store: FeedbackStoreInterface,
): FeedbackExporter {
  return new FeedbackExporter(store);
}
