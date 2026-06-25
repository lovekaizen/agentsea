/**
 * Store Module Exports
 */

export { BaseStore, type StoreFactoryOptions } from './BaseStore.js';
export { MemoryStore, createMemoryStore } from './MemoryStore.js';
export { PineconeStore, createPineconeStore } from './PineconeStore.js';
export { ChromaStore, createChromaStore } from './ChromaStore.js';
export { QdrantStore, createQdrantStore } from './QdrantStore.js';
export {
  PgVectorStore,
  createPgVectorStore,
  type PgVectorStoreOptions,
  type PgPoolLike,
} from './PgVectorStore.js';
export {
  WeaviateStore,
  WeaviateSdkBackend,
  createWeaviateStore,
  type WeaviateStoreOptions,
  type WeaviateBackend,
} from './WeaviateStore.js';
export {
  MilvusStore,
  MilvusSdkBackend,
  createMilvusStore,
  type MilvusStoreOptions,
  type MilvusBackend,
} from './MilvusStore.js';

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
  WeaviateStoreConfig,
  MilvusStoreConfig,
  PgVectorStoreConfig,
} from '../types/index.js';
import { MemoryStore } from './MemoryStore.js';
import { PineconeStore } from './PineconeStore.js';
import { ChromaStore } from './ChromaStore.js';
import { QdrantStore } from './QdrantStore.js';
import { PgVectorStore } from './PgVectorStore.js';
import { WeaviateStore } from './WeaviateStore.js';
import { MilvusStore } from './MilvusStore.js';
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
      return new WeaviateStore(config as WeaviateStoreConfig);
    case 'milvus':
      return new MilvusStore(config as MilvusStoreConfig);
    case 'pgvector':
      return new PgVectorStore(config as PgVectorStoreConfig);
    default:
      throw new Error(
        `Unknown vector store type "${String(type)}". Supported stores: ` +
          'memory, pinecone, chroma, qdrant, weaviate, milvus, pgvector.',
      );
  }
}
