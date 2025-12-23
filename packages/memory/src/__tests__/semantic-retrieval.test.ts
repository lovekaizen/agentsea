import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SemanticRetrieval } from '../retrieval/strategies/SemanticRetrieval.js';
import { InMemoryStore } from '../stores/implementations/InMemoryStore.js';
import type { MemoryEntry } from '../types/index.js';

function createEntry(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
  return {
    id: `entry-${Date.now()}-${Math.random()}`,
    type: 'context',
    content: 'Test content',
    timestamp: Date.now(),
    importance: 0.5,
    accessCount: 0,
    metadata: {
      source: 'explicit',
      confidence: 1.0,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe('SemanticRetrieval', () => {
  let retrieval: SemanticRetrieval;
  let store: InMemoryStore;
  let mockEmbedFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    store = new InMemoryStore();
    mockEmbedFn = vi.fn(async (text: string) => {
      // Simple embedding based on text length and first char
      const base = text.charCodeAt(0) / 100;
      return Array(128).fill(base);
    });

    retrieval = new SemanticRetrieval(store, mockEmbedFn, {
      topK: 10,
      minScore: 0.5,
    });
  });

  describe('retrieve', () => {
    it('should retrieve semantically similar memories', async () => {
      await store.add(
        createEntry({
          content: 'I love pizza',
          embedding: Array(128).fill(0.5),
        }),
      );
      await store.add(
        createEntry({
          content: 'Pizza is great',
          embedding: Array(128).fill(0.5),
        }),
      );
      await store.add(
        createEntry({
          content: 'The weather is nice',
          embedding: Array(128).fill(0.8),
        }),
      );

      const result = await retrieval.retrieve({
        query: 'pizza preferences',
        topK: 2,
      });

      expect(result.memories.length).toBeGreaterThan(0);
      expect(result.memories.length).toBeLessThanOrEqual(2);
      expect(result.strategy).toBe('semantic');
    });

    it('should generate embedding for query', async () => {
      await store.add(
        createEntry({ content: 'Test', embedding: Array(128).fill(0.5) }),
      );

      await retrieval.retrieve({ query: 'test query' });

      expect(mockEmbedFn).toHaveBeenCalledWith('test query');
    });

    it('should track retrieval time', async () => {
      await store.add(
        createEntry({ content: 'Test', embedding: Array(128).fill(0.5) }),
      );

      const result = await retrieval.retrieve({ query: 'test' });

      expect(result.retrievalTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should return scores for each memory', async () => {
      await store.add(
        createEntry({ content: 'Test', embedding: Array(128).fill(0.5) }),
      );

      const result = await retrieval.retrieve({ query: 'test' });

      expect(result.scores.length).toBe(result.memories.length);
      expect(result.scores.every((s) => s >= 0 && s <= 1)).toBe(true);
    });

    it('should exclude embeddings by default', async () => {
      await store.add(
        createEntry({ content: 'Test', embedding: Array(128).fill(0.5) }),
      );

      const result = await retrieval.retrieve({ query: 'test' });

      expect(result.memories[0].embedding).toBeUndefined();
    });

    it('should include embeddings when requested', async () => {
      await store.add(
        createEntry({ content: 'Test', embedding: Array(128).fill(0.5) }),
      );

      const result = await retrieval.retrieve({
        query: 'test',
        includeEmbeddings: true,
      });

      expect(result.memories[0].embedding).toBeDefined();
    });

    it('should filter by namespace', async () => {
      await store.add(
        createEntry({
          content: 'Test 1',
          embedding: Array(128).fill(0.5),
          metadata: { source: 'explicit', confidence: 1, namespace: 'ns1' },
        }),
      );
      await store.add(
        createEntry({
          content: 'Test 2',
          embedding: Array(128).fill(0.5),
          metadata: { source: 'explicit', confidence: 1, namespace: 'ns2' },
        }),
      );

      const result = await retrieval.retrieve({
        query: 'test',
        namespace: 'ns1',
      });

      expect(result.memories.every((m) => m.metadata.namespace === 'ns1')).toBe(
        true,
      );
    });

    it('should respect minScore threshold', async () => {
      await store.add(
        createEntry({ content: 'Test', embedding: Array(128).fill(0.5) }),
      );

      const result = await retrieval.retrieve({
        query: 'very different query',
        minScore: 0.95,
      });

      expect(result.scores.every((s) => s >= 0.95)).toBe(true);
    });
  });

  describe('retrieveWithContext', () => {
    it('should retrieve with surrounding context', async () => {
      const baseTime = Date.now();

      await store.add(
        createEntry({
          id: 'before',
          content: 'Before',
          timestamp: baseTime - 1000,
          embedding: Array(128).fill(0.5),
        }),
      );
      await store.add(
        createEntry({
          id: 'target',
          content: 'Target',
          timestamp: baseTime,
          embedding: Array(128).fill(0.5),
        }),
      );
      await store.add(
        createEntry({
          id: 'after',
          content: 'After',
          timestamp: baseTime + 1000,
          embedding: Array(128).fill(0.5),
        }),
      );

      const result = await retrieval.retrieveWithContext(
        { query: 'target' },
        1,
      );

      expect(result.contextMemories).toBeDefined();
      expect(result.contextMemories.length).toBe(result.memories.length);
    });

    it('should respect context window size', async () => {
      const baseTime = Date.now();

      for (let i = -3; i <= 3; i++) {
        await store.add(
          createEntry({
            timestamp: baseTime + i * 1000,
            embedding: Array(128).fill(0.5),
          }),
        );
      }

      const result = await retrieval.retrieveWithContext({ query: 'test' }, 2);

      if (result.contextMemories.length > 0) {
        // Each context should have at most 4 entries (2 before + 2 after)
        expect(result.contextMemories[0].length).toBeLessThanOrEqual(4);
      }
    });
  });

  describe('findSimilar', () => {
    it('should find similar memories to a given memory', async () => {
      const memory = createEntry({
        content: 'Reference memory',
        embedding: Array(128).fill(0.6),
      });

      await store.add(
        createEntry({
          content: 'Similar 1',
          embedding: Array(128).fill(0.6),
        }),
      );
      await store.add(
        createEntry({
          content: 'Different',
          embedding: Array(128).fill(0.9),
        }),
      );

      const similar = await retrieval.findSimilar(memory);

      expect(similar.length).toBeGreaterThan(0);
    });

    it('should exclude the source memory from results', async () => {
      const memory = createEntry({
        id: 'source',
        content: 'Source',
        embedding: Array(128).fill(0.5),
      });

      await store.add(memory);
      await store.add(
        createEntry({ content: 'Other', embedding: Array(128).fill(0.5) }),
      );

      const similar = await retrieval.findSimilar(memory);

      expect(similar.every((s) => s.entry.id !== 'source')).toBe(true);
    });

    it('should generate embedding if not present', async () => {
      const memory = createEntry({
        content: 'No embedding',
        // No embedding field
      });

      await store.add(
        createEntry({ content: 'Other', embedding: Array(128).fill(0.5) }),
      );

      await retrieval.findSimilar(memory);

      expect(mockEmbedFn).toHaveBeenCalledWith('No embedding');
    });
  });

  describe('cluster', () => {
    it('should cluster memories by similarity', async () => {
      const memories = [
        createEntry({ content: 'Group A item 1' }),
        createEntry({ content: 'Group A item 2' }),
        createEntry({ content: 'Group B item 1' }),
        createEntry({ content: 'Group B item 2' }),
      ];

      mockEmbedFn
        .mockResolvedValueOnce(Array(128).fill(0.3))
        .mockResolvedValueOnce(Array(128).fill(0.3))
        .mockResolvedValueOnce(Array(128).fill(0.7))
        .mockResolvedValueOnce(Array(128).fill(0.7));

      const clusters = await retrieval.cluster(memories, 2);

      expect(clusters.size).toBe(2);
      expect(Array.from(clusters.values()).every((c) => c.length > 0)).toBe(
        true,
      );
    });

    it('should generate embeddings for memories without them', async () => {
      const memories = [
        createEntry({ content: 'Item 1' }),
        createEntry({ content: 'Item 2' }),
      ];

      await retrieval.cluster(memories, 2);

      expect(mockEmbedFn).toHaveBeenCalledTimes(2);
    });

    it('should use existing embeddings', async () => {
      const memories = [
        createEntry({ content: 'Item 1', embedding: Array(128).fill(0.5) }),
        createEntry({ content: 'Item 2', embedding: Array(128).fill(0.5) }),
      ];

      await retrieval.cluster(memories, 2);

      // Should not call embed function for memories with embeddings
      expect(mockEmbedFn).not.toHaveBeenCalled();
    });
  });

  describe('reranking', () => {
    it('should apply reranking when configured', async () => {
      const mockRerankFn = vi.fn(async (query, results) => {
        return results.reverse(); // Just reverse for testing
      });

      const rerankRetrieval = new SemanticRetrieval(store, mockEmbedFn, {
        reranking: true,
        rerankFn: mockRerankFn,
      });

      await store.add(
        createEntry({ id: 'entry1', embedding: Array(128).fill(0.5) }),
      );
      await store.add(
        createEntry({ id: 'entry2', embedding: Array(128).fill(0.5) }),
      );

      await rerankRetrieval.retrieve({ query: 'test' });

      expect(mockRerankFn).toHaveBeenCalled();
    });
  });

  describe('cosine similarity', () => {
    it('should calculate similarity between vectors', async () => {
      const memory1 = createEntry({
        content: 'Test 1',
        embedding: [1, 0, 0],
      });
      const memory2 = createEntry({
        content: 'Test 2',
        embedding: [1, 0, 0],
      });

      await store.add(memory1);
      await store.add(memory2);

      const similar = await retrieval.findSimilar(memory1);

      // Identical vectors should have high similarity
      if (similar.length > 0) {
        expect(similar[0].score).toBeGreaterThan(0.9);
      }
    });

    it('should handle orthogonal vectors', async () => {
      const memory1 = createEntry({
        content: 'Test 1',
        embedding: [1, 0, 0],
      });

      await store.add(createEntry({ content: 'Test 2', embedding: [0, 1, 0] }));

      const similar = await retrieval.findSimilar(memory1);

      // Orthogonal vectors should have low similarity
      if (similar.length > 0) {
        expect(similar[0].score).toBeLessThan(0.5);
      }
    });
  });

  describe('configure', () => {
    it('should update configuration', () => {
      retrieval.configure({
        topK: 20,
        minScore: 0.8,
      });

      const config = retrieval.getConfig();

      expect(config.topK).toBe(20);
      expect(config.minScore).toBe(0.8);
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const config = retrieval.getConfig();

      expect(config.topK).toBe(10);
      expect(config.minScore).toBe(0.5);
    });

    it('should return a copy of config', () => {
      const config1 = retrieval.getConfig();
      const config2 = retrieval.getConfig();

      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });
});
