/**
 * Replay Types
 *
 * Type definitions for replay engine.
 */

import type { Checkpoint } from './recording.types.js';
import type { AgentState } from './debugger.types.js';

/**
 * Replay state
 */
export type ReplayState =
  | 'idle'
  | 'playing'
  | 'paused'
  | 'stopped'
  | 'completed';

/**
 * Replay speed
 */
export type ReplaySpeed = 'slow' | 'normal' | 'fast' | 'instant';

/**
 * Replay session
 */
export interface ReplaySession {
  /** Session ID */
  id: string;
  /** Recording ID being replayed */
  recordingId: string;
  /** Current state */
  state: ReplayState;
  /** Current step index */
  currentStep: number;
  /** Total steps */
  totalSteps: number;
  /** Playback speed */
  speed: ReplaySpeed;
  /** Started at */
  startedAt: number;
  /** Completed at */
  completedAt?: number;
  /** Modifications applied */
  modifications: ReplayModification[];
  /** Differences detected */
  differences: ReplayDifference[];
}

/**
 * Replay configuration
 */
export interface ReplayConfig {
  /** Speed multiplier */
  speedMultiplier: number;
  /** Pause on decisions */
  pauseOnDecisions: boolean;
  /** Pause on errors */
  pauseOnErrors: boolean;
  /** Pause on tool calls */
  pauseOnToolCalls: boolean;
  /** Execute tools during replay */
  executeTools: boolean;
  /** Execute LLM calls during replay */
  executeLLM: boolean;
  /** Compare results */
  compareResults: boolean;
  /** Track differences */
  trackDifferences: boolean;
}

/**
 * Replay modification
 */
export interface ReplayModification {
  /** Step to modify */
  stepIndex: number;
  /** Type of modification */
  type: ReplayModificationType;
  /** Modified data */
  data?: Record<string, unknown>;
}

/**
 * Replay modification type
 */
export type ReplayModificationType = 'skip' | 'modify' | 'insert' | 'replace';

/**
 * Replay result
 */
export interface ReplayResult {
  /** Session ID */
  sessionId: string;
  /** Recording ID */
  recordingId: string;
  /** Completed successfully */
  success: boolean;
  /** Steps replayed */
  stepsReplayed: number;
  /** Differences from original */
  differences: ReplayDifference[];
  /** Final state */
  finalState: AgentState;
  /** Started at */
  startedAt: number;
  /** Completed at */
  completedAt: number;
  /** Total duration */
  durationMs: number;
}

/**
 * Replay difference from original
 */
export interface ReplayDifference {
  /** Step index */
  stepIndex: number;
  /** Field path that differs */
  path: string;
  /** Original value */
  original: unknown;
  /** Replay value */
  replayed: unknown;
  /** Difference type */
  type: 'added' | 'removed' | 'changed';
}

/**
 * Replay comparison
 */
export interface ReplayComparison {
  /** Original outcome */
  original: unknown;
  /** Modified outcome */
  modified: unknown;
  /** Are outcomes identical */
  identical: boolean;
  /** Differences */
  differences: ReplayDifference[];
  /** Cost difference */
  costDelta?: number;
  /** Token difference */
  tokenDelta?: number;
  /** Quality score difference */
  qualityDelta?: number;
  /** Duration difference */
  durationDelta: number;
}

/**
 * State restore options
 */
export interface StateRestoreOptions {
  /** Checkpoint to restore from */
  checkpoint?: Checkpoint;
  /** Step index to restore to */
  stepIndex?: number;
  /** Include memory */
  includeMemory?: boolean;
  /** Include context */
  includeContext?: boolean;
  /** Validate state after restore */
  validate?: boolean;
}

/**
 * State restore result
 */
export interface StateRestoreResult {
  /** Success */
  success: boolean;
  /** Restored state */
  state: AgentState;
  /** Step index */
  stepIndex: number;
  /** Checkpoint used */
  checkpoint?: string;
  /** Validation errors */
  validationErrors?: string[];
}
