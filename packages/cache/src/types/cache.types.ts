/**
 * Cache Types
 *
 * Core type definitions for the semantic cache.
 */

/**
 * Cache backend type
 */
export type CacheBackendType =
  | 'memory'
  | 'redis'
  | 'sqlite'
  | 'pinecone'
  | 'tiered';

/**
 * LLM Message for cache key generation
 */
export interface CacheMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
}

/**
 * Cache entry representing a cached LLM response
 */
export interface CacheEntry {
  /** Unique entry ID */
  id: string;
  /** Cache key (hash) */
  key: string;
  /** Embedding vector for semantic search */
  embedding?: number[];
  /** Original request */
  request: CacheRequest;
  /** Cached response */
  response: CacheResponse;
  /** Entry metadata */
  metadata: CacheEntryMetadata;
}

/**
 * Cached request data
 */
export interface CacheRequest {
  model: string;
  messages: CacheMessage[];
  temperature?: number;
  maxTokens?: number;
  tools?: unknown[];
  systemPrompt?: string;
}

/**
 * Cached response data
 */
export interface CacheResponse {
  content: string;
  model: string;
  usage: TokenUsage;
  finishReason: string;
  toolCalls?: unknown[];
  /** Stream chunks for streaming cache */
  streamChunks?: unknown[];
}

/**
 * Token usage information
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Cache entry metadata
 */
export interface CacheEntryMetadata {
  createdAt: number;
  accessedAt: number;
  accessCount: number;
  ttl: number;
  hitCount: number;
  tier?: string;
  similarity?: number;
  tags?: string[];
  namespace?: string;
  userId?: string;
  agentId?: string;
}

/**
 * Semantic cache configuration
 */
export interface SemanticCacheConfig {
  /** Default TTL in seconds (0 = no expiry) */
  defaultTTL?: number;
  /** Similarity threshold for semantic matching (0-1, default 0.92) */
  similarityThreshold?: number;
  /** Maximum entries (for memory store) */
  maxEntries?: number;
  /** Maximum size in bytes */
  maxSizeBytes?: number;
  /** Key prefix for namespacing */
  keyPrefix?: string;
  /** Match strategy */
  matchStrategy?: 'exact' | 'semantic' | 'hybrid' | 'fuzzy';
  /** Enable analytics */
  analyticsEnabled?: boolean;
  /** Namespace for multi-tenant isolation */
  namespace?: string;
  /** Fields to include in cache key */
  cacheKeyFields?: Array<'model' | 'messages' | 'temperature' | 'systemPrompt'>;
  /** Normalize whitespace in messages */
  normalizeWhitespace?: boolean;
}

/**
 * Cache lookup result
 */
export interface CacheLookupResult {
  /** Whether a cache hit occurred */
  hit: boolean;
  /** The cached entry (if hit) */
  entry?: CacheEntry;
  /** Similarity score (for semantic matches) */
  similarity?: number;
  /** Which tier the entry was found in */
  tier?: string;
  /** Lookup latency in milliseconds */
  latencyMs: number;
  /** Source of the result */
  source: 'exact' | 'semantic' | 'miss';
}

/**
 * Cache statistics
 */
export interface CacheStats {
  /** Total number of entries */
  entries: number;
  /** Estimated size in bytes */
  sizeBytes: number;
  /** Total cache hits */
  hits: number;
  /** Total cache misses */
  misses: number;
  /** Hit rate (0-1) */
  hitRate: number;
  /** Exact match hits */
  exactHits: number;
  /** Semantic match hits */
  semanticHits: number;
  /** Average similarity score for semantic hits */
  avgSimilarity: number;
  /** Average lookup latency */
  avgLatencyMs: number;
  /** Estimated cost savings in USD */
  costSavingsUSD: number;
  /** Total tokens saved */
  tokensSaved: number;
}

/**
 * Options for cache.wrap()
 */
export interface WrapOptions {
  /** Custom TTL for this entry */
  ttl?: number;
  /** Tags for grouping/filtering */
  tags?: string[];
  /** Namespace override */
  namespace?: string;
  /** Skip cache (always call function) */
  skipCache?: boolean;
  /** Force refresh (call function and update cache) */
  forceRefresh?: boolean;
  /** User ID for attribution */
  userId?: string;
  /** Agent ID for attribution */
  agentId?: string;
}

/**
 * Cache key generation options
 */
export interface CacheKeyOptions {
  /** Include temperature in key */
  includeTemperature?: boolean;
  /** Include tools in key */
  includeTools?: boolean;
  /** Normalize whitespace */
  normalizeWhitespace?: boolean;
  /** Extract only user message for semantic matching */
  extractUserMessage?: boolean;
}
