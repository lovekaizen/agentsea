/**
 * AttackRegistry - Attack Registration and Discovery
 *
 * Central registry for managing attack definitions, allowing
 * dynamic registration, discovery, and lifecycle management.
 */

import { EventEmitter } from 'eventemitter3';
import type {
  Attack,
  AttackCategory,
  AttackFilter,
  AttackLibraryStats,
  Severity,
  AttackResult,
  AttackExecutionOptions,
} from '../types/attack.types.js';
import type { TargetConfig } from '../types/config.types.js';
import { AttackLibrary, createAttackLibrary } from './AttackLibrary.js';

/**
 * Registry events
 */
export interface AttackRegistryEvents {
  /** Attack registered */
  'attack:registered': (attack: Attack) => void;
  /** Attack updated */
  'attack:updated': (attack: Attack) => void;
  /** Attack removed */
  'attack:removed': (attackId: string) => void;
  /** Category added */
  'category:added': (category: string) => void;
  /** Executor registered */
  'executor:registered': (name: string) => void;
}

/**
 * Attack executor function type
 */
export type AttackExecutor = (
  attack: Attack,
  target: TargetConfig,
  options?: AttackExecutionOptions,
) => Promise<AttackResult>;

/**
 * Attack validator function type
 */
export type AttackValidator = (attack: Attack) => boolean | string;

/**
 * Registry configuration
 */
export interface AttackRegistryConfig {
  /** Include built-in attacks */
  includeBuiltIn?: boolean;
  /** Custom attack library */
  library?: AttackLibrary;
  /** Validators */
  validators?: AttackValidator[];
  /** Auto-deduplicate */
  autoDedupe?: boolean;
}

/**
 * AttackRegistry - Central Attack Management
 */
export class AttackRegistry extends EventEmitter<AttackRegistryEvents> {
  private library: AttackLibrary;
  private executors: Map<string, AttackExecutor> = new Map();
  private customCategories: Set<string> = new Set();
  private validators: AttackValidator[] = [];
  private autoDedupe: boolean;

  constructor(config: AttackRegistryConfig = {}) {
    super();

    // Initialize library
    if (config.library) {
      this.library = config.library;
    } else if (config.includeBuiltIn !== false) {
      this.library = createAttackLibrary();
    } else {
      this.library = new AttackLibrary();
    }

    this.validators = config.validators || [];
    this.autoDedupe = config.autoDedupe ?? true;
  }

  // ============================================================
  // Attack Management
  // ============================================================

  /**
   * Register an attack
   */
  register(attack: Attack): void {
    // Validate
    const validationResult = this.validate(attack);
    if (typeof validationResult === 'string') {
      throw new Error(`Invalid attack: ${validationResult}`);
    }

    // Check for duplicate
    if (this.autoDedupe && this.library.get(attack.id)) {
      this.library.register(attack); // Update existing
      this.emit('attack:updated', attack);
    } else {
      this.library.register(attack);
      this.emit('attack:registered', attack);
    }

    // Track custom categories
    if (!this.isBuiltInCategory(attack.category)) {
      if (!this.customCategories.has(attack.category)) {
        this.customCategories.add(attack.category);
        this.emit('category:added', attack.category);
      }
    }
  }

  /**
   * Register multiple attacks
   */
  registerMany(attacks: Attack[]): void {
    for (const attack of attacks) {
      this.register(attack);
    }
  }

  /**
   * Unregister an attack
   */
  unregister(attackId: string): boolean {
    const attack = this.library.get(attackId);
    if (attack) {
      // Note: AttackLibrary doesn't have remove, so we'd need to implement it
      // For now, we'll just emit the event
      this.emit('attack:removed', attackId);
      return true;
    }
    return false;
  }

  /**
   * Get an attack by ID
   */
  get(attackId: string): Attack | undefined {
    return this.library.get(attackId);
  }

  /**
   * Get all attacks
   */
  getAll(): Attack[] {
    return this.library.getAll();
  }

  /**
   * Filter attacks
   */
  filter(filter: AttackFilter): Attack[] {
    return this.library.filter(filter);
  }

  /**
   * Get attacks by category
   */
  getByCategory(category: string): Attack[] {
    return this.library.getByCategory(category as AttackCategory);
  }

  /**
   * Get attacks by severity
   */
  getBySeverity(severity: Severity): Attack[] {
    return this.library.getBySeverity(severity);
  }

  /**
   * Get attacks by tag
   */
  getByTag(tag: string): Attack[] {
    return this.library.getByTag(tag);
  }

  /**
   * Search attacks
   */
  search(query: string): Attack[] {
    return this.library.filter({ query });
  }

  /**
   * Get statistics
   */
  getStats(): AttackLibraryStats {
    return this.library.getStats();
  }

  // ============================================================
  // Executor Management
  // ============================================================

  /**
   * Register an attack executor
   */
  registerExecutor(name: string, executor: AttackExecutor): void {
    this.executors.set(name, executor);
    this.emit('executor:registered', name);
  }

  /**
   * Get an executor by name
   */
  getExecutor(name: string): AttackExecutor | undefined {
    return this.executors.get(name);
  }

  /**
   * Get all executors
   */
  getExecutors(): string[] {
    return Array.from(this.executors.keys());
  }

  /**
   * Execute an attack using registered executor
   */
  async execute(
    attackId: string,
    target: TargetConfig,
    executorName: string = 'default',
    options?: AttackExecutionOptions,
  ): Promise<AttackResult> {
    const attack = this.get(attackId);
    if (!attack) {
      throw new Error(`Attack not found: ${attackId}`);
    }

    const executor = this.executors.get(executorName);
    if (!executor) {
      throw new Error(`Executor not found: ${executorName}`);
    }

    return executor(attack, target, options);
  }

  /**
   * Execute multiple attacks
   */
  async executeMany(
    attackIds: string[],
    target: TargetConfig,
    executorName: string = 'default',
    options?: AttackExecutionOptions & {
      parallel?: boolean;
      maxParallel?: number;
    },
  ): Promise<AttackResult[]> {
    const results: AttackResult[] = [];

    if (options?.parallel) {
      const maxParallel = options.maxParallel || 5;
      const chunks = this.chunkArray(attackIds, maxParallel);

      for (const chunk of chunks) {
        const chunkResults = await Promise.all(
          chunk.map((id) => this.execute(id, target, executorName, options)),
        );
        results.push(...chunkResults);
      }
    } else {
      for (const id of attackIds) {
        const result = await this.execute(id, target, executorName, options);
        results.push(result);
      }
    }

    return results;
  }

  // ============================================================
  // Validation
  // ============================================================

  /**
   * Add a validator
   */
  addValidator(validator: AttackValidator): void {
    this.validators.push(validator);
  }

  /**
   * Validate an attack
   */
  validate(attack: Attack): boolean | string {
    // Built-in validation
    if (!attack.id) return 'Attack must have an ID';
    if (!attack.name) return 'Attack must have a name';
    if (!attack.payload) return 'Attack must have a payload';
    if (!attack.category) return 'Attack must have a category';
    if (!attack.severity) return 'Attack must have a severity';

    // Custom validators
    for (const validator of this.validators) {
      const result = validator(attack);
      if (result !== true) {
        return result === false ? 'Validation failed' : result;
      }
    }

    return true;
  }

  // ============================================================
  // Import/Export
  // ============================================================

  /**
   * Import attacks from JSON
   */
  importFromJSON(json: string): number {
    const attacks: Attack[] = JSON.parse(json);
    let imported = 0;

    for (const attack of attacks) {
      try {
        this.register(attack);
        imported++;
      } catch (e) {
        // Skip invalid attacks
      }
    }

    return imported;
  }

  /**
   * Export attacks to JSON
   */
  exportToJSON(filter?: AttackFilter): string {
    const attacks = filter ? this.filter(filter) : this.getAll();
    return JSON.stringify(attacks, null, 2);
  }

  /**
   * Import from file
   */
  importFromFile(_filePath: string): Promise<number> {
    // This would need fs module in Node.js
    throw new Error('File import not supported in browser environment');
  }

  /**
   * Export to file
   */
  exportToFile(_filePath: string, _filter?: AttackFilter): Promise<void> {
    // This would need fs module in Node.js
    throw new Error('File export not supported in browser environment');
  }

  // ============================================================
  // Helpers
  // ============================================================

  /**
   * Check if category is built-in
   */
  private isBuiltInCategory(category: string): boolean {
    const builtIn: string[] = [
      'jailbreak',
      'prompt_injection',
      'data_exfiltration',
      'manipulation',
      'bypass',
      'social_engineering',
      'privilege_escalation',
      'denial_of_service',
      'information_disclosure',
      'custom',
    ];
    return builtIn.includes(category);
  }

  /**
   * Chunk array helper
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Get custom categories
   */
  getCustomCategories(): string[] {
    return Array.from(this.customCategories);
  }

  /**
   * Get all categories
   */
  getAllCategories(): string[] {
    const stats = this.getStats();
    return Object.keys(stats.byCategory);
  }
}

/**
 * Create a new attack registry
 */
export function createAttackRegistry(
  config?: AttackRegistryConfig,
): AttackRegistry {
  return new AttackRegistry(config);
}

/**
 * Default registry instance
 */
export const defaultAttackRegistry = createAttackRegistry();
