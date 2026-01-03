/**
 * Recorder
 *
 * Records agent execution for playback and analysis.
 */

import { EventEmitter } from 'eventemitter3';
import type {
  Recording,
  RecordingMetadata,
  RecorderConfig,
  ExecutionStep,
  AgentState,
  TokenUsage,
  RecordingStorageAdapter,
  Checkpoint,
  Snapshot,
} from '../types/index.js';
import { SnapshotManager } from './Snapshot.js';
import { CheckpointManager } from './Checkpoint.js';
import { Timeline } from './Timeline.js';
import { generateId, now, estimateSize, deepClone } from '../utils/helpers.js';

/**
 * Recorder events
 */
export interface RecorderEvents {
  'recording:started': (recordingId: string) => void;
  'recording:stopped': (recording: Recording) => void;
  'recording:paused': () => void;
  'recording:resumed': () => void;
  'step:recorded': (step: ExecutionStep) => void;
  'snapshot:created': (snapshot: Snapshot) => void;
  'checkpoint:created': (checkpoint: Checkpoint) => void;
  error: (error: Error) => void;
}

/**
 * Recording session state
 */
type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped';

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Omit<Required<RecorderConfig>, 'storage'> & {
  storage?: RecordingStorageAdapter;
} = {
  includePrompts: true,
  includeResponses: true,
  includeToolCalls: true,
  includeMemory: true,
  includeMetadata: true,
  compression: false,
  maxSizeBytes: 100 * 1024 * 1024, // 100MB
  autoSnapshot: false,
  snapshotInterval: 0,
  maxRecordings: 1000,
  retentionDays: 30,
  checkpointInterval: 0,
  includeEmbeddings: false,
  storage: undefined,
};

/**
 * Recorder
 *
 * Records agent execution sessions.
 *
 * @example
 * ```typescript
 * const recorder = new Recorder({
 *   includePrompts: true,
 *   includeResponses: true,
 *   autoSnapshot: true,
 *   snapshotInterval: 10,
 * });
 *
 * // Start recording
 * recorder.start('my-agent', initialState);
 *
 * // Record steps
 * recorder.recordStep(step, state);
 *
 * // Stop and get recording
 * const recording = recorder.stop();
 * ```
 */
export class Recorder extends EventEmitter<RecorderEvents> {
  private config: Omit<Required<RecorderConfig>, 'storage'> & {
    storage?: RecordingStorageAdapter;
  };
  private state: RecordingState = 'idle';
  private recordingId?: string;
  private agentId?: string;
  private agentName?: string;
  private steps: ExecutionStep[] = [];
  private startedAt = 0;
  private initialState?: AgentState;
  private currentState?: AgentState;
  private snapshots: SnapshotManager;
  private checkpoints: CheckpointManager;
  private timeline: Timeline;
  private storage?: RecordingStorageAdapter;
  private estimatedSize = 0;

  constructor(
    config?: Partial<RecorderConfig>,
    storage?: RecordingStorageAdapter,
  ) {
    super();

    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    this.storage = storage;
    this.snapshots = new SnapshotManager();
    this.checkpoints = new CheckpointManager();
    this.timeline = new Timeline();
  }

  /**
   * Start recording
   */
  start(agentId: string, initialState: AgentState, agentName?: string): string {
    if (this.state !== 'idle') {
      throw new Error(`Cannot start recording in state: ${this.state}`);
    }

    this.recordingId = generateId('rec');
    this.agentId = agentId;
    this.agentName = agentName ?? initialState.agentName;
    this.initialState = deepClone(initialState);
    this.currentState = deepClone(initialState);
    this.steps = [];
    this.startedAt = now();
    this.estimatedSize = 0;
    this.state = 'recording';

    // Reset managers
    this.snapshots = new SnapshotManager();
    this.checkpoints = new CheckpointManager();
    this.timeline = new Timeline();

    // Create initial snapshot
    this.snapshots.create(initialState, 0);

    this.emit('recording:started', this.recordingId);

    return this.recordingId;
  }

  /**
   * Stop recording
   */
  stop(): Recording {
    if (this.state !== 'recording' && this.state !== 'paused') {
      throw new Error(`Cannot stop recording in state: ${this.state}`);
    }

    const recording = this.buildRecording();
    this.state = 'stopped';

    this.emit('recording:stopped', recording);

    return recording;
  }

  /**
   * Pause recording
   */
  pause(): void {
    if (this.state !== 'recording') {
      return;
    }

    this.state = 'paused';
    this.emit('recording:paused');
  }

  /**
   * Resume recording
   */
  resume(): void {
    if (this.state !== 'paused') {
      return;
    }

    this.state = 'recording';
    this.emit('recording:resumed');
  }

  /**
   * Record a step
   */
  recordStep(step: ExecutionStep, state: AgentState): boolean {
    if (this.state !== 'recording') {
      return false;
    }

    // Check size limit
    const stepSize = estimateSize(step);
    if (this.estimatedSize + stepSize > this.config.maxSizeBytes) {
      this.emit('error', new Error('Recording size limit exceeded'));
      return false;
    }

    // Apply filters
    const filteredStep = this.filterStep(step);
    if (!filteredStep) {
      return false;
    }

    this.steps.push(filteredStep);
    this.currentState = deepClone(state);
    this.estimatedSize += stepSize;

    // Add to timeline
    this.timeline.addEvent({
      id: generateId('evt'),
      type: filteredStep.type,
      timestamp: filteredStep.timestamp,
      stepIndex: filteredStep.index,
      description: this.getStepDescription(filteredStep),
    });

    // Auto-snapshot
    if (
      this.config.autoSnapshot &&
      this.config.snapshotInterval > 0 &&
      this.steps.length % this.config.snapshotInterval === 0
    ) {
      const snapshot = this.snapshots.create(state, filteredStep.index);
      this.emit('snapshot:created', snapshot);
    }

    this.emit('step:recorded', filteredStep);

    return true;
  }

  /**
   * Create a checkpoint
   */
  createCheckpoint(name: string, description?: string): Checkpoint | undefined {
    if (this.state !== 'recording' && this.state !== 'paused') {
      return undefined;
    }

    if (!this.recordingId || !this.currentState) {
      return undefined;
    }

    const stepIndex =
      this.steps.length > 0 ? this.steps[this.steps.length - 1].index : -1;

    const checkpoint = this.checkpoints.create({
      recordingId: this.recordingId,
      name,
      description,
      stepIndex,
      state: this.currentState,
    });

    // Also create a snapshot for the checkpoint
    this.snapshots.create(this.currentState, stepIndex);

    this.emit('checkpoint:created', checkpoint);

    return checkpoint;
  }

  /**
   * Get current recording state
   */
  getState(): RecordingState {
    return this.state;
  }

  /**
   * Get recording ID
   */
  getRecordingId(): string | undefined {
    return this.recordingId;
  }

  /**
   * Get steps count
   */
  getStepsCount(): number {
    return this.steps.length;
  }

  /**
   * Get estimated size
   */
  getEstimatedSize(): number {
    return this.estimatedSize;
  }

  /**
   * Get timeline
   */
  getTimeline(): Timeline {
    return this.timeline;
  }

  /**
   * Get snapshots
   */
  getSnapshots(): Snapshot[] {
    return this.snapshots.getAll();
  }

  /**
   * Get checkpoints
   */
  getCheckpoints(): Checkpoint[] {
    return this.checkpoints.getAll();
  }

  /**
   * Save recording to storage
   */
  async save(): Promise<void> {
    if (!this.storage) {
      throw new Error('No storage adapter configured');
    }

    const recording = this.buildRecording();
    await this.storage.save(recording);
  }

  /**
   * Filter step based on configuration
   */
  private filterStep(step: ExecutionStep): ExecutionStep | null {
    const filtered = { ...step };

    // Filter prompts
    if (!this.config.includePrompts && step.type === 'prompt') {
      return null;
    }

    // Filter responses
    if (!this.config.includeResponses && step.type === 'response') {
      return null;
    }

    // Filter tool calls
    if (
      !this.config.includeToolCalls &&
      (step.type === 'tool-call' || step.type === 'tool-result')
    ) {
      return null;
    }

    // Filter metadata
    if (!this.config.includeMetadata) {
      delete filtered.metadata;
    }

    return filtered;
  }

  /**
   * Get step description for timeline
   */
  private getStepDescription(step: ExecutionStep): string {
    switch (step.type) {
      case 'input':
        return 'User input received';
      case 'prompt':
        return 'Prompt sent to model';
      case 'response':
        return 'Response received from model';
      case 'tool-call':
        return `Tool called: ${step.toolCall?.name ?? 'unknown'}`;
      case 'tool-result':
        return `Tool result: ${step.toolCall?.success ? 'success' : 'failed'}`;
      case 'decision':
        return `Decision made: ${step.decision?.chosen.description ?? 'unknown'}`;
      case 'error':
        return `Error: ${step.error?.message ?? 'unknown'}`;
      default:
        return `Step: ${step.type}`;
    }
  }

  /**
   * Build the recording object
   */
  private buildRecording(): Recording {
    const endedAt = now();
    const toolCalls = this.steps
      .filter((s) => s.toolCall)
      .map((s) => s.toolCall!);

    const decisions = this.steps
      .filter((s) => s.decision)
      .map((s) => s.decision!);

    const tokenUsage = this.steps.reduce(
      (acc, step) => {
        if (step.tokenUsage) {
          acc.prompt += step.tokenUsage.prompt;
          acc.completion += step.tokenUsage.completion;
          acc.total += step.tokenUsage.total;
        }
        return acc;
      },
      { prompt: 0, completion: 0, total: 0 } as TokenUsage,
    );

    const hasErrors = this.steps.some((s) => s.error);

    return {
      id: this.recordingId!,
      agentId: this.agentId!,
      agentName: this.agentName ?? 'Unknown',
      status: hasErrors ? 'failed' : 'completed',
      startedAt: this.startedAt,
      endedAt,
      durationMs: endedAt - this.startedAt,
      steps: this.steps,
      toolCalls,
      decisions,
      checkpoints: this.checkpoints.getAll(),
      initialState: this.initialState!,
      finalState: this.currentState!,
      tokenUsage,
      version: '1.0.0',
      metadata: this.config.includeMetadata ? this.buildMetadata() : undefined,
    };
  }

  /**
   * Build recording metadata
   */
  private buildMetadata(): RecordingMetadata {
    return {
      totalSteps: this.steps.length,
      totalToolCalls: this.steps.filter((s) => s.type === 'tool-call').length,
      totalDecisions: this.steps.filter((s) => s.type === 'decision').length,
      hasErrors: this.steps.some((s) => s.error),
      compressionUsed: this.config.compression,
      recordingVersion: '1.0.0',
      tags: [],
    };
  }
}

/**
 * Create a recorder instance
 */
export function createRecorder(
  config?: Partial<RecorderConfig>,
  storage?: RecordingStorageAdapter,
): Recorder {
  return new Recorder(config, storage);
}
