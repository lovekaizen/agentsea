/**
 * BaseStore
 *
 * Abstract base class for vector stores.
 */

import type {
  VectorRecord,
  VectorStoreType,
  StoreConfig,
  UpsertOptions,
  UpsertResult,
  DeleteOptions,
  DeleteResult,
  StoreQueryOptions,
  StoreQueryResult,
  StoreStats,
  StoreHealth,
  EmbeddingVector,
  SearchResult,
  DistanceMetric,
} from '../types/index.js';
import { EmbeddingModel } from '../core/EmbeddingModel.js';

/**
 * Abstract base class for vector stores
 */
export abstract class BaseStore {
  /** Store type */
  abstract readonly storeType: VectorStoreType;

  /** Store configuration */
  protected config: StoreConfig;

  constructor(config: StoreConfig) {
    this.config = {
      namespace: config.namespace ?? 'default',
      dimensions: config.dimensions,
      metric: config.metric ?? 'cosine',
      ...config,
    };
  }

  /**
   * Upsert vectors into the store
   */
  abstract upsert(
    records: VectorRecord[],
    options?: UpsertOptions,
  ): Promise<UpsertResult>;

  /**
   * Query for similar vectors
   */
  abstract query(
    vector: EmbeddingVector,
    options?: StoreQueryOptions,
  ): Promise<StoreQueryResult>;

  /**
   * Delete vectors by ID
   */
  abstract delete(
    ids: string[],
    options?: DeleteOptions,
  ): Promise<DeleteResult>;

  /**
   * Delete all vectors in namespace
   */
  abstract deleteAll(options?: DeleteOptions): Promise<DeleteResult>;

  /**
   * Get store statistics
   */
  abstract getStats(): Promise<StoreStats>;

  /**
   * Check store health
   */
  abstract checkHealth(): Promise<StoreHealth>;

  /**
   * Close/cleanup the store
   */
  abstract close(): Promise<void>;

  /**
   * Get namespace
   */
  get namespace(): string {
    return this.config.namespace ?? 'default';
  }

  /**
   * Get dimensions
   */
  get dimensions(): number | undefined {
    return this.config.dimensions;
  }

  /**
   * Get distance metric
   */
  get metric(): DistanceMetric {
    return this.config.metric ?? 'cosine';
  }

  /**
   * Calculate similarity/distance between vectors
   */
  protected calculateScore(a: EmbeddingVector, b: EmbeddingVector): number {
    switch (this.metric) {
      case 'cosine':
        return EmbeddingModel.cosineSimilarity(a, b);
      case 'euclidean': {
        // Convert distance to similarity (0-1)
        const dist = EmbeddingModel.euclideanDistance(a, b);
        return 1 / (1 + dist);
      }
      case 'dot_product':
        return EmbeddingModel.dotProduct(a, b);
      default:
        return EmbeddingModel.cosineSimilarity(a, b);
    }
  }

  /**
   * Filter records by metadata
   */
  protected filterByMetadata(
    records: VectorRecord[],
    filter?: Record<string, unknown>,
  ): VectorRecord[] {
    if (!filter) return records;

    return records.filter((record) => {
      if (!record.metadata) return false;

      for (const [key, value] of Object.entries(filter)) {
        if (record.metadata[key] !== value) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Convert records to search results
   */
  protected toSearchResults(
    records: Array<VectorRecord & { score: number }>,
    options?: StoreQueryOptions,
  ): SearchResult[] {
    return records.map((record) => ({
      id: record.id,
      text: options?.includeText !== false ? (record.text ?? '') : '',
      score: record.score,
      metadata:
        options?.includeMetadata !== false ? (record.metadata ?? {}) : {},
      distance: this.metric !== 'cosine' ? 1 - record.score : undefined,
    }));
  }
}

/**
 * Store factory options
 */
export interface StoreFactoryOptions {
  /** Default store type */
  defaultType?: VectorStoreType;
  /** Store configurations by type */
  stores?: Record<VectorStoreType, StoreConfig>;
}
