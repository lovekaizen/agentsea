/**
 * Cohere Provider
 *
 * Embedding provider for Cohere models.
 */

import { BaseProvider } from './BaseProvider.js';
import type {
  EmbeddingModelInfo,
  CohereProviderConfig,
  EmbeddingOptions,
} from '../types/index.js';

/**
 * Cohere model configurations
 */
const COHERE_MODELS: Record<string, EmbeddingModelInfo> = {
  'embed-english-v3.0': {
    name: 'embed-english-v3.0',
    provider: 'cohere',
    dimensions: 1024,
    maxTokens: 512,
    maxBatchSize: 96,
    costPer1K: 0.0001,
    description: 'English embedding model v3',
  },
  'embed-multilingual-v3.0': {
    name: 'embed-multilingual-v3.0',
    provider: 'cohere',
    dimensions: 1024,
    maxTokens: 512,
    maxBatchSize: 96,
    costPer1K: 0.0001,
    description: 'Multilingual embedding model v3',
  },
  'embed-english-light-v3.0': {
    name: 'embed-english-light-v3.0',
    provider: 'cohere',
    dimensions: 384,
    maxTokens: 512,
    maxBatchSize: 96,
    costPer1K: 0.0001,
    description: 'Lightweight English embedding model v3',
  },
  'embed-multilingual-light-v3.0': {
    name: 'embed-multilingual-light-v3.0',
    provider: 'cohere',
    dimensions: 384,
    maxTokens: 512,
    maxBatchSize: 96,
    costPer1K: 0.0001,
    description: 'Lightweight multilingual embedding model v3',
  },
  'embed-english-v2.0': {
    name: 'embed-english-v2.0',
    provider: 'cohere',
    dimensions: 4096,
    maxTokens: 512,
    maxBatchSize: 96,
    costPer1K: 0.0001,
    description: 'Legacy English embedding model v2',
  },
};

/**
 * Cohere embedding provider
 */
export class CohereProvider extends BaseProvider {
  private modelInfo: EmbeddingModelInfo;
  private apiKey: string;
  private baseUrl: string;
  private inputType: CohereProviderConfig['inputType'];
  private truncate: CohereProviderConfig['truncate'];

  constructor(config: CohereProviderConfig) {
    super({ ...config, type: 'cohere' });

    if (!config.apiKey) {
      throw new Error('Cohere API key is required');
    }

    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? 'https://api.cohere.ai/v1';
    this.inputType = config.inputType ?? 'search_document';
    this.truncate = config.truncate ?? 'END';

    const modelName = config.model ?? 'embed-english-v3.0';
    const modelConfig = COHERE_MODELS[modelName];

    if (!modelConfig) {
      this.modelInfo = {
        name: modelName,
        provider: 'cohere',
        dimensions: 1024,
        maxTokens: 512,
        maxBatchSize: 96,
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
      'Request-Source': 'agentsea-embeddings',
    };

    const body: Record<string, unknown> = {
      model: options?.model ?? this.modelInfo.name,
      texts,
      input_type: this.inputType,
      truncate: this.truncate,
    };

    const response = await fetch(`${this.baseUrl}/embed`, {
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
        .catch(() => ({ message: response.statusText }))) as {
        message?: string;
      };
      const errorMessage = error.message ?? response.statusText;

      if (response.status === 429) {
        this.metrics.rateLimitHits++;
      }

      throw new Error(`Cohere API error: ${errorMessage} (${response.status})`);
    }

    const data = (await response.json()) as { embeddings: number[][] };

    const vectors = data.embeddings;
    // Cohere doesn't return token count directly, estimate it
    const tokenCount = texts.reduce(
      (sum, text) => sum + this.countTokens(text),
      0,
    );

    // Update cost estimate
    this.metrics.estimatedCostUSD +=
      (tokenCount / 1000) * (this.modelInfo.costPer1K ?? 0);

    return { vectors, tokenCount };
  }

  /**
   * Set input type for embeddings
   */
  setInputType(inputType: CohereProviderConfig['inputType']): this {
    this.inputType = inputType;
    return this;
  }

  /**
   * Count tokens (approximation)
   */
  override countTokens(text: string): number {
    // Cohere uses BPE tokenization, rough estimate
    return Math.ceil(text.length / 4);
  }
}

/**
 * Create a Cohere provider
 */
export function createCohereProvider(
  config: CohereProviderConfig,
): CohereProvider {
  return new CohereProvider(config);
}
