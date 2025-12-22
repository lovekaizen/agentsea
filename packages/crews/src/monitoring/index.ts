/**
 * Monitoring Module
 *
 * Dashboard and debugging capabilities for crews.
 */

// Dashboard
export {
  CrewDashboard,
  createDashboard,
  type DashboardConfig,
  type DashboardUpdate,
  type DashboardSnapshot,
  type AgentStatus,
} from './CrewDashboard';

// Debug mode
export {
  DebugMode,
  createDebugMode,
  type DebugModeConfig,
  type Breakpoint,
  type BreakpointType,
  type DebugContext,
  type AgentInspection,
  type StepResult,
} from './DebugMode';
