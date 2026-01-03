/**
 * Inspector
 *
 * State inspection utilities for debugging.
 */

import type {
  InspectorResult,
  ExecutionStep,
  AgentState,
  ToolCall,
  Decision,
  MemorySnapshot,
} from '../types/index.js';
import { deepClone, truncate } from '../utils/helpers.js';

/**
 * Inspector configuration
 */
export interface InspectorConfig {
  /** Maximum depth for object inspection */
  maxDepth?: number;
  /** Maximum string length for display */
  maxStringLength?: number;
  /** Include full memory in snapshot */
  includeFullMemory?: boolean;
}

/**
 * Variable watch
 */
export interface VariableWatch {
  /** Watch ID */
  id: string;
  /** Variable path */
  path: string;
  /** Current value */
  value: unknown;
  /** Previous value */
  previousValue?: unknown;
  /** Has changed since last check */
  changed: boolean;
}

/**
 * Inspector
 *
 * Inspects agent state during debugging.
 *
 * @example
 * ```typescript
 * const inspector = new Inspector(steps, state);
 *
 * // Get current state
 * const result = inspector.inspect();
 * console.log('Current step:', result.currentStep);
 * console.log('Tool calls:', result.toolCalls);
 *
 * // Watch a variable
 * inspector.watch('context.user.name');
 * ```
 */
export class Inspector {
  private steps: ExecutionStep[];
  private currentStepIndex: number;
  private state: AgentState;
  private watches: Map<string, VariableWatch> = new Map();
  private config: Required<InspectorConfig>;

  constructor(
    steps: ExecutionStep[],
    state: AgentState,
    config?: InspectorConfig,
  ) {
    this.steps = steps;
    this.state = state;
    this.currentStepIndex = steps.length > 0 ? steps.length - 1 : -1;
    this.config = {
      maxDepth: config?.maxDepth ?? 10,
      maxStringLength: config?.maxStringLength ?? 1000,
      includeFullMemory: config?.includeFullMemory ?? false,
    };
  }

  /**
   * Update the current state
   */
  update(steps: ExecutionStep[], state: AgentState, stepIndex?: number): void {
    this.steps = steps;
    this.state = state;
    this.currentStepIndex =
      stepIndex ?? (steps.length > 0 ? steps.length - 1 : -1);
    this.updateWatches();
  }

  /**
   * Get current step index
   */
  getCurrentStepIndex(): number {
    return this.currentStepIndex;
  }

  /**
   * Set current step index
   */
  setCurrentStepIndex(index: number): void {
    if (index >= -1 && index < this.steps.length) {
      this.currentStepIndex = index;
    }
  }

  /**
   * Inspect current state
   */
  inspect(): InspectorResult {
    const currentStep =
      this.currentStepIndex >= 0 ? this.steps[this.currentStepIndex] : null;

    return {
      currentStep,
      stepIndex: this.currentStepIndex,
      totalSteps: this.steps.length,
      state: this.state,
      toolCalls: this.getToolCalls(),
      decisions: this.getDecisions(),
      memory: this.getMemorySnapshot(),
      variables: this.getVariables(),
      callStack: this.getCallStack(),
    };
  }

  /**
   * Get current step
   */
  getCurrentStep(): ExecutionStep | null {
    return this.currentStepIndex >= 0
      ? this.steps[this.currentStepIndex]
      : null;
  }

  /**
   * Get step at index
   */
  getStep(index: number): ExecutionStep | undefined {
    return this.steps[index];
  }

  /**
   * Get all steps
   */
  getSteps(): ExecutionStep[] {
    return [...this.steps];
  }

  /**
   * Get steps up to current index
   */
  getStepsUpToCurrent(): ExecutionStep[] {
    return this.steps.slice(0, this.currentStepIndex + 1);
  }

  /**
   * Get all tool calls
   */
  getToolCalls(): ToolCall[] {
    const toolCalls: ToolCall[] = [];
    for (const step of this.getStepsUpToCurrent()) {
      if (step.toolCall) {
        toolCalls.push(step.toolCall);
      }
    }
    return toolCalls;
  }

  /**
   * Get tool calls for a specific tool
   */
  getToolCallsByName(name: string): ToolCall[] {
    return this.getToolCalls().filter((tc) => tc.name === name);
  }

  /**
   * Get all decisions
   */
  getDecisions(): Decision[] {
    const decisions: Decision[] = [];
    for (const step of this.getStepsUpToCurrent()) {
      if (step.decision) {
        decisions.push(step.decision);
      }
    }
    return decisions;
  }

  /**
   * Get memory snapshot
   */
  getMemorySnapshot(): MemorySnapshot {
    if (this.config.includeFullMemory) {
      return deepClone(this.state.memory);
    }

    return {
      working: this.state.memory.working
        ? (this.summarizeObject(this.state.memory.working) as Record<
            string,
            unknown
          >)
        : undefined,
      shortTerm: this.state.memory.shortTerm
        ? this.state.memory.shortTerm.slice(-10)
        : undefined,
      longTermSummary: this.state.memory.longTermSummary,
      size: this.state.memory.size,
    };
  }

  /**
   * Get variables/context
   */
  getVariables(): Record<string, unknown> {
    return deepClone(this.state.context);
  }

  /**
   * Get a specific variable by path
   */
  getVariable(path: string): unknown {
    const parts = path.split('.');
    let current: unknown = this.state.context;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Get call stack (agent hierarchy)
   */
  getCallStack(): string[] {
    const stack: string[] = [this.state.agentName];

    // Build stack from parent steps
    for (let i = this.currentStepIndex; i >= 0; i--) {
      const step = this.steps[i];
      if (step.type === 'handoff' || step.type === 'delegation') {
        const agentName = (step.output as { agentName?: string })?.agentName;
        if (agentName && !stack.includes(agentName)) {
          stack.unshift(agentName);
        }
      }
    }

    return stack;
  }

  /**
   * Watch a variable
   */
  watch(path: string): VariableWatch {
    const value = this.getVariable(path);
    const watch: VariableWatch = {
      id: `watch_${path}`,
      path,
      value: deepClone(value),
      changed: false,
    };
    this.watches.set(path, watch);
    return watch;
  }

  /**
   * Unwatch a variable
   */
  unwatch(path: string): boolean {
    return this.watches.delete(path);
  }

  /**
   * Get all watches
   */
  getWatches(): VariableWatch[] {
    return Array.from(this.watches.values());
  }

  /**
   * Update watches
   */
  private updateWatches(): void {
    for (const watch of this.watches.values()) {
      const currentValue = this.getVariable(watch.path);
      const previousValue = watch.value;

      watch.previousValue = previousValue;
      watch.value = deepClone(currentValue);
      watch.changed =
        JSON.stringify(previousValue) !== JSON.stringify(currentValue);
    }
  }

  /**
   * Get changed watches
   */
  getChangedWatches(): VariableWatch[] {
    return this.getWatches().filter((w) => w.changed);
  }

  /**
   * Search steps by content
   */
  searchSteps(
    query: string,
    options?: {
      caseSensitive?: boolean;
      types?: string[];
    },
  ): ExecutionStep[] {
    const searchQuery = options?.caseSensitive ? query : query.toLowerCase();

    return this.steps.filter((step) => {
      if (options?.types && !options.types.includes(step.type)) {
        return false;
      }

      const stepString = JSON.stringify(step);
      const searchIn = options?.caseSensitive
        ? stepString
        : stepString.toLowerCase();

      return searchIn.includes(searchQuery);
    });
  }

  /**
   * Get step summary
   */
  getStepSummary(step: ExecutionStep): string {
    switch (step.type) {
      case 'input':
        return `Input: ${truncate(String(step.input), 50)}`;
      case 'prompt':
        return `Prompt: ${truncate(String(step.input), 50)}`;
      case 'response':
        return `Response: ${truncate(String(step.output), 50)}`;
      case 'tool-call':
        return `Tool: ${step.toolCall?.name}(${Object.keys(step.toolCall?.arguments ?? {}).join(', ')})`;
      case 'tool-result':
        return `Result: ${step.toolCall?.success ? 'success' : 'failed'}`;
      case 'decision':
        return `Decision: ${step.decision?.chosen.description ?? 'unknown'}`;
      case 'error':
        return `Error: ${step.error?.message ?? 'unknown error'}`;
      default:
        return `${step.type}: step ${step.index}`;
    }
  }

  /**
   * Summarize an object for display
   */
  private summarizeObject(obj: unknown, depth = 0): unknown {
    if (depth > this.config.maxDepth) {
      return '[Max depth reached]';
    }

    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj !== 'object') {
      if (typeof obj === 'string' && obj.length > this.config.maxStringLength) {
        return truncate(obj, this.config.maxStringLength);
      }
      return obj;
    }

    if (Array.isArray(obj)) {
      if (obj.length > 10) {
        return [...obj.slice(0, 10), `... and ${obj.length - 10} more`];
      }
      return obj.map((item) => this.summarizeObject(item, depth + 1));
    }

    const result: Record<string, unknown> = {};
    const entries = Object.entries(obj as Record<string, unknown>);

    for (const [key, value] of entries.slice(0, 20)) {
      result[key] = this.summarizeObject(value, depth + 1);
    }

    if (entries.length > 20) {
      result['...'] = `${entries.length - 20} more keys`;
    }

    return result;
  }

  /**
   * Export inspection data
   */
  export(): Record<string, unknown> {
    return {
      inspection: this.inspect(),
      watches: this.getWatches(),
      steps: this.steps.map((s, i) => ({
        index: i,
        type: s.type,
        summary: this.getStepSummary(s),
        timestamp: s.timestamp,
        durationMs: s.durationMs,
      })),
    };
  }
}

/**
 * Create an inspector instance
 */
export function createInspector(
  steps: ExecutionStep[],
  state: AgentState,
  config?: InspectorConfig,
): Inspector {
  return new Inspector(steps, state, config);
}
