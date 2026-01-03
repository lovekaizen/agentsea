/**
 * Store Types
 *
 * Types for memory store implementations.
 */

/**
 * In-memory store configuration
 */
export interface InMemoryStoreConfig {
  maxSize?: number;
  ttl?: number;
}

/**
 * SQLite store configuration
 */
export interface SQLiteStoreConfig {
  path: string;
  tableName?: string;
  enableWAL?: boolean;
  vectorDimensions?: number;
}

/**
 * PostgreSQL store configuration
 */
export interface PostgresStoreConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  tableName?: string;
  vectorDimensions?: number;
  ssl?: boolean | Record<string, unknown>;
  poolSize?: number;
}

/**
 * Redis store configuration
 */
export interface RedisStoreConfig {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  url?: string;
  vectorDimensions?: number;
  ttl?: number;
}

/**
 * Pinecone store configuration
 */
export interface PineconeStoreConfig {
  apiKey: string;
  environment?: string;
  indexName: string;
  namespace?: string;
  dimension?: number;
}

/**
 * Store adapter interface
 */
export interface StoreAdapterInterface {
  readonly name: string;
  initialize(): Promise<void>;
  isConnected(): boolean;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

/**
 * Store migration
 */
export interface StoreMigration {
  version: number;
  name: string;
  up: () => Promise<void>;
  down: () => Promise<void>;
}

/**
 * Store health status
 */
export interface StoreHealthStatus {
  healthy: boolean;
  latencyMs: number;
  lastCheck: number;
  error?: string;
  details?: Record<string, unknown>;
}
