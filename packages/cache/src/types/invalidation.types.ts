/**
 * Invalidation Types
 *
 * Type definitions for cache invalidation strategies.
 */

/**
 * Invalidation strategy types
 */
export type InvalidationStrategyType =
  | 'ttl'
  | 'lru'
  | 'event'
  | 'smart'
  | 'manual';

/**
 * Base invalidation configuration
 */
export interface BaseInvalidationConfig {
  /** Strategy type */
  type: InvalidationStrategyType;
  /** Whether to run invalidation automatically */
  autoRun?: boolean;
  /** Interval for automatic invalidation checks (ms) */
  checkIntervalMs?: number;
}

/**
 * TTL-based invalidation configuration
 */
export interface TTLInvalidationConfig extends BaseInvalidationConfig {
  type: 'ttl';
  /** Default TTL in seconds */
  defaultTtl: number;
  /** Model-specific TTLs */
  modelTtls?: Record<string, number>;
  /** Namespace-specific TTLs */
  namespaceTtls?: Record<string, number>;
  /** Whether to use soft TTL (allow stale with revalidation) */
  softTtl?: boolean;
  /** Grace period for soft TTL in seconds */
  gracePeriod?: number;
}

/**
 * LRU-based invalidation configuration
 */
export interface LRUInvalidationConfig extends BaseInvalidationConfig {
  type: 'lru';
  /** Maximum number of entries */
  maxEntries: number;
  /** Maximum size in bytes */
  maxSizeBytes?: number;
  /** Eviction batch size */
  evictionBatchSize?: number;
  /** Minimum age before eviction (seconds) */
  minAge?: number;
}

/**
 * Event-based invalidation configuration
 */
export interface EventInvalidationConfig extends BaseInvalidationConfig {
  type: 'event';
  /** Events to listen for */
  events: string[];
  /** Pattern-based invalidation rules */
  patterns?: InvalidationPattern[];
  /** Whether to propagate to other stores */
  propagate?: boolean;
}

/**
 * Pattern for event-based invalidation
 */
export interface InvalidationPattern {
  /** Event name or pattern */
  event: string | RegExp;
  /** Key pattern to invalidate */
  keyPattern: string | RegExp;
  /** Namespace to target */
  namespace?: string;
  /** Model to target */
  model?: string;
}

/**
 * Smart invalidation configuration
 */
export interface SmartInvalidationConfig extends BaseInvalidationConfig {
  type: 'smart';
  /** Enable staleness detection */
  detectStaleness?: boolean;
  /** Enable hit rate analysis */
  analyzeHitRate?: boolean;
  /** Minimum hit rate to keep entry */
  minHitRate?: number;
  /** Enable access pattern learning */
  learnAccessPatterns?: boolean;
  /** Historical window in hours */
  historicalWindowHours?: number;
}

/**
 * Invalidation event
 */
export interface InvalidationEvent {
  /** Event timestamp */
  timestamp: number;
  /** Keys invalidated */
  keys: string[];
  /** Reason for invalidation */
  reason: 'ttl' | 'lru' | 'event' | 'smart' | 'manual';
  /** Entries removed */
  entriesRemoved: number;
  /** Bytes freed */
  bytesFreed: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Invalidation result
 */
export interface InvalidationResult {
  /** Keys invalidated */
  invalidatedKeys: string[];
  /** Number of entries removed */
  entriesRemoved: number;
  /** Bytes freed */
  bytesFreed: number;
  /** Duration of invalidation operation (ms) */
  durationMs: number;
  /** Any errors encountered */
  errors?: string[];
}

/**
 * Invalidation manager configuration
 */
export interface InvalidationManagerConfig {
  /** Primary invalidation strategy */
  strategy: InvalidationStrategyType;
  /** TTL configuration (if using TTL strategy) */
  ttl?: Omit<TTLInvalidationConfig, 'type'>;
  /** LRU configuration (if using LRU strategy) */
  lru?: Omit<LRUInvalidationConfig, 'type'>;
  /** Event configuration (if using event strategy) */
  event?: Omit<EventInvalidationConfig, 'type'>;
  /** Smart configuration (if using smart strategy) */
  smart?: Omit<SmartInvalidationConfig, 'type'>;
  /** Enable invalidation events */
  emitEvents?: boolean;
  /** Callback for invalidation events */
  onInvalidate?: (event: InvalidationEvent) => void;
}

/**
 * Invalidation statistics
 */
export interface InvalidationStats {
  /** Total invalidations */
  totalInvalidations: number;
  /** Entries removed by TTL */
  ttlRemovals: number;
  /** Entries removed by LRU */
  lruRemovals: number;
  /** Entries removed by events */
  eventRemovals: number;
  /** Entries removed by smart detection */
  smartRemovals: number;
  /** Manual removals */
  manualRemovals: number;
  /** Total bytes freed */
  totalBytesFreed: number;
  /** Last invalidation timestamp */
  lastInvalidationAt?: number;
}
