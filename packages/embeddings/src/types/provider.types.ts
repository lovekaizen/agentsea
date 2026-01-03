/**
 * Provider Types
 *
 * Types for embedding providers.
 */

import type {
  EmbeddingVector,
  EmbeddingResult,
  BatchEmbeddingResult,
} from './embedding.types.js';

/**
 * Embedding provider type
 */
export type EmbeddingProviderType =
  | 'openai'
  | 'cohere'
  | 'voyage'
  | 'local'
  | 'huggingface'
  | 'anthropic'
  | 'google'
  | 'custom';

/**
 * Provider configuration
 */
export interface ProviderConfig {
  /** Provider type */
  type: EmbeddingProviderType;
  /** API key */
  apiKey?: string;
  /** Base URL */
  baseUrl?: string;
  /** Default model */
  model?: string;
  /** Request timeout (ms) */
  timeout?: number;
  /** Max retries */
  maxRetries?: number;
  /** Retry delay (ms) */
  retryDelay?: number;
  /** Headers */
  headers?: Record<string, string>;
  /** Provider-specific options */
  options?: Record<string, unknown>;
}

/**
 * OpenAI provider configuration
 */
export interface OpenAIProviderConfig extends ProviderConfig {
  type: 'openai';
  /** Organization ID */
  organization?: string;
  /** API version */
  apiVersion?: string;
  /** Model (e.g., 'text-embedding-3-small') */
  model?: string;
  /** Encoding format */
  encodingFormat?: 'float' | 'base64';
  /** Dimensions (for ada-002 variants) */
  dimensions?: number;
}

/**
 * Cohere provider configuration
 */
export interface CohereProviderConfig extends ProviderConfig {
  type: 'cohere';
  /** Model (e.g., 'embed-english-v3.0') */
  model?: string;
  /** Input type */
  inputType?:
    | 'search_document'
    | 'search_query'
    | 'classification'
    | 'clustering';
  /** Truncate strategy */
  truncate?: 'NONE' | 'START' | 'END';
}

/**
 * Voyage AI provider configuration
 */
export interface VoyageProviderConfig extends ProviderConfig {
  type: 'voyage';
  /** Model (e.g., 'voyage-2') */
  model?: string;
  /** Input type */
  inputType?: 'document' | 'query';
  /** Truncation */
  truncation?: boolean;
}

/**
 * Local provider configuration
 */
export interface LocalProviderConfig extends ProviderConfig {
  type: 'local';
  /** Model path or name */
  modelPath?: string;
  /** Model type */
  modelType?: 'onnx' | 'transformers' | 'sentence-transformers';
  /** Device */
  device?: 'cpu' | 'cuda' | 'mps';
  /** Batch size */
  batchSize?: number;
  /** Normalize embeddings */
  normalize?: boolean;
  /** Pooling strategy */
  pooling?: 'mean' | 'cls' | 'max';
}

/**
 * HuggingFace provider configuration
 */
export interface HuggingFaceProviderConfig extends ProviderConfig {
  type: 'huggingface';
  /** Model ID (e.g., 'sentence-transformers/all-MiniLM-L6-v2') */
  model?: string;
  /** Inference API options */
  useInferenceApi?: boolean;
  /** Wait for model */
  waitForModel?: boolean;
}

/**
 * Embedding request
 */
export interface EmbeddingRequest {
  /** Text to embed */
  text: string;
  /** Model override */
  model?: string;
  /** User identifier */
  user?: string;
  /** Additional options */
  options?: Record<string, unknown>;
}

/**
 * Batch embedding request
 */
export interface BatchEmbeddingRequest {
  /** Texts to embed */
  texts: string[];
  /** Model override */
  model?: string;
  /** User identifier */
  user?: string;
  /** Additional options */
  options?: Record<string, unknown>;
}

/**
 * Provider response
 */
export interface ProviderResponse {
  /** Embedding vectors */
  embeddings: EmbeddingVector[];
  /** Model used */
  model: string;
  /** Token usage */
  usage: TokenUsage;
  /** Provider-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Token usage
 */
export interface TokenUsage {
  /** Prompt tokens */
  promptTokens: number;
  /** Total tokens */
  totalTokens: number;
}

/**
 * Provider error
 */
export interface ProviderError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** HTTP status (if applicable) */
  status?: number;
  /** Retryable */
  retryable: boolean;
  /** Retry after (seconds) */
  retryAfter?: number;
  /** Provider-specific details */
  details?: Record<string, unknown>;
}

/**
 * Provider health status
 */
export interface ProviderHealth {
  /** Provider is healthy */
  healthy: boolean;
  /** Latency (ms) */
  latencyMs: number;
  /** Last check timestamp */
  lastCheck: number;
  /** Error (if unhealthy) */
  error?: string;
  /** Rate limit info */
  rateLimit?: RateLimitInfo;
}

/**
 * Rate limit info
 */
export interface RateLimitInfo {
  /** Requests remaining */
  remaining: number;
  /** Request limit */
  limit: number;
  /** Reset timestamp */
  reset: number;
  /** Retry after (seconds) */
  retryAfter?: number;
}

/**
 * Provider metrics
 */
export interface ProviderMetrics {
  /** Provider type */
  provider: EmbeddingProviderType;
  /** Total requests */
  totalRequests: number;
  /** Successful requests */
  successfulRequests: number;
  /** Failed requests */
  failedRequests: number;
  /** Total tokens */
  totalTokens: number;
  /** Average latency (ms) */
  avgLatencyMs: number;
  /** P50 latency (ms) */
  p50LatencyMs: number;
  /** P95 latency (ms) */
  p95LatencyMs: number;
  /** P99 latency (ms) */
  p99LatencyMs: number;
  /** Error rate */
  errorRate: number;
  /** Rate limit hits */
  rateLimitHits: number;
  /** Estimated cost (USD) */
  estimatedCostUSD: number;
}

/**
 * Model info
 */
export interface ModelInfo {
  /** Model ID */
  id: string;
  /** Model name */
  name: string;
  /** Provider */
  provider: EmbeddingProviderType;
  /** Embedding dimensions */
  dimensions: number;
  /** Max input tokens */
  maxTokens: number;
  /** Max batch size */
  maxBatchSize: number;
  /** Cost per 1K tokens (USD) */
  costPer1K?: number;
  /** Description */
  description?: string;
  /** Release date */
  releaseDate?: string;
  /** Deprecated */
  deprecated?: boolean;
  /** Recommended replacement */
  replacement?: string;
}

/**
 * Provider capabilities
 */
export interface ProviderCapabilities {
  /** Supports batch requests */
  batch: boolean;
  /** Max batch size */
  maxBatchSize: number;
  /** Supports streaming */
  streaming: boolean;
  /** Supports custom dimensions */
  customDimensions: boolean;
  /** Supports input types */
  inputTypes: string[];
  /** Available models */
  models: string[];
}

/**
 * Provider factory options
 */
export interface ProviderFactoryOptions {
  /** Default provider */
  defaultProvider?: EmbeddingProviderType;
  /** Provider configs */
  providers?: Record<EmbeddingProviderType, ProviderConfig>;
  /** Enable metrics */
  enableMetrics?: boolean;
  /** Enable health checks */
  enableHealthChecks?: boolean;
  /** Health check interval (ms) */
  healthCheckInterval?: number;
}

/**
 * Custom provider interface
 */
export interface CustomProviderConfig extends ProviderConfig {
  type: 'custom';
  /** Embed function */
  embedFn: (
    text: string,
    options?: Record<string, unknown>,
  ) => Promise<EmbeddingResult>;
  /** Batch embed function */
  batchEmbedFn?: (
    texts: string[],
    options?: Record<string, unknown>,
  ) => Promise<BatchEmbeddingResult>;
  /** Model info */
  modelInfo: ModelInfo;
}
