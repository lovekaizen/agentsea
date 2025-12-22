/**
 * HuggingFace Provider
 *
 * Embedding provider for HuggingFace Inference API models.
 */

import { BaseProvider } from './BaseProvider.js';
import type {
  EmbeddingModelInfo,
  HuggingFaceProviderConfig,
  EmbeddingOptions,
} from '../types/index.js';

/**
 * Common HuggingFace model configurations
 */
const HUGGINGFACE_MODELS: Record<string, Partial<EmbeddingModelInfo>> = {
  'sentence-transformers/all-MiniLM-L6-v2': {
    dimensions: 384,
    maxTokens: 256,
    description: 'Lightweight sentence transformer',
  },
  'sentence-transformers/all-mpnet-base-v2': {
    dimensions: 768,
    maxTokens: 384,
    description: 'High quality sentence transformer',
  },
  'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2': {
    dimensions: 384,
    maxTokens: 128,
    description: 'Multilingual sentence transformer',
  },
  'BAAI/bge-small-en-v1.5': {
    dimensions: 384,
    maxTokens: 512,
    description: 'BGE small English model',
  },
  'BAAI/bge-base-en-v1.5': {
    dimensions: 768,
    maxTokens: 512,
    description: 'BGE base English model',
  },
  'BAAI/bge-large-en-v1.5': {
    dimensions: 1024,
    maxTokens: 512,
    description: 'BGE large English model',
  },
  'thenlper/gte-small': {
    dimensions: 384,
    maxTokens: 512,
    description: 'GTE small model',
  },
  'thenlper/gte-base': {
    dimensions: 768,
    maxTokens: 512,
    description: 'GTE base model',
  },
  'thenlper/gte-large': {
    dimensions: 1024,
    maxTokens: 512,
    description: 'GTE large model',
  },
  'intfloat/e5-small-v2': {
    dimensions: 384,
    maxTokens: 512,
    description: 'E5 small v2 model',
  },
  'intfloat/e5-base-v2': {
    dimensions: 768,
    maxTokens: 512,
    description: 'E5 base v2 model',
  },
  'intfloat/e5-large-v2': {
    dimensions: 1024,
    maxTokens: 512,
    description: 'E5 large v2 model',
  },
};

/**
 * HuggingFace embedding provider
 */
export class HuggingFaceProvider extends BaseProvider {
  private modelInfo: EmbeddingModelInfo;
  private apiKey: string;
  private baseUrl: string;
  private waitForModel: boolean;

  constructor(config: HuggingFaceProviderConfig) {
    super({ ...config, type: 'huggingface' });

    if (!config.apiKey) {
      throw new Error('HuggingFace API key is required');
    }

    this.apiKey = config.apiKey;
    this.waitForModel = config.waitForModel ?? true;

    const modelName = config.model ?? 'sentence-transformers/all-MiniLM-L6-v2';
    const knownConfig = HUGGINGFACE_MODELS[modelName];

    this.baseUrl =
      config.baseUrl ??
      `https://api-inference.huggingface.co/pipeline/feature-extraction/${modelName}`;

    this.modelInfo = {
      name: modelName,
      provider: 'huggingface',
      dimensions: knownConfig?.dimensions ?? 768,
      maxTokens: knownConfig?.maxTokens ?? 512,
      maxBatchSize: 32, // HF inference API handles batching
      costPer1K: 0, // Free tier available
      description: knownConfig?.description ?? 'HuggingFace model',
    };
  }

  get info(): EmbeddingModelInfo {
    return this.modelInfo;
  }

  protected async doEmbed(
    texts: string[],
    _options?: EmbeddingOptions,
  ): Promise<{ vectors: number[][]; tokenCount: number }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };

    const body: Record<string, unknown> = {
      inputs: texts,
      options: {
        wait_for_model: this.waitForModel,
      },
    };

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: this.config.timeout
        ? AbortSignal.timeout(this.config.timeout)
        : undefined,
    });

    if (!response.ok) {
      const error = (await response
        .json()
        .catch(() => ({ error: response.statusText }))) as { error?: string };
      const errorMessage = error.error ?? response.statusText;

      if (response.status === 429) {
        this.metrics.rateLimitHits++;
      }

      throw new Error(
        `HuggingFace API error: ${errorMessage} (${response.status})`,
      );
    }

    const data = (await response.json()) as
      | number[][]
      | number[][][]
      | number[];

    // HuggingFace returns embeddings directly as arrays
    // For sentence-transformers, it's typically the mean pooled output
    let vectors: number[][];

    if (Array.isArray(data) && Array.isArray(data[0])) {
      // Check if it's a 2D array (batch of embeddings)
      if (typeof (data as number[][])[0][0] === 'number') {
        vectors = data as number[][];
      } else {
        // It might be token embeddings, need to mean pool
        vectors = (data as number[][][]).map((tokenEmbeddings) => {
          const dims = tokenEmbeddings[0]?.length ?? this.modelInfo.dimensions;
          const mean = new Array(dims).fill(0) as number[];
          for (const embedding of tokenEmbeddings) {
            for (let i = 0; i < dims; i++) {
              mean[i] += embedding[i];
            }
          }
          return mean.map((v) => v / tokenEmbeddings.length);
        });
      }
    } else {
      // Single embedding
      vectors = [data as number[]];
    }

    // Estimate token count
    const tokenCount = texts.reduce(
      (sum, text) => sum + this.countTokens(text),
      0,
    );

    return { vectors, tokenCount };
  }

  /**
   * Count tokens (approximation based on wordpiece)
   */
  override countTokens(text: string): number {
    // WordPiece tokenization approximation
    const words = text.split(/\s+/);
    let tokens = 0;
    for (const word of words) {
      // Subword tokens roughly 1.3-1.5 per word
      tokens += Math.ceil(word.length / 5) + 1;
    }
    return Math.max(1, tokens);
  }
}

/**
 * Create a HuggingFace provider
 */
export function createHuggingFaceProvider(
  config: HuggingFaceProviderConfig,
): HuggingFaceProvider {
  return new HuggingFaceProvider(config);
}
