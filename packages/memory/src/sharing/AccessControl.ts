/**
 * AccessControl
 *
 * Permission and access control for multi-agent memory systems.
 */

import { EventEmitter } from 'eventemitter3';
import type { MemoryEntry, AccessControlConfig } from '../types/index.js';

/**
 * Permission levels
 */
export type Permission = 'none' | 'read' | 'write' | 'admin';

/**
 * Permission rule
 */
export interface PermissionRule {
  id: string;
  agentId: string; // Use '*' for all agents
  resource: string; // namespace, entry ID, or '*' for all
  permission: Permission;
  conditions?: PermissionCondition[];
  expiresAt?: number;
  createdBy: string;
  createdAt: number;
}

/**
 * Permission condition
 */
export interface PermissionCondition {
  type: 'time-range' | 'entry-type' | 'importance' | 'custom';
  value: unknown;
}

/**
 * Access request
 */
export interface AccessRequest {
  agentId: string;
  resource: string;
  action: 'read' | 'write' | 'delete' | 'admin';
  entry?: MemoryEntry;
}

/**
 * Access result
 */
export interface AccessResult {
  allowed: boolean;
  reason?: string;
  matchedRule?: PermissionRule;
}

/**
 * Access log entry
 */
export interface AccessLogEntry {
  timestamp: number;
  agentId: string;
  resource: string;
  action: string;
  allowed: boolean;
  reason?: string;
}

/**
 * Access control events
 */
export interface AccessControlEvents {
  accessGranted: (request: AccessRequest) => void;
  accessDenied: (request: AccessRequest, reason: string) => void;
  ruleAdded: (rule: PermissionRule) => void;
  ruleRemoved: (ruleId: string) => void;
}

/**
 * Access control manager
 */
export class AccessControl extends EventEmitter<AccessControlEvents> {
  private config: Required<AccessControlConfig>;
  private rules: Map<string, PermissionRule> = new Map();
  private accessLog: AccessLogEntry[] = [];
  private maxLogSize = 1000;

  constructor(config: AccessControlConfig = {}) {
    super();
    this.config = {
      roles: config.roles ?? {},
      defaultRole: config.defaultRole ?? 'user',
      adminUsers: config.adminUsers ?? [],
      defaultPermission: config.defaultPermission ?? 'read',
      enableAuditLog: config.enableAuditLog ?? true,
      strictMode: config.strictMode ?? false,
      maxRulesPerAgent: config.maxRulesPerAgent ?? 100,
    };

    // Add default rules
    if (!this.config.strictMode) {
      this.addRule({
        id: 'default-read',
        agentId: '*',
        resource: '*',
        permission: this.config.defaultPermission as Permission,
        createdBy: 'system',
        createdAt: Date.now(),
      });
    }
  }

  /**
   * Add a permission rule
   */
  addRule(rule: PermissionRule): boolean {
    // Check max rules per agent
    if (rule.agentId !== '*') {
      const agentRules = Array.from(this.rules.values()).filter(
        (r) => r.agentId === rule.agentId,
      );
      if (agentRules.length >= this.config.maxRulesPerAgent) {
        return false;
      }
    }

    this.rules.set(rule.id, rule);
    this.emit('ruleAdded', rule);
    return true;
  }

  /**
   * Remove a permission rule
   */
  removeRule(ruleId: string): boolean {
    const existed = this.rules.delete(ruleId);
    if (existed) {
      this.emit('ruleRemoved', ruleId);
    }
    return existed;
  }

  /**
   * Get rule by ID
   */
  getRule(ruleId: string): PermissionRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Get all rules for an agent
   */
  getAgentRules(agentId: string): PermissionRule[] {
    return Array.from(this.rules.values()).filter(
      (r) => r.agentId === agentId || r.agentId === '*',
    );
  }

  /**
   * Check if access is allowed
   */
  checkAccess(request: AccessRequest): AccessResult {
    // Find applicable rules
    const applicableRules = this.findApplicableRules(request);

    // No rules found
    if (applicableRules.length === 0) {
      const result: AccessResult = {
        allowed: !this.config.strictMode,
        reason: this.config.strictMode
          ? 'No applicable rules found'
          : 'Default permission applied',
      };
      this.logAccess(request, result);
      return result;
    }

    // Find the most specific rule with highest permission
    const sortedRules = this.sortRulesBySpecificity(applicableRules);
    const bestRule = sortedRules[0];

    // Check conditions
    if (
      bestRule.conditions &&
      !this.checkConditions(request, bestRule.conditions)
    ) {
      const result: AccessResult = {
        allowed: false,
        reason: 'Conditions not met',
        matchedRule: bestRule,
      };
      this.logAccess(request, result);
      return result;
    }

    // Check if permission level is sufficient
    const requiredLevel = this.actionToPermissionLevel(request.action);
    const hasPermission = this.hasPermissionLevel(
      bestRule.permission,
      requiredLevel,
    );

    const result: AccessResult = {
      allowed: hasPermission,
      reason: hasPermission
        ? 'Permission granted'
        : 'Insufficient permission level',
      matchedRule: bestRule,
    };

    this.logAccess(request, result);

    if (hasPermission) {
      this.emit('accessGranted', request);
    } else {
      this.emit('accessDenied', request, result.reason!);
    }

    return result;
  }

  /**
   * Grant permission to agent
   */
  grantPermission(
    granterId: string,
    agentId: string,
    resource: string,
    permission: Permission,
    options?: {
      conditions?: PermissionCondition[];
      expiresAt?: number;
    },
  ): PermissionRule {
    const rule: PermissionRule = {
      id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      agentId,
      resource,
      permission,
      conditions: options?.conditions,
      expiresAt: options?.expiresAt,
      createdBy: granterId,
      createdAt: Date.now(),
    };

    this.addRule(rule);
    return rule;
  }

  /**
   * Revoke all permissions for agent on resource
   */
  revokePermission(agentId: string, resource: string): number {
    const toRemove: string[] = [];

    for (const [id, rule] of this.rules) {
      if (rule.agentId === agentId && rule.resource === resource) {
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      this.removeRule(id);
    }

    return toRemove.length;
  }

  /**
   * Check if agent has specific permission
   */
  hasPermission(
    agentId: string,
    resource: string,
    action: 'read' | 'write' | 'delete' | 'admin',
  ): boolean {
    return this.checkAccess({ agentId, resource, action }).allowed;
  }

  /**
   * Get access log
   */
  getAccessLog(options?: {
    agentId?: string;
    resource?: string;
    startTime?: number;
    endTime?: number;
    limit?: number;
  }): AccessLogEntry[] {
    let log = [...this.accessLog];

    if (options?.agentId) {
      log = log.filter((e) => e.agentId === options.agentId);
    }
    if (options?.resource) {
      log = log.filter((e) => e.resource === options.resource);
    }
    if (options?.startTime) {
      log = log.filter((e) => e.timestamp >= options.startTime!);
    }
    if (options?.endTime) {
      log = log.filter((e) => e.timestamp <= options.endTime!);
    }

    log.sort((a, b) => b.timestamp - a.timestamp);

    return options?.limit ? log.slice(0, options.limit) : log;
  }

  /**
   * Clear access log
   */
  clearAccessLog(): void {
    this.accessLog = [];
  }

  /**
   * Find applicable rules for request
   */
  private findApplicableRules(request: AccessRequest): PermissionRule[] {
    const now = Date.now();

    return Array.from(this.rules.values()).filter((rule) => {
      // Check expiration
      if (rule.expiresAt && rule.expiresAt < now) {
        return false;
      }

      // Check agent match
      if (rule.agentId !== '*' && rule.agentId !== request.agentId) {
        return false;
      }

      // Check resource match
      if (rule.resource !== '*' && rule.resource !== request.resource) {
        // Check if resource is a namespace prefix
        if (!request.resource.startsWith(rule.resource + ':')) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Sort rules by specificity (most specific first)
   */
  private sortRulesBySpecificity(rules: PermissionRule[]): PermissionRule[] {
    return rules.sort((a, b) => {
      // Specific agent > wildcard
      const agentSpecA = a.agentId !== '*' ? 1 : 0;
      const agentSpecB = b.agentId !== '*' ? 1 : 0;
      if (agentSpecA !== agentSpecB) return agentSpecB - agentSpecA;

      // Specific resource > wildcard
      const resourceSpecA = a.resource !== '*' ? 1 : 0;
      const resourceSpecB = b.resource !== '*' ? 1 : 0;
      if (resourceSpecA !== resourceSpecB) return resourceSpecB - resourceSpecA;

      // Higher permission level
      const levelA = this.permissionToLevel(a.permission);
      const levelB = this.permissionToLevel(b.permission);
      return levelB - levelA;
    });
  }

  /**
   * Check conditions
   */
  private checkConditions(
    request: AccessRequest,
    conditions: PermissionCondition[],
  ): boolean {
    const now = Date.now();

    for (const condition of conditions) {
      switch (condition.type) {
        case 'time-range': {
          const { start, end } = condition.value as {
            start: number;
            end: number;
          };
          if (now < start || now > end) return false;
          break;
        }

        case 'entry-type': {
          if (!request.entry) break;
          const allowedTypes = condition.value as string[];
          if (!allowedTypes.includes(request.entry.type)) return false;
          break;
        }

        case 'importance': {
          if (!request.entry) break;
          const { min, max } = condition.value as {
            min?: number;
            max?: number;
          };
          if (min !== undefined && request.entry.importance < min) return false;
          if (max !== undefined && request.entry.importance > max) return false;
          break;
        }

        case 'custom': {
          const fn = condition.value as (request: AccessRequest) => boolean;
          if (!fn(request)) return false;
          break;
        }
      }
    }

    return true;
  }

  /**
   * Convert action to required permission level
   */
  private actionToPermissionLevel(action: string): number {
    switch (action) {
      case 'read':
        return 1;
      case 'write':
        return 2;
      case 'delete':
        return 2;
      case 'admin':
        return 3;
      default:
        return 1;
    }
  }

  /**
   * Convert permission to level number
   */
  private permissionToLevel(permission: Permission): number {
    switch (permission) {
      case 'none':
        return 0;
      case 'read':
        return 1;
      case 'write':
        return 2;
      case 'admin':
        return 3;
      default:
        return 0;
    }
  }

  /**
   * Check if permission level is sufficient
   */
  private hasPermissionLevel(
    permission: Permission,
    required: number,
  ): boolean {
    return this.permissionToLevel(permission) >= required;
  }

  /**
   * Log access attempt
   */
  private logAccess(request: AccessRequest, result: AccessResult): void {
    if (!this.config.enableAuditLog) return;

    this.accessLog.push({
      timestamp: Date.now(),
      agentId: request.agentId,
      resource: request.resource,
      action: request.action,
      allowed: result.allowed,
      reason: result.reason,
    });

    // Trim log if too large
    if (this.accessLog.length > this.maxLogSize) {
      this.accessLog = this.accessLog.slice(-this.maxLogSize);
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalRules: number;
    agentCount: number;
    accessGranted: number;
    accessDenied: number;
  } {
    const agents = new Set(
      Array.from(this.rules.values())
        .filter((r) => r.agentId !== '*')
        .map((r) => r.agentId),
    );

    const granted = this.accessLog.filter((e) => e.allowed).length;
    const denied = this.accessLog.filter((e) => !e.allowed).length;

    return {
      totalRules: this.rules.size,
      agentCount: agents.size,
      accessGranted: granted,
      accessDenied: denied,
    };
  }

  /**
   * Export rules
   */
  exportRules(): PermissionRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Import rules
   */
  importRules(rules: PermissionRule[]): number {
    let imported = 0;
    for (const rule of rules) {
      if (this.addRule(rule)) {
        imported++;
      }
    }
    return imported;
  }
}

/**
 * Create access control manager
 */
export function createAccessControl(
  config?: AccessControlConfig,
): AccessControl {
  return new AccessControl(config);
}
