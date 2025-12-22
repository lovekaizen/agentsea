/**
 * @Guardrailed Decorator
 *
 * Method decorator for applying guardrails to controller methods.
 */

import { SetMetadata } from '@nestjs/common';
import type {
  applyDecorators as _applyDecorators,
  UseGuards as _UseGuards,
  UseInterceptors as _UseInterceptors,
} from '@nestjs/common';

import type { GuardConfig, ContentType } from '../../types';
import { z } from 'zod';

/**
 * Guardrailed decorator options
 */
export interface GuardrailedOptions {
  /** Input guards to apply */
  input?: string[];
  /** Output guards to apply */
  output?: string[];
  /** Zod schema for output validation */
  schema?: z.ZodType;
  /** Guard configurations */
  configs?: Record<string, Partial<GuardConfig>>;
  /** Skip guards on success */
  skipOnSuccess?: boolean;
  /** Content type to check */
  type?: ContentType;
  /** Field to extract content from (for input) */
  inputField?: string;
  /** Field to extract content from (for output) */
  outputField?: string;
}

/**
 * Metadata key for guardrailed options
 */
export const GUARDRAILED_METADATA = Symbol('guardrailed');

/**
 * @Guardrailed decorator
 *
 * Apply guardrails to a controller method.
 *
 * @example
 * ```typescript
 * @Controller('chat')
 * export class ChatController {
 *   @Post('message')
 *   @Guardrailed({
 *     input: ['prompt-injection', 'toxicity'],
 *     output: ['pii', 'data-leakage'],
 *     schema: MessageResponseSchema,
 *   })
 *   async sendMessage(@Body() dto: SendMessageDto) {
 *     return this.chatService.send(dto.message);
 *   }
 * }
 * ```
 */
export function Guardrailed(options: GuardrailedOptions = {}): MethodDecorator {
  return SetMetadata(GUARDRAILED_METADATA, options);
}

/**
 * Get guardrailed metadata from a target
 */
export function getGuardrailedMetadata(
  target: unknown,
  propertyKey?: string | symbol,
): GuardrailedOptions | undefined {
  if (propertyKey) {
    return Reflect.getMetadata(
      GUARDRAILED_METADATA,
      target as object,
      propertyKey,
    );
  }
  return Reflect.getMetadata(GUARDRAILED_METADATA, target as object);
}

/**
 * Check if a method has guardrailed decorator
 */
export function isGuardrailed(
  target: unknown,
  propertyKey?: string | symbol,
): boolean {
  return getGuardrailedMetadata(target, propertyKey) !== undefined;
}

export default Guardrailed;
