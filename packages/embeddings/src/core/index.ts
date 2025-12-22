/**
 * Core Module Exports
 */

export {
  EmbeddingModel,
  ModelRegistry,
  modelRegistry,
} from './EmbeddingModel.js';
export {
  EmbeddingManager,
  createEmbeddingManager,
  type EmbeddingManagerConfig,
  type EmbeddingManagerEvents,
  type EmbeddingCache,
  type EmbeddingChunker,
  type EmbeddingStore,
} from './EmbeddingManager.js';
export * from './utils.js';
