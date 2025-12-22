/**
 * Debugger
 *
 * Main debugger class for AI agents.
 */

import { EventEmitter } from 'eventemitter3';
import type {
  DebuggerConfig,
  ExecutionStep,
  AgentState,
  Breakpoint,
  StepType,
  ToolCall,
  Decision,
  TokenUsage,
  Recording,
  Checkpoint,
} from '../types/index.js';
import {
  DebugSessionManager,
  createDebugSession,
  type SessionConfig,
} from './Session.js';
import { BreakpointHelpers, type BreakpointOptions } from './Breakpoint.js';
import { Inspector } from './Inspector.js';
import { generateId, now, deepClone } from '../utils/helpers.js';

/**
 * Debugger events
 */
export interface DebuggerEvents {
  'session:started': (sessionId: string) => void;
  'session:ended': (sessionId: string, recording: Recording) => void;
  step: (step: ExecutionStep) => void;
  'breakpoint:hit': (breakpoint: Breakpoint, step: ExecutionStep) => void;
  paused: (reason: string) => void;
  resumed: () => void;
  error: (error: Error) => void;
}

/**
 * Agent interface for debugging
 */
export interface DebuggableAgent {
  id: string;
  name: string;
  model: string;
  getState?: () => AgentState;
  onStep?: (callback: (step: ExecutionStep) => void) => void;
}

/**
 * Step builder for creating execution steps
 */
export interface StepBuilder {
  input(data: unknown): ExecutionStep;
  prompt(content: string): ExecutionStep;
  response(content: string, usage?: TokenUsage): ExecutionStep;
  toolCall(tool: ToolCall): ExecutionStep;
  toolResult(tool: ToolCall, success: boolean): ExecutionStep;
  decision(decision: Decision): ExecutionStep;
  error(error: Error): ExecutionStep;
  custom(type: StepType, data: unknown): ExecutionStep;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<DebuggerConfig> = {
  storagePath: './.debug-sessions',
  recording: {
    enabled: true,
    includePrompts: true,
    includeResponses: true,
    includeToolCalls: true,
    includeMemory: true,
    includeMetadata: true,
    compression: false,
    maxSizeBytes: 100 * 1024 * 1024, // 100MB
  },
  maxSteps: 10000,
  autoCheckpoint: false,
  checkpointInterval: 0,
  profiling: false,
};

/**
 * Debugger
 *
 * Main debugger for AI agents.
 *
 * @example
 * ```typescript
 * const debugger = new Debugger({
 *   storagePath: './debug-sessions',
 *   recording: { enabled: true }
 * });
 *
 * // Attach to agent
 * debugger.attach(agent);
 *
 * // Set breakpoints
 * debugger.setBreakpoint({ type: 'tool-call', toolName: 'search' });
 *
 * // Start session
 * const session = await debugger.startSession();
 *
 * // Execute with debugging
 * await agent.execute('Hello');
 * ```
 */
export class Debugger extends EventEmitter<DebuggerEvents> {
  private config: Required<DebuggerConfig>;
  private sessions: Map<string, DebugSessionManager> = new Map();
  private currentSession?: DebugSessionManager;
  private attachedAgent?: DebuggableAgent;
  private stepIndex = 0;
  private globalBreakpoints: BreakpointOptions[] = [];

  constructor(config?: Partial<DebuggerConfig>) {
    super();

    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      recording: {
        ...DEFAULT_CONFIG.recording,
        ...config?.recording,
      },
    };
  }

  /**
   * Attach to an agent
   */
  attach(agent: DebuggableAgent): void {
    this.attachedAgent = agent;

    // Subscribe to agent steps if supported
    if (agent.onStep) {
      agent.onStep((step) => {
        if (this.currentSession) {
          const state = agent.getState?.() ?? this.createDefaultState(agent);
          this.currentSession.addStep(step, state);
        }
      });
    }
  }

  /**
   * Detach from agent
   */
  detach(): void {
    this.attachedAgent = undefined;
  }

  /**
   * Start a debug session
   */
  startSession(options?: Partial<SessionConfig>): DebugSessionManager {
    const agentId = options?.agentId ?? this.attachedAgent?.id ?? 'unknown';

    const session = createDebugSession({
      agentId,
      checkpointInterval: this.config.checkpointInterval,
      maxSteps: this.config.maxSteps,
      ...options,
    });

    // Apply global breakpoints
    for (const bp of this.globalBreakpoints) {
      session.setBreakpoint(bp);
    }

    // Forward session events
    session.on('breakpoint:hit', (bp, step) => {
      this.emit('breakpoint:hit', bp, step);
      this.emit('paused', `Hit breakpoint: ${bp.description ?? bp.type}`);
    });

    session.on('step:executed', (step) => {
      this.emit('step', step);
    });

    session.on('error', (error) => {
      this.emit('error', error);
    });

    session.start();

    this.sessions.set(session.id, session);
    this.currentSession = session;
    this.stepIndex = 0;

    this.emit('session:started', session.id);

    return session;
  }

  /**
   * End the current session
   */
  endSession(): Recording | undefined {
    if (!this.currentSession) {
      return undefined;
    }

    this.currentSession.complete();
    const recording = this.currentSession.toRecording();

    this.emit('session:ended', this.currentSession.id, recording);

    this.currentSession = undefined;

    return recording;
  }

  /**
   * Get the current session
   */
  getSession(): DebugSessionManager | undefined {
    return this.currentSession;
  }

  /**
   * Get a session by ID
   */
  getSessionById(id: string): DebugSessionManager | undefined {
    return this.sessions.get(id);
  }

  /**
   * Set a breakpoint (applies to current and future sessions)
   */
  setBreakpoint(options: BreakpointOptions): Breakpoint | undefined {
    this.globalBreakpoints.push(options);

    if (this.currentSession) {
      return this.currentSession.setBreakpoint(options);
    }

    return undefined;
  }

  /**
   * Remove all global breakpoints
   */
  clearBreakpoints(): void {
    this.globalBreakpoints = [];

    if (this.currentSession) {
      const bps = this.currentSession.getBreakpoints();
      for (const bp of bps) {
        this.currentSession.removeBreakpoint(bp.id);
      }
    }
  }

  /**
   * Continue execution (after breakpoint)
   */
  continue(): void {
    if (this.currentSession) {
      this.currentSession.continue();
      this.emit('resumed');
    }
  }

  /**
   * Step over
   */
  stepOver(): void {
    if (this.currentSession) {
      this.currentSession.stepOver();
    }
  }

  /**
   * Step into
   */
  stepInto(): void {
    if (this.currentSession) {
      this.currentSession.stepInto();
    }
  }

  /**
   * Step out
   */
  stepOut(): void {
    if (this.currentSession) {
      void this.currentSession.stepOut();
    }
  }

  /**
   * Pause execution
   */
  pause(): void {
    if (this.currentSession) {
      this.currentSession.pause();
      this.emit('paused', 'Manual pause');
    }
  }

  /**
   * Stop execution
   */
  stop(): void {
    if (this.currentSession) {
      this.currentSession.stop();
    }
  }

  /**
   * Create a checkpoint
   */
  createCheckpoint(options: {
    name: string;
    description?: string;
  }): Checkpoint | undefined {
    if (this.currentSession) {
      return this.currentSession.createCheckpoint(options);
    }
    return undefined;
  }

  /**
   * List checkpoints
   */
  listCheckpoints(): Checkpoint[] {
    return this.currentSession?.getCheckpoints() ?? [];
  }

  /**
   * Restore from checkpoint
   */
  restoreCheckpoint(id: string): boolean {
    return this.currentSession?.restoreCheckpoint(id) ?? false;
  }

  /**
   * Get an inspector for current state
   */
  inspect(): Inspector | undefined {
    return this.currentSession?.inspect();
  }

  /**
   * Record a step manually
   */
  recordStep(step: Partial<ExecutionStep>, state?: AgentState): boolean {
    if (!this.currentSession) {
      return false;
    }

    const fullStep: ExecutionStep = {
      id: step.id ?? generateId('step'),
      index: step.index ?? this.stepIndex++,
      type: step.type ?? 'custom',
      timestamp: step.timestamp ?? now(),
      durationMs: step.durationMs ?? 0,
      ...step,
    };

    const agentState =
      state ??
      this.attachedAgent?.getState?.() ??
      this.createDefaultState(this.attachedAgent);

    return this.currentSession.addStep(fullStep, agentState);
  }

  /**
   * Get a step builder for creating steps
   */
  steps(): StepBuilder {
    return {
      input: (data: unknown): ExecutionStep => {
        return this.createStep('input', { input: data });
      },

      prompt: (content: string): ExecutionStep => {
        return this.createStep('prompt', { input: content });
      },

      response: (content: string, usage?: TokenUsage): ExecutionStep => {
        return this.createStep('response', {
          output: content,
          tokenUsage: usage,
        });
      },

      toolCall: (tool: ToolCall): ExecutionStep => {
        return this.createStep('tool-call', {
          toolCall: tool,
          input: tool.arguments,
        });
      },

      toolResult: (tool: ToolCall, success: boolean): ExecutionStep => {
        return this.createStep('tool-result', {
          toolCall: { ...tool, success },
          output: tool.result,
        });
      },

      decision: (decision: Decision): ExecutionStep => {
        return this.createStep('decision', {
          decision,
          output: decision.chosen,
        });
      },

      error: (error: Error): ExecutionStep => {
        return this.createStep('error', {
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        });
      },

      custom: (type: StepType, data: unknown): ExecutionStep => {
        return this.createStep(type, data as Record<string, unknown>);
      },
    };
  }

  /**
   * Create a step
   */
  private createStep(
    type: StepType,
    data: Record<string, unknown>,
  ): ExecutionStep {
    return {
      id: generateId('step'),
      index: this.stepIndex++,
      type,
      timestamp: now(),
      durationMs: 0,
      ...data,
    };
  }

  /**
   * Create default agent state
   */
  private createDefaultState(agent?: DebuggableAgent): AgentState {
    return {
      agentId: agent?.id ?? 'unknown',
      agentName: agent?.name ?? 'Unknown Agent',
      model: agent?.model ?? 'unknown',
      memory: { size: 0 },
      context: {},
      tools: [],
      messages: [],
    };
  }

  /**
   * Get configuration
   */
  getConfig(): Readonly<DebuggerConfig> {
    return deepClone(this.config);
  }

  /**
   * Get breakpoint helpers
   */
  static get Breakpoints(): typeof BreakpointHelpers {
    return BreakpointHelpers;
  }
}

/**
 * Create a debugger instance
 */
export function createDebugger(config?: Partial<DebuggerConfig>): Debugger {
  return new Debugger(config);
}
