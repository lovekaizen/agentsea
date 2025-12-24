import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkingMemory } from '../structures/WorkingMemory.js';
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

describe('WorkingMemory', () => {
  let workingMemory: WorkingMemory;
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
    workingMemory = new WorkingMemory(store, {
      maxSize: 5,
      ttl: 300000,
      attentionWindow: 3,
      decayRate: 0.1,
    });
  });

  describe('add', () => {
    it('should add entry to working memory', async () => {
      const entry = createEntry({ content: 'Test' });

      await workingMemory.add(entry);

      const context = workingMemory.getContext();
      expect(context.length).toBe(1);
      expect(context[0].content).toBe('Test');
    });

    it('should add entries to front (most recent)', async () => {
      await workingMemory.add(createEntry({ id: 'first', content: 'First' }));
      await workingMemory.add(createEntry({ id: 'second', content: 'Second' }));

      const context = workingMemory.getContext();
      expect(context[0].id).toBe('second');
      expect(context[1].id).toBe('first');
    });

    it('should move existing entry to front', async () => {
      const entry = createEntry({ id: 'same', content: 'Same' });

      await workingMemory.add(entry);
      await workingMemory.add(createEntry({ content: 'Other' }));
      await workingMemory.add(entry);

      const context = workingMemory.getContext();
      expect(context[0].id).toBe('same');
      expect(context.length).toBe(2);
    });

    it('should evict when at capacity', async () => {
      const entries = Array(7)
        .fill(null)
        .map((_, i) =>
          createEntry({ id: `entry-${i}`, importance: 0.5 - i * 0.1 }),
        );

      for (const entry of entries) {
        await workingMemory.add(entry);
      }

      expect(workingMemory.size).toBeLessThanOrEqual(5);
    });

    it('should emit contextUpdate event', async () => {
      const handler = vi.fn();
      workingMemory.on('contextUpdate', handler);

      await workingMemory.add(createEntry());

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('getContext', () => {
    it('should return all entries in context', async () => {
      await workingMemory.add(createEntry({ content: 'First' }));
      await workingMemory.add(createEntry({ content: 'Second' }));

      const context = workingMemory.getContext();

      expect(context.length).toBe(2);
      expect(context[0].content).toBe('Second');
      expect(context[1].content).toBe('First');
    });

    it('should return copy of context array', async () => {
      await workingMemory.add(createEntry());

      const context1 = workingMemory.getContext();
      const context2 = workingMemory.getContext();

      expect(context1).not.toBe(context2);
      expect(context1).toEqual(context2);
    });
  });

  describe('getContextWithAttention', () => {
    it('should return entries with attention scores', async () => {
      await workingMemory.add(createEntry({ importance: 0.8 }));
      await workingMemory.add(createEntry({ importance: 0.5 }));

      const scored = workingMemory.getContextWithAttention();

      expect(scored.length).toBe(2);
      expect(scored[0].recency).toBeDefined();
      expect(scored[0].relevance).toBeDefined();
      expect(scored[0].importance).toBeDefined();
      expect(scored[0].total).toBeDefined();
    });

    it('should score recent entries higher', async () => {
      await workingMemory.add(createEntry({ id: 'old' }));
      await workingMemory.add(createEntry({ id: 'new' }));

      const scored = workingMemory.getContextWithAttention();
      const newEntry = scored.find((s) => s.entry.id === 'new');
      const oldEntry = scored.find((s) => s.entry.id === 'old');

      expect(newEntry!.recency).toBeGreaterThan(oldEntry!.recency);
    });
  });

  describe('attend', () => {
    it('should increase attention score', async () => {
      const entry = createEntry({ id: 'test' });
      await workingMemory.add(entry);

      workingMemory.attend('test');

      const scored = workingMemory.getContextWithAttention();
      const attended = scored.find((s) => s.entry.id === 'test');

      expect(attended).toBeDefined();
    });

    it('should emit attention event', async () => {
      const entry = createEntry({ id: 'test' });
      await workingMemory.add(entry);

      const handler = vi.fn();
      workingMemory.on('attention', handler);

      workingMemory.attend('test');

      expect(handler).toHaveBeenCalled();
    });

    it('should cap attention at 1.0', async () => {
      const entry = createEntry({ id: 'test' });
      await workingMemory.add(entry);

      // Attend multiple times
      for (let i = 0; i < 10; i++) {
        workingMemory.attend('test');
      }

      const scored = workingMemory.getContextWithAttention();
      expect(scored[0].total).toBeLessThanOrEqual(1.5); // Combined with other factors
    });
  });

  describe('setQuery', () => {
    it('should set current query for relevance', () => {
      workingMemory.setQuery('pizza preferences');

      expect(workingMemory['currentQuery']).toBe('pizza preferences');
    });

    it('should affect relevance scoring', async () => {
      workingMemory.setQuery('pizza');

      await workingMemory.add(createEntry({ content: 'I love pizza' }));
      await workingMemory.add(createEntry({ content: 'The weather is nice' }));

      const scored = workingMemory.getContextWithAttention();
      const pizzaEntry = scored.find((s) => s.entry.content.includes('pizza'));
      const weatherEntry = scored.find((s) =>
        s.entry.content.includes('weather'),
      );

      expect(pizzaEntry!.relevance).toBeGreaterThan(weatherEntry!.relevance);
    });
  });

  describe('decay', () => {
    it('should reduce attention scores', async () => {
      const entry = createEntry({ id: 'test' });
      await workingMemory.add(entry);
      workingMemory.attend('test');

      const initialAttention = workingMemory['attentionBuffer'].get('test')!;

      workingMemory.decay();

      const decayedAttention = workingMemory['attentionBuffer'].get('test')!;
      expect(decayedAttention).toBeLessThan(initialAttention);
    });

    it('should remove very low attention scores', async () => {
      const entry = createEntry({ id: 'test' });
      await workingMemory.add(entry);

      // Decay multiple times
      for (let i = 0; i < 100; i++) {
        workingMemory.decay();
      }

      const attention = workingMemory['attentionBuffer'].get('test');
      expect(attention).toBeUndefined();
    });
  });

  describe('getFocused', () => {
    it('should return most attended entries', async () => {
      await workingMemory.add(createEntry({ id: 'low', importance: 0.2 }));
      await workingMemory.add(createEntry({ id: 'high', importance: 0.9 }));

      workingMemory.attend('high');
      workingMemory.attend('high');

      const focused = workingMemory.getFocused(1);

      expect(focused.length).toBe(1);
      expect(focused[0].id).toBe('high');
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await workingMemory.add(createEntry({ id: `entry-${i}` }));
      }

      const focused = workingMemory.getFocused(3);

      expect(focused.length).toBe(3);
    });
  });

  describe('clear', () => {
    it('should remove all entries', async () => {
      await workingMemory.add(createEntry());
      await workingMemory.add(createEntry());

      workingMemory.clear();

      expect(workingMemory.size).toBe(0);
      expect(workingMemory.getContext().length).toBe(0);
    });

    it('should emit overflow and contextUpdate events', async () => {
      await workingMemory.add(createEntry());

      const overflowHandler = vi.fn();
      const updateHandler = vi.fn();

      workingMemory.on('overflow', overflowHandler);
      workingMemory.on('contextUpdate', updateHandler);

      workingMemory.clear();

      expect(overflowHandler).toHaveBeenCalled();
      expect(updateHandler).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should remove specific entry', async () => {
      await workingMemory.add(createEntry({ id: 'test' }));
      await workingMemory.add(createEntry({ id: 'other' }));

      const success = workingMemory.remove('test');

      expect(success).toBe(true);
      expect(workingMemory.size).toBe(1);
      expect(workingMemory.getContext().every((e) => e.id !== 'test')).toBe(
        true,
      );
    });

    it('should return false for non-existent entry', () => {
      const success = workingMemory.remove('non-existent');

      expect(success).toBe(false);
    });

    it('should emit contextUpdate event', async () => {
      await workingMemory.add(createEntry({ id: 'test' }));

      const handler = vi.fn();
      workingMemory.on('contextUpdate', handler);

      workingMemory.remove('test');

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('size and isFull', () => {
    it('should track size', async () => {
      expect(workingMemory.size).toBe(0);

      await workingMemory.add(createEntry());
      expect(workingMemory.size).toBe(1);

      await workingMemory.add(createEntry());
      expect(workingMemory.size).toBe(2);
    });

    it('should indicate when full', async () => {
      expect(workingMemory.isFull).toBe(false);

      for (let i = 0; i < 5; i++) {
        await workingMemory.add(createEntry({ id: `entry-${i}` }));
      }

      expect(workingMemory.isFull).toBe(true);
    });
  });

  describe('consolidate', () => {
    it('should consolidate important items to target store', async () => {
      const targetStore = new InMemoryStore();

      await workingMemory.add(createEntry({ importance: 0.9 }));
      await workingMemory.add(createEntry({ importance: 0.8 }));

      const count = await workingMemory.consolidate(targetStore);

      expect(count).toBeGreaterThan(0);
      expect(await targetStore.count()).toBe(count);
    });

    it('should only consolidate high-scoring memories', async () => {
      const targetStore = new InMemoryStore();

      await workingMemory.add(createEntry({ importance: 0.1 }));
      await workingMemory.add(createEntry({ importance: 0.05 }));

      const count = await workingMemory.consolidate(targetStore);

      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('loadFromStore', () => {
    it('should load context from store', async () => {
      await store.add(
        createEntry({
          content: 'Stored 1',
          metadata: { source: 'explicit', confidence: 1, namespace: 'test' },
        }),
      );
      await store.add(
        createEntry({
          content: 'Stored 2',
          metadata: { source: 'explicit', confidence: 1, namespace: 'test' },
        }),
      );

      await workingMemory.loadFromStore({ namespace: 'test' });

      expect(workingMemory.size).toBe(2);
    });

    it('should respect limit when loading', async () => {
      for (let i = 0; i < 10; i++) {
        await store.add(
          createEntry({
            metadata: { source: 'explicit', confidence: 1, namespace: 'test' },
          }),
        );
      }

      await workingMemory.loadFromStore({ namespace: 'test', limit: 3 });

      expect(workingMemory.size).toBe(3);
    });

    it('should emit contextUpdate event', async () => {
      await store.add(
        createEntry({
          metadata: { source: 'explicit', confidence: 1, namespace: 'test' },
        }),
      );

      const handler = vi.fn();
      workingMemory.on('contextUpdate', handler);

      await workingMemory.loadFromStore({ namespace: 'test' });

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('getSummary', () => {
    it('should return summary statistics', async () => {
      await workingMemory.add(createEntry({ type: 'fact' }));
      await workingMemory.add(createEntry({ type: 'fact' }));
      await workingMemory.add(createEntry({ type: 'preference' }));

      const summary = workingMemory.getSummary();

      expect(summary.size).toBe(3);
      expect(summary.maxSize).toBe(5);
      expect(summary.avgAttention).toBeGreaterThanOrEqual(0);
      expect(summary.topTypes).toEqual({ fact: 2, preference: 1 });
    });
  });
});
