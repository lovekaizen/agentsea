/**
 * Registry Type Definitions
 */

import type { StorageAdapter } from './storage.types.js';
import type { EnvironmentConfig } from './environment.types.js';

/**
 * Registry configuration
 */
export interface RegistryConfig {
  storage: StorageAdapter;
  defaultEnvironment?: string;
  environments?: EnvironmentConfig[];
  caching?: CacheConfig;
  hooks?: RegistryHooks;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  enabled: boolean;
  ttl?: number; // Seconds
  maxSize?: number; // Max items
}

/**
 * Registry event types
 */
export type RegistryEventType =
  | 'prompt:created'
  | 'prompt:updated'
  | 'prompt:deleted'
  | 'prompt:promoted'
  | 'prompt:rolledback'
  | 'version:created'
  | 'branch:created'
  | 'branch:merged'
  | 'branch:deleted'
  | 'test:created'
  | 'test:started'
  | 'test:ended'
  | 'review:created'
  | 'review:approved'
  | 'review:rejected'
  | 'review:merged';

/**
 * Registry event
 */
export interface RegistryEvent {
  type: RegistryEventType;
  promptId?: string;
  promptName?: string;
  version?: string;
  environment?: string;
  actor?: string;
  timestamp: Date;
  data?: Record<string, unknown>;
}

/**
 * Registry hooks
 */
export interface RegistryHooks {
  beforeCreate?: (prompt: unknown) => Promise<unknown>;
  afterCreate?: (prompt: unknown) => Promise<void>;
  beforeUpdate?: (prompt: unknown, updates: unknown) => Promise<unknown>;
  afterUpdate?: (prompt: unknown) => Promise<void>;
  beforeDelete?: (promptId: string) => Promise<boolean>;
  afterDelete?: (promptId: string) => Promise<void>;
  beforePromote?: (promotion: unknown) => Promise<unknown>;
  afterPromote?: (promotion: unknown) => Promise<void>;
}

/**
 * Registry statistics
 */
export interface RegistryStats {
  totalPrompts: number;
  totalVersions: number;
  promptsByEnvironment: Record<string, number>;
  promptsByStatus: Record<string, number>;
  activeTests: number;
  pendingReviews: number;
}

/**
 * Partial definition
 */
export interface PartialDefinition {
  name: string;
  template: string;
  description?: string;
  variables?: string[];
}
