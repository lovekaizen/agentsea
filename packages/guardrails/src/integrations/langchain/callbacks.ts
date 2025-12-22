/**
 * LangChain.js Callbacks
 *
 * Callback handlers for LangChain.js integration.
 */

import type { GuardrailsConfig, GuardContext } from '../../types';
import {
  GuardrailsEngine,
  GuardrailsResult,
} from '../../core/guardrails-engine';

/**
 * LangChain callback handler interface (minimal)
 */
export interface CallbackHandler {
  handleLLMStart?(
    llm: Record<string, unknown>,
    prompts: string[],
    runId: string,
    parentRunId?: string,
  ): Promise<void>;

  handleLLMEnd?(
    output: Record<string, unknown>,
    runId: string,
    parentRunId?: string,
  ): Promise<void>;

  handleLLMError?(
    error: Error,
    runId: string,
    parentRunId?: string,
  ): Promise<void>;

  handleChainStart?(
    chain: Record<string, unknown>,
    inputs: Record<string, unknown>,
    runId: string,
    parentRunId?: string,
  ): Promise<void>;

  handleChainEnd?(
    outputs: Record<string, unknown>,
    runId: string,
    parentRunId?: string,
  ): Promise<void>;
}

/**
 * Guard callback options
 */
export interface GuardrailsCallbacksOptions {
  /** Guardrails configuration */
  guardrails?: Partial<GuardrailsConfig>;
  /** Check prompts before LLM */
  checkPrompts?: boolean;
  /** Check LLM outputs */
  checkOutputs?: boolean;
  /** Callback on guard failure */
  onFailure?: (result: GuardrailsResult, type: 'input' | 'output') => void;
  /** Throw on failure */
  throwOnFailure?: boolean;
}

/**
 * Guard callback error
 */
export class GuardrailsCallbackError extends Error {
  constructor(
    message: string,
    public readonly result: GuardrailsResult,
    public readonly type: 'input' | 'output',
  ) {
    super(message);
    this.name = 'GuardrailsCallbackError';
  }
}

/**
 * Guardrails Callbacks
 *
 * LangChain.js callback handler for guardrails.
 *
 * @example
 * ```typescript
 * import { GuardrailsCallbacks } from '@lov3kaizen/agentsea-guardrails/langchain';
 *
 * const guardrailsCallbacks = new GuardrailsCallbacks({
 *   guardrails: {
 *     guards: [
 *       { name: 'prompt-injection', enabled: true, onFailure: 'block' },
 *     ],
 *   },
 *   checkPrompts: true,
 *   checkOutputs: true,
 *   throwOnFailure: true,
 * });
 *
 * const chain = new LLMChain({
 *   llm,
 *   prompt,
 *   callbacks: [guardrailsCallbacks],
 * });
 * ```
 */
export class GuardrailsCallbacks implements CallbackHandler {
  private engine: GuardrailsEngine;
  private checkPrompts: boolean;
  private checkOutputs: boolean;
  private onFailure?: (
    result: GuardrailsResult,
    type: 'input' | 'output',
  ) => void;
  private throwOnFailure: boolean;
  private runContexts = new Map<string, Partial<GuardContext>>();

  constructor(options: GuardrailsCallbacksOptions = {}) {
    this.engine = new GuardrailsEngine(options.guardrails);
    this.checkPrompts = options.checkPrompts ?? true;
    this.checkOutputs = options.checkOutputs ?? true;
    this.onFailure = options.onFailure;
    this.throwOnFailure = options.throwOnFailure ?? true;
  }

  /**
   * Handle LLM start - check prompts
   */
  async handleLLMStart(
    _llm: Record<string, unknown>,
    prompts: string[],
    runId: string,
    _parentRunId?: string,
  ): Promise<void> {
    if (!this.checkPrompts) return;

    // Store context for this run
    this.runContexts.set(runId, {
      sessionId: runId,
      metadata: { type: 'llm' },
    });

    for (const prompt of prompts) {
      const result = await this.engine.checkInput(
        prompt,
        this.runContexts.get(runId),
      );

      if (!result.passed) {
        this.onFailure?.(result, 'input');

        if (this.throwOnFailure) {
          throw new GuardrailsCallbackError(
            `Prompt blocked by guardrails: ${result.message}`,
            result,
            'input',
          );
        }
      }
    }
  }

  /**
   * Handle LLM end - check outputs
   */
  async handleLLMEnd(
    output: Record<string, unknown>,
    runId: string,
    _parentRunId?: string,
  ): Promise<void> {
    if (!this.checkOutputs) return;

    // Extract text from output
    const generations = output.generations as Array<Array<{ text: string }>>;
    if (!generations) return;

    const context = this.runContexts.get(runId);

    for (const generation of generations) {
      for (const gen of generation) {
        if (gen.text) {
          const result = await this.engine.checkOutput(gen.text, context);

          if (!result.passed) {
            this.onFailure?.(result, 'output');

            if (this.throwOnFailure) {
              throw new GuardrailsCallbackError(
                `Output blocked by guardrails: ${result.message}`,
                result,
                'output',
              );
            }
          }
        }
      }
    }

    // Clean up context
    this.runContexts.delete(runId);
  }

  /**
   * Handle LLM error
   */
  handleLLMError(
    _error: Error,
    runId: string,
    _parentRunId?: string,
  ): Promise<void> {
    // Clean up context on error
    this.runContexts.delete(runId);
    return Promise.resolve();
  }

  /**
   * Handle chain start - check inputs
   */
  async handleChainStart(
    _chain: Record<string, unknown>,
    inputs: Record<string, unknown>,
    runId: string,
    _parentRunId?: string,
  ): Promise<void> {
    if (!this.checkPrompts) return;

    // Store context
    this.runContexts.set(runId, {
      sessionId: runId,
      metadata: { type: 'chain' },
    });

    // Check common input fields
    const inputText =
      (inputs.input as string) ??
      (inputs.question as string) ??
      (inputs.query as string) ??
      (inputs.text as string);

    if (inputText) {
      const result = await this.engine.checkInput(
        inputText,
        this.runContexts.get(runId),
      );

      if (!result.passed) {
        this.onFailure?.(result, 'input');

        if (this.throwOnFailure) {
          throw new GuardrailsCallbackError(
            `Chain input blocked by guardrails: ${result.message}`,
            result,
            'input',
          );
        }
      }
    }
  }

  /**
   * Handle chain end - check outputs
   */
  async handleChainEnd(
    outputs: Record<string, unknown>,
    runId: string,
    _parentRunId?: string,
  ): Promise<void> {
    if (!this.checkOutputs) return;

    const context = this.runContexts.get(runId);

    // Check common output fields
    const outputText =
      (outputs.output as string) ??
      (outputs.text as string) ??
      (outputs.response as string) ??
      (outputs.answer as string);

    if (outputText) {
      const result = await this.engine.checkOutput(outputText, context);

      if (!result.passed) {
        this.onFailure?.(result, 'output');

        if (this.throwOnFailure) {
          throw new GuardrailsCallbackError(
            `Chain output blocked by guardrails: ${result.message}`,
            result,
            'output',
          );
        }
      }
    }

    // Clean up context
    this.runContexts.delete(runId);
  }

  /**
   * Get the underlying engine
   */
  getEngine(): GuardrailsEngine {
    return this.engine;
  }
}

export default GuardrailsCallbacks;
