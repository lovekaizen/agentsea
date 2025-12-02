/**
 * Tenant Guard
 * Validates tenant context and enforces tenant isolation
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { TenantManager, TenantStatus } from '@lov3kaizen/agentsea-core';

export interface TenantGuardOptions {
  /** Tenant manager instance */
  tenantManager: TenantManager;

  /** Header name for API key (default: 'x-api-key') */
  apiKeyHeader?: string;

  /** Header name for tenant ID (default: 'x-tenant-id') */
  tenantIdHeader?: string;

  /** Query parameter for tenant (default: 'tenant') */
  tenantQuery?: string;

  /** Subdomain extraction (default: false) */
  useSubdomain?: boolean;

  /** Allow requests without tenant (default: false) */
  allowAnonymous?: boolean;
}

/**
 * Tenant Guard
 * Extracts and validates tenant from request
 */
@Injectable()
export class TenantGuard implements CanActivate {
  private tenantManager: TenantManager;
  private apiKeyHeader: string;
  private tenantIdHeader: string;
  private tenantQuery: string;
  private useSubdomain: boolean;
  private allowAnonymous: boolean;

  constructor(options: TenantGuardOptions) {
    this.tenantManager = options.tenantManager;
    this.apiKeyHeader = options.apiKeyHeader || 'x-api-key';
    this.tenantIdHeader = options.tenantIdHeader || 'x-tenant-id';
    this.tenantQuery = options.tenantQuery || 'tenant';
    this.useSubdomain = options.useSubdomain || false;
    this.allowAnonymous = options.allowAnonymous || false;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Try to extract tenant from different sources
    let tenant = null;

    // 1. API Key (highest priority)
    const apiKey = request.headers[this.apiKeyHeader];
    if (apiKey) {
      tenant = await this.tenantManager.verifyApiKey(apiKey);
      if (!tenant) {
        throw new UnauthorizedException('Invalid API key');
      }
    }

    // 2. Tenant ID header
    if (!tenant) {
      const tenantId = request.headers[this.tenantIdHeader];
      if (tenantId) {
        tenant = await this.tenantManager.getTenant(tenantId);
        if (!tenant) {
          throw new UnauthorizedException('Invalid tenant ID');
        }
      }
    }

    // 3. Query parameter
    if (!tenant) {
      const tenantSlug = request.query[this.tenantQuery];
      if (tenantSlug) {
        tenant = await this.tenantManager.getTenantBySlug(tenantSlug);
        if (!tenant) {
          throw new UnauthorizedException('Invalid tenant');
        }
      }
    }

    // 4. Subdomain
    if (!tenant && this.useSubdomain) {
      const host = request.headers.host;
      if (host) {
        const subdomain = host.split('.')[0];
        if (subdomain && subdomain !== 'www') {
          tenant = await this.tenantManager.getTenantBySlug(subdomain);
        }
      }
    }

    // Check if tenant is required
    if (!tenant && !this.allowAnonymous) {
      throw new UnauthorizedException('Tenant context required');
    }

    // Validate tenant status
    if (tenant && tenant.status !== TenantStatus.ACTIVE) {
      throw new ForbiddenException(
        `Tenant is ${tenant.status}. Please contact support.`,
      );
    }

    // Attach tenant to request
    if (tenant) {
      request.tenant = {
        tenant,
        metadata: {},
      };
    }

    return true;
  }
}
