import {
  UnauthorizedException,
  ForbiddenException,
  type ExecutionContext,
} from '@nestjs/common';
import { TenantStatus, type Tenant } from '@lov3kaizen/agentsea-core';
import { describe, it, expect, vi } from 'vitest';

import { TenantGuard } from '../guards/tenant.guard';

function tenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    id: 't1',
    name: 'Acme',
    slug: 'acme',
    status: TenantStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeManager() {
  return {
    verifyApiKey: vi.fn(),
    getTenant: vi.fn(),
    getTenantBySlug: vi.fn(),
  };
}

function ctxFor(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('TenantGuard', () => {
  it('resolves a tenant from a valid API key and attaches it to the request', async () => {
    const manager = makeManager();
    const t = tenant();
    manager.verifyApiKey.mockResolvedValue(t);
    const guard = new TenantGuard({ tenantManager: manager as any });
    const request: Record<string, any> = {
      headers: { 'x-api-key': 'secret' },
      query: {},
    };

    const result = await guard.canActivate(ctxFor(request));

    expect(result).toBe(true);
    expect(manager.verifyApiKey).toHaveBeenCalledWith('secret');
    expect(request.tenant).toEqual({ tenant: t, metadata: {} });
  });

  it('throws UnauthorizedException for an invalid API key', async () => {
    const manager = makeManager();
    manager.verifyApiKey.mockResolvedValue(null);
    const guard = new TenantGuard({ tenantManager: manager as any });
    await expect(
      guard.canActivate(ctxFor({ headers: { 'x-api-key': 'bad' }, query: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('resolves a tenant from the tenant-id header', async () => {
    const manager = makeManager();
    const t = tenant({ id: 'abc' });
    manager.getTenant.mockResolvedValue(t);
    const guard = new TenantGuard({ tenantManager: manager as any });
    const request: Record<string, any> = {
      headers: { 'x-tenant-id': 'abc' },
      query: {},
    };
    await guard.canActivate(ctxFor(request));
    expect(manager.getTenant).toHaveBeenCalledWith('abc');
    expect(request.tenant.tenant).toBe(t);
  });

  it('resolves a tenant from the query parameter by slug', async () => {
    const manager = makeManager();
    const t = tenant({ slug: 'acme' });
    manager.getTenantBySlug.mockResolvedValue(t);
    const guard = new TenantGuard({ tenantManager: manager as any });
    const request: Record<string, any> = {
      headers: {},
      query: { tenant: 'acme' },
    };
    await guard.canActivate(ctxFor(request));
    expect(manager.getTenantBySlug).toHaveBeenCalledWith('acme');
  });

  it('honors custom header names', async () => {
    const manager = makeManager();
    manager.verifyApiKey.mockResolvedValue(tenant());
    const guard = new TenantGuard({
      tenantManager: manager as any,
      apiKeyHeader: 'authorization',
    });
    await guard.canActivate(
      ctxFor({ headers: { authorization: 'k' }, query: {} }),
    );
    expect(manager.verifyApiKey).toHaveBeenCalledWith('k');
  });

  it('throws when no tenant is found and anonymous access is not allowed', async () => {
    const manager = makeManager();
    const guard = new TenantGuard({ tenantManager: manager as any });
    await expect(
      guard.canActivate(ctxFor({ headers: {}, query: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('allows anonymous requests when allowAnonymous is true', async () => {
    const manager = makeManager();
    const guard = new TenantGuard({
      tenantManager: manager as any,
      allowAnonymous: true,
    });
    const request: Record<string, any> = { headers: {}, query: {} };
    const result = await guard.canActivate(ctxFor(request));
    expect(result).toBe(true);
    expect(request.tenant).toBeUndefined();
  });

  it('throws ForbiddenException for a non-active tenant', async () => {
    const manager = makeManager();
    manager.verifyApiKey.mockResolvedValue(
      tenant({ status: TenantStatus.SUSPENDED }),
    );
    const guard = new TenantGuard({ tenantManager: manager as any });
    await expect(
      guard.canActivate(ctxFor({ headers: { 'x-api-key': 'k' }, query: {} })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('resolves a tenant from a subdomain when enabled', async () => {
    const manager = makeManager();
    const t = tenant({ slug: 'acme' });
    manager.getTenantBySlug.mockResolvedValue(t);
    const guard = new TenantGuard({
      tenantManager: manager as any,
      useSubdomain: true,
    });
    const request: Record<string, any> = {
      headers: { host: 'acme.example.com' },
      query: {},
    };
    await guard.canActivate(ctxFor(request));
    expect(manager.getTenantBySlug).toHaveBeenCalledWith('acme');
  });
});
