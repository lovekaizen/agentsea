/**
 * Core Exports
 */

export {
  Debugger,
  createDebugger,
  type DebuggerEvents,
  type DebuggableAgent,
  type StepBuilder,
} from './Debugger.js';

export {
  DebugSessionManager,
  createDebugSession,
  type SessionEvents,
  type SessionConfig,
} from './Session.js';

export {
  BreakpointManager,
  createBreakpointManager,
  BreakpointHelpers,
  type BreakpointManagerEvents,
  type BreakpointOptions,
} from './Breakpoint.js';

export {
  Inspector,
  createInspector,
  type InspectorConfig,
  type VariableWatch,
} from './Inspector.js';
