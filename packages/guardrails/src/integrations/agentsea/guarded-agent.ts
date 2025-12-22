/**
 * Guarded Agent
 *
 * Wrapper class that adds guardrails to any AgentSea agent.
 */

import type { GuardrailsConfig, GuardContext } from '../../types';
import {
  GuardrailsEngine,
  GuardrailsResult,
} from '../../core/guardrails-engine';

/**
 * Agent interface (minimal)
 */
export interface Agent {
  run(input: string, options?: Record<string, unknown>): Promise<string>;
  stream?(
    input: string,
    options?: Record<string, unknown>,
  ): AsyncGenerator<string, string>;
}

/**
 * Guarded agent options
 */
export interface GuardedAgentOptions {
  /** Guardrails configuration */
  guardrails?: Partial<GuardrailsConfig>;
  /** Throw on guard failure */
  throwOnFailure?: boolean;
  /** Custom error message */
  errorMessage?: string;
  /** Include guard details in error */
  includeDetails?: boolean;
}

/**
 * Guard error
 */
export class GuardError extends Error {
  constructor(
    message: string,
    public readonly result: GuardrailsResult,
    public readonly type: 'input' | 'output',
  ) {
    super(message);
    this.name = 'GuardError';
  }
}

/**
 * Guarded Agent
 *
 * Wraps an AgentSea agent with guardrails.
 *
 * @example
 * ```typescript
 * import { GuardedAgent } from '@lov3kaizen/agentsea-guardrails/agentsea';
 *
 * const agent = new MyAgent();
 * const guardedAgent = new GuardedAgent(agent, {
 *   guardrails: {
 *     guards: [
 *       { name: 'prompt-injection', enabled: true, onFailure: 'block' },
 *     ],
 *   },
 *   throwOnFailure: true,
 * });
 *
 * const result = await guardedAgent.run('Hello!');
 * ```
 */
export class GuardedAgent implements Agent {
  private agent: Agent;
  private engine: GuardrailsEngine;
  private throwOnFailure: boolean;
  private errorMessage: string;
  private includeDetails: boolean;

  constructor(agent: Agent, options: GuardedAgentOptions = {}) {
    this.agent = agent;
    this.engine = new GuardrailsEngine(options.guardrails);
    this.throwOnFailure = options.throwOnFailure ?? true;
    this.errorMessage = options.errorMessage ?? 'Content blocked by guardrails';
    this.includeDetails = options.includeDetails ?? true;
  }

  /**
   * Run the agent with guardrails
   */
  async run(input: string, options?: Record<string, unknown>): Promise<string> {
    const context: Partial<GuardContext> = {
      sessionId: options?.sessionId as string,
      userId: options?.userId as string,
      metadata: options?.metadata as Record<string, unknown>,
    };

    // Check input
    const inputResult = await this.engine.checkInput(input, context);

    if (!inputResult.passed) {
      return this.handleFailure(inputResult, 'input');
    }

    // Use transformed input if available
    const processedInput = inputResult.transformedContent ?? input;

    // Run the agent
    const output = await this.agent.run(processedInput, options);

    // Check output
    const outputResult = await this.engine.checkOutput(output, context);

    if (!outputResult.passed) {
      return this.handleFailure(outputResult, 'output');
    }

    // Return transformed output if available
    return outputResult.transformedContent ?? output;
  }

  /**
   * Stream from the agent with guardrails
   */
  async *stream(
    input: string,
    options?: Record<string, unknown>,
  ): AsyncGenerator<string, string> {
    if (!this.agent.stream) {
      // Fall back to run if stream not supported
      const result = await this.run(input, options);
      yield result;
      return result;
    }

    const context: Partial<GuardContext> = {
      sessionId: options?.sessionId as string,
      userId: options?.userId as string,
      metadata: options?.metadata as Record<string, unknown>,
    };

    // Check input
    const inputResult = await this.engine.checkInput(input, context);

    if (!inputResult.passed) {
      const error = this.handleFailure(inputResult, 'input');
      yield error;
      return error;
    }

    // Use transformed input if available
    const processedInput = inputResult.transformedContent ?? input;

    // Stream from agent, collecting output
    let fullOutput = '';
    for await (const chunk of this.agent.stream(processedInput, options)) {
      fullOutput += chunk;
      yield chunk;
    }

    // Check full output
    const outputResult = await this.engine.checkOutput(fullOutput, context);

    if (!outputResult.passed) {
      const error = this.handleFailure(outputResult, 'output');
      return error;
    }

    return outputResult.transformedContent ?? fullOutput;
  }

  /**
   * Handle guard failure
   */
  private handleFailure(
    result: GuardrailsResult,
    type: 'input' | 'output',
  ): string {
    const message = this.includeDetails
      ? `${this.errorMessage}: ${result.message}`
      : this.errorMessage;

    if (this.throwOnFailure) {
      throw new GuardError(message, result, type);
    }

    return message;
  }

  /**
   * Get the underlying engine
   */
  getEngine(): GuardrailsEngine {
    return this.engine;
  }

  /**
   * Get the wrapped agent
   */
  getAgent(): Agent {
    return this.agent;
  }
}

export default GuardedAgent;
