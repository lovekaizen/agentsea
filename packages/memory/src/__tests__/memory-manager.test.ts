import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryManager } from '../core/MemoryManager.js';
import { InMemoryStore } from '../stores/implementations/InMemoryStore.js';
import type {
  MemoryInput,
  EmbeddingProviderInterface,
  RetrievalStrategyInterface,
} from '../types/index.js';

// Mock embedding provider
const mockEmbeddingProvider: EmbeddingProviderInterface = {
  embed: vi.fn(async (text: string) => {
    // Simple deterministic embedding based on text length
    return Array(128).fill(text.length / 100);
  }),
  embedBatch: vi.fn(async (texts: string[]) => {
    return texts.map((text) => Array(128).fill(text.length / 100));
  }),
  dimensions: 128,
};

describe('MemoryManager', () => {
  let store: InMemoryStore;
  let manager: MemoryManager;

  beforeEach(() => {
    store = new InMemoryStore();
    manager = new MemoryManager({
      store,
      embedding: mockEmbeddingProvider,
      defaultNamespace: 'test',
      autoEmbed: true,
    });
  });

  describe('add', () => {
    it('should add a memory with default values', async () => {
      const id = await manager.add({
        content: 'Test memory',
      });

      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
    });

    it('should add a memory with custom type', async () => {
      const id = await manager.add({
        content: 'User likes pizza',
        type: 'preference',
      });

      const entry = await manager.get(id);
      expect(entry?.type).toBe('preference');
    });

    it('should add a memory with custom importance', async () => {
      const id = await manager.add({
        content: 'Critical information',
        importance: 0.95,
      });

      const entry = await manager.get(id);
      expect(entry?.importance).toBe(0.95);
    });

    it('should calculate importance if not provided', async () => {
      const id = await manager.add({
        content: 'Test content',
        type: 'fact',
      });

      const entry = await manager.get(id);
      expect(entry?.importance).toBeGreaterThan(0);
      expect(entry?.importance).toBeLessThanOrEqual(1);
    });

    it('should generate embedding if autoEmbed is enabled', async () => {
      const id = await manager.add({
        content: 'Test with embedding',
      });

      const entry = await manager.get(id);
      expect(entry?.embedding).toBeDefined();
      expect(Array.isArray(entry?.embedding)).toBe(true);
    });

    it('should emit memory:added event', async () => {
      const handler = vi.fn();
      manager.on('memory:added', handler);

      await manager.add({ content: 'Test' });

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'memory:added',
          memoryId: expect.any(String),
        }),
      );
    });

    it('should add memory with expiration', async () => {
      const expiresAt = Date.now() + 60000;
      const id = await manager.add({
        content: 'Temporary memory',
        expiresAt,
      });

      const entry = await manager.get(id);
      expect(entry?.expiresAt).toBe(expiresAt);
    });
  });

  describe('addBatch', () => {
    it('should add multiple memories', async () => {
      const inputs: MemoryInput[] = [
        { content: 'First memory' },
        { content: 'Second memory' },
        { content: 'Third memory' },
      ];

      const ids = await manager.addBatch(inputs);

      expect(ids).toHaveLength(3);
      expect(ids.every((id) => typeof id === 'string')).toBe(true);
    });

    it('should use batch embedding when available', async () => {
      const inputs: MemoryInput[] = [
        { content: 'First' },
        { content: 'Second' },
      ];

      await manager.addBatch(inputs);

      expect(mockEmbeddingProvider.embedBatch).toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('should retrieve a memory by id', async () => {
      const id = await manager.add({ content: 'Test memory' });
      const entry = await manager.get(id);

      expect(entry).toBeDefined();
      expect(entry?.id).toBe(id);
      expect(entry?.content).toBe('Test memory');
    });

    it('should return null for non-existent id', async () => {
      const entry = await manager.get('non-existent');
      expect(entry).toBeNull();
    });

    it('should increment access count on get', async () => {
      const id = await manager.add({ content: 'Test' });

      await manager.get(id);
      await manager.get(id);

      const entry = await manager.get(id);
      expect(entry?.accessCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('update', () => {
    it('should update memory content', async () => {
      const id = await manager.add({ content: 'Original' });

      const success = await manager.update(id, { content: 'Updated' });

      expect(success).toBe(true);
      const entry = await manager.get(id);
      expect(entry?.content).toBe('Updated');
    });

    it('should update memory importance', async () => {
      const id = await manager.add({ content: 'Test' });

      await manager.update(id, { importance: 0.9 });

      const entry = await manager.get(id);
      expect(entry?.importance).toBe(0.9);
    });

    it('should re-embed when content changes', async () => {
      const id = await manager.add({ content: 'Original content' });

      await manager.update(id, {
        content: 'New content with different length',
      });

      const entry = await manager.get(id);
      expect(entry?.embedding).toBeDefined();
      expect(mockEmbeddingProvider.embed).toHaveBeenCalledWith(
        'New content with different length',
      );
    });

    it('should emit memory:updated event', async () => {
      const id = await manager.add({ content: 'Test' });
      const handler = vi.fn();
      manager.on('memory:updated', handler);

      await manager.update(id, { content: 'Updated' });

      expect(handler).toHaveBeenCalledOnce();
    });

    it('should return false for non-existent memory', async () => {
      const success = await manager.update('non-existent', { content: 'Test' });
      expect(success).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete a memory', async () => {
      const id = await manager.add({ content: 'To delete' });

      const success = await manager.delete(id);

      expect(success).toBe(true);
      const entry = await manager.get(id);
      expect(entry).toBeNull();
    });

    it('should emit memory:deleted event', async () => {
      const id = await manager.add({ content: 'Test' });
      const handler = vi.fn();
      manager.on('memory:deleted', handler);

      await manager.delete(id);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'memory:deleted',
          memoryId: id,
        }),
      );
    });

    it('should return false for non-existent memory', async () => {
      const success = await manager.delete('non-existent');
      expect(success).toBe(false);
    });
  });

  describe('retrieve', () => {
    it('should retrieve semantically similar memories', async () => {
      await manager.add({ content: 'I love pizza' });
      await manager.add({ content: 'Pizza is great' });
      await manager.add({ content: 'The weather is nice' });

      const results = await manager.retrieve('pizza preferences');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].entry).toBeDefined();
      expect(results[0].score).toBeDefined();
    });

    it('should respect limit option', async () => {
      await manager.add({ content: 'Test 1' });
      await manager.add({ content: 'Test 2' });
      await manager.add({ content: 'Test 3' });

      const results = await manager.retrieve('test', { limit: 2 });

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should filter by namespace', async () => {
      await manager.add({ content: 'Test', metadata: { namespace: 'test' } });
      await manager.add({ content: 'Other', metadata: { namespace: 'other' } });

      const results = await manager.retrieve('test', { namespace: 'test' });

      expect(results.every((r) => r.entry.metadata.namespace === 'test')).toBe(
        true,
      );
    });

    it('should emit memory:retrieved event', async () => {
      await manager.add({ content: 'Test' });
      const handler = vi.fn();
      manager.on('memory:retrieved', handler);

      await manager.retrieve('test');

      expect(handler).toHaveBeenCalledOnce();
    });

    it('should throw error if no embedding provider', async () => {
      const managerNoEmbed = new MemoryManager({
        store,
        autoEmbed: false,
      });

      await expect(managerNoEmbed.retrieve('test')).rejects.toThrow(
        'Embedding provider required',
      );
    });
  });

  describe('search', () => {
    it('should search memories with filters', async () => {
      await manager.add({ content: 'First', type: 'fact' });
      await manager.add({ content: 'Second', type: 'preference' });

      const result = await manager.search({ types: ['fact'] });

      expect(result.entries.every((e) => e.type === 'fact')).toBe(true);
    });

    it('should use default namespace', async () => {
      await manager.add({ content: 'Test' });

      const result = await manager.search({});

      expect(result.entries.every((e) => e.metadata.namespace === 'test')).toBe(
        true,
      );
    });
  });

  describe('clear', () => {
    it('should clear memories in namespace', async () => {
      await manager.add({ content: 'Test 1' });
      await manager.add({ content: 'Test 2' });

      const count = await manager.clear();

      expect(count).toBeGreaterThan(0);
      const result = await manager.count();
      expect(result).toBe(0);
    });

    it('should clear only specified namespace', async () => {
      await manager.add({ content: 'Test', metadata: { namespace: 'test' } });
      await manager.add({ content: 'Other', metadata: { namespace: 'other' } });

      await manager.clear({ namespace: 'test' });

      const count = await manager.count({ namespace: 'other' });
      expect(count).toBe(1);
    });
  });

  describe('getStats', () => {
    it('should return memory statistics', async () => {
      await manager.add({ content: 'Fact', type: 'fact' });
      await manager.add({ content: 'Preference', type: 'preference' });
      await manager.add({ content: 'Event', type: 'event' });

      const stats = await manager.getStats();

      expect(stats.totalCount).toBe(3);
      expect(stats.byType.fact).toBe(1);
      expect(stats.byType.preference).toBe(1);
      expect(stats.byType.event).toBe(1);
      expect(stats.embeddedCount).toBe(3);
    });

    it('should calculate average importance', async () => {
      await manager.add({ content: 'High', importance: 0.9 });
      await manager.add({ content: 'Low', importance: 0.3 });

      const stats = await manager.getStats();

      expect(stats.averageImportance).toBeCloseTo(0.6, 1);
    });
  });

  describe('setEmbedding', () => {
    it('should update embedding provider', () => {
      const newProvider: EmbeddingProviderInterface = {
        embed: vi.fn(async () => [1, 2, 3]),
        embedBatch: vi.fn(async () => [[1, 2, 3]]),
        dimensions: 3,
      };

      manager.setEmbedding(newProvider);
      expect(manager['embedding']).toBe(newProvider);
    });
  });

  describe('setRetrieval', () => {
    it('should update retrieval strategy', () => {
      const mockStrategy: RetrievalStrategyInterface = {
        name: 'test-strategy',
        retrieve: vi.fn(async () => []),
      };

      manager.setRetrieval(mockStrategy);
      expect(manager['retrieval']).toBe(mockStrategy);
    });
  });

  describe('importance calculation', () => {
    it('should boost fact and preference types', async () => {
      const factId = await manager.add({ content: 'Fact', type: 'fact' });
      const contextId = await manager.add({
        content: 'Context',
        type: 'context',
      });

      const factEntry = await manager.get(factId);
      const contextEntry = await manager.get(contextId);

      expect(factEntry!.importance).toBeGreaterThan(contextEntry!.importance);
    });

    it('should adjust by confidence', async () => {
      const highConfId = await manager.add({
        content: 'High confidence',
        metadata: { confidence: 1.0 },
      });
      const lowConfId = await manager.add({
        content: 'Low confidence',
        metadata: { confidence: 0.1 },
      });

      const highConf = await manager.get(highConfId);
      const lowConf = await manager.get(lowConfId);

      expect(highConf!.importance).toBeGreaterThan(lowConf!.importance);
    });
  });
});
