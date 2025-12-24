import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemoryStore,
  createInMemoryStore,
} from '../stores/implementations/InMemoryStore.js';
import type { MemoryEntry, MemoryType } from '../types/index.js';

// Helper to create a memory entry
function createEntry(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
  return {
    id: `entry-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: 'conversation' as MemoryType,
    content: 'Test content',
    timestamp: Date.now(),
    importance: 0.5,
    accessCount: 0,
    metadata: {},
    ...overrides,
  };
}

describe('InMemoryStore', () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
  });

  describe('constructor', () => {
    it('should create store with default config', () => {
      const defaultStore = new InMemoryStore();
      expect(defaultStore).toBeInstanceOf(InMemoryStore);
    });

    it('should create store with custom max size', () => {
      const customStore = new InMemoryStore({ maxSize: 100 });
      expect(customStore).toBeInstanceOf(InMemoryStore);
    });

    it('should create store with TTL', () => {
      const ttlStore = new InMemoryStore({ ttl: 60000 });
      expect(ttlStore).toBeInstanceOf(InMemoryStore);
    });
  });

  describe('add', () => {
    it('should add a memory entry', async () => {
      const entry = createEntry({ id: 'test-1' });
      const id = await store.add(entry);

      expect(id).toBe('test-1');
    });

    it('should store the entry retrievably', async () => {
      const entry = createEntry({ id: 'test-1', content: 'Hello World' });
      await store.add(entry);

      const retrieved = await store.get('test-1');
      expect(retrieved?.content).toBe('Hello World');
    });
  });

  describe('get', () => {
    it('should return entry by ID', async () => {
      const entry = createEntry({ id: 'test-1' });
      await store.add(entry);

      const retrieved = await store.get('test-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('test-1');
    });

    it('should return null for non-existent ID', async () => {
      const retrieved = await store.get('non-existent');
      expect(retrieved).toBeNull();
    });

    it('should increment access count on get', async () => {
      const entry = createEntry({ id: 'test-1', accessCount: 0 });
      await store.add(entry);

      await store.get('test-1');
      const retrieved = await store.get('test-1');

      expect(retrieved?.accessCount).toBe(2);
    });

    it('should update lastAccessedAt on get', async () => {
      const entry = createEntry({ id: 'test-1' });
      await store.add(entry);

      const before = Date.now();
      await store.get('test-1');
      const retrieved = await store.get('test-1');

      expect(retrieved?.lastAccessedAt).toBeGreaterThanOrEqual(before);
    });
  });

  describe('update', () => {
    it('should update an existing entry', async () => {
      const entry = createEntry({ id: 'test-1', content: 'Original' });
      await store.add(entry);

      const result = await store.update('test-1', { content: 'Updated' });

      expect(result).toBe(true);

      const retrieved = await store.get('test-1');
      expect(retrieved?.content).toBe('Updated');
    });

    it('should return false for non-existent entry', async () => {
      const result = await store.update('non-existent', { content: 'Updated' });
      expect(result).toBe(false);
    });

    it('should update metadata', async () => {
      const entry = createEntry({
        id: 'test-1',
        metadata: { key1: 'value1' },
      });
      await store.add(entry);

      await store.update('test-1', { metadata: { key2: 'value2' } });

      const retrieved = await store.get('test-1');
      expect(retrieved?.metadata).toEqual({ key1: 'value1', key2: 'value2' });
    });

    it('should update updatedAt timestamp', async () => {
      const entry = createEntry({ id: 'test-1' });
      await store.add(entry);

      const before = Date.now();
      await store.update('test-1', { content: 'Updated' });

      const retrieved = await store.get('test-1');
      expect(retrieved?.updatedAt).toBeGreaterThanOrEqual(before);
    });
  });

  describe('delete', () => {
    it('should delete an existing entry', async () => {
      const entry = createEntry({ id: 'test-1' });
      await store.add(entry);

      const result = await store.delete('test-1');

      expect(result).toBe(true);
      expect(await store.get('test-1')).toBeNull();
    });

    it('should return false for non-existent entry', async () => {
      const result = await store.delete('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      await store.add(
        createEntry({
          id: 'entry-1',
          content: 'Hello World',
          timestamp: 1000,
          importance: 0.8,
          metadata: { userId: 'user-1', tags: ['greeting'] },
        }),
      );
      await store.add(
        createEntry({
          id: 'entry-2',
          content: 'Goodbye World',
          timestamp: 2000,
          importance: 0.5,
          metadata: { userId: 'user-1', tags: ['farewell'] },
        }),
      );
      await store.add(
        createEntry({
          id: 'entry-3',
          content: 'Hello Again',
          timestamp: 3000,
          importance: 0.3,
          metadata: { userId: 'user-2', tags: ['greeting'] },
        }),
      );
    });

    it('should return all entries with no filters', async () => {
      const result = await store.query({});
      expect(result.entries).toHaveLength(3);
    });

    it('should filter by text query', async () => {
      const result = await store.query({ query: 'Hello' });
      expect(result.entries).toHaveLength(2);
    });

    it('should filter by userId', async () => {
      const result = await store.query({ userId: 'user-1' });
      expect(result.entries).toHaveLength(2);
    });

    it('should filter by tags', async () => {
      const result = await store.query({ tags: ['greeting'] });
      expect(result.entries).toHaveLength(2);
    });

    it('should filter by minimum importance', async () => {
      const result = await store.query({ minImportance: 0.6 });
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].id).toBe('entry-1');
    });

    it('should filter by time range', async () => {
      const result = await store.query({ startTime: 1500, endTime: 2500 });
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].id).toBe('entry-2');
    });

    it('should sort by timestamp descending', async () => {
      const result = await store.query({});
      expect(result.entries[0].id).toBe('entry-3');
      expect(result.entries[2].id).toBe('entry-1');
    });

    it('should apply pagination with limit', async () => {
      const result = await store.query({ limit: 2 });
      expect(result.entries).toHaveLength(2);
      expect(result.hasMore).toBe(true);
    });

    it('should apply pagination with offset', async () => {
      const result = await store.query({ limit: 2, offset: 1 });
      expect(result.entries).toHaveLength(2);
      expect(result.entries[0].id).toBe('entry-2');
    });

    it('should return total count', async () => {
      const result = await store.query({ limit: 1 });
      expect(result.total).toBe(3);
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await store.add(
        createEntry({
          id: 'entry-1',
          content: 'Vector A',
          embedding: [1, 0, 0],
          metadata: { namespace: 'test' },
        }),
      );
      await store.add(
        createEntry({
          id: 'entry-2',
          content: 'Vector B',
          embedding: [0, 1, 0],
          metadata: { namespace: 'test' },
        }),
      );
      await store.add(
        createEntry({
          id: 'entry-3',
          content: 'Vector C',
          embedding: [0, 0, 1],
          metadata: { namespace: 'other' },
        }),
      );
      await store.add(
        createEntry({
          id: 'entry-4',
          content: 'No embedding',
          metadata: { namespace: 'test' },
        }),
      );
    });

    it('should find similar vectors', async () => {
      const results = await store.search([1, 0, 0], { topK: 10 });
      expect(results.length).toBeGreaterThan(0);
      // Best match should be entry-1 with embedding [1, 0, 0]
      expect(results[0].entry.id).toBe('entry-1');
      expect(results[0].score).toBeCloseTo(1);
    });

    it('should limit results by topK', async () => {
      const results = await store.search([1, 0, 0], { topK: 1 });
      expect(results).toHaveLength(1);
    });

    it('should filter by namespace', async () => {
      const results = await store.search([0, 0, 1], {
        topK: 10,
        namespace: 'test',
      });
      expect(results.every((r) => r.entry.metadata.namespace === 'test')).toBe(
        true,
      );
    });

    it('should filter by minimum score', async () => {
      const results = await store.search([1, 0, 0], {
        topK: 10,
        minScore: 0.9,
      });
      expect(results).toHaveLength(1);
      expect(results[0].entry.id).toBe('entry-1');
    });

    it('should skip entries without embeddings', async () => {
      const results = await store.search([1, 0, 0], { topK: 10 });
      expect(results.every((r) => r.entry.embedding !== undefined)).toBe(true);
    });
  });

  describe('clear', () => {
    beforeEach(async () => {
      await store.add(
        createEntry({
          id: 'entry-1',
          metadata: { namespace: 'ns1', userId: 'user-1' },
        }),
      );
      await store.add(
        createEntry({
          id: 'entry-2',
          metadata: { namespace: 'ns1', userId: 'user-2' },
        }),
      );
      await store.add(
        createEntry({
          id: 'entry-3',
          metadata: { namespace: 'ns2', userId: 'user-1' },
        }),
      );
    });

    it('should clear all entries when no options', async () => {
      const deleted = await store.clear();
      expect(deleted).toBe(3);
      expect(await store.count()).toBe(0);
    });

    it('should clear by namespace', async () => {
      const deleted = await store.clear({ namespace: 'ns1' });
      expect(deleted).toBe(2);
      expect(await store.count()).toBe(1);
    });

    it('should clear by userId', async () => {
      const deleted = await store.clear({ userId: 'user-1' });
      expect(deleted).toBe(2);
      expect(await store.count()).toBe(1);
    });
  });

  describe('count', () => {
    beforeEach(async () => {
      await store.add(
        createEntry({ id: 'entry-1', metadata: { userId: 'user-1' } }),
      );
      await store.add(
        createEntry({ id: 'entry-2', metadata: { userId: 'user-1' } }),
      );
      await store.add(
        createEntry({ id: 'entry-3', metadata: { userId: 'user-2' } }),
      );
    });

    it('should return total count', async () => {
      const count = await store.count();
      expect(count).toBe(3);
    });

    it('should return filtered count', async () => {
      const count = await store.count({ userId: 'user-1' });
      expect(count).toBe(2);
    });
  });

  describe('close', () => {
    it('should close without error', async () => {
      await expect(store.close()).resolves.toBeUndefined();
    });
  });

  describe('getAllEntries', () => {
    it('should return all entries', async () => {
      await store.add(createEntry({ id: 'entry-1' }));
      await store.add(createEntry({ id: 'entry-2' }));

      const entries = store.getAllEntries();
      expect(entries).toHaveLength(2);
    });
  });

  describe('createInMemoryStore factory', () => {
    it('should create a store instance', () => {
      const factoryStore = createInMemoryStore();
      expect(factoryStore).toBeInstanceOf(InMemoryStore);
    });

    it('should accept config', () => {
      const factoryStore = createInMemoryStore({ maxSize: 50 });
      expect(factoryStore).toBeInstanceOf(InMemoryStore);
    });
  });
});
