import { describe, it, expect } from 'vitest';
import {
  calculateImportanceWithRecency,
  calculateImportanceWithAccess,
  calculateImportanceWithContext,
  calculateCombinedImportance,
  createImportanceCalculator,
  categorizeImportance,
  filterByImportance,
  sortByImportance,
} from '../utils/importance.js';
import type { MemoryEntry } from '../types/index.js';

function makeEntry(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
  const now = Date.now();
  return {
    id: 'mem-1',
    content: 'A reasonably sized memory entry used for scoring.',
    type: 'fact',
    importance: 0.6,
    metadata: { source: 'explicit', confidence: 0.9 },
    timestamp: now,
    accessCount: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('importance scoring utilities', () => {
  // These helpers are declared synchronous (`: number` / `: MemoryEntry[]`).
  // They previously wrapped results in Promise.resolve(), which both broke the
  // public type contract and caused calculateCombinedImportance to multiply
  // Promises arithmetically (producing NaN). These tests lock in the fix.

  it('calculateImportanceWithRecency returns a plain number in [0, 1]', () => {
    const score = calculateImportanceWithRecency(makeEntry());
    expect(typeof score).toBe('number');
    expect(score).not.toBeNaN();
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('recency score decays for older memories', () => {
    const halfLife = 7 * 24 * 60 * 60 * 1000;
    const fresh = calculateImportanceWithRecency(
      makeEntry({ timestamp: Date.now() }),
      halfLife,
    );
    const old = calculateImportanceWithRecency(
      makeEntry({ timestamp: Date.now() - 30 * 24 * 60 * 60 * 1000 }),
      halfLife,
    );
    expect(fresh).toBeGreaterThan(old);
  });

  it('calculateImportanceWithAccess returns a plain number and boosts with access', () => {
    const none = calculateImportanceWithAccess(makeEntry({ accessCount: 0 }));
    const many = calculateImportanceWithAccess(makeEntry({ accessCount: 10 }));
    expect(typeof many).toBe('number');
    expect(many).toBeGreaterThan(none);
    expect(many).toBeLessThanOrEqual(1);
  });

  it('calculateImportanceWithContext returns a plain number and boosts on match', () => {
    const base = makeEntry({
      importance: 0.5,
      metadata: { source: 'explicit', confidence: 0.9, userId: 'u1' },
    });
    const matched = calculateImportanceWithContext(base, { userId: 'u1' });
    const unmatched = calculateImportanceWithContext(base, { userId: 'other' });
    expect(typeof matched).toBe('number');
    expect(matched).toBeGreaterThan(unmatched);
  });

  it('calculateCombinedImportance returns a finite number (regression: not NaN)', () => {
    const score = calculateCombinedImportance(makeEntry(), {
      context: { userId: 'u1' },
    });
    expect(typeof score).toBe('number');
    expect(Number.isFinite(score)).toBe(true);
    expect(score).not.toBeNaN();
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('createImportanceCalculator produces a synchronous numeric scorer', () => {
    const calc = createImportanceCalculator({ confidenceWeight: 0.5 });
    const score = calc('some memory content here', 'preference', {
      source: 'explicit',
      confidence: 0.8,
    });
    expect(typeof score).toBe('number');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('categorizeImportance buckets scores', () => {
    expect(categorizeImportance(0.95)).toBe('critical');
    expect(categorizeImportance(0.75)).toBe('high');
    expect(categorizeImportance(0.55)).toBe('medium');
    expect(categorizeImportance(0.35)).toBe('low');
    expect(categorizeImportance(0.1)).toBe('trivial');
  });

  it('filterByImportance returns an array (not a Promise)', () => {
    const memories = [
      makeEntry({ id: 'a', importance: 0.2 }),
      makeEntry({ id: 'b', importance: 0.8 }),
    ];
    const result = filterByImportance(memories, 0.5);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b');
  });

  it('sortByImportance returns a sorted array (not a Promise)', () => {
    const memories = [
      makeEntry({ id: 'a', importance: 0.2 }),
      makeEntry({ id: 'b', importance: 0.9 }),
      makeEntry({ id: 'c', importance: 0.5 }),
    ];
    const desc = sortByImportance(memories);
    expect(Array.isArray(desc)).toBe(true);
    expect(desc.map((m) => m.id)).toEqual(['b', 'c', 'a']);

    const asc = sortByImportance(memories, false);
    expect(asc.map((m) => m.id)).toEqual(['a', 'c', 'b']);
  });
});
