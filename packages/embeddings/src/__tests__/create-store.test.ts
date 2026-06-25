import { describe, it, expect } from 'vitest';
import { createStore, MemoryStore } from '../stores/index.js';

describe('createStore factory', () => {
  it('creates a MemoryStore for type "memory"', () => {
    const store = createStore('memory', { dimensions: 8 });
    expect(store).toBeInstanceOf(MemoryStore);
  });

  it.each(['weaviate', 'milvus', 'pgvector'] as const)(
    'throws a clear "not implemented" error for %s instead of silently falling back',
    (type) => {
      expect(() => createStore(type, { dimensions: 8 })).toThrow(
        /not implemented/i,
      );
    },
  );

  it('throws for an unknown store type', () => {
    expect(() =>
      // @ts-expect-error intentionally passing an invalid type
      createStore('not-a-store', { dimensions: 8 }),
    ).toThrow(/unknown vector store/i);
  });
});
