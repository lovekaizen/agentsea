/**
 * Structure Types
 *
 * Types for memory structure implementations.
 */

import type {
  MemoryEntry,
  MemoryStoreInterface,
  ScoredMemory,
} from './core.types.js';

/**
 * Memory level in hierarchy
 */
export type MemoryLevel = 'working' | 'episodic' | 'semantic' | 'longTerm';

/**
 * Memory importance source
 */
export type ImportanceSource =
  | 'recency'
  | 'frequency'
  | 'explicit'
  | 'inferred';

/**
 * Working memory configuration
 */
export interface WorkingMemoryConfig {
  maxItems?: number;
  maxSize?: number;
  ttl?: number;
  importance?: ImportanceSource;
  onEvict?: (entry: MemoryEntry) => void;
  attentionWindow?: number;
  decayRate?: number;
  relevanceThreshold?: number;
  autoEvict?: boolean;
}

/**
 * Episodic memory configuration
 */
export interface EpisodicMemoryConfig {
  store?: MemoryStoreInterface;
  consolidateAfter?: number;
  summarizeThreshold?: number;
  retentionDays?: number;
  episodeTimeout?: number;
  maxEpisodeLength?: number;
  autoSummarize?: boolean;
  minEventsForEpisode?: number;
  emotionTracking?: boolean;
}

/**
 * Episode
 */
export interface Episode {
  id: string;
  entries: MemoryEntry[];
  summary?: string;
  startTime: number;
  endTime?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Semantic memory configuration
 */
export interface SemanticMemoryConfig {
  store?: MemoryStoreInterface;
  extractEntities?: boolean;
  extractRelations?: boolean;
  deduplication?: boolean;
  deduplicationThreshold?: number;
  maxConcepts?: number;
  enableInference?: boolean;
  conflictResolution?: 'newest' | 'highest-confidence' | 'manual' | 'merge';
  minConfidence?: number;
}

/**
 * Knowledge graph node
 */
export interface KnowledgeNode {
  id: string;
  type: string;
  value: string;
  properties?: Record<string, unknown>;
  connections: KnowledgeEdge[];
}

/**
 * Knowledge graph edge
 */
export interface KnowledgeEdge {
  id: string;
  type: string;
  sourceId: string;
  targetId: string;
  properties?: Record<string, unknown>;
}

/**
 * Long-term memory configuration
 */
export interface LongTermMemoryConfig {
  store?: MemoryStoreInterface;
  indexing?: 'vector' | 'keyword' | 'hybrid';
  compression?: boolean;
  compressionThreshold?: number;
  consolidationThreshold?: number;
  compressionRatio?: number;
  minImportance?: number;
  retentionPeriod?: number;
  autoConsolidate?: boolean;
  maxStorageSize?: number;
}

/**
 * Hierarchical memory configuration
 */
export interface HierarchicalMemoryConfig {
  working?: WorkingMemoryConfig;
  episodic?: EpisodicMemoryConfig;
  semantic?: SemanticMemoryConfig;
  longTerm?: LongTermMemoryConfig;
  routing?: MemoryRoutingConfig;
  routingStrategy?:
    | 'importance'
    | 'recency'
    | 'type'
    | 'hybrid'
    | 'auto'
    | 'manual';
  consolidationInterval?: number;
  workingMemorySize?: number;
  promotionThreshold?: number;
}

/**
 * Memory routing configuration
 */
export interface MemoryRoutingConfig {
  rules?: MemoryRoutingRule[];
  defaultLevel?: MemoryLevel;
}

/**
 * Memory routing rule
 */
export interface MemoryRoutingRule {
  condition: (entry: MemoryEntry) => boolean;
  target: MemoryLevel;
  priority?: number;
}

/**
 * Recall options for hierarchical memory
 */
export interface HierarchicalRecallOptions {
  levels?: MemoryLevel[];
  maxPerLevel?: number;
  minScore?: number;
  mergeStrategy?: 'interleave' | 'sequential' | 'priority';
}

/**
 * Hierarchical recall result
 */
export interface HierarchicalRecallResult {
  results: ScoredMemory[];
  byLevel: Record<MemoryLevel, ScoredMemory[]>;
  totalDurationMs: number;
}

/**
 * Memory consolidation result
 */
export interface ConsolidationResult {
  consolidated: number;
  merged: number;
  promoted: number;
  deleted: number;
}

/**
 * Memory structure interface
 */
export interface MemoryStructureInterface {
  readonly level: MemoryLevel;
  add(entry: MemoryEntry): Promise<string>;
  recall(
    query: string,
    options?: { limit?: number; minScore?: number },
  ): Promise<ScoredMemory[]>;
  get(id: string): Promise<MemoryEntry | null>;
  delete(id: string): Promise<boolean>;
  count(): Promise<number>;
  clear(): Promise<void>;
}
