/**
 * DebugMiddleware
 *
 * Middleware for integrating debugging into AgentSea agents.
 */

import type {
  ExecutionStep,
  AgentState,
  StepType,
  ToolCall,
  Decision,
  TokenUsage,
} from '../../types/index.js';
import { Debugger } from '../../core/Debugger.js';
import { Recorder } from '../../recording/Recorder.js';
import { generateId, now } from '../../utils/helpers.js';

/**
 * Middleware options
 */
export interface DebugMiddlewareOptions {
  /** Enable debugging */
  enabled?: boolean;
  /** Enable recording */
  recordEnabled?: boolean;
  /** Debugger instance */
  debugger?: Debugger;
  /** Recorder instance */
  recorder?: Recorder;
  /** Auto-start session */
  autoStart?: boolean;
  /** Include prompts in recording */
  includePrompts?: boolean;
  /** Include responses in recording */
  includeResponses?: boolean;
}

/**
 * Agent message type
 */
export interface AgentMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
  toolCallId?: string;
}

/**
 * Execution context
 */
export interface ExecutionContext {
  agentId: string;
  agentName: string;
  model: string;
  messages: AgentMessage[];
  tools: string[];
  memory?: Record<string, unknown>;
  context?: Record<string, unknown>;
}

/**
 * Step timing tracker
 */
interface StepTiming {
  startTime: number;
  type: StepType;
}

/**
 * DebugMiddleware
 *
 * Middleware for debugging AgentSea agents.
 *
 * @example
 * ```typescript
 * import { Agent } from '@lov3kaizen/agentsea-core';
 * import { DebugMiddleware } from '@lov3kaizen/agentsea-debugger';
 *
 * const middleware = new DebugMiddleware({
 *   enabled: true,
 *   recordEnabled: true,
 * });
 *
 * // Wrap agent execution
 * const agent = new Agent({
 *   middleware: [middleware.createHandler()],
 * });
 *
 * // Or use manually
 * middleware.onInput('Hello');
 * middleware.onToolCall({ name: 'search', arguments: { query: 'test' } });
 * middleware.onResponse('Here is the result...');
 * ```
 */
export class DebugMiddleware {
  private options: Required<DebugMiddlewareOptions>;
  private debugger: Debugger;
  private recorder: Recorder;
  private stepIndex = 0;
  private currentTiming?: StepTiming;
  private isSessionActive = false;

  constructor(options?: DebugMiddlewareOptions) {
    this.options = {
      enabled: options?.enabled ?? true,
      recordEnabled: options?.recordEnabled ?? true,
      debugger: options?.debugger ?? new Debugger(),
      recorder: options?.recorder ?? new Recorder(),
      autoStart: options?.autoStart ?? true,
      includePrompts: options?.includePrompts ?? true,
      includeResponses: options?.includeResponses ?? true,
    };

    this.debugger = this.options.debugger;
    this.recorder = this.options.recorder;
  }

  /**
   * Start a debug session
   */
  startSession(context: ExecutionContext): void {
    if (!this.options.enabled || this.isSessionActive) {
      return;
    }

    const state = this.contextToState(context);

    // Start debugger session
    this.debugger.startSession({
      agentId: context.agentId,
    });

    // Start recording if enabled
    if (this.options.recordEnabled) {
      this.recorder.start(context.agentId, state, context.agentName);
    }

    this.stepIndex = 0;
    this.isSessionActive = true;
  }

  /**
   * End the debug session
   */
  endSession(): void {
    if (!this.isSessionActive) {
      return;
    }

    this.debugger.endSession();

    if (this.options.recordEnabled) {
      this.recorder.stop();
    }

    this.isSessionActive = false;
  }

  /**
   * Record user input
   */
  onInput(input: unknown, context?: ExecutionContext): void {
    if (!this.options.enabled) return;

    this.finishCurrentStep();

    const step = this.createStep('input', {
      input,
    });

    this.recordStep(step, context);
    this.startTiming('input');
  }

  /**
   * Record prompt sent to model
   */
  onPrompt(prompt: string | AgentMessage[], context?: ExecutionContext): void {
    if (!this.options.enabled || !this.options.includePrompts) return;

    this.finishCurrentStep();

    const step = this.createStep('prompt', {
      input: prompt,
    });

    this.recordStep(step, context);
    this.startTiming('prompt');
  }

  /**
   * Record model response
   */
  onResponse(
    response: string,
    usage?: TokenUsage,
    context?: ExecutionContext,
  ): void {
    if (!this.options.enabled || !this.options.includeResponses) return;

    this.finishCurrentStep();

    const step = this.createStep('response', {
      output: response,
      tokenUsage: usage,
    });

    this.recordStep(step, context);
    this.startTiming('response');
  }

  /**
   * Record tool call
   */
  onToolCall(
    tool: {
      id?: string;
      name: string;
      arguments: Record<string, unknown>;
    },
    context?: ExecutionContext,
  ): void {
    if (!this.options.enabled) return;

    this.finishCurrentStep();

    const toolCall: ToolCall = {
      id: tool.id ?? generateId('tool'),
      name: tool.name,
      arguments: tool.arguments,
    };

    const step = this.createStep('tool-call', {
      input: tool.arguments,
      toolCall,
    });

    this.recordStep(step, context);
    this.startTiming('tool-call');
  }

  /**
   * Record tool result
   */
  onToolResult(
    tool: {
      id: string;
      name: string;
      result: unknown;
      success: boolean;
    },
    context?: ExecutionContext,
  ): void {
    if (!this.options.enabled) return;

    this.finishCurrentStep();

    const toolCall: ToolCall = {
      id: tool.id,
      name: tool.name,
      arguments: {},
      result: tool.result,
      success: tool.success,
    };

    const step = this.createStep('tool-result', {
      output: tool.result,
      toolCall,
    });

    this.recordStep(step, context);
    this.startTiming('tool-result');
  }

  /**
   * Record decision
   */
  onDecision(decision: Decision, context?: ExecutionContext): void {
    if (!this.options.enabled) return;

    this.finishCurrentStep();

    const step = this.createStep('decision', {
      decision,
      output: decision.chosen,
    });

    this.recordStep(step, context);
    this.startTiming('decision');
  }

  /**
   * Record error
   */
  onError(error: Error, context?: ExecutionContext): void {
    if (!this.options.enabled) return;

    this.finishCurrentStep();

    const step = this.createStep('error', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    });

    this.recordStep(step, context);
  }

  /**
   * Record memory write
   */
  onMemoryWrite(
    data: Record<string, unknown>,
    context?: ExecutionContext,
  ): void {
    if (!this.options.enabled) return;

    this.finishCurrentStep();

    const step = this.createStep('memory-write', {
      output: data,
    });

    this.recordStep(step, context);
    this.startTiming('memory-write');
  }

  /**
   * Record memory read
   */
  onMemoryRead(
    query: string | Record<string, unknown>,
    result: unknown,
    context?: ExecutionContext,
  ): void {
    if (!this.options.enabled) return;

    this.finishCurrentStep();

    const step = this.createStep('memory-read', {
      input: query,
      output: result,
    });

    this.recordStep(step, context);
    this.startTiming('memory-read');
  }

  /**
   * Create a checkpoint
   */
  createCheckpoint(name: string, description?: string): void {
    if (!this.options.enabled || !this.options.recordEnabled) return;

    this.recorder.createCheckpoint(name, description);
  }

  /**
   * Get the debugger instance
   */
  getDebugger(): Debugger {
    return this.debugger;
  }

  /**
   * Get the recorder instance
   */
  getRecorder(): Recorder {
    return this.recorder;
  }

  /**
   * Check if session is active
   */
  isActive(): boolean {
    return this.isSessionActive;
  }

  /**
   * Create middleware handler for agent
   */
  createHandler(): {
    beforeExecute: (context: ExecutionContext) => Promise<void>;
    afterExecute: (context: ExecutionContext) => Promise<void>;
    onStep: (
      type: StepType,
      data: Record<string, unknown>,
      context: ExecutionContext,
    ) => void;
    onError: (error: Error, context: ExecutionContext) => void;
  } {
    return {
      beforeExecute: (context) => {
        if (this.options.autoStart) {
          this.startSession(context);
        }
        return Promise.resolve();
      },
      afterExecute: () => {
        if (this.options.autoStart) {
          this.endSession();
        }
        return Promise.resolve();
      },
      onStep: (type, data, context) => {
        switch (type) {
          case 'input':
            this.onInput(data.input, context);
            break;
          case 'prompt':
            this.onPrompt(data.prompt as string, context);
            break;
          case 'response':
            this.onResponse(
              data.response as string,
              data.usage as TokenUsage,
              context,
            );
            break;
          case 'tool-call':
            this.onToolCall(
              data.tool as { name: string; arguments: Record<string, unknown> },
              context,
            );
            break;
          case 'tool-result':
            this.onToolResult(
              data.tool as {
                id: string;
                name: string;
                result: unknown;
                success: boolean;
              },
              context,
            );
            break;
          case 'decision':
            this.onDecision(data.decision as Decision, context);
            break;
        }
      },
      onError: (error, context) => {
        this.onError(error, context);
      },
    };
  }

  /**
   * Create a step
   */
  private createStep(
    type: StepType,
    data: Partial<ExecutionStep>,
  ): ExecutionStep {
    const duration = this.currentTiming
      ? now() - this.currentTiming.startTime
      : 0;

    return {
      id: generateId('step'),
      index: this.stepIndex++,
      type,
      timestamp: now(),
      durationMs: duration,
      ...data,
    };
  }

  /**
   * Record a step
   */
  private recordStep(step: ExecutionStep, context?: ExecutionContext): void {
    const state = context
      ? this.contextToState(context)
      : this.createDefaultState();

    this.debugger.recordStep(step, state);

    if (this.options.recordEnabled) {
      this.recorder.recordStep(step, state);
    }
  }

  /**
   * Start timing for a step
   */
  private startTiming(type: StepType): void {
    this.currentTiming = {
      startTime: now(),
      type,
    };
  }

  /**
   * Finish current step timing
   */
  private finishCurrentStep(): void {
    this.currentTiming = undefined;
  }

  /**
   * Convert context to agent state
   */
  private contextToState(context: ExecutionContext): AgentState {
    return {
      agentId: context.agentId,
      agentName: context.agentName,
      model: context.model,
      memory: {
        working: context.memory,
        size: 0,
      },
      context: context.context ?? {},
      tools: context.tools,
      messages: context.messages.map((m) => ({
        role: m.role,
        content: m.content,
        toolCalls: m.toolCalls,
        toolCallId: m.toolCallId,
      })),
    };
  }

  /**
   * Create default state
   */
  private createDefaultState(): AgentState {
    return {
      agentId: 'unknown',
      agentName: 'Unknown',
      model: 'unknown',
      memory: { size: 0 },
      context: {},
      tools: [],
      messages: [],
    };
  }
}

/**
 * Create debug middleware
 */
export function createDebugMiddleware(
  options?: DebugMiddlewareOptions,
): DebugMiddleware {
  return new DebugMiddleware(options);
}
