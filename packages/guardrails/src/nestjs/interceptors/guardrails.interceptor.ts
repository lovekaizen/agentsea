/**
 * Guardrails Interceptor
 *
 * NestJS interceptor that checks output against guardrails.
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from, switchMap, map } from 'rxjs';

import { GuardrailsService } from '../guardrails.service';
import {
  GUARDRAILED_METADATA,
  GuardrailedOptions,
} from '../decorators/guardrailed.decorator';
import {
  BYPASS_GUARDS_METADATA,
  BypassGuardsOptions,
} from '../decorators/bypass-guards.decorator';

/**
 * Guardrails Interceptor
 *
 * Intercepts responses and checks output against guardrails.
 *
 * @example
 * ```typescript
 * // Global interceptor
 * app.useGlobalInterceptors(new GuardrailsInterceptor(guardrailsService, reflector));
 *
 * // Controller-level
 * @UseInterceptors(GuardrailsInterceptor)
 * @Controller('chat')
 * export class ChatController {}
 *
 * // Method-level with @Guardrailed
 * @Post('message')
 * @Guardrailed({ output: ['pii', 'data-leakage'] })
 * async sendMessage(@Body() dto: SendMessageDto) {}
 * ```
 */
@Injectable()
export class GuardrailsInterceptor implements NestInterceptor {
  constructor(
    private readonly guardrailsService: GuardrailsService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Check for bypass
    const bypassOptions = this.reflector.get<BypassGuardsOptions>(
      BYPASS_GUARDS_METADATA,
      context.getHandler(),
    );

    if (bypassOptions?.all) {
      return next.handle();
    }

    // Get guardrailed options
    const guardrailedOptions = this.reflector.get<GuardrailedOptions>(
      GUARDRAILED_METADATA,
      context.getHandler(),
    );

    // If no output guards configured, pass through
    if (!guardrailedOptions?.output || guardrailedOptions.output.length === 0) {
      return next.handle();
    }

    // Filter bypassed guards
    const outputGuards = bypassOptions?.guards
      ? guardrailedOptions.output.filter(
          (g) => !bypassOptions.guards?.includes(g),
        )
      : guardrailedOptions.output;

    if (outputGuards.length === 0) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();

    return next.handle().pipe(
      switchMap((data) => {
        // Extract content from response
        const content = this.extractContent(data, guardrailedOptions);

        if (!content) {
          return Promise.resolve(data);
        }

        // Check output
        return from(
          this.guardrailsService.checkOutput(content, {
            sessionId: request.headers?.['x-session-id'] ?? request.sessionId,
            userId: request.user?.id ?? request.headers?.['x-user-id'],
            metadata: {
              path: request.path,
              method: request.method,
            },
          }),
        ).pipe(
          map((result) => {
            if (!result.passed) {
              throw new ForbiddenException({
                message: 'Response blocked by guardrails',
                details: result.message,
                action: result.action,
              });
            }

            // If transformation occurred, update response
            if (result.action === 'transform' && result.transformedContent) {
              return this.applyTransformation(
                data,
                result.transformedContent,
                guardrailedOptions,
              );
            }

            return data;
          }),
        );
      }),
    );
  }

  /**
   * Extract content from response data
   */
  private extractContent(
    data: unknown,
    options: GuardrailedOptions,
  ): string | null {
    if (typeof data === 'string') {
      return data;
    }

    if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      const outputField = options.outputField;

      if (outputField) {
        const value = this.getNestedValue(obj, outputField);
        if (typeof value === 'string') {
          return value;
        }
        if (value) {
          return JSON.stringify(value);
        }
      }

      // Try common response fields
      const content =
        obj.message ?? obj.content ?? obj.text ?? obj.output ?? obj.response;
      if (typeof content === 'string') {
        return content;
      }

      // Stringify the whole object
      return JSON.stringify(data);
    }

    return null;
  }

  /**
   * Apply transformation to response
   */
  private applyTransformation(
    data: unknown,
    transformedContent: string,
    options: GuardrailedOptions,
  ): unknown {
    if (typeof data === 'string') {
      return transformedContent;
    }

    if (data && typeof data === 'object') {
      const obj = { ...(data as Record<string, unknown>) };
      const outputField = options.outputField;

      if (outputField) {
        this.setNestedValue(obj, outputField, transformedContent);
        return obj;
      }

      // Try to parse transformed content for structured responses
      try {
        return JSON.parse(transformedContent);
      } catch {
        // If not JSON, try to update common fields
        if ('message' in obj) obj.message = transformedContent;
        else if ('content' in obj) obj.content = transformedContent;
        else if ('text' in obj) obj.text = transformedContent;
        else if ('output' in obj) obj.output = transformedContent;
        else if ('response' in obj) obj.response = transformedContent;
        return obj;
      }
    }

    return transformedContent;
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

  /**
   * Set nested value in object
   */
  private setNestedValue(
    obj: Record<string, unknown>,
    path: string,
    value: unknown,
  ): void {
    const parts = path.split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
  }
}

export default GuardrailsInterceptor;
