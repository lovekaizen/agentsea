/**
 * AgentSea Middleware
 *
 * Middleware integration for AgentSea agents.
 */

import type { GuardrailsConfig, GuardContext } from '../../types';
import {
  GuardrailsEngine,
  GuardrailsResult,
} from '../../core/guardrails-engine';

/**
 * Middleware context
 */
export interface MiddlewareContext {
  input?: string;
  output?: string;
  sessionId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Middleware result
 */
export interface MiddlewareResult {
  allowed: boolean;
  input?: GuardrailsResult;
  output?: GuardrailsResult;
  transformedInput?: string;
  transformedOutput?: string;
}

/**
 * Guardrails Middleware
 *
 * Middleware class for integrating guardrails with AgentSea agents.
 *
 * @example
 * ```typescript
 * import { GuardrailsMiddleware } from '@lov3kaizen/agentsea-guardrails/agentsea';
 *
 * const middleware = new GuardrailsMiddleware({
 *   guards: [
 *     { name: 'prompt-injection', enabled: true, onFailure: 'block' },
 *     { name: 'pii', enabled: true, onFailure: 'transform' },
 *   ],
 *   failureMode: 'fail-fast',
 *   defaultAction: 'block',
 * });
 *
 * // Use with agent
 * agent.use(middleware);
 * ```
 */
export class GuardrailsMiddleware {
  private engine: GuardrailsEngine;

  constructor(config: Partial<GuardrailsConfig> = {}) {
    this.engine = new GuardrailsEngine(config);
  }

  /**
   * Process input before sending to agent
   */
  async processInput(
    input: string,
    context?: Partial<GuardContext>,
  ): Promise<{
    allowed: boolean;
    result: GuardrailsResult;
    transformed?: string;
  }> {
    const result = await this.engine.checkInput(input, context);

    return {
      allowed: result.passed,
      result,
      transformed: result.transformedContent,
    };
  }

  /**
   * Process output from agent
   */
  async processOutput(
    output: string,
    context?: Partial<GuardContext>,
  ): Promise<{
    allowed: boolean;
    result: GuardrailsResult;
    transformed?: string;
  }> {
    const result = await this.engine.checkOutput(output, context);

    return {
      allowed: result.passed,
      result,
      transformed: result.transformedContent,
    };
  }

  /**
   * Process both input and output
   */
  async process(ctx: MiddlewareContext): Promise<MiddlewareResult> {
    const guardContext: Partial<GuardContext> = {
      sessionId: ctx.sessionId,
      userId: ctx.userId,
      metadata: ctx.metadata,
    };

    let inputResult: GuardrailsResult | undefined;
    let outputResult: GuardrailsResult | undefined;
    let transformedInput: string | undefined;
    let transformedOutput: string | undefined;

    // Check input
    if (ctx.input) {
      const inputCheck = await this.processInput(ctx.input, guardContext);
      inputResult = inputCheck.result;
      transformedInput = inputCheck.transformed;

      if (!inputCheck.allowed) {
        return {
          allowed: false,
          input: inputResult,
          transformedInput,
        };
      }
    }

    // Check output
    if (ctx.output) {
      const outputCheck = await this.processOutput(ctx.output, guardContext);
      outputResult = outputCheck.result;
      transformedOutput = outputCheck.transformed;

      if (!outputCheck.allowed) {
        return {
          allowed: false,
          input: inputResult,
          output: outputResult,
          transformedInput,
          transformedOutput,
        };
      }
    }

    return {
      allowed: true,
      input: inputResult,
      output: outputResult,
      transformedInput,
      transformedOutput,
    };
  }

  /**
   * Get the underlying engine
   */
  getEngine(): GuardrailsEngine {
    return this.engine;
  }
}

export default GuardrailsMiddleware;
