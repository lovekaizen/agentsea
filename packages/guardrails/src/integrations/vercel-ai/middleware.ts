/**
 * Vercel AI SDK Middleware
 *
 * Middleware for Vercel AI SDK integration.
 */

import type { GuardrailsConfig, GuardContext } from '../../types';
import {
  GuardrailsEngine,
  GuardrailsResult,
} from '../../core/guardrails-engine';

/**
 * Middleware options
 */
export interface GuardrailsMiddlewareOptions {
  /** Guardrails configuration */
  guardrails?: Partial<GuardrailsConfig>;
  /** Check input prompts */
  checkInput?: boolean;
  /** Check output responses */
  checkOutput?: boolean;
  /** Transform blocked content */
  transformBlocked?: boolean;
  /** Blocked content replacement */
  blockedReplacement?: string;
  /** Callback on guard failure */
  onFailure?: (result: GuardrailsResult, type: 'input' | 'output') => void;
}

/**
 * Transform function result
 */
export interface TransformResult {
  content: string;
  blocked: boolean;
  transformed: boolean;
  result?: GuardrailsResult;
}

/**
 * Create guardrails middleware for Vercel AI SDK
 *
 * @example
 * ```typescript
 * import { guardrailsMiddleware } from '@lov3kaizen/agentsea-guardrails/vercel-ai';
 *
 * const middleware = guardrailsMiddleware({
 *   guardrails: {
 *     guards: [
 *       { name: 'pii', enabled: true, onFailure: 'transform' },
 *     ],
 *   },
 *   checkInput: true,
 *   checkOutput: true,
 * });
 *
 * const result = await streamText({
 *   model: anthropic('claude-sonnet-4-6'),
 *   prompt: userInput,
 *   experimental_transform: middleware,
 * });
 * ```
 */
export function guardrailsMiddleware(
  options: GuardrailsMiddlewareOptions = {},
) {
  const engine = new GuardrailsEngine(options.guardrails);
  const checkInput = options.checkInput ?? true;
  const checkOutput = options.checkOutput ?? true;
  const transformBlocked = options.transformBlocked ?? false;
  const blockedReplacement =
    options.blockedReplacement ?? '[Content blocked by guardrails]';
  const onFailure = options.onFailure;

  /**
   * Transform input content
   */
  async function transformInput(
    content: string,
    context?: Partial<GuardContext>,
  ): Promise<TransformResult> {
    if (!checkInput) {
      return { content, blocked: false, transformed: false };
    }

    const result = await engine.checkInput(content, context);

    if (!result.passed) {
      onFailure?.(result, 'input');

      if (transformBlocked) {
        return {
          content: result.transformedContent ?? blockedReplacement,
          blocked: true,
          transformed: true,
          result,
        };
      }

      throw new GuardrailsError(
        `Input blocked by guardrails: ${result.message}`,
        result,
        'input',
      );
    }

    if (result.transformedContent) {
      return {
        content: result.transformedContent,
        blocked: false,
        transformed: true,
        result,
      };
    }

    return { content, blocked: false, transformed: false, result };
  }

  /**
   * Transform output content
   */
  async function transformOutput(
    content: string,
    context?: Partial<GuardContext>,
  ): Promise<TransformResult> {
    if (!checkOutput) {
      return { content, blocked: false, transformed: false };
    }

    const result = await engine.checkOutput(content, context);

    if (!result.passed) {
      onFailure?.(result, 'output');

      if (transformBlocked) {
        return {
          content: result.transformedContent ?? blockedReplacement,
          blocked: true,
          transformed: true,
          result,
        };
      }

      throw new GuardrailsError(
        `Output blocked by guardrails: ${result.message}`,
        result,
        'output',
      );
    }

    if (result.transformedContent) {
      return {
        content: result.transformedContent,
        blocked: false,
        transformed: true,
        result,
      };
    }

    return { content, blocked: false, transformed: false, result };
  }

  return {
    transformInput,
    transformOutput,
    engine,
  };
}

/**
 * Guardrails error
 */
export class GuardrailsError extends Error {
  constructor(
    message: string,
    public readonly result: GuardrailsResult,
    public readonly type: 'input' | 'output',
  ) {
    super(message);
    this.name = 'GuardrailsError';
  }
}

/**
 * Create a text transformer that applies guardrails
 *
 * @example
 * ```typescript
 * const transform = createTextTransformer({
 *   guardrails: { guards: [...] },
 * });
 *
 * const result = await streamText({
 *   model,
 *   prompt,
 *   experimental_transform: transform,
 * });
 * ```
 */
export function createTextTransformer(
  options: GuardrailsMiddlewareOptions = {},
) {
  const middleware = guardrailsMiddleware(options);

  return async function* (
    chunks: AsyncIterable<string>,
  ): AsyncGenerator<string, void> {
    let buffer = '';

    for await (const chunk of chunks) {
      buffer += chunk;
    }

    // Check full output
    const result = await middleware.transformOutput(buffer);
    yield result.content;
  };
}

export default guardrailsMiddleware;
