/**
 * Local Provider
 *
 * Embedding provider for local/custom models. Either supply a custom embedding
 * function (`embedFn`), or point `modelPath` at an ONNX feature-extraction model
 * (local directory or a HuggingFace repo id) and the provider will load it via
 * Transformers.js (`@xenova/transformers`, an optional dependency) — handling
 * tokenization, the ONNX runtime, and mean-pooling for you.
 */

import { BaseProvider } from './BaseProvider.js';
import type {
  EmbeddingModelInfo,
  LocalProviderConfig,
  EmbeddingOptions,
} from '../types/index.js';
import { EmbeddingModel } from '../core/EmbeddingModel.js';
import { importOptional } from '../core/optional-import.js';

/** Minimal shape of the Transformers.js feature-extraction pipeline output. */
interface TransformersTensor {
  tolist(): number[][] | number[];
}
type FeatureExtractor = (
  texts: string[],
  options?: { pooling?: string; normalize?: boolean },
) => Promise<TransformersTensor>;
interface TransformersModule {
  pipeline: (task: string, model: string) => Promise<FeatureExtractor>;
}

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
  private readonly modelPath?: string;
  /** Lazily-built ONNX extractor (only when loading from `modelPath`). */
  private extractorPromise?: Promise<FeatureExtractor>;

  constructor(config: LocalProviderOptions) {
    super({ ...config, type: 'local' });

    if (!config.embedFn && !config.modelPath) {
      throw new Error(
        '`embedFn` or `modelPath` (ONNX) is required for the local provider',
      );
    }

    this.embedFn = config.embedFn ?? null;
    this.modelPath = config.modelPath;
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

  /**
   * Lazily load the ONNX feature-extraction pipeline from `modelPath` via
   * Transformers.js and adapt it into a {@link LocalEmbeddingFn}.
   */
  private getOnnxEmbedFn(): Promise<FeatureExtractor> {
    if (!this.extractorPromise) {
      this.extractorPromise = (async () => {
        let mod: unknown;
        try {
          mod = await importOptional('@xenova/transformers');
        } catch {
          throw new Error(
            'Loading local ONNX models from `modelPath` requires the ' +
              '"@xenova/transformers" package. Install it, or pass an `embedFn`.',
          );
        }
        const transformers = mod as TransformersModule;
        return transformers.pipeline('feature-extraction', this.modelPath!);
      })();
    }
    return this.extractorPromise;
  }

  get info(): EmbeddingModelInfo {
    return this.modelInfo;
  }

  protected async doEmbed(
    texts: string[],
    options?: EmbeddingOptions,
  ): Promise<{ vectors: number[][]; tokenCount: number }> {
    // Fall back to the ONNX pipeline when no custom embedFn was supplied.
    if (!this.embedFn && this.modelPath) {
      const extractor = await this.getOnnxEmbedFn();
      this.embedFn = async (input: string[]) => {
        const output = await extractor(input, {
          pooling: 'mean',
          normalize: false, // we normalize below if configured
        });
        const list = output.tolist();
        // A single input yields a 1-D tensor; wrap it to a 2-D shape.
        return (Array.isArray(list[0]) ? list : [list]) as number[][];
      };
    }

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
