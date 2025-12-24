/**
 * Voyage AI Provider
 *
 * Embedding provider for Voyage AI models.
 */

import { BaseProvider } from './BaseProvider.js';
import type {
  EmbeddingModelInfo,
  VoyageProviderConfig,
  EmbeddingOptions,
} from '../types/index.js';

/**
 * Voyage AI model configurations
 */
const VOYAGE_MODELS: Record<string, EmbeddingModelInfo> = {
  'voyage-3': {
    name: 'voyage-3',
    provider: 'voyage',
    dimensions: 1024,
    maxTokens: 32000,
    maxBatchSize: 128,
    costPer1K: 0.00006,
    description: 'Latest general-purpose embedding model',
  },
  'voyage-3-lite': {
    name: 'voyage-3-lite',
    provider: 'voyage',
    dimensions: 512,
    maxTokens: 32000,
    maxBatchSize: 128,
    costPer1K: 0.00002,
    description: 'Lightweight general-purpose model',
  },
  'voyage-code-3': {
    name: 'voyage-code-3',
    provider: 'voyage',
    dimensions: 1024,
    maxTokens: 32000,
    maxBatchSize: 128,
    costPer1K: 0.00006,
    description: 'Optimized for code retrieval',
  },
  'voyage-finance-2': {
    name: 'voyage-finance-2',
    provider: 'voyage',
    dimensions: 1024,
    maxTokens: 32000,
    maxBatchSize: 128,
    costPer1K: 0.00012,
    description: 'Optimized for finance domain',
  },
  'voyage-law-2': {
    name: 'voyage-law-2',
    provider: 'voyage',
    dimensions: 1024,
    maxTokens: 32000,
    maxBatchSize: 128,
    costPer1K: 0.00012,
    description: 'Optimized for legal domain',
  },
  'voyage-multilingual-2': {
    name: 'voyage-multilingual-2',
    provider: 'voyage',
    dimensions: 1024,
    maxTokens: 32000,
    maxBatchSize: 128,
    costPer1K: 0.00012,
    description: 'Multilingual embedding model',
  },
  'voyage-2': {
    name: 'voyage-2',
    provider: 'voyage',
    dimensions: 1024,
    maxTokens: 4000,
    maxBatchSize: 128,
    costPer1K: 0.0001,
    description: 'Previous generation model',
  },
};

/**
 * Voyage AI embedding provider
 */
export class VoyageProvider extends BaseProvider {
  private modelInfo: EmbeddingModelInfo;
  private apiKey: string;
  private baseUrl: string;
  private inputType: VoyageProviderConfig['inputType'];
  private truncation: boolean;

  constructor(config: VoyageProviderConfig) {
    super({ ...config, type: 'voyage' });

    if (!config.apiKey) {
      throw new Error('Voyage AI API key is required');
    }

    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? 'https://api.voyageai.com/v1';
    this.inputType = config.inputType ?? 'document';
    this.truncation = config.truncation ?? true;

    const modelName = config.model ?? 'voyage-3';
    const modelConfig = VOYAGE_MODELS[modelName];

    if (!modelConfig) {
      this.modelInfo = {
        name: modelName,
        provider: 'voyage',
        dimensions: 1024,
        maxTokens: 32000,
        maxBatchSize: 128,
        costPer1K: 0.0001,
      };
    } else {
      this.modelInfo = { ...modelConfig };
    }
  }

  get info(): EmbeddingModelInfo {
    return this.modelInfo;
  }

  protected async doEmbed(
    texts: string[],
    options?: EmbeddingOptions,
  ): Promise<{ vectors: number[][]; tokenCount: number }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };

    const body: Record<string, unknown> = {
      model: options?.model ?? this.modelInfo.name,
      input: texts,
      input_type: this.inputType,
      truncation: this.truncation,
    };

    const response = await fetch(`${this.baseUrl}/embeddings`, {
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
        .catch(() => ({ detail: response.statusText }))) as { detail?: string };
      const errorMessage = error.detail ?? response.statusText;

      if (response.status === 429) {
        this.metrics.rateLimitHits++;
      }

      throw new Error(
        `Voyage AI API error: ${errorMessage} (${response.status})`,
      );
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[] }>;
      usage?: { total_tokens: number };
    };

    const vectors = data.data.map((d) => d.embedding);
    const tokenCount =
      data.usage?.total_tokens ??
      texts.reduce((sum, text) => sum + this.countTokens(text), 0);

    // Update cost estimate
    this.metrics.estimatedCostUSD +=
      (tokenCount / 1000) * (this.modelInfo.costPer1K ?? 0);

    return { vectors, tokenCount };
  }

  /**
   * Set input type for embeddings
   */
  setInputType(inputType: VoyageProviderConfig['inputType']): this {
    this.inputType = inputType;
    return this;
  }

  /**
   * Count tokens (approximation)
   */
  override countTokens(text: string): number {
    // Voyage uses its own tokenizer, rough estimate
    return Math.ceil(text.length / 4);
  }
}

/**
 * Create a Voyage AI provider
 */
export function createVoyageProvider(
  config: VoyageProviderConfig,
): VoyageProvider {
  return new VoyageProvider(config);
}
