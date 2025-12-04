# Multi-Tenancy Guide

AgentSea ADK includes comprehensive multi-tenancy support, enabling you to build SaaS applications with complete tenant isolation and management.

## Table of Contents

- [Overview](#overview)
- [Core Concepts](#core-concepts)
- [Quick Start](#quick-start)
- [Tenant Management](#tenant-management)
- [API Key Authentication](#api-key-authentication)
- [Data Isolation](#data-isolation)
- [Quota Management](#quota-management)
- [NestJS Integration](#nestjs-integration)
- [Best Practices](#best-practices)

## Overview

Multi-tenancy allows multiple organizations (tenants) to use the same application instance while keeping their data completely isolated. AgentSea ADK provides:

- **Tenant Management**: Create, update, and manage tenant organizations
- **API Key Authentication**: Secure API keys for tenant identification
- **Data Isolation**: Tenant-scoped memory stores and conversations
- **Quota Management**: Track and limit resource usage per tenant
- **NestJS Integration**: Guards, decorators, and controllers for easy integration

## Core Concepts

### Tenant

A tenant represents an organization or customer using your application:

```typescript
interface Tenant {
  id: string; // Unique identifier
  name: string; // Display name
  slug: string; // URL-friendly identifier
  status: TenantStatus; // active | suspended | inactive
  settings: TenantSettings;
  createdAt: Date;
  updatedAt: Date;
}
```

### Tenant Context

The tenant context is injected into requests and contains tenant information:

```typescript
interface TenantContext {
  tenant: Tenant;
  userId?: string; // Optional user within tenant
  metadata?: Record<string, unknown>;
}
```

### Tenant Settings

Configurable limits and preferences per tenant:

```typescript
interface TenantSettings {
  maxAgents?: number;
  maxConversations?: number;
  rateLimit?: number; // Requests per minute
  dataRetentionDays?: number;
  allowedProviders?: string[];
}
```

## Quick Start

### 1. Install Dependencies

```bash
pnpm add @lov3kaizen/agentsea-core @lov3kaizen/agentsea-nestjs
```

### 2. Setup Tenant Manager

```typescript
import { TenantManager, MemoryTenantStorage } from '@lov3kaizen/agentsea-core';

// Create storage (use Redis/PostgreSQL in production)
const storage = new MemoryTenantStorage();

// Create tenant manager
const tenantManager = new TenantManager({
  storage,
  defaultSettings: {
    maxAgents: 10,
    maxConversations: 100,
    rateLimit: 100,
  },
});
```

### 3. Create a Tenant

```typescript
const tenant = await tenantManager.createTenant({
  name: 'Acme Corporation',
  slug: 'acme',
  metadata: {
    industry: 'Technology',
  },
  settings: {
    maxAgents: 20, // Override default
  },
});
```

### 4. Generate API Key

```typescript
const { apiKey, plainKey } = await tenantManager.createApiKey(tenant.id, {
  name: 'Production API Key',
  scopes: ['agents:read', 'agents:execute'],
});

console.log('API Key:', plainKey);
// Store plainKey securely and provide to tenant
```

## Tenant Management

### Create Tenant

```typescript
const tenant = await tenantManager.createTenant({
  name: 'Acme Corp',
  slug: 'acme',
  metadata: { plan: 'enterprise' },
  settings: {
    maxAgents: 50,
    rateLimit: 1000,
  },
});
```

### Get Tenant

```typescript
// By ID
const tenant = await tenantManager.getTenant('tenant_123');

// By slug
const tenant = await tenantManager.getTenantBySlug('acme');
```

### Update Tenant

```typescript
const updated = await tenantManager.updateTenant('tenant_123', {
  name: 'Acme Corporation Ltd',
  settings: {
    maxAgents: 100,
  },
});
```

### Suspend/Activate Tenant

```typescript
// Suspend (blocks all API access)
await tenantManager.suspendTenant('tenant_123');

// Reactivate
await tenantManager.activateTenant('tenant_123');
```

### Delete Tenant

```typescript
// Permanently delete tenant and all data
await tenantManager.deleteTenant('tenant_123');
```

### List Tenants

```typescript
const { tenants, total } = await tenantManager.listTenants({
  limit: 10,
  offset: 0,
  status: TenantStatus.ACTIVE,
});
```

## API Key Authentication

### Generate API Key

```typescript
const { apiKey, plainKey } = await tenantManager.createApiKey(tenant.id, {
  name: 'Mobile App Key',
  scopes: ['agents:execute', 'conversations:read'],
  expiresAt: new Date('2025-12-31'), // Optional expiration
});

// plainKey: "aigency_abc123..." - Give this to tenant
// apiKey: Stored version with hashed key
```

### Verify API Key

```typescript
const tenant = await tenantManager.verifyApiKey(requestApiKey);

if (!tenant) {
  throw new Error('Invalid or expired API key');
}

// Tenant is active and API key is valid
```

### Revoke API Key

```typescript
await tenantManager.revokeApiKey(apiKey.id);
```

## Data Isolation

### Tenant-Aware Memory

Use `TenantBufferMemory` for automatic tenant isolation:

```typescript
import { TenantBufferMemory } from '@lov3kaizen/agentsea-core';

const memory = new TenantBufferMemory();

// Save messages for Tenant A
memory.save('conv-1', messages, 'tenant_a');

// Save messages for Tenant B (same conversation ID, different tenant)
memory.save('conv-1', messages, 'tenant_b');

// Load messages (isolated by tenant)
const messagesA = memory.load('conv-1', 'tenant_a');
const messagesB = memory.load('conv-1', 'tenant_b');
```

### Tenant-Scoped Conversations

```typescript
// Prefix conversation IDs with tenant ID
const conversationId = `${tenantId}:support-${userId}`;

const context: AgentContext = {
  conversationId,
  sessionData: { tenantId },
  history: [],
};

const response = await agent.execute(input, context);
```

### Clear Tenant Data

```typescript
// Clear all data for a specific tenant
memory.clearTenant('tenant_123');

// Get statistics per tenant
const stats = memory.getTenantStats();
// [{ tenantId: 'tenant_a', conversationCount: 5, messageCount: 120 }, ...]
```

## Quota Management

### Check Quota

```typescript
const { allowed, remaining } = await tenantManager.checkQuota(
  tenantId,
  'requests',
);

if (!allowed) {
  throw new Error('Quota exceeded');
}
```

### Increment Quota

```typescript
// After processing a request
await tenantManager.incrementQuota(tenantId, 'requests', 1);

// After token usage
await tenantManager.incrementQuota(tenantId, 'tokens', tokensUsed);
```

### Resource Types

Common quota resources:

- `requests` - API requests
- `tokens` - AI model tokens
- `agents` - Number of agents
- `conversations` - Number of conversations
- `storage` - Storage usage in bytes

## NestJS Integration

### Setup Tenant Guard

```typescript
import { Module } from '@nestjs/common';
import { TenantGuard, TenantManager } from '@lov3kaizen/agentsea-nestjs';

@Module({
  providers: [
    {
      provide: TenantGuard,
      useFactory: (tenantManager: TenantManager) => {
        return new TenantGuard({
          tenantManager,
          apiKeyHeader: 'x-api-key',
          tenantIdHeader: 'x-tenant-id',
          useSubdomain: false,
        });
      },
      inject: [TenantManager],
    },
  ],
})
export class AppModule {}
```

### Protect Routes

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { TenantGuard, Tenant, TenantContext } from '@lov3kaizen/agentsea-nestjs';

@Controller('agents')
@UseGuards(TenantGuard)
export class AgentsController {
  @Get()
  async listAgents(@Tenant() tenant: TenantContext) {
    // tenant.tenant.id, tenant.tenant.name, etc.
    return this.agentService.findAll(tenant.tenant.id);
  }
}
```

### Use Tenant Decorator

```typescript
import { TenantId } from '@lov3kaizen/agentsea-nestjs';

@Controller('agents')
export class AgentsController {
  @Post(':id/execute')
  async executeAgent(
    @TenantId() tenantId: string,
    @Param('id') agentId: string,
    @Body() dto: ExecuteDto,
  ) {
    // Use tenantId directly
    return this.agentService.execute(tenantId, agentId, dto);
  }
}
```

### Tenant Management Endpoints

```typescript
import { Controller } from '@nestjs/common';
import { TenantController } from '@lov3kaizen/agentsea-nestjs';

// Provides endpoints:
// POST   /tenants
// GET    /tenants
// GET    /tenants/:id
// PUT    /tenants/:id
// DELETE /tenants/:id
// POST   /tenants/:id/suspend
// POST   /tenants/:id/activate
// POST   /tenants/:id/api-keys
// GET    /tenants/:id/quota/:resource

@Controller('tenants')
export class MyTenantController extends TenantController {
  // Add custom endpoints or override behavior
}
```

### Full Example

```typescript
import { Module } from '@nestjs/common';
import {
  TenantManager,
  MemoryTenantStorage,
  TenantGuard,
  TenantController,
} from '@lov3kaizen/agentsea-nestjs';

@Module({
  providers: [
    {
      provide: 'TENANT_STORAGE',
      useValue: new MemoryTenantStorage(),
    },
    {
      provide: TenantManager,
      useFactory: (storage) => {
        return new TenantManager({ storage });
      },
      inject: ['TENANT_STORAGE'],
    },
    {
      provide: TenantGuard,
      useFactory: (manager) => {
        return new TenantGuard({
          tenantManager: manager,
          apiKeyHeader: 'x-api-key',
        });
      },
      inject: [TenantManager],
    },
  ],
  controllers: [TenantController],
  exports: [TenantManager],
})
export class MultiTenancyModule {}
```

## Best Practices

### 1. Use Tenant Prefixes

Always prefix resource IDs with tenant ID:

```typescript
const conversationId = `${tenantId}:${userId}:${timestamp}`;
const agentId = `${tenantId}:agent:${name}`;
```

### 2. Validate Tenant Access

Always check if a user has access to a tenant's resources:

```typescript
async function getConversation(conversationId: string, tenantId: string) {
  if (!conversationId.startsWith(`${tenantId}:`)) {
    throw new ForbiddenException('Access denied');
  }
  return this.conversationService.find(conversationId);
}
```

### 3. Implement Quota Enforcement

Check quotas before processing requests:

```typescript
@Injectable()
export class QuotaInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.tenant?.tenant?.id;

    if (tenantId) {
      const { allowed } = await this.tenantManager.checkQuota(
        tenantId,
        'requests',
      );

      if (!allowed) {
        throw new TooManyRequestsException('Quota exceeded');
      }
    }

    const result = await next.handle().toPromise();

    // Increment after successful request
    if (tenantId) {
      await this.tenantManager.incrementQuota(tenantId, 'requests');
    }

    return result;
  }
}
```

### 4. Use Production Storage

Replace `MemoryTenantStorage` with persistent storage in production:

```typescript
// PostgreSQL example
class PostgresTenantStorage implements TenantStorage {
  async createTenant(data) {
    return this.db.query('INSERT INTO tenants ...', data);
  }
  // ... implement other methods
}

// Redis for quotas
class RedisTenantStorage implements TenantStorage {
  async updateQuota(quota) {
    await this.redis.setex(
      `quota:${quota.tenantId}:${quota.resource}`,
      3600,
      JSON.stringify(quota),
    );
  }
  // ...
}
```

### 5. Monitor Tenant Usage

Track metrics per tenant:

```typescript
import { MetricsCollector } from '@lov3kaizen/agentsea-core';

const metrics = new MetricsCollector();

metrics.recordExecutionTime('agent.execute', duration, {
  tenantId,
  agentId,
});

metrics.incrementCounter('requests.total', 1, { tenantId });
```

### 6. Implement Tenant Isolation Tests

```typescript
describe('Tenant Isolation', () => {
  it('should isolate tenant data', async () => {
    const memory = new TenantBufferMemory();

    memory.save('conv-1', messagesA, 'tenant-a');
    memory.save('conv-1', messagesB, 'tenant-b');

    const loadedA = memory.load('conv-1', 'tenant-a');
    const loadedB = memory.load('conv-1', 'tenant-b');

    expect(loadedA).not.toEqual(loadedB);
  });
});
```

### 7. Secure API Key Storage

- Never log API keys
- Hash keys before storing
- Use HTTPS only
- Rotate keys regularly
- Implement key expiration

```typescript
// Generate with expiration
const { plainKey } = await tenantManager.createApiKey(tenantId, {
  name: 'Temporary Key',
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
});
```

## Complete Example

See [`examples/multi-tenancy-example.ts`](../examples/multi-tenancy-example.ts) for a complete working example demonstrating:

- Tenant creation and management
- API key generation and validation
- Data isolation with tenant-aware memory
- Quota tracking
- Tenant lifecycle management
- Multi-tenant agent execution

## Next Steps

- [NestJS Integration Guide](./NESTJS.md)
- [API Reference](./API.md)
- [Security Best Practices](./SECURITY.md)
