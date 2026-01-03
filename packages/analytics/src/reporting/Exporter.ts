/**
 * Exporter
 *
 * Exports analytics data in various formats.
 */

import type {
  AnalyticsStorageAdapter,
  TimeRange,
  TimePeriod,
} from '../types/index.js';
import type { Report } from './ReportGenerator.js';

/**
 * Export format
 */
export type ExportFormat = 'json' | 'csv' | 'markdown' | 'html';

/**
 * Export options
 */
export interface ExportOptions {
  format: ExportFormat;
  period?: TimePeriod | TimeRange;
  includeMessages?: boolean;
  includeEvents?: boolean;
  pretty?: boolean;
}

/**
 * Export result
 */
export interface ExportResult {
  format: ExportFormat;
  data: string;
  filename: string;
  mimeType: string;
  size: number;
  exportedAt: number;
}

/**
 * Exporter - Exports analytics data
 */
export class Exporter {
  private readonly storage: AnalyticsStorageAdapter;

  constructor(storage: AnalyticsStorageAdapter) {
    this.storage = storage;
  }

  /**
   * Export conversations
   */
  async exportConversations(options: ExportOptions): Promise<ExportResult> {
    const timeRange = options.period
      ? this.resolveTimeRange(options.period)
      : undefined;

    const result = await this.storage.queryConversations({ timeRange });
    const conversations = result.conversations;

    // Remove messages if not requested
    const data = options.includeMessages
      ? conversations
      : conversations.map((c) => ({
          ...c,
          messages: `[${c.messages.length} messages]`,
        }));

    return this.formatOutput(data, options, 'conversations');
  }

  /**
   * Export events
   */
  async exportEvents(options: ExportOptions): Promise<ExportResult> {
    const timeRange = options.period
      ? this.resolveTimeRange(options.period)
      : undefined;

    const events = await this.storage.queryEvents({ timeRange });

    return this.formatOutput(events, options, 'events');
  }

  /**
   * Export report
   */
  exportReport(report: Report, format: ExportFormat): ExportResult {
    const options: ExportOptions = { format, pretty: true };
    return this.formatOutput(report, options, 'report');
  }

  /**
   * Format output based on format type
   */
  private formatOutput(
    data: unknown,
    options: ExportOptions,
    type: string,
  ): ExportResult {
    const timestamp = Date.now();
    let output: string;
    let mimeType: string;
    let extension: string;

    switch (options.format) {
      case 'json':
        output = options.pretty
          ? JSON.stringify(data, null, 2)
          : JSON.stringify(data);
        mimeType = 'application/json';
        extension = 'json';
        break;

      case 'csv':
        output = this.toCSV(data);
        mimeType = 'text/csv';
        extension = 'csv';
        break;

      case 'markdown':
        output = this.toMarkdown(data, type);
        mimeType = 'text/markdown';
        extension = 'md';
        break;

      case 'html':
        output = this.toHTML(data, type);
        mimeType = 'text/html';
        extension = 'html';
        break;

      default:
        throw new Error(`Unsupported format: ${options.format as string}`);
    }

    return {
      format: options.format,
      data: output,
      filename: `${type}-${timestamp}.${extension}`,
      mimeType,
      size: new TextEncoder().encode(output).length,
      exportedAt: timestamp,
    };
  }

  /**
   * Convert data to CSV
   */
  private toCSV(data: unknown): string {
    if (!Array.isArray(data)) {
      data = [data];
    }

    const rows = data as Record<string, unknown>[];
    if (rows.length === 0) {
      return '';
    }

    // Flatten nested objects
    const flattened = rows.map((row) => this.flattenObject(row));

    // Get all unique keys
    const keys = new Set<string>();
    for (const row of flattened) {
      for (const key of Object.keys(row)) {
        keys.add(key);
      }
    }
    const headers = Array.from(keys);

    // Build CSV
    const lines: string[] = [];

    // Header row
    lines.push(headers.map((h) => this.escapeCSV(h)).join(','));

    // Data rows
    for (const row of flattened) {
      const values = headers.map((h) => {
        const value = row[h];
        return this.escapeCSV(value !== undefined ? String(value) : '');
      });
      lines.push(values.join(','));
    }

    return lines.join('\n');
  }

  /**
   * Flatten nested object
   */
  private flattenObject(
    obj: Record<string, unknown>,
    prefix = '',
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(
          result,
          this.flattenObject(value as Record<string, unknown>, newKey),
        );
      } else if (Array.isArray(value)) {
        result[newKey] = value.length;
      } else {
        result[newKey] = value;
      }
    }

    return result;
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
   * Convert data to Markdown
   */
  private toMarkdown(data: unknown, type: string): string {
    const lines: string[] = [];

    lines.push(`# ${type.charAt(0).toUpperCase() + type.slice(1)} Export`);
    lines.push('');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push('');

    if (Array.isArray(data)) {
      lines.push(`## Summary`);
      lines.push('');
      lines.push(`Total records: ${data.length}`);
      lines.push('');

      if (data.length > 0) {
        // Create table
        const sample = data[0] as Record<string, unknown>;
        const keys = Object.keys(sample).filter(
          (k) => typeof sample[k] !== 'object',
        );

        if (keys.length > 0) {
          lines.push('## Data');
          lines.push('');
          lines.push('| ' + keys.join(' | ') + ' |');
          lines.push('| ' + keys.map(() => '---').join(' | ') + ' |');

          for (const row of data.slice(0, 50)) {
            const record = row as Record<string, unknown>;
            const values = keys.map((k) =>
              String(record[k] ?? '').slice(0, 50),
            );
            lines.push('| ' + values.join(' | ') + ' |');
          }

          if (data.length > 50) {
            lines.push('');
            lines.push(`*Showing first 50 of ${data.length} records*`);
          }
        }
      }
    } else {
      // Single object (like a report)
      lines.push('```json');
      lines.push(JSON.stringify(data, null, 2));
      lines.push('```');
    }

    return lines.join('\n');
  }

  /**
   * Convert data to HTML
   */
  private toHTML(data: unknown, type: string): string {
    const lines: string[] = [];

    lines.push('<!DOCTYPE html>');
    lines.push('<html>');
    lines.push('<head>');
    lines.push(`<title>${type} Export</title>`);
    lines.push('<style>');
    lines.push('body { font-family: system-ui, sans-serif; margin: 2rem; }');
    lines.push('table { border-collapse: collapse; width: 100%; }');
    lines.push(
      'th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }',
    );
    lines.push('th { background-color: #f5f5f5; }');
    lines.push('tr:nth-child(even) { background-color: #fafafa; }');
    lines.push(
      '.summary { background: #f0f0f0; padding: 1rem; border-radius: 4px; }',
    );
    lines.push('</style>');
    lines.push('</head>');
    lines.push('<body>');

    lines.push(
      `<h1>${type.charAt(0).toUpperCase() + type.slice(1)} Export</h1>`,
    );
    lines.push(`<p>Generated: ${new Date().toISOString()}</p>`);

    if (Array.isArray(data)) {
      lines.push(
        `<div class="summary"><strong>Total records:</strong> ${data.length}</div>`,
      );

      if (data.length > 0) {
        const sample = data[0] as Record<string, unknown>;
        const keys = Object.keys(sample).filter(
          (k) => typeof sample[k] !== 'object',
        );

        if (keys.length > 0) {
          lines.push('<h2>Data</h2>');
          lines.push('<table>');
          lines.push('<thead><tr>');
          for (const key of keys) {
            lines.push(`<th>${this.escapeHTML(key)}</th>`);
          }
          lines.push('</tr></thead>');
          lines.push('<tbody>');

          for (const row of data.slice(0, 100)) {
            const record = row as Record<string, unknown>;
            lines.push('<tr>');
            for (const key of keys) {
              const value = String(record[key] ?? '').slice(0, 100);
              lines.push(`<td>${this.escapeHTML(value)}</td>`);
            }
            lines.push('</tr>');
          }

          lines.push('</tbody>');
          lines.push('</table>');

          if (data.length > 100) {
            lines.push(
              `<p><em>Showing first 100 of ${data.length} records</em></p>`,
            );
          }
        }
      }
    } else {
      lines.push('<pre>');
      lines.push(this.escapeHTML(JSON.stringify(data, null, 2)));
      lines.push('</pre>');
    }

    lines.push('</body>');
    lines.push('</html>');

    return lines.join('\n');
  }

  /**
   * Escape HTML
   */
  private escapeHTML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Resolve time range from period
   */
  private resolveTimeRange(period: TimePeriod | TimeRange): TimeRange {
    if (typeof period === 'object' && 'start' in period) {
      return period;
    }

    const now = Date.now();
    const HOUR = 60 * 60 * 1000;
    const DAY = 24 * HOUR;
    const periods: Record<TimePeriod, number> = {
      hour: HOUR,
      day: DAY,
      week: 7 * DAY,
      month: 30 * DAY,
      quarter: 90 * DAY,
      year: 365 * DAY,
      'last-hour': HOUR,
      'last-24-hours': DAY,
      'last-7-days': 7 * DAY,
      'last-30-days': 30 * DAY,
      'last-90-days': 90 * DAY,
      'last-year': 365 * DAY,
      today: DAY,
      'this-week': 7 * DAY,
      'this-month': 30 * DAY,
      'this-quarter': 90 * DAY,
      'this-year': 365 * DAY,
      'all-time': Number.MAX_SAFE_INTEGER,
    };

    return {
      start: now - periods[period],
      end: now,
    };
  }
}
