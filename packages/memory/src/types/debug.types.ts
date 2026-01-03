/**
 * Debug Types
 *
 * Types for memory debugging and inspection.
 */

import type {
  MemoryEntry,
  MemoryStats,
  MemoryType,
  ScoredMemory,
} from './core.types.js';

/**
 * Memory quality metrics
 */
export interface MemoryQualityMetrics {
  coverage: number;
  freshness: number;
  diversity: number;
  consistency: number;
  relevance: number;
  overallScore: number;
}

/**
 * Duplicate detection result
 */
export interface DuplicateGroup {
  entries: MemoryEntry[];
  similarity: number;
  recommendation: 'merge' | 'keep-all' | 'keep-one';
}

/**
 * Warning thresholds for inspector
 */
export interface WarningThresholds {
  lowImportance?: number;
  highEntryCount?: number;
  oldAge?: number;
}

/**
 * Inspector configuration
 */
export interface InspectorConfig {
  includeEmbeddings?: boolean;
  samplingRate?: number;
  maxEntriesForAnalysis?: number;
  warningThresholds?: WarningThresholds;
}

/**
 * Inspection result
 */
export interface InspectionResult {
  stats: MemoryStats;
  quality: MemoryQualityMetrics;
  duplicates: DuplicateGroup[];
  anomalies: MemoryAnomaly[];
  recommendations: string[];
}

/**
 * Memory anomaly
 */
export interface MemoryAnomaly {
  type: 'orphan' | 'inconsistent' | 'expired' | 'low-quality' | 'suspicious';
  memoryId: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  suggestedAction?: string;
}

/**
 * Timeline event
 */
export interface TimelineEvent {
  timestamp: number;
  type: 'add' | 'update' | 'delete' | 'access' | 'consolidate';
  memoryId: string;
  memoryType: MemoryType;
  namespace?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Timeline configuration
 */
export interface TimelineConfig {
  timeRange?: {
    start: number;
    end: number;
  };
  groupBy?: 'hour' | 'day' | 'week' | 'month';
  showTypes?: boolean;
  showNamespaces?: boolean;
  maxEvents?: number;
  autoTrack?: boolean;
  segmentSize?: 'hour' | 'day' | 'week';
}

/**
 * Timeline visualization data
 */
export interface TimelineVisualization {
  events: TimelineEvent[];
  buckets: TimelineBucket[];
  summary: {
    totalEvents: number;
    byType: Record<string, number>;
    peakActivity: {
      timestamp: number;
      count: number;
    };
  };
}

/**
 * Timeline bucket
 */
export interface TimelineBucket {
  start: number;
  end: number;
  count: number;
  byType: Record<string, number>;
  entries: string[];
}

/**
 * Retrieval debug options
 */
export interface RetrievalDebugOptions {
  query: string;
  expectedMemories?: string[];
  context?: Record<string, unknown>;
  verbose?: boolean;
  candidateMultiplier?: number;
  limit?: number;
  types?: string[];
  namespace?: string;
  minScore?: number;
}

/**
 * Retrieval debug result
 */
export interface RetrievalDebugResult {
  query: string;
  queryEmbedding?: number[];
  topCandidates: Array<{
    memoryId: string;
    content: string;
    score: number;
    factors?: Record<string, number>;
  }>;
  expectedFound: number;
  expectedTotal: number;
  missingExpected?: string[];
  unexpectedTop?: string[];
  explanation: string;
  suggestions?: string[];
  durationMs: number;
}

/**
 * Export format
 */
export type ExportFormat = 'json' | 'csv' | 'jsonl' | 'training';

/**
 * Export options
 */
export interface ExportOptions {
  format?: ExportFormat;
  includeEmbeddings?: boolean;
  includeMetadata?: boolean;
  filter?: {
    types?: MemoryType[];
    namespaces?: string[];
    timeRange?: {
      start?: number;
      end?: number;
    };
  };
  namespace?: string;
  types?: string[];
  startTime?: number;
  endTime?: number;
  ids?: string[];
  pretty?: boolean;
}

/**
 * Training data format
 */
export interface TrainingDataOptions extends ExportOptions {
  format: 'training';
  trainingFormat?: 'conversation' | 'qa' | 'instruction';
  includeSummaries?: boolean;
  groupByConversation?: boolean;
}

/**
 * Export result
 */
export interface ExportResult {
  path: string;
  format: ExportFormat;
  entryCount: number;
  sizeBytes: number;
  exportedAt: number;
}

/**
 * Debug session
 */
export interface DebugSession {
  id: string;
  startedAt: number;
  queries: Array<{
    query: string;
    results: ScoredMemory[];
    durationMs: number;
    timestamp: number;
  }>;
  operations: Array<{
    type: string;
    memoryId?: string;
    durationMs: number;
    timestamp: number;
    success: boolean;
    error?: string;
  }>;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  avgRetrievalLatencyMs: number;
  avgAddLatencyMs: number;
  avgEmbeddingLatencyMs: number;
  p95RetrievalLatencyMs: number;
  p99RetrievalLatencyMs: number;
  queriesPerSecond: number;
  cacheHitRate: number;
}

/**
 * Memory diff
 */
export interface MemoryDiff {
  added: MemoryEntry[];
  removed: MemoryEntry[];
  modified: Array<{
    before: MemoryEntry;
    after: MemoryEntry;
    changes: string[];
  }>;
}

/**
 * Debugger interface
 */
export interface DebuggerInterface {
  startSession(): DebugSession;
  endSession(sessionId: string): void;
  debug(options: RetrievalDebugOptions): Promise<RetrievalDebugResult>;
  getPerformanceMetrics(): PerformanceMetrics;
  diff(before: MemoryEntry[], after: MemoryEntry[]): MemoryDiff;
}
