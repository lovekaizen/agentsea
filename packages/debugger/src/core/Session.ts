/**
 * Session
 *
 * Debug session management.
 */

import { EventEmitter } from 'eventemitter3';
import type {
  DebugSession,
  DebugSessionState,
  ExecutionStep,
  AgentState,
  Breakpoint,
  StepAction,
  Checkpoint,
  Recording,
} from '../types/index.js';
import { BreakpointManager, type BreakpointOptions } from './Breakpoint.js';
import { Inspector } from './Inspector.js';
import { generateId, now } from '../utils/helpers.js';

/**
 * Session events
 */
export interface SessionEvents {
  'state:changed': (state: DebugSessionState) => void;
  'step:executed': (step: ExecutionStep) => void;
  'step:paused': (step: ExecutionStep, breakpoint?: Breakpoint) => void;
  'breakpoint:hit': (breakpoint: Breakpoint, step: ExecutionStep) => void;
  'checkpoint:created': (checkpoint: Checkpoint) => void;
  error: (error: Error) => void;
}

/**
 * Session configuration
 */
export interface SessionConfig {
  /** Agent ID */
  agentId: string;
  /** Auto-checkpoint interval (in steps) */
  checkpointInterval?: number;
  /** Maximum steps */
  maxSteps?: number;
}

/**
 * DebugSession
 *
 * Manages a debugging session.
 *
 * @example
 * ```typescript
 * const session = new DebugSession({ agentId: 'my-agent' });
 *
 * // Set breakpoints
 * session.setBreakpoint({ type: 'tool-call', toolName: 'search' });
 *
 * // Start session
 * await session.start();
 *
 * // Execute steps
 * const shouldContinue = session.addStep(step);
 * if (!shouldContinue) {
 *   // Hit a breakpoint
 *   const inspector = session.inspect();
 *   // ... inspect state
 *   await session.continue();
 * }
 * ```
 */
export class DebugSessionManager extends EventEmitter<SessionEvents> {
  private session: DebugSession;
  private steps: ExecutionStep[] = [];
  private state: AgentState;
  private breakpoints: BreakpointManager;
  private checkpoints: Map<string, Checkpoint> = new Map();
  private config: Required<SessionConfig>;
  private pauseResolver?: () => void;
  private stepAction: StepAction = 'continue';

  constructor(config: SessionConfig) {
    super();

    this.config = {
      agentId: config.agentId,
      checkpointInterval: config.checkpointInterval ?? 0,
      maxSteps: config.maxSteps ?? 10000,
    };

    this.breakpoints = new BreakpointManager();
    this.state = this.createInitialState();

    this.session = {
      id: generateId('session'),
      agentId: config.agentId,
      state: 'idle',
      startedAt: 0,
      currentStep: -1,
      totalSteps: 0,
      breakpoints: [],
      checkpoints: [],
    };

    // Forward breakpoint events
    this.breakpoints.on('breakpoint:hit', (bp, ctx) => {
      this.emit('breakpoint:hit', bp, ctx.step);
    });
  }

  /**
   * Get session ID
   */
  get id(): string {
    return this.session.id;
  }

  /**
   * Get session state
   */
  get sessionState(): DebugSessionState {
    return this.session.state;
  }

  /**
   * Start the debug session
   */
  start(): void {
    if (this.session.state !== 'idle') {
      throw new Error(`Cannot start session in state: ${this.session.state}`);
    }

    this.session.state = 'running';
    this.session.startedAt = now();
    this.emit('state:changed', 'running');
  }

  /**
   * Stop the debug session
   */
  stop(): void {
    if (
      this.session.state === 'stopped' ||
      this.session.state === 'completed'
    ) {
      return;
    }

    this.session.state = 'stopped';
    this.session.endedAt = now();

    if (this.pauseResolver) {
      this.pauseResolver();
      this.pauseResolver = undefined;
    }

    this.emit('state:changed', 'stopped');
  }

  /**
   * Pause the session
   */
  pause(): void {
    if (this.session.state === 'running') {
      this.session.state = 'paused';
      this.emit('state:changed', 'paused');
    }
  }

  /**
   * Continue execution
   */
  continue(): void {
    if (this.session.state !== 'paused') {
      return;
    }

    this.stepAction = 'continue';
    this.session.state = 'running';
    this.emit('state:changed', 'running');

    if (this.pauseResolver) {
      this.pauseResolver();
      this.pauseResolver = undefined;
    }
  }

  /**
   * Step over (execute next step)
   */
  stepOver(): void {
    if (this.session.state !== 'paused') {
      return;
    }

    this.stepAction = 'step-over';
    this.session.state = 'running';
    this.emit('state:changed', 'running');

    if (this.pauseResolver) {
      this.pauseResolver();
      this.pauseResolver = undefined;
    }
  }

  /**
   * Step into (go deeper)
   */
  stepInto(): void {
    if (this.session.state !== 'paused') {
      return;
    }

    this.stepAction = 'step-into';
    this.session.state = 'running';
    this.emit('state:changed', 'running');

    if (this.pauseResolver) {
      this.pauseResolver();
      this.pauseResolver = undefined;
    }
  }

  /**
   * Step out (finish current scope)
   */
  stepOut(): void {
    if (this.session.state !== 'paused') {
      return;
    }

    this.stepAction = 'step-out';
    this.session.state = 'running';
    this.emit('state:changed', 'running');

    if (this.pauseResolver) {
      this.pauseResolver();
      this.pauseResolver = undefined;
    }
  }

  /**
   * Add a step to the session
   * Returns true if execution should continue, false if paused
   */
  addStep(step: ExecutionStep, agentState: AgentState): boolean {
    if (this.session.state !== 'running') {
      return false;
    }

    // Add step
    this.steps.push(step);
    this.state = agentState;
    this.session.currentStep = step.index;
    this.session.totalSteps = this.steps.length;

    this.emit('step:executed', step);

    // Check for auto-checkpoint
    if (
      this.config.checkpointInterval > 0 &&
      this.steps.length % this.config.checkpointInterval === 0
    ) {
      this.createCheckpoint({
        name: `auto-checkpoint-${this.steps.length}`,
        automatic: true,
      });
    }

    // Check for step-over mode
    if (this.stepAction === 'step-over') {
      this.session.state = 'paused';
      this.stepAction = 'continue';
      this.emit('step:paused', step);
      return false;
    }

    // Check breakpoints
    const hitBreakpoint = this.breakpoints.check(step, agentState);
    if (hitBreakpoint) {
      this.session.state = 'paused';
      this.emit('step:paused', step, hitBreakpoint);
      return false;
    }

    return true;
  }

  /**
   * Wait for continue signal (for async execution)
   */
  async waitForContinue(): Promise<StepAction> {
    if (this.session.state !== 'paused') {
      return 'continue';
    }

    return new Promise<StepAction>((resolve) => {
      this.pauseResolver = () => resolve(this.stepAction);
    });
  }

  /**
   * Set a breakpoint
   */
  setBreakpoint(options: BreakpointOptions): Breakpoint {
    const bp = this.breakpoints.add(options);
    this.session.breakpoints = this.breakpoints.getAll();
    return bp;
  }

  /**
   * Remove a breakpoint
   */
  removeBreakpoint(id: string): boolean {
    const result = this.breakpoints.remove(id);
    this.session.breakpoints = this.breakpoints.getAll();
    return result;
  }

  /**
   * Get all breakpoints
   */
  getBreakpoints(): Breakpoint[] {
    return this.breakpoints.getAll();
  }

  /**
   * Create a checkpoint
   */
  createCheckpoint(options: {
    name: string;
    description?: string;
    automatic?: boolean;
  }): Checkpoint {
    const checkpoint: Checkpoint = {
      id: generateId('cp'),
      recordingId: this.session.id,
      name: options.name,
      description: options.description,
      stepIndex: this.session.currentStep,
      timestamp: now(),
      state: this.state,
      automatic: options.automatic ?? false,
    };

    this.checkpoints.set(checkpoint.id, checkpoint);
    this.session.checkpoints.push(checkpoint.id);

    this.emit('checkpoint:created', checkpoint);
    return checkpoint;
  }

  /**
   * Get a checkpoint
   */
  getCheckpoint(id: string): Checkpoint | undefined {
    return this.checkpoints.get(id);
  }

  /**
   * List all checkpoints
   */
  getCheckpoints(): Checkpoint[] {
    return Array.from(this.checkpoints.values());
  }

  /**
   * Restore from a checkpoint
   */
  restoreCheckpoint(id: string): boolean {
    const checkpoint = this.checkpoints.get(id);
    if (!checkpoint) {
      return false;
    }

    // Truncate steps to checkpoint
    this.steps = this.steps.slice(0, checkpoint.stepIndex + 1);
    this.state = checkpoint.state;
    this.session.currentStep = checkpoint.stepIndex;
    this.session.totalSteps = this.steps.length;

    return true;
  }

  /**
   * Get an inspector for current state
   */
  inspect(): Inspector {
    return new Inspector(this.steps, this.state);
  }

  /**
   * Get current agent state
   */
  getState(): AgentState {
    return this.state;
  }

  /**
   * Get all steps
   */
  getSteps(): ExecutionStep[] {
    return [...this.steps];
  }

  /**
   * Get session data
   */
  getSession(): DebugSession {
    return { ...this.session };
  }

  /**
   * Mark session as completed
   */
  complete(): void {
    this.session.state = 'completed';
    this.session.endedAt = now();
    this.emit('state:changed', 'completed');
  }

  /**
   * Mark session as errored
   */
  error(err: Error): void {
    this.session.state = 'error';
    this.session.endedAt = now();
    this.emit('error', err);
    this.emit('state:changed', 'error');
  }

  /**
   * Export session to recording format
   */
  toRecording(): Recording {
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
      { prompt: 0, completion: 0, total: 0 },
    );

    return {
      id: this.session.id,
      agentId: this.config.agentId,
      agentName: this.state.agentName,
      status: this.session.state === 'completed' ? 'completed' : 'failed',
      startedAt: this.session.startedAt,
      endedAt: this.session.endedAt,
      durationMs: (this.session.endedAt ?? now()) - this.session.startedAt,
      steps: this.steps,
      toolCalls,
      decisions,
      checkpoints: this.getCheckpoints(),
      initialState: this.createInitialState(),
      finalState: this.state,
      tokenUsage,
      version: '1.0.0',
    };
  }

  private createInitialState(): AgentState {
    return {
      agentId: this.config.agentId,
      agentName: 'Unknown',
      model: 'unknown',
      memory: { size: 0 },
      context: {},
      tools: [],
      messages: [],
    };
  }
}

/**
 * Create a debug session
 */
export function createDebugSession(config: SessionConfig): DebugSessionManager {
  return new DebugSessionManager(config);
}
