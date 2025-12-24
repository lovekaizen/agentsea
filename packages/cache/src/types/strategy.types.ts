/**
 * Strategy Types
 *
 * Type definitions for cache matching strategies.
 */

import type {
  CacheEntry,
  CacheLookupResult,
  CacheMessage,
} from './cache.types.js';

/**
 * Match strategy type
 */
export type MatchStrategyType = 'exact' | 'semantic' | 'hybrid' | 'fuzzy';

/**
 * Match options
 */
export interface MatchOptions {
  /** Similarity threshold (0-1) */
  threshold?: number;
  /** Namespace filter */
  namespace?: string;
  /** Number of top candidates to consider */
  topK?: number;
  /** Include model in matching */
  matchModel?: boolean;
}

/**
 * Match request
 */
export interface MatchRequest {
  model: string;
  messages: CacheMessage[];
  temperature?: number;
  systemPrompt?: string;
}

/**
 * Match result with additional metadata
 */
export interface MatchResult extends CacheLookupResult {
  /** Strategy that produced the match */
  strategy: MatchStrategyType;
  /** All candidates considered */
  candidates?: Array<{
    entry: CacheEntry;
    score: number;
    reason: string;
  }>;
}

/**
 * Exact match configuration
 */
export interface ExactMatchConfig {
  /** Normalize whitespace before hashing */
  normalizeWhitespace?: boolean;
  /** Fields to include in hash */
  hashFields?: Array<'model' | 'messages' | 'temperature' | 'systemPrompt'>;
}

/**
 * Semantic match configuration
 */
export interface SemanticMatchConfig {
  /** Similarity threshold (default 0.92) */
  threshold?: number;
  /** Only match same model */
  matchModel?: boolean;
  /** Number of candidates to retrieve */
  topK?: number;
}

/**
 * Hybrid match configuration
 */
export interface HybridMatchConfig {
  /** Exact match config */
  exact?: ExactMatchConfig;
  /** Semantic match config */
  semantic?: SemanticMatchConfig;
  /** Patterns that should use semantic matching */
  semanticPatterns?: RegExp[];
  /** Patterns that should only use exact matching */
  exactOnlyPatterns?: RegExp[];
}

/**
 * Fuzzy match configuration
 */
export interface FuzzyMatchConfig {
  /** Minimum similarity for fuzzy match (0-1) */
  minSimilarity?: number;
  /** Maximum edit distance */
  maxDistance?: number;
}

/**
 * Threshold configuration for dynamic thresholds
 */
export interface ThresholdConfig {
  /** Base threshold */
  base: number;
  /** Context-specific thresholds */
  contextThresholds?: Record<string, number>;
  /** Auto-adjust based on hit rate */
  autoAdjust?: boolean;
  /** Minimum allowed threshold */
  min?: number;
  /** Maximum allowed threshold */
  max?: number;
}

/**
 * Context type for threshold selection
 */
export type ContextType = 'code' | 'chat' | 'analysis' | 'creative' | 'default';

/**
 * Context detector function type
 */
export type ContextDetector = (request: MatchRequest) => ContextType;
