/**
 * EvalDataset
 *
 * Evaluation dataset management.
 */

import { nanoid } from 'nanoid';
import type {
  EvalDatasetItem,
  EvalDatasetConfig,
  EvalDatasetInterface,
  HFDatasetConfig,
} from '../types/index.js';

/**
 * Evaluation dataset
 */
export class EvalDataset implements EvalDatasetInterface {
  readonly name: string;
  private items: EvalDatasetItem[];
  private metadata?: Record<string, unknown>;

  constructor(config: EvalDatasetConfig) {
    this.name = config.name ?? 'eval-dataset';
    this.items = config.items.map((item) => ({
      ...item,
      id: item.id ?? nanoid(),
    }));
    this.metadata = config.metadata;
  }

  /**
   * Get dataset size
   */
  get size(): number {
    return this.items.length;
  }

  /**
   * Get all items
   */
  getItems(): EvalDatasetItem[] {
    return [...this.items];
  }

  /**
   * Get item by ID
   */
  getItem(id: string): EvalDatasetItem | undefined {
    return this.items.find((item) => item.id === id);
  }

  /**
   * Filter items
   */
  filter(predicate: (item: EvalDatasetItem) => boolean): EvalDataset {
    return new EvalDataset({
      name: this.name,
      items: this.items.filter(predicate),
      metadata: this.metadata,
    });
  }

  /**
   * Sample random items
   */
  sample(count: number, seed?: number): EvalDataset {
    if (count >= this.items.length) {
      return new EvalDataset({
        name: this.name,
        items: [...this.items],
        metadata: this.metadata,
      });
    }

    // Simple pseudo-random sampling
    const shuffled = [...this.items];
    const rng = seed !== undefined ? this.seededRandom(seed) : Math.random;

    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return new EvalDataset({
      name: this.name,
      items: shuffled.slice(0, count),
      metadata: this.metadata,
    });
  }

  /**
   * Split dataset into train/test
   */
  split(ratio: number): [EvalDataset, EvalDataset] {
    const splitIndex = Math.floor(this.items.length * ratio);
    const shuffled = [...this.items];

    // Shuffle before split
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return [
      new EvalDataset({
        name: `${this.name}-train`,
        items: shuffled.slice(0, splitIndex),
        metadata: this.metadata,
      }),
      new EvalDataset({
        name: `${this.name}-test`,
        items: shuffled.slice(splitIndex),
        metadata: this.metadata,
      }),
    ];
  }

  /**
   * Filter by tags
   */
  filterByTags(tags: string[], mode: 'any' | 'all' = 'any'): EvalDataset {
    return this.filter((item) => {
      if (!item.tags) return false;
      if (mode === 'any') {
        return tags.some((tag) => item.tags!.includes(tag));
      }
      return tags.every((tag) => item.tags!.includes(tag));
    });
  }

  /**
   * Get unique tags
   */
  getTags(): string[] {
    const tags = new Set<string>();
    for (const item of this.items) {
      if (item.tags) {
        for (const tag of item.tags) {
          tags.add(tag);
        }
      }
    }
    return Array.from(tags);
  }

  /**
   * Add items
   */
  addItems(items: EvalDatasetItem[]): void {
    for (const item of items) {
      this.items.push({
        ...item,
        id: item.id ?? nanoid(),
      });
    }
  }

  /**
   * Remove item by ID
   */
  removeItem(id: string): boolean {
    const index = this.items.findIndex((item) => item.id === id);
    if (index >= 0) {
      this.items.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Create seeded random function
   */
  private seededRandom(seed: number): () => number {
    return () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  }

  /**
   * Export to JSON
   */
  toJSON(): string {
    return JSON.stringify(
      {
        name: this.name,
        items: this.items,
        metadata: this.metadata,
      },
      null,
      2,
    );
  }

  /**
   * Export to JSONL
   */
  toJSONL(): string {
    return this.items.map((item) => JSON.stringify(item)).join('\n');
  }

  /**
   * Create from JSON array
   */
  static fromJSON(
    data: Array<{
      input: string;
      expectedOutput?: string;
      context?: string[];
      reference?: string;
      metadata?: Record<string, unknown>;
      tags?: string[];
    }>,
    name?: string,
  ): EvalDataset {
    return new EvalDataset({
      name: name ?? 'json-dataset',
      items: data.map((item, index) => ({
        id: `item-${index}`,
        ...item,
      })),
    });
  }

  /**
   * Create from JSONL string
   */
  static fromJSONL(jsonl: string, name?: string): EvalDataset {
    const lines = jsonl
      .trim()
      .split('\n')
      .filter((line) => line.trim());
    const items = lines.map((line, index) => {
      const parsed = JSON.parse(line);
      return {
        id: parsed.id ?? `item-${index}`,
        ...parsed,
      };
    });

    return new EvalDataset({
      name: name ?? 'jsonl-dataset',
      items,
    });
  }

  /**
   * Create from HuggingFace dataset (stub - would need actual HF integration)
   */
  static fromHuggingFace(
    datasetName: string,
    config?: HFDatasetConfig,
  ): Promise<EvalDataset> {
    // This is a placeholder - actual implementation would use @huggingface/hub
    console.warn(
      'HuggingFace integration not implemented. Please install @huggingface/hub and implement the loader.',
    );

    return Promise.resolve(
      new EvalDataset({
        name: datasetName,
        items: [],
        metadata: {
          source: 'huggingface',
          datasetName,
          config,
        },
      }),
    );
  }

  /**
   * Create from CSV string
   */
  static fromCSV(
    csv: string,
    options?: {
      inputColumn?: string;
      outputColumn?: string;
      contextColumn?: string;
      delimiter?: string;
    },
  ): EvalDataset {
    const delimiter = options?.delimiter ?? ',';
    const lines = csv.trim().split('\n');

    if (lines.length < 2) {
      return new EvalDataset({ name: 'csv-dataset', items: [] });
    }

    // Parse header
    const headers = lines[0]
      .split(delimiter)
      .map((h) => h.trim().replace(/^"|"$/g, ''));
    const inputCol =
      options?.inputColumn ??
      headers.find((h) => h.toLowerCase().includes('input')) ??
      headers[0];
    const outputCol =
      options?.outputColumn ??
      headers.find(
        (h) =>
          h.toLowerCase().includes('output') ||
          h.toLowerCase().includes('expected'),
      );
    const contextCol =
      options?.contextColumn ??
      headers.find((h) => h.toLowerCase().includes('context'));

    const inputIdx = headers.indexOf(inputCol);
    const outputIdx = outputCol ? headers.indexOf(outputCol) : -1;
    const contextIdx = contextCol ? headers.indexOf(contextCol) : -1;

    // Parse rows
    const items: EvalDatasetItem[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i]
        .split(delimiter)
        .map((v) => v.trim().replace(/^"|"$/g, ''));

      if (inputIdx >= 0 && values[inputIdx]) {
        items.push({
          id: `csv-${i}`,
          input: values[inputIdx],
          expectedOutput: outputIdx >= 0 ? values[outputIdx] : undefined,
          context:
            contextIdx >= 0 && values[contextIdx]
              ? [values[contextIdx]]
              : undefined,
        });
      }
    }

    return new EvalDataset({
      name: 'csv-dataset',
      items,
    });
  }
}

/**
 * Create an evaluation dataset
 */
export function createEvalDataset(config: EvalDatasetConfig): EvalDataset {
  return new EvalDataset(config);
}
