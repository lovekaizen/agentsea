/**
 * Tenant-Aware Buffer Memory
 * Provides tenant isolation for in-memory conversation storage
 */

import { Message } from '../types';

/**
 * Tenant-scoped buffer memory store
 * Isolates conversation data by tenant ID
 * Note: This does not implement MemoryStore as it has tenant-specific signatures
 */
export class TenantBufferMemory {
  private store = new Map<string, Map<string, Message[]>>();

  constructor(private maxMessages?: number) {}

  /**
   * Save messages to memory with tenant isolation
   */
  save(conversationId: string, messages: Message[], tenantId?: string): void {
    const tenant = tenantId || 'default';
    let messagesToStore = messages;

    // Truncate if max messages is set
    if (this.maxMessages && messages.length > this.maxMessages) {
      messagesToStore = messages.slice(-this.maxMessages);
    }

    // Get or create tenant store
    let tenantStore = this.store.get(tenant);
    if (!tenantStore) {
      tenantStore = new Map();
      this.store.set(tenant, tenantStore);
    }

    tenantStore.set(conversationId, messagesToStore);
  }

  /**
   * Load messages from memory for specific tenant
   */
  load(conversationId: string, tenantId?: string): Message[] {
    const tenant = tenantId || 'default';
    const tenantStore = this.store.get(tenant);
    if (!tenantStore) return [];
    return tenantStore.get(conversationId) || [];
  }

  /**
   * Clear messages for a conversation in specific tenant
   */
  clear(conversationId: string, tenantId?: string): void {
    const tenant = tenantId || 'default';
    const tenantStore = this.store.get(tenant);
    if (tenantStore) {
      tenantStore.delete(conversationId);
    }
  }

  /**
   * Clear all conversations for a specific tenant
   */
  clearTenant(tenantId: string): void {
    this.store.delete(tenantId);
  }

  /**
   * Clear all conversations across all tenants
   */
  clearAll(): void {
    this.store.clear();
  }

  /**
   * Get all conversation IDs for a specific tenant
   */
  getConversationIds(tenantId?: string): string[] {
    const tenant = tenantId || 'default';
    const tenantStore = this.store.get(tenant);
    if (!tenantStore) return [];
    return Array.from(tenantStore.keys());
  }

  /**
   * Get total number of conversations for a specific tenant
   */
  size(tenantId?: string): number {
    if (tenantId) {
      const tenantStore = this.store.get(tenantId);
      return tenantStore ? tenantStore.size : 0;
    }
    // Return total across all tenants
    let total = 0;
    const tenantStores = Array.from(this.store.values());
    for (const tenantStore of tenantStores) {
      total += tenantStore.size;
    }
    return total;
  }

  /**
   * Get all tenant IDs
   */
  getTenantIds(): string[] {
    return Array.from(this.store.keys());
  }

  /**
   * Get statistics per tenant
   */
  getTenantStats(): Array<{
    tenantId: string;
    conversationCount: number;
    messageCount: number;
  }> {
    const stats: Array<{
      tenantId: string;
      conversationCount: number;
      messageCount: number;
    }> = [];

    const entries = Array.from(this.store.entries());
    for (const [tenantId, tenantStore] of entries) {
      let messageCount = 0;
      const messageArrays = Array.from(tenantStore.values());
      for (const messages of messageArrays) {
        messageCount += messages.length;
      }

      stats.push({
        tenantId,
        conversationCount: tenantStore.size,
        messageCount,
      });
    }

    return stats;
  }
}
