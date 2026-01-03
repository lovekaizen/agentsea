/**
 * StateRestorer
 *
 * Restores agent state from recordings and checkpoints.
 */

import type {
  Recording,
  ExecutionStep,
  AgentState,
  Checkpoint,
} from '../types/index.js';
import { deepClone } from '../utils/helpers.js';
import { applyPatches, type Difference } from '../utils/diff.js';

/**
 * State restoration options
 */
export interface RestoreOptions {
  /** Include memory state */
  includeMemory?: boolean;
  /** Include context state */
  includeContext?: boolean;
  /** Include message history */
  includeMessages?: boolean;
  /** Include tool states */
  includeTools?: boolean;
}

/**
 * State validation result
 */
export interface StateValidation {
  /** Whether state is valid */
  valid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
}

/**
 * Default options
 */
const DEFAULT_OPTIONS: Required<RestoreOptions> = {
  includeMemory: true,
  includeContext: true,
  includeMessages: true,
  includeTools: true,
};

/**
 * StateRestorer
 *
 * Restores agent state from recordings and checkpoints.
 *
 * @example
 * ```typescript
 * const restorer = new StateRestorer();
 *
 * // Restore state at a specific step
 * const state = restorer.restore(recording, 10);
 *
 * // Restore from checkpoint
 * const state = restorer.restoreFromCheckpoint(checkpoint);
 *
 * // Validate restored state
 * const validation = restorer.validate(state);
 * ```
 */
export class StateRestorer {
  private options: Required<RestoreOptions>;
  private stateCache: Map<string, Map<number, AgentState>> = new Map();

  constructor(options?: RestoreOptions) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };
  }

  /**
   * Restore state at a specific step
   */
  restore(recording: Recording, stepIndex: number): AgentState {
    // Check cache
    const cacheKey = recording.id;
    const recordingCache = this.stateCache.get(cacheKey);
    if (recordingCache?.has(stepIndex)) {
      return deepClone(recordingCache.get(stepIndex)!);
    }

    // Handle initial state case (stepIndex -1 or before any steps)
    if (stepIndex < 0) {
      const state = deepClone(recording.initialState);
      if (!recordingCache) {
        this.stateCache.set(cacheKey, new Map());
      }
      this.stateCache.get(cacheKey)!.set(stepIndex, deepClone(state));
      return state;
    }

    // Start from initial state or closest checkpoint
    let state: AgentState;
    let startStep: number;

    const checkpoint = this.findClosestCheckpoint(recording, stepIndex);
    if (checkpoint) {
      if (checkpoint.stepIndex === stepIndex) {
        // Checkpoint is exactly at target step
        // But we still need to rebuild from beginning as checkpoint may not have complete state
        state = deepClone(recording.initialState);
        startStep = 0;
      } else {
        // Checkpoint before target - apply steps from beginning to checkpoint, then from checkpoint to target
        state = deepClone(recording.initialState);
        startStep = 0;
      }
    } else {
      // No checkpoint, start from initial state
      state = deepClone(recording.initialState);
      startStep = 0;
    }

    // Apply steps to reach target (inclusive of stepIndex)
    for (let i = startStep; i <= stepIndex && i < recording.steps.length; i++) {
      state = this.applyStep(state, recording.steps[i]);
    }

    // Cache result
    if (!recordingCache) {
      this.stateCache.set(cacheKey, new Map());
    }
    this.stateCache.get(cacheKey)!.set(stepIndex, deepClone(state));

    return state;
  }

  /**
   * Restore state from a checkpoint
   */
  restoreFromCheckpoint(checkpoint: Checkpoint): AgentState {
    return deepClone(checkpoint.state);
  }

  /**
   * Apply a step to state
   */
  applyStep(state: AgentState, step: ExecutionStep): AgentState {
    const newState = deepClone(state);

    // Apply based on step type
    switch (step.type) {
      case 'input':
        if (this.options.includeMessages) {
          newState.messages.push({
            role: 'user',
            content: String(step.input),
          });
        }
        break;

      case 'prompt':
        // Prompt is the system message or augmented user message
        // Usually doesn't change visible state
        break;

      case 'response':
        if (this.options.includeMessages) {
          newState.messages.push({
            role: 'assistant',
            content: String(step.output),
          });
        }
        break;

      case 'tool-call':
        if (this.options.includeMessages && step.toolCall) {
          // Add tool call as assistant message
          newState.messages.push({
            role: 'assistant',
            content: `[Calling tool: ${step.toolCall.name}]`,
            toolCalls: [
              {
                id: step.toolCall.id,
                name: step.toolCall.name,
                arguments: step.toolCall.arguments,
              },
            ],
          });
        }
        break;

      case 'tool-result':
        if (this.options.includeMessages && step.toolCall) {
          newState.messages.push({
            role: 'tool',
            content: String(step.toolCall.result ?? ''),
            toolCallId: step.toolCall.id,
          });
        }
        break;

      case 'memory-write':
        if (this.options.includeMemory && step.output) {
          this.applyMemoryChange(
            newState,
            step.output as Record<string, unknown>,
          );
        }
        break;

      case 'memory-read':
        // Read doesn't change state
        break;

      case 'decision':
        // Decision might update context
        if (this.options.includeContext && step.decision) {
          newState.context['lastDecision'] = {
            options: step.decision.options.map((o) => o.description),
            chosen: step.decision.chosen.description,
            confidence: step.decision.confidence,
          };
        }
        break;

      case 'handoff':
      case 'delegation':
        // Agent handoff might update context
        if (this.options.includeContext && step.output) {
          const output = step.output as {
            agentId?: string;
            agentName?: string;
          };
          newState.context['delegatedTo'] = output.agentId ?? output.agentName;
        }
        break;

      case 'error':
        // Error state
        newState.context['lastError'] = step.error;
        break;
    }

    return newState;
  }

  /**
   * Apply memory changes to state
   */
  private applyMemoryChange(
    state: AgentState,
    changes: Record<string, unknown>,
  ): void {
    for (const [key, value] of Object.entries(changes)) {
      if (key === 'working') {
        state.memory.working = {
          ...state.memory.working,
          ...(value as Record<string, unknown>),
        };
      } else if (key === 'shortTerm' && Array.isArray(value)) {
        state.memory.shortTerm = [...(state.memory.shortTerm ?? []), ...value];
      } else if (key === 'longTermSummary' && typeof value === 'string') {
        state.memory.longTermSummary = value;
      } else if (key === 'size' && typeof value === 'number') {
        state.memory.size = value;
      }
    }
  }

  /**
   * Find closest checkpoint before or at step
   */
  private findClosestCheckpoint(
    recording: Recording,
    stepIndex: number,
  ): Checkpoint | undefined {
    let closest: Checkpoint | undefined;

    for (const checkpoint of recording.checkpoints) {
      if (checkpoint.stepIndex <= stepIndex) {
        if (!closest || checkpoint.stepIndex > closest.stepIndex) {
          closest = checkpoint;
        }
      }
    }

    return closest;
  }

  /**
   * Apply a diff patch to state
   */
  applyPatch(state: AgentState, differences: Difference[]): AgentState {
    return applyPatches(state, differences);
  }

  /**
   * Validate restored state
   */
  validate(state: AgentState): StateValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!state.agentId) {
      errors.push('Missing agentId');
    }

    if (!state.agentName) {
      warnings.push('Missing agentName');
    }

    if (!state.model) {
      warnings.push('Missing model');
    }

    // Memory validation
    if (!state.memory) {
      errors.push('Missing memory object');
    } else {
      if (typeof state.memory.size !== 'number') {
        warnings.push('Memory size should be a number');
      }
    }

    // Messages validation
    if (!Array.isArray(state.messages)) {
      errors.push('Messages should be an array');
    } else {
      for (let i = 0; i < state.messages.length; i++) {
        const msg = state.messages[i];
        if (!msg.role) {
          errors.push(`Message ${i} missing role`);
        }
        if (msg.content === undefined && !msg.toolCalls) {
          warnings.push(`Message ${i} has no content or tool calls`);
        }
        // Warn about empty content
        if (typeof msg.content === 'string' && msg.content.trim() === '') {
          warnings.push(`Message ${i} has empty content`);
        }
      }
    }

    // Context validation
    if (!state.context || typeof state.context !== 'object') {
      warnings.push('Context should be an object');
    }

    // Tools validation
    if (!Array.isArray(state.tools)) {
      warnings.push('Tools should be an array');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Merge two states
   */
  merge(base: AgentState, overlay: Partial<AgentState>): AgentState {
    const merged = deepClone(base);

    if (overlay.agentId) {
      merged.agentId = overlay.agentId;
    }

    if (overlay.agentName) {
      merged.agentName = overlay.agentName;
    }

    if (overlay.model) {
      merged.model = overlay.model;
    }

    if (overlay.memory) {
      merged.memory = {
        ...merged.memory,
        ...overlay.memory,
      };
    }

    if (overlay.context) {
      merged.context = {
        ...merged.context,
        ...overlay.context,
      };
    }

    if (overlay.tools) {
      merged.tools = [...overlay.tools];
    }

    if (overlay.messages) {
      merged.messages = [...overlay.messages];
    }

    return merged;
  }

  /**
   * Create a minimal state
   */
  createMinimalState(
    agentId: string,
    agentName: string,
    model: string,
  ): AgentState {
    return {
      agentId,
      agentName,
      model,
      memory: {
        size: 0,
      },
      context: {},
      tools: [],
      messages: [],
    };
  }

  /**
   * Clear state cache
   */
  clearCache(): void {
    this.stateCache.clear();
  }

  /**
   * Clear cache for specific recording
   */
  clearRecordingCache(recordingId: string): void {
    this.stateCache.delete(recordingId);
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    let size = 0;
    for (const cache of this.stateCache.values()) {
      size += cache.size;
    }
    return size;
  }
}

/**
 * Create a state restorer
 */
export function createStateRestorer(options?: RestoreOptions): StateRestorer {
  return new StateRestorer(options);
}
