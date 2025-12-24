/**
 * ReplayEngine
 *
 * Engine for replaying recorded agent executions.
 */

import { EventEmitter } from 'eventemitter3';
import type {
  Recording,
  ExecutionStep,
  AgentState,
  ReplaySession,
  ReplaySpeed,
  ReplayConfig,
  ReplayResult,
  ReplayDifference,
  ReplayModification,
} from '../types/index.js';
import { StateRestorer } from './StateRestorer.js';
import { ReplayController } from './ReplayController.js';
import { generateId, now, deepClone, sleep } from '../utils/helpers.js';
import { diff, toReplayDifferences } from '../utils/diff.js';

/**
 * Replay engine events
 */
export interface ReplayEngineEvents {
  'replay:started': (session: ReplaySession) => void;
  'replay:paused': (session: ReplaySession) => void;
  'replay:resumed': (session: ReplaySession) => void;
  'replay:stopped': (session: ReplaySession) => void;
  'replay:completed': (result: ReplayResult) => void;
  'step:replayed': (step: ExecutionStep, state: AgentState) => void;
  'step:modified': (original: ExecutionStep, modified: ExecutionStep) => void;
  'divergence:detected': (differences: ReplayDifference[]) => void;
  error: (error: Error) => void;
}

/**
 * Replay options
 */
export interface ReplayOptions {
  /** Replay speed */
  speed?: ReplaySpeed;
  /** Start from step */
  startStep?: number;
  /** End at step */
  endStep?: number;
  /** Modifications to apply */
  modifications?: ReplayModification[];
  /** Whether to execute tools during replay */
  executeTools?: boolean;
  /** Whether to call the actual LLM */
  executeLLM?: boolean;
  /** Callback for tool execution */
  onToolCall?: (step: ExecutionStep) => Promise<unknown>;
  /** Callback for LLM calls */
  onLLMCall?: (step: ExecutionStep) => Promise<string>;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<ReplayConfig> = {
  speedMultiplier: 1,
  pauseOnDecisions: false,
  pauseOnErrors: true,
  pauseOnToolCalls: false,
  executeTools: false,
  executeLLM: false,
  compareResults: true,
  trackDifferences: true,
};

/**
 * ReplayEngine
 *
 * Replays recorded agent executions with modification support.
 *
 * @example
 * ```typescript
 * const engine = new ReplayEngine();
 *
 * // Load a recording
 * const recording = await loadRecording('rec_123');
 *
 * // Start replay
 * const session = engine.start(recording, {
 *   speed: 'normal',
 *   modifications: [
 *     { stepIndex: 5, type: 'modify', data: { input: 'new input' } }
 *   ],
 * });
 *
 * // Wait for completion
 * const result = await session.waitForCompletion();
 * ```
 */
export class ReplayEngine extends EventEmitter<ReplayEngineEvents> {
  private config: Required<ReplayConfig>;
  private sessions: Map<string, ReplaySession> = new Map();
  private currentSession?: ReplaySession;
  private stateRestorer: StateRestorer;
  private controller?: ReplayController;
  private isRunning = false;

  constructor(config?: Partial<ReplayConfig>) {
    super();

    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    this.stateRestorer = new StateRestorer();
  }

  /**
   * Start a replay session
   */
  start(recording: Recording, options?: ReplayOptions): ReplaySession {
    const session: ReplaySession = {
      id: generateId('replay'),
      recordingId: recording.id,
      state: 'idle',
      currentStep: options?.startStep ?? 0,
      totalSteps: recording.steps.length,
      speed: options?.speed ?? 'normal',
      startedAt: now(),
      modifications: options?.modifications ?? [],
      differences: [],
    };

    this.sessions.set(session.id, session);
    this.currentSession = session;

    // Create controller
    this.controller = new ReplayController(recording, session, {
      ...this.config,
      speedMultiplier: this.getSpeedMultiplier(session.speed),
    });

    // Forward controller events
    this.controller.on('step:replayed', (step, state) => {
      this.emit('step:replayed', step, state);
    });

    this.controller.on('paused', () => {
      session.state = 'paused';
      this.emit('replay:paused', session);
    });

    this.controller.on('error', (error) => {
      this.emit('error', error);
    });

    this.emit('replay:started', session);

    // Run replay in background
    this.runReplay(recording, session, options).catch((error) => {
      this.emit('error', error as Error);
    });

    return session;
  }

  /**
   * Run the replay loop
   */
  private async runReplay(
    recording: Recording,
    session: ReplaySession,
    options?: ReplayOptions,
  ): Promise<void> {
    this.isRunning = true;
    const startStep = options?.startStep ?? 0;
    const endStep = options?.endStep ?? recording.steps.length - 1;

    // Restore initial state
    let currentState = this.stateRestorer.restore(
      recording,
      startStep > 0 ? startStep - 1 : 0,
    );

    const replayedSteps: ExecutionStep[] = [];
    const differences: ReplayDifference[] = [];

    for (let i = startStep; i <= endStep && this.isRunning; i++) {
      // Check for pause
      while (session.state === 'paused' && this.isRunning) {
        await sleep(100);
      }

      if (!this.isRunning) {
        break;
      }

      const originalStep = recording.steps[i];
      let step = deepClone(originalStep);

      // Apply modifications
      const modification = options?.modifications?.find(
        (m) => m.stepIndex === i,
      );
      if (modification) {
        step = this.applyModification(step, modification);
        this.emit('step:modified', originalStep, step);
      }

      // Execute step based on type and options
      const result = await this.executeStep(step, currentState, options);

      // Track differences if enabled
      if (this.config.trackDifferences && result.executed) {
        const stepDiffs = this.compareResults(originalStep, result.step);
        if (stepDiffs.length > 0) {
          differences.push(...stepDiffs);
          session.differences = differences;
          this.emit('divergence:detected', stepDiffs);
        }
      }

      replayedSteps.push(result.step);
      currentState = result.state;
      session.currentStep = i;

      // Apply speed delay
      const delay = this.getStepDelay(step, session.speed);
      if (delay > 0) {
        await sleep(delay);
      }

      this.emit('step:replayed', result.step, currentState);

      // Check pause conditions
      if (this.shouldPause(step)) {
        session.state = 'paused';
        this.emit('replay:paused', session);
      }
    }

    // Build result
    const result: ReplayResult = {
      sessionId: session.id,
      recordingId: recording.id,
      success: this.isRunning,
      stepsReplayed: replayedSteps.length,
      differences,
      finalState: currentState,
      startedAt: session.startedAt,
      completedAt: now(),
      durationMs: now() - session.startedAt,
    };

    session.state = 'completed';
    session.completedAt = result.completedAt;
    this.isRunning = false;

    this.emit('replay:completed', result);
  }

  /**
   * Execute a step during replay
   */
  private async executeStep(
    step: ExecutionStep,
    state: AgentState,
    options?: ReplayOptions,
  ): Promise<{ step: ExecutionStep; state: AgentState; executed: boolean }> {
    const newStep = deepClone(step);
    let newState = deepClone(state);
    let executed = false;

    // Handle tool calls
    if (
      step.type === 'tool-call' &&
      options?.executeTools &&
      options?.onToolCall
    ) {
      try {
        const result = await options.onToolCall(step);
        newStep.toolCall = {
          ...newStep.toolCall!,
          result,
          success: true,
        };
        executed = true;
      } catch (error) {
        newStep.toolCall = {
          ...newStep.toolCall!,
          result: (error as Error).message,
          success: false,
        };
        executed = true;
      }
    }

    // Handle LLM calls
    if (step.type === 'response' && options?.executeLLM && options?.onLLMCall) {
      try {
        const response = await options.onLLMCall(step);
        newStep.output = response;
        executed = true;
      } catch (error) {
        newStep.error = {
          name: 'LLMError',
          message: (error as Error).message,
        };
        executed = true;
      }
    }

    // Update state based on step
    newState = this.updateState(newState, newStep);

    return { step: newStep, state: newState, executed };
  }

  /**
   * Update state based on step
   */
  private updateState(state: AgentState, step: ExecutionStep): AgentState {
    const newState = deepClone(state);

    // Add message for input/response steps
    if (step.type === 'input') {
      newState.messages.push({
        role: 'user',
        content: String(step.input),
      });
    } else if (step.type === 'response') {
      newState.messages.push({
        role: 'assistant',
        content: String(step.output),
      });
    }

    return newState;
  }

  /**
   * Apply a modification to a step
   */
  private applyModification(
    step: ExecutionStep,
    modification: ReplayModification,
  ): ExecutionStep {
    const modified = deepClone(step);

    switch (modification.type) {
      case 'skip':
        // Mark step as skipped
        modified.metadata = {
          ...modified.metadata,
          skipped: true,
        };
        break;

      case 'modify':
        // Apply data modifications
        if (modification.data) {
          Object.assign(modified, modification.data);
        }
        break;

      case 'insert':
        // Insert is handled at the engine level
        break;

      case 'replace':
        // Replace step data
        if (modification.data) {
          return {
            ...modified,
            ...modification.data,
          };
        }
        break;
    }

    return modified;
  }

  /**
   * Compare original and replayed results
   */
  private compareResults(
    original: ExecutionStep,
    replayed: ExecutionStep,
  ): ReplayDifference[] {
    const differences = diff(original, replayed);
    return toReplayDifferences(differences, original.index);
  }

  /**
   * Check if should pause on this step
   */
  private shouldPause(step: ExecutionStep): boolean {
    if (this.config.pauseOnDecisions && step.type === 'decision') {
      return true;
    }

    if (this.config.pauseOnErrors && step.error) {
      return true;
    }

    if (this.config.pauseOnToolCalls && step.type === 'tool-call') {
      return true;
    }

    return false;
  }

  /**
   * Get speed multiplier
   */
  private getSpeedMultiplier(speed: ReplaySpeed): number {
    switch (speed) {
      case 'slow':
        return 0.5;
      case 'normal':
        return 1;
      case 'fast':
        return 2;
      case 'instant':
        return 0;
      default:
        return 1;
    }
  }

  /**
   * Get delay for step based on speed
   */
  private getStepDelay(step: ExecutionStep, speed: ReplaySpeed): number {
    if (speed === 'instant') {
      return 0;
    }

    const baseDelay = step.durationMs ?? 100;
    const multiplier = this.getSpeedMultiplier(speed);

    return baseDelay / multiplier;
  }

  /**
   * Pause current replay
   */
  pause(): void {
    if (
      this.currentSession &&
      this.currentSession.state !== 'paused' &&
      this.currentSession.state !== 'stopped'
    ) {
      this.currentSession.state = 'paused';
      this.emit('replay:paused', this.currentSession);
    }
  }

  /**
   * Resume current replay
   */
  resume(): void {
    if (this.currentSession && this.currentSession.state === 'paused') {
      this.currentSession.state = 'playing';
      this.emit('replay:resumed', this.currentSession);
    }
  }

  /**
   * Stop current replay
   */
  stop(): void {
    this.isRunning = false;
    if (this.currentSession) {
      this.currentSession.state = 'stopped';
      this.emit('replay:stopped', this.currentSession);
    }
  }

  /**
   * Set replay speed
   */
  setSpeed(speed: ReplaySpeed): void {
    if (this.currentSession) {
      this.currentSession.speed = speed;
    }
  }

  /**
   * Jump to step
   */
  jumpToStep(stepIndex: number): void {
    if (!this.currentSession) {
      return;
    }

    this.currentSession.currentStep = stepIndex;
  }

  /**
   * Get current session
   */
  getSession(): ReplaySession | undefined {
    return this.currentSession;
  }

  /**
   * Get session by ID
   */
  getSessionById(id: string): ReplaySession | undefined {
    return this.sessions.get(id);
  }

  /**
   * Get all sessions
   */
  getSessions(): ReplaySession[] {
    return Array.from(this.sessions.values());
  }
}

/**
 * Create a replay engine
 */
export function createReplayEngine(
  config?: Partial<ReplayConfig>,
): ReplayEngine {
  return new ReplayEngine(config);
}
