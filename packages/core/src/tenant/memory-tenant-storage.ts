/**
 * In-Memory Tenant Storage
 * Simple in-memory implementation for development/testing
 */

import {
  Tenant,
  TenantApiKey,
  TenantQuota,
  TenantStatus,
  TenantStorage,
} from '../types/tenant';

export class MemoryTenantStorage implements TenantStorage {
  private tenants: Map<string, Tenant> = new Map();
  private tenantsBySlug: Map<string, string> = new Map();
  private apiKeys: Map<string, TenantApiKey> = new Map();
  private apiKeysByKey: Map<string, string> = new Map();
  private quotas: Map<string, TenantQuota> = new Map();
  private nextId = 1;
  private nextApiKeyId = 1;

  createTenant(
    data: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Tenant> {
    const id = `tenant_${this.nextId++}`;
    const now = new Date();

    const tenant: Tenant = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.tenants.set(id, tenant);
    this.tenantsBySlug.set(data.slug, id);

    return Promise.resolve(tenant);
  }

  getTenant(tenantId: string): Promise<Tenant | null> {
    return Promise.resolve(this.tenants.get(tenantId) || null);
  }

  getTenantBySlug(slug: string): Promise<Tenant | null> {
    const tenantId = this.tenantsBySlug.get(slug);
    if (!tenantId) return Promise.resolve(null);
    return this.getTenant(tenantId);
  }

  updateTenant(tenantId: string, updates: Partial<Tenant>): Promise<Tenant> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      throw new Error(`Tenant "${tenantId}" not found`);
    }

    const updated: Tenant = {
      ...tenant,
      ...updates,
      id: tenant.id, // Prevent ID change
      updatedAt: new Date(),
    };

    this.tenants.set(tenantId, updated);

    // Update slug index if changed
    if (updates.slug && updates.slug !== tenant.slug) {
      this.tenantsBySlug.delete(tenant.slug);
      this.tenantsBySlug.set(updates.slug, tenantId);
    }

    return Promise.resolve(updated);
  }

  deleteTenant(tenantId: string): Promise<void> {
    const tenant = this.tenants.get(tenantId);
    if (tenant) {
      this.tenantsBySlug.delete(tenant.slug);
      this.tenants.delete(tenantId);

      // Clean up associated data
      const apiKeyEntries = Array.from(this.apiKeys.entries());
      for (const [keyId, apiKey] of apiKeyEntries) {
        if (apiKey.tenantId === tenantId) {
          this.apiKeysByKey.delete(apiKey.key);
          this.apiKeys.delete(keyId);
        }
      }

      const quotaEntries = Array.from(this.quotas.entries());
      for (const [quotaKey] of quotaEntries) {
        if (quotaKey.startsWith(`${tenantId}:`)) {
          this.quotas.delete(quotaKey);
        }
      }
    }
    return Promise.resolve();
  }

  listTenants(options?: {
    limit?: number;
    offset?: number;
    status?: TenantStatus;
  }): Promise<{ tenants: Tenant[]; total: number }> {
    let allTenants = Array.from(this.tenants.values());

    // Filter by status
    if (options?.status) {
      allTenants = allTenants.filter((t) => t.status === options.status);
    }

    const total = allTenants.length;

    // Apply pagination
    const offset = options?.offset || 0;
    const limit = options?.limit || 100;
    const tenants = allTenants.slice(offset, offset + limit);

    return Promise.resolve({ tenants, total });
  }

  createApiKey(
    data: Omit<TenantApiKey, 'id' | 'createdAt'>,
  ): Promise<TenantApiKey> {
    const id = `key_${this.nextApiKeyId++}`;
    const now = new Date();

    const apiKey: TenantApiKey = {
      ...data,
      id,
      createdAt: now,
    };

    this.apiKeys.set(id, apiKey);
    this.apiKeysByKey.set(data.key, id);

    return Promise.resolve(apiKey);
  }

  getApiKeyByKey(key: string): Promise<TenantApiKey | null> {
    const keyId = this.apiKeysByKey.get(key);
    if (!keyId) return Promise.resolve(null);
    return Promise.resolve(this.apiKeys.get(keyId) || null);
  }

  revokeApiKey(apiKeyId: string): Promise<void> {
    const apiKey = this.apiKeys.get(apiKeyId);
    if (apiKey) {
      this.apiKeysByKey.delete(apiKey.key);
      this.apiKeys.delete(apiKeyId);
    }
    return Promise.resolve();
  }

  updateQuota(quota: TenantQuota): Promise<void> {
    const key = `${quota.tenantId}:${quota.resource}:${quota.period}`;
    this.quotas.set(key, quota);
    return Promise.resolve();
  }

  getQuota(
    tenantId: string,
    resource: string,
    period: string,
  ): Promise<TenantQuota | null> {
    const key = `${tenantId}:${resource}:${period}`;
    return Promise.resolve(this.quotas.get(key) || null);
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.tenants.clear();
    this.tenantsBySlug.clear();
    this.apiKeys.clear();
    this.apiKeysByKey.clear();
    this.quotas.clear();
    this.nextId = 1;
    this.nextApiKeyId = 1;
  }
}
