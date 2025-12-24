/**
 * Checkpoint
 *
 * Checkpoint management for recordings.
 */

import type { Checkpoint, AgentState } from '../types/index.js';
import { generateId, now, deepClone } from '../utils/helpers.js';

/**
 * Checkpoint creation options
 */
export interface CheckpointCreateOptions {
  /** Recording ID */
  recordingId: string;
  /** Checkpoint name */
  name: string;
  /** Optional description */
  description?: string;
  /** Step index */
  stepIndex: number;
  /** Agent state at checkpoint */
  state: AgentState;
  /** Whether this was automatically created */
  automatic?: boolean;
  /** Tags for categorization */
  tags?: string[];
}

/**
 * Checkpoint filter options
 */
export interface CheckpointFilterOptions {
  /** Filter by name pattern */
  namePattern?: string | RegExp;
  /** Filter by step range */
  stepRange?: { min?: number; max?: number };
  /** Filter by time range */
  timeRange?: { after?: number; before?: number };
  /** Filter by automatic flag */
  automatic?: boolean;
  /** Filter by tags */
  tags?: string[];
}

/**
 * CheckpointManager
 *
 * Manages checkpoints for recordings.
 *
 * @example
 * ```typescript
 * const manager = new CheckpointManager();
 *
 * // Create a checkpoint
 * const cp = manager.create({
 *   recordingId: 'rec_123',
 *   name: 'Before API call',
 *   stepIndex: 10,
 *   state: currentState,
 * });
 *
 * // Get checkpoints
 * const checkpoints = manager.getAll();
 *
 * // Restore from checkpoint
 * const state = manager.getState(cp.id);
 * ```
 */
export class CheckpointManager {
  private checkpoints: Map<string, Checkpoint> = new Map();
  private checkpointOrder: string[] = [];

  /**
   * Create a checkpoint
   */
  create(options: CheckpointCreateOptions): Checkpoint {
    const checkpoint: Checkpoint = {
      id: generateId('cp'),
      recordingId: options.recordingId,
      name: options.name,
      description: options.description,
      stepIndex: options.stepIndex,
      timestamp: now(),
      state: deepClone(options.state),
      automatic: options.automatic ?? false,
    };

    this.checkpoints.set(checkpoint.id, checkpoint);
    this.checkpointOrder.push(checkpoint.id);

    return checkpoint;
  }

  /**
   * Get a checkpoint by ID
   */
  get(id: string): Checkpoint | undefined {
    return this.checkpoints.get(id);
  }

  /**
   * Get checkpoint by name
   */
  getByName(name: string): Checkpoint | undefined {
    for (const checkpoint of this.checkpoints.values()) {
      if (checkpoint.name === name) {
        return checkpoint;
      }
    }
    return undefined;
  }

  /**
   * Get all checkpoints
   */
  getAll(): Checkpoint[] {
    return this.checkpointOrder.map((id) => this.checkpoints.get(id)!);
  }

  /**
   * Get checkpoints matching filter
   */
  filter(options: CheckpointFilterOptions): Checkpoint[] {
    return this.getAll().filter((cp) => {
      // Name pattern filter
      if (options.namePattern) {
        if (typeof options.namePattern === 'string') {
          if (!cp.name.includes(options.namePattern)) {
            return false;
          }
        } else if (!options.namePattern.test(cp.name)) {
          return false;
        }
      }

      // Step range filter
      if (options.stepRange) {
        if (
          options.stepRange.min !== undefined &&
          cp.stepIndex < options.stepRange.min
        ) {
          return false;
        }
        if (
          options.stepRange.max !== undefined &&
          cp.stepIndex > options.stepRange.max
        ) {
          return false;
        }
      }

      // Time range filter
      if (options.timeRange) {
        if (
          options.timeRange.after !== undefined &&
          cp.timestamp < options.timeRange.after
        ) {
          return false;
        }
        if (
          options.timeRange.before !== undefined &&
          cp.timestamp > options.timeRange.before
        ) {
          return false;
        }
      }

      // Automatic filter
      if (
        options.automatic !== undefined &&
        cp.automatic !== options.automatic
      ) {
        return false;
      }

      return true;
    });
  }

  /**
   * Get checkpoint at or before a step
   */
  getAtStep(stepIndex: number): Checkpoint | undefined {
    let closestCheckpoint: Checkpoint | undefined;

    for (const id of this.checkpointOrder) {
      const checkpoint = this.checkpoints.get(id);
      if (checkpoint && checkpoint.stepIndex <= stepIndex) {
        closestCheckpoint = checkpoint;
      } else {
        break;
      }
    }

    return closestCheckpoint;
  }

  /**
   * Get checkpoint after a step
   */
  getAfterStep(stepIndex: number): Checkpoint | undefined {
    for (const id of this.checkpointOrder) {
      const checkpoint = this.checkpoints.get(id);
      if (checkpoint && checkpoint.stepIndex > stepIndex) {
        return checkpoint;
      }
    }
    return undefined;
  }

  /**
   * Get checkpoints in step range
   */
  getInRange(startStep: number, endStep: number): Checkpoint[] {
    return this.getAll().filter(
      (cp) => cp.stepIndex >= startStep && cp.stepIndex <= endStep,
    );
  }

  /**
   * Get state from checkpoint
   */
  getState(id: string): AgentState | undefined {
    const checkpoint = this.checkpoints.get(id);
    if (!checkpoint) {
      return undefined;
    }

    return deepClone(checkpoint.state);
  }

  /**
   * Update checkpoint
   */
  update(
    id: string,
    updates: Partial<Pick<Checkpoint, 'name' | 'description'>>,
  ): boolean {
    const checkpoint = this.checkpoints.get(id);
    if (!checkpoint) {
      return false;
    }

    if (updates.name !== undefined) {
      checkpoint.name = updates.name;
    }
    if (updates.description !== undefined) {
      checkpoint.description = updates.description;
    }

    return true;
  }

  /**
   * Delete a checkpoint
   */
  delete(id: string): boolean {
    const existed = this.checkpoints.delete(id);
    if (existed) {
      this.checkpointOrder = this.checkpointOrder.filter((i) => i !== id);
    }
    return existed;
  }

  /**
   * Clear all checkpoints
   */
  clear(): void {
    this.checkpoints.clear();
    this.checkpointOrder = [];
  }

  /**
   * Get checkpoint count
   */
  get count(): number {
    return this.checkpoints.size;
  }

  /**
   * Get the latest checkpoint
   */
  getLatest(): Checkpoint | undefined {
    if (this.checkpointOrder.length === 0) {
      return undefined;
    }

    const latestId = this.checkpointOrder[this.checkpointOrder.length - 1];
    return this.checkpoints.get(latestId);
  }

  /**
   * Get the first checkpoint
   */
  getFirst(): Checkpoint | undefined {
    if (this.checkpointOrder.length === 0) {
      return undefined;
    }

    const firstId = this.checkpointOrder[0];
    return this.checkpoints.get(firstId);
  }

  /**
   * Get manual checkpoints only
   */
  getManual(): Checkpoint[] {
    return this.filter({ automatic: false });
  }

  /**
   * Get automatic checkpoints only
   */
  getAutomatic(): Checkpoint[] {
    return this.filter({ automatic: true });
  }

  /**
   * Export checkpoints
   */
  export(): Checkpoint[] {
    return this.getAll().map((cp) => ({
      id: cp.id,
      recordingId: cp.recordingId,
      name: cp.name,
      description: cp.description,
      stepIndex: cp.stepIndex,
      timestamp: cp.timestamp,
      state: cp.state,
      automatic: cp.automatic,
    }));
  }

  /**
   * Import checkpoints
   */
  import(checkpoints: Checkpoint[]): void {
    this.clear();

    for (const checkpoint of checkpoints) {
      this.checkpoints.set(checkpoint.id, deepClone(checkpoint));
      this.checkpointOrder.push(checkpoint.id);
    }
  }
}

/**
 * Create a checkpoint manager
 */
export function createCheckpointManager(): CheckpointManager {
  return new CheckpointManager();
}
