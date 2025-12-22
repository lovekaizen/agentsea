/**
 * Breakpoint
 *
 * Breakpoint management for the debugger.
 */

import { EventEmitter } from 'eventemitter3';
import type {
  Breakpoint,
  BreakpointType,
  BreakpointCondition,
  BreakpointContext,
  ExecutionStep,
  AgentState,
} from '../types/index.js';
import { generateId } from '../utils/helpers.js';

/**
 * Breakpoint manager events
 */
export interface BreakpointManagerEvents {
  'breakpoint:added': (breakpoint: Breakpoint) => void;
  'breakpoint:removed': (breakpointId: string) => void;
  'breakpoint:hit': (
    breakpoint: Breakpoint,
    context: BreakpointContext,
  ) => void;
  'breakpoint:toggled': (breakpoint: Breakpoint) => void;
}

/**
 * Breakpoint creation options
 */
export interface BreakpointOptions {
  /** Breakpoint type */
  type: BreakpointType;
  /** Condition function */
  condition?: BreakpointCondition;
  /** Step number (for step breakpoints) */
  step?: number;
  /** Tool name (for tool breakpoints) */
  toolName?: string;
  /** Description */
  description?: string;
  /** Initially enabled */
  enabled?: boolean;
}

/**
 * BreakpointManager
 *
 * Manages breakpoints for debug sessions.
 *
 * @example
 * ```typescript
 * const manager = new BreakpointManager();
 *
 * // Add a tool call breakpoint
 * manager.add({
 *   type: 'tool-call',
 *   toolName: 'database_query',
 *   description: 'Break on database queries'
 * });
 *
 * // Check if a step should trigger a breakpoint
 * const hit = manager.check(step, state);
 * if (hit) {
 *   console.log('Breakpoint hit:', hit.description);
 * }
 * ```
 */
export class BreakpointManager extends EventEmitter<BreakpointManagerEvents> {
  private breakpoints: Map<string, Breakpoint> = new Map();

  /**
   * Add a new breakpoint
   */
  add(options: BreakpointOptions): Breakpoint {
    const breakpoint: Breakpoint = {
      id: generateId('bp'),
      type: options.type,
      condition: options.condition,
      step: options.step,
      toolName: options.toolName,
      enabled: options.enabled ?? true,
      hitCount: 0,
      description: options.description,
    };

    this.breakpoints.set(breakpoint.id, breakpoint);
    this.emit('breakpoint:added', breakpoint);

    return breakpoint;
  }

  /**
   * Remove a breakpoint
   */
  remove(id: string): boolean {
    const existed = this.breakpoints.delete(id);
    if (existed) {
      this.emit('breakpoint:removed', id);
    }
    return existed;
  }

  /**
   * Get a breakpoint by ID
   */
  get(id: string): Breakpoint | undefined {
    return this.breakpoints.get(id);
  }

  /**
   * Get all breakpoints
   */
  getAll(): Breakpoint[] {
    return Array.from(this.breakpoints.values());
  }

  /**
   * Get enabled breakpoints
   */
  getEnabled(): Breakpoint[] {
    return this.getAll().filter((bp) => bp.enabled);
  }

  /**
   * Toggle breakpoint enabled state
   */
  toggle(id: string): boolean {
    const breakpoint = this.breakpoints.get(id);
    if (breakpoint) {
      breakpoint.enabled = !breakpoint.enabled;
      this.emit('breakpoint:toggled', breakpoint);
      return true;
    }
    return false;
  }

  /**
   * Enable a breakpoint
   */
  enable(id: string): boolean {
    const breakpoint = this.breakpoints.get(id);
    if (breakpoint && !breakpoint.enabled) {
      breakpoint.enabled = true;
      this.emit('breakpoint:toggled', breakpoint);
      return true;
    }
    return false;
  }

  /**
   * Disable a breakpoint
   */
  disable(id: string): boolean {
    const breakpoint = this.breakpoints.get(id);
    if (breakpoint && breakpoint.enabled) {
      breakpoint.enabled = false;
      this.emit('breakpoint:toggled', breakpoint);
      return true;
    }
    return false;
  }

  /**
   * Clear all breakpoints
   */
  clear(): void {
    const ids = Array.from(this.breakpoints.keys());
    this.breakpoints.clear();
    for (const id of ids) {
      this.emit('breakpoint:removed', id);
    }
  }

  /**
   * Check if any breakpoint should trigger for a step
   */
  check(step: ExecutionStep, state: AgentState): Breakpoint | null {
    for (const breakpoint of this.getEnabled()) {
      if (this.shouldTrigger(breakpoint, step, state)) {
        breakpoint.hitCount++;
        const context = this.buildContext(step, state);
        this.emit('breakpoint:hit', breakpoint, context);
        return breakpoint;
      }
    }
    return null;
  }

  /**
   * Check if a specific breakpoint should trigger
   */
  private shouldTrigger(
    breakpoint: Breakpoint,
    step: ExecutionStep,
    state: AgentState,
  ): boolean {
    // Type-based checks
    switch (breakpoint.type) {
      case 'step':
        if (breakpoint.step !== undefined && step.index !== breakpoint.step) {
          return false;
        }
        break;

      case 'tool-call':
        if (step.type !== 'tool-call') {
          return false;
        }
        if (
          breakpoint.toolName &&
          step.toolCall?.name !== breakpoint.toolName
        ) {
          return false;
        }
        break;

      case 'tool-result':
        if (step.type !== 'tool-result') {
          return false;
        }
        if (
          breakpoint.toolName &&
          step.toolCall?.name !== breakpoint.toolName
        ) {
          return false;
        }
        break;

      case 'decision':
        if (step.type !== 'decision') {
          return false;
        }
        break;

      case 'error':
        if (!step.error) {
          return false;
        }
        break;

      case 'memory-change':
        if (step.type !== 'memory-write') {
          return false;
        }
        break;
    }

    // Custom condition check
    if (breakpoint.condition) {
      const context = this.buildContext(step, state);
      try {
        return breakpoint.condition(context);
      } catch {
        return false;
      }
    }

    return true;
  }

  /**
   * Build context for condition evaluation
   */
  private buildContext(
    step: ExecutionStep,
    state: AgentState,
  ): BreakpointContext {
    return {
      step,
      stepIndex: step.index,
      state,
      toolCall: step.toolCall,
      decision: step.decision,
    };
  }

  /**
   * Get breakpoint count
   */
  get count(): number {
    return this.breakpoints.size;
  }

  /**
   * Get enabled breakpoint count
   */
  get enabledCount(): number {
    return this.getEnabled().length;
  }
}

/**
 * Create a breakpoint manager instance
 */
export function createBreakpointManager(): BreakpointManager {
  return new BreakpointManager();
}

/**
 * Helper to create common breakpoints
 */
export const BreakpointHelpers = {
  /**
   * Break at a specific step
   */
  atStep(step: number, description?: string): BreakpointOptions {
    return {
      type: 'step',
      step,
      description: description ?? `Break at step ${step}`,
    };
  },

  /**
   * Break on any tool call
   */
  onToolCall(description?: string): BreakpointOptions {
    return {
      type: 'tool-call',
      description: description ?? 'Break on tool call',
    };
  },

  /**
   * Break on specific tool call
   */
  onTool(toolName: string, description?: string): BreakpointOptions {
    return {
      type: 'tool-call',
      toolName,
      description: description ?? `Break on ${toolName}`,
    };
  },

  /**
   * Break on any error
   */
  onError(description?: string): BreakpointOptions {
    return {
      type: 'error',
      description: description ?? 'Break on error',
    };
  },

  /**
   * Break on decision
   */
  onDecision(condition?: BreakpointCondition): BreakpointOptions {
    return {
      type: 'decision',
      condition,
      description: 'Break on decision',
    };
  },

  /**
   * Break on low confidence decision
   */
  onLowConfidence(threshold = 0.7): BreakpointOptions {
    return {
      type: 'decision',
      condition: (ctx) => (ctx.decision?.confidence ?? 1) < threshold,
      description: `Break on confidence < ${threshold}`,
    };
  },

  /**
   * Break on memory change
   */
  onMemoryChange(description?: string): BreakpointOptions {
    return {
      type: 'memory-change',
      description: description ?? 'Break on memory change',
    };
  },

  /**
   * Custom condition breakpoint
   */
  custom(
    condition: BreakpointCondition,
    description?: string,
  ): BreakpointOptions {
    return {
      type: 'custom',
      condition,
      description: description ?? 'Custom breakpoint',
    };
  },
};
