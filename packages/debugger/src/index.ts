/**
 * @lov3kaizen/agentsea-debugger
 *
 * AI Agent debugger with step-through execution, decision tree visualization,
 * checkpoint replay, and what-if scenario testing.
 *
 * @example
 * ```typescript
 * import {
 *   Debugger,
 *   Recorder,
 *   ReplayEngine,
 *   FailureAnalyzer,
 *   AgentDebugger,
 * } from '@lov3kaizen/agentsea-debugger';
 *
 * // Create debugger
 * const debugger = new Debugger();
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
 * // Execute agent
 * await agent.execute('Hello');
 *
 * // Get recording
 * const recording = await debugger.endSession();
 *
 * // Analyze failures
 * const analyzer = new FailureAnalyzer();
 * const analysis = analyzer.analyze(recording);
 *
 * // Replay with modifications
 * const replay = new ReplayEngine();
 * const result = await replay.start(recording, {
 *   modifications: [{ stepIndex: 5, type: 'modify', data: { output: 'new result' } }]
 * });
 * ```
 *
 * @packageDocumentation
 */

// Types
export * from './types/index.js';

// Core
export {
  Debugger,
  createDebugger,
  type DebuggerEvents,
  type DebuggableAgent,
  type StepBuilder,
} from './core/Debugger.js';

export {
  DebugSessionManager,
  createDebugSession,
  type SessionEvents,
  type SessionConfig,
} from './core/Session.js';

export {
  BreakpointManager,
  createBreakpointManager,
  BreakpointHelpers,
  type BreakpointManagerEvents,
  type BreakpointOptions,
} from './core/Breakpoint.js';

export {
  Inspector,
  createInspector,
  type InspectorConfig,
  type VariableWatch,
} from './core/Inspector.js';

// Recording
export {
  Recorder,
  createRecorder,
  type RecorderEvents,
} from './recording/Recorder.js';

export {
  SnapshotManager,
  createSnapshotManager,
  type SnapshotOptions,
  type IncrementalSnapshot,
} from './recording/Snapshot.js';

export {
  CheckpointManager,
  createCheckpointManager,
  type CheckpointCreateOptions,
  type CheckpointFilterOptions,
} from './recording/Checkpoint.js';

export {
  Timeline,
  createTimeline,
  type TimelineEventOptions,
  type TimelineMarker,
  type TimelineSegment,
  type TimelineFilterOptions,
  type TimelineStats,
} from './recording/Timeline.js';

// Replay
export {
  ReplayEngine,
  createReplayEngine,
  type ReplayEngineEvents,
  type ReplayOptions,
} from './replay/ReplayEngine.js';

export {
  ReplayController,
  createReplayController,
  type ReplayControllerEvents,
  type PlaybackState,
} from './replay/ReplayController.js';

export {
  StateRestorer,
  createStateRestorer,
  type RestoreOptions,
  type StateValidation,
} from './replay/StateRestorer.js';

// Visualization
export {
  DecisionTreeBuilder,
  createDecisionTreeBuilder,
  type NodeOptions,
  type TreeBuildOptions,
  type LayoutOptions,
} from './visualization/DecisionTree.js';

export {
  FlowGraphBuilder,
  createFlowGraphBuilder,
  type NodeStyle,
  type EdgeStyle,
  type GraphBuildOptions,
} from './visualization/FlowGraph.js';

// Analysis
export {
  WhatIfEngine,
  createWhatIfEngine,
  type WhatIfEngineEvents,
  type ScenarioOptions,
  type BatchScenarioOptions,
} from './analysis/WhatIfEngine.js';

export {
  FailureAnalyzer,
  createFailureAnalyzer,
  type AnalysisOptions,
  type FailurePattern,
  type StepAnalysis,
} from './analysis/FailureAnalyzer.js';

// Storage
export {
  FileStorage,
  createFileStorage,
  type FileSystem,
  type FileStorageOptions,
  type RecordingMeta,
} from './storage/FileStorage.js';

export {
  MemoryStorage,
  createMemoryStorage,
  type MemoryStorageOptions,
} from './storage/MemoryStorage.js';

// Integrations
export {
  DebugMiddleware,
  createDebugMiddleware,
  type DebugMiddlewareOptions,
  type AgentMessage,
  type ExecutionContext,
} from './integrations/agentsea/DebugMiddleware.js';

export {
  AgentDebugger,
  createAgentDebugger,
  type AgentDebuggerEvents,
  type AgentDebuggerOptions,
} from './integrations/agentsea/AgentDebugger.js';

// Utilities
export {
  generateId,
  now,
  duration,
  deepClone,
  safeStringify,
  safeParse,
  formatDuration,
  formatBytes,
  truncate,
  debounce,
  sleep,
  retry,
  estimateSize,
} from './utils/helpers.js';

export {
  diff,
  toReplayDifferences,
  applyPatch,
  summarizeDiff,
  isEqual,
  getAtPath,
  setAtPath,
  type Difference,
} from './utils/diff.js';
