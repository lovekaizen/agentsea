/**
 * Invalidation Exports
 *
 * Cache invalidation functionality.
 */

export {
  InvalidationManager,
  createInvalidationManager,
  type InvalidationManagerEvents,
} from './InvalidationManager.js';

// Re-export invalidation types
export type {
  InvalidationStrategyType,
  BaseInvalidationConfig,
  TTLInvalidationConfig,
  LRUInvalidationConfig,
  EventInvalidationConfig,
  InvalidationPattern,
  SmartInvalidationConfig,
  InvalidationEvent,
  InvalidationResult,
  InvalidationManagerConfig,
  InvalidationStats,
} from '../types/index.js';
