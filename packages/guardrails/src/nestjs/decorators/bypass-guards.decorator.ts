/**
 * @BypassGuards Decorator
 *
 * Method decorator to bypass guardrails for specific methods.
 */

import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for bypass guards
 */
export const BYPASS_GUARDS_METADATA = Symbol('bypass_guards');

/**
 * Bypass guards options
 */
export interface BypassGuardsOptions {
  /** Guards to bypass (by name) */
  guards?: string[];
  /** Bypass all guards */
  all?: boolean;
  /** Reason for bypassing */
  reason?: string;
}

/**
 * @BypassGuards decorator
 *
 * Bypass guardrails for a method.
 *
 * @example
 * ```typescript
 * @Controller('admin')
 * export class AdminController {
 *   @Get('raw-data')
 *   @BypassGuards({ all: true, reason: 'Admin endpoint' })
 *   async getRawData() {
 *     return this.adminService.getRawData();
 *   }
 *
 *   @Post('import')
 *   @BypassGuards({ guards: ['pii', 'rate-limit'], reason: 'Bulk import' })
 *   async importData(@Body() dto: ImportDto) {
 *     return this.adminService.import(dto);
 *   }
 * }
 * ```
 */
export function BypassGuards(
  options: BypassGuardsOptions = { all: true },
): MethodDecorator {
  return SetMetadata(BYPASS_GUARDS_METADATA, options);
}

/**
 * Get bypass guards metadata from a target
 */
export function getBypassGuardsMetadata(
  target: unknown,
  propertyKey?: string | symbol,
): BypassGuardsOptions | undefined {
  if (propertyKey) {
    return Reflect.getMetadata(
      BYPASS_GUARDS_METADATA,
      target as object,
      propertyKey,
    );
  }
  return Reflect.getMetadata(BYPASS_GUARDS_METADATA, target as object);
}

/**
 * Check if guards should be bypassed
 */
export function shouldBypassGuard(
  target: unknown,
  propertyKey: string | symbol | undefined,
  guardName: string,
): boolean {
  const options = getBypassGuardsMetadata(target, propertyKey);
  if (!options) return false;

  if (options.all) return true;
  if (options.guards?.includes(guardName)) return true;

  return false;
}

export default BypassGuards;
