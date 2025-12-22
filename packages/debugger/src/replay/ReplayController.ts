/**
 * ReplayController
 *
 * Controls replay execution flow.
 */

import { EventEmitter } from 'eventemitter3';
import type {
  Recording,
  ReplaySession,
  ReplayConfig,
  ExecutionStep,
  AgentState,
  Checkpoint,
} from '../types/index.js';
import { deepClone } from '../utils/helpers.js';

/**
 * Controller events
 */
export interface ReplayControllerEvents {
  'step:replayed': (step: ExecutionStep, state: AgentState) => void;
  paused: (reason: string) => void;
  resumed: () => void;
  'checkpoint:reached': (checkpoint: Checkpoint) => void;
  error: (error: Error) => void;
}

/**
 * Playback state
 */
export interface PlaybackState {
  /** Current step index */
  currentStep: number;
  /** Current agent state */
  state: AgentState;
  /** Whether paused */
  isPaused: boolean;
  /** Pause reason */
  pauseReason?: string;
}

/**
 * ReplayController
 *
 * Controls the flow of replay execution.
 *
 * @example
 * ```typescript
 * const controller = new ReplayController(recording, session, config);
 *
 * // Step forward
 * await controller.stepForward();
 *
 * // Step backward
 * await controller.stepBackward();
 *
 * // Jump to checkpoint
 * await controller.jumpToCheckpoint(checkpointId);
 * ```
 */
export class ReplayController extends EventEmitter<ReplayControllerEvents> {
  private recording: Recording;
  private session: ReplaySession;
  private config: Required<ReplayConfig>;
  private playbackState: PlaybackState;
  private stateHistory: Map<number, AgentState> = new Map();
  private checkpointMap: Map<string, Checkpoint> = new Map();

  constructor(
    recording: Recording,
    session: ReplaySession,
    config: Required<ReplayConfig>,
  ) {
    super();

    this.recording = recording;
    this.session = session;
    this.config = config;

    // Initialize playback state
    this.playbackState = {
      currentStep: session.currentStep,
      state: deepClone(recording.initialState),
      isPaused: false,
    };

    // Cache initial state
    this.stateHistory.set(-1, deepClone(recording.initialState));

    // Build checkpoint map
    for (const checkpoint of recording.checkpoints) {
      this.checkpointMap.set(checkpoint.id, checkpoint);
    }
  }

  /**
   * Step forward one step
   */
  stepForward(): ExecutionStep | undefined {
    const nextStep = this.playbackState.currentStep + 1;

    if (nextStep >= this.recording.steps.length) {
      return undefined;
    }

    const step = this.recording.steps[nextStep];
    const newState = this.applyStep(this.playbackState.state, step);

    // Cache state
    this.stateHistory.set(nextStep, deepClone(newState));

    this.playbackState.currentStep = nextStep;
    this.playbackState.state = newState;
    this.session.currentStep = nextStep;

    this.emit('step:replayed', step, newState);

    // Check pause conditions
    this.checkPauseConditions(step);

    return step;
  }

  /**
   * Step backward one step
   */
  stepBackward(): ExecutionStep | undefined {
    const prevStep = this.playbackState.currentStep - 1;

    if (prevStep < 0) {
      // Restore to initial state
      this.playbackState.currentStep = -1;
      this.playbackState.state = deepClone(this.recording.initialState);
      this.session.currentStep = 0;
      return undefined;
    }

    // Get cached state or rebuild
    let state = this.stateHistory.get(prevStep);
    if (!state) {
      state = this.rebuildStateAt(prevStep);
      this.stateHistory.set(prevStep, deepClone(state));
    }

    this.playbackState.currentStep = prevStep;
    this.playbackState.state = deepClone(state);
    this.session.currentStep = prevStep;

    const step = this.recording.steps[prevStep];
    this.emit('step:replayed', step, this.playbackState.state);

    return step;
  }

  /**
   * Jump to a specific step
   */
  jumpToStep(stepIndex: number): ExecutionStep | undefined {
    if (stepIndex < -1 || stepIndex >= this.recording.steps.length) {
      return undefined;
    }

    // Get cached state or rebuild
    let state = this.stateHistory.get(stepIndex);
    if (!state) {
      state = this.rebuildStateAt(stepIndex);
      this.stateHistory.set(stepIndex, deepClone(state));
    }

    this.playbackState.currentStep = stepIndex;
    this.playbackState.state = deepClone(state);
    this.session.currentStep = Math.max(0, stepIndex);

    if (stepIndex >= 0) {
      const step = this.recording.steps[stepIndex];
      this.emit('step:replayed', step, this.playbackState.state);
      return step;
    }

    return undefined;
  }

  /**
   * Jump to a checkpoint
   */
  jumpToCheckpoint(checkpointId: string): boolean {
    const checkpoint = this.checkpointMap.get(checkpointId);
    if (!checkpoint) {
      return false;
    }

    // Use checkpoint state directly
    this.playbackState.currentStep = checkpoint.stepIndex;
    this.playbackState.state = deepClone(checkpoint.state);
    this.session.currentStep = checkpoint.stepIndex;

    // Cache checkpoint state
    this.stateHistory.set(checkpoint.stepIndex, deepClone(checkpoint.state));

    this.emit('checkpoint:reached', checkpoint);

    if (
      checkpoint.stepIndex >= 0 &&
      checkpoint.stepIndex < this.recording.steps.length
    ) {
      const step = this.recording.steps[checkpoint.stepIndex];
      this.emit('step:replayed', step, this.playbackState.state);
    }

    return true;
  }

  /**
   * Get next checkpoint
   */
  getNextCheckpoint(): Checkpoint | undefined {
    const currentStep = this.playbackState.currentStep;

    for (const checkpoint of this.recording.checkpoints) {
      if (checkpoint.stepIndex > currentStep) {
        return checkpoint;
      }
    }

    return undefined;
  }

  /**
   * Get previous checkpoint
   */
  getPreviousCheckpoint(): Checkpoint | undefined {
    const currentStep = this.playbackState.currentStep;
    let lastCheckpoint: Checkpoint | undefined;

    for (const checkpoint of this.recording.checkpoints) {
      if (checkpoint.stepIndex < currentStep) {
        lastCheckpoint = checkpoint;
      } else {
        break;
      }
    }

    return lastCheckpoint;
  }

  /**
   * Pause playback
   */
  pause(reason?: string): void {
    this.playbackState.isPaused = true;
    this.playbackState.pauseReason = reason;
    this.emit('paused', reason ?? 'Manual pause');
  }

  /**
   * Resume playback
   */
  resume(): void {
    this.playbackState.isPaused = false;
    this.playbackState.pauseReason = undefined;
    this.emit('resumed');
  }

  /**
   * Get current step
   */
  getCurrentStep(): ExecutionStep | undefined {
    const index = this.playbackState.currentStep;
    if (index >= 0 && index < this.recording.steps.length) {
      return this.recording.steps[index];
    }
    return undefined;
  }

  /**
   * Get current state
   */
  getCurrentState(): AgentState {
    return deepClone(this.playbackState.state);
  }

  /**
   * Get playback state
   */
  getPlaybackState(): PlaybackState {
    return { ...this.playbackState };
  }

  /**
   * Check if at beginning
   */
  isAtBeginning(): boolean {
    return this.playbackState.currentStep <= 0;
  }

  /**
   * Check if at end
   */
  isAtEnd(): boolean {
    return this.playbackState.currentStep >= this.recording.steps.length - 1;
  }

  /**
   * Get progress percentage
   */
  getProgress(): number {
    if (this.recording.steps.length === 0) {
      return 100;
    }
    return (
      ((this.playbackState.currentStep + 1) / this.recording.steps.length) * 100
    );
  }

  /**
   * Apply a step to state
   */
  private applyStep(state: AgentState, step: ExecutionStep): AgentState {
    const newState = deepClone(state);

    switch (step.type) {
      case 'input':
        newState.messages.push({
          role: 'user',
          content: String(step.input),
        });
        break;

      case 'response':
        newState.messages.push({
          role: 'assistant',
          content: String(step.output),
        });
        break;

      case 'tool-call':
        if (step.toolCall) {
          newState.messages.push({
            role: 'assistant',
            content: `[Tool Call: ${step.toolCall.name}]`,
          });
        }
        break;

      case 'tool-result':
        if (step.toolCall) {
          newState.messages.push({
            role: 'tool',
            content: String(step.toolCall.result),
          });
        }
        break;

      case 'memory-write':
        // Update memory if applicable
        if (step.output && typeof step.output === 'object') {
          Object.assign(newState.memory, step.output);
        }
        break;
    }

    return newState;
  }

  /**
   * Rebuild state at a specific step
   */
  private rebuildStateAt(targetStep: number): AgentState {
    // Find closest cached state before target
    let startStep = -1;
    let state = deepClone(this.recording.initialState);

    for (let i = targetStep; i >= -1; i--) {
      const cached = this.stateHistory.get(i);
      if (cached) {
        startStep = i;
        state = deepClone(cached);
        break;
      }
    }

    // Also check checkpoints
    for (const checkpoint of this.recording.checkpoints) {
      if (
        checkpoint.stepIndex > startStep &&
        checkpoint.stepIndex <= targetStep
      ) {
        startStep = checkpoint.stepIndex;
        state = deepClone(checkpoint.state);
      }
    }

    // Apply steps from start to target
    for (let i = startStep + 1; i <= targetStep; i++) {
      if (i >= 0 && i < this.recording.steps.length) {
        state = this.applyStep(state, this.recording.steps[i]);
      }
    }

    return state;
  }

  /**
   * Check pause conditions
   */
  private checkPauseConditions(step: ExecutionStep): void {
    if (this.config.pauseOnDecisions && step.type === 'decision') {
      this.pause('Decision point');
    }

    if (this.config.pauseOnErrors && step.error) {
      this.pause('Error occurred');
    }

    if (this.config.pauseOnToolCalls && step.type === 'tool-call') {
      this.pause('Tool call');
    }
  }

  /**
   * Get all checkpoints
   */
  getCheckpoints(): Checkpoint[] {
    return this.recording.checkpoints;
  }

  /**
   * Get steps count
   */
  get stepsCount(): number {
    return this.recording.steps.length;
  }
}

/**
 * Create a replay controller
 */
export function createReplayController(
  recording: Recording,
  session: ReplaySession,
  config: Required<ReplayConfig>,
): ReplayController {
  return new ReplayController(recording, session, config);
}
