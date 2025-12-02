/**
 * Simple in-memory cache with TTL support
 */
export class Cache<T = any> {
  private store = new Map<
    string,
    { value: T; expires: number | null; hits: number }
  >();

  constructor(private defaultTTL?: number) {}

  /**
   * Set a value in the cache
   */
  set(key: string, value: T, ttl?: number): void {
    const expires =
      ttl || this.defaultTTL
        ? Date.now() + (ttl || this.defaultTTL || 0)
        : null;

    this.store.set(key, { value, expires, hits: 0 });
  }

  /**
   * Get a value from the cache
   */
  get(key: string): T | undefined {
    const item = this.store.get(key);

    if (!item) {
      return undefined;
    }

    // Check if expired
    if (item.expires && Date.now() > item.expires) {
      this.store.delete(key);
      return undefined;
    }

    // Increment hit counter
    item.hits++;

    return item.value;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const item = this.store.get(key);

    if (!item) {
      return false;
    }

    if (item.expires && Date.now() > item.expires) {
      this.store.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a key
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    keys: string[];
    totalHits: number;
  } {
    let totalHits = 0;
    const keys: string[] = [];

    for (const [key, item] of this.store.entries()) {
      keys.push(key);
      totalHits += item.hits;
    }

    return {
      size: this.store.size,
      keys,
      totalHits,
    };
  }

  /**
   * Get or set pattern
   */
  async getOrSet(
    key: string,
    factory: () => Promise<T> | T,
    ttl?: number,
  ): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await factory();
    this.set(key, value, ttl);
    return value;
  }

  /**
   * Remove expired entries
   */
  cleanup(): number {
    let removed = 0;
    const now = Date.now();

    for (const [key, item] of this.store.entries()) {
      if (item.expires && now > item.expires) {
        this.store.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.store.size;
  }
}

/**
 * LRU (Least Recently Used) Cache
 */
export class LRUCache<T = any> {
  private cache = new Map<string, T>();

  constructor(private maxSize: number) {}

  /**
   * Get a value from the cache
   */
  get(key: string): T | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }

    // Move to end (most recently used)
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);

    return value;
  }

  /**
   * Set a value in the cache
   */
  set(key: string, value: T): void {
    // Remove if exists (to update position)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, value);
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Delete a key
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries
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
}
