/**
 * Strategy Exports
 *
 * Cache matching strategies.
 */

export { BaseMatchStrategy } from './BaseMatchStrategy.js';

export {
  ExactMatchStrategy,
  createExactMatchStrategy,
} from './ExactMatchStrategy.js';

export {
  SemanticMatchStrategy,
  createSemanticMatchStrategy,
} from './SemanticMatchStrategy.js';

export {
  HybridMatchStrategy,
  createHybridMatchStrategy,
} from './HybridMatchStrategy.js';

// Re-export strategy types
export type {
  MatchStrategyType,
  MatchOptions,
  MatchRequest,
  MatchResult,
  ExactMatchConfig,
  SemanticMatchConfig,
  HybridMatchConfig,
  FuzzyMatchConfig,
  ThresholdConfig,
  ContextType,
  ContextDetector,
} from '../types/index.js';
