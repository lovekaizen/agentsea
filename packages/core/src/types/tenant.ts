// Re-export tenant types from the types package for backward compatibility
// TenantStatus is an enum (runtime value); everything else is type-only and
// must use `export type` so the ESM build doesn't emit phantom value imports.
export { TenantStatus } from '@lov3kaizen/agentsea-types';
export type {
  Tenant,
  TenantSettings,
  TenantContext,
  TenantApiKey,
  TenantQuota,
  TenantStorage,
  TenantResolver,
} from '@lov3kaizen/agentsea-types';
