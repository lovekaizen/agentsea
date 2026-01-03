/**
 * Guardrails Guard
 *
 * NestJS guard that checks input against guardrails.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import type { Inject as _Inject, Optional as _Optional } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { GuardrailsService } from './guardrails.service';
import {
  GUARDRAILED_METADATA,
  GuardrailedOptions,
} from './decorators/guardrailed.decorator';
import {
  BYPASS_GUARDS_METADATA,
  BypassGuardsOptions,
} from './decorators/bypass-guards.decorator';

/**
 * Guardrails Guard
 *
 * Implements NestJS CanActivate to check input content against guardrails.
 *
 * @example
 * ```typescript
 * // Global guard
 * app.useGlobalGuards(new GuardrailsGuard(guardrailsService, reflector));
 *
 * // Controller-level
 * @UseGuards(GuardrailsGuard)
 * @Controller('chat')
 * export class ChatController {}
 *
 * // Method-level with @Guardrailed
 * @Post('message')
 * @Guardrailed({ input: ['prompt-injection'] })
 * async sendMessage(@Body() dto: SendMessageDto) {}
 * ```
 */
@Injectable()
export class GuardrailsGuard implements CanActivate {
  constructor(
    private readonly guardrailsService: GuardrailsService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check for bypass
    const bypassOptions = this.reflector.get<BypassGuardsOptions>(
      BYPASS_GUARDS_METADATA,
      context.getHandler(),
    );

    if (bypassOptions?.all) {
      return true;
    }

    // Get guardrailed options
    const guardrailedOptions = this.reflector.get<GuardrailedOptions>(
      GUARDRAILED_METADATA,
      context.getHandler(),
    );

    // If no input guards configured, allow
    if (!guardrailedOptions?.input || guardrailedOptions.input.length === 0) {
      return true;
    }

    // Filter bypassed guards
    const inputGuards = bypassOptions?.guards
      ? guardrailedOptions.input.filter(
          (g) => !bypassOptions.guards?.includes(g),
        )
      : guardrailedOptions.input;

    if (inputGuards.length === 0) {
      return true;
    }

    // Get request content
    const request = context.switchToHttp().getRequest();
    const content = this.extractContent(request, guardrailedOptions);

    if (!content) {
      return true;
    }

    // Check content
    const result = await this.guardrailsService.checkInput(content, {
      sessionId: request.headers?.['x-session-id'] ?? request.sessionId,
      userId: request.user?.id ?? request.headers?.['x-user-id'],
      metadata: {
        path: request.path,
        method: request.method,
        ip: request.ip,
      },
    });

    if (!result.passed) {
      throw new ForbiddenException({
        message: 'Content blocked by guardrails',
        details: result.message,
        action: result.action,
      });
    }

    // Store result for potential use by interceptor
    request.guardrailsInputResult = result;

    return true;
  }

  /**
   * Extract content from request
   */
  private extractContent(
    request: Record<string, unknown>,
    options: GuardrailedOptions,
  ): string | null {
    const inputField = options.inputField ?? 'body';

    // Get from specified field
    let content = this.getNestedValue(request, inputField);

    // If body, try common fields
    if (
      inputField === 'body' &&
      typeof content === 'object' &&
      content !== null
    ) {
      const body = content as Record<string, unknown>;
      content =
        body.message ?? body.content ?? body.text ?? body.input ?? body.prompt;
    }

    if (typeof content === 'string') {
      return content;
    }

    if (content && typeof content === 'object') {
      return JSON.stringify(content);
    }

    return null;
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }
}

export default GuardrailsGuard;
