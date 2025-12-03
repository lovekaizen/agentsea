/**
 * Tenant Controller
 * REST API endpoints for tenant management
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TenantManager, Tenant, TenantStatus } from '@lov3kaizen/agentsea-core';

export class CreateTenantDto {
  name!: string;
  slug!: string;
  metadata?: Record<string, unknown>;
  settings?: Tenant['settings'];
}

export class UpdateTenantDto {
  name?: string;
  slug?: string;
  metadata?: Record<string, unknown>;
  settings?: Tenant['settings'];
  status?: TenantStatus;
}

export class CreateApiKeyDto {
  name!: string;
  scopes?: string[];
  expiresAt?: Date;
}

export class ListTenantsQuery {
  limit?: number;
  offset?: number;
  status?: TenantStatus;
}

/**
 * Tenant Controller
 * Note: This should be protected with admin-level authentication in production
 */
@Controller('tenants')
export class TenantController {
  constructor(private readonly tenantManager: TenantManager) {}

  /**
   * Create a new tenant
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  createTenant(@Body() dto: CreateTenantDto): Promise<Tenant> {
    return this.tenantManager.createTenant(dto);
  }

  /**
   * List all tenants
   */
  @Get()
  listTenants(
    @Query() query: ListTenantsQuery,
  ): Promise<{ tenants: Tenant[]; total: number }> {
    return this.tenantManager.listTenants({
      limit: query.limit ? Number(query.limit) : undefined,
      offset: query.offset ? Number(query.offset) : undefined,
      status: query.status,
    });
  }

  /**
   * Get tenant by ID
   */
  @Get(':id')
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  getTenant(@Param('id') id: string): Promise<Tenant | null> {
    return this.tenantManager.getTenant(id);
  }

  /**
   * Update tenant
   */
  @Put(':id')
  updateTenant(
    @Param('id') id: string,
    @Body() dto: UpdateTenantDto,
  ): Promise<Tenant> {
    return this.tenantManager.updateTenant(id, dto);
  }

  /**
   * Delete tenant
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTenant(@Param('id') id: string): Promise<void> {
    await this.tenantManager.deleteTenant(id);
  }

  /**
   * Suspend tenant
   */
  @Post(':id/suspend')
  suspendTenant(@Param('id') id: string): Promise<Tenant> {
    return this.tenantManager.suspendTenant(id);
  }

  /**
   * Activate tenant
   */
  @Post(':id/activate')
  activateTenant(@Param('id') id: string): Promise<Tenant> {
    return this.tenantManager.activateTenant(id);
  }

  /**
   * Create API key for tenant
   */
  @Post(':id/api-keys')
  @HttpCode(HttpStatus.CREATED)
  async createApiKey(
    @Param('id') id: string,
    @Body() dto: CreateApiKeyDto,
  ): Promise<{ apiKey: string; name: string; scopes: string[] }> {
    const result = await this.tenantManager.createApiKey(id, dto);
    return {
      apiKey: result.plainKey,
      name: result.apiKey.name,
      scopes: result.apiKey.scopes,
    };
  }

  /**
   * Check quota for tenant
   */
  @Get(':id/quota/:resource')
  checkQuota(
    @Param('id') id: string,
    @Param('resource') resource: string,
  ): Promise<{ allowed: boolean; remaining: number }> {
    return this.tenantManager.checkQuota(id, resource);
  }
}
