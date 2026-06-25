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
    case 'weaviate':
    case 'milvus':
    case 'pgvector':
      // Types exist for these stores but no runtime implementation ships yet.
      // Fail loudly instead of silently falling back to an in-memory store
      // (which would quietly lose data and confuse users).
      throw new Error(
        `Vector store "${type}" is not implemented yet. Supported stores: ` +
          'memory, pinecone, chroma, qdrant. Use one of those, or pass a ' +
          'custom BaseStore implementation.',
      );
    default:
      throw new Error(
        `Unknown vector store type "${String(type)}". Supported stores: ` +
          'memory, pinecone, chroma, qdrant.',
      );
  }
}
