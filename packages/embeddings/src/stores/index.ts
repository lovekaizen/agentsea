/**
 * Store Module Exports
 */

export { BaseStore, type StoreFactoryOptions } from './BaseStore.js';
export { MemoryStore, createMemoryStore } from './MemoryStore.js';
export { PineconeStore, createPineconeStore } from './PineconeStore.js';
export { ChromaStore, createChromaStore } from './ChromaStore.js';
export { QdrantStore, createQdrantStore } from './QdrantStore.js';

// Re-export store types
export type {
  VectorStoreType,
  StoreConfig,
  DistanceMetric,
  VectorRecord,
  StoredVector,
  PineconeStoreConfig,
  WeaviateStoreConfig,
  ChromaStoreConfig,
  QdrantStoreConfig,
  MilvusStoreConfig,
  PgVectorStoreConfig,
  MemoryStoreConfig,
  UpsertOptions,
  UpsertResult,
  DeleteOptions,
  DeleteResult,
  StoreQueryOptions,
  StoreQueryResult,
  StoreStats,
  StoreHealth,
  IndexInfo,
  CollectionInfo,
} from '../types/index.js';

import type {
  VectorStoreType,
  StoreConfig,
  MemoryStoreConfig,
  PineconeStoreConfig,
  ChromaStoreConfig,
  QdrantStoreConfig,
} from '../types/index.js';
import { MemoryStore } from './MemoryStore.js';
import { PineconeStore } from './PineconeStore.js';
import { ChromaStore } from './ChromaStore.js';
import { QdrantStore } from './QdrantStore.js';
import { BaseStore } from './BaseStore.js';

/**
 * Store factory
 */
export function createStore(
  type: VectorStoreType,
  config: StoreConfig,
): BaseStore {
  switch (type) {
    case 'memory':
      return new MemoryStore(config as MemoryStoreConfig);
    case 'pinecone':
      return new PineconeStore(config as PineconeStoreConfig);
    case 'chroma':
      return new ChromaStore(config as ChromaStoreConfig);
    case 'qdrant':
      return new QdrantStore(config as QdrantStoreConfig);
    default:
      return new MemoryStore(config as MemoryStoreConfig);
  }
}
