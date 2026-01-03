/**
 * Guard Registry
 *
 * Singleton registry for guard discovery and management.
 */

import type {
  Guard,
  GuardConfig,
  GuardFactory,
  GuardMetadata,
  GuardCategory,
  ContentType,
} from '../types';

/**
 * Guard registration entry
 */
interface GuardRegistration<T extends Guard = Guard> {
  /** Guard metadata */
  metadata: GuardMetadata;
  /** Guard factory function */
  factory: GuardFactory<T>;
  /** Guard instance (if singleton) */
  instance?: T;
  /** Whether to use singleton pattern */
  singleton: boolean;
}

/**
 * Guard Registry
 *
 * Central registry for all guards. Supports:
 * - Guard registration and discovery
 * - Factory pattern for guard instantiation
 * - Singleton management
 * - Category-based filtering
 *
 * @example
 * ```typescript
 * // Register a guard
 * GuardRegistry.register({
 *   metadata: {
 *     name: 'my-guard',
 *     description: 'My custom guard',
 *     category: 'content',
 *     supportedTypes: ['input', 'output'],
 *     defaultConfig: { threshold: 0.5 },
 *   },
 *   factory: (config) => new MyGuard(config),
 * });
 *
 * // Get a guard instance
 * const guard = GuardRegistry.get('my-guard');
 *
 * // Get all guards in a category
 * const contentGuards = GuardRegistry.getByCategory('content');
 * ```
 */
export class GuardRegistry {
  private static registrations = new Map<string, GuardRegistration>();
  private static initialized = false;

  /**
   * Register a guard
   */
  static register<T extends Guard>(options: {
    metadata: GuardMetadata;
    factory: GuardFactory<T>;
    singleton?: boolean;
  }): void {
    const { metadata, factory, singleton = true } = options;

    if (this.registrations.has(metadata.name)) {
      console.warn(
        `Guard '${metadata.name}' is already registered. Overwriting.`,
      );
    }

    this.registrations.set(metadata.name, {
      metadata,
      factory,
      singleton,
    });
  }

  /**
   * Unregister a guard
   */
  static unregister(name: string): boolean {
    return this.registrations.delete(name);
  }

  /**
   * Check if a guard is registered
   */
  static has(name: string): boolean {
    return this.registrations.has(name);
  }

  /**
   * Get a guard instance by name
   */
  static get<T extends Guard = Guard>(
    name: string,
    config?: Partial<GuardConfig>,
  ): T | undefined {
    const registration = this.registrations.get(name) as
      | GuardRegistration<T>
      | undefined;

    if (!registration) {
      return undefined;
    }

    // If singleton and instance exists, return it
    if (registration.singleton && registration.instance && !config) {
      return registration.instance;
    }

    // Create new instance
    const mergedConfig = {
      ...registration.metadata.defaultConfig,
      ...config,
      name,
    };

    const instance = registration.factory(mergedConfig);

    // Store singleton instance
    if (registration.singleton && !config) {
      registration.instance = instance;
    }

    return instance;
  }

  /**
   * Get or throw if guard not found
   */
  static getOrThrow<T extends Guard = Guard>(
    name: string,
    config?: Partial<GuardConfig>,
  ): T {
    const guard = this.get<T>(name, config);
    if (!guard) {
      throw new Error(`Guard '${name}' not found in registry`);
    }
    return guard;
  }

  /**
   * Get guard metadata
   */
  static getMetadata(name: string): GuardMetadata | undefined {
    return this.registrations.get(name)?.metadata;
  }

  /**
   * Get all registered guard names
   */
  static getNames(): string[] {
    return Array.from(this.registrations.keys());
  }

  /**
   * Get all guard metadata
   */
  static getAllMetadata(): GuardMetadata[] {
    return Array.from(this.registrations.values()).map((r) => r.metadata);
  }

  /**
   * Get guards by category
   */
  static getByCategory(category: GuardCategory): GuardMetadata[] {
    return this.getAllMetadata().filter((m) => m.category === category);
  }

  /**
   * Get guards by supported type
   */
  static getBySupportedType(type: ContentType): GuardMetadata[] {
    return this.getAllMetadata().filter(
      (m) =>
        m.supportedTypes.includes(type) || m.supportedTypes.includes('both'),
    );
  }

  /**
   * Create instances of multiple guards
   */
  static createGuards(
    names: string[],
    configs?: Record<string, Partial<GuardConfig>>,
  ): Guard[] {
    return names
      .map((name) => this.get(name, configs?.[name]))
      .filter((g): g is Guard => g !== undefined);
  }

  /**
   * Clear all registrations (mainly for testing)
   */
  static clear(): void {
    this.registrations.clear();
    this.initialized = false;
  }

  /**
   * Get registration count
   */
  static get size(): number {
    return this.registrations.size;
  }

  /**
   * Initialize built-in guards
   * This is called automatically when guards are imported
   */
  static initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
    // Built-in guards will register themselves when imported
  }
}

/**
 * Decorator for registering a guard class
 *
 * @example
 * ```typescript
 * @RegisterGuard({
 *   name: 'my-guard',
 *   description: 'My custom guard',
 *   category: 'content',
 *   supportedTypes: ['input', 'output'],
 *   defaultConfig: { threshold: 0.5 },
 * })
 * class MyGuard extends BaseGuard {
 *   // ...
 * }
 * ```
 */
export function RegisterGuard(metadata: GuardMetadata) {
  return function <T extends new (config: Partial<GuardConfig>) => Guard>(
    constructor: T,
  ): T {
    GuardRegistry.register({
      metadata,
      factory: (config) => new constructor(config),
    });
    return constructor;
  };
}

/**
 * Helper to create and register a guard in one step
 */
export function defineGuard<T extends Guard>(options: {
  metadata: GuardMetadata;
  factory: GuardFactory<T>;
  singleton?: boolean;
}): GuardFactory<T> {
  GuardRegistry.register(options);
  return options.factory;
}
