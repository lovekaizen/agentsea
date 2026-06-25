/**
 * Local Provider
 *
 * Embedding provider for local/custom models via a user-supplied embedding
 * function (`embedFn`).
 *
 * NOTE: Loading ONNX models directly from `modelPath` is on the roadmap but not
 * implemented yet. For now, load your model however you like and pass an
 * `embedFn` that returns the vectors.
 */

import { BaseProvider } from './BaseProvider.js';
import type {
  EmbeddingModelInfo,
  LocalProviderConfig,
  EmbeddingOptions,
} from '../types/index.js';
import { EmbeddingModel } from '../core/EmbeddingModel.js';

/**
 * Custom embedding function type
 */
export type LocalEmbeddingFn = (
  texts: string[],
  options?: Record<string, unknown>,
) => Promise<number[][]>;

/**
 * Local embedding provider configuration
 */
export interface LocalProviderOptions extends LocalProviderConfig {
  /** Custom embedding function */
  embedFn?: LocalEmbeddingFn;
  /** Model dimensions */
  dimensions: number;
  /** Model name */
  name?: string;
  /** Max tokens */
  maxTokens?: number;
  /** Max batch size */
  maxBatchSize?: number;
}

/**
 * Local embedding provider
 */
export class LocalProvider extends BaseProvider {
  private modelInfo: EmbeddingModelInfo;
  private embedFn: LocalEmbeddingFn | null = null;
  private normalize: boolean;
  private batchSize: number;

  constructor(config: LocalProviderOptions) {
    super({ ...config, type: 'local' });

    if (!config.embedFn) {
      if (config.modelPath) {
        // modelPath implies ONNX loading, which isn't implemented yet. Fail
        // here rather than constructing a provider that throws at embed time.
        throw new Error(
          'Loading local models from `modelPath` (ONNX) is not implemented ' +
            'yet. Provide an `embedFn` that returns embeddings instead.',
        );
      }
      throw new Error('`embedFn` is required for the local provider');
    }

    this.embedFn = config.embedFn ?? null;
    this.normalize = config.normalize ?? true;
    this.batchSize = config.batchSize ?? 32;

    this.modelInfo = {
      name: config.name ?? config.modelPath ?? 'local-model',
      provider: 'local',
      dimensions: config.dimensions,
      maxTokens: config.maxTokens ?? 512,
      maxBatchSize: config.maxBatchSize ?? 32,
      costPer1K: 0, // Local models have no API cost
      description: 'Local embedding model',
    };
  }

  get info(): EmbeddingModelInfo {
    return this.modelInfo;
  }

  protected async doEmbed(
    texts: string[],
    options?: EmbeddingOptions,
  ): Promise<{ vectors: number[][]; tokenCount: number }> {
    if (!this.embedFn) {
      throw new Error('No embedding function configured');
    }

    let vectors = await this.embedFn(texts, options as Record<string, unknown>);

    // Normalize if configured
    if (this.normalize) {
      vectors = vectors.map((v) => EmbeddingModel.normalize(v));
    }

    // Estimate token count
    const tokenCount = texts.reduce(
      (sum, text) => sum + this.countTokens(text),
      0,
    );

    return { vectors, tokenCount };
  }

  /**
   * Set the embedding function
   */
  setEmbedFunction(fn: LocalEmbeddingFn): this {
    this.embedFn = fn;
    return this;
  }

  /**
   * Count tokens (simple approximation for local models)
   */
  override countTokens(text: string): number {
    // Simple word-based approximation
    return text.split(/\s+/).length;
  }
}

/**
 * Create a local provider with a custom embedding function
 */
export function createLocalProvider(
  config: LocalProviderOptions,
): LocalProvider {
  return new LocalProvider(config);
}

/**
 * Create a mock provider for testing
 */
export function createMockProvider(config: {
  dimensions: number;
  name?: string;
  delay?: number;
}): LocalProvider {
  const delay = config.delay ?? 10;

  return new LocalProvider({
    type: 'local',
    dimensions: config.dimensions,
    name: config.name ?? 'mock-model',
    embedFn: (texts: string[]) => {
      // Simulate API delay
      return new Promise((resolve) => setTimeout(resolve, delay)).then(() => {
        // Generate deterministic mock embeddings based on text content
        return texts.map((text) => {
          const hash = text.split('').reduce((acc, char) => {
            return (acc << 5) - acc + char.charCodeAt(0);
          }, 0);

          // Generate a deterministic vector based on the hash
          const vector: number[] = [];
          let seed = Math.abs(hash);
          for (let i = 0; i < config.dimensions; i++) {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            vector.push((seed / 0x7fffffff) * 2 - 1);
          }

          // Normalize
          const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
          return vector.map((v) => v / norm);
        });
      });
    },
  });
}

/**
 * Create a random embedding provider for testing
 */
export function createRandomProvider(config: {
  dimensions: number;
  name?: string;
}): LocalProvider {
  return new LocalProvider({
    type: 'local',
    dimensions: config.dimensions,
    name: config.name ?? 'random-model',
    embedFn: (texts: string[]) => {
      return Promise.resolve(
        texts.map(() => {
          const vector: number[] = [];
          for (let i = 0; i < config.dimensions; i++) {
            vector.push(Math.random() * 2 - 1);
          }
          // Normalize
          const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
          return vector.map((v) => v / norm);
        }),
      );
    },
  });
}
