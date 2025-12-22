/**
 * Security Validator - Validate actions against sandbox rules
 */

import { SandboxConfig } from '../types';

/**
 * Result of a security validation check
 */
export interface ValidationResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Security validator for enforcing sandbox rules
 */
export class SecurityValidator {
  private config: SandboxConfig;
  private actionCounts: Map<string, number[]> = new Map();

  constructor(config: SandboxConfig) {
    this.config = config;
  }

  /**
   * Validate that an action is allowed by sandbox rules
   */
  validateAction(
    action: string,
    params: Record<string, unknown>,
  ): ValidationResult {
    if (!this.config.enabled) {
      return { allowed: true };
    }

    // Rate limiting check
    if (this.config.maxActionsPerMinute) {
      if (!this.checkRateLimit()) {
        return {
          allowed: false,
          reason: `Rate limit exceeded (${this.config.maxActionsPerMinute} actions/minute)`,
        };
      }
    }

    // Validate text input for dangerous content
    if (action === 'type' && params.text) {
      const text = params.text as string;
      const dangerous = this.checkDangerousText(text);
      if (dangerous) {
        return {
          allowed: false,
          reason: `Potentially dangerous text pattern: ${dangerous}`,
        };
      }

      // Check blocked commands
      if (this.config.blockedCommands) {
        for (const cmd of this.config.blockedCommands) {
          if (text.toLowerCase().includes(cmd.toLowerCase())) {
            return {
              allowed: false,
              reason: `Blocked command in text: ${cmd}`,
            };
          }
        }
      }
    }

    // Validate key combinations
    if (action === 'keyPress') {
      const dangerous = this.checkDangerousKeyCombo(
        params.key as string,
        params.modifiers as string[] | undefined,
      );
      if (dangerous) {
        return {
          allowed: false,
          reason: `Blocked key combination: ${dangerous}`,
        };
      }
    }

    // Record this action for rate limiting
    this.recordAction(action);

    return { allowed: true };
  }

  /**
   * Validate URL against allowed/blocked domains
   */
  validateUrl(url: string): ValidationResult {
    if (!this.config.enabled) {
      return { allowed: true };
    }

    try {
      const parsedUrl = new URL(url);
      const domain = parsedUrl.hostname.toLowerCase();

      // Check blocked domains first
      if (this.config.blockedDomains) {
        for (const blocked of this.config.blockedDomains) {
          if (domain.includes(blocked.toLowerCase())) {
            return {
              allowed: false,
              reason: `Domain ${domain} is blocked`,
            };
          }
        }
      }

      // If allowedDomains is set, only those are permitted
      if (this.config.allowedDomains && this.config.allowedDomains.length > 0) {
        const isAllowed = this.config.allowedDomains.some((allowed) =>
          domain.includes(allowed.toLowerCase()),
        );
        if (!isAllowed) {
          return {
            allowed: false,
            reason: `Domain ${domain} is not in allowed list`,
          };
        }
      }

      return { allowed: true };
    } catch {
      return { allowed: false, reason: 'Invalid URL format' };
    }
  }

  /**
   * Validate file path against allowed/blocked paths
   */
  validatePath(path: string): ValidationResult {
    if (!this.config.enabled) {
      return { allowed: true };
    }

    const normalizedPath = path.toLowerCase();

    // Check blocked paths first
    if (this.config.blockedPaths) {
      for (const blocked of this.config.blockedPaths) {
        if (normalizedPath.startsWith(blocked.toLowerCase())) {
          return {
            allowed: false,
            reason: `Path ${path} is blocked`,
          };
        }
      }
    }

    // If allowedPaths is set, only those are permitted
    if (this.config.allowedPaths && this.config.allowedPaths.length > 0) {
      const isAllowed = this.config.allowedPaths.some((allowed) =>
        normalizedPath.startsWith(allowed.toLowerCase()),
      );
      if (!isAllowed) {
        return {
          allowed: false,
          reason: `Path ${path} is not in allowed list`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Check rate limit
   */
  private checkRateLimit(): boolean {
    if (!this.config.maxActionsPerMinute) {
      return true;
    }

    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Count actions in the last minute
    let totalActions = 0;
    for (const timestamps of this.actionCounts.values()) {
      totalActions += timestamps.filter((t) => t > oneMinuteAgo).length;
    }

    return totalActions < this.config.maxActionsPerMinute;
  }

  /**
   * Record an action for rate limiting
   */
  private recordAction(action: string): void {
    const now = Date.now();
    const timestamps = this.actionCounts.get(action) || [];

    // Clean old timestamps
    const oneMinuteAgo = now - 60000;
    const recentTimestamps = timestamps.filter((t) => t > oneMinuteAgo);
    recentTimestamps.push(now);

    this.actionCounts.set(action, recentTimestamps);
  }

  /**
   * Check for dangerous text patterns
   */
  private checkDangerousText(text: string): string | null {
    const dangerousPatterns: [RegExp, string][] = [
      [/rm\s+-rf\s+\//i, 'rm -rf /'],
      [/sudo\s+rm/i, 'sudo rm'],
      [/sudo\s+chmod/i, 'sudo chmod'],
      [/chmod\s+777/i, 'chmod 777'],
      [/curl.*\|\s*bash/i, 'curl | bash'],
      [/curl.*\|\s*sh/i, 'curl | sh'],
      [/wget.*\|\s*bash/i, 'wget | bash'],
      [/wget.*\|\s*sh/i, 'wget | sh'],
      [/mkfs\./i, 'mkfs'],
      [/dd\s+if=.*of=\/dev/i, 'dd to device'],
      [/:\(\)\{ :\|:& \};:/i, 'fork bomb'],
      [/>\s*\/dev\/sd[a-z]/i, 'write to disk device'],
    ];

    for (const [pattern, name] of dangerousPatterns) {
      if (pattern.test(text)) {
        return name;
      }
    }

    return null;
  }

  /**
   * Check for dangerous key combinations
   */
  private checkDangerousKeyCombo(
    key: string,
    modifiers?: string[],
  ): string | null {
    const blockedCombos: { key: string; modifiers: string[] }[] = [
      { key: 'delete', modifiers: ['ctrl', 'alt'] }, // Ctrl+Alt+Del
      { key: 'f4', modifiers: ['alt'] }, // Alt+F4
      { key: 'l', modifiers: ['meta'] }, // Win+L (lock screen)
      { key: 'l', modifiers: ['command'] }, // Cmd+L
      { key: 'q', modifiers: ['command'] }, // Cmd+Q (quit app)
      { key: 'w', modifiers: ['command', 'alt'] }, // Cmd+Alt+W (close all)
    ];

    const keyLower = key.toLowerCase();
    const modsLower = (modifiers || []).map((m) => m.toLowerCase());

    for (const combo of blockedCombos) {
      if (combo.key === keyLower) {
        const comboMods = combo.modifiers.map((m) => m.toLowerCase());
        if (comboMods.every((m) => modsLower.includes(m))) {
          return `${combo.modifiers.join('+')}+${combo.key}`;
        }
      }
    }

    return null;
  }

  /**
   * Update sandbox configuration
   */
  updateConfig(config: Partial<SandboxConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Reset rate limit counters
   */
  resetRateLimits(): void {
    this.actionCounts.clear();
  }
}
