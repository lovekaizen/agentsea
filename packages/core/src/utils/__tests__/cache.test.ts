import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Cache, LRUCache } from '../cache';

describe('Cache', () => {
  let cache: Cache<string>;

  beforeEach(() => {
    cache = new Cache<string>();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('set and get', () => {
    it('should set and get a value', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for non-existent key', () => {
      expect(cache.get('non-existent')).toBeUndefined();
    });

    it('should overwrite existing value', () => {
      cache.set('key1', 'value1');
      cache.set('key1', 'value2');
      expect(cache.get('key1')).toBe('value2');
    });
  });

  describe('TTL expiration', () => {
    it('should expire value after TTL', () => {
      cache.set('key1', 'value1', 1000); // 1 second TTL

      expect(cache.get('key1')).toBe('value1');

      vi.advanceTimersByTime(1001);

      expect(cache.get('key1')).toBeUndefined();
    });

    it('should not expire value before TTL', () => {
      cache.set('key1', 'value1', 5000);

      vi.advanceTimersByTime(4999);

      expect(cache.get('key1')).toBe('value1');
    });

    it('should use default TTL when set in constructor', () => {
      const cacheWithDefaultTTL = new Cache<string>(1000);
      cacheWithDefaultTTL.set('key1', 'value1');

      expect(cacheWithDefaultTTL.get('key1')).toBe('value1');

      vi.advanceTimersByTime(1001);

      expect(cacheWithDefaultTTL.get('key1')).toBeUndefined();
    });

    it('should override default TTL with specific TTL', () => {
      const cacheWithDefaultTTL = new Cache<string>(1000);
      cacheWithDefaultTTL.set('key1', 'value1', 5000);

      vi.advanceTimersByTime(1001);
      expect(cacheWithDefaultTTL.get('key1')).toBe('value1');

      vi.advanceTimersByTime(4000);
      expect(cacheWithDefaultTTL.get('key1')).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return true for existing key', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
    });

    it('should return false for non-existent key', () => {
      expect(cache.has('non-existent')).toBe(false);
    });

    it('should return false for expired key', () => {
      cache.set('key1', 'value1', 1000);

      vi.advanceTimersByTime(1001);

      expect(cache.has('key1')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete existing key', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should return false for non-existent key', () => {
      expect(cache.delete('non-existent')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      cache.clear();

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
      expect(cache.size).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      cache.get('key1');
      cache.get('key1');
      cache.get('key2');

      const stats = cache.getStats();

      expect(stats.size).toBe(2);
      expect(stats.keys).toContain('key1');
      expect(stats.keys).toContain('key2');
      expect(stats.totalHits).toBe(3);
    });

    it('should return empty stats for empty cache', () => {
      const stats = cache.getStats();

      expect(stats.size).toBe(0);
      expect(stats.keys).toEqual([]);
      expect(stats.totalHits).toBe(0);
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      cache.set('key1', 'cached-value');

      const factory = vi.fn().mockResolvedValue('new-value');
      const result = await cache.getOrSet('key1', factory);

      expect(result).toBe('cached-value');
      expect(factory).not.toHaveBeenCalled();
    });

    it('should call factory and cache result if not exists', async () => {
      const factory = vi.fn().mockResolvedValue('new-value');
      const result = await cache.getOrSet('key1', factory);

      expect(result).toBe('new-value');
      expect(factory).toHaveBeenCalledTimes(1);
      expect(cache.get('key1')).toBe('new-value');
    });

    it('should work with synchronous factory', async () => {
      const factory = vi.fn().mockReturnValue('sync-value');
      const result = await cache.getOrSet('key1', factory);

      expect(result).toBe('sync-value');
      expect(cache.get('key1')).toBe('sync-value');
    });

    it('should apply TTL to cached value', async () => {
      const factory = vi.fn().mockResolvedValue('new-value');
      await cache.getOrSet('key1', factory, 1000);

      expect(cache.get('key1')).toBe('new-value');

      vi.advanceTimersByTime(1001);

      expect(cache.get('key1')).toBeUndefined();
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries', () => {
      cache.set('key1', 'value1', 1000);
      cache.set('key2', 'value2', 5000);
      cache.set('key3', 'value3'); // No TTL

      vi.advanceTimersByTime(2000);

      const removed = cache.cleanup();

      expect(removed).toBe(1);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe('value3');
    });

    it('should return 0 when no expired entries', () => {
      cache.set('key1', 'value1', 5000);
      cache.set('key2', 'value2');

      const removed = cache.cleanup();

      expect(removed).toBe(0);
    });
  });

  describe('size', () => {
    it('should return correct size', () => {
      expect(cache.size).toBe(0);

      cache.set('key1', 'value1');
      expect(cache.size).toBe(1);

      cache.set('key2', 'value2');
      expect(cache.size).toBe(2);

      cache.delete('key1');
      expect(cache.size).toBe(1);
    });
  });
});

describe('LRUCache', () => {
  let cache: LRUCache<string>;

  beforeEach(() => {
    cache = new LRUCache<string>(3);
  });

  describe('set and get', () => {
    it('should set and get a value', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for non-existent key', () => {
      expect(cache.get('non-existent')).toBeUndefined();
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used when at capacity', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // Cache is now full
      expect(cache.size).toBe(3);

      // Add a new item, should evict key1 (oldest)
      cache.set('key4', 'value4');

      expect(cache.size).toBe(3);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe('value3');
      expect(cache.get('key4')).toBe('value4');
    });

    it('should update access order on get', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // Access key1 to make it most recently used
      cache.get('key1');

      // Add a new item, should evict key2 (now oldest)
      cache.set('key4', 'value4');

      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBeUndefined();
    });

    it('should update position on set of existing key', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // Update key1 to make it most recently used
      cache.set('key1', 'updated-value1');

      // Add a new item, should evict key2 (now oldest)
      cache.set('key4', 'value4');

      expect(cache.get('key1')).toBe('updated-value1');
      expect(cache.get('key2')).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return true for existing key', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
    });

    it('should return false for non-existent key', () => {
      expect(cache.has('non-existent')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete existing key', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should return false for non-existent key', () => {
      expect(cache.delete('non-existent')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      cache.clear();

      expect(cache.size).toBe(0);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });
  });

  describe('size', () => {
    it('should return correct size', () => {
      expect(cache.size).toBe(0);

      cache.set('key1', 'value1');
      expect(cache.size).toBe(1);

      cache.set('key2', 'value2');
      expect(cache.size).toBe(2);
    });

    it('should not exceed max size', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4');
      cache.set('key5', 'value5');

      expect(cache.size).toBe(3);
    });
  });
});
