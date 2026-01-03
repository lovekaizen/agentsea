/**
 * Similarity Exports
 *
 * Embedding and similarity computation.
 */

export {
  SimilarityEngine,
  createSimilarityEngine,
  type EmbeddingProvider,
  type SimilarityMetric,
  type SimilarityEngineConfig,
} from './SimilarityEngine.js';

export {
  cosineSimilarity,
  euclideanDistance,
  dotProduct,
  manhattanDistance,
  distanceToSimilarity,
  normalize,
  magnitude,
} from './metrics/SimilarityMetrics.js';
