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
import { importOptional } from '../utils/optional-import.js';

/**
 * Minimal structural contract for the subset of `@huggingface/hub` used here,
 * so the package type-checks without taking a hard dependency on the optional
 * SDK.
 */
interface HuggingFaceHubLike {
  createRepo(params: {
    repo: { type: 'dataset'; name: string };
    accessToken: string;
    private?: boolean;
  }): Promise<unknown>;
  uploadFiles(params: {
    repo: { type: 'dataset'; name: string };
    accessToken: string;
    files: Array<{ path: string; content: Blob }>;
  }): Promise<unknown>;
}

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
   * Export a preference dataset to the HuggingFace Hub.
   *
   * The dataset is serialized to DPO-format JSONL and uploaded with
   * `@huggingface/hub` (an optional dependency, imported lazily). A README
   * dataset card is generated and uploaded alongside the data. Requires a
   * write-scoped HF token (`formatOptions.token` or `options.token`).
   */
  async exportToHuggingFace(
    pairs: PreferencePair[],
    options: DatasetExportOptions,
  ): Promise<ExportResult> {
    const hfOptions = options.formatOptions as HFExportOptions | undefined;
    const token = hfOptions?.token ?? options.token;
    const name = hfOptions?.name ?? options.repoName;

    if (!token) {
      throw new Error('HuggingFace token is required for Hub export');
    }
    if (!name) {
      throw new Error(
        'A dataset name (`formatOptions.name` or `repoName`) is required for Hub export',
      );
    }

    // Lazily import the optional Hub SDK, typed against a minimal local contract
    // so the package type-checks without @huggingface/hub installed.
    let hub: HuggingFaceHubLike;
    try {
      hub = (await importOptional('@huggingface/hub')) as HuggingFaceHubLike;
    } catch {
      throw new Error(
        'HuggingFace Hub export requires the "@huggingface/hub" package. ' +
          'Install it to push datasets to the Hub.',
      );
    }

    const repo = { type: 'dataset' as const, name };
    const isPrivate = hfOptions?.private ?? options.private ?? false;

    // Create the repo if it does not already exist (idempotent).
    try {
      await hub.createRepo({ repo, accessToken: token, private: isPrivate });
    } catch (err) {
      // A 409 (already exists) is fine; rethrow anything else.
      if (!/already (created|exists)/i.test((err as Error).message)) {
        throw err;
      }
    }

    const jsonl = this.toJSONL(pairs, { formatOptions: { format: 'dpo' } });
    const card = this.buildDatasetCard(name, pairs.length, hfOptions);

    await hub.uploadFiles({
      repo,
      accessToken: token,
      files: [
        { path: 'data/train.jsonl', content: new Blob([jsonl]) },
        { path: 'README.md', content: new Blob([card]) },
      ],
    });

    const url = `https://huggingface.co/datasets/${name}`;
    return {
      format: 'huggingface',
      url,
      itemCount: pairs.length,
      bytesWritten: Buffer.byteLength(jsonl, 'utf-8'),
    };
  }

  /**
   * Build a minimal HuggingFace dataset card (README.md front matter + body).
   */
  private buildDatasetCard(
    name: string,
    count: number,
    hfOptions?: HFExportOptions,
  ): string {
    const tags = hfOptions?.tags ?? ['preference', 'dpo', 'rlhf'];
    const frontMatter = [
      '---',
      `license: ${hfOptions?.license ?? 'mit'}`,
      'tags:',
      ...tags.map((t) => `  - ${t}`),
      '---',
    ].join('\n');

    const body =
      hfOptions?.readme ??
      `# ${name}\n\nPreference dataset (${count} pairs) exported by ` +
        '`@lov3kaizen/agentsea-evaluate`. Each line is a DPO record with ' +
        '`prompt`, `chosen`, and `rejected` fields.';

    return `${frontMatter}\n\n${body}\n`;
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
