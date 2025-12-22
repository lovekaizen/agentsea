/**
 * Retrieval Strategies
 *
 * Export retrieval strategy implementations.
 */

export {
  SemanticRetrieval,
  createSemanticRetrieval,
  type EmbeddingFunction,
  type SemanticRetrievalOptions,
} from './SemanticRetrieval.js';

export {
  HybridRetrieval,
  createHybridRetrieval,
  type HybridRetrievalOptions,
} from './HybridRetrieval.js';

export {
  TemporalRetrieval,
  createTemporalRetrieval,
  TimeWindows,
  type TemporalRetrievalOptions,
  type TimeWindow,
  type TemporalPattern,
} from './TemporalRetrieval.js';

export {
  RetrievalPipeline,
  PipelineBuilder,
  createRetrievalPipeline,
  createPipelineBuilder,
  type PipelineStage,
  type StageConfig,
  type PipelineContext,
  type PipelineConfig,
  type BuiltInStage,
} from './RetrievalPipeline.js';
