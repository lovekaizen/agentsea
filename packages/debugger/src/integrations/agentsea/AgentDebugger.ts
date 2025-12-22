/**
 * AgentDebugger
 *
 * High-level debugger wrapper for AgentSea agents.
 */

import { EventEmitter } from 'eventemitter3';
import type {
  Recording,
  Breakpoint,
  Checkpoint,
  ReplaySession,
  FailureAnalysis,
  WhatIfScenario,
  ScenarioResult,
  DecisionTree,
  FlowGraph,
} from '../../types/index.js';
import {
  Debugger,
  type DebuggableAgent,
  type DebuggerEvents,
} from '../../core/Debugger.js';
import { Recorder } from '../../recording/Recorder.js';
import { ReplayEngine } from '../../replay/ReplayEngine.js';
import { FailureAnalyzer } from '../../analysis/FailureAnalyzer.js';
import { WhatIfEngine } from '../../analysis/WhatIfEngine.js';
import { DecisionTreeBuilder } from '../../visualization/DecisionTree.js';
import { FlowGraphBuilder } from '../../visualization/FlowGraph.js';
import { MemoryStorage } from '../../storage/MemoryStorage.js';
import type { RecordingStorageAdapter } from '../../types/recording.types.js';
import { DebugMiddleware, type ExecutionContext } from './DebugMiddleware.js';

/**
 * Agent debugger events
 */
export interface AgentDebuggerEvents extends DebuggerEvents {
  'recording:saved': (recording: Recording) => void;
  'replay:started': (session: ReplaySession) => void;
  'replay:completed': (session: ReplaySession) => void;
  'analysis:completed': (analysis: FailureAnalysis) => void;
}

/**
 * Agent debugger options
 */
export interface AgentDebuggerOptions {
  /** Storage adapter */
  storage?: RecordingStorageAdapter;
  /** Auto-save recordings */
  autoSave?: boolean;
  /** Enable recording */
  recordingEnabled?: boolean;
  /** Enable breakpoints */
  breakpointsEnabled?: boolean;
}

/**
 * AgentDebugger
 *
 * Comprehensive debugger for AgentSea agents.
 *
 * @example
 * ```typescript
 * const debugger = new AgentDebugger({
 *   storage: new FileStorage({ basePath: './debug' }),
 *   autoSave: true,
 * });
 *
 * // Attach to agent
 * debugger.attach(agent);
 *
 * // Set breakpoints
 * debugger.breakOnTool('search');
 * debugger.breakOnError();
 *
 * // Run agent
 * await agent.execute('Search for news');
 *
 * // Get recording
 * const recording = await debugger.getRecording();
 *
 * // Analyze failures
 * if (recording.status === 'failed') {
 *   const analysis = debugger.analyzeFailure(recording);
 *   console.log(analysis.recommendations);
 * }
 *
 * // Replay with modifications
 * const result = await debugger.replay(recording, {
 *   modifications: [{ stepIndex: 5, type: 'modify', data: { output: 'new result' } }]
 * });
 * ```
 */
export class AgentDebugger extends EventEmitter<AgentDebuggerEvents> {
  private debugger: Debugger;
  private recorder: Recorder;
  private replayEngine: ReplayEngine;
  private failureAnalyzer: FailureAnalyzer;
  private whatIfEngine: WhatIfEngine;
  private middleware: DebugMiddleware;
  private storage: RecordingStorageAdapter;
  private options: Required<AgentDebuggerOptions>;
  private recordings: Map<string, Recording> = new Map();
  private currentRecording?: Recording;

  constructor(options?: AgentDebuggerOptions) {
    super();

    this.options = {
      storage: options?.storage ?? new MemoryStorage(),
      autoSave: options?.autoSave ?? true,
      recordingEnabled: options?.recordingEnabled ?? true,
      breakpointsEnabled: options?.breakpointsEnabled ?? true,
    };

    this.storage = this.options.storage;
    this.debugger = new Debugger();
    this.recorder = new Recorder();
    this.replayEngine = new ReplayEngine();
    this.failureAnalyzer = new FailureAnalyzer();
    this.whatIfEngine = new WhatIfEngine();

    // Create middleware with our instances
    this.middleware = new DebugMiddleware({
      debugger: this.debugger,
      recorder: this.recorder,
      enabled: true,
      recordEnabled: this.options.recordingEnabled,
    });

    this.setupEventForwarding();
  }

  /**
   * Setup event forwarding from components
   */
  private setupEventForwarding(): void {
    // Forward debugger events
    this.debugger.on('session:started', (id) =>
      this.emit('session:started', id),
    );
    this.debugger.on('session:ended', (id, recording) => {
      this.emit('session:ended', id, recording);
      void this.handleRecordingComplete(recording);
    });
    this.debugger.on('step', (step) => this.emit('step', step));
    this.debugger.on('breakpoint:hit', (bp, step) =>
      this.emit('breakpoint:hit', bp, step),
    );
    this.debugger.on('paused', (reason) => this.emit('paused', reason));
    this.debugger.on('resumed', () => this.emit('resumed'));
    this.debugger.on('error', (error) => this.emit('error', error));

    // Forward replay events
    this.replayEngine.on('replay:started', (session) =>
      this.emit('replay:started', session),
    );
    this.replayEngine.on('replay:completed', () => {
      const session = this.replayEngine.getSession();
      if (session) {
        this.emit('replay:completed', session);
      }
    });
  }

  /**
   * Handle recording completion
   */
  private async handleRecordingComplete(recording: Recording): Promise<void> {
    this.currentRecording = recording;
    this.recordings.set(recording.id, recording);

    if (this.options.autoSave) {
      await this.storage.save(recording);
      this.emit('recording:saved', recording);
    }
  }

  /**
   * Attach to an agent
   */
  attach(agent: DebuggableAgent): void {
    this.debugger.attach(agent);
  }

  /**
   * Detach from agent
   */
  detach(): void {
    this.debugger.detach();
  }

  /**
   * Get the middleware for agent integration
   */
  getMiddleware(): DebugMiddleware {
    return this.middleware;
  }

  /**
   * Start a debug session
   */
  startSession(context: ExecutionContext): void {
    this.middleware.startSession(context);
  }

  /**
   * End the debug session
   */
  endSession(): Recording | undefined {
    this.middleware.endSession();
    return this.currentRecording;
  }

  // ============ Breakpoint Methods ============

  /**
   * Set a breakpoint on tool calls
   */
  breakOnTool(toolName?: string): Breakpoint | undefined {
    if (!this.options.breakpointsEnabled) return undefined;

    return this.debugger.setBreakpoint({
      type: 'tool-call',
      toolName,
      description: toolName ? `Break on ${toolName}` : 'Break on any tool call',
    });
  }

  /**
   * Set a breakpoint on errors
   */
  breakOnError(): Breakpoint | undefined {
    if (!this.options.breakpointsEnabled) return undefined;

    return this.debugger.setBreakpoint({
      type: 'error',
      description: 'Break on error',
    });
  }

  /**
   * Set a breakpoint on decisions
   */
  breakOnDecision(): Breakpoint | undefined {
    if (!this.options.breakpointsEnabled) return undefined;

    return this.debugger.setBreakpoint({
      type: 'decision',
      description: 'Break on decision',
    });
  }

  /**
   * Set a breakpoint at a specific step
   */
  breakAtStep(step: number): Breakpoint | undefined {
    if (!this.options.breakpointsEnabled) return undefined;

    return this.debugger.setBreakpoint({
      type: 'step',
      step,
      description: `Break at step ${step}`,
    });
  }

  /**
   * Set a custom breakpoint
   */
  setBreakpoint(
    options: Parameters<Debugger['setBreakpoint']>[0],
  ): Breakpoint | undefined {
    if (!this.options.breakpointsEnabled) return undefined;
    return this.debugger.setBreakpoint(options);
  }

  /**
   * Clear all breakpoints
   */
  clearBreakpoints(): void {
    this.debugger.clearBreakpoints();
  }

  // ============ Execution Control ============

  /**
   * Continue execution
   */
  continue(): void {
    this.debugger.continue();
  }

  /**
   * Step over
   */
  stepOver(): void {
    this.debugger.stepOver();
  }

  /**
   * Step into
   */
  stepInto(): void {
    this.debugger.stepInto();
  }

  /**
   * Step out
   */
  stepOut(): void {
    this.debugger.stepOut();
  }

  /**
   * Pause execution
   */
  pause(): void {
    this.debugger.pause();
  }

  /**
   * Stop execution
   */
  stop(): void {
    this.debugger.stop();
  }

  // ============ Checkpoints ============

  /**
   * Create a checkpoint
   */
  createCheckpoint(name: string, description?: string): Checkpoint | undefined {
    return this.debugger.createCheckpoint({ name, description });
  }

  /**
   * List checkpoints
   */
  listCheckpoints(): Checkpoint[] {
    return this.debugger.listCheckpoints();
  }

  /**
   * Restore from checkpoint
   */
  restoreCheckpoint(id: string): boolean {
    return this.debugger.restoreCheckpoint(id);
  }

  // ============ Recording & Replay ============

  /**
   * Get current recording
   */
  getRecording(): Recording | undefined {
    return this.currentRecording;
  }

  /**
   * Load a recording
   */
  async loadRecording(id: string): Promise<Recording | undefined> {
    const result = await this.storage.load(id);
    return result ?? undefined;
  }

  /**
   * List recordings
   */
  async listRecordings(): Promise<
    Array<{
      id: string;
      agentId: string;
      agentName: string;
      status: string;
      startedAt: number;
    }>
  > {
    const result = await this.storage.list();
    // Handle different return types from storage adapters
    if (Array.isArray(result)) {
      return result as Array<{
        id: string;
        agentId: string;
        agentName: string;
        status: string;
        startedAt: number;
      }>;
    }
    // RecordingListResult type
    return (result as { recordings: unknown[] }).recordings as Array<{
      id: string;
      agentId: string;
      agentName: string;
      status: string;
      startedAt: number;
    }>;
  }

  /**
   * Replay a recording
   */
  replay(
    recording: Recording,
    options?: Parameters<ReplayEngine['start']>[1],
  ): ReplaySession {
    return this.replayEngine.start(recording, options);
  }

  /**
   * Get replay engine
   */
  getReplayEngine(): ReplayEngine {
    return this.replayEngine;
  }

  // ============ Analysis ============

  /**
   * Analyze a failed recording
   */
  analyzeFailure(recording: Recording): FailureAnalysis {
    const analysis = this.failureAnalyzer.analyze(recording);
    this.emit('analysis:completed', analysis);
    return analysis;
  }

  /**
   * Get failure analyzer
   */
  getFailureAnalyzer(): FailureAnalyzer {
    return this.failureAnalyzer;
  }

  // ============ What-If Scenarios ============

  /**
   * Create a what-if scenario
   */
  createWhatIfScenario(
    recording: Recording,
    modifications: WhatIfScenario['modifications'],
    name?: string,
  ): WhatIfScenario {
    return this.whatIfEngine.createScenario({
      name: name ?? 'What-if scenario',
      recordingId: recording.id,
      modifications,
    });
  }

  /**
   * Run a what-if scenario
   */
  async runWhatIfScenario(
    scenarioId: string,
    recording: Recording,
  ): Promise<ScenarioResult> {
    return this.whatIfEngine.runScenario(scenarioId, recording);
  }

  /**
   * Get what-if engine
   */
  getWhatIfEngine(): WhatIfEngine {
    return this.whatIfEngine;
  }

  // ============ Visualization ============

  /**
   * Build decision tree from recording
   */
  buildDecisionTree(recording: Recording): DecisionTree {
    const builder = new DecisionTreeBuilder();
    return builder.build(recording);
  }

  /**
   * Build flow graph from recording
   */
  buildFlowGraph(recording: Recording): FlowGraph {
    const builder = new FlowGraphBuilder();
    return builder.build(recording);
  }

  // ============ Inspection ============

  /**
   * Inspect current state
   */
  inspect() {
    return this.debugger.inspect();
  }

  /**
   * Get underlying debugger
   */
  getDebugger(): Debugger {
    return this.debugger;
  }

  /**
   * Get storage
   */
  getStorage(): RecordingStorageAdapter {
    return this.storage;
  }
}

/**
 * Create an agent debugger
 */
export function createAgentDebugger(
  options?: AgentDebuggerOptions,
): AgentDebugger {
  return new AgentDebugger(options);
}
