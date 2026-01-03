/**
 * DatasetExporter
 *
 * Export datasets to various formats.
 */

import * as fs from 'fs/promises';
import type {
  PreferencePair,
  DatasetExportFormat,
  DatasetExportOptions,
  ExportResult,
  HFExportOptions,
  DPOFormatItem,
  SFTFormatItem,
  AnthropicFormatItem,
  OpenAIFormatItem,
} from '../types/index.js';
import { PreferenceDataset } from './PreferenceDatasetBuilder.js';

/**
 * Dataset exporter
 */
export class DatasetExporter {
  /**
   * Export preference dataset to file
   */
  async exportPreferences(
    dataset: PreferenceDataset,
    options: DatasetExportOptions,
  ): Promise<ExportResult> {
    const pairs = dataset.getPairs();
    let content: string;
    const warnings: string[] = [];

    switch (options.format) {
      case 'jsonl':
        content = this.toJSONL(pairs, options);
        break;
      case 'json':
        content = JSON.stringify(pairs, null, 2);
        break;
      case 'csv':
        content = this.toCSV(pairs);
        break;
      case 'huggingface':
        return this.exportToHuggingFace(pairs, options);
      case 'anthropic':
        content = this.toAnthropicFormat(pairs);
        break;
      case 'openai':
        content = this.toOpenAIFormat(pairs);
        break;
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }

    if (options.path) {
      await fs.writeFile(options.path, content, 'utf-8');
    }

    return {
      format: options.format,
      path: options.path,
      itemCount: pairs.length,
      bytesWritten: Buffer.byteLength(content, 'utf-8'),
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Convert to JSONL format
   */
  toJSONL(
    pairs: PreferencePair[],
    options?: { formatOptions?: Record<string, unknown> },
  ): string {
    const format = (options?.formatOptions?.format as string) ?? 'dpo';

    return pairs
      .map((pair) => {
        switch (format) {
          case 'dpo':
            return JSON.stringify({
              prompt: pair.prompt,
              chosen: pair.chosen,
              rejected: pair.rejected,
            } as DPOFormatItem);
          case 'sft':
            return JSON.stringify({
              instruction: pair.prompt,
              output: pair.chosen,
            } as SFTFormatItem);
          default:
            return JSON.stringify(pair);
        }
      })
      .join('\n');
  }

  /**
   * Convert to CSV format
   */
  toCSV(pairs: PreferencePair[]): string {
    const headers = [
      'prompt',
      'chosen',
      'rejected',
      'chosen_model',
      'rejected_model',
      'confidence',
    ];
    const rows = pairs.map((pair) =>
      [
        this.escapeCSV(pair.prompt),
        this.escapeCSV(pair.chosen),
        this.escapeCSV(pair.rejected),
        pair.chosenModel ?? '',
        pair.rejectedModel ?? '',
        pair.confidence?.toString() ?? '',
      ].join(','),
    );

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Convert to Anthropic format
   */
  toAnthropicFormat(pairs: PreferencePair[]): string {
    return pairs
      .map((pair) =>
        JSON.stringify({
          prompt: `\n\nHuman: ${pair.prompt}\n\nAssistant:`,
          completion: ` ${pair.chosen}`,
        } as AnthropicFormatItem),
      )
      .join('\n');
  }

  /**
   * Convert to OpenAI format
   */
  toOpenAIFormat(pairs: PreferencePair[]): string {
    return pairs
      .map((pair) =>
        JSON.stringify({
          messages: [
            { role: 'user', content: pair.prompt },
            { role: 'assistant', content: pair.chosen },
          ],
        } as OpenAIFormatItem),
      )
      .join('\n');
  }

  /**
   * Export to HuggingFace Hub (stub)
   */
  async exportToHuggingFace(
    pairs: PreferencePair[],
    options: DatasetExportOptions,
  ): Promise<ExportResult> {
    const hfOptions = options.formatOptions as HFExportOptions | undefined;

    if (!hfOptions?.token) {
      throw new Error('HuggingFace token is required for Hub export');
    }

    // This is a placeholder - actual implementation would use @huggingface/hub
    console.warn(
      'HuggingFace Hub export not fully implemented. Saving locally instead.',
    );

    const localPath = options.path ?? `./${hfOptions.name ?? 'dataset'}.jsonl`;
    const content = this.toJSONL(pairs, { formatOptions: { format: 'dpo' } });
    await fs.writeFile(localPath, content, 'utf-8');

    return {
      format: 'huggingface',
      path: localPath,
      itemCount: pairs.length,
      warnings: ['Exported locally. Use @huggingface/hub to push to Hub.'],
    };
  }

  /**
   * Export to multiple formats
   */
  async exportMultiple(
    dataset: PreferenceDataset,
    formats: DatasetExportFormat[],
    basePath: string,
  ): Promise<Map<DatasetExportFormat, ExportResult>> {
    const results = new Map<DatasetExportFormat, ExportResult>();

    for (const format of formats) {
      const ext = this.getExtension(format);
      const path = `${basePath}.${ext}`;

      const result = await this.exportPreferences(dataset, { format, path });
      results.set(format, result);
    }

    return results;
  }

  /**
   * Get file extension for format
   */
  private getExtension(format: DatasetExportFormat): string {
    switch (format) {
      case 'jsonl':
        return 'jsonl';
      case 'json':
        return 'json';
      case 'csv':
        return 'csv';
      case 'parquet':
        return 'parquet';
      default:
        return 'jsonl';
    }
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
 * Create a dataset exporter
 */
export function createDatasetExporter(): DatasetExporter {
  return new DatasetExporter();
}
