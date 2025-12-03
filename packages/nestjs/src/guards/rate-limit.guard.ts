import { SlidingWindowRateLimiter } from '@lov3kaizen/agentsea-core';
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const RATE_LIMIT_METADATA = 'agentsea:rate-limit';

export interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
  keyExtractor?: (context: ExecutionContext) => string;
}

/**
 * Guard to apply rate limiting to routes
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private limiters = new Map<string, SlidingWindowRateLimiter>();

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.get<RateLimitOptions>(
      RATE_LIMIT_METADATA,
      context.getHandler(),
    );

    if (!options) {
      return true;
    }

    const key = options.keyExtractor
      ? options.keyExtractor(context)
      : this.getDefaultKey(context);

    let limiter = this.limiters.get(key);
    if (!limiter) {
      limiter = new SlidingWindowRateLimiter(
        options.maxRequests,
        options.windowMs,
      );
      this.limiters.set(key, limiter);
    }

    if (!limiter.isAllowed(key)) {
      throw new HttpException(
        'Rate limit exceeded',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private getDefaultKey(context: ExecutionContext): string {
    const request = context.switchToHttp().getRequest();
    return request.ip || request.connection.remoteAddress || 'unknown';
  }
}

/**
 * Decorator to apply rate limiting
 */
export function RateLimit(options: RateLimitOptions): MethodDecorator {
  return (
    _target: any,
    _propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    Reflect.defineMetadata(RATE_LIMIT_METADATA, options, descriptor.value);
    return descriptor;
  };
}
