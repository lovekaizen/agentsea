/**
 * Annotation Types
 *
 * Types for human annotation workflows.
 */

import { z } from 'zod';

/**
 * Annotation task status
 */
export type AnnotationTaskStatus =
  | 'draft'
  | 'active'
  | 'paused'
  | 'completed'
  | 'cancelled';

/**
 * Annotation item status
 */
export type AnnotationItemStatus =
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'flagged'
  | 'skipped';

/**
 * Annotation task config
 */
export interface AnnotationTaskConfig {
  name: string;
  description: string;
  instructions: string;
  schema: z.ZodSchema;
  itemsPerAnnotator?: number;
  annotatorsPerItem?: number;
  deadline?: Date;
  allowSkip?: boolean;
  requireExplanation?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Annotation task interface
 */
export interface IAnnotationTask {
  id: string;
  name: string;
  description: string;
  instructions: string;
  schema: z.ZodSchema;
  status: AnnotationTaskStatus;
  itemsPerAnnotator: number;
  annotatorsPerItem: number;
  deadline?: Date;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Annotation item
 */
export interface AnnotationItem {
  id: string;
  taskId: string;
  data: Record<string, unknown>;
  status: AnnotationItemStatus;
  priority: number;
  assignedTo?: string[];
  annotations: Annotation[];
  consensus?: ConsensusResult;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
}

/**
 * Annotation
 */
export interface Annotation {
  id: string;
  itemId: string;
  annotatorId: string;
  value: Record<string, unknown>;
  explanation?: string;
  confidence?: number;
  duration: number;
  createdAt: number;
  isGold?: boolean;
  quality?: AnnotationQuality;
}

/**
 * Annotation quality
 */
export interface AnnotationQuality {
  score: number;
  agreementWithConsensus?: number;
  flagged?: boolean;
  flagReason?: string;
}

/**
 * Annotator
 */
export interface Annotator {
  id: string;
  name: string;
  email?: string;
  role: 'annotator' | 'reviewer' | 'expert' | 'admin';
  accuracy?: number;
  completedCount: number;
  activeTaskIds: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Annotator stats
 */
export interface AnnotatorStats {
  annotatorId: string;
  totalAnnotations: number;
  averageDuration: number;
  accuracy: number;
  agreementRate: number;
  flaggedRate: number;
  byTask: Record<
    string,
    {
      annotations: number;
      accuracy: number;
      avgDuration: number;
    }
  >;
}

/**
 * Annotation queue config
 */
export interface AnnotationQueueConfig {
  task: IAnnotationTask;
  items: AnnotationItem[];
  prioritization?: PrioritizationType;
  assignment?: AssignmentStrategy;
  qualityControl?: QualityControlConfig;
}

/**
 * Prioritization types
 */
export type PrioritizationType =
  | 'fifo'
  | 'uncertainty'
  | 'diversity'
  | 'importance'
  | 'custom';

/**
 * Assignment strategies
 */
export type AssignmentStrategy =
  | 'round-robin'
  | 'expertise'
  | 'load-balanced'
  | 'random';

/**
 * Quality control config
 */
export interface QualityControlConfig {
  goldStandard?: GoldStandardItem[];
  goldRatio?: number;
  agreementThreshold?: number;
  minAnnotatorAccuracy?: number;
  autoReject?: boolean;
  expertReviewThreshold?: number;
}

/**
 * Gold standard item
 */
export interface GoldStandardItem {
  itemId: string;
  expectedAnnotation: Record<string, unknown>;
  tolerance?: Record<string, number>;
}

/**
 * Consensus method
 */
export type ConsensusMethod =
  | 'majority'
  | 'unanimous'
  | 'weighted'
  | 'dawid-skene'
  | 'expert';

/**
 * Consensus config
 */
export interface ConsensusConfig {
  method: ConsensusMethod;
  minAgreement?: number;
  weights?: Record<string, number>;
  expertAnnotatorId?: string;
  tieBreaker?: 'expert' | 'random' | 'none';
}

/**
 * Consensus result
 */
export interface ConsensusResult {
  value: Record<string, unknown>;
  method: ConsensusMethod;
  agreement: number;
  confidence: number;
  contributingAnnotations: string[];
  disagreements?: Disagreement[];
}

/**
 * Disagreement
 */
export interface Disagreement {
  field: string;
  values: Array<{
    value: unknown;
    annotatorIds: string[];
    count: number;
  }>;
  resolved: boolean;
  resolution?: unknown;
}

/**
 * Queue stats
 */
export interface QueueStats {
  taskId: string;
  totalItems: number;
  pendingItems: number;
  assignedItems: number;
  completedItems: number;
  flaggedItems: number;
  averageAnnotationsPerItem: number;
  averageAgreement: number;
  estimatedCompletion?: Date;
}

/**
 * Annotation result
 */
export interface AnnotationResults {
  taskId: string;
  items: Array<{
    itemId: string;
    data: Record<string, unknown>;
    consensus: ConsensusResult;
    annotations: Annotation[];
  }>;
  stats: {
    total: number;
    completed: number;
    agreementRate: number;
    flaggedCount: number;
    avgAnnotationsPerItem: number;
  };
}

/**
 * Batch assignment
 */
export interface BatchAssignment {
  annotatorId: string;
  itemIds: string[];
  deadline?: Date;
  instructions?: string;
}

/**
 * Annotation event types
 */
export type AnnotationEventType =
  | 'task:created'
  | 'task:started'
  | 'task:paused'
  | 'task:completed'
  | 'item:assigned'
  | 'item:annotated'
  | 'item:flagged'
  | 'item:consensus_reached'
  | 'annotator:joined'
  | 'annotator:warning'
  | 'quality:alert';

/**
 * Annotation event
 */
export interface AnnotationEvent {
  type: AnnotationEventType;
  taskId: string;
  itemId?: string;
  annotatorId?: string;
  data?: Record<string, unknown>;
  timestamp: number;
}
