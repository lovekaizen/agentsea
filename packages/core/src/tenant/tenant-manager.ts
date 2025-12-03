/**
 * Tenant Manager
 * Manages tenant lifecycle and operations
 */

import { randomBytes, createHash } from 'crypto';
import {
  Tenant,
  TenantApiKey,
  TenantStatus,
  TenantStorage,
} from '../types/tenant';

export interface TenantManagerConfig {
  /** Tenant storage implementation */
  storage: TenantStorage;

  /** Default tenant settings */
  defaultSettings?: Tenant['settings'];
}

export class TenantManager {
  private storage: TenantStorage;
  private defaultSettings: Tenant['settings'];

  constructor(config: TenantManagerConfig) {
    this.storage = config.storage;
    this.defaultSettings = config.defaultSettings || {
      maxAgents: 10,
      maxConversations: 100,
      rateLimit: 100, // requests per minute
      dataRetentionDays: 90,
    };
  }

  /**
   * Create a new tenant
   */
  async createTenant(data: {
    name: string;
    slug: string;
    metadata?: Record<string, unknown>;
    settings?: Tenant['settings'];
  }): Promise<Tenant> {
    // Check if slug already exists
    const existing = await this.storage.getTenantBySlug(data.slug);
    if (existing) {
      throw new Error(`Tenant with slug "${data.slug}" already exists`);
    }

    const tenant = await this.storage.createTenant({
      name: data.name,
      slug: data.slug,
      metadata: data.metadata,
      settings: { ...this.defaultSettings, ...data.settings },
      status: TenantStatus.ACTIVE,
    });

    return tenant;
  }

  /**
   * Get tenant by ID
   */
  async getTenant(tenantId: string): Promise<Tenant | null> {
    return this.storage.getTenant(tenantId);
  }

  /**
   * Get tenant by slug
   */
  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    return this.storage.getTenantBySlug(slug);
  }

  /**
   * Update tenant
   */
  async updateTenant(
    tenantId: string,
    updates: Partial<Tenant>,
  ): Promise<Tenant> {
    const tenant = await this.storage.getTenant(tenantId);
    if (!tenant) {
      throw new Error(`Tenant "${tenantId}" not found`);
    }

    return this.storage.updateTenant(tenantId, updates);
  }

  /**
   * Suspend tenant
   */
  async suspendTenant(tenantId: string): Promise<Tenant> {
    return this.updateTenant(tenantId, { status: TenantStatus.SUSPENDED });
  }

  /**
   * Activate tenant
   */
  async activateTenant(tenantId: string): Promise<Tenant> {
    return this.updateTenant(tenantId, { status: TenantStatus.ACTIVE });
  }

  /**
   * Delete tenant and all associated data
   */
  async deleteTenant(tenantId: string): Promise<void> {
    await this.storage.deleteTenant(tenantId);
  }

  /**
   * List tenants
   */
  async listTenants(options?: {
    limit?: number;
    offset?: number;
    status?: TenantStatus;
  }): Promise<{ tenants: Tenant[]; total: number }> {
    return this.storage.listTenants(options);
  }

  /**
   * Generate API key for tenant
   */
  async createApiKey(
    tenantId: string,
    data: {
      name: string;
      scopes?: string[];
      expiresAt?: Date;
    },
  ): Promise<{ apiKey: TenantApiKey; plainKey: string }> {
    const tenant = await this.storage.getTenant(tenantId);
    if (!tenant) {
      throw new Error(`Tenant "${tenantId}" not found`);
    }

    // Generate random API key
    const plainKey = `agentsea_${randomBytes(32).toString('hex')}`;
    const hashedKey = this.hashApiKey(plainKey);

    const apiKey = await this.storage.createApiKey({
      tenantId,
      key: hashedKey,
      name: data.name,
      scopes: data.scopes || ['*'],
      expiresAt: data.expiresAt,
      isActive: true,
    });

    return { apiKey, plainKey };
  }

  /**
   * Verify API key and return tenant
   */
  async verifyApiKey(plainKey: string): Promise<Tenant | null> {
    const hashedKey = this.hashApiKey(plainKey);
    const apiKey = await this.storage.getApiKeyByKey(hashedKey);

    if (!apiKey) {
      return null;
    }

    // Check if key is active
    if (!apiKey.isActive) {
      return null;
    }

    // Check if key is expired
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return null;
    }

    // Get tenant
    const tenant = await this.storage.getTenant(apiKey.tenantId);
    if (!tenant || tenant.status !== TenantStatus.ACTIVE) {
      return null;
    }

    return tenant;
  }

  /**
   * Revoke API key
   */
  async revokeApiKey(apiKeyId: string): Promise<void> {
    await this.storage.revokeApiKey(apiKeyId);
  }

  /**
   * Check quota for tenant
   */
  async checkQuota(
    tenantId: string,
    resource: string,
    amount: number = 1,
  ): Promise<{ allowed: boolean; remaining: number }> {
    const period = 'hourly';
    const quota = await this.storage.getQuota(tenantId, resource, period);

    if (!quota) {
      // No quota set, allow by default
      return { allowed: true, remaining: Infinity };
    }

    const remaining = quota.limit - quota.used;
    const allowed = quota.used + amount <= quota.limit;

    return { allowed, remaining };
  }

  /**
   * Increment quota usage
   */
  async incrementQuota(
    tenantId: string,
    resource: string,
    amount: number = 1,
  ): Promise<void> {
    const period = 'hourly';
    const now = new Date();

    let quota = await this.storage.getQuota(tenantId, resource, period);

    if (!quota) {
      // Create new quota period
      const tenant = await this.storage.getTenant(tenantId);
      const limit = this.getResourceLimit(tenant, resource);

      quota = {
        tenantId,
        resource,
        used: amount,
        limit,
        period,
        periodStart: now,
        periodEnd: new Date(now.getTime() + 60 * 60 * 1000), // 1 hour
      };
    } else {
      // Check if period expired
      if (now > quota.periodEnd) {
        // Reset quota for new period
        quota.used = amount;
        quota.periodStart = now;
        quota.periodEnd = new Date(now.getTime() + 60 * 60 * 1000);
      } else {
        // Increment usage
        quota.used += amount;
      }
    }

    await this.storage.updateQuota(quota);
  }

  /**
   * Hash API key for storage
   */
  private hashApiKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  /**
   * Get resource limit from tenant settings
   */
  private getResourceLimit(tenant: Tenant | null, resource: string): number {
    if (!tenant?.settings) {
      return 1000; // Default limit
    }

    switch (resource) {
      case 'requests':
        return tenant.settings.rateLimit || 100;
      case 'agents':
        return tenant.settings.maxAgents || 10;
      case 'conversations':
        return tenant.settings.maxConversations || 100;
      default:
        return 1000;
    }
  }
}
