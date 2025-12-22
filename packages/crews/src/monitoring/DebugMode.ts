/**
 * Debug Mode
 *
 * Step-through debugging for crew execution.
 */

import { EventEmitter } from 'eventemitter3';
import type { Crew } from '../core/Crew';
import type { CrewAgent } from '../agents';
import type { CrewEvent, TaskConfig } from '../types';

/**
 * Breakpoint type
 */
export type BreakpointType =
  | 'task:assigned'
  | 'task:started'
  | 'task:completed'
  | 'task:failed'
  | 'agent:thinking'
  | 'delegation:decision'
  | 'custom';

/**
 * Breakpoint definition
 */
export interface Breakpoint {
  id: string;
  type: BreakpointType;
  condition?: (event: CrewEvent, context: DebugContext) => boolean;
  enabled: boolean;
  hitCount: number;
}

/**
 * Debug context
 */
export interface DebugContext {
  currentEvent?: CrewEvent;
  agents: Map<string, AgentInspection>;
  tasks: TaskConfig[];
  variables: Map<string, unknown>;
  callStack: string[];
}

/**
 * Agent inspection data
 */
export interface AgentInspection {
  name: string;
  role: string;
  status: 'idle' | 'busy' | 'paused';
  currentTask?: string;
  lastThought?: string;
  lastToolCall?: {
    tool: string;
    input: unknown;
    output?: unknown;
  };
  memory: Map<string, unknown>;
}

/**
 * Step result
 */
export interface StepResult {
  event: CrewEvent;
  breakpointHit?: Breakpoint;
  agentStates: Map<string, AgentInspection>;
  continueExecution: boolean;
}

/**
 * Debug mode configuration
 */
export interface DebugModeConfig {
  /** Auto-pause on errors */
  pauseOnError?: boolean;
  /** Log all events */
  verbose?: boolean;
  /** Maximum call stack depth */
  maxCallStackDepth?: number;
}

/**
 * Debug mode
 *
 * Provides step-through debugging capabilities for crew execution.
 */
export class DebugMode extends EventEmitter<{
  breakpointHit: (breakpoint: Breakpoint, event: CrewEvent) => void;
  step: (result: StepResult) => void;
  error: (error: Error) => void;
  paused: () => void;
  resumed: () => void;
}> {
  private readonly crew: Crew;
  private readonly config: Required<DebugModeConfig>;
  private readonly breakpoints: Map<string, Breakpoint> = new Map();
  private readonly eventQueue: CrewEvent[] = [];
  private readonly callStack: string[] = [];
  private context: DebugContext;
  private enabled: boolean = false;
  private paused: boolean = false;
  private stepMode: boolean = false;
  private breakpointCounter: number = 0;
  private resolveStep?: () => void;

  constructor(crew: Crew, config: DebugModeConfig = {}) {
    super();
    this.crew = crew;
    this.config = {
      pauseOnError: config.pauseOnError ?? true,
      verbose: config.verbose ?? false,
      maxCallStackDepth: config.maxCallStackDepth ?? 100,
    };

    this.context = this.createContext();
  }

  // ============ Enable/Disable ============

  /**
   * Enable debug mode
   */
  enable(): void {
    if (this.enabled) return;

    this.enabled = true;
    this.paused = false;

    if (this.config.verbose) {
      console.log('[Debug] Debug mode enabled');
    }
  }

  /**
   * Disable debug mode
   */
  disable(): void {
    this.enabled = false;
    this.paused = false;
    this.stepMode = false;
    this.breakpoints.clear();
    this.eventQueue.length = 0;
    this.callStack.length = 0;

    if (this.resolveStep) {
      this.resolveStep();
      this.resolveStep = undefined;
    }

    if (this.config.verbose) {
      console.log('[Debug] Debug mode disabled');
    }
  }

  /**
   * Check if debug mode is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  // ============ Breakpoints ============

  /**
   * Set a breakpoint
   */
  setBreakpoint(
    type: BreakpointType,
    condition?: (event: CrewEvent, context: DebugContext) => boolean,
  ): string {
    const id = `bp-${++this.breakpointCounter}`;

    const breakpoint: Breakpoint = {
      id,
      type,
      condition,
      enabled: true,
      hitCount: 0,
    };

    this.breakpoints.set(id, breakpoint);

    if (this.config.verbose) {
      console.log(`[Debug] Breakpoint set: ${id} (${type})`);
    }

    return id;
  }

  /**
   * Remove a breakpoint
   */
  removeBreakpoint(id: string): boolean {
    const removed = this.breakpoints.delete(id);

    if (removed && this.config.verbose) {
      console.log(`[Debug] Breakpoint removed: ${id}`);
    }

    return removed;
  }

  /**
   * Enable a breakpoint
   */
  enableBreakpoint(id: string): boolean {
    const bp = this.breakpoints.get(id);
    if (bp) {
      bp.enabled = true;
      return true;
    }
    return false;
  }

  /**
   * Disable a breakpoint
   */
  disableBreakpoint(id: string): boolean {
    const bp = this.breakpoints.get(id);
    if (bp) {
      bp.enabled = false;
      return true;
    }
    return false;
  }

  /**
   * Get all breakpoints
   */
  getBreakpoints(): Breakpoint[] {
    return Array.from(this.breakpoints.values());
  }

  /**
   * Clear all breakpoints
   */
  clearBreakpoints(): void {
    this.breakpoints.clear();
  }

  // ============ Execution Control ============

  /**
   * Step to next event
   */
  async step(): Promise<StepResult> {
    if (!this.enabled) {
      throw new Error('Debug mode not enabled');
    }

    this.stepMode = true;
    this.paused = false;

    // Wait for next event
    return new Promise((resolve) => {
      this.resolveStep = () => {
        const event = this.eventQueue.shift();
        if (!event) {
          resolve({
            event: {
              type: 'crew:completed',
              crewName: this.crew.name,
              metrics: this.crew.getMetrics(),
              success: true,
            },
            agentStates: this.getAgentStates(),
            continueExecution: false,
          });
          return;
        }

        this.updateContext(event);
        const hitBreakpoint = this.checkBreakpoints(event);

        resolve({
          event,
          breakpointHit: hitBreakpoint,
          agentStates: this.getAgentStates(),
          continueExecution: true,
        });
      };
    });
  }

  /**
   * Continue execution
   */
  continue(): Promise<void> {
    if (!this.enabled) {
      throw new Error('Debug mode not enabled');
    }

    this.stepMode = false;
    this.paused = false;

    this.emit('resumed');

    if (this.config.verbose) {
      console.log('[Debug] Execution resumed');
    }

    return Promise.resolve();
  }

  /**
   * Pause execution
   */
  pause(): void {
    this.paused = true;
    this.emit('paused');

    if (this.config.verbose) {
      console.log('[Debug] Execution paused');
    }
  }

  /**
   * Resume from pause
   */
  resume(): void {
    this.paused = false;
    this.emit('resumed');

    if (this.config.verbose) {
      console.log('[Debug] Execution resumed');
    }
  }

  /**
   * Check if paused
   */
  isPaused(): boolean {
    return this.paused;
  }

  // ============ Inspection ============

  /**
   * Inspect an agent
   */
  inspect(agentName: string): AgentInspection | undefined {
    const agent = this.crew.getAgent(agentName);
    if (!agent) return undefined;

    return this.createAgentInspection(agent);
  }

  /**
   * Inspect all agents
   */
  inspectAll(): Map<string, AgentInspection> {
    return this.getAgentStates();
  }

  /**
   * Get debug context
   */
  getContext(): DebugContext {
    return { ...this.context };
  }

  /**
   * Get call stack
   */
  getCallStack(): string[] {
    return [...this.callStack];
  }

  /**
   * Evaluate expression in context
   */
  evaluate(expression: string): unknown {
    // Simple variable lookup
    if (this.context.variables.has(expression)) {
      return this.context.variables.get(expression);
    }

    // Check agent states
    const agentMatch = expression.match(/^agent\.(\w+)\.(\w+)$/);
    if (agentMatch) {
      const [, agentName, property] = agentMatch;
      const agent = this.context.agents.get(agentName);
      if (agent) {
        return (agent as Record<string, unknown>)[property];
      }
    }

    return undefined;
  }

  /**
   * Set a watch expression
   */
  watch(expression: string): { expression: string; value: unknown } {
    return {
      expression,
      value: this.evaluate(expression),
    };
  }

  // ============ Event Handling ============

  /**
   * Handle a crew event (called by crew during execution)
   */
  handleEvent(event: CrewEvent): void {
    if (!this.enabled) return;

    this.eventQueue.push(event);
    this.updateContext(event);

    if (this.config.verbose) {
      console.log(`[Debug] Event: ${event.type}`);
    }

    // Check breakpoints
    const hitBreakpoint = this.checkBreakpoints(event);

    if (hitBreakpoint) {
      this.paused = true;
      this.emit('breakpointHit', hitBreakpoint, event);

      if (this.config.verbose) {
        console.log(`[Debug] Breakpoint hit: ${hitBreakpoint.id}`);
      }
    }

    // Check for errors
    if (this.config.pauseOnError && event.type === 'crew:error') {
      this.pause();
    }

    // Resolve step if in step mode
    if (this.stepMode && this.resolveStep) {
      this.resolveStep();
      this.resolveStep = undefined;
    }
  }

  // ============ Internal ============

  /**
   * Create debug context
   */
  private createContext(): DebugContext {
    return {
      agents: new Map(),
      tasks: [],
      variables: new Map(),
      callStack: [],
    };
  }

  /**
   * Update context from event
   */
  private updateContext(event: CrewEvent): void {
    this.context.currentEvent = event;

    // Update call stack
    this.callStack.push(event.type);
    if (this.callStack.length > this.config.maxCallStackDepth) {
      this.callStack.shift();
    }

    // Update agent states
    this.context.agents = this.getAgentStates();

    // Update tasks
    this.context.tasks = this.crew.getTasks().map((t) => t.toConfig());
  }

  /**
   * Check breakpoints against event
   */
  private checkBreakpoints(event: CrewEvent): Breakpoint | undefined {
    for (const bp of this.breakpoints.values()) {
      if (!bp.enabled) continue;

      // Check type match
      if (bp.type !== 'custom' && bp.type !== event.type) continue;

      // Check condition
      if (bp.condition && !bp.condition(event, this.context)) continue;

      // Breakpoint hit
      bp.hitCount++;
      return bp;
    }

    return undefined;
  }

  /**
   * Get agent states
   */
  private getAgentStates(): Map<string, AgentInspection> {
    const states = new Map<string, AgentInspection>();

    for (const agent of this.crew.getAgents()) {
      states.set(agent.name, this.createAgentInspection(agent));
    }

    return states;
  }

  /**
   * Create agent inspection
   */
  private createAgentInspection(agent: CrewAgent): AgentInspection {
    const stats = agent.getStats();

    return {
      name: agent.name,
      role: agent.role.name,
      status: stats.isBusy ? 'busy' : this.paused ? 'paused' : 'idle',
      currentTask: stats.currentTask,
      memory: new Map(), // Would need access to agent's internal state
    };
  }

  /**
   * Get debug summary
   */
  getSummary(): {
    enabled: boolean;
    paused: boolean;
    stepMode: boolean;
    breakpointCount: number;
    queuedEvents: number;
    callStackDepth: number;
  } {
    return {
      enabled: this.enabled,
      paused: this.paused,
      stepMode: this.stepMode,
      breakpointCount: this.breakpoints.size,
      queuedEvents: this.eventQueue.length,
      callStackDepth: this.callStack.length,
    };
  }
}

/**
 * Factory function
 */
export function createDebugMode(
  crew: Crew,
  config?: DebugModeConfig,
): DebugMode {
  return new DebugMode(crew, config);
}

export default DebugMode;
