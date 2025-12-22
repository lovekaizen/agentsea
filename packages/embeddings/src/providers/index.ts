/**
 * Provider Module Exports
 */

export { BaseProvider } from './BaseProvider.js';
export { OpenAIProvider, createOpenAIProvider } from './OpenAIProvider.js';
export { CohereProvider, createCohereProvider } from './CohereProvider.js';
export { VoyageProvider, createVoyageProvider } from './VoyageProvider.js';
export {
  LocalProvider,
  createLocalProvider,
  createMockProvider,
  createRandomProvider,
  type LocalEmbeddingFn,
  type LocalProviderOptions,
} from './LocalProvider.js';
export {
  HuggingFaceProvider,
  createHuggingFaceProvider,
} from './HuggingFaceProvider.js';

// Re-export provider types
export type {
  EmbeddingProviderType,
  ProviderConfig,
  OpenAIProviderConfig,
  CohereProviderConfig,
  VoyageProviderConfig,
  LocalProviderConfig,
  HuggingFaceProviderConfig,
  ProviderHealth,
  ProviderMetrics,
  ProviderCapabilities,
} from '../types/index.js';
