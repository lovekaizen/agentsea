/**
 * Tenant Decorator
 * Extract tenant context from request
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TenantContext } from '@lov3kaizen/agentsea-core';

/**
 * Inject tenant context into route handler
 * @example
 * ```typescript
 * @Get()
 * async getAgents(@Tenant() tenant: TenantContext) {
 *   // tenant.tenant.id, tenant.tenant.name, etc.
 * }
 * ```
 */
export const Tenant = createParamDecorator(
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  (_data: unknown, ctx: ExecutionContext): TenantContext | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenant || null;
  },
);

/**
 * Inject tenant ID directly into route handler
 * @example
 * ```typescript
 * @Get()
 * async getAgents(@TenantId() tenantId: string) {
 *   // Use tenantId directly
 * }
 * ```
 */
export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenant?.tenant?.id || null;
  },
);
