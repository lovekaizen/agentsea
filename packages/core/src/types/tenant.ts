/**
 * Multi-Tenancy Types
 * Provides tenant isolation and management capabilities
 */

/**
 * Tenant entity
 */
export interface Tenant {
  /** Unique tenant identifier */
  id: string;

  /** Tenant name */
  name: string;

  /** Tenant slug (URL-friendly identifier) */
  slug: string;

  /** Tenant metadata */
  metadata?: Record<string, unknown>;

  /** Tenant settings */
  settings?: TenantSettings;

  /** Tenant status */
  status: TenantStatus;

  /** Creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Tenant status
 */
export enum TenantStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  INACTIVE = 'inactive',
}

/**
 * Tenant settings
 */
export interface TenantSettings {
  /** Maximum agents allowed */
  maxAgents?: number;

  /** Maximum conversations per agent */
  maxConversations?: number;

  /** Maximum requests per minute */
  rateLimit?: number;

  /** Data retention period in days */
  dataRetentionDays?: number;

  /** Allowed providers */
  allowedProviders?: string[];

  /** Custom settings */
  custom?: Record<string, unknown>;
}

/**
 * Tenant context - injected into request lifecycle
 */
export interface TenantContext {
  /** Current tenant */
  tenant: Tenant;

  /** User ID (optional, for user-level scoping within tenant) */
  userId?: string;

  /** Request metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Tenant API key for authentication
 */
export interface TenantApiKey {
  /** API key ID */
  id: string;

  /** Tenant ID */
  tenantId: string;

  /** API key (hashed) */
  key: string;

  /** API key name/description */
  name: string;

  /** Scopes/permissions */
  scopes: string[];

  /** Expiration date (optional) */
  expiresAt?: Date;

  /** Creation timestamp */
  createdAt: Date;

  /** Last used timestamp */
  lastUsedAt?: Date;

  /** Active status */
  isActive: boolean;
}

/**
 * Tenant quota tracking
 */
export interface TenantQuota {
  /** Tenant ID */
  tenantId: string;

  /** Resource type (e.g., 'requests', 'tokens', 'storage') */
  resource: string;

  /** Used amount */
  used: number;

  /** Limit amount */
  limit: number;

  /** Period (e.g., 'daily', 'monthly') */
  period: 'hourly' | 'daily' | 'monthly';

  /** Period start timestamp */
  periodStart: Date;

  /** Period end timestamp */
  periodEnd: Date;
}

/**
 * Tenant storage interface for persistence
 */
export interface TenantStorage {
  /**
   * Create a new tenant
   */
  createTenant(
    tenant: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Tenant>;

  /**
   * Get tenant by ID
   */
  getTenant(tenantId: string): Promise<Tenant | null>;

  /**
   * Get tenant by slug
   */
  getTenantBySlug(slug: string): Promise<Tenant | null>;

  /**
   * Update tenant
   */
  updateTenant(tenantId: string, updates: Partial<Tenant>): Promise<Tenant>;

  /**
   * Delete tenant
   */
  deleteTenant(tenantId: string): Promise<void>;

  /**
   * List all tenants
   */
  listTenants(options?: {
    limit?: number;
    offset?: number;
    status?: TenantStatus;
  }): Promise<{ tenants: Tenant[]; total: number }>;

  /**
   * Create API key for tenant
   */
  createApiKey(
    apiKey: Omit<TenantApiKey, 'id' | 'createdAt'>,
  ): Promise<TenantApiKey>;

  /**
   * Get API key by key value
   */
  getApiKeyByKey(key: string): Promise<TenantApiKey | null>;

  /**
   * Revoke API key
   */
  revokeApiKey(apiKeyId: string): Promise<void>;

  /**
   * Update quota
   */
  updateQuota(quota: TenantQuota): Promise<void>;

  /**
   * Get quota
   */
  getQuota(
    tenantId: string,
    resource: string,
    period: string,
  ): Promise<TenantQuota | null>;
}

/**
 * Tenant resolver - extracts tenant from request
 */
export interface TenantResolver {
  /**
   * Resolve tenant from context (e.g., headers, subdomain, API key)
   */
  resolve(context: unknown): Promise<TenantContext | null>;
}
