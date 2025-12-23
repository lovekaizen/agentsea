/**
 * Checkpointing
 *
 * Workflow state persistence and recovery.
 */

import { nanoid } from 'nanoid';
import type { WorkflowCheckpoint, StepResult } from '../types';

/**
 * Checkpoint storage interface
 */
export interface CheckpointStorage {
  save(checkpoint: WorkflowCheckpoint): Promise<string>;
  load(checkpointId: string): Promise<WorkflowCheckpoint | null>;
  list(workflowId: string): Promise<string[]>;
  delete(checkpointId: string): Promise<void>;
  deleteAll(workflowId: string): Promise<void>;
}

/**
 * In-memory checkpoint storage
 */
export class InMemoryCheckpointStorage implements CheckpointStorage {
  private readonly checkpoints: Map<string, WorkflowCheckpoint> = new Map();

  save(checkpoint: WorkflowCheckpoint): Promise<string> {
    this.checkpoints.set(checkpoint.id, checkpoint);
    return Promise.resolve(checkpoint.id);
  }

  load(checkpointId: string): Promise<WorkflowCheckpoint | null> {
    return Promise.resolve(this.checkpoints.get(checkpointId) ?? null);
  }

  list(workflowId: string): Promise<string[]> {
    const ids: string[] = [];
    for (const [id, checkpoint] of this.checkpoints) {
      if (checkpoint.workflowId === workflowId) {
        ids.push(id);
      }
    }
    return Promise.resolve(ids);
  }

  delete(checkpointId: string): Promise<void> {
    this.checkpoints.delete(checkpointId);
    return Promise.resolve();
  }

  deleteAll(workflowId: string): Promise<void> {
    for (const [id, checkpoint] of this.checkpoints) {
      if (checkpoint.workflowId === workflowId) {
        this.checkpoints.delete(id);
      }
    }
    return Promise.resolve();
  }

  clear(): void {
    this.checkpoints.clear();
  }
}

/**
 * Checkpoint manager configuration
 */
export interface CheckpointManagerConfig {
  /** Storage backend */
  storage?: CheckpointStorage;
  /** Auto-checkpoint interval (ms) or 'after-step' */
  autoCheckpointInterval?: number | 'after-step';
  /** Maximum checkpoints to keep per workflow */
  maxCheckpoints?: number;
  /** Enable compression */
  compress?: boolean;
}

/**
 * Checkpoint manager
 *
 * Manages workflow state checkpointing and recovery.
 */
export class CheckpointManager {
  private readonly storage: CheckpointStorage;
  private readonly config: Required<Omit<CheckpointManagerConfig, 'storage'>>;
  private autoCheckpointTimer?: ReturnType<typeof setInterval>;
  private stepCounter: number = 0;
  private currentWorkflowId?: string;

  constructor(config: CheckpointManagerConfig = {}) {
    this.storage = config.storage ?? new InMemoryCheckpointStorage();
    this.config = {
      autoCheckpointInterval: config.autoCheckpointInterval ?? 'after-step',
      maxCheckpoints: config.maxCheckpoints ?? 10,
      compress: config.compress ?? false,
    };
  }

  /**
   * Save a checkpoint
   */
  async save(
    workflowId: string,
    state: WorkflowState,
  ): Promise<WorkflowCheckpoint> {
    const checkpoint: WorkflowCheckpoint = {
      id: nanoid(),
      workflowId,
      timestamp: new Date(),
      stepIndex: state.currentStepIndex,
      stepResults: state.stepResults,
      variables: Object.fromEntries(state.variables),
      metadata: state.metadata,
    };

    await this.storage.save(checkpoint);

    // Cleanup old checkpoints
    await this.cleanupOldCheckpoints(workflowId);

    return checkpoint;
  }

  /**
   * Load a checkpoint
   */
  async load(checkpointId: string): Promise<WorkflowCheckpoint | null> {
    return this.storage.load(checkpointId);
  }

  /**
   * Load the latest checkpoint for a workflow
   */
  async loadLatest(workflowId: string): Promise<WorkflowCheckpoint | null> {
    const checkpointIds = await this.storage.list(workflowId);

    if (checkpointIds.length === 0) {
      return null;
    }

    // Load all checkpoints and find the latest
    let latest: WorkflowCheckpoint | null = null;

    for (const id of checkpointIds) {
      const checkpoint = await this.storage.load(id);
      if (checkpoint) {
        if (!latest || checkpoint.timestamp > latest.timestamp) {
          latest = checkpoint;
        }
      }
    }

    return latest;
  }

  /**
   * Delete a checkpoint
   */
  async delete(checkpointId: string): Promise<void> {
    await this.storage.delete(checkpointId);
  }

  /**
   * Delete all checkpoints for a workflow
   */
  async deleteAll(workflowId: string): Promise<void> {
    await this.storage.deleteAll(workflowId);
  }

  /**
   * List checkpoints for a workflow
   */
  async list(workflowId: string): Promise<WorkflowCheckpoint[]> {
    const ids = await this.storage.list(workflowId);
    const checkpoints: WorkflowCheckpoint[] = [];

    for (const id of ids) {
      const checkpoint = await this.storage.load(id);
      if (checkpoint) {
        checkpoints.push(checkpoint);
      }
    }

    // Sort by timestamp (newest first)
    checkpoints.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return checkpoints;
  }

  /**
   * Enable automatic checkpointing
   */
  enableAutoCheckpoint(
    workflowId: string,
    getState: () => WorkflowState,
  ): void {
    this.currentWorkflowId = workflowId;
    this.stepCounter = 0;

    if (typeof this.config.autoCheckpointInterval === 'number') {
      // Time-based checkpointing
      this.autoCheckpointTimer = setInterval(() => {
        void (async () => {
          try {
            await this.save(workflowId, getState());
          } catch (error) {
            console.error('Auto-checkpoint failed:', error);
          }
        })();
      }, this.config.autoCheckpointInterval);
    }
  }

  /**
   * Disable automatic checkpointing
   */
  disableAutoCheckpoint(): void {
    if (this.autoCheckpointTimer) {
      clearInterval(this.autoCheckpointTimer);
      this.autoCheckpointTimer = undefined;
    }
    this.currentWorkflowId = undefined;
  }

  /**
   * Notify that a step completed (for step-based checkpointing)
   */
  async onStepComplete(
    workflowId: string,
    state: WorkflowState,
  ): Promise<void> {
    if (this.config.autoCheckpointInterval === 'after-step') {
      await this.save(workflowId, state);
    }

    this.stepCounter++;
  }

  /**
   * Restore workflow state from checkpoint
   */
  async restore(checkpointId: string): Promise<WorkflowState | null> {
    const checkpoint = await this.load(checkpointId);

    if (!checkpoint) {
      return null;
    }

    return {
      currentStepIndex: checkpoint.stepIndex ?? 0,
      stepResults:
        checkpoint.stepResults instanceof Map
          ? checkpoint.stepResults
          : new Map(Object.entries(checkpoint.stepResults)),
      variables: new Map(Object.entries(checkpoint.variables)),
      metadata: checkpoint.metadata ?? {},
    };
  }

  /**
   * Cleanup old checkpoints
   */
  private async cleanupOldCheckpoints(workflowId: string): Promise<void> {
    const checkpoints = await this.list(workflowId);

    if (checkpoints.length > this.config.maxCheckpoints) {
      // Delete oldest checkpoints
      const toDelete = checkpoints.slice(this.config.maxCheckpoints);
      for (const checkpoint of toDelete) {
        await this.storage.delete(checkpoint.id);
      }
    }
  }

  /**
   * Export checkpoints for a workflow
   */
  async export(workflowId: string): Promise<string> {
    const checkpoints = await this.list(workflowId);
    return JSON.stringify(checkpoints, null, 2);
  }

  /**
   * Import checkpoints
   */
  async import(data: string): Promise<number> {
    const checkpoints: WorkflowCheckpoint[] = JSON.parse(data);
    let count = 0;

    for (const checkpoint of checkpoints) {
      // Restore date objects
      checkpoint.timestamp = new Date(checkpoint.timestamp);
      await this.storage.save(checkpoint);
      count++;
    }

    return count;
  }

  /**
   * Get statistics
   */
  async getStatistics(workflowId: string): Promise<CheckpointStatistics> {
    const checkpoints = await this.list(workflowId);

    let totalSize = 0;
    let oldestTimestamp: Date | null = null;
    let newestTimestamp: Date | null = null;

    for (const checkpoint of checkpoints) {
      // Estimate size (rough)
      totalSize += JSON.stringify(checkpoint).length;

      if (!oldestTimestamp || checkpoint.timestamp < oldestTimestamp) {
        oldestTimestamp = checkpoint.timestamp;
      }
      if (!newestTimestamp || checkpoint.timestamp > newestTimestamp) {
        newestTimestamp = checkpoint.timestamp;
      }
    }

    return {
      checkpointCount: checkpoints.length,
      estimatedSizeBytes: totalSize,
      oldestCheckpoint: oldestTimestamp,
      newestCheckpoint: newestTimestamp,
    };
  }
}

/**
 * Workflow state for checkpointing
 */
export interface WorkflowState {
  currentStepIndex: number;
  stepResults: Map<string, StepResult>;
  variables: Map<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Checkpoint statistics
 */
export interface CheckpointStatistics {
  checkpointCount: number;
  estimatedSizeBytes: number;
  oldestCheckpoint: Date | null;
  newestCheckpoint: Date | null;
}

/**
 * Factory function
 */
export function createCheckpointManager(
  config?: CheckpointManagerConfig,
): CheckpointManager {
  return new CheckpointManager(config);
}

export default CheckpointManager;
