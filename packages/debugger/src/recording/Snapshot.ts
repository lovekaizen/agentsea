/**
 * Snapshot
 *
 * State snapshot management for recordings.
 */

import type { Snapshot, AgentState } from '../types/index.js';
import { generateId, now, deepClone, estimateSize } from '../utils/helpers.js';
import { diff, type Difference } from '../utils/diff.js';

/**
 * Snapshot options
 */
export interface SnapshotOptions {
  /** Maximum snapshots to keep */
  maxSnapshots?: number;
  /** Whether to store incremental diffs */
  useDiffs?: boolean;
  /** Compression level (0-9) */
  compressionLevel?: number;
}

/**
 * Snapshot with diff data
 */
export interface IncrementalSnapshot extends Snapshot {
  /** Diff from previous snapshot */
  diff?: Difference[];
  /** Whether this is a full snapshot */
  isFull: boolean;
  /** Previous snapshot ID */
  previousId?: string;
}

/**
 * Default options
 */
const DEFAULT_OPTIONS: Required<SnapshotOptions> = {
  maxSnapshots: 100,
  useDiffs: true,
  compressionLevel: 0,
};

/**
 * SnapshotManager
 *
 * Manages state snapshots for recordings.
 *
 * @example
 * ```typescript
 * const manager = new SnapshotManager({ useDiffs: true });
 *
 * // Create snapshots
 * const snap1 = manager.create(state1, 0);
 * const snap2 = manager.create(state2, 5);
 *
 * // Get snapshot at step
 * const snapshot = manager.getAtStep(3);
 *
 * // Restore state from snapshot
 * const restoredState = manager.restore(snap1.id);
 * ```
 */
export class SnapshotManager {
  private snapshots: Map<string, IncrementalSnapshot> = new Map();
  private snapshotOrder: string[] = [];
  private options: Required<SnapshotOptions>;
  private fullSnapshotInterval = 10;

  constructor(options?: SnapshotOptions) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };
  }

  /**
   * Create a snapshot
   */
  create(state: AgentState, stepIndex: number): Snapshot {
    const id = generateId('snap');
    const timestamp = now();

    // Determine if this should be a full snapshot
    const shouldBeFull =
      !this.options.useDiffs ||
      this.snapshotOrder.length === 0 ||
      this.snapshotOrder.length % this.fullSnapshotInterval === 0;

    let snapshot: IncrementalSnapshot;

    if (shouldBeFull) {
      snapshot = {
        id,
        timestamp,
        stepIndex,
        state: deepClone(state),
        size: estimateSize(state),
        isFull: true,
      };
    } else {
      // Get previous snapshot
      const previousId = this.snapshotOrder[this.snapshotOrder.length - 1];
      const previous = this.snapshots.get(previousId);

      if (previous) {
        const stateDiff = diff(previous.state, state);
        snapshot = {
          id,
          timestamp,
          stepIndex,
          state: deepClone(state),
          size: estimateSize(state),
          isFull: false,
          diff: stateDiff,
          previousId,
        };
      } else {
        // Fallback to full snapshot
        snapshot = {
          id,
          timestamp,
          stepIndex,
          state: deepClone(state),
          size: estimateSize(state),
          isFull: true,
        };
      }
    }

    this.snapshots.set(id, snapshot);
    this.snapshotOrder.push(id);

    // Enforce max snapshots
    this.enforceLimit();

    return snapshot;
  }

  /**
   * Get a snapshot by ID
   */
  get(id: string): Snapshot | undefined {
    return this.snapshots.get(id);
  }

  /**
   * Get all snapshots
   */
  getAll(): Snapshot[] {
    return this.snapshotOrder.map((id) => this.snapshots.get(id)!);
  }

  /**
   * Get snapshot at or before a step
   */
  getAtStep(stepIndex: number): Snapshot | undefined {
    let closestSnapshot: IncrementalSnapshot | undefined;

    for (const id of this.snapshotOrder) {
      const snapshot = this.snapshots.get(id);
      if (snapshot && snapshot.stepIndex <= stepIndex) {
        closestSnapshot = snapshot;
      } else {
        break;
      }
    }

    return closestSnapshot;
  }

  /**
   * Get snapshot after a step
   */
  getAfterStep(stepIndex: number): Snapshot | undefined {
    for (const id of this.snapshotOrder) {
      const snapshot = this.snapshots.get(id);
      if (snapshot && snapshot.stepIndex > stepIndex) {
        return snapshot;
      }
    }
    return undefined;
  }

  /**
   * Get snapshots in a range
   */
  getInRange(startStep: number, endStep: number): Snapshot[] {
    return this.getAll().filter(
      (snap) => snap.stepIndex >= startStep && snap.stepIndex <= endStep,
    );
  }

  /**
   * Restore state from a snapshot
   */
  restore(id: string): AgentState | undefined {
    const snapshot = this.snapshots.get(id);
    if (!snapshot) {
      return undefined;
    }

    return deepClone(snapshot.state);
  }

  /**
   * Get the latest snapshot
   */
  getLatest(): Snapshot | undefined {
    if (this.snapshotOrder.length === 0) {
      return undefined;
    }

    const latestId = this.snapshotOrder[this.snapshotOrder.length - 1];
    return this.snapshots.get(latestId);
  }

  /**
   * Get the first snapshot
   */
  getFirst(): Snapshot | undefined {
    if (this.snapshotOrder.length === 0) {
      return undefined;
    }

    const firstId = this.snapshotOrder[0];
    return this.snapshots.get(firstId);
  }

  /**
   * Delete a snapshot
   */
  delete(id: string): boolean {
    const existed = this.snapshots.delete(id);
    if (existed) {
      this.snapshotOrder = this.snapshotOrder.filter((i) => i !== id);
    }
    return existed;
  }

  /**
   * Clear all snapshots
   */
  clear(): void {
    this.snapshots.clear();
    this.snapshotOrder = [];
  }

  /**
   * Get snapshot count
   */
  get count(): number {
    return this.snapshots.size;
  }

  /**
   * Get total size of all snapshots
   */
  getTotalSize(): number {
    let total = 0;
    for (const snapshot of this.snapshots.values()) {
      total += snapshot.size ?? 0;
    }
    return total;
  }

  /**
   * Compact snapshots by merging diffs
   */
  compact(): void {
    // Keep only full snapshots and rebuild diffs
    const fullSnapshots = this.getAll().filter(
      (snap) => (snap as IncrementalSnapshot).isFull,
    );

    this.clear();

    for (const snapshot of fullSnapshots) {
      this.snapshots.set(snapshot.id, snapshot as IncrementalSnapshot);
      this.snapshotOrder.push(snapshot.id);
    }
  }

  /**
   * Compare two snapshots
   */
  compare(id1: string, id2: string): Difference[] | undefined {
    const snap1 = this.snapshots.get(id1);
    const snap2 = this.snapshots.get(id2);

    if (!snap1 || !snap2) {
      return undefined;
    }

    return diff(snap1.state, snap2.state);
  }

  /**
   * Export snapshots
   */
  export(): Snapshot[] {
    return this.getAll().map((snap) => ({
      id: snap.id,
      timestamp: snap.timestamp,
      stepIndex: snap.stepIndex,
      state: snap.state,
      size: snap.size,
    }));
  }

  /**
   * Import snapshots
   */
  import(snapshots: Snapshot[]): void {
    this.clear();

    for (const snapshot of snapshots) {
      const incremental: IncrementalSnapshot = {
        ...snapshot,
        isFull: true,
      };
      this.snapshots.set(snapshot.id, incremental);
      this.snapshotOrder.push(snapshot.id);
    }
  }

  /**
   * Enforce max snapshots limit
   */
  private enforceLimit(): void {
    while (this.snapshotOrder.length > this.options.maxSnapshots) {
      const oldestId = this.snapshotOrder.shift();
      if (oldestId) {
        this.snapshots.delete(oldestId);
      }
    }
  }
}

/**
 * Create a snapshot manager
 */
export function createSnapshotManager(
  options?: SnapshotOptions,
): SnapshotManager {
  return new SnapshotManager(options);
}
