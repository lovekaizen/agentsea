import {
  HttpException,
  HttpStatus,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, it, expect, vi } from 'vitest';

import {
  RateLimitGuard,
  RateLimit,
  RATE_LIMIT_METADATA,
  type RateLimitOptions,
} from '../guards/rate-limit.guard';

function makeContext(
  reflectorReturn: RateLimitOptions | undefined,
  request: Record<string, unknown> = { ip: '1.2.3.4' },
): { context: ExecutionContext; reflector: Reflector } {
  const handler = () => {};
  const reflector = new Reflector();
  vi.spyOn(reflector, 'get').mockReturnValue(reflectorReturn);
  const context = {
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
  return { context, reflector };
}

describe('RateLimitGuard', () => {
  it('allows the request when no rate-limit metadata is present', () => {
    const { context, reflector } = makeContext(undefined);
    const guard = new RateLimitGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows requests up to the configured maximum', () => {
    const options: RateLimitOptions = { maxRequests: 2, windowMs: 60_000 };
    const { context, reflector } = makeContext(options);
    const guard = new RateLimitGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws TOO_MANY_REQUESTS once the limit is exceeded', () => {
    const options: RateLimitOptions = { maxRequests: 1, windowMs: 60_000 };
    const { context, reflector } = makeContext(options);
    const guard = new RateLimitGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
    try {
      guard.canActivate(context);
      throw new Error('expected guard to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  });

  it('uses a custom keyExtractor to scope limits independently', () => {
    let counter = 0;
    const options: RateLimitOptions = {
      maxRequests: 1,
      windowMs: 60_000,
      keyExtractor: () => `key-${counter++}`,
    };
    const { context, reflector } = makeContext(options);
    const guard = new RateLimitGuard(reflector);
    // Each call gets a distinct key, so no call ever exceeds its own limit.
    expect(guard.canActivate(context)).toBe(true);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('falls back to remoteAddress when ip is missing', () => {
    const options: RateLimitOptions = { maxRequests: 1, windowMs: 60_000 };
    const { context, reflector } = makeContext(options, {
      connection: { remoteAddress: '9.9.9.9' },
    });
    const guard = new RateLimitGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });
});

describe('@RateLimit decorator', () => {
  it('attaches rate-limit options to the method value', () => {
    const options: RateLimitOptions = { maxRequests: 5, windowMs: 1000 };

    class Controller {
      @RateLimit(options)
      handler() {}
    }

    const descriptorValue = Object.getOwnPropertyDescriptor(
      Controller.prototype,
      'handler',
    )!.value;
    const metadata = Reflect.getMetadata(RATE_LIMIT_METADATA, descriptorValue);
    expect(metadata).toEqual(options);
  });
});
