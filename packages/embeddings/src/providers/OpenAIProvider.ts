/**
 * OpenAI Provider
 *
 * Embedding provider for OpenAI models.
 */

import { BaseProvider } from './BaseProvider.js';
import type {
  EmbeddingModelInfo,
  OpenAIProviderConfig,
  EmbeddingOptions,
} from '../types/index.js';

/**
 * OpenAI model configurations
 */
const OPENAI_MODELS: Record<string, EmbeddingModelInfo> = {
  'text-embedding-3-small': {
    name: 'text-embedding-3-small',
    provider: 'openai',
    dimensions: 1536,
    maxTokens: 8191,
    maxBatchSize: 2048,
    costPer1K: 0.00002,
    description: 'Smaller, faster, cheaper embedding model',
  },
  'text-embedding-3-large': {
    name: 'text-embedding-3-large',
    provider: 'openai',
    dimensions: 3072,
    maxTokens: 8191,
    maxBatchSize: 2048,
    costPer1K: 0.00013,
    description: 'Larger, more powerful embedding model',
  },
  'text-embedding-ada-002': {
    name: 'text-embedding-ada-002',
    provider: 'openai',
    dimensions: 1536,
    maxTokens: 8191,
    maxBatchSize: 2048,
    costPer1K: 0.0001,
    description: 'Legacy embedding model',
  },
};

/**
 * OpenAI embedding provider
 */
export class OpenAIProvider extends BaseProvider {
  private modelInfo: EmbeddingModelInfo;
  private apiKey: string;
  private baseUrl: string;
  private organization?: string;

  constructor(config: OpenAIProviderConfig) {
    super({ ...config, type: 'openai' });

    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? 'https://api.openai.com/v1';
    this.organization = config.organization;

    const modelName = config.model ?? 'text-embedding-3-small';
    const modelConfig = OPENAI_MODELS[modelName];

    if (!modelConfig) {
      // Custom model
      this.modelInfo = {
        name: modelName,
        provider: 'openai',
        dimensions: config.dimensions ?? 1536,
        maxTokens: 8191,
        maxBatchSize: 2048,
        costPer1K: 0.0001,
      };
    } else {
      this.modelInfo = {
        ...modelConfig,
        // Allow dimension override for text-embedding-3 models
        dimensions: config.dimensions ?? modelConfig.dimensions,
      };
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

    if (this.organization) {
      headers['OpenAI-Organization'] = this.organization;
    }

    const body: Record<string, unknown> = {
      model: options?.model ?? this.modelInfo.name,
      input: texts,
    };

    // Add dimensions for text-embedding-3 models
    if (this.modelInfo.name.startsWith('text-embedding-3')) {
      const config = this.config as OpenAIProviderConfig;
      if (config.dimensions) {
        body.dimensions = config.dimensions;
      }
    }

    // Add encoding format
    const config = this.config as OpenAIProviderConfig;
    if (config.encodingFormat) {
      body.encoding_format = config.encodingFormat;
    }

    // Add user identifier
    if (options?.user) {
      body.user = options.user;
    }

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
        .catch(() => ({ error: { message: response.statusText } }))) as {
        error?: { message?: string };
      };
      const errorMessage = error.error?.message ?? response.statusText;

      // Track rate limits
      if (response.status === 429) {
        this.metrics.rateLimitHits++;
      }

      throw new Error(`OpenAI API error: ${errorMessage} (${response.status})`);
    }

    const data = (await response.json()) as {
      data: Array<{ index: number; embedding: number[] }>;
      usage?: { total_tokens: number };
    };

    // Sort embeddings by index to maintain order
    const embeddings = data.data.sort((a, b) => a.index - b.index);

    const vectors = embeddings.map((e) => e.embedding);
    const tokenCount = data.usage?.total_tokens ?? 0;

    // Update cost estimate
    this.metrics.estimatedCostUSD +=
      (tokenCount / 1000) * (this.modelInfo.costPer1K ?? 0);

    return { vectors, tokenCount };
  }

  /**
   * Count tokens using tiktoken approximation
   */
  override countTokens(text: string): number {
    // Approximation based on OpenAI's cl100k_base tokenizer
    // For accurate counting, use tiktoken library
    const words = text.split(/\s+/);
    let tokens = 0;

    for (const word of words) {
      // Average ~1.3 tokens per word for English
      tokens += Math.ceil(word.length / 4) + 1;
    }

    return Math.max(1, tokens);
  }
}

/**
 * Create an OpenAI provider
 */
export function createOpenAIProvider(
  config: OpenAIProviderConfig,
): OpenAIProvider {
  return new OpenAIProvider(config);
}
