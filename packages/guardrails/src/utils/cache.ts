/**
 * Cache Utilities
 *
 * Caching utilities for guardrails.
 */

import { LRUCache } from 'lru-cache';

/**
 * Cache options
 */
export interface CacheOptions<K, V extends object> {
  /** Maximum number of entries */
  max?: number;
  /** Time-to-live in milliseconds */
  ttl?: number;
  /** Update age on get */
  updateAgeOnGet?: boolean;
  /** Custom size calculator */
  sizeCalculation?: (value: V, key: K) => number;
}

/**
 * Simple wrapper around LRU cache
 */
export class GuardrailsCache<K extends string | number, V extends object> {
  private cache: LRUCache<K, V>;

  constructor(options: CacheOptions<K, V> = {}) {
    this.cache = new LRUCache<K, V>({
      max: options.max ?? 1000,
      ttl: options.ttl,
      updateAgeOnGet: options.updateAgeOnGet ?? false,
      sizeCalculation: options.sizeCalculation,
    });
  }

  /**
   * Get a value from cache
   */
  get(key: K): V | undefined {
    return this.cache.get(key);
  }

  /**
   * Set a value in cache
   */
  set(key: K, value: V, options?: { ttl?: number }): void {
    this.cache.set(key, value, options);
  }

  /**
   * Check if key exists
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * Delete a key
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear the cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get all keys
   */
  keys(): K[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get all values
   */
  values(): V[] {
    return Array.from(this.cache.values());
  }

  /**
   * Get or set with factory
   */
  async getOrSet(key: K, factory: () => Promise<V> | V): Promise<V> {
    const existing = this.cache.get(key);
    if (existing !== undefined) {
      return existing;
    }

    const value = await factory();
    this.cache.set(key, value);
    return value;
  }
}

/**
 * Create a cache key from multiple parts
 */
export function createCacheKey(
  ...parts: (string | number | boolean | undefined)[]
): string {
  return parts
    .filter((p) => p !== undefined)
    .map((p) => String(p))
    .join(':');
}

/**
 * Memoize an async function
 */
export function memoize<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options: {
    keyGenerator?: (...args: Parameters<T>) => string;
    cache?: GuardrailsCache<string, Awaited<ReturnType<T>>>;
    ttl?: number;
    max?: number;
  } = {},
): T {
  const cache =
    options.cache ??
    new GuardrailsCache<string, Awaited<ReturnType<T>>>({
      max: options.max ?? 100,
      ttl: options.ttl,
    });

  const keyGenerator =
    options.keyGenerator ?? ((...args) => JSON.stringify(args));

  return (async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
    const key = keyGenerator(...args);
    return cache.getOrSet(
      key,
      () => fn(...args) as Promise<Awaited<ReturnType<T>>>,
    );
  }) as T;
}

/**
 * Create a cache instance
 */
export function createCache<K extends string | number, V extends object>(
  options?: CacheOptions<K, V>,
): GuardrailsCache<K, V> {
  return new GuardrailsCache<K, V>(options);
}

export default GuardrailsCache;
